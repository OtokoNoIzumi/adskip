/**
 * storage.js - 存储模块
 * 处理所有与Chrome存储API相关的操作
 */

'use strict';

// 存储键名常量定义
const STORAGE_KEYS = {
    DEBUG_MODE: 'adskip_debug_mode',
    ENABLED: 'adskip_enabled',
    PERCENTAGE: 'adskip_percentage',
    ADMIN_AUTH: 'adskip_admin_authorized',
    UPLOADER_WHITELIST: 'adskip_uploader_whitelist',
    VIDEO_PREFIX: 'adskip_'
};

// 模块私有变量
let debugMode = false; // 私有变量，只在本模块内使用
let lastWhitelistHash = ''; // 白名单缓存哈希

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
            chrome.storage.local.get(`${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`, (result) => {
                const savedData = result[`${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`];
                if (!savedData) {
                    adskipUtils.logDebug(`没有找到视频 ${videoId} 的保存数据`);
                    resolve([]);
                    return;
                }

                const parsed = JSON.parse(savedData);
                adskipUtils.logDebug(`成功加载视频 ${videoId} 的广告时间段:`, parsed);

                // 直接使用timestamps数组
                const timestamps = parsed.timestamps || [];
                resolve(timestamps);
            });
        } catch (e) {
            console.error(`加载视频 ${videoId} 广告数据失败:`, e);
            resolve([]);
        }
    });
}

/**
 * 加载指定视频ID的广告时间戳，并检测URL时间戳污染
 * @param {string} videoId 视频ID
 * @param {Array} urlTimestamps URL中解析出的时间戳数组（可能被污染）
 * @returns {Promise<Object>} 结果对象，包含时间戳和是否污染的标志
 */
