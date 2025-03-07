'use strict';

// 全局变量
let currentAdTimestamps = [];     // 当前生效的广告时间段
let urlAdTimestamps = [];         // URL解析的原始广告时间段
let currentVideoId = '';          // 当前视频ID
let lastVideoId = '';             // 上一个视频ID
let debugMode = false;            // 调试模式开关
let scriptInitiatedSeek = false;  // 标记是否是脚本引起的seeking
let isAdminAuthorized = false;    // 管理员认证状态
let adSkipPercentage = 5;           // 添加广告跳过百分比全局变量，默认为5%

// 日志输出函数
function logDebug(message, data) {
    if (!debugMode) return;

    if (data) {
        console.log(`--==--LOG: ${message}`, data);
    } else {
        console.log(`--==--LOG: ${message}`);
    }
}

// 初始化调试开关
function initDebugMode() {
    chrome.storage.local.get('adskip_debug_mode', (result) => {
        debugMode = result.adskip_debug_mode || false;
        if (debugMode) {
            console.log('--==--LOG: 调试模式已启用');
        }
    });
}

// 获取当前视频ID (BV或AV)
function getCurrentVideoId() {
    const pathname = window.location.pathname;
    const bvMatch = pathname.match(/\/video\/(BV[\w]+)/);
    if (bvMatch && bvMatch[1]) {
        logDebug(`从路径中提取到BV ID: ${bvMatch[1]}`);
        return bvMatch[1]; // 返回BV ID
    }

    // 如果没有BV ID，尝试查找AV ID
    const urlParams = new URLSearchParams(window.location.search);
    const avid = urlParams.get('aid');
    if (avid) {
        logDebug(`从URL参数中提取到AV ID: av${avid}`);
        return 'av' + avid;
    }

    logDebug('无法提取视频ID');
    return '';
}

// 解析URL中的adskip参数
function parseAdSkipParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const adskipParam = urlParams.get('adskip');

    if (!adskipParam) {
        logDebug('URL中没有adskip参数');
        return [];
    }

    try {
        // 解析格式: 61-87,120-145,300-320
        const result = adskipParam.split(',').map(segment => {
            const [start, end] = segment.split('-').map(Number);
            return {
                start_time: start,
                end_time: end,
                description: `URL指定的广告 (${start}s-${end}s)`
            };
        });
        logDebug(`解析URL adskip参数成功:`, result);
        return result;
    } catch (e) {
        console.error('--==--LOG: 解析adskip参数失败:', e);
        return [];
    }
}

// 将时间戳数组转换为字符串格式
function timestampsToString(timestamps) {
    return timestamps.map(ad => `${ad.start_time}-${ad.end_time}`).join(',');
}

// 加载指定视频ID的广告时间戳
function loadAdTimestampsForVideo(videoId) {
    return new Promise((resolve) => {
        if (!videoId) {
            logDebug('视频ID为空，无法加载广告时间段');
            resolve([]);
            return;
        }

        try {
            chrome.storage.local.get(`adskip_${videoId}`, (result) => {
                const savedData = result[`adskip_${videoId}`];
                if (!savedData) {
                    logDebug(`没有找到视频 ${videoId} 的保存数据`);
                    resolve([]);
                    return;
                }

                const parsed = JSON.parse(savedData);
                logDebug(`成功加载视频 ${videoId} 的广告时间段:`, parsed);
                resolve(parsed);
            });
        } catch (e) {
            console.error(`--==--LOG: 加载视频 ${videoId} 广告数据失败:`, e);
            resolve([]);
        }
    });
}

// 保存指定视频ID的广告时间戳
function saveAdTimestampsForVideo(videoId, timestamps) {
    if (!videoId) {
        logDebug('视频ID为空，无法保存广告时间段');
        return;
    }

    try {
        const dataString = JSON.stringify(timestamps);
        const data = {};
        data[`adskip_${videoId}`] = dataString;
        chrome.storage.local.set(data, () => {
            logDebug(`成功保存视频 ${videoId} 的广告时间段:`, timestamps);
        });
    } catch (e) {
        console.error(`--==--LOG: 保存视频 ${videoId} 广告数据失败:`, e);
    }
}

