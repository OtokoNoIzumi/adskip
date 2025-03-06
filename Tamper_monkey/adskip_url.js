// ==UserScript==
// @name         B站智能广告跳过 - 调试增强版
// @namespace    https://github.com/OtokoNoIzumi
// @version      1.2
// @description  通过URL参数自动跳过B站视频中的广告，支持按视频ID存储和用户意图识别
// @author       Izumi屈源
// @match        *://www.bilibili.com/video/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    // 全局变量
    let currentAdTimestamps = [];     // 当前生效的广告时间段
    let urlAdTimestamps = [];         // URL解析的原始广告时间段
    let currentVideoId = '';          // 当前视频ID
    let lastVideoId = '';             // 上一个视频ID
    let debugMode = false;            // 调试模式开关
    let scriptInitiatedSeek = false;  // 标记是否是脚本引起的seeking

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
        debugMode = GM_getValue('adskip_debug_mode', false);
        if (debugMode) {
            console.log('--==--LOG: 调试模式已启用');
        }
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
        if (!videoId) {
            logDebug('视频ID为空，无法加载广告时间段');
            return [];
        }

        try {
            const savedData = GM_getValue(`adskip_${videoId}`);
            if (!savedData) {
                logDebug(`没有找到视频 ${videoId} 的保存数据`);
                return [];
            }

            const parsed = JSON.parse(savedData);
            logDebug(`成功加载视频 ${videoId} 的广告时间段:`, parsed);
            return parsed;
        } catch (e) {
            console.error(`--==--LOG: 加载视频 ${videoId} 广告数据失败:`, e);
            return [];
        }
    }

    // 保存指定视频ID的广告时间戳
    function saveAdTimestampsForVideo(videoId, timestamps) {
        if (!videoId) {
            logDebug('视频ID为空，无法保存广告时间段');
            return;
        }

        try {
            const dataString = JSON.stringify(timestamps);
            GM_setValue(`adskip_${videoId}`, dataString);
            logDebug(`成功保存视频 ${videoId} 的广告时间段:`, timestamps);
        } catch (e) {
            console.error(`--==--LOG: 保存视频 ${videoId} 广告数据失败:`, e);
        }
    }

    // 判断两个时间段是否重叠
    function isOverlapping(segment1, segment2) {
        return (segment1.start_time <= segment2.end_time && segment1.end_time >= segment2.start_time);
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

            // 简化的广告检测逻辑：只检测是否在广告开始的1秒内
            for (const ad of currentAdTimestamps) {
                // 确定广告的"开始区域"：开始时间到min(开始时间+1秒,结束时间)
                const adStartRange = Math.min(ad.start_time + 1, ad.end_time);

                // 如果在广告开始区域，直接跳到结束
                if (currentTime >= ad.start_time && currentTime < adStartRange) {
                    logDebug(`检测到在广告开始区域 [${ad.start_time}s-${adStartRange}s]，跳过至${ad.end_time}s`);

                    // 标记为脚本操作并跳转
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = ad.end_time;
                    logDebug(`已跳过广告: ${ad.start_time}s-${ad.end_time}s`);
                    break;
                }
            }
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

    // 创建链接生成器UI
    function createLinkGenerator() {
        // 创建悬浮按钮
        const button = document.createElement('div');
        button.innerHTML = '⏩ 广告跳过';
        button.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 8px 12px;
            background-color: #FB7299;
            color: white;
            border-radius: 4px;
            z-index: 10000;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

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
            panel.style.cssText = `
                position: fixed;
                top: 140px;
                right: 20px;
                width: 300px;
                padding: 15px;
                background-color: white;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                font-size: 14px;
                max-height: 80vh;
                overflow-y: auto;
            `;

            // 获取当前生效的时间段字符串
            const currentTimeString = timestampsToString(currentAdTimestamps);
            // 面板内容
            panel.innerHTML = `
                <h3 style="margin-top:0;color:#FB7299">广告跳过 - 时间设置</h3>
                <div style="margin-bottom:5px;font-size:12px;color:#666;">当前视频: ${currentVideoId || '未识别'}</div>
                <p>输入广告时间段（格式: 开始-结束,开始-结束）:</p>
                <input id="adskip-input" type="text" value="${currentTimeString}" placeholder="例如: 61-87,120-145" style="width:100%;padding:8px;box-sizing:border-box;margin-bottom:10px;border:1px solid #ddd;border-radius:4px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:15px;">
                    <button id="adskip-generate" style="background:#FB7299;color:white;border:none;padding:10px 12px;border-radius:4px;cursor:pointer;width:48%;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">🔗 生成链接</button>
                    <button id="adskip-apply" style="background:#FB7299;color:white;border:none;padding:10px 12px;border-radius:4px;cursor:pointer;width:48%;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">✅ 应用时间段</button>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:15px;">
                    <button id="adskip-restore" style="background:#FB7299;color:white;border:none;padding:10px 12px;border-radius:4px;cursor:pointer;width:48%;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">↩️ 还原时间段</button>
                    <button id="adskip-reset" style="background:#FB7299;color:white;border:none;padding:10px 12px;border-radius:4px;cursor:pointer;width:48%;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">🗑️ 重置设置</button>
                </div>
                <div id="adskip-status" style="margin-top:10px;color:#4CAF50;display:none;">设置已应用</div>
                <div id="adskip-result" style="margin-top:10px;word-break:break-all;"></div>
                <div style="margin-top:15px;padding-top:10px;border-top:1px solid #eee;display:none;">
                    <button id="adskip-admin" style="background:#333;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;width:100%;">🔧 管理员设置</button>
                </div>
            `;

            document.body.appendChild(panel);

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
                    <a href="${currentUrl.toString()}" style="color:#FB7299;word-break:break-all;">${currentUrl.toString()}</a>
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
            document.getElementById('adskip-admin').addEventListener('click', function() {
              showAdminPanel();
            });

            // 重置按钮
            document.getElementById('adskip-reset').addEventListener('click', function() {
                if (confirm('确定要重置所有设置吗？此操作将清空所有保存的广告跳过数据！')) {
                    // 获取所有保存的数据
                    const allKeys = GM_listValues();
                    const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');

                    // 删除所有保存的广告跳过数据
                    for (const key of adskipKeys) {
                        GM_deleteValue(key);
                    }

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
                }
            });
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
        const allKeys = GM_listValues();
        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_'));
        const videoData = [];

        for (const key of adskipKeys) {
            if (key === 'adskip_debug_mode') continue;

            try {
                const videoId = key.replace('adskip_', '');
                const data = GM_getValue(key);
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
        adminPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 4px 25px rgba(0,0,0,0.25);
            font-size: 14px;
            overflow-y: auto;
        `;

        // 管理员面板内容
        let videoListHTML = '';
        if (videoData.length > 0) {
            videoData.forEach((item, index) => {
                videoListHTML += `
                    <div style="padding:10px;margin-bottom:10px;border:1px solid #eee;border-radius:4px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-weight:bold;">${item.videoId}</span>
                            <button class="adskip-delete-btn" data-index="${index}" style="background:#d9534f;color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;">🗑️ 删除</button>
                        </div>
                        <div style="margin-top:5px;font-family:monospace;">${item.timeString}</div>
                    </div>
                `;
            });
        } else {
            videoListHTML = '<div style="padding:10px;color:#666;text-align:center;">没有保存的广告跳过数据</div>';
        }

        adminPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;color:#333;">广告跳过 - 管理员设置</h3>
                <button id="adskip-admin-close" style="background:none;border:none;font-size:16px;cursor:pointer;">✖</button>
            </div>

            <div style="margin-bottom:15px;display:flex;align-items:center;">
                <input type="checkbox" id="adskip-debug-mode" ${debugMode ? 'checked' : ''}>
                <label for="adskip-debug-mode" style="margin-left:5px;">启用调试模式 (在控制台输出详细日志)</label>
            </div>

            <div>
                <h4 style="margin-top:0;">当前视频状态</h4>
                <div style="font-family:monospace;margin-bottom:10px;">
                    <div>当前视频ID: ${currentVideoId || '未识别'}</div>
                    <div>上一个视频ID: ${lastVideoId || '无'}</div>
                    <div>URL广告段数: ${urlAdTimestamps.length}</div>
                    <div>当前广告段数: ${currentAdTimestamps.length}</div>
                </div>
            </div>

            <div>
                <h4 style="margin-bottom:10px;">已保存的视频广告数据 (${videoData.length})</h4>
                <div id="adskip-video-list">
                    ${videoListHTML}
                </div>
            </div>

            <div style="margin-top:15px;display:flex;justify-content:space-between;">
                <button id="adskip-clear-all" style="background:#d9534f;color:white;border:none;padding:8px 15px;border-radius:4px;cursor:pointer;">清除所有数据</button>
                <button id="adskip-export" style="background:#5bc0de;color:white;border:none;padding:8px 15px;border-radius:4px;cursor:pointer;">导出数据</button>
            </div>
        `;

        document.body.appendChild(adminPanel);

        // 事件绑定
        document.getElementById('adskip-admin-close').addEventListener('click', function() {
            adminPanel.remove();
        });

        document.getElementById('adskip-debug-mode').addEventListener('change', function() {
            debugMode = this.checked;
            GM_setValue('adskip_debug_mode', debugMode);
            logDebug(`调试模式已${debugMode ? '启用' : '禁用'}`);
        });

        document.getElementById('adskip-clear-all').addEventListener('click', function() {
            if (confirm('确定要删除所有保存的广告跳过数据吗？此操作不可撤销！')) {
                for (const key of adskipKeys) {
                    if (key !== 'adskip_debug_mode') {
                        GM_deleteValue(key);
                    }
                }
                logDebug('已清除所有保存的广告跳过数据');
                adminPanel.remove();
            }
        });

        document.getElementById('adskip-export').addEventListener('click', function() {
            const exportData = {};
            for (const key of adskipKeys) {
                if (key !== 'adskip_debug_mode') {
                    exportData[key] = GM_getValue(key);
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
                    GM_deleteValue(`adskip_${videoId}`);
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
                }
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
    function reinitialize() {
        logDebug(`重新初始化，当前视频ID: ${currentVideoId}`);

        // 重新解析URL中的广告跳过参数
        const currentUrlAdTimestamps = parseAdSkipParam();
        urlAdTimestamps = currentUrlAdTimestamps; // 更新全局变量

        // 尝试从本地存储加载
        const savedTimestamps = loadAdTimestampsForVideo(currentVideoId);

        // 获取所有保存的数据，用于比较
        const allKeys = GM_listValues();
        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');
        let matchFound = false;

        // 检查当前URL中的时间戳是否与任何已保存的时间戳匹配
        if (currentUrlAdTimestamps.length > 0) {
            const currentTimeString = timestampsToString(currentUrlAdTimestamps);

            // 遍历所有保存的视频数据，检查是否有匹配的时间戳
            for (const key of adskipKeys) {
                try {
                    const data = GM_getValue(key);
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
            const videoIdElement = document.querySelector('#adskip-panel div[style*="margin-bottom:5px"]');
            if (videoIdElement) {
                videoIdElement.textContent = `当前视频: ${currentVideoId || '未识别'}`;
            }
        }
    }

    // 主函数
    function init() {
        // 初始化调试模式
        initDebugMode();

        // 获取当前视频ID
        currentVideoId = getCurrentVideoId();
        logDebug(`初始化 - 当前视频ID: ${currentVideoId}`);

        // 解析URL中的广告跳过参数
        urlAdTimestamps = parseAdSkipParam();

        // 尝试从本地存储加载
        const savedTimestamps = loadAdTimestampsForVideo(currentVideoId);

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
  })();