async function loadAndValidateTimestamps(videoId, urlTimestamps = []) {
    // 参数验证
    if (!videoId) {
        adskipUtils.logDebug('视频ID为空，无法加载和验证广告时间段');
        return { timestamps: [], fromUrl: false, isPolluted: false };
    }

    try {
        // 1. 加载当前视频的存储时间戳
        const savedTimestamps = await loadAdTimestampsForVideo(videoId);

        // 2. 如果没有URL时间戳，直接返回存储的时间戳
        if (!urlTimestamps || !Array.isArray(urlTimestamps) || urlTimestamps.length === 0) {
            adskipUtils.logDebug('没有URL时间戳参数，使用存储的时间戳');
            return {
                timestamps: savedTimestamps,
                fromUrl: false,
                isPolluted: false
            };
        }

        // 3. 获取所有存储的视频时间戳数据(除了当前视频和设置)
        const allItems = await new Promise(resolve => {
            chrome.storage.local.get(null, items => resolve(items));
        });

        // 4. 过滤出视频时间戳相关的键
        const allKeys = Object.keys(allItems);
        const videoKeys = allKeys.filter(key =>
            key.startsWith(STORAGE_KEYS.VIDEO_PREFIX) &&
            key !== `${STORAGE_KEYS.VIDEO_PREFIX}${videoId}` &&
            key !== STORAGE_KEYS.DEBUG_MODE &&
            key !== STORAGE_KEYS.ENABLED &&
            key !== STORAGE_KEYS.PERCENTAGE &&
            key !== STORAGE_KEYS.ADMIN_AUTH &&
            key !== STORAGE_KEYS.UPLOADER_WHITELIST
        );

        // 5. 检查URL时间戳是否与其他视频的时间戳匹配(污染检测)
        const urlTimeString = adskipUtils.timestampsToString(urlTimestamps);
        let isPolluted = false;
        let matchedVideoId = null;

        adskipUtils.logDebug(`检查URL参数 [${urlTimeString}] 是否与其他视频的广告时间戳匹配`, { throttle: 1000 });

        for (const key of videoKeys) {
            try {
                const data = allItems[key];
                const parsed = JSON.parse(data);
                const timestamps = parsed.timestamps || parsed;

                if (Array.isArray(timestamps) && timestamps.length > 0) {
                    const savedTimeString = adskipUtils.timestampsToString(timestamps);
                    if (urlTimeString === savedTimeString) {
                        isPolluted = true;
                        matchedVideoId = key.replace(STORAGE_KEYS.VIDEO_PREFIX, '');
                        adskipUtils.logDebug(`URL参数污染检测: 视频 ${matchedVideoId} 的时间戳与URL参数相同，判定为视频切换造成的污染`);
                        break;
                    }
                }
            } catch (e) {
                adskipUtils.logDebug(`解析存储数据失败: ${key}`, e);
            }
        }

        // 6. 根据检测结果返回适当的时间戳
        if (isPolluted) {
            adskipUtils.logDebug('URL时间戳已被污染，改用保存的时间戳');
            return {
                timestamps: savedTimestamps,
                fromUrl: false,
                isPolluted: true,
                pollutionSource: matchedVideoId
            };
        } else if (savedTimestamps.length > 0) {
            // 存在保存的时间戳，优先使用存储的
            adskipUtils.logDebug('URL时间戳未污染，但优先使用已保存的时间戳');
            return {
                timestamps: savedTimestamps,
                fromUrl: false,
                isPolluted: false
            };
        } else {
            // URL参数未污染，且没有保存的时间戳，使用URL参数
            adskipUtils.logDebug('使用URL时间戳参数（未污染且无保存数据）');
            return {
                timestamps: urlTimestamps,
                fromUrl: true,
                isPolluted: false
            };
        }

    } catch (e) {
        console.error(`处理视频 ${videoId} 广告数据验证失败:`, e);
        return { timestamps: [], fromUrl: false, isPolluted: false };
    }
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

    // 构建存储数据结构 - 优化版：仅保留必要的时间数据，移除无用的description字段
    const cleanedTimestamps = timestamps.map(ts => {
        // 只保留start_time和end_time字段
        const { start_time, end_time } = ts;
        return { start_time, end_time };
    });

    // 优化的数据结构
    const saveData = {
        videoInfo: {
            title: videoInfo.title,
            uploader: videoInfo.uploader
        },
        timestamps: cleanedTimestamps,
        savedAt: Date.now() // 添加时间戳记录保存时间
    };

    const jsonData = JSON.stringify(saveData);

    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [`${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`]: jsonData }, function() {
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
        chrome.storage.local.get(STORAGE_KEYS.PERCENTAGE, function(result) {
            let percentage = 5; // 默认值
            if (result[STORAGE_KEYS.PERCENTAGE] !== undefined) {
                percentage = result[STORAGE_KEYS.PERCENTAGE];
                adskipUtils.logDebug(`加载广告跳过百分比设置: ${percentage}%`);
            } else {
                // 如果没有保存的设置，保存默认设置
                chrome.storage.local.set({[STORAGE_KEYS.PERCENTAGE]: percentage});
                adskipUtils.logDebug(`设置默认广告跳过百分比: ${percentage}%`);
            }
            resolve(percentage);
        });
    });
}

/**
 * 保存广告跳过百分比设置
 * @param {number} percentage 百分比数值
 * @returns {Promise<number>} 保存的百分比值
 */
function saveAdSkipPercentage(percentage) {
    // 转为整数确保一致性
    percentage = parseInt(percentage, 10);

    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[STORAGE_KEYS.PERCENTAGE]: percentage}, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            adskipUtils.logDebug(`已保存广告跳过百分比设置: ${percentage}%`);
            resolve(percentage);
        });
    });
}

/**
 * 验证管理员身份
 * @param {string} apiKey API密钥
 * @returns {Promise<boolean>} 验证结果
 */