// 判断两个时间段是否重叠
function isOverlapping(segment1, segment2) {
    return (segment1.start_time <= segment2.end_time && segment1.end_time >= segment2.start_time);
}

// 加载广告跳过百分比设置
function loadAdSkipPercentage() {
    chrome.storage.local.get('adskip_percentage', function(result) {
        if (result.adskip_percentage !== undefined) {
            adSkipPercentage = result.adskip_percentage;
            logDebug(`加载广告跳过百分比设置: ${adSkipPercentage}%`);
        } else {
            // 如果没有保存的设置，默认为5%
            adSkipPercentage = 5;
            // 保存默认设置
            chrome.storage.local.set({'adskip_percentage': adSkipPercentage});
            logDebug(`设置默认广告跳过百分比: ${adSkipPercentage}%`);
        }
    });
}

// 保存广告跳过百分比设置
function saveAdSkipPercentage(percentage) {
    // 转为整数确保一致性
    percentage = parseInt(percentage, 10);

    // 检查是否实际发生了变化
    if (adSkipPercentage !== percentage) {
        chrome.storage.local.set({'adskip_percentage': percentage}, function() {
            adSkipPercentage = percentage;
            logDebug(`已保存广告跳过百分比设置: ${adSkipPercentage}%`);
        });
    }
}

// 设置广告跳过监控
function setupAdSkipMonitor(adTimestamps) {
    logDebug('设置广告跳过监控:', adTimestamps);
    currentAdTimestamps = adTimestamps; // 更新当前生效的时间段

    // 保存到本地存储
    if (currentVideoId) {
        saveAdTimestampsForVideo(currentVideoId, adTimestamps);
    }

    let videoPlayer = null;
    let lastCheckTime = 0;

    function findVideoPlayer() {
        const player = document.querySelector('#bilibili-player video') ||
                      document.querySelector('.bpx-player-video-area video');
        if (player && player !== videoPlayer) {
            logDebug('找到新的视频播放器元素');
        }
        return player;
    }

    // 设置事件监听
    function setupEventListener() {
        if (!videoPlayer) return;

        // 避免重复添加事件
        videoPlayer.removeEventListener('seeking', onSeeking);
        videoPlayer.addEventListener('seeking', onSeeking);

        logDebug('视频事件监听已设置');
    }

    // 处理seeking事件，只记录是否是脚本操作
    function onSeeking() {
        if (scriptInitiatedSeek) {
            logDebug("这是脚本引起的seeking事件，忽略");
            scriptInitiatedSeek = false;
        }
    }

    // 核心检查函数 - 简化逻辑
    function checkAndSkip() {
        // 检查是否启用广告跳过功能
        chrome.storage.local.get('adskip_enabled', function(result) {
            if (result.adskip_enabled === false) {
                logDebug('广告跳过功能已禁用，不设置监视器');
                return;
            }

            // 查找视频播放器
            if (!videoPlayer) {
                videoPlayer = findVideoPlayer();
                if (!videoPlayer) {
                    return;
                }
                setupEventListener();
            }

            if (videoPlayer.paused || videoPlayer.ended) return;

            const currentTime = videoPlayer.currentTime;

            // 检查视频ID是否变化
            const newVideoId = getCurrentVideoId();
            if (newVideoId !== currentVideoId && newVideoId !== '') {
                logDebug(`视频ID变化检测 (checkAndSkip): ${currentVideoId} -> ${newVideoId}`);
                lastVideoId = currentVideoId;
                currentVideoId = newVideoId;
                reinitialize();
                return;
            }

            // 记录时间跳跃情况，但不再使用userInteracted标志
            if (Math.abs(currentTime - lastCheckTime) > 3 && lastCheckTime > 0) {
                logDebug(`检测到大幅时间跳跃: ${lastCheckTime} -> ${currentTime}`);
            }
            lastCheckTime = currentTime;

            // 更新的广告检测逻辑：使用百分比计算
            for (const ad of currentAdTimestamps) {
                // 计算广告时长
                const adDuration = ad.end_time - ad.start_time;

                // 根据百分比计算跳过点，但至少跳过1秒
                const skipDuration = Math.max(1, (adDuration * adSkipPercentage / 100));

                // 确定广告的"开始区域"：从开始到min(开始+跳过时长,结束)
                const adStartRange = Math.min(ad.start_time + skipDuration, ad.end_time);

                // 如果在广告开始区域，直接跳到结束
                if (currentTime >= ad.start_time && currentTime < adStartRange) {
                    logDebug(`检测到在广告开始区域 [${ad.start_time}s-${adStartRange}s]，应用跳过范围:前${adSkipPercentage}%，跳过至${ad.end_time}s`);

                    // 标记为脚本操作并跳转
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = ad.end_time;
                    logDebug(`已跳过广告: ${ad.start_time}s-${ad.end_time}s`);
                    break;
                }
            }
        });
    }

    // 清除旧监控
    if (window.adSkipCheckInterval) {
        clearInterval(window.adSkipCheckInterval);
        logDebug('清除旧的广告监控定时器');
    }

    // 设置新监控
    window.adSkipCheckInterval = setInterval(checkAndSkip, 500);
    logDebug('设置新的广告监控定时器');
}

