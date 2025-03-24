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

        const panel = document.createElement('div');
        panel.id = 'adskip-panel';
        panel.className = 'adskip-panel';

        // 获取当前生效的时间段字符串
        const currentTimeString = adskipUtils.timestampsToString(currentAdTimestamps);

        // 异步检查管理员状态
        const isAdmin = await adskipStorage.checkAdminStatus();

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

            // 开关逻辑
            document.getElementById('adskip-toggle').addEventListener('change', function() {
                const isEnabled = this.checked;
                chrome.storage.local.set({'adskip_enabled': isEnabled}, function() {
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
            // 重置按钮 - 仅清空已保存的视频广告数据
            document.getElementById('adskip-reset').addEventListener('click', function() {
                // 只获取视频ID相关的存储键
                chrome.storage.local.get(null, function(items) {
                    const allKeys = Object.keys(items);
                    // 过滤出只与视频ID相关的键，排除所有设置键
                    const videoKeys = allKeys.filter(key =>
                        key.startsWith('adskip_') &&
                        key !== 'adskip_debug_mode' &&
                        key !== 'adskip_enabled' &&
                        key !== 'adskip_percentage' &&
                        key !== 'adskip_admin_authorized'
                    );

                    if (videoKeys.length > 0) {
                        if (confirm('确定要清空已保存的视频广告数据吗？\n注意：此操作不会修改其他设置。')) {
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