function verifyAdminAccess(apiKey) {
    // 这是一个简单的哈希检查，您可以替换为更安全的方法
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

    return new Promise((resolve) => {
        if (isValid) {
            // 将授权状态保存在chrome.storage.local中
            chrome.storage.local.set({[STORAGE_KEYS.ADMIN_AUTH]: true}, function() {
                adskipUtils.logDebug('管理员授权已保存到存储中');
                resolve(true);
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * 检查管理员权限
 * @returns {Promise<boolean>} 是否有管理员权限
 */
async function checkAdminStatus() {
    return new Promise((resolve) => {
        // 从chrome.storage.local中获取授权状态
        chrome.storage.local.get(STORAGE_KEYS.ADMIN_AUTH, function(result) {
            resolve(result[STORAGE_KEYS.ADMIN_AUTH] === true);
        });
    });
}

/**
 * 初始化调试模式
 * @returns {Promise<boolean>} 调试模式状态
 */
function initDebugMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.DEBUG_MODE, (result) => {
            debugMode = result[STORAGE_KEYS.DEBUG_MODE] || false;
            if (debugMode) {
                adskipUtils.logDebug('调试模式已启用');
            }

            // 更新所有页面的调试模式开关状态
            updateDebugModeToggle();
            resolve(debugMode);
        });
    });
}

/**
 * 获取调试模式状态
 * @returns {boolean} 调试模式状态
 */
function getDebugMode() {
    return debugMode;
}

/**
 * 设置调试模式状态
 * @param {boolean} newValue 新的调试模式状态
 * @returns {Promise<boolean>} 设置后的调试模式状态
 */
function setDebugMode(newValue) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[STORAGE_KEYS.DEBUG_MODE]: newValue}, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            debugMode = newValue;
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

    // 同时更新选项页面中的调试模式开关
    const optionsDebugToggle = document.getElementById('debug-mode');
    if (optionsDebugToggle) {
        optionsDebugToggle.checked = debugMode;
    }
}

/**
 * 加载UP主白名单列表
 * @returns {Promise<Array>} UP主白名单数组
 */
function loadUploaderWhitelist() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.UPLOADER_WHITELIST, (result) => {
            if (result[STORAGE_KEYS.UPLOADER_WHITELIST]) {
                try {
                    const whitelist = JSON.parse(result[STORAGE_KEYS.UPLOADER_WHITELIST]);

                    // 计算当前白名单的哈希值（简单方法：长度+第一项名称）
                    const simpleHash = `${whitelist.length}_${whitelist.length > 0 ? (typeof whitelist[0] === 'string' ? whitelist[0] : whitelist[0]?.name || '') : ''}`;

                    // 只有当白名单内容变化时才输出日志
                    if (simpleHash !== lastWhitelistHash) {
                        adskipUtils.logDebug('已加载UP主白名单', { data: whitelist, throttle: 5000 }); // 使用新的配置对象格式
                        lastWhitelistHash = simpleHash;
                    }

                    resolve(whitelist);
                } catch (e) {
                    console.error('解析UP主白名单失败', e);
                    resolve([]);
                }
            } else {
                // 同样使用节流，避免反复输出"未找到白名单"
                if (lastWhitelistHash !== 'empty') {
                    adskipUtils.logDebug('未找到UP主白名单，返回空列表', { throttle: 5000 }); // 使用新的配置对象格式
                    lastWhitelistHash = 'empty';
                }
                resolve([]);
            }
        });
    });
}

/**
 * 保存UP主白名单列表
 * @param {Array} whitelist UP主白名单数组
 * @returns {Promise<Array>} 保存的白名单数组
 */
function saveUploaderWhitelist(whitelist) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(whitelist)) {
            reject(new Error('白名单必须是数组'));
            return;
        }

        // 确保白名单中的项目格式统一
        const formattedWhitelist = whitelist.map(item => {
            if (typeof item === 'string') {
                return {
                    name: item,
                    addedAt: item.addedAt || Date.now(),
                    enabled: item.enabled !== undefined ? item.enabled : true
                };
            }
            return {
                ...item,
                addedAt: item.addedAt || Date.now(),
                enabled: item.enabled !== undefined ? item.enabled : true
            };
        });

        chrome.storage.local.set({ [STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(formattedWhitelist) }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                // 只在调试模式下输出详细白名单内容
                const logData = debugMode ? formattedWhitelist : { length: formattedWhitelist.length };
                adskipUtils.logDebug('已保存UP主白名单', logData);
                resolve(formattedWhitelist);
            }
        });
    });
}

