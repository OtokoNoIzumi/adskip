/**
 * utils.js - 工具函数模块
 * 包含一系列通用工具函数
 */

'use strict';

// 日志节流控制
const logThrottleMap = new Map(); // 用于存储消息和上次输出时间
const LOG_THROTTLE_DEFAULT = 1000; // 默认节流时间（毫秒）

// 添加日志过滤控制
const logFilterMap = new Map(); // 用于记录已过滤的日志

/**
 * 检查某条日志是否应该被过滤
 * @param {string} message 日志消息
 * @returns {boolean} 是否已被过滤过
 */
function isLogFiltered(message) {
    const now = Date.now();
    const lastTime = logFilterMap.get(message) || 0;

    // 如果最近5秒内已经输出过这条日志，则过滤
    if (now - lastTime < 5000) {
        return true;
    }

    // 更新该日志的最后输出时间
    logFilterMap.set(message, now);

    // 清理过滤Map，避免内存泄漏
    if (logFilterMap.size > 50) {
        const oldEntries = [...logFilterMap.entries()]
            .filter(([_, time]) => now - time > 10000); // 清理超过10秒的记录
        oldEntries.forEach(([k]) => logFilterMap.delete(k));
    }

    return false;
}

/**
 * 调试日志输出函数 - 优化版，添加节流控制，支持选项对象
 * @param {string} message 日志消息
 * @param {any|Object} dataOrOptions 可选的数据对象或配置选项
 * @param {number} throttleTime 节流时间（毫秒），0表示不节流
 */
function logDebug(message, dataOrOptions, throttleTime = 0) {
    const debugMode = window.adskipStorage.getDebugMode();
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


    // 获取调用栈信息来确定调用模块和行号
    let callerInfo = '';
    try {
        const stackObj = new Error();
        const stackLines = stackObj.stack.split('\n');

        // 查找调用者信息（第3行通常是调用logDebug的代码）
        if (stackLines.length >= 3) {
            // 提取文件名和行号
            // Chrome格式: "    at 函数名 (文件名:行号:列号)"
            // 或者: "    at 文件名:行号:列号"
            const callerLine = stackLines[2].trim();
            const matches = callerLine.match(/(?:at\s+(?:[\w\.]+\s+)?\()?([\w\-\.\/]+\.js):(\d+)(?::(\d+))?/);

            if (matches) {
                const fileName = matches[1].split('/').pop(); // 只取文件名，不要路径
                const lineNumber = matches[2];
                callerInfo = `[${fileName}:${lineNumber}] `;
            }
        }
    } catch (e) {
        // 如果解析栈失败，使用后备方案
        callerInfo = '';
    }

    // 输出日志，添加调用者信息
    if (data) {
        console.log(`--==--LOG: ${callerInfo}${message}`, data);
    } else {
        console.log(`--==--LOG: ${callerInfo}${message}`);
    }
}


/**
 * 获取当前视频ID信息
 * @returns {Object} 视频ID字符串或包含视频ID信息的对象 {bvid, epid, type, id}
 */
function getCurrentVideoId() {
    const pathname = window.location.pathname;
    const fullUrl = window.location.href;
    // logDebug(`开始提取视频ID，当前URL: ${fullUrl}`); // 暂时屏蔽
    // 初始化返回对象
    const result = {
        bvid: null,
        epid: null,
        id: '' // 最终识别到的ID，向后兼容旧代码
    };

    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);

    // 检查是否是播放列表模式
    const isPlaylist = fullUrl.includes('/list/');

    // 记录日志的函数，避免代码重复
    const logSuccess = (idType, idValue, source) => {
        logDebug(`✅ 成功从${source}中提取到${idType}: ${idValue}`);
    };

    // 1. 播放列表模式处理 - 优先级最高
    if (isPlaylist) {
        // 检查播放列表URL中的bvid参数（常规视频）
        const bvidParam = urlParams.get('bvid');
        if (bvidParam) {
            result.bvid = bvidParam;
            result.id = bvidParam;
            logSuccess('BV ID', bvidParam, '播放列表URL参数');
            return result;
        }

        // 检查播放列表URL中的oid参数（番剧）
        const oidParam = urlParams.get('oid');
        if (oidParam) {
            result.epid = oidParam;
            result.id = 'ep' + oidParam;
            logSuccess('EP ID', result.id, '播放列表URL参数');
            return result;
        }
    }

    // 2. 标准番剧页面处理
    const epMatch = pathname.match(/\/bangumi\/play\/(ep[\d]+)/);
    if (epMatch && epMatch[1]) {
        result.epid = epMatch[1].replace('ep', '');
        result.id = epMatch[1];
        logSuccess('EP ID', result.id, '番剧路径');
        return result;
    }

    // 3. 标准视频页面处理（支持多P）
    const bvMatch = pathname.match(/\/video\/(BV[\w]+)/);
    if (bvMatch && bvMatch[1]) {
        result.bvid = bvMatch[1];

        // 检查分P参数
        const pParam = urlParams.get('p');
        if (pParam && pParam !== '1') {
            // 如果有分P参数且不是第1P，将分P信息加入ID中
            result.id = `${bvMatch[1]}_p${pParam}`;
            logSuccess('BV ID (多P)', result.id, '路径+分P参数');
        } else {
            // 第1P或没有分P参数，使用原始BV ID
            result.id = bvMatch[1];
            logSuccess('BV ID', result.id, '路径');
        }
        return result;
    }

    // 4. URL参数中的各种ID处理
    // AV ID
    const avid = urlParams.get('aid');
    if (avid) {
        const avId = 'av' + avid;
        result.aid = avid;
        result.id = avId;
        logSuccess('AV ID', avId, 'URL参数');
        return result;
    }

    // SS ID (番剧季ID)
    const ssid = urlParams.get('ss_id');
    if (ssid) {
        const ssId = 'ss' + ssid;
        result.ssid = ssid;
        result.id = ssId;
        logSuccess('SS ID', ssId, 'URL参数');
        return result;
    }

    // EP ID (番剧集ID)
    const epid = urlParams.get('ep_id');
    if (epid) {
        const epId = 'ep' + epid;
        result.epid = epid;
        result.id = epId;
        logSuccess('EP ID', epId, 'URL参数');
        return result;
    }

    // 5. 如果所有方法都无法获取ID，返回空字符串
    if (debugMode) {
        logDebug(`⚠️ 无法提取视频ID：已尝试所有已知格式，未找到匹配项`);
    }
    return result;
}

