/**
 * ui.js - 用户界面模块
 * 处理所有UI相关的功能
 */

'use strict';

// 状态消息的全局计时器
let statusMessageTimerId = null;

/**
 * 更新状态显示
 * @param {string} message 状态信息
 * @param {string} type 消息类型: 'success', 'warning', 'error', 'info'
 * @param {number} duration 显示持续时间（毫秒）
 */
function updateStatusDisplay(message, type = 'success', duration = 3000) {
    // 找到主状态显示元素
    const statusElement = document.getElementById('adskip-status');
    if (!statusElement) {
        console.log('未找到状态显示元素');
        return;
    }

    // 清除之前的计时器
    if (statusMessageTimerId) {
        clearTimeout(statusMessageTimerId);
        statusMessageTimerId = null;
    }

    // 移除所有状态类
    statusElement.classList.remove('status-success', 'status-warning', 'status-error', 'status-info');

    // 添加对应的状态类
    statusElement.classList.add(`status-${type}`);

    // 设置消息内容
    statusElement.textContent = message;

    // 确保元素显示
    statusElement.style.opacity = '1';
    statusElement.style.display = 'block';

    // 添加即将淡出的类（用于CSS过渡效果）
    statusElement.classList.remove('fade-out');

    // 设置定时器准备淡出
    statusMessageTimerId = setTimeout(() => {
        // 添加淡出类
        statusElement.classList.add('fade-out');

        // 设置淡出后隐藏的计时器
        setTimeout(() => {
            statusElement.style.display = 'none';
            statusElement.classList.remove('fade-out');
        }, 500); // 与CSS过渡时间一致

        statusMessageTimerId = null;
    }, duration);
}

/**
 * 创建链接生成器UI
 */
function createLinkGenerator() {
    let button;

    button = adskipAdDetection.createAdSkipButton();
    adskipUtils.logDebug('[AdSkip] 使用广告检测模块的按钮');

    // 无论使用哪种按钮，都添加点击事件展开操作面板
    button.addEventListener('click', async function() {
        // 如果按钮处于检测中状态，不响应点击
        if (button.classList.contains('detecting')) {
            adskipUtils.logDebug('[AdSkip] 按钮处于检测中状态，不响应点击');
            return;
        }

        // 如果面板已经存在，则移除它
        if (document.getElementById('adskip-panel')) {
            document.getElementById('adskip-panel').remove();
            return;
        }

        // 刷新当前视频ID
        const currentVideoId = adskipUtils.getCurrentVideoId().id;

        // 获取当前视频UP主信息
        const { uploader: currentUploader, title: currentTitle } = await adskipStorage.getCurrentVideoUploader();
        // 检查UP主是否在白名单中及其状态
        const whitelistItem = await adskipStorage.loadUploaderWhitelist()
            .then(list => list.find(item => item.name === currentUploader));
        // adskipUtils.logDebug(`adskipStorage.loadUploaderWhitelist(): ${JSON.stringify(await adskipStorage.loadUploaderWhitelist())}`);
        // adskipUtils.logDebug(`whitelistItem: ${JSON.stringify(whitelistItem)}`);
        const isInWhitelist = !!whitelistItem;
        const isWhitelistEnabled = whitelistItem && whitelistItem.enabled !== false;

        const panel = document.createElement('div');
        panel.id = 'adskip-panel';
        panel.className = 'adskip-panel';

        // 获取当前生效的时间段字符串
        const currentTimeString = adskipUtils.timestampsToString(currentAdTimestamps);

        // 异步检查管理员状态
        const isAdmin = await adskipStorage.checkAdminStatus();

        // 检查是否启用广告跳过功能
        adskipStorage.getEnabled().then(function(globalSkipEnabled) {
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
                <div id="adskip-status" class="adskip-status"></div>
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
                /* 状态信息样式 */
                .adskip-status {
                    transition: opacity 0.5s ease;
                    border-radius: 4px;
                    padding: 8px;
                    margin-top: 8px;
                    display: none;
                    opacity: 1;
                }
                /* 淡出效果类 */
                .adskip-status.fade-out {
                    opacity: 0;
                }
                /* 状态类型样式 */
                .adskip-status.status-success {
                    background-color: rgba(40, 167, 69, 0.1);
                    border-left: 3px solid #28a745;
                    color: #155724;
                }
                .adskip-status.status-warning {
                    background-color: rgba(255, 193, 7, 0.1);
                    border-left: 3px solid #ffc107;
                    color: #856404;
                }
                .adskip-status.status-error {
                    background-color: rgba(220, 53, 69, 0.1);
                    border-left: 3px solid #dc3545;
                    color: #721c24;
                }
                .adskip-status.status-info {
                    background-color: rgba(23, 162, 184, 0.1);
                    border-left: 3px solid #17a2b8;
                    color: #0c5460;
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
                adskipStorage.setEnabled(isEnabled).then(() => {
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
                        updateStatusDisplay('已临时禁用广告跳过功能', 'warning');
                    } else if (isEnabled) {
                        // 重新启用监控
                        if (currentAdTimestamps.length > 0) {
                            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                            adskipUtils.logDebug('已重新启用广告跳过功能');
                            updateStatusDisplay('已重新启用广告跳过功能', 'success');
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
                            .then(list => list.find(item => item.name === currentUploader));

                        // 刷新白名单状态变量
                        const freshIsInWhitelist = !!freshWhitelistItem;
                        const freshIsWhitelistEnabled = freshWhitelistItem && freshWhitelistItem.enabled !== false;

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
                            updateStatusDisplay(statusMessage, 'info');
                        }
                    } catch (error) {
                        console.error("白名单操作失败:", error);
                        // 显示错误消息
                        updateStatusDisplay(`操作失败: ${error.message}`, 'error');

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
                adskipStorage.getEnabled().then(function(globalSkipEnabled) {
                    if (globalSkipEnabled && currentAdTimestamps.length > 0) {
                        adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                    }

                    updateStatusDisplay(`已更新广告跳过范围为：前${newValue}%`, 'success');
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
                    adskipStorage.getEnabled().then(function(globalSkipEnabled) {
                        if (globalSkipEnabled && currentAdTimestamps.length > 0) {
                            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                        }

                        updateStatusDisplay(`已更新广告跳过范围为：前${presetValue}%`, 'success');
                    });
                });
            });

            // 生成链接按钮
            document.getElementById('adskip-generate').addEventListener('click', function() {
                const input = document.getElementById('adskip-input').value.trim();
                if (!input) {
                    updateStatusDisplay('请输入有效的时间段', 'error');
                    return;
                }

                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('adskip', input);
                // 待修改成纯粹的参数，而不是用现有URL
                adskipUtils.logDebug(`生成广告跳过链接: ${currentVideoId}`);

                const resultDiv = document.getElementById('adskip-result');
                resultDiv.innerHTML = `
                    <p>广告跳过链接:</p>
                    <a href="${currentUrl.toString()}" target="_blank">${currentUrl.toString()}</a>
                `;

                updateStatusDisplay('分享链接已生成', 'success');
            });

            // 立即应用按钮
            document.getElementById('adskip-apply').addEventListener('click', function() {
                const input = document.getElementById('adskip-input').value.trim();
                if (!input) {
                    // 如果输入为空，则清空时间段
                    adskipVideoMonitor.setupAdSkipMonitor([]);
                    updateStatusDisplay('设置已应用: 已清空所有时间段', 'info');
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
                            end_time: end
                        };
                    });

                    adskipVideoMonitor.setupAdSkipMonitor(adTimestamps); // 覆盖而不是添加
                    updateStatusDisplay('设置已应用: ' + input, 'success');
                } catch (e) {
                    updateStatusDisplay('格式错误，请使用正确的格式：开始-结束,开始-结束', 'error');
                }
            });

            // 还原按钮
            document.getElementById('adskip-restore').addEventListener('click', function() {
                // 如果有URL参数，使用URL中的值
                if (urlAdTimestamps.length > 0) {
                    adskipVideoMonitor.setupAdSkipMonitor(urlAdTimestamps);
                    document.getElementById('adskip-input').value = adskipUtils.timestampsToString(urlAdTimestamps);
                    updateStatusDisplay('已还原为URL中的设置', 'info');
                } else {
                    // 否则清空
                    adskipVideoMonitor.setupAdSkipMonitor([]);
                    document.getElementById('adskip-input').value = '';
                    updateStatusDisplay('已还原（清空所有设置）', 'info');
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
                        updateStatusDisplay('验证成功，已获得管理员权限', 'success');
                        // 重新加载面板以显示管理员选项
                        document.getElementById('adskip-panel').remove();
                        createLinkGenerator();
                        document.getElementById('adskip-button').click();
                    } else {
                        updateStatusDisplay('API密钥无效', 'error');
                    }
                });
            }
            // 重置按钮 - 清空已保存的视频广告数据
            document.getElementById('adskip-reset').addEventListener('click', function() {
                // 使用storage模块的集中式方法，获取视频数据键
                adskipStorage.getVideoDataKeys().then(function(videoKeys) {
                    if (videoKeys.length > 0) {
                        if (confirm('确定要清空已保存的视频广告数据吗？\n注意：此操作不会影响白名单和其他设置。')) {
                            adskipStorage.removeKeys(videoKeys).then(() => {
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
                                updateStatusDisplay('已清空所有视频广告数据', 'warning');

                                adskipUtils.logDebug('已清空所有视频广告数据');
                            });
                        }
                    } else {
                        updateStatusDisplay('没有已保存的视频广告数据', 'info');
                    }
                });
            });
        });

        document.body.appendChild(panel);
    });

    document.body.appendChild(button);
}

