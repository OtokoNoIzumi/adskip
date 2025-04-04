/**
 * adminPanel.js - 管理员面板模块
 * 处理管理员面板相关的功能
 */

'use strict';

/**
 * 安全地处理JSON对象，避免循环引用和过大的对象
 * @param {Object} obj 需要序列化的对象
 * @param {number} maxDepth 最大递归深度
 * @returns {string} 处理后的JSON字符串
 */
function safeStringify(obj, maxDepth = 10) {
    // 处理循环引用
    const seen = new WeakSet();

    const replacer = (key, value) => {
        // 处理特殊类型
        if (value instanceof Error) {
            return {
                errorType: value.constructor.name,
                message: value.message,
                stack: value.stack
            };
        }

        // 处理函数
        if (typeof value === 'function') {
            return '[Function]';
        }

        // 处理DOM节点
        if (value instanceof Node) {
            return `[${value.nodeName}]`;
        }

        // 处理循环引用
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
        }

        return value;
    };

    try {
        return JSON.stringify(obj, replacer, 2);
    } catch (err) {
        return JSON.stringify({
            error: "无法序列化此对象",
            reason: err.message
        });
    }
}

/**
 * 格式化重要参数用于显示，对字幕内容进行截取
 * @param {Object} params 重要参数对象
 * @returns {string} 格式化后的JSON字符串
 */
function formatKeyParamsForDisplay(params) {
    // 深拷贝对象，避免修改原对象
    const displayParams = JSON.parse(JSON.stringify(params));

    // 如果有字幕内容，只显示前10条
    if (displayParams.subtitle_contents &&
        Array.isArray(displayParams.subtitle_contents) &&
        displayParams.subtitle_contents[0].length > 10) {

        // 保存完整长度
        const totalLength = displayParams.subtitle_contents[0].length;

        // 添加提示信息
        displayParams.subtitle_content_note = `显示前10条，共${totalLength}条字幕`;
        // 截取前10条
        displayParams.subtitle_contents[0] = displayParams.subtitle_contents[0].slice(0, 10);
    }

    // 为预览优化显示格式
    if (displayParams.pubdate && typeof displayParams.pubdate === 'number') {
        displayParams.pubdate = new Date(displayParams.pubdate * 1000).toLocaleString();
    }

    if (displayParams.dimension && typeof displayParams.dimension === 'object') {
        displayParams.dimension = `${displayParams.dimension.width}x${displayParams.dimension.height}`;
    }

    return safeStringify(displayParams, 2);
}

/**
 * 显示管理员面板
 */