/**
 * 解析URL中的adskip参数
 * @returns {object} 解析结果对象，包含:
 *                   - type: string ("NO_PARAM", "NO_ADS_CONFIRMED", "HAS_ADS", "PARSE_ERROR")
 *                   - timestamps: Array (仅在 type 为 "HAS_ADS" 时有实际数据)
 */
function parseAdSkipParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const adskipParam = urlParams.get('adskip');

    if (!adskipParam) {
        logDebug('URL中没有adskip参数');
        return { type: "NO_PARAM", timestamps: [] };
    }

    if (adskipParam.toUpperCase() === 'NONE') {
        logDebug('URL参数adskip=NONE，确认为无广告');
        return { type: "NO_ADS_CONFIRMED", timestamps: [] };
    }

    try {
        const timestamps = adskipParam.split(',').map(segment => {
            const [start, end] = segment.split('-').map(Number);
            if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end) {
                throw new Error(`无效的时间段: ${segment}`);
            }
            return { start_time: start, end_time: end };
        });

        logDebug(`解析URL adskip参数成功:`, timestamps);
        return { type: "HAS_ADS", timestamps: timestamps };
    } catch (e) {
        console.error('--==--LOG: 解析adskip参数失败:', e);
        return { type: "PARSE_ERROR", timestamps: [] };
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
        logDebug(`使用缓存的视频播放器元素，缓存时间：${new Date(lastPlayerCheck).toLocaleTimeString()}，有效期内`, { throttle: 5000 });
        return cachedVideoPlayer;
    }

    // 重新查找播放器
    const selectors = [
        // '.bpx-player-video video', // 新版播放器-废弃
        // '.bilibili-player-video video', // 旧版播放器-废弃
        'video' // 最后尝试所有视频元素
    ];

    logDebug(`开始查找视频播放器元素，将尝试 ${selectors.length} 个选择器`);

    for (let i = 0; i < selectors.length; i++) {
        const player = document.querySelector(selectors[i]);
        if (player) {
            logDebug(`✅ 查找视频播放器成功，使用选择器 #${i+1}: ${selectors[i]}`);
            // 添加播放器信息到日志中
            try {
                const duration = player.duration || 0;
                const isPlaying = !player.paused;
                const volume = player.volume || 0;
                logDebug(`播放器信息：时长=${duration.toFixed(1)}秒，状态=${isPlaying ? '播放中' : '已暂停'}，音量=${Math.round(volume * 100)}%`);
            } catch (e) {
                logDebug(`获取播放器详情失败: ${e.message}`);
            }

            // 更新缓存和时间戳
            cachedVideoPlayer = player;
            lastPlayerCheck = now;
            return player;
        } else {
            logDebug(`❌ 选择器 #${i+1} 未找到匹配元素: ${selectors[i]}`);
        }
    }

    logDebug(`⚠️ 未找到视频播放器，已尝试所有 ${selectors.length} 个选择器`);
    cachedVideoPlayer = null;
    lastPlayerCheck = now;
    return null;
}

/**
 * 查找进度条容器，优化性能
 * @returns {HTMLElement|null} 进度条容器元素
 */