// 验证管理员身份
function verifyAdminAccess(apiKey) {
    // 这是一个简单的哈希检查，您可以替换为更安全的方法
    // 示例API密钥: bilibili-adskip-admin-2025
    const validKeyHash = "12d9853b"; // 一个示例哈希

    // 简单哈希函数
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16).substring(0, 26);
    }

    const inputHash = simpleHash(apiKey);
    const isValid = (inputHash === validKeyHash);
    // console.log(`验证管理员身份: ${inputHash}`);
    if (isValid) {
        // 将授权状态保存在sessionStorage中，这样刷新页面后还能保持授权
        // 但关闭浏览器后会清除（临时性）
        sessionStorage.setItem('adskip_admin_authorized', 'true');
        isAdminAuthorized = true;
        return true;
    }

    return false;
}

// 检查管理员权限
function checkAdminStatus() {
    // 从sessionStorage中获取授权状态
    const savedAuth = sessionStorage.getItem('adskip_admin_authorized');
    if (savedAuth === 'true') {
        isAdminAuthorized = true;
        return true;
    }
    return false;
}

// 创建链接生成器UI
function createLinkGenerator() {
    // 创建悬浮按钮
    const button = document.createElement('div');
    button.innerHTML = '⏩ 广告跳过';
    button.id = 'adskip-button';
    button.className = 'adskip-button';

    // 点击展开操作面板
    button.addEventListener('click', function() {
        if (document.getElementById('adskip-panel')) {
            document.getElementById('adskip-panel').remove();
            return;
        }

        // 刷新当前视频ID
        currentVideoId = getCurrentVideoId();

        const panel = document.createElement('div');
        panel.id = 'adskip-panel';
        panel.className = 'adskip-panel';

        // 获取当前生效的时间段字符串
        const currentTimeString = timestampsToString(currentAdTimestamps);

        // 检查是否启用广告跳过功能
        chrome.storage.local.get('adskip_enabled', function(result) {
            const isEnabled = result.adskip_enabled !== false;

            // 面板内容
            panel.innerHTML = `
                <div class="adskip-panel-header">
                    <h3 class="adskip-title">广告跳过 - 时间设置</h3>
                    <label class="adskip-switch">
                        <input type="checkbox" id="adskip-toggle" ${isEnabled ? 'checked' : ''}>
                        <span class="adskip-slider"></span>
                    </label>
                </div>
                <div class="adskip-video-id">当前视频: ${currentVideoId || '未识别'}</div>
                <p>输入广告时间段（格式: 开始-结束,开始-结束）</p>
                <input id="adskip-input" type="text" value="${currentTimeString}" placeholder="例如: 61-87,120-145">

                <div class="adskip-percentage-container">
                    <div class="adskip-percentage-label">广告跳过触发范围：前 <span id="adskip-percentage-value">${adSkipPercentage}</span>%</div>
                    <input type="range" id="adskip-percentage-slider" min="1" max="100" value="${adSkipPercentage}" class="adskip-percentage-slider">
                    <div class="adskip-percentage-hints">
                        <span class="adskip-percentage-preset" data-value="1">仅起始(1%)</span>
                        <span class="adskip-percentage-preset" data-value="50">前半段(50%)</span>
                        <span class="adskip-percentage-preset" data-value="100">全程(100%)</span>
                    </div>
                </div>

                <div class="adskip-button-row">
                    <button id="adskip-generate" class="adskip-btn">🔗 创建分享链接</button>
                    <button id="adskip-apply" class="adskip-btn">✅ 更新跳过设置</button>
                </div>
                <div class="adskip-button-row">
                    <button id="adskip-restore" class="adskip-btn">↩️ 还原原始设置</button>
                    <button id="adskip-reset" class="adskip-btn">🗑️ 清空记录</button>
                </div>
                <div id="adskip-status" class="adskip-status">设置已应用</div>
                <div id="adskip-result" class="adskip-result"></div>
                ${checkAdminStatus() ? `
                <div class="adskip-admin-container">
                    <button id="adskip-admin" class="adskip-admin-btn">🔧 管理员设置</button>
                </div>
                ` : `
                <div class="adskip-admin-container">
                    <button id="adskip-login" class="adskip-admin-btn">🔑 管理员登录</button>
                </div>
                `}
            `;

            // 开关逻辑
            document.getElementById('adskip-toggle').addEventListener('change', function() {
                const isEnabled = this.checked;
                chrome.storage.local.set({'adskip_enabled': isEnabled}, function() {
                    // 如果禁用，清除当前的监控
                    if (!isEnabled && window.adSkipCheckInterval) {
                        clearInterval(window.adSkipCheckInterval);
                        window.adSkipCheckInterval = null;
                        logDebug('已临时禁用广告跳过功能');
                    } else if (isEnabled) {
                        // 重新启用监控
                        if (currentAdTimestamps.length > 0) {
                            setupAdSkipMonitor(currentAdTimestamps);
                            logDebug('已重新启用广告跳过功能');
                        }
                    }
                });
            });

            // 广告跳过百分比滑块逻辑
            const percentageSlider = document.getElementById('adskip-percentage-slider');
            const percentageValue = document.getElementById('adskip-percentage-value');

            percentageSlider.addEventListener('input', function() {
                const newValue = parseInt(this.value, 10);
                percentageValue.textContent = newValue;
            });

            percentageSlider.addEventListener('change', function() {
                const newValue = parseInt(this.value, 10);
                saveAdSkipPercentage(newValue);

                // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                chrome.storage.local.get('adskip_enabled', function(result) {
                    if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
                        setupAdSkipMonitor(currentAdTimestamps);
                    }

                    document.getElementById('adskip-status').textContent = `已更新广告跳过范围为：前${newValue}%`;
                    document.getElementById('adskip-status').style.display = 'block';
                });
            });

            // 为百分比预设值添加点击事件
            const percentagePresets = document.querySelectorAll('.adskip-percentage-preset');
            percentagePresets.forEach(preset => {
                preset.addEventListener('click', function() {
                    const presetValue = parseInt(this.getAttribute('data-value'), 10);

                    // 更新滑块值和显示值
                    percentageSlider.value = presetValue;
                    percentageValue.textContent = presetValue;

                    // 保存设置并应用
                    saveAdSkipPercentage(presetValue);

                    // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                    chrome.storage.local.get('adskip_enabled', function(result) {
                        if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
                            setupAdSkipMonitor(currentAdTimestamps);
                        }

                        document.getElementById('adskip-status').textContent = `已更新广告跳过范围为：前${presetValue}%`;
                        document.getElementById('adskip-status').style.display = 'block';
                    });
                });
            });

            // 生成链接按钮
            document.getElementById('adskip-generate').addEventListener('click', function() {
                const input = document.getElementById('adskip-input').value.trim();
                if (!input) {
                    alert('请输入有效的时间段');
                    return;
                }

                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('adskip', input);

                const resultDiv = document.getElementById('adskip-result');
                resultDiv.innerHTML = `
                    <p>广告跳过链接:</p>
                    <a href="${currentUrl.toString()}" target="_blank">${currentUrl.toString()}</a>
                `;
            });

            // 立即应用按钮
            document.getElementById('adskip-apply').addEventListener('click', function() {
                const input = document.getElementById('adskip-input').value.trim();
                if (!input) {
                    // 如果输入为空，则清空时间段
                    setupAdSkipMonitor([]);
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '设置已应用: 已清空所有时间段';
                    return;
                }

                try {
                    const adTimestamps = input.split(',').map(segment => {
                        const [start, end] = segment.split('-').map(Number);
                        if (isNaN(start) || isNaN(end) || start >= end) {
                            throw new Error('时间格式无效');
                        }
                        return {
                            start_time: start,
                            end_time: end,
                            description: `手动指定的广告 (${start}s-${end}s)`
                        };
                    });

                    setupAdSkipMonitor(adTimestamps); // 覆盖而不是添加
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '设置已应用: ' + input;
                } catch (e) {
                    alert('格式错误，请使用正确的格式：开始-结束,开始-结束');
                }
            });

            // 还原按钮
            document.getElementById('adskip-restore').addEventListener('click', function() {
                // 如果有URL参数，使用URL中的值
                if (urlAdTimestamps.length > 0) {
                    setupAdSkipMonitor(urlAdTimestamps);
                    document.getElementById('adskip-input').value = timestampsToString(urlAdTimestamps);
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '已还原为URL中的设置';
                } else {
                    // 否则清空
                    setupAdSkipMonitor([]);
                    document.getElementById('adskip-input').value = '';
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '已还原（清空所有设置）';
                }
            });

            // 管理员设置按钮
            if (checkAdminStatus()) {
                document.getElementById('adskip-admin').addEventListener('click', function() {
                    showAdminPanel();
                });
            } else {
                // 添加管理员登录功能
                document.getElementById('adskip-login').addEventListener('click', function() {
                    const apiKey = prompt('请输入管理员API密钥:');
                    if (!apiKey) return;

                    if (verifyAdminAccess(apiKey)) {
                        alert('验证成功，已获得管理员权限');
                        // 重新加载面板以显示管理员选项
                        document.getElementById('adskip-panel').remove();
                        createLinkGenerator();
                        document.getElementById('adskip-button').click();
                    } else {
                        alert('API密钥无效');
                    }
                });
            }

            // 重置按钮
            document.getElementById('adskip-reset').addEventListener('click', function() {
                if (confirm('确定要重置所有设置吗？此操作将清空所有保存的广告跳过数据！')) {
                    // 获取并删除所有adskip_开头的存储键
                    chrome.storage.local.get(null, function(items) {
                        const allKeys = Object.keys(items);
                        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');

                        if (adskipKeys.length > 0) {
                            chrome.storage.local.remove(adskipKeys, function() {
                                // 清空当前设置
                                currentAdTimestamps = [];
                                urlAdTimestamps = [];

                                // 清除现有的监控
                                if (window.adSkipCheckInterval) {
                                    clearInterval(window.adSkipCheckInterval);
                                    window.adSkipCheckInterval = null;
                                }

                                // 更新输入框
                                document.getElementById('adskip-input').value = '';
                                document.getElementById('adskip-status').style.display = 'block';
                                document.getElementById('adskip-status').innerText = '已重置所有设置';

                                logDebug('已重置所有设置');
                            });
                        }
                    });
                }
            });
        });

        document.body.appendChild(panel);
    });

    document.body.appendChild(button);
}

