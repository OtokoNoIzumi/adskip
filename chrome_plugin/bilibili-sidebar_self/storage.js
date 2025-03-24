/**
 * storage.js - 存储模块
 * 处理所有与Chrome存储API相关的操作
 */

'use strict';

/**
 * 加载指定视频ID的广告时间戳
 * @param {string} videoId 视频ID
 * @returns {Promise<Array>} 广告时间戳数组
 */
function loadAdTimestampsForVideo(videoId) {
    return new Promise((resolve) => {
        if (!videoId) {
            adskipUtils.logDebug('视频ID为空，无法加载广告时间段');
            resolve([]);
            return;
        }

        try {
            chrome.storage.local.get(`adskip_${videoId}`, (result) => {
                const savedData = result[`adskip_${videoId}`];
                if (!savedData) {
                    adskipUtils.logDebug(`没有找到视频 ${videoId} 的保存数据`);
                    resolve([]);
                    return;
                }

                const parsed = JSON.parse(savedData);
                adskipUtils.logDebug(`成功加载视频 ${videoId} 的广告时间段:`, parsed);

                // 新的数据格式：直接获取timestamps数组
                const timestamps = parsed.timestamps || [];
                resolve(timestamps);
            });
        } catch (e) {
            console.error(`--==--LOG: 加载视频 ${videoId} 广告数据失败:`, e);
            resolve([]);
        }
    });
}

/**
 * 保存指定视频ID的广告时间戳
 * @param {string} videoId 视频ID
 * @param {Array} timestamps 广告时间戳数组
 * @returns {Promise<Array>} 保存的广告时间戳数组
 */
function saveAdTimestampsForVideo(videoId, timestamps) {
    if (!videoId || !Array.isArray(timestamps) || timestamps.length === 0) {
        return Promise.reject(new Error('无效的参数'));
    }

    // 获取视频信息辅助函数
    function getVideoInfo() {
        try {
            // 从页面中提取视频标题
            const titleElement = document.querySelector('.video-title, .tit, h1.title');
            const title = titleElement ? titleElement.textContent.trim() : '未知视频';

            // 从页面中提取UP主名称
            const upElement = document.querySelector('.up-name, .name .username, a.up-name');
            const uploader = upElement ? upElement.textContent.trim() : '未知UP主';

            return { title, uploader };
        } catch (e) {
            adskipUtils.logDebug('提取视频信息失败', e);
            return { title: '未知视频', uploader: '未知UP主' };
        }
    }

    const videoInfo = getVideoInfo();

    // 构建存储数据结构
    const timestampsWithInfo = timestamps.map(ts => ({
        ...ts,
        _videoTitle: videoInfo.title,
        _uploader: videoInfo.uploader
    }));

    // 添加保存时间戳
    const saveData = {
        timestamps: timestampsWithInfo,
        savedAt: Date.now() // 添加时间戳记录保存时间
    };

    const jsonData = JSON.stringify(saveData);

    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [`adskip_${videoId}`]: jsonData }, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                adskipUtils.logDebug(`已保存视频 ${videoId} 的广告时间段:`, timestamps);
                resolve(timestamps);
            }
        });
    });
}

/**
 * 加载广告跳过百分比设置
 * @returns {Promise<number>} 广告跳过百分比
 */
function loadAdSkipPercentage() {
    return new Promise((resolve) => {
        chrome.storage.local.get('adskip_percentage', function(result) {
            if (result.adskip_percentage !== undefined) {
                adSkipPercentage = result.adskip_percentage;
                adskipUtils.logDebug(`加载广告跳过百分比设置: ${adSkipPercentage}%`);
                resolve(adSkipPercentage);
            } else {
                // 如果没有保存的设置，默认为5%
                adSkipPercentage = 5;
                // 保存默认设置
                chrome.storage.local.set({'adskip_percentage': adSkipPercentage});
                adskipUtils.logDebug(`设置默认广告跳过百分比: ${adSkipPercentage}%`);
                resolve(adSkipPercentage);
            }
        });
    });
}

/**
 * 保存广告跳过百分比设置
 * @param {number} percentage 百分比数值
 * @returns {Promise<number>} 保存的百分比值
 */
function saveAdSkipPercentage(percentage) {
    // 检查扩展上下文是否可用
    if (!extensionAvailable && !adskipUtils.checkExtensionContext()) {
        return Promise.reject(new Error('Extension context invalidated'));
    }

    // 转为整数确保一致性
    percentage = parseInt(percentage, 10);

    // 检查是否实际发生了变化
    if (adSkipPercentage !== percentage) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({'adskip_percentage': percentage}, function() {
                    if (!extensionAvailable) return reject(new Error('Extension context invalidated'));
                    adSkipPercentage = percentage;
                    adskipUtils.logDebug(`已保存广告跳过百分比设置: ${adSkipPercentage}%`);
                    resolve(adSkipPercentage);
                });
            } catch(e) {
                // 扩展上下文可能已失效
                extensionAvailable = false;
                console.log("Bilibili广告跳过插件：无法保存设置，扩展上下文已失效");
                reject(e);
            }
        });
    } else {
        return Promise.resolve(adSkipPercentage);
    }
}

/**
 * 验证管理员身份
 * @param {string} apiKey API密钥
 * @returns {boolean} 验证结果
 */
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

    if (isValid) {
        // 将授权状态保存在chrome.storage.local中，这样在不同标签页间也能保持授权
        chrome.storage.local.set({'adskip_admin_authorized': true}, function() {
            isAdminAuthorized = true;
            adskipUtils.logDebug('管理员授权已保存到存储中');
        });
        isAdminAuthorized = true;
        return true;
    }

    return false;
}

/**
 * 检查管理员权限
 * @returns {Promise<boolean>} 是否有管理员权限
 */
async function checkAdminStatus() {
    return new Promise((resolve) => {
        // 从chrome.storage.local中获取授权状态
        chrome.storage.local.get('adskip_admin_authorized', function(result) {
            if (result.adskip_admin_authorized === true) {
                isAdminAuthorized = true;
                resolve(true);
            } else {
                isAdminAuthorized = false;
                resolve(false);
            }
        });
    });
}

/**
 * 初始化调试模式
 * @returns {Promise<boolean>} 调试模式状态
 */
function initDebugMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get('adskip_debug_mode', (result) => {
            debugMode = result.adskip_debug_mode || false;
            if (debugMode) {
                console.log('--==--LOG: 调试模式已启用');
            }

            // 更新所有页面的调试模式开关状态
            updateDebugModeToggle();
            resolve(debugMode);
        });
    });
}

/**
 * 更新调试模式开关UI状态
 */
function updateDebugModeToggle() {
    const adminDebugToggle = document.getElementById('adskip-debug-mode');
    if (adminDebugToggle) {
        adminDebugToggle.checked = debugMode;
    }
}

// 导出模块函数
window.adskipStorage = {
    loadAdTimestampsForVideo,
    saveAdTimestampsForVideo,
    loadAdSkipPercentage,
    saveAdSkipPercentage,
    verifyAdminAccess,
    checkAdminStatus,
    initDebugMode,
    updateDebugModeToggle
};