/**
 * 检查UP主是否在白名单中
 * @param {string} uploaderName UP主名称
 * @returns {Promise<boolean>} 是否在白名单中且启用
 */
async function checkUploaderInWhitelist(uploaderName) {
    if (!uploaderName) return false;

    const whitelist = await loadUploaderWhitelist();
    const match = whitelist.find(item =>
        (typeof item === 'string' && item === uploaderName) ||
        (item.name === uploaderName && item.enabled !== false)
    );

    return !!match;
}

/**
 * 将UP主添加到白名单 - 完善事件发送机制
 * @param {string} uploader UP主名称
 */
async function addUploaderToWhitelist(uploader) {
    if (!uploader) return Promise.reject(new Error('UP主名称不能为空'));

    try {
        const whitelist = await loadUploaderWhitelist();
        // 检查是否已存在
        const existingIndex = whitelist.findIndex(item =>
            (typeof item === 'string' && item === uploader) ||
            (typeof item === 'object' && item.name === uploader)
        );

        if (existingIndex >= 0) {
            // 如果已存在但可能被禁用，确保启用
            if (typeof whitelist[existingIndex] === 'object') {
                whitelist[existingIndex].enabled = true;
            }
            // 已存在且为字符串形式或已启用，无需修改
        } else {
            // 添加新条目，使用完整对象格式
            whitelist.push({
                name: uploader,
                addedAt: Date.now(),
                enabled: true
            });
        }

        // 保存更新后的白名单
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({[STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(whitelist)}, function() {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // 更精简的日志
                    adskipUtils.logDebug(`已将UP主 "${uploader}" 添加到白名单`);
                    resolve();
                }
            });
        });

        return whitelist;
    } catch (error) {
        console.error('添加UP主到白名单失败:', error);
        throw error;
    }
}

/**
 * 禁用白名单中的UP主 - 确保触发事件
 * @param {string} uploader UP主名称
 */
async function disableUploaderInWhitelist(uploader) {
    if (!uploader) return Promise.reject(new Error('UP主名称不能为空'));

    try {
        const whitelist = await loadUploaderWhitelist();
        let modified = false;

        // 查找并禁用
        for (let i = 0; i < whitelist.length; i++) {
            const item = whitelist[i];
            if ((typeof item === 'string' && item === uploader) ||
                (typeof item === 'object' && item.name === uploader)) {
                // 转换为对象形式并禁用
                if (typeof item === 'string') {
                    whitelist[i] = {
                        name: uploader,
                        addedAt: Date.now(),
                        enabled: false
                    };
                } else {
                    whitelist[i].enabled = false;
                }
                modified = true;
                break;
            }
        }

        if (modified) {
            // 保存更新后的白名单并确保触发事件
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({[STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(whitelist)}, function() {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        adskipUtils.logDebug(`已禁用白名单中的UP主 "${uploader}"`);
                        resolve();
                    }
                });
            });
        }

        return whitelist;
    } catch (error) {
        console.error('禁用白名单UP主失败:', error);
        throw error;
    }
}

/**
 * 启用白名单中的UP主 - 确保触发事件
 * @param {string} uploader UP主名称
 */
