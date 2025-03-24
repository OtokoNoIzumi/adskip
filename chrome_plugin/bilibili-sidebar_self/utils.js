/**
 * utils.js - 工具函数模块
 * 包含一系列通用工具函数
 */

'use strict';

// 日志节流控制
const logThrottleMap = new Map(); // 用于存储消息和上次输出时间
const LOG_THROTTLE_DEFAULT = 1000; // 默认节流时间（毫秒）

/**
 * 调试日志输出函数 - 优化版，添加节流控制，支持选项对象
 * @param {string} message 日志消息
 * @param {any|Object} dataOrOptions 可选的数据对象或配置选项
 * @param {number} throttleTime 节流时间（毫秒），0表示不节流
 */
function logDebug(message, dataOrOptions, throttleTime = 0) {
    if (!debugMode) return;

    // 检查第二个参数是否为配置对象
    let data = null;
    let throttle = throttleTime;

    if (dataOrOptions && typeof dataOrOptions === 'object' && dataOrOptions.hasOwnProperty('throttle')) {
        // 如果是配置对象格式
        data = dataOrOptions.data || null;
        throttle = dataOrOptions.throttle || 0;
    } else {
        // 传统格式，第二个参数是数据
        data = dataOrOptions;
    }

    // 如果设置了节流时间，检查是否应该throttle
    if (throttle > 0) {
        const now = Date.now();
        const key = `${message}${data ? JSON.stringify(data) : ''}`;
        const lastTime = logThrottleMap.get(key) || 0;

        // 如果距离上次输出的时间小于throttleTime，跳过本次输出
        if (now - lastTime < throttle) {
            return;
        }

        // 更新最后输出时间
        logThrottleMap.set(key, now);

        // 清理太旧的记录，避免内存泄漏
        if (logThrottleMap.size > 100) {
            const oldEntries = [...logThrottleMap.entries()]
                .filter(([_, time]) => now - time > 60000); // 清理超过1分钟的记录

            oldEntries.forEach(([k]) => logThrottleMap.delete(k));
        }
    }

    // 输出日志
    if (data) {
        console.log(`--==--LOG: ${message}`, data);
    } else {
        console.log(`--==--LOG: ${message}`);
    }
}

/**
 * 获取当前视频ID (BV或AV或EP)
 * @returns {string} 视频ID
 */
function getCurrentVideoId() {
    const pathname = window.location.pathname;

    // 检查是否是番剧页面
    const epMatch = pathname.match(/\/bangumi\/play\/(ep[\d]+)/);
    if (epMatch && epMatch[1]) {
        logDebug(`从番剧路径中提取到EP ID: ${epMatch[1]}`);
        return epMatch[1]; // 返回EP ID
    }

    // 检查是否是普通视频页面
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

    // 如果没有找到EP/BV/AV ID，尝试从URL中提取番剧ss_id或ep_id
    const ssid = urlParams.get('ss_id');
    if (ssid) {
        logDebug(`从URL参数中提取到番剧SS ID: ss${ssid}`);
        return 'ss' + ssid;
    }

    const epid = urlParams.get('ep_id');
    if (epid) {
        logDebug(`从URL参数中提取到番剧EP ID: ep${epid}`);
        return 'ep' + epid;
    }

    logDebug('无法提取视频ID');
    return '';
}

/**
 * 解析URL中的adskip参数
 * @returns {Array} 广告时间段数组
 */
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
                end_time: end
            };
        });
        logDebug(`解析URL adskip参数成功:`, result);
        return result;
    } catch (e) {
        console.error('--==--LOG: 解析adskip参数失败:', e);
        return [];
    }
}

/**
 * 将时间戳数组转换为字符串格式 (用于URL参数)
 * @param {Array} timestamps 时间戳数组
 * @returns {string} 格式化的字符串
 */
function timestampsToString(timestamps) {
    return timestamps.map(ad => `${ad.start_time}-${ad.end_time}`).join(',');
}

/**
 * 格式化单个时间段为可读格式
 * @param {number} startTime 开始时间（秒）
 * @param {number} endTime 结束时间（秒）
 * @returns {string} 格式化的时间段字符串
 */
function formatSingleTimestamp(startTime, endTime) {
    // 对输入时间取整
    const roundedStartTime = Math.round(startTime);
    const roundedEndTime = Math.round(endTime);

    // 格式化开始时间
    const startHours = Math.floor(roundedStartTime / 3600);
    const startMinutes = Math.floor((roundedStartTime % 3600) / 60);
    const startSeconds = roundedStartTime % 60;

    // 格式化结束时间
    const endHours = Math.floor(roundedEndTime / 3600);
    const endMinutes = Math.floor((roundedEndTime % 3600) / 60);
    const endSeconds = roundedEndTime % 60;

    // 构建格式化字符串，如果小时为0则不显示
    let startFormatted = startHours > 0
        ? `${startHours}:${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}`
        : `${startMinutes}:${startSeconds.toString().padStart(2, '0')}`;

    let endFormatted = endHours > 0
        ? `${endHours}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`
        : `${endMinutes}:${endSeconds.toString().padStart(2, '0')}`;

    return `${startFormatted}-${endFormatted}`;
}