// 添加存储变更监听器
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace !== 'local') return;

    // 监听广告跳过功能开关变化，使用adskipStorage.KEYS常量
    if (changes[adskipStorage.KEYS.ENABLED] !== undefined) {
        const globalSkipEnabled = changes[adskipStorage.KEYS.ENABLED].newValue !== false;
        const toggleButton = document.getElementById('adskip-toggle');
        if (toggleButton) {
            toggleButton.checked = globalSkipEnabled;
        }
    }

    // 监听广告跳过百分比变化，使用adskipStorage.KEYS常量
    if (changes[adskipStorage.KEYS.PERCENTAGE] !== undefined) {
        const newPercentage = changes[adskipStorage.KEYS.PERCENTAGE].newValue;

        // 更新滑块和显示值
        const percentageSlider = document.getElementById('adskip-percentage-slider');
        const percentageValue = document.getElementById('adskip-percentage-value');

        if (percentageSlider && percentageValue) {
            percentageSlider.value = newPercentage;
            percentageValue.textContent = newPercentage;
        }
    }

    // 监听白名单变化，使用adskipStorage.KEYS常量
    if (changes[adskipStorage.KEYS.UPLOADER_WHITELIST] !== undefined) {
        adskipStorage.getCurrentVideoUploader().then(({uploader: currentUploader}) => {
            if (!currentUploader || currentUploader === '未知UP主') return;

            adskipStorage.checkUploaderInWhitelist(currentUploader).then(isInWhitelist => {
                const whitelistToggle = document.getElementById('adskip-whitelist-toggle');
                if (whitelistToggle) {
                    whitelistToggle.checked = isInWhitelist;
                }
            });
        });
    }
});

// 导出模块函数
window.adskipUI = {
    createLinkGenerator,
    updateStatusDisplay
};
