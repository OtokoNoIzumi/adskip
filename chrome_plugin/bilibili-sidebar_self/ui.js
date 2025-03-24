/**
 * ui.js - 用户界面模块
 * 处理所有UI相关的功能
 */

'use strict';

/**
 * 创建链接生成器UI
 */
function createLinkGenerator() {
    // 创建悬浮按钮
    const button = document.createElement('div');
    button.innerHTML = '⏩ 广告跳过';
    button.id = 'adskip-button';
    button.className = 'adskip-button';

    // 点击展开操作面板
    button.addEventListener('click', async function() {
        if (document.getElementById('adskip-panel')) {
            document.getElementById('adskip-panel').remove();
            return;
        }

        // 刷新当前视频ID
        currentVideoId = adskipUtils.getCurrentVideoId();

        // 获取当前视频UP主信息
        const { uploader: currentUploader, title: currentTitle } = await adskipStorage.getCurrentVideoUploader();

        // 检查UP主是否在白名单中及其状态
        const whitelistItem = await adskipStorage.loadUploaderWhitelist()
            .then(list => list.find(item =>
                (typeof item === 'string' && item === currentUploader) ||
                (typeof item === 'object' && item.name === currentUploader)
            ));

        const isInWhitelist = !!whitelistItem;
        const isWhitelistEnabled = typeof whitelistItem === 'string' ||
                         (whitelistItem && whitelistItem.enabled !== false);

        const panel = document.createElement('div');
        panel.id = 'adskip-panel';
        panel.className = 'adskip-panel';

        // 获取当前生效的时间段字符串
        const currentTimeString = adskipUtils.timestampsToString(currentAdTimestamps);

        // 异步检查管理员状态
        const isAdmin = await adskipStorage.checkAdminStatus();

        // 检查是否启用广告跳过功能
        chrome.storage.local.get('adskip_enabled', function(result) {
            const globalSkipEnabled = result.adskip_enabled !== false;

            // 生成白名单UP主管理相关元素
            let whitelistControls = '';
            if (currentUploader && currentUploader !== '未知UP主') {
                whitelistControls = `
                    <div class="adskip-whitelist-container">
                        <div class="adskip-uploader-info">
                            <div class="adskip-uploader-name">
                                <span>UP主：${currentUploader}</span>
                                <label class="adskip-whitelist-label">
                                    <span>白名单</span>
                                    <label class="adskip-switch adskip-switch-small">
                                        <input type="checkbox" id="adskip-whitelist-toggle" ${isInWhitelist && isWhitelistEnabled ? 'checked' : ''}>
                                        <span class="adskip-slider"></span>
                                    </label>
                                </label>
                            </div>
                        </div>
                    </div>
                `;
            }

            // 获取跳过模式描述
            const getSkipModeDesc = () => {
                if (!globalSkipEnabled) return '⏸️ 手动模式，可以点击广告区域手动跳过';
                if (isInWhitelist && isWhitelistEnabled) return '🔹 白名单已启用，仅手动跳过';
                return '✅ 自动跳过已启用';
            };

            // 面板内容
            panel.innerHTML = `
                <div class="adskip-panel-header">
                    <h3 class="adskip-title">广告跳过 - 时间设置</h3>
                    <label class="adskip-switch">
                        <input type="checkbox" id="adskip-toggle" ${globalSkipEnabled ? 'checked' : ''}>
                        <span class="adskip-slider"></span>
                    </label>
                </div>
                <div class="adskip-toggle-desc">${getSkipModeDesc()}</div>
                <div class="adskip-video-id">当前视频: ${currentVideoId || '未识别'}</div>

                ${whitelistControls}

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
                ${isAdmin ? `
                <div class="adskip-admin-container">
                    <button id="adskip-admin" class="adskip-admin-btn">🔧 管理员设置</button>
                </div>
                ` : `
                <div class="adskip-admin-container">
                    <button id="adskip-login" class="adskip-admin-btn">🔑 管理员登录</button>
                </div>
                `}
            `;

            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .adskip-whitelist-container {
                    background-color: #f8f9fa;
                    border-radius: 6px;
                    padding: 8px 10px;
                    margin: 10px 0;
                    border: 1px solid #e0e0e0;
                }
                .adskip-uploader-name {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #333;
                    font-size: 14px;
                }
                .adskip-whitelist-label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    color: #555;
                }
                .adskip-switch-small {
                    width: 36px;
                    height: 20px;
                }
                .adskip-switch-small .adskip-slider:before {
                    height: 14px;
                    width: 14px;
                    left: 3px;
                    bottom: 3px;
                }
                .adskip-switch-small input:checked + .adskip-slider:before {
                    transform: translateX(16px);
                }
                /* 添加状态信息的动画效果 */
                .adskip-status {
                    transition: opacity 0.3s ease-in-out;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.03);
                    padding: 8px;
                    margin-top: 8px;
                }
                /* 白名单标签状态变化反馈 */
                .adskip-whitelist-label span {
                    transition: color 0.3s ease;
                }
                .adskip-whitelist-toggle:checked ~ .adskip-whitelist-label span {
                    color: #00a1d6;
                    font-weight: 500;
                }
                /* 开关过渡效果 */
                .adskip-slider {
                    transition: background-color 0.3s ease;
                }
                .adskip-slider:before {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                /* 面板内容平滑过渡 */
                .adskip-toggle-desc {
                    transition: color 0.3s ease, opacity 0.2s ease;
                }
            `;
            document.head.appendChild(style);

            // 开关逻辑
            document.getElementById('adskip-toggle').addEventListener('change', function() {
                const isEnabled = this.checked;
                chrome.storage.local.set({'adskip_enabled': isEnabled}, function() {
                    // 更新开关描述
                    const toggleDesc = document.querySelector('.adskip-toggle-desc');
                    if (toggleDesc) {
                        if (isEnabled && isInWhitelist && isWhitelistEnabled) {
                            toggleDesc.textContent = '🔹 白名单已启用，仅手动跳过';
                        } else if (isEnabled) {
                            toggleDesc.textContent = '✅ 自动跳过已启用';
                        } else {
                            toggleDesc.textContent = '⏸️ 手动模式，可以点击广告区域手动跳过';
                        }
                    }
                    // 如果禁用，清除当前的监控
                    if (!isEnabled && window.adSkipCheckInterval) {
                        clearInterval(window.adSkipCheckInterval);
                        window.adSkipCheckInterval = null;
                        adskipUtils.logDebug('已临时禁用广告跳过功能');
                    } else if (isEnabled) {
                        // 重新启用监控
                        if (currentAdTimestamps.length > 0) {
                            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                            adskipUtils.logDebug('已重新启用广告跳过功能');
                        }
                    }
                });
            });

            // 白名单开关逻辑
            if (currentUploader && currentUploader !== '未知UP主') {
                document.getElementById('adskip-whitelist-toggle').addEventListener('change', async function() {
                    try {
                        const isChecked = this.checked;
                        const toggleDesc = document.querySelector('.adskip-toggle-desc');
                        let statusMessage = '';

                        // 保存开关原始状态，以便在操作失败时恢复
                        const originalState = this.checked;

                        // 尝试重新获取最新的白名单状态（以防白名单在其他页面被删除）
                        const freshWhitelistItem = await adskipStorage.loadUploaderWhitelist()
                            .then(list => list.find(item =>
                                (typeof item === 'string' && item === currentUploader) ||
                                (typeof item === 'object' && item.name === currentUploader)
                            ));

                        // 刷新白名单状态变量
                        const freshIsInWhitelist = !!freshWhitelistItem;
                        const freshIsWhitelistEnabled = typeof freshWhitelistItem === 'string' ||
                                     (freshWhitelistItem && freshWhitelistItem.enabled !== false);

                        // 根据当前最新状态和开关操作执行响应动作
                        if (isChecked) {
                            // 启用白名单（如果不在白名单则添加）
                            if (!freshIsInWhitelist) {
                                await adskipStorage.addUploaderToWhitelist(currentUploader);
                                statusMessage = `已将UP主 "${currentUploader}" 加入白名单`;
                            } else if (!freshIsWhitelistEnabled) {
                                // 如果在白名单但被禁用，则启用
                                await adskipStorage.enableUploaderInWhitelist(currentUploader);
                                statusMessage = `已启用UP主 "${currentUploader}" 的白名单`;
                            }
                        } else {
                            // 禁用白名单
                            if (freshIsInWhitelist && freshIsWhitelistEnabled) {
                                await adskipStorage.disableUploaderInWhitelist(currentUploader);
                                statusMessage = `已禁用UP主 "${currentUploader}" 的白名单`;
                            }
                        }

                        // 直接更新UI状态（无需关闭重开面板）
                        if (toggleDesc && globalSkipEnabled) {
                            if (isChecked) {
                                toggleDesc.textContent = '🔹 白名单已启用，仅手动跳过';
                            } else {
                                toggleDesc.textContent = '✅ 自动跳过已启用';
                            }
                        }

                        // 更新状态显示
                        if (statusMessage) {
                            const statusElement = document.getElementById('adskip-status');
                            statusElement.style.display = 'block';
                            statusElement.innerText = statusMessage;

                            // 使用淡入淡出效果替代闪烁
                            statusElement.style.opacity = '0';
                            statusElement.style.transition = 'opacity 0.3s ease-in-out';
                            setTimeout(() => { statusElement.style.opacity = '1'; }, 50);
                        }
                    } catch (error) {
                        console.error("白名单操作失败:", error);
                        // 显示错误消息
                        alert(`操作失败: ${error.message}`);

                        // 恢复开关状态
                        this.checked = !this.checked;
                    }
                });
            }

            // 广告跳过百分比滑块逻辑
            const percentageSlider = document.getElementById('adskip-percentage-slider');
            const percentageValue = document.getElementById('adskip-percentage-value');

            percentageSlider.addEventListener('input', function() {
                const newValue = parseInt(this.value, 10);
                percentageValue.textContent = newValue;
            });

            percentageSlider.addEventListener('change', function() {
                const newValue = parseInt(this.value, 10);
                adskipStorage.saveAdSkipPercentage(newValue);

                // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                chrome.storage.local.get('adskip_enabled', function(result) {
                    if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
                        adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
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
                    adskipStorage.saveAdSkipPercentage(presetValue);

                    // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                    chrome.storage.local.get('adskip_enabled', function(result) {
                        if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
                            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
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
                    adskipVideoMonitor.setupAdSkipMonitor([]);
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

                    adskipVideoMonitor.setupAdSkipMonitor(adTimestamps); // 覆盖而不是添加
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
                    adskipVideoMonitor.setupAdSkipMonitor(urlAdTimestamps);
                    document.getElementById('adskip-input').value = adskipUtils.timestampsToString(urlAdTimestamps);
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '已还原为URL中的设置';
                } else {
                    // 否则清空
                    adskipVideoMonitor.setupAdSkipMonitor([]);
                    document.getElementById('adskip-input').value = '';
                    document.getElementById('adskip-status').style.display = 'block';
                    document.getElementById('adskip-status').innerText = '已还原（清空所有设置）';
                }
            });

            // 管理员设置按钮
            if (isAdmin) {
                document.getElementById('adskip-admin').addEventListener('click', function() {
                    adskipAdmin.showAdminPanel();
                });
            } else {
                // 添加管理员登录功能
                document.getElementById('adskip-login').addEventListener('click', function() {
                    const apiKey = prompt('请输入管理员API密钥:');
                    if (!apiKey) return;

                    if (adskipStorage.verifyAdminAccess(apiKey)) {
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
            // 重置按钮 - 清空已保存的视频广告数据
            document.getElementById('adskip-reset').addEventListener('click', function() {
                // 只获取视频ID相关的存储键，排除白名单和设置
                chrome.storage.local.get(null, function(items) {
                    const allKeys = Object.keys(items);
                    // 过滤出只与视频ID相关的键，排除所有设置键和白名单
                    const videoKeys = allKeys.filter(key =>
                        key.startsWith('adskip_') &&
                        key !== 'adskip_debug_mode' &&
                        key !== 'adskip_enabled' &&
                        key !== 'adskip_percentage' &&
                        key !== 'adskip_admin_authorized' &&
                        key !== 'adskip_uploader_whitelist'
                    );

                    if (videoKeys.length > 0) {
                        if (confirm('确定要清空已保存的视频广告数据吗？\n注意：此操作不会影响白名单和其他设置。')) {
                            chrome.storage.local.remove(videoKeys, function() {
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
                                document.getElementById('adskip-status').innerText = '已清空所有视频广告数据';

                                adskipUtils.logDebug('已清空所有视频广告数据');
                            });
                        }
                    } else {
                        document.getElementById('adskip-status').style.display = 'block';
                        document.getElementById('adskip-status').innerText = '没有已保存的视频广告数据';
                    }
                });
            });
        });

        document.body.appendChild(panel);
    });

    document.body.appendChild(button);
}

// 导出模块函数
window.adskipUI = {
    createLinkGenerator
};