// 管理员面板显示
function showAdminPanel() {
    const existingPanel = document.getElementById('adskip-admin-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    // 获取所有保存的数据
    chrome.storage.local.get(null, function(items) {
        const allKeys = Object.keys(items);
        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_'));
        const videoData = [];

        for (const key of adskipKeys) {
            if (key === 'adskip_debug_mode') continue;

            try {
                const videoId = key.replace('adskip_', '');
                const data = items[key];
                const timestamps = JSON.parse(data);
                videoData.push({
                    videoId,
                    timestamps,
                    timeString: timestampsToString(timestamps)
                });
            } catch (e) {
                console.error(`--==--LOG: 解析存储数据失败: ${key}`, e);
            }
        }

        const adminPanel = document.createElement('div');
        adminPanel.id = 'adskip-admin-panel';
        adminPanel.className = 'adskip-admin-panel';

        // 管理员面板内容
        let videoListHTML = '';
        if (videoData.length > 0) {
            videoData.forEach((item, index) => {
                videoListHTML += `
                    <div class="adskip-video-item">
                        <div class="adskip-video-header">
                            <span class="adskip-video-id">${item.videoId}</span>
                            <button class="adskip-delete-btn" data-index="${index}">🗑️ 删除</button>
                        </div>
                        <div class="adskip-video-time">${item.timeString}</div>
                    </div>
                `;
            });
        } else {
            videoListHTML = '<div class="adskip-no-data">没有保存的广告跳过数据</div>';
        }

        adminPanel.innerHTML = `
            <div class="adskip-admin-header">
                <h3>广告跳过 - 管理员设置</h3>
                <button id="adskip-admin-close" class="adskip-close-btn">✖</button>
            </div>

            <div class="adskip-debug-toggle">
                <input type="checkbox" id="adskip-debug-mode" ${debugMode ? 'checked' : ''}>
                <label for="adskip-debug-mode">启用调试模式 (在控制台输出详细日志)</label>
            </div>

            <div class="adskip-status-section">
                <h4>当前视频状态</h4>
                <div class="adskip-status-info">
                    <div>当前视频ID: ${currentVideoId || '未识别'}</div>
                    <div>上一个视频ID: ${lastVideoId || '无'}</div>
                    <div>URL广告段数: ${urlAdTimestamps.length}</div>
                    <div>当前广告段数: ${currentAdTimestamps.length}</div>
                </div>
            </div>

            <div class="adskip-video-list-section">
                <h4>已保存的视频广告数据 (${videoData.length})</h4>
                <div id="adskip-video-list">
                    ${videoListHTML}
                </div>
            </div>

            <div class="adskip-admin-footer">
                <button id="adskip-clear-all" class="adskip-danger-btn">清除所有数据</button>
                <button id="adskip-export" class="adskip-info-btn">导出数据</button>
            </div>
        `;

        document.body.appendChild(adminPanel);

        // 事件绑定
        document.getElementById('adskip-admin-close').addEventListener('click', function() {
            adminPanel.remove();
        });

        document.getElementById('adskip-debug-mode').addEventListener('change', function() {
            debugMode = this.checked;
            chrome.storage.local.set({'adskip_debug_mode': debugMode}, function() {
                logDebug(`调试模式已${debugMode ? '启用' : '禁用'}`);
            });
        });

        document.getElementById('adskip-clear-all').addEventListener('click', function() {
            if (confirm('确定要删除所有保存的广告跳过数据吗？此操作不可撤销！')) {
                const keysToRemove = adskipKeys.filter(key => key !== 'adskip_debug_mode');

                if (keysToRemove.length > 0) {
                    chrome.storage.local.remove(keysToRemove, function() {
                        logDebug('已清除所有保存的广告跳过数据');
                        adminPanel.remove();
                    });
                }
            }
        });

        document.getElementById('adskip-export').addEventListener('click', function() {
            const exportData = {};
            for (const key of adskipKeys) {
                if (key !== 'adskip_debug_mode') {
                    exportData[key] = items[key];
                }
            }

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

            const exportLink = document.createElement('a');
            exportLink.setAttribute('href', dataUri);
            exportLink.setAttribute('download', 'bilibili_adskip_data.json');
            document.body.appendChild(exportLink);
            exportLink.click();
            document.body.removeChild(exportLink);
        });

        // 绑定删除按钮事件
        const deleteButtons = document.querySelectorAll('.adskip-delete-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const videoId = videoData[index].videoId;

                if (confirm(`确定要删除 ${videoId} 的广告跳过设置吗？`)) {
                    chrome.storage.local.remove(`adskip_${videoId}`, function() {
                        logDebug(`已删除视频 ${videoId} 的广告跳过设置`);

                        // 如果删除的是当前视频的设置，更新当前状态
                        if (videoId === currentVideoId) {
                            currentAdTimestamps = [];
                            const inputElement = document.getElementById('adskip-input');
                            if (inputElement) {
                                inputElement.value = '';
                            }
                        }

                        // 重新显示管理员面板
                        adminPanel.remove();
                        showAdminPanel();
                    });
                }
            });
        });
    });
}