function findProgressBar() {
    // 如果缓存的进度条仍存在于DOM中且未过期，直接使用缓存
    const now = Date.now();
    if (cachedProgressBar && document.contains(cachedProgressBar) && now - lastProgressBarCheck < 5000) {
        logDebug(`使用缓存的进度条容器元素，缓存时间：${new Date(lastProgressBarCheck).toLocaleTimeString()}，有效期内`, { throttle: 5000 });
        return cachedProgressBar;
    }

    // 重新查找进度条
    const selectors = [
        '.bpx-player-progress-wrap', // 新版进度条
        // '.bilibili-player-video-progress-wrap', // 旧版进度条-废弃
        // '.squirtle-progress', // 番剧进度条-废弃
        // '.bpx-player-progress' // 番剧新版进度条-废弃
    ];

    logDebug(`开始查找进度条容器元素，将尝试 ${selectors.length} 个选择器`);

    for (let i = 0; i < selectors.length; i++) {
        const progressBar = document.querySelector(selectors[i]);
        if (progressBar) {
            logDebug(`✅ 查找进度条容器成功，使用选择器 #${i+1}: ${selectors[i]}`);
            // 尝试获取进度条宽度信息
            try {
                const width = progressBar.offsetWidth || 0;
                const rect = progressBar.getBoundingClientRect();
                logDebug(`进度条信息：宽度=${width}px，位置=左${Math.round(rect.left)}px, 上${Math.round(rect.top)}px`);
            } catch (e) {
                logDebug(`获取进度条详情失败: ${e.message}`);
            }

            // 更新缓存和时间戳
            cachedProgressBar = progressBar;
            lastProgressBarCheck = now;
            return progressBar;
        } else {
            logDebug(`❌ 选择器 #${i+1} 未找到匹配元素: ${selectors[i]}`);
        }
    }

    logDebug(`⚠️ 未找到进度条容器，已尝试所有 ${selectors.length} 个选择器`);
    cachedProgressBar = null;
    lastProgressBarCheck = now;
    return null;
}

/**
 * 屏蔽部分敏感信息，用于显示
 * @param {string} text 需要处理的文本
 * @returns {string} 处理后的文本
 */
function maskSensitiveInfo(text) {
    if (!text) return '';
    if (text.length <= 8) return '****';
    return text.substring(0, 4) + '****' + text.substring(text.length - 4);
}

/**
 * 获取东八区的今天日期（YYYY-MM-DD格式）
 * 统一时区处理，避免时区不一致导致的问题
 * @returns {string} 格式为YYYY-MM-DD的日期字符串
 */
function getTodayInEast8() {
    const now = new Date();
    // UTC+8:00，计算东八区时间
    const east8 = new Date(now.getTime() + (8 - now.getTimezoneOffset() / 60) * 60 * 60 * 1000);
    // 取东八区的年月日
    const year = east8.getUTCFullYear();
    const month = String(east8.getUTCMonth() + 1).padStart(2, '0');
    const day = String(east8.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 检查当前是否是多P视频的非第1P
 * @returns {boolean} 如果是多P视频的第2P或更高分P，返回true
 */
function isMultiPartVideoNonFirstPart() {
    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('p');
    return p && parseInt(p) > 1;
}

/**
 * 解析时间字符串，支持多种格式
 * @param {string} timeStr 时间字符串，支持格式：
 *   - 纯秒数：123
 *   - 分:秒：3:39
 *   - 时:分:秒：1:34:05
 * @returns {number} 转换后的秒数，如果解析失败返回 NaN
 */
function parseTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return NaN;
    }

    const trimmed = timeStr.trim();

    // 如果是纯数字，直接转换
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    // 如果包含冒号，按时分秒格式解析
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map(part => {
            const num = parseInt(part, 10);
            return isNaN(num) ? NaN : num;
        });

        // 检查是否有任何部分解析失败
        if (parts.some(part => isNaN(part))) {
            return NaN;
        }

        let totalSeconds = 0;

        if (parts.length === 2) {
            // MM:SS 格式
            const [minutes, seconds] = parts;
            if (minutes < 0 || seconds < 0 || seconds >= 60) {
                return NaN;
            }
            totalSeconds = minutes * 60 + seconds;
        } else if (parts.length === 3) {
            // HH:MM:SS 格式
            const [hours, minutes, seconds] = parts;
            if (hours < 0 || minutes < 0 || seconds < 0 || minutes >= 60 || seconds >= 60) {
                return NaN;
            }
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
        } else {
            // 不支持的格式
            return NaN;
        }

        return totalSeconds;
    }

    // 无法识别的格式
    return NaN;
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
    maskSensitiveInfo,
    isLogFiltered,
    getTodayInEast8,
    isMultiPartVideoNonFirstPart,
    parseTimeString
};