/**
 * 将时间戳数组转换为可读的时间格式 (用于UI显示)
 * @param {Array} timestamps 时间戳数组
 * @returns {string} 格式化的时间字符串
 */
function formatTimestampsForDisplay(timestamps) {
    if (!timestamps || !timestamps.length) return '无';

    // 将每个时间段格式化为 hh:mm:ss 或 mm:ss 格式
    return timestamps.map(ad => formatSingleTimestamp(ad.start_time, ad.end_time)).join(', ');
}

/**
 * 判断两个时间段是否重叠
 * @param {Object} segment1 第一个时间段
 * @param {Object} segment2 第二个时间段
 * @returns {boolean} 是否重叠
 */
function isOverlapping(segment1, segment2) {
    return (segment1.start_time <= segment2.end_time && segment1.end_time >= segment2.start_time);
}

/**
 * 查找视频播放器元素，优化性能
 * @returns {HTMLElement|null} 视频播放器元素
 */
function findVideoPlayer() {
    // 如果缓存的播放器仍存在于DOM中且未过期，直接使用缓存
    const now = Date.now();
    if (cachedVideoPlayer && document.contains(cachedVideoPlayer) && now - lastPlayerCheck < 5000) {
        return cachedVideoPlayer;
    }

    // 重新查找播放器
    const player = document.querySelector('#bilibili-player video') ||
                   document.querySelector('.bpx-player-video-area video') ||
                   document.querySelector('.bpx-player video') ||  // 番剧播放器
                   document.querySelector('.bilibili-player-video video') || // 额外检查番剧播放器
                   document.querySelector('video');

    // 更新缓存和时间戳
    cachedVideoPlayer = player;
    lastPlayerCheck = now;

    return player;
}

/**
 * 查找进度条容器，优化性能
 * @returns {HTMLElement|null} 进度条容器元素
 */
function findProgressBar() {
    // 如果缓存的进度条仍存在于DOM中且未过期，直接使用缓存
    const now = Date.now();
    if (cachedProgressBar && document.contains(cachedProgressBar) && now - lastProgressBarCheck < 5000) {
        return cachedProgressBar;
    }

    // 重新查找进度条
    const progressBar = document.querySelector('.bpx-player-progress-wrap') ||
                        document.querySelector('.bilibili-player-video-progress-wrap') ||
                        document.querySelector('.squirtle-progress') || // 番剧进度条
                        document.querySelector('.bpx-player-progress'); // 番剧新版进度条

    // 更新缓存和时间戳
    cachedProgressBar = progressBar;
    lastProgressBarCheck = now;

    return progressBar;
}

/**
 * 检查扩展上下文是否可用
 * @returns {boolean} 扩展上下文是否可用
 */
function checkExtensionContext() {
    try {
        // 尝试访问chrome.runtime.id，如果抛出异常，则表示扩展上下文已失效
        if (chrome && chrome.runtime && chrome.runtime.id) {
            extensionAvailable = true;
            return true;
        } else {
            extensionAvailable = false;
            console.log("Bilibili广告跳过插件：扩展上下文已失效，请刷新页面");
            return false;
        }
    } catch (e) {
        extensionAvailable = false;
        console.log("Bilibili广告跳过插件：扩展上下文已失效，请刷新页面");
        return false;
    }
}

/**
 * 安全调用API，处理扩展上下文失效情况
 * @param {Function} callback 回调函数
 * @returns {Promise} Promise对象
 */
function safeApiCall(callback) {
    return new Promise((resolve, reject) => {
        if (!extensionAvailable && !checkExtensionContext()) {
            reject(new Error('Extension context invalidated'));
            return;
        }

        try {
            const result = callback();
            resolve(result);
        } catch (e) {
            if (e.message && e.message.includes('Extension context invalidated')) {
                extensionAvailable = false;
            }
            reject(e);
        }
    });
}

// 导出模块函数
window.adskipUtils = {
    logDebug,
    getCurrentVideoId,
    parseAdSkipParam,
    timestampsToString,
    formatSingleTimestamp,
    formatTimestampsForDisplay,
    isOverlapping,
    findVideoPlayer,
    findProgressBar,
    checkExtensionContext,
    safeApiCall
};