// 监听URL变化
function setupUrlChangeMonitor() {
    let lastUrl = window.location.href;

    // 使用MutationObserver监视DOM变化可能表明URL变化
    const observer = new MutationObserver(function(mutations) {
        if (lastUrl !== window.location.href) {
            logDebug(`URL变化检测到: ${lastUrl} -> ${window.location.href}`);
            lastUrl = window.location.href;

            // 刷新当前视频ID
            const newVideoId = getCurrentVideoId();
            if (newVideoId !== currentVideoId && newVideoId !== '') {
                logDebug(`视频ID变化检测 (observer): ${currentVideoId} -> ${newVideoId}`);
                lastVideoId = currentVideoId;
                currentVideoId = newVideoId;
                reinitialize();
            }
        }
    });

    observer.observe(document, {subtree: true, childList: true});
    logDebug('URL变化监视器已设置');

    // 设置直接监听popstate和hashchange事件
    window.addEventListener('popstate', function() {
        logDebug('检测到popstate事件，可能是URL变化');
        checkForVideoChange();
    });

    window.addEventListener('hashchange', function() {
        logDebug('检测到hashchange事件，可能是URL变化');
        checkForVideoChange();
    });
}

// 检查视频变化
function checkForVideoChange() {
    const newVideoId = getCurrentVideoId();
    if (newVideoId !== currentVideoId && newVideoId !== '') {
        logDebug(`视频ID变化检测 (event): ${currentVideoId} -> ${newVideoId}`);
        lastVideoId = currentVideoId;
        currentVideoId = newVideoId;
        reinitialize();
    }
}

