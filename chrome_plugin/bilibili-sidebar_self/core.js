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
let scriptInitiatedSeek = false;  // 标记是否是脚本引起的seeking
let isAdminAuthorized = false;    // 管理员认证状态
let adSkipPercentage = 5;         // 添加广告跳过百分比全局变量，默认为5%
let cachedVideoPlayer = null;     // 缓存视频播放器元素
let lastPlayerCheck = 0;          // 上次查找播放器的时间

// 缓存进度条容器
let cachedProgressBar = null;
let lastProgressBarCheck = 0;

/**
 * 主函数 - 插件入口
 */
async function init() {
    adskipUtils.logDebug('[AdSkip] 开始初始化插件...');

    // 初始化调试模式
    await adskipStorage.initDebugMode();

    // 确保默认设置存在并加载所有设置
    await initializeSettings();

    // 添加storage变化监听器
    setupStorageListeners();

    // 检查管理员状态 (异步)
    isAdminAuthorized = await adskipStorage.checkAdminStatus();
    adskipUtils.logDebug(`初始化 - 管理员状态: ${isAdminAuthorized ? '已授权' : '未授权'}`);

    // 获取当前视频ID
    currentVideoId = adskipUtils.getCurrentVideoId();
    adskipUtils.logDebug(`初始化 - 当前视频ID: ${currentVideoId}`);

    // 解析URL中的广告跳过参数
    const urlParams = adskipUtils.parseAdSkipParam();

    // 使用storage模块的验证方法加载并验证时间戳
    const result = await adskipStorage.loadAndValidateTimestamps(
        currentVideoId,
        urlParams
    );

    // 根据结果更新全局变量并设置监控
    if (result.fromUrl) {
        // 使用URL参数（已验证非污染）
        urlAdTimestamps = [...result.timestamps];
        currentAdTimestamps = [...result.timestamps];
        adskipUtils.logDebug('使用URL中的广告时间段初始化');
    } else if (result.timestamps.length > 0) {
        // 使用保存的时间戳
        urlAdTimestamps = []; // URL参数可能被污染，清空
        currentAdTimestamps = [...result.timestamps];
        adskipUtils.logDebug('使用保存的广告时间段初始化');

        // 如果检测到污染，输出额外日志
        if (result.isPolluted) {
            adskipUtils.logDebug(`URL参数被视频${result.pollutionSource}的数据污染，已清除`);
        }
    } else {
        // 没有可用的时间戳
        urlAdTimestamps = [];
        currentAdTimestamps = [];
        adskipUtils.logDebug('没有找到广告时间段');
    }

    // 根据时间戳状态设置监控
    if (currentAdTimestamps.length > 0) {
        adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
    }

    // 创建UI界面
    adskipUI.createLinkGenerator();

    // 设置URL变化监控
    adskipVideoMonitor.setupUrlChangeMonitor();

    // 设置广告标记监控
    adskipVideoMonitor.setupAdMarkerMonitor();

    adskipUtils.logDebug('插件初始化完成');
}

/**
 * 初始化设置和全局变量
 */
async function initializeSettings() {
    // 加载功能开关状态
    const isEnabled = await adskipStorage.getEnabled();
    adskipUtils.logDebug(`初始化 - 功能开关状态: ${isEnabled ? '已启用' : '已禁用'}`);

    // 加载广告跳过百分比设置
    adSkipPercentage = await adskipStorage.loadAdSkipPercentage();
    adskipUtils.logDebug(`初始化 - 广告跳过百分比: ${adSkipPercentage}%`);
}

/**
 * 设置存储变化监听器
 */
function setupStorageListeners() {
    // 监听器函数
    let storageListener = function(changes, namespace) {
        if (namespace === 'local') {
            // 检查广告跳过百分比是否变化
            if (changes[adskipStorage.KEYS.PERCENTAGE]) {
                const newPercentage = changes[adskipStorage.KEYS.PERCENTAGE].newValue;
                // 只有当值真正变化时才执行操作
                if (adSkipPercentage !== newPercentage) {
                    adSkipPercentage = newPercentage;
                    adskipUtils.logDebug(`检测到广告跳过百分比设置变化: ${adSkipPercentage}%`);

                    // 更新界面上的值（如果面板打开的话）
                    updateUIPercentage(adSkipPercentage);

                    // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
                    adskipStorage.getEnabled().then(isEnabled => {
                        if (isEnabled && currentAdTimestamps.length > 0) {
                            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                        }
                    });
                }
            }

            // 检查功能开关状态是否变化
            if (changes[adskipStorage.KEYS.ENABLED]) {
                const isEnabled = changes[adskipStorage.KEYS.ENABLED].newValue;
                adskipUtils.logDebug(`检测到功能开关状态变化: ${isEnabled ? '已启用' : '已禁用'}`);

                // 更新界面上的开关状态（如果面板打开的话）
                updateUIToggle(isEnabled);

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

            // 检查管理员权限是否变化
            if (changes[adskipStorage.KEYS.ADMIN_AUTH]) {
                const newAdminStatus = changes[adskipStorage.KEYS.ADMIN_AUTH].newValue === true;
                if (isAdminAuthorized !== newAdminStatus) {
                    isAdminAuthorized = newAdminStatus;
                    adskipUtils.logDebug(`检测到管理员权限变化: ${isAdminAuthorized ? '已授权' : '未授权'}`);
                }
            }

            // 检查调试模式是否变化
            if (changes[adskipStorage.KEYS.DEBUG_MODE] !== undefined) {
                const newDebugMode = changes[adskipStorage.KEYS.DEBUG_MODE].newValue;
                const currentDebugMode = adskipStorage.getDebugMode();
                if (currentDebugMode !== newDebugMode) {
                    adskipStorage.setDebugMode(newDebugMode).then(() => {
                        adskipUtils.logDebug(`检测到调试模式变化: ${newDebugMode ? '已启用' : '已禁用'}`);
                    });
                }
            }
        }
    };

    // 添加监听器
    chrome.storage.onChanged.addListener(storageListener);
}

/**
 * 更新UI上的百分比显示
 * @param {number} percentage 百分比值
 */
function updateUIPercentage(percentage) {
    const percentageSlider = document.getElementById('adskip-percentage-slider');
    const percentageValue = document.getElementById('adskip-percentage-value');
    if (percentageSlider && percentageValue) {
        // 防止触发change事件
        if (parseInt(percentageSlider.value) !== percentage) {
            percentageSlider.value = percentage;
        }
        if (percentageValue.textContent != percentage) {
            percentageValue.textContent = percentage;
        }
    }
}

/**
 * 更新UI上的功能开关状态
 * @param {boolean} isEnabled 是否启用
 */
function updateUIToggle(isEnabled) {
    const toggleSwitch = document.getElementById('adskip-toggle');
    if (toggleSwitch && toggleSwitch.checked !== isEnabled) {
        toggleSwitch.checked = isEnabled;
    }
}

// 在页面加载后初始化
window.addEventListener('load', init);
