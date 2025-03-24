/**
 * adminPanel.js - 管理员面板模块
 * 处理管理员面板相关的功能
 */

'use strict';

/**
 * 显示管理员面板
 */
function showAdminPanel() {
    const existingPanel = document.getElementById('adskip-admin-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    // 获取所有保存的数据
    chrome.storage.local.get(null, function(items) {
        const allKeys = Object.keys(items);
        // 只处理以adskip_开头且是视频ID的键，排除所有特殊配置项
        const adskipKeys = allKeys.filter(key =>
            key.startsWith('adskip_') &&
            key !== 'adskip_debug_mode' &&
            key !== 'adskip_enabled' &&
            key !== 'adskip_percentage' &&
            key !== 'adskip_admin_authorized'
        );

        const videoData = [];

        for (const key of adskipKeys) {
            try {
                const videoId = key.replace('adskip_', '');
                const data = items[key];
                const parsedData = JSON.parse(data);

                // 使用新的数据格式
                const timestamps = parsedData.timestamps || [];
                const savedAt = parsedData.savedAt || Date.now();

                // 确保timestamps是数组
                if (Array.isArray(timestamps) && timestamps.length > 0) {
                    // 直接从顶层videoInfo获取信息
                    let videoTitle = '未知视频';
                    let uploader = '未知UP主';

                    // 获取视频信息
                    if (parsedData.videoInfo) {
                        videoTitle = parsedData.videoInfo.title || '未知视频';
                        uploader = parsedData.videoInfo.uploader || '未知UP主';
                    }

                    videoData.push({
                        videoId,
                        timestamps,
                        timeString: adskipUtils.timestampsToString(timestamps), // 用于URL参数
                        displayTime: adskipUtils.formatTimestampsForDisplay(timestamps), // 用于UI显示
                        videoTitle,
                        uploader,
                        savedAt
                    });
                } else {
                    console.error(`--==--LOG: 数据格式错误或空数据: ${key}`);
                }
            } catch (e) {
                console.error(`--==--LOG: 解析存储数据失败: ${key}`, e);
            }
        }

        // 按保存时间排序，最新的在前面
        videoData.sort((a, b) => b.savedAt - a.savedAt);

        const adminPanel = document.createElement('div');
        adminPanel.id = 'adskip-admin-panel';
        adminPanel.className = 'adskip-admin-panel';

        // 视频列表HTML生成，调整显示顺序并添加跳转按钮
        let videoListHTML = '';
        if (videoData.length > 0) {
            videoData.forEach((item, index) => {
                // 构建带广告时间参数的视频链接
                let videoLink;
                if (item.videoId.startsWith('ep')) {
                    // 番剧链接格式
                    videoLink = `https://www.bilibili.com/bangumi/play/${item.videoId}?adskip=${item.timeString}`;
                } else {
                    // 普通视频链接格式
                    videoLink = `https://www.bilibili.com/video/${item.videoId}/?adskip=${item.timeString}`;
                }

                // 格式化保存时间
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
                                <button class="adskip-delete-btn" data-index="${index}" title="删除这条广告跳过设置记录">🗑️ 删除</button>
                            </div>
                        </div>
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
                <div id="adskip-video-list" class="${videoData.length > 3 ? 'scrollable' : ''}">
                    ${videoListHTML}
                </div>
            </div>

            <div class="adskip-admin-footer">
                <button id="adskip-clear-all" class="adskip-danger-btn">清除所有数据</button>
                <button id="adskip-export" class="adskip-info-btn">导出数据</button>
                <button id="adskip-logout" class="adskip-warn-btn">退出登录</button>
            </div>
        `;

        document.body.appendChild(adminPanel);

        // 绑定跳转按钮点击事件
        const gotoButtons = document.querySelectorAll('.adskip-goto-btn');
        gotoButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                if (url) {
                    // 在content script中，使用window.open而不是chrome.tabs.create
                    window.open(url, '_blank');

                    // 关闭管理员面板
                    adminPanel.remove();
                }
            });
        });

        // 事件绑定
        document.getElementById('adskip-admin-close').addEventListener('click', function() {
            adminPanel.remove();
        });

        // 管理员界面中的调试模式事件绑定
        document.getElementById('adskip-debug-mode').addEventListener('change', function() {
            const newDebugMode = this.checked;

            // 使用与options.js相同的方式处理
            chrome.storage.local.get('adskip_debug_mode', function(result) {
                const currentDebugMode = result.adskip_debug_mode || false;

                // 只有当状态确实变化时才设置
                if (currentDebugMode !== newDebugMode) {
                    chrome.storage.local.set({'adskip_debug_mode': newDebugMode}, function() {
                        debugMode = newDebugMode; // 更新全局变量
                        adskipUtils.logDebug(`调试模式已${newDebugMode ? '启用' : '禁用'}`);
                        adskipStorage.updateDebugModeToggle();
                    });
                }
            });
        });

        // 退出登录按钮点击事件
        document.getElementById('adskip-logout').addEventListener('click', function() {
            if (confirm('确定要退出管理员登录状态吗？')) {
                // 移除管理员授权状态
                chrome.storage.local.remove('adskip_admin_authorized', function() {
                    isAdminAuthorized = false;
                    adskipUtils.logDebug('已退出管理员登录状态');

                    // 关闭管理员面板
                    adminPanel.remove();

                    // 刷新主面板
                    const mainPanel = document.getElementById('adskip-panel');
                    if (mainPanel) {
                        mainPanel.remove();
                        adskipUI.createLinkGenerator();
                        document.getElementById('adskip-button').click();
                    }
                });
            }
        });

        // 修改清除所有数据按钮的功能
        document.getElementById('adskip-clear-all').addEventListener('click', function() {
            // 使用更详细的对话框让用户选择要清除的内容
            const clearOptions = confirm(
                '请选择清除内容的范围：\n\n' +
                '【确定】清除所有数据（包括视频数据、功能设置、调试模式设置）\n' +
                '【取消】仅清除视频数据和基本设置（保留调试模式和管理员状态）'
            );

            if (clearOptions) {
                // 全面清除：保留管理员状态，但清除包括调试模式在内的所有设置
                chrome.storage.local.get(null, function(items) {
                    const allKeys = Object.keys(items);
                    // 只保留管理员登录状态
                    const keysToRemove = allKeys.filter(key =>
                        key !== 'adskip_admin_authorized'
                    );

                    if (keysToRemove.length > 0) {
                        chrome.storage.local.remove(keysToRemove, function() {
                            // 设置默认值
                            chrome.storage.local.set({
                                'adskip_enabled': true,
                                'adskip_percentage': 5,
                                'adskip_debug_mode': false  // 重置调试模式为关闭
                            }, function() {
                                // 更新全局变量
                                debugMode = false;
                                adskipStorage.updateDebugModeToggle();

                                adminPanel.remove();
                                alert('已执行全面清除：所有数据和设置都已重置（保留管理员状态）');
                            });
                        });
                    }
                });
            } else {
                // 基本清除：保留调试模式和管理员状态
                chrome.storage.local.get(null, function(items) {
                    const allKeys = Object.keys(items);
                    // 保留调试模式和管理员状态
                    const keysToRemove = allKeys.filter(key =>
                        key !== 'adskip_debug_mode' &&
                        key !== 'adskip_admin_authorized'
                    );

                    if (keysToRemove.length > 0) {
                        chrome.storage.local.remove(keysToRemove, function() {
                            // 设置默认值，但不修改调试模式
                            chrome.storage.local.set({
                                'adskip_enabled': true,
                                'adskip_percentage': 5
                            }, function() {
                                adminPanel.remove();
                                alert('已执行基本清除：视频数据和基本设置已重置（保留调试模式和管理员状态）');
                            });
                        });
                    }
                });
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
                        adskipUtils.logDebug(`已删除视频 ${videoId} 的广告跳过设置`);

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

// 导出模块函数
window.adskipAdmin = {
    showAdminPanel
};