async function enableUploaderInWhitelist(uploader) {
    if (!uploader) return Promise.reject(new Error('UP主名称不能为空'));

    try {
        const whitelist = await loadUploaderWhitelist();
        let modified = false;

        // 查找并启用
        for (let i = 0; i < whitelist.length; i++) {
            const item = whitelist[i];
            if ((typeof item === 'string' && item === uploader) ||
                (typeof item === 'object' && item.name === uploader)) {
                // 如果是字符串形式，已默认启用
                if (typeof item === 'object') {
                    whitelist[i].enabled = true;
                    modified = true;
                }
                break;
            }
        }

        if (modified) {
            // 保存更新后的白名单并确保触发事件
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({[STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(whitelist)}, function() {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        adskipUtils.logDebug(`已启用白名单中的UP主 "${uploader}"`);
                        resolve();
                    }
                });
            });
        }

        return whitelist;
    } catch (error) {
        console.error('启用白名单UP主失败:', error);
        throw error;
    }
}

/**
 * 从白名单移除UP主 - 确保触发事件
 * @param {string} uploader UP主名称
 */
async function removeUploaderFromWhitelist(uploader) {
    if (!uploader) return Promise.reject(new Error('UP主名称不能为空'));

    try {
        const whitelist = await loadUploaderWhitelist();
        const initialLength = whitelist.length;

        // 过滤掉要移除的UP主
        const newWhitelist = whitelist.filter(item =>
            !(typeof item === 'string' && item === uploader) &&
            !(typeof item === 'object' && item.name === uploader)
        );

        if (newWhitelist.length < initialLength) {
            // 保存更新后的白名单并确保触发事件
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({[STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(newWhitelist)}, function() {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        adskipUtils.logDebug(`已从白名单移除UP主 "${uploader}"`);
                        resolve();
                    }
                });
            });
        }

        return newWhitelist;
    } catch (error) {
        console.error('从白名单移除UP主失败:', error);
        throw error;
    }
}

/**
 * 批量导入UP主白名单
 * @param {string} whitelistText 以逗号或换行分隔的UP主名称列表
 * @returns {Promise<Array>} 更新后的白名单
 */
async function importUploaderWhitelist(whitelistText) {
    if (!whitelistText) {
        return Promise.reject(new Error('导入内容不能为空'));
    }

    // 分割文本为UP主名称数组（支持逗号或换行分隔）
    const uploaderNames = whitelistText
        .split(/[,\n]/)
        .map(name => name.trim())
        .filter(name => name.length > 0);

    if (uploaderNames.length === 0) {
        return Promise.reject(new Error('未找到有效的UP主名称'));
    }

    const currentWhitelist = await loadUploaderWhitelist();

    // 合并现有白名单和新导入的UP主
    const newWhitelist = [...currentWhitelist];

    uploaderNames.forEach(name => {
        // 检查是否已存在
        const existingIndex = newWhitelist.findIndex(item =>
            (typeof item === 'string' && item === name) ||
            (item.name === name)
        );

        if (existingIndex >= 0) {
            // 如果存在但被禁用，则重新启用
            if (typeof newWhitelist[existingIndex] !== 'string' && newWhitelist[existingIndex].enabled === false) {
                newWhitelist[existingIndex].enabled = true;
            }
        } else {
            // 添加新UP主
            newWhitelist.push({
                name: name,
                addedAt: Date.now(),
                enabled: true
            });
        }
    });

    adskipUtils.logDebug(`已导入${uploaderNames.length}个UP主到白名单`);
    return saveUploaderWhitelist(newWhitelist);
}

/**
 * 导出UP主白名单为文本
 * @returns {Promise<string>} 导出的白名单文本
 */
async function exportUploaderWhitelist() {
    const whitelist = await loadUploaderWhitelist();

    // 将白名单转换为文本（仅包含启用的UP主）
    const whitelistText = whitelist
        .filter(item =>
            typeof item === 'string' ||
            item.enabled !== false
        )
        .map(item => typeof item === 'string' ? item : item.name)
        .join('\n');

    adskipUtils.logDebug('已导出UP主白名单');
    return whitelistText;
}

/**
 * 获取当前视频UP主信息
 * @returns {Promise<Object>} UP主信息对象
 */