function showAdminPanel() {
    const existingPanel = document.getElementById('adskip-admin-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    // 确保白名单数据格式正确
    chrome.storage.local.get('adskip_uploader_whitelist', function(whitelistResult) {
        if (whitelistResult.adskip_uploader_whitelist) {
            try {
                // 尝试解析白名单数据
                JSON.parse(whitelistResult.adskip_uploader_whitelist);
            } catch (e) {
                // 错误处理：如果解析失败，记录错误并重置为空数组
                adskipUtils.logDebug('数据格式错误: adskip_uploader_whitelist，已重置为空数组', e);
                chrome.storage.local.set({ 'adskip_uploader_whitelist': JSON.stringify([]) });
            }
        } else {
            // 如果白名单数据不存在，初始化为空数组并保存
            adskipUtils.logDebug('未找到白名单数据，初始化为空数组');
            chrome.storage.local.set({ 'adskip_uploader_whitelist': JSON.stringify([]) });
        }
    });

    // 创建复制按钮的样式
    const copyBtnStyle = document.createElement('style');
    copyBtnStyle.textContent = `
        .with-copy-btn {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-right: 5px;
        }
        .copy-data-btn {
            background-color: #23ade5;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 10px;
            transition: background-color 0.2s;
        }
        .copy-data-btn:hover {
            background-color: #1a9cd7;
        }
        .copy-data-btn.copied {
            background-color: #4caf50;
        }
    `;
    document.head.appendChild(copyBtnStyle);

    // 创建管理面板基本结构
    const adminPanel = document.createElement('div');
    adminPanel.id = 'adskip-admin-panel';
    adminPanel.className = 'adskip-admin-panel';

    // 设置基本HTML结构
    adminPanel.innerHTML = `
        <div class="adskip-admin-header">
            <h3>广告跳过 - 管理员设置</h3>
            <button id="adskip-admin-close" class="adskip-close-btn">✖</button>
        </div>

        <div class="adskip-tabs-container">
            <div class="adskip-tabs">
                <button class="adskip-tab active" data-tab="general">常规</button>
                <button class="adskip-tab" data-tab="video-data">视频数据</button>
                <button class="adskip-tab" data-tab="video-whitelist">无广告视频</button>
                <button class="adskip-tab" data-tab="api-info">API信息</button>
            </div>

            <div class="adskip-tab-content active" id="general-tab">
                <div class="adskip-debug-toggle">
                    <input type="checkbox" id="adskip-debug-mode" ${window.adskipStorage.getDebugMode() ? 'checked' : ''}>
                    <label for="adskip-debug-mode">启用调试模式 (在控制台输出详细日志)</label>
                </div>

                <div class="adskip-status-section">
                    <h4>当前视频状态</h4>
                    <div class="adskip-status-info">
                        <div>当前视频ID: <span id="current-video-id">${currentVideoId || '未识别'}</span></div>
                        <div>上一个视频ID: <span id="last-video-id">${lastVideoId || '无'}</span></div>
                        <div>URL广告段数: <span id="url-ad-count">${urlAdTimestamps.length}</span></div>
                        <div>当前广告段数: <span id="current-ad-count">${currentAdTimestamps.length}</span></div>
                    </div>
                </div>

                <div id="admin-status" class="adskip-status"></div>
            </div>

            <div class="adskip-tab-content" id="video-data-tab">
                <div class="adskip-video-list-section">
                    <h4>已保存的视频广告数据 <span id="video-data-count">(加载中...)</span></h4>
                    <div id="adskip-video-list" class="scrollable">
                        <div class="adskip-loading">加载中...</div>
                    </div>
                </div>
            </div>

            <div class="adskip-tab-content" id="video-whitelist-tab">
                <div class="adskip-video-whitelist-section">
                    <h4>无广告视频白名单 <span id="video-whitelist-count">(加载中...)</span></h4>
                    <div class="adskip-whitelist-actions">
                        <button id="refresh-video-whitelist" class="adskip-info-btn">刷新列表</button>
                        <button id="add-current-to-whitelist" class="adskip-success-btn">添加当前视频</button>
                    </div>
                    <div id="adskip-video-whitelist" class="scrollable">
                        <div class="adskip-loading">加载中...</div>
                    </div>
                </div>
            </div>

            <div class="adskip-tab-content" id="api-info-tab">
                <div class="adskip-api-section">
                    <h4>B站用户凭证</h4>
                    <div id="credential-info" class="adskip-api-info-container">
                        <div class="adskip-loading">加载中...</div>
                    </div>
                </div>

                <div class="adskip-api-section">
                    <h4>当前视频信息</h4>
                    <div id="subtitle-info" class="adskip-api-info-container">
                        <div class="adskip-loading">加载中...</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="adskip-admin-footer">
            <button id="adskip-clear-data" class="adskip-danger-btn">清除所有数据</button>
            <button id="adskip-export" class="adskip-info-btn">导出数据</button>
            <button id="adskip-logout" class="adskip-warn-btn">退出登录</button>
        </div>
    `;

    document.body.appendChild(adminPanel);

    // 添加标签切换功能
    const tabButtons = adminPanel.querySelectorAll('.adskip-tab');
    const tabContents = adminPanel.querySelectorAll('.adskip-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有tab的active类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 给点击的tab添加active类
            button.classList.add('active');
            const tabId = `${button.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');

            // 加载相应标签的数据
            if (button.dataset.tab === 'video-data' && document.querySelector('#adskip-video-list .adskip-loading')) {
                loadVideoData();
            } else if (button.dataset.tab === 'api-info') {
                if (document.querySelector('#credential-info .adskip-loading')) {
                    loadCredentialInfo();
                }
                if (document.querySelector('#subtitle-info .adskip-loading')) {
                    loadSubtitleInfo();
                }
            }
        });
    });

    // 关闭按钮事件
    document.getElementById('adskip-admin-close').addEventListener('click', function() {
        adminPanel.remove();
    });

    // 调试模式切换事件
    document.getElementById('adskip-debug-mode').addEventListener('change', function() {
        const newDebugMode = this.checked;

        chrome.storage.local.get('adskip_debug_mode', function(result) {
            const currentDebugMode = result.adskip_debug_mode || false;

            if (currentDebugMode !== newDebugMode) {
                chrome.storage.local.set({'adskip_debug_mode': newDebugMode}, function() {
                    window.adskipStorage.setDebugMode(newDebugMode);
                    adskipUtils.logDebug(`调试模式已${newDebugMode ? '启用' : '禁用'}`);
                    adskipStorage.updateDebugModeToggle();
                });
            }
        });
    });

    // 退出登录按钮事件
    document.getElementById('adskip-logout').addEventListener('click', function() {
        if (confirm('确定要退出管理员登录吗？')) {
            // 使用adskipStorage接口
            adskipStorage.removeKeys([adskipStorage.KEYS.ADMIN_AUTH]).then(() => {
                adskipUtils.logDebug('已退出管理员登录');

                // 关闭管理面板
                document.getElementById('adskip-admin-panel').remove();

                // 重置UI状态
                document.getElementById('adskip-admin').remove();

                // 重新创建登录按钮并添加事件监听器
                const loginButton = document.createElement('button');
                loginButton.id = 'adskip-login';
                loginButton.classList.add('adskip-admin-btn');
                loginButton.textContent = '🔑 管理员登录';

                // 为新创建的按钮添加事件监听器
                loginButton.addEventListener('click', function() {
                    const apiKey = prompt('请输入管理员API密钥:');
                    if (!apiKey) return;

                    if (adskipStorage.verifyAdminAccess(apiKey)) {
                        adskipUI.updateStatusDisplay('验证成功，已获得管理员权限', 'success');
                        // 重新加载面板以显示管理员选项
                        document.getElementById('adskip-panel').remove();
                        adskipUI.createLinkGenerator();
                        document.getElementById('adskip-button').click();
                    } else {
                        adskipUI.updateStatusDisplay('API密钥无效', 'error');
                    }
                });

                document.querySelector('.adskip-admin-container').appendChild(loginButton);
            });
        }
    });

    // 清空数据按钮事件（保留管理员状态）
    document.getElementById('adskip-clear-data').addEventListener('click', function() {
        if (!confirm('⚠️ 即将清除所有扩展数据（保留管理员状态）\n\n此操作不可撤销！确定继续吗？')) {
            return;
        }

        // 获取所有键并筛选，保留管理员状态
        adskipStorage.getAdminResetKeys().then(keysToRemove => {

            if (keysToRemove.length) {
                adskipStorage.removeKeys(keysToRemove).then(() => {
                    // 重置必要默认值 - 使用Promise链处理一系列设置操作
                    Promise.all([
                        adskipStorage.setEnabled(true),
                        adskipStorage.saveAdSkipPercentage(5),
                        adskipStorage.setDebugMode(false),
                        adskipStorage.saveUploaderWhitelist([])
                    ]).then(() => {
                        // 更新调试模式开关UI
                        adskipStorage.updateDebugModeToggle();

                        // 显示状态信息
                        if (typeof adskipUI !== 'undefined' && adskipUI.updateStatusDisplay) {
                            adskipUI.updateStatusDisplay('所有数据已重置完成！', 'success');
                        } else {
                            alert('所有数据已重置完成！');
                        }

                        // 重新加载面板以应用更改
                        adminPanel.remove();
                        showAdminPanel();
                    });
                });
            }
        });
    });

    // 导出数据按钮事件
    document.getElementById('adskip-export').addEventListener('click', function() {
        // 使用adskipStorage接口
        adskipStorage.getVideoDataKeys().then(adskipKeys => {
            // 获取所有项目数据
            chrome.storage.local.get(adskipKeys, function(items) {
                const exportData = {};
                for (const key of adskipKeys) {
                    exportData[key] = items[key];
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
        });
    });

    // 如果当前激活的是视频数据标签，立即加载视频数据
    if (document.querySelector('.adskip-tab.active').dataset.tab === 'video-data') {
        loadVideoData();
    }

    // 设置视频白名单选项卡
    setupVideoWhitelistTab();
}

/**
 * 加载视频数据列表
 */
function loadVideoData() {
    const videoListContainer = document.getElementById('adskip-video-list');

    // 使用adskipStorage接口
    adskipStorage.getVideoDataKeys().then(adskipKeys => {
        // 获取所有视频数据
        chrome.storage.local.get(adskipKeys, function(items) {
            const videoData = [];

            for (const key of adskipKeys) {
                try {
                    const videoId = key.replace(adskipStorage.KEYS.PREFIX, '');
                    const data = items[key];
                    const parsedData = JSON.parse(data);

                    const timestamps = parsedData.timestamps || [];
                    const savedAt = parsedData.savedAt || Date.now();

                    if (Array.isArray(timestamps) && timestamps.length > 0) {
                        let videoTitle = '未知视频';
                        let uploader = '未知UP主';

                        if (parsedData.videoInfo) {
                            videoTitle = parsedData.videoInfo.title || '未知视频';
                            uploader = parsedData.videoInfo.uploader || '未知UP主';
                        }

                        videoData.push({
                            videoId,
                            timestamps,
                            timeString: adskipUtils.timestampsToString(timestamps),
                            displayTime: adskipUtils.formatTimestampsForDisplay(timestamps),
                            videoTitle,
                            uploader,
                            savedAt
                        });
                    } else {
                        adskipUtils.logDebug(`数据格式错误或空数据: ${key}`, { throttle: 5000 });
                    }
                } catch (e) {
                    adskipUtils.logDebug(`解析存储数据失败: ${key}`, e);
                }
            }

            // 按保存时间排序，最新的在前面
            videoData.sort((a, b) => b.savedAt - a.savedAt);

            // 更新视频数量统计
            document.getElementById('video-data-count').textContent = `(${videoData.length})`;

            // 生成视频列表HTML
            let videoListHTML = '';
            if (videoData.length > 0) {
                videoData.forEach((item, index) => {
                    let videoLink;
                    if (item.videoId.startsWith('ep')) {
                        videoLink = `https://www.bilibili.com/bangumi/play/${item.videoId}?adskip=${item.timeString}`;
                    } else {
                        videoLink = `https://www.bilibili.com/video/${item.videoId}/?adskip=${item.timeString}`;
                    }

                    const savedDate = new Date(item.savedAt);
                    const formattedDate = `${savedDate.getFullYear()}-${(savedDate.getMonth()+1).toString().padStart(2, '0')}-${savedDate.getDate().toString().padStart(2, '0')} ${savedDate.getHours().toString().padStart(2, '0')}:${savedDate.getMinutes().toString().padStart(2, '0')}`;

                    videoListHTML += `
                        <div class="adskip-video-item">
                            <div class="adskip-video-title" title="${item.videoTitle}">
                                ${item.videoTitle}
                            </div>
                            <div class="adskip-video-info">
                                <span>UP主: ${item.uploader}</span>
                                <span>ID: ${item.videoId}</span>
                                <span>保存: ${formattedDate}</span>
                            </div>
                            <div class="adskip-video-footer">
                                <span class="adskip-video-time">广告时间: ${item.displayTime}</span>
                                <div class="adskip-action-buttons">
                                    <button class="adskip-goto-btn" data-url="${videoLink}" title="跳转到视频">🔗 跳转</button>
                                    <button class="adskip-delete-btn" data-video-id="${item.videoId}" title="删除这条广告跳过设置记录">🗑️ 删除</button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                videoListHTML = '<div class="adskip-no-data">没有保存的广告跳过数据</div>';
            }

            videoListContainer.innerHTML = videoListHTML;

            // 绑定跳转按钮事件
            const gotoButtons = document.querySelectorAll('.adskip-goto-btn');
            gotoButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    if (url) {
                        window.open(url, '_blank');
                        document.getElementById('adskip-admin-panel').remove();
                    }
                });
            });

            // 绑定删除按钮事件
            const deleteButtons = document.querySelectorAll('.adskip-delete-btn');
            deleteButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const videoId = this.getAttribute('data-video-id');

                    if (confirm(`确定要删除 ${videoId} 的广告跳过设置吗？`)) {
                        // 使用adskipStorage接口
                        adskipStorage.removeKeys([`${adskipStorage.KEYS.PREFIX}${videoId}`]).then(() => {
                            adskipUtils.logDebug(`已删除视频 ${videoId} 的广告跳过设置`);

                            if (videoId === currentVideoId) {
                                currentAdTimestamps = [];
                                const inputElement = document.getElementById('adskip-input');
                                if (inputElement) {
                                    inputElement.value = '';
                                }
                            }

                            // 重新加载视频数据
                            loadVideoData();
                        });
                    }
                });
            });
        });
    });
}

/**
 * 加载用户凭证信息
 */
async function loadCredentialInfo() {
    const credentialSection = document.getElementById('credential-info');
    if (!credentialSection) return;

    try {
        credentialSection.innerHTML = '<div class="loading-spinner"></div>';

        // 检查服务模块是否存在
        if (typeof adskipCredentialService === 'undefined') {
            credentialSection.innerHTML = `
                <div class="error-message">
                    服务模块未加载，请刷新页面后重试。
                    <button class="retry-button" onclick="location.reload()">刷新页面</button>
                </div>`;
            return;
        }

        // 使用服务API获取登录状态
        const userInfo = await adskipCredentialService.getBilibiliLoginStatus();
        adskipUtils.logDebug("完整用户信息:", userInfo);

        let infoHTML = '<div class="credential-data">';

        if (userInfo.isLoggedIn) {
            // 用户已登录，显示简化信息
            infoHTML += `
                <div class="credential-row">
                    <span class="credential-label">状态:</span>
                    <span class="credential-value success">已登录</span>
                </div>`;

            if (userInfo.username) {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">用户名:</span>
                        <span class="credential-value">${userInfo.username}</span>
                    </div>`;
            }

            if (userInfo.uid) {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">UID:</span>
                        <span class="credential-value">${userInfo.uid}</span>
                    </div>`;
            }

            // 展示会员等级
            if (userInfo.vipType !== undefined) {
                const vipLabel = userInfo.vipType === 0 ? '普通用户' :
                                 userInfo.vipType === 1 ? '大会员' : '年度大会员';
                const vipClass = userInfo.vipType > 0 ? `vip-${userInfo.vipType}` : '';

                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">会员等级:</span>
                        <span class="credential-value ${vipClass}">${vipLabel}</span>
                    </div>`;
            }

            // 如果有头像，显示头像
            if (userInfo.avatar) {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">头像:</span>
                        <span class="credential-value">
                            <img src="${userInfo.avatar}" alt="用户头像" style="width: 40px; height: 40px; border-radius: 50%;">
                        </span>
                    </div>`;
            }

            // 如果有等级信息，显示等级
            if (userInfo.level !== undefined) {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">等级:</span>
                        <span class="credential-value">Lv.${userInfo.level}</span>
                    </div>`;
            }

            // 显示原始API数据折叠区域
            infoHTML += `
                <div class="credential-api-data-container">
                    <details>
                        <summary class="with-copy-btn">
                            查看完整API数据
                            <button class="copy-data-btn" data-content='${safeStringify(userInfo)}'>复制</button>
                        </summary>
                        <div class="credential-api-data">
                            <pre>${safeStringify(userInfo, 2)}</pre>
                        </div>
                    </details>
                </div>`;

        } else {
            // 用户未登录
            infoHTML += `
                <div class="credential-row">
                    <span class="credential-label">状态:</span>
                    <span class="credential-value error">未登录</span>
                </div>
                <div class="credential-note">
                    请先在Bilibili网站登录，然后刷新页面。<br>
                    <small>注: 由于浏览器安全限制，插件可能无法直接访问所有cookie信息。</small>
                </div>`;

            // 显示请求失败原因
            if (userInfo.message) {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">失败原因:</span>
                        <span class="credential-value error">${userInfo.message}</span>
                    </div>`;
            }
        }

        infoHTML += '</div>';
        credentialSection.innerHTML = infoHTML;

        // 添加复制按钮事件监听
        const copyButtons = credentialSection.querySelectorAll('.copy-data-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // 防止触发details的展开/收起

                const content = this.getAttribute('data-content');
                if (content) {
                    navigator.clipboard.writeText(content)
                        .then(() => {
                            // 临时显示复制成功
                            const originalText = this.textContent;
                            this.textContent = '已复制!';
                            this.classList.add('copied');

                            setTimeout(() => {
                                this.textContent = originalText;
                                this.classList.remove('copied');
                            }, 1500);
                        })
                        .catch(err => {
                            console.error('复制失败:', err);
                            alert('复制失败，请手动复制');
                        });
                }
            });
        });
    } catch (error) {
        credentialSection.innerHTML = `
            <div class="error-message">
                获取用户信息失败: ${error.message}
                <button class="retry-button" onclick="adskipAdmin.loadCredentialInfo()">重试</button>
            </div>`;
    }
}

/**
 * 加载视频和字幕信息
 */
async function loadSubtitleInfo() {
    const subtitleSection = document.getElementById('subtitle-info');
    if (!subtitleSection) return;

    try {
        subtitleSection.innerHTML = '<div class="loading-spinner"></div>';

        // 检查广告检测模块是否存在
        if (typeof adskipAdDetection === 'undefined' || typeof adskipAdDetection.getVideoSubtitleData !== 'function') {
            subtitleSection.innerHTML = `
                <div class="error-message">
                    广告检测模块未加载，请刷新页面后重试。
                    <button class="retry-button" onclick="location.reload()">刷新页面</button>
                </div>`;
            return;
        }

        // 使用广告检测模块获取数据 - 直接使用其返回格式，不再转换
        adskipUtils.logDebug('[AdSkip管理面板] 使用广告检测模块获取字幕数据');
        const keyParams = await adskipAdDetection.getVideoSubtitleData();

        // 获取原始数据以便UI显示
        const videoData = await adskipSubtitleService.getVideoData();
        const subtitleInfo = await adskipSubtitleService.getVideoSubtitles();
        const subtitlePreview = await adskipSubtitleService.getSubtitlePreview();

        let infoHTML = `
            <div class="credential-data">
                <div class="credential-row">
                    <span class="credential-label">视频ID:</span>
                    <span class="credential-value">${videoData.bvid || '未知'}</span>
                </div>
                <div class="credential-row">
                    <span class="credential-label">字幕功能:</span>
                    <span class="credential-value ${subtitleInfo.hasSubtitleFeature ? 'success' : 'error'}">
                        ${subtitleInfo.hasSubtitleFeature ? '支持' : '不支持'}
                    </span>
                </div>`;

        if (subtitleInfo.hasSubtitleFeature && subtitleInfo.subtitles.length > 0) {
            infoHTML += `
                <div class="credential-row">
                    <span class="credential-label">可用字幕:</span>
                    <span class="credential-value">${subtitleInfo.subtitles.map(s => s.languageName).join(', ')}</span>
                </div>`;

            // 如果有字幕内容，显示预览
            if (subtitlePreview.subtitleContent && subtitlePreview.subtitleContent.length > 0) {
                infoHTML += `
                    <div class="subtitle-preview-header">字幕预览 (${subtitlePreview.availableLanguages[0] || ''})</div>
                    <div class="subtitle-preview-list">`;

                subtitlePreview.subtitleContent.forEach(item => {
                    infoHTML += `
                        <div class="subtitle-preview-item">
                            <div class="subtitle-time">${item.time}</div>
                            <div class="subtitle-content">${item.text}</div>
                        </div>`;
                });

                infoHTML += `</div>`;
            } else {
                infoHTML += `
                    <div class="credential-row">
                        <span class="credential-label">字幕内容:</span>
                        <span class="credential-value">无法加载字幕内容预览</span>
                    </div>`;
            }
        } else if (subtitleInfo.hasSubtitleFeature) {
            infoHTML += `
                <div class="credential-row">
                    <span class="credential-label">字幕状态:</span>
                    <span class="credential-value warning">找不到字幕</span>
                </div>`;
        }

        infoHTML += `
            <div class="credential-note">
                ${subtitlePreview.message || subtitleInfo.message || ''}
            </div>`;

        // 添加重要参数信息折叠区
        infoHTML += `
            <div class="credential-api-data-container">
                <details>
                    <summary class="with-copy-btn">
                        查看重要参数信息
                        <button class="copy-data-btn" data-content='${safeStringify(keyParams)}'>复制</button>
                    </summary>
                    <div class="credential-api-data">
                        <pre>${formatKeyParamsForDisplay(keyParams)}</pre>
                    </div>
                </details>
            </div>`;

        // 显示视频完整数据
        infoHTML += `
            <div class="credential-api-data-container">
                <details>
                    <summary class="with-copy-btn">
                        查看完整视频信息
                        <button class="copy-data-btn" data-content='${safeStringify(videoData)}'>复制</button>
                    </summary>
                    <div class="credential-api-data">
                        <pre>${safeStringify(videoData, 2)}</pre>
                    </div>
                </details>
            </div>`;

        // 显示完整的字幕API响应数据
        if (subtitleInfo.rawData) {
            infoHTML += `
                <div class="credential-api-data-container">
                    <details>
                        <summary class="with-copy-btn">
                            查看完整字幕API响应
                            <button class="copy-data-btn" data-content='${safeStringify(subtitleInfo.rawData)}'>复制</button>
                        </summary>
                        <div class="credential-api-data">
                            <pre>${safeStringify(subtitleInfo.rawData, 2)}</pre>
                        </div>
                    </details>
                </div>`;
        }

        // 显示字幕URL和完整字幕数据
        if (subtitleInfo.subtitles.length > 0) {
            const firstSubtitle = subtitleInfo.subtitles[0];
            if (firstSubtitle && firstSubtitle.url) {
                infoHTML += `
                    <div class="credential-api-data-container">
                        <details>
                            <summary class="with-copy-btn">
                                查看字幕URL和数据
                                <button class="copy-data-btn" data-content='${safeStringify({
                                    url: firstSubtitle.url,
                                    subtitles: subtitleInfo.subtitles
                                })}'>复制</button>
                            </summary>
                            <div class="credential-api-data">
                                <h4>字幕URL:</h4>
                                <pre>${firstSubtitle.url}</pre>
                                <h4>完整字幕数据:</h4>
                                <pre>${safeStringify(subtitleInfo.subtitles, 2)}</pre>
                            </div>
                        </details>
                    </div>`;
            }
        }

        infoHTML += '</div>';
        subtitleSection.innerHTML = infoHTML;

        // 添加复制按钮事件监听
        const copyButtons = subtitleSection.querySelectorAll('.copy-data-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // 防止触发details的展开/收起

                const content = this.getAttribute('data-content');
                if (content) {
                    navigator.clipboard.writeText(content)
                        .then(() => {
                            // 临时显示复制成功
                            const originalText = this.textContent;
                            this.textContent = '已复制!';
                            this.classList.add('copied');

                            setTimeout(() => {
                                this.textContent = originalText;
                                this.classList.remove('copied');
                            }, 1500);
                        })
                        .catch(err => {
                            console.error('复制失败:', err);
                            alert('复制失败，请手动复制');
                        });
                }
            });
        });
    } catch (error) {
        subtitleSection.innerHTML = `
            <div class="error-message">
                加载视频信息失败: ${error.message}
                <button class="retry-button" onclick="adskipAdmin.loadSubtitleInfo()">重试</button>
            </div>`;
    }
}

/**
 * 设置白名单管理功能
 */
function setupVideoWhitelistTab() {
    const videoWhitelistContainer = document.getElementById('adskip-video-whitelist');
    const countDisplay = document.getElementById('video-whitelist-count');

    if (!videoWhitelistContainer) {
        adskipUtils.logDebug('无法找到视频白名单容器');
        return;
    }

    // 刷新白名单列表按钮
    const refreshButton = document.getElementById('refresh-video-whitelist');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            loadVideoWhitelistToUI(videoWhitelistContainer, countDisplay);
        });
    }

    // 添加当前视频到白名单按钮
    const addCurrentButton = document.getElementById('add-current-to-whitelist');
    if (addCurrentButton) {
        addCurrentButton.addEventListener('click', async () => {
            const videoId = adskipUtils.getCurrentVideoId().id;
            if (!videoId) {
                adskipUtils.logDebug('[AdSkip管理面板] 未找到当前视频ID，无法添加到白名单');
                return;
            }

            const isAlreadyInWhitelist = await adskipStorage.checkVideoInNoAdsWhitelist(videoId);
            if (isAlreadyInWhitelist) {
                adskipUtils.logDebug(`[AdSkip管理面板] 视频 ${videoId} 已经在白名单中`);
                return;
            }

            // 添加到白名单 - 这是与外部存储API的交互，可能失败
            await adskipStorage.addVideoToNoAdsWhitelist(videoId)
                .catch(error => {
                    adskipUtils.logDebug(`[AdSkip管理面板] 添加视频到白名单失败: ${error.message}`);
                    return;
                });

            adskipUtils.logDebug(`[AdSkip管理面板] 视频 ${videoId} 已添加到无广告白名单`);

            // 刷新列表
            loadVideoWhitelistToUI(videoWhitelistContainer, countDisplay);

            // 更新按钮状态为NO_ADS
            if (typeof adskipAdDetection !== 'undefined') {
                adskipAdDetection.updateVideoStatus(adskipAdDetection.VIDEO_STATUS.NO_ADS);
            }
        });
    }

    // 初始加载白名单
    loadVideoWhitelistToUI(videoWhitelistContainer, countDisplay);
}

/**
 * 加载视频白名单数据到UI
 * @param {HTMLElement} container 白名单容器
 * @param {HTMLElement} countDisplay 计数显示元素
 */
async function loadVideoWhitelistToUI(container, countDisplay) {
    // 显示加载中
    container.innerHTML = '<div class="adskip-loading">加载中...</div>';

    // 加载白名单数据 - 存储操作可能失败
    const whitelist = await adskipStorage.loadVideoWhitelist()
        .catch(error => {
            adskipUtils.logDebug(`加载视频白名单失败: ${error.message}`);
            container.innerHTML = '<div class="adskip-error">加载白名单失败</div>';
            if (countDisplay) {
                countDisplay.textContent = '(加载失败)';
            }
            return [];
        });

    const noAdsVideos = whitelist.filter(item =>
        (typeof item === 'object' && item.noAds === true)
    );

    adskipUtils.logDebug(`已加载${noAdsVideos.length}个无广告视频白名单项`);

    // 更新计数
    if (countDisplay) {
        countDisplay.textContent = `(${noAdsVideos.length}个视频)`;
    }

    // 清空容器
    container.innerHTML = '';

    // 如果白名单为空，显示提示
    if (noAdsVideos.length === 0) {
        container.innerHTML = '<div class="adskip-empty-list">白名单为空</div>';
        return;
    }

    // 创建白名单项列表
    const whitelistList = document.createElement('ul');
    whitelistList.className = 'adskip-video-whitelist-list';

    // 添加每个无广告视频到列表
    noAdsVideos.forEach(item => {
        const videoId = typeof item === 'string' ? item : item.bvid;
        const addedAt = item.addedAt ? new Date(item.addedAt).toLocaleString() : '未知时间';

        const listItem = document.createElement('li');
        listItem.className = 'adskip-video-whitelist-item';

        listItem.innerHTML = `
            <div class="adskip-video-whitelist-info">
                <a href="https://www.bilibili.com/video/${videoId}" target="_blank" class="adskip-video-id">${videoId}</a>
                <span class="adskip-video-added-time">添加时间: ${addedAt}</span>
            </div>
            <button class="adskip-remove-video-btn" data-video-id="${videoId}">移除</button>
        `;

        // 添加移除按钮事件
        const removeButton = listItem.querySelector('.adskip-remove-video-btn');
        if (removeButton) {
            removeButton.addEventListener('click', async () => {
                // 外部存储API调用可能失败
                await adskipStorage.removeVideoFromWhitelist(videoId)
                    .catch(error => {
                        adskipUtils.logDebug(`[AdSkip管理面板] 移除视频 ${videoId} 从白名单失败: ${error.message}`);
                        return;
                    });

                listItem.remove();

                // 更新计数
                const newCount = document.querySelectorAll('.adskip-video-whitelist-item').length;
                if (countDisplay) {
                    countDisplay.textContent = `(${newCount}个视频)`;
                }

                adskipUtils.logDebug(`[AdSkip管理面板] 视频 ${videoId} 已从白名单中移除`);
            });
        }

        whitelistList.appendChild(listItem);
    });

    container.appendChild(whitelistList);
}

// 导出模块函数
window.adskipAdmin = {
    showAdminPanel,
    loadCredentialInfo,
    loadSubtitleInfo
};