// 重新初始化
async function reinitialize() {
    logDebug(`重新初始化，当前视频ID: ${currentVideoId}`);

    // 重新解析URL中的广告跳过参数
    const currentUrlAdTimestamps = parseAdSkipParam();
    urlAdTimestamps = currentUrlAdTimestamps; // 更新全局变量

    // 尝试从本地存储加载
    const savedTimestamps = await loadAdTimestampsForVideo(currentVideoId);

    // 获取所有保存的数据，用于比较
    chrome.storage.local.get(null, function(items) {
        const allKeys = Object.keys(items);
        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');
        let matchFound = false;

        // 检查当前URL中的时间戳是否与任何已保存的时间戳匹配
        if (currentUrlAdTimestamps.length > 0) {
            const currentTimeString = timestampsToString(currentUrlAdTimestamps);

            // 遍历所有保存的视频数据，检查是否有匹配的时间戳
            for (const key of adskipKeys) {
                try {
                    const data = items[key];
                    const timestamps = JSON.parse(data);
                    const savedTimeString = timestampsToString(timestamps);

                    if (currentTimeString === savedTimeString) {
                        matchFound = true;
                        logDebug(`找到匹配的时间戳记录: ${key}, 时间戳: ${savedTimeString}`);
                        break;
                    }
                } catch (e) {
                    console.error(`--==--LOG: 解析存储数据失败: ${key}`, e);
                }
            }

            if (matchFound) {
                // 如果找到匹配，则设置为空值（可能是异常的URL传递）
                logDebug('URL adskip 参数与已保存记录匹配，设置为空值');
                currentAdTimestamps = [];
                urlAdTimestamps = [];

                // 清除现有的监控
                if (window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                }
            } else {
                // 没有找到匹配，使用URL中的参数
                setupAdSkipMonitor(currentUrlAdTimestamps);
                currentAdTimestamps = [...currentUrlAdTimestamps];
                urlAdTimestamps = [...currentUrlAdTimestamps];
                logDebug('使用URL中的广告时间段初始化或更新');
            }
        } else if (savedTimestamps.length > 0) {
            setupAdSkipMonitor(savedTimestamps);
            currentAdTimestamps = [...savedTimestamps];
            logDebug('使用保存的广告时间段');
        } else {
            currentAdTimestamps = [];
            // 清除现有的监控
            if (window.adSkipCheckInterval) {
                clearInterval(window.adSkipCheckInterval);
                window.adSkipCheckInterval = null;
            }
            logDebug('没有找到广告时间段，清除监控');
        }

        // 更新面板中的信息（如果面板已打开）
        const inputElement = document.getElementById('adskip-input');
        if (inputElement) {
            inputElement.value = timestampsToString(currentAdTimestamps);

            // 更新视频ID显示
            const videoIdElement = document.querySelector('.adskip-video-id');
            if (videoIdElement) {
                videoIdElement.textContent = `当前视频: ${currentVideoId || '未识别'}`;
            }
        }
    });
}

