/**
 * core.js - 核心模块
 * 包含全局变量和初始化逻辑
 */

'use strict';

// 全局变量
let currentAdTimestamps = [];     // 当前生效的广告时间段
let urlAdTimestamps = [];         // URL解析的原始广告时间段
let currentVideoId = '';          // 当前视频ID
let lastVideoId = '';             // 上一个视频ID
let debugMode = false;            // 调试模式开关
let scriptInitiatedSeek = false;  // 标记是否是脚本引起的seeking
let isAdminAuthorized = false;    // 管理员认证状态
let adSkipPercentage = 5;         // 添加广告跳过百分比全局变量，默认为5%
let extensionAvailable = true;    // 标记扩展上下文是否可用
let cachedVideoPlayer = null;     // 缓存视频播放器元素
let lastPlayerCheck = 0;          // 上次查找播放器的时间

// 缓存进度条容器
let cachedProgressBar = null;
let lastProgressBarCheck = 0;

/**
 * 主函数 - 插件入口
 */
async function init() {
    // 初始化检查扩展上下文
    if (!adskipUtils.checkExtensionContext()) {
        return; // 扩展上下文已失效，不再继续初始化
    }

    // 初始化调试模式
    await adskipStorage.initDebugMode();

    // 确保默认设置存在
    try {
        chrome.storage.local.get(['adskip_enabled', 'adskip_percentage', 'adskip_debug_mode'], function(result) {
            if (!extensionAvailable && !adskipUtils.checkExtensionContext()) return;

            // 设置默认值（如果不存在）
            const defaults = {};

            if (result.adskip_enabled === undefined) {
                defaults.adskip_enabled = true;
                adskipUtils.logDebug('初始化默认功能开关状态: 已启用');
            }

            if (result.adskip_percentage === undefined) {
                defaults.adskip_percentage = 5;
                adskipUtils.logDebug('初始化默认广告跳过百分比: 5%');
            }

            // 如果有需要设置的默认值，则一次性保存
            if (Object.keys(defaults).length > 0 && extensionAvailable) {
                try {
                    chrome.storage.local.set(defaults);
                } catch(e) {
                    // 忽略错误，可能是扩展上下文已失效
                    extensionAvailable = false;
                }
            }

            // 更新全局变量
            if (result.adskip_percentage !== undefined) {
                adSkipPercentage = result.adskip_percentage;
            } else if (defaults.adskip_percentage !== undefined) {
                adSkipPercentage = defaults.adskip_percentage;
            }
        });
    } catch(e) {
        // 扩展上下文可能已失效
        extensionAvailable = false;
        console.log("Bilibili广告跳过插件：扩展上下文已失效，请刷新页面");
        return;
    }

    // 添加storage变化监听器，并在扩展上下文失效时自我清理
    let storageListener = function(changes, namespace) {
        if (!extensionAvailable && !adskipUtils.checkExtensionContext()) {
            try {
                // 尝试移除自身
                chrome.storage.onChanged.removeListener(storageListener);
            } catch(e) {
                // 忽略错误
            }
            return;
        }

        if (namespace === 'local') {
            // 检查广告跳过百分比是否变化
            if (changes.adskip_percentage) {
                const newPercentage = changes.adskip_percentage.newValue;
                // 只有当值真正变化时才执行操作
                if (adSkipPercentage !== newPercentage) {
                    adSkipPercentage = newPercentage;
                    adskipUtils.logDebug(`检测到广告跳过百分比设置变化: ${adSkipPercentage}%`);

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
                    try {
                        if (!extensionAvailable) return;
                        chrome.storage.local.get('adskip_enabled', function(result) {
                            if (!extensionAvailable) return;
                            const isEnabled = result.adskip_enabled !== false;
                            if (isEnabled && currentAdTimestamps.length > 0) {
                                adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                            }
                        });
                    } catch(e) {
                        extensionAvailable = false;
                    }
                }
            }

            // 检查功能开关状态是否变化
            if (changes.adskip_enabled) {
                const isEnabled = changes.adskip_enabled.newValue;
                adskipUtils.logDebug(`检测到功能开关状态变化: ${isEnabled ? '已启用' : '已禁用'}`);

                // 更新界面上的开关状态（如果面板打开的话）
                const toggleSwitch = document.getElementById('adskip-toggle');
                if (toggleSwitch && toggleSwitch.checked !== isEnabled) {
                    toggleSwitch.checked = isEnabled;
                }

                // 如果功能被禁用，清除当前的监控
                if (!isEnabled && window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                    adskipUtils.logDebug('已禁用广告跳过功能，清除监控');
                } else if (isEnabled && currentAdTimestamps.length > 0) {
                    // 如果功能被启用且有广告时间段，则重新应用设置
                    adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                }
            }

            // 检查调试模式是否变化
            if (changes.adskip_debug_mode !== undefined) {
                const newDebugMode = changes.adskip_debug_mode.newValue;
                if (debugMode !== newDebugMode) {
                    debugMode = newDebugMode;
                    adskipUtils.logDebug(`检测到调试模式变化: ${debugMode ? '已启用' : '已禁用'}`);
                    adskipStorage.updateDebugModeToggle();
                }
            }
        }
    };

    try {
        chrome.storage.onChanged.addListener(storageListener);
    } catch(e) {
        extensionAvailable = false;
        return;
    }

    // 检查管理员状态 (异步)
    await adskipStorage.checkAdminStatus();

    // 获取当前视频ID
    currentVideoId = adskipUtils.getCurrentVideoId();
    adskipUtils.logDebug(`初始化 - 当前视频ID: ${currentVideoId}`);

    // 解析URL中的广告跳过参数
    urlAdTimestamps = adskipUtils.parseAdSkipParam();

    // 尝试从本地存储加载
    const savedTimestamps = await adskipStorage.loadAdTimestampsForVideo(currentVideoId);

    // 如果有广告参数，设置监控 (URL参数优先)
    if (urlAdTimestamps.length > 0) {
        adskipVideoMonitor.setupAdSkipMonitor(urlAdTimestamps);
        currentAdTimestamps = [...urlAdTimestamps];
        adskipUtils.logDebug('使用URL中的广告时间段初始化');
    } else if (savedTimestamps.length > 0) {
        adskipVideoMonitor.setupAdSkipMonitor(savedTimestamps);
        currentAdTimestamps = [...savedTimestamps];
        adskipUtils.logDebug('使用保存的广告时间段初始化');
    } else {
        adskipUtils.logDebug('没有找到广告时间段');
    }

    // 创建UI界面
    adskipUI.createLinkGenerator();

    // 设置URL变化监控
    adskipVideoMonitor.setupUrlChangeMonitor();

    // 设置广告标记监控
    adskipVideoMonitor.setupAdMarkerMonitor();

    adskipUtils.logDebug('插件初始化完成');
}

// 在页面加载后初始化
window.addEventListener('load', init);