function getCurrentVideoUploader() {
    return new Promise((resolve) => {
        try {
            // 从页面中提取视频标题
            const titleElement = document.querySelector('.video-title, .tit, h1.title');
            const title = titleElement ? titleElement.textContent.trim() : '未知视频';

            // 从页面中提取UP主名称
            const upElement = document.querySelector('.up-name, .name .username, a.up-name');
            const uploader = upElement ? upElement.textContent.trim() : '未知UP主';

            resolve({ title, uploader });
        } catch (e) {
            adskipUtils.logDebug('提取视频信息失败', e);
            resolve({ title: '未知视频', uploader: '未知UP主' });
        }
    });
}

/**
 * 切换UP主在白名单中的启用状态
 * @param {string} uploaderName UP主名称
 * @param {boolean} enabled 是否启用
 * @returns {Promise<Array>} 更新后的白名单
 */
async function toggleUploaderWhitelistStatus(uploaderName, enabled) {
    if (!uploaderName) {
        return Promise.reject(new Error('UP主名称不能为空'));
    }

    try {
        const whitelist = await loadUploaderWhitelist();

        const index = whitelist.findIndex(item =>
            (typeof item === 'string' && item === uploaderName) ||
            (typeof item === 'object' && item.name === uploaderName)
        );

        if (index >= 0) {
            // 如果是字符串形式，转换为对象
            if (typeof whitelist[index] === 'string') {
                whitelist[index] = {
                    name: whitelist[index],
                    addedAt: Date.now(),
                    enabled: enabled
                };
            } else {
                whitelist[index].enabled = enabled;
            }
            adskipUtils.logDebug(`已${enabled ? '启用' : '禁用'}白名单UP主: ${uploaderName}`);
        } else if (enabled) {
            // 如果不存在且需要启用，则添加
            whitelist.push({
                name: uploaderName,
                addedAt: Date.now(),
                enabled: true
            });
            adskipUtils.logDebug(`已添加并启用白名单UP主: ${uploaderName}`);
        }

        // 保存白名单
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({[STORAGE_KEYS.UPLOADER_WHITELIST]: JSON.stringify(whitelist)}, function() {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(whitelist);
                }
            });
        });
    } catch (error) {
        console.error('切换白名单状态失败:', error);
        throw error;
    }
}

/**
 * 获取功能开关状态
 * @returns {Promise<boolean>} 功能是否启用
 */
function getEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.ENABLED, function(result) {
            // 默认为启用状态
            resolve(result[STORAGE_KEYS.ENABLED] !== false);
        });
    });
}

/**
 * 设置功能开关状态
 * @param {boolean} enabled 是否启用
 * @returns {Promise<boolean>} 设置后的状态
 */
function setEnabled(enabled) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[STORAGE_KEYS.ENABLED]: enabled}, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            adskipUtils.logDebug(`已${enabled ? '启用' : '禁用'}广告跳过功能`);
            resolve(enabled);
        });
    });
}

// 导出模块接口
window.adskipStorage = {
    // 存储键常量
    KEYS: STORAGE_KEYS,

    // 广告时间戳管理
    loadAdTimestampsForVideo,
    saveAdTimestampsForVideo,
    loadAndValidateTimestamps,

    // 百分比设置
    loadAdSkipPercentage,
    saveAdSkipPercentage,

    // 管理员权限
    verifyAdminAccess,
    checkAdminStatus,

    // 调试模式
    initDebugMode,
    getDebugMode,
    setDebugMode,
    updateDebugModeToggle,

    // UP主白名单管理
    loadUploaderWhitelist,
    saveUploaderWhitelist,
    checkUploaderInWhitelist,
    addUploaderToWhitelist,
    disableUploaderInWhitelist,
    enableUploaderInWhitelist,
    removeUploaderFromWhitelist,
    importUploaderWhitelist,
    exportUploaderWhitelist,
    getCurrentVideoUploader,
    toggleUploaderWhitelistStatus,

    // 功能开关状态
    getEnabled,
    setEnabled
};