// 主函数
async function init() {
    // 初始化调试模式
    initDebugMode();

    // 确保默认设置存在
    chrome.storage.local.get(['adskip_enabled', 'adskip_percentage', 'adskip_debug_mode'], function(result) {
        // 设置默认值（如果不存在）
        const defaults = {};

        if (result.adskip_enabled === undefined) {
            defaults.adskip_enabled = true;
            logDebug('初始化默认功能开关状态: 已启用');
        }

        if (result.adskip_percentage === undefined) {
            defaults.adskip_percentage = 5;
            logDebug('初始化默认广告跳过百分比: 5%');
        }

        // 如果有需要设置的默认值，则一次性保存
        if (Object.keys(defaults).length > 0) {
            chrome.storage.local.set(defaults);
        }

        // 更新全局变量
        if (result.adskip_percentage !== undefined) {
            adSkipPercentage = result.adskip_percentage;
        } else if (defaults.adskip_percentage !== undefined) {
            adSkipPercentage = defaults.adskip_percentage;
        }
    });

    // 添加storage变化监听器
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
            // 检查广告跳过百分比是否变化
            if (changes.adskip_percentage) {
                const newPercentage = changes.adskip_percentage.newValue;
                // 只有当值真正变化时才执行操作
                if (adSkipPercentage !== newPercentage) {
                    adSkipPercentage = newPercentage;
                    logDebug(`检测到广告跳过百分比设置变化: ${adSkipPercentage}%`);

                    // 更新界面上的值（如果面板打开的话）
                    const percentageSlider = document.getElementById('adskip-percentage-slider');
                    const percentageValue = document.getElementById('adskip-percentage-value');
                    if (percentageSlider && percentageValue) {
                        // 防止触发change事件
                        if (parseInt(percentageSlider.value) !== adSkipPercentage) {
                            percentageSlider.value = adSkipPercentage;
                        }
                        if (percentageValue.textContent != adSkipPercentage) {
                            percentageValue.textContent = adSkipPercentage;
                        }
                    }

                    // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                    chrome.storage.local.get('adskip_enabled', function(result) {
                        const isEnabled = result.adskip_enabled !== false;
                        if (isEnabled && currentAdTimestamps.length > 0) {
                            setupAdSkipMonitor(currentAdTimestamps);
                        }
                    });
                }
            }

            // 检查功能开关状态是否变化
            if (changes.adskip_enabled) {
                const isEnabled = changes.adskip_enabled.newValue;
                logDebug(`检测到功能开关状态变化: ${isEnabled ? '已启用' : '已禁用'}`);

                // 更新界面上的开关状态（如果面板打开的话）
                const toggleSwitch = document.getElementById('adskip-toggle');
                if (toggleSwitch && toggleSwitch.checked !== isEnabled) {
                    toggleSwitch.checked = isEnabled;
                }

                // 如果功能被禁用，清除当前的监控
                if (!isEnabled && window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                    logDebug('已禁用广告跳过功能，清除监控');
                } else if (isEnabled && currentAdTimestamps.length > 0) {
                    // 如果功能被启用且有广告时间段，则重新应用设置
                    setupAdSkipMonitor(currentAdTimestamps);
                }
            }
        }
    });

    // 检查管理员状态
    checkAdminStatus();

    // 获取当前视频ID
    currentVideoId = getCurrentVideoId();
    logDebug(`初始化 - 当前视频ID: ${currentVideoId}`);

    // 解析URL中的广告跳过参数
    urlAdTimestamps = parseAdSkipParam();

    // 尝试从本地存储加载
    const savedTimestamps = await loadAdTimestampsForVideo(currentVideoId);

    // 如果有广告参数，设置监控 (URL参数优先)
    if (urlAdTimestamps.length > 0) {
        setupAdSkipMonitor(urlAdTimestamps);
        currentAdTimestamps = [...urlAdTimestamps];
        logDebug('使用URL中的广告时间段初始化');
    } else if (savedTimestamps.length > 0) {
        setupAdSkipMonitor(savedTimestamps);
        currentAdTimestamps = [...savedTimestamps];
        logDebug('使用保存的广告时间段初始化');
    } else {
        logDebug('没有找到广告时间段');
    }

    // 创建UI界面
    createLinkGenerator();

    // 设置URL变化监控
    setupUrlChangeMonitor();

    logDebug('初始化完成');
}

// 在页面加载后初始化
window.addEventListener('load', init);