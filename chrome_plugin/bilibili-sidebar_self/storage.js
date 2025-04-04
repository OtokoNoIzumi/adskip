/**
 * storage.js - 存储模块
 * 处理所有与Chrome存储API相关的操作
 */

'use strict';

// 存储键名常量定义
const STORAGE_KEYS = {
    PREFIX: 'adskip_',
    DEBUG_MODE: 'adskip_debug_mode',
    ENABLED: 'adskip_enabled',
    PERCENTAGE: 'adskip_percentage',
    ADMIN_AUTH: 'adskip_admin_authorized',
    UPLOADER_WHITELIST: 'adskip_uploader_whitelist',
    VIDEO_PREFIX: 'adskip_',
    VIDEO_WHITELIST: 'adskip_video_whitelist',

    // 分类集合，用于过滤操作
    CONFIG_KEYS: [
        'adskip_debug_mode',
        'adskip_enabled',
        'adskip_percentage',
        'adskip_admin_authorized'
    ],
    WHITELIST_KEYS: [
        'adskip_uploader_whitelist'
    ],
    // 所有保留的键（不会被数据清除操作删除的键）
    RESERVED_KEYS: function() {
        return [...this.CONFIG_KEYS, ...this.WHITELIST_KEYS, this.VIDEO_WHITELIST];
    }
};

// 模块私有变量
let debugMode = false; // 私有变量，只在本模块内使用
let lastWhitelistHash = ''; // 白名单缓存哈希

// 添加UP主信息缓存变量
let cachedUploaderInfo = null;
let lastUploaderCheck = 0;

/**
 * 获取所有管理员重置相关的键（排除配置键和白名单键）
 * @returns {Promise<Array>} 过滤后的键名数组
 */
function getAdminResetKeys() {
    return getAllKeys().then(allKeys => {
        return allKeys.filter(
            key => key !== adskipStorage.KEYS.ADMIN_AUTH &&
            key !== adskipStorage.KEYS.VIDEO_WHITELIST
        );
    });
}


/**
 * 获取所有视频数据相关的键（排除配置键和白名单键）
 * @returns {Promise<Array>} 过滤后的键名数组
 */
async function getVideoDataKeys() {
    adskipUtils.logDebug('开始获取所有视频数据键');

    try {
        return new Promise(resolve => {
            chrome.storage.local.get(null, allData => {
                if (chrome.runtime.lastError) {
                    adskipUtils.logDebug(`获取所有存储键失败: ${chrome.runtime.lastError.message}`);
                    resolve([]);
                    return;
                }

                // 过滤出视频数据键（以STORAGE_KEYS.VIDEO_PREFIX开头）
                const allKeys = Object.keys(allData || {});
                const videoPrefix = STORAGE_KEYS.VIDEO_PREFIX;
                const videoKeys = allKeys.filter(key =>
                    key.startsWith(videoPrefix) &&
                    !STORAGE_KEYS.RESERVED_KEYS().includes(key)
                );

                adskipUtils.logDebug(`找到 ${allKeys.length} 个存储键，其中 ${videoKeys.length} 个是视频数据键`);

                if (videoKeys.length > 0) {
                    adskipUtils.logDebug(`视频数据键示例: ${videoKeys.slice(0, 3).join(', ')}${videoKeys.length > 3 ? '...' : ''}`);
                }

                resolve(videoKeys);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`获取视频数据键时发生异常: ${e.message}`);
        console.error('获取视频数据键时发生异常:', e);
        return [];
    }
}

/**
 * 获取所有配置相关的键
 * @returns {Promise<Array>} 配置键名数组
 */
function getConfigKeys() {
    return Promise.resolve([...STORAGE_KEYS.CONFIG_KEYS]);
}

/**
 * 获取所有白名单相关的键
 * @returns {Promise<Array>} 白名单键名数组
 */
function getWhitelistKeys() {
    return Promise.resolve([...STORAGE_KEYS.WHITELIST_KEYS]);
}

/**
 * 获取所有保留的键（不会被清除的键）
 * @returns {Promise<Array>} 保留键名数组
 */
function getReservedKeys() {
    return Promise.resolve(STORAGE_KEYS.RESERVED_KEYS());
}

/**
 * 清空所有视频数据（广告时间戳）
 * @returns {Promise<boolean>} 是否成功清空数据
 */
async function clearAllVideoData() {
    try {
        adskipUtils.logDebug('开始清空所有视频广告时间戳数据');

        // 获取所有与视频相关的键
        const videoKeys = await getVideoDataKeys();
        const keyCount = videoKeys.length;

        adskipUtils.logDebug(`找到 ${keyCount} 个视频数据键需要清除`);

        if (keyCount === 0) {
            adskipUtils.logDebug('没有找到视频数据，无需清除');
            return true;
        }

        // 执行清空操作
        return new Promise(resolve => {
            chrome.storage.local.remove(videoKeys, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug(`成功清除 ${keyCount} 个视频的广告时间戳数据`);
                } else {
                    adskipUtils.logDebug(`清除视频数据失败: ${chrome.runtime.lastError?.message || '未知错误'}`);
                    console.error('清除视频数据失败:', chrome.runtime.lastError);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`清除视频数据时发生异常: ${e.message}`);
        console.error('清除视频数据时发生异常:', e);
        return false;
    }
}

/**
 * 加载指定视频ID的广告时间戳
 * @param {string} videoId 视频ID
 * @returns {Promise<Array>} 广告时间戳数组
 */
function loadAdTimestampsForVideo(videoId) {
    adskipUtils.logDebug(`尝试加载视频 ${videoId} 的广告时间戳`);

    return new Promise((resolve) => {
        if (!videoId) {
            adskipUtils.logDebug('视频ID为空，无法加载广告时间段');
            resolve([]);
            return;
        }

        try {
            const storageKey = `${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`;
            adskipUtils.logDebug(`查询存储键: ${storageKey}`);

            chrome.storage.local.get(storageKey, (result) => {
                const savedData = result[storageKey];
                if (!savedData) {
                    adskipUtils.logDebug(`没有找到视频 ${videoId} 的保存数据`);
                    resolve([]);
                    return;
                }

                try {
                    const parsed = JSON.parse(savedData);
                    const hasTimestamps = parsed.timestamps && Array.isArray(parsed.timestamps);
                    adskipUtils.logDebug(`成功加载视频 ${videoId} 的广告时间段，包含 ${hasTimestamps ? parsed.timestamps.length : 0} 个时间段`,
                        hasTimestamps ? parsed.timestamps : null);

                    // 直接使用timestamps数组
                    const timestamps = parsed.timestamps || [];
                    resolve(timestamps);
                } catch (parseError) {
                    adskipUtils.logDebug(`解析视频 ${videoId} 数据时出错: ${parseError.message}`);
                    resolve([]);
                }
            });
        } catch (e) {
            adskipUtils.logDebug(`加载视频 ${videoId} 广告数据失败: ${e.message}`);
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

    adskipUtils.logDebug(`开始加载和验证广告时间戳 - 视频ID: ${videoId}, URL参数数量: ${urlTimestamps?.length || 0}`);

    try {
        // 1. 加载当前视频的存储时间戳
        const savedTimestamps = await loadAdTimestampsForVideo(videoId);
        adskipUtils.logDebug(`当前视频已存储的时间戳数量: ${savedTimestamps.length}`);

        // 2. 如果没有URL时间戳，直接返回存储的时间戳
        if (!urlTimestamps || !Array.isArray(urlTimestamps) || urlTimestamps.length === 0) {
            adskipUtils.logDebug('没有URL时间戳参数，使用存储的时间戳');
            return {
                timestamps: savedTimestamps,
                fromUrl: false,
                isPolluted: false
            };
        }

        // 3. 获取所有视频相关的键（排除当前视频和所有设置/白名单键）
        const videoKeys = await getVideoDataKeys();
        // 过滤掉当前视频
        const otherVideoKeys = videoKeys.filter(key =>
            key !== `${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`
        );

        adskipUtils.logDebug(`找到 ${otherVideoKeys.length} 个其他视频的数据用于污染检测`);

        // 4. 如果没有其他视频数据，不需要进行污染检测
        if (otherVideoKeys.length === 0) {
            adskipUtils.logDebug('没有其他视频数据，使用URL时间戳');
            return {
                timestamps: urlTimestamps,
                fromUrl: true,
                isPolluted: false
            };
        }

        // 5. 获取其他视频的数据进行比对
        adskipUtils.logDebug('开始获取其他视频数据进行污染检测');
        const allItems = await new Promise(resolve => {
            chrome.storage.local.get(otherVideoKeys, items => resolve(items));
        });

        // 6. 检查URL时间戳是否与其他视频的时间戳匹配(污染检测)
        const urlTimeString = adskipUtils.timestampsToString(urlTimestamps);
        let isPolluted = false;
        let matchedVideoId = null;

        adskipUtils.logDebug(`检查URL参数 [${urlTimeString}] 是否与其他视频的广告时间戳匹配`);

        let checkCount = 0;
        for (const key of otherVideoKeys) {
            checkCount++;
            try {
                const data = allItems[key];
                if (!data) {
                    adskipUtils.logDebug(`视频键 ${key} 没有数据，跳过`);
                    continue;
                }

                const parsed = JSON.parse(data);
                const timestamps = parsed.timestamps || parsed;

                if (Array.isArray(timestamps) && timestamps.length > 0) {
                    const savedTimeString = adskipUtils.timestampsToString(timestamps);
                    adskipUtils.logDebug(`比对视频 #${checkCount}: ${key.replace(STORAGE_KEYS.VIDEO_PREFIX, '')}, 时间戳字符串: ${savedTimeString}`);

                    if (urlTimeString === savedTimeString) {
                        isPolluted = true;
                        matchedVideoId = key.replace(STORAGE_KEYS.VIDEO_PREFIX, '');
                        adskipUtils.logDebug(`URL参数污染检测: 视频 ${matchedVideoId} 的时间戳与URL参数相同，判定为视频切换造成的污染!`);
                        break;
                    }
                } else {
                    adskipUtils.logDebug(`视频 ${key.replace(STORAGE_KEYS.VIDEO_PREFIX, '')} 没有有效的时间戳数据`);
                }
            } catch (e) {
                adskipUtils.logDebug(`解析存储数据失败: ${key}: ${e.message}`);
            }
        }

        // 7. 根据检测结果返回适当的时间戳
        if (isPolluted) {
            adskipUtils.logDebug('URL时间戳已被污染，改用保存的时间戳');
            return {
                timestamps: savedTimestamps,
                fromUrl: false,
                isPolluted: true,
                pollutionSource: matchedVideoId
            };
        } else {
            // URL参数未污染，使用URL参数
            adskipUtils.logDebug('使用URL时间戳参数（未污染）');
            return {
                timestamps: urlTimestamps,
                fromUrl: true,
                isPolluted: false
            };
        }

    } catch (e) {
        adskipUtils.logDebug(`处理视频 ${videoId} 广告数据验证失败: ${e.message}`);
        console.error(`处理视频 ${videoId} 广告数据验证失败:`, e);
        return { timestamps: [], fromUrl: false, isPolluted: false };
    }
}

/**
 * 保存视频广告时间段
 * @param {string} videoId 视频ID
 * @param {Array} timestamps 时间戳数组
 * @returns {Promise<boolean>} 保存是否成功
 */
function saveAdTimestampsForVideo(videoId, timestamps) {
    if (!videoId) {
        adskipUtils.logDebug('视频ID为空，无法保存广告时间段');
        return Promise.resolve(false);
    }

    if (!timestamps || !Array.isArray(timestamps)) {
        adskipUtils.logDebug(`保存失败：时间戳无效或不是数组 (${typeof timestamps})`);
        return Promise.resolve(false);
    }

    adskipUtils.logDebug(`准备保存 ${timestamps.length} 个广告时间段到视频 ${videoId}`);

    return new Promise(async resolve => {
        try {
            const key = `${STORAGE_KEYS.VIDEO_PREFIX}${videoId}`;
            adskipUtils.logDebug(`使用存储键: ${key}`);

            // 使用getCurrentVideoUploader代替getVideoMeta
            const videoMeta = await getCurrentVideoUploader();

            const data = JSON.stringify({
                videoInfo: videoMeta,
                timestamps: timestamps,
                savedAt: new Date().toISOString()
            });

            const saveObj = {};
            saveObj[key] = data;

            chrome.storage.local.set(saveObj, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug(`成功保存广告时间段：${timestamps.length} 条时间戳已保存到视频 ${videoId}`);
                } else {
                    adskipUtils.logDebug(`保存广告时间段失败: ${chrome.runtime.lastError?.message || '未知错误'}`);
                    console.error('保存广告时间段失败:', chrome.runtime.lastError);
                }
                resolve(success);
            });
        } catch (e) {
            adskipUtils.logDebug(`保存广告时间段时发生异常: ${e.message}`);
            console.error('保存广告时间段时发生异常:', e);
            resolve(false);
        }
    });
}

/**
 * 加载广告跳过百分比配置
 * @returns {Promise<number>} 广告跳过百分比，默认为50
 */
async function loadAdSkipPercentage() {
    adskipUtils.logDebug('开始加载广告跳过百分比配置');

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.PERCENTAGE, data => {
            // Chrome API错误是唯一必须处理的异常情况
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`加载广告跳过百分比配置失败: ${chrome.runtime.lastError.message}，使用默认值 50%`);
                resolve(50);
                return;
            }

            const percent = parseInt(data[STORAGE_KEYS.PERCENTAGE], 10);

            // 简单的有效性检查，几乎不会触发，但作为最后保障
            if (isNaN(percent) || percent < 0 || percent > 100) {
                adskipUtils.logDebug(`配置值无效或未设置，使用默认值 50%`);
                resolve(50);
            } else {
                adskipUtils.logDebug(`已加载广告跳过百分比配置: ${percent}%`);
                resolve(percent);
            }
        });
    });
}

/**
 * 保存广告跳过百分比配置
 * @param {number} percentage 广告跳过百分比
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveAdSkipPercentage(percentage) {
    // 简单转换，UI层已经确保了值的有效性
    const percent = parseInt(percentage, 10) || 50; // 无效时使用默认值

    adskipUtils.logDebug(`准备保存广告跳过百分比配置: ${percent}%`);

    return new Promise(resolve => {
        const saveObj = {};
        saveObj[STORAGE_KEYS.PERCENTAGE] = percent;

        chrome.storage.local.set(saveObj, () => {
            // 只有Chrome API错误需要处理
            const success = !chrome.runtime.lastError;
            if (success) {
                adskipUtils.logDebug(`成功保存广告跳过百分比配置: ${percent}%`);
            } else {
                adskipUtils.logDebug(`保存失败: ${chrome.runtime.lastError?.message || '未知错误'}`);
            }
            resolve(success);
        });
    });
}

/**
 * 验证管理员访问权限
 * @param {string} apiKey API密钥
 * @returns {Promise<boolean>} 验证是否通过
 */
async function verifyAdminAccess(apiKey) {
    if (!apiKey) {
        adskipUtils.logDebug('API密钥为空，管理员验证失败');
        return false;
    }

    adskipUtils.logDebug('开始验证管理员权限');

    // 简单的哈希检查
    const validKeyHash = '12d9853b'; // 对应 'adskip521' 的哈希值
    const inputHash = simpleHash(apiKey);
    const isValid = (inputHash === validKeyHash);

    adskipUtils.logDebug(`管理员验证结果: ${isValid ? '通过' : '失败'}`);

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
 * 简单的字符串哈希函数
 * @param {string} str 需要哈希的字符串
 * @returns {string} 哈希结果
 */
function simpleHash(str) {
    if (!str) return '0';

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16).substring(0, 26);
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
                    const simpleHash = `${whitelist.length}_${whitelist.length > 0 ? (whitelist[0]?.name || '') : ''}`;

                    // 只有当白名单内容变化时才输出日志
                    if (simpleHash !== lastWhitelistHash) {
                        adskipUtils.logDebug('已加载UP主白名单', { data: whitelist, throttle: 5000 });
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
                    adskipUtils.logDebug('未找到UP主白名单，返回空列表', { throttle: 5000 });
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
    const match = whitelist.find(item => item.name === uploaderName && item.enabled !== false);

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
        const existingIndex = whitelist.findIndex(item => item.name === uploader);

        if (existingIndex >= 0) {
            // 如果已存在但可能被禁用，确保启用
            whitelist[existingIndex].enabled = true;
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
            if (item.name === uploader) {
                whitelist[i].enabled = false;
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
            if (item.name === uploader) {
                whitelist[i].enabled = true;
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
        const newWhitelist = whitelist.filter(item => item.name !== uploader);

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
            item.name === name
        );

        if (existingIndex >= 0) {
            // 如果存在但被禁用，则重新启用
            if (newWhitelist[existingIndex].enabled === false) {
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
        .filter(item => item.enabled !== false)
        .map(item => item.name)
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
            // 检查缓存是否有效（30秒内有效）
            const now = Date.now();
            if (cachedUploaderInfo && now - lastUploaderCheck < 30000) {
                adskipUtils.logDebug('使用缓存的UP主信息', { throttle: 30000 });
                return resolve(cachedUploaderInfo);
            }

            // 定义标题选择器数组，按优先级排序
            const titleSelectors = [
                '.video-title',  // 优先尝试最特定的选择器
                // '.tit',
                // 'h1.title'
            ];

            // 定义UP主选择器数组，按优先级排序
            const uploaderSelectors = [
                '.up-name',
                // '.name .username',
                // 'a.up-name'
            ];

            // 查找标题元素，逐个尝试选择器
            let titleElement = null;
            for (let i = 0; i < titleSelectors.length; i++) {
                titleElement = document.querySelector(titleSelectors[i]);
                if (titleElement) {
                    adskipUtils.logDebug(`找到标题元素，使用选择器：${titleSelectors[i]}`, { throttle: 10000 });
                    break; // 找到后立即停止搜索
                }
            }

            // 查找UP主元素，逐个尝试选择器
            let upElement = null;
            for (let i = 0; i < uploaderSelectors.length; i++) {
                upElement = document.querySelector(uploaderSelectors[i]);
                if (upElement) {
                    adskipUtils.logDebug(`找到UP主元素，使用选择器：${uploaderSelectors[i]}`, { throttle: 10000 });
                    break; // 找到后立即停止搜索
                }
            }

            // 提取信息
            const title = titleElement ? titleElement.textContent.trim() : '未知视频';
            const uploader = upElement ? upElement.textContent.trim() : '未知UP主';

            // 更新缓存和时间戳
            const info = { title, uploader };
            cachedUploaderInfo = info;
            lastUploaderCheck = now;

            adskipUtils.logDebug(`已更新UP主信息缓存: ${uploader} / ${title}`, { throttle: 5000 });
            resolve(info);
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

        const index = whitelist.findIndex(item => item.name === uploaderName);

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

/**
 * 获取存储中的所有键名
 * @returns {Promise<Array>} 所有键名数组
 */
function getAllKeys() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, function(items) {
            resolve(Object.keys(items));
        });
    });
}

/**
 * 移除指定的键
 * @param {Array} keys 要移除的键数组
 * @returns {Promise<void>}
 */
function removeKeys(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            adskipUtils.logDebug(`已移除 ${keys.length} 个存储键`);
            resolve();
        });
    });
}

/**
 * 加载视频ID白名单
 * @returns {Promise<Array>} 视频ID白名单数组
 */
function loadVideoWhitelist() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.VIDEO_WHITELIST, (result) => {
            if (result[STORAGE_KEYS.VIDEO_WHITELIST]) {
                try {
                    const whitelist = JSON.parse(result[STORAGE_KEYS.VIDEO_WHITELIST]);
                    adskipUtils.logDebug('已加载视频白名单', { data: whitelist, throttle: 5000 });
                    resolve(whitelist);
                } catch (e) {
                    console.error('解析视频白名单失败', e);
                    resolve([]);
                }
            } else {
                adskipUtils.logDebug('未找到视频白名单，返回空列表', { throttle: 5000 });
                resolve([]);
            }
        });
    });
}

/**
 * 保存视频ID白名单
 * @param {Array} whitelist 视频ID白名单数组
 * @returns {Promise<Array>} 保存的白名单数组
 */
function saveVideoWhitelist(whitelist) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(whitelist)) {
            reject(new Error('视频白名单必须是数组'));
            return;
        }

        // 确保白名单中的项目格式统一
        const formattedWhitelist = whitelist.map(item => {
            if (typeof item === 'string') {
                return {
                    bvid: item,
                    addedAt: Date.now()
                };
            }
            return {
                ...item,
                addedAt: item.addedAt || Date.now()
            };
        });

        chrome.storage.local.set({ [STORAGE_KEYS.VIDEO_WHITELIST]: JSON.stringify(formattedWhitelist) }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                adskipUtils.logDebug('已保存视频白名单', { data: formattedWhitelist, throttle: 5000 });
                resolve(formattedWhitelist);
            }
        });
    });
}

/**
 * 检查视频ID是否在白名单中
 * @param {string} videoId 视频ID
 * @returns {Promise<boolean>} 是否在白名单中
 */
async function checkVideoInWhitelist(videoId) {
    if (!videoId) return false;

    const whitelist = await loadVideoWhitelist();
    return whitelist.some(item =>
        (typeof item === 'string' && item === videoId) ||
        (item.bvid === videoId)
    );
}

/**
 * 检查视频是否在无广告白名单中
 * 用于判断视频是否已被标记为无广告内容
 * @param {string} videoId 视频ID
 * @returns {Promise<boolean>} 视频是否在无广告白名单中
 */
async function checkVideoInNoAdsWhitelist(videoId) {
    if (!videoId) return false;

    const whitelist = await loadVideoWhitelist();
    return whitelist.some(item =>
        ((typeof item === 'string' && item === videoId) || (item.bvid === videoId)) &&
        (item.noAds === true)
    );
}

/**
 * 添加视频ID到白名单
 * @param {string} videoId 视频ID
 * @returns {Promise<Array>} 更新后的白名单
 */
async function addVideoToWhitelist(videoId) {
    if (!videoId) return Promise.reject(new Error('视频ID不能为空'));

    const whitelist = await loadVideoWhitelist();

    // 检查是否已存在
    const exists = whitelist.some(item =>
        (typeof item === 'string' && item === videoId) ||
        (item.bvid === videoId)
    );

    if (!exists) {
        whitelist.push({
            bvid: videoId,
            addedAt: Date.now()
        });
        return saveVideoWhitelist(whitelist);
    }

    return whitelist;
}

/**
 * 将视频添加到无广告白名单
 * 用于服务器识别后确认该视频没有广告内容
 * @param {string} videoId 视频ID
 * @returns {Promise<Array>} 更新后的白名单
 */
async function addVideoToNoAdsWhitelist(videoId) {
    if (!videoId) return Promise.reject(new Error('视频ID不能为空'));

    const whitelist = await loadVideoWhitelist();

    // 查找视频在白名单中的位置
    const existingIndex = whitelist.findIndex(item =>
        (typeof item === 'string' && item === videoId) ||
        (item.bvid === videoId)
    );

    if (existingIndex >= 0) {
        // 更新已存在的条目
        whitelist[existingIndex] = {
            ...(typeof whitelist[existingIndex] === 'string'
                ? { bvid: whitelist[existingIndex] }
                : whitelist[existingIndex]),
            bvid: videoId,
            noAds: true,
            updatedAt: Date.now()
        };
    } else {
        // 添加新条目
        whitelist.push({
            bvid: videoId,
            noAds: true,
            addedAt: Date.now(),
            updatedAt: Date.now()
        });
    }

    adskipUtils.logDebug(`[AdSkip存储] 添加视频 ${videoId} 到无广告白名单`);
    return saveVideoWhitelist(whitelist);
}

/**
 * 保存视频状态
 * 存储视频的处理状态，用于后续跟踪和优化
 * @param {string} videoId 视频ID
 * @param {number} status 视频状态，使用VIDEO_STATUS枚举值
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveVideoStatus(videoId, status) {
    if (!videoId) {
        adskipUtils.logDebug('[AdSkip存储] 视频ID为空，无法保存状态');
        return false;
    }

    try {
        // 使用视频ID作为键，避免与广告时间戳存储冲突
        const key = `${STORAGE_KEYS.VIDEO_PREFIX}status_${videoId}`;

        const data = {
            status: status,
            updatedAt: Date.now()
        };

        return new Promise(resolve => {
            chrome.storage.local.set({ [key]: JSON.stringify(data) }, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug(`[AdSkip存储] 成功保存视频 ${videoId} 的状态: ${status}`);
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 保存视频状态失败: ${chrome.runtime.lastError?.message || '未知错误'}`);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 保存视频状态时发生异常: ${e.message}`);
        console.error('[AdSkip存储] 保存视频状态时发生异常:', e);
        return false;
    }
}

/**
 * 获取视频状态
 * 获取之前存储的视频处理状态
 * @param {string} videoId 视频ID
 * @returns {Promise<number|null>} 视频状态或null（如果未找到）
 */
async function getVideoStatus(videoId) {
    if (!videoId) {
        adskipUtils.logDebug('[AdSkip存储] 视频ID为空，无法获取状态');
        return null;
    }

    try {
        const key = `${STORAGE_KEYS.VIDEO_PREFIX}status_${videoId}`;

        return new Promise(resolve => {
            chrome.storage.local.get(key, result => {
                if (chrome.runtime.lastError || !result[key]) {
                    adskipUtils.logDebug(`[AdSkip存储] 未找到视频 ${videoId} 的状态记录`);
                    resolve(null);
                    return;
                }

                try {
                    const data = JSON.parse(result[key]);
                    adskipUtils.logDebug(`[AdSkip存储] 成功获取视频 ${videoId} 的状态: ${data.status}`);
                    resolve(data.status);
                } catch (e) {
                    adskipUtils.logDebug(`[AdSkip存储] 解析视频状态时发生异常: ${e.message}`);
                    resolve(null);
                }
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 获取视频状态时发生异常: ${e.message}`);
        console.error('[AdSkip存储] 获取视频状态时发生异常:', e);
        return null;
    }
}

/**
 * 从白名单移除视频ID
 * @param {string} videoId 视频ID
 * @returns {Promise<Array>} 更新后的白名单
 */
async function removeVideoFromWhitelist(videoId) {
    if (!videoId) return Promise.reject(new Error('视频ID不能为空'));

    const whitelist = await loadVideoWhitelist();

    const newWhitelist = whitelist.filter(item =>
        !(typeof item === 'string' && item === videoId) &&
        !(item.bvid === videoId)
    );

    if (newWhitelist.length !== whitelist.length) {
        return saveVideoWhitelist(newWhitelist);
    }

    return whitelist;
}

/**
 * 清除UP主信息缓存
 * 在视频切换或需要强制刷新UP主信息时调用
 */
function clearUploaderCache() {
    cachedUploaderInfo = null;
    lastUploaderCheck = 0;
    adskipUtils.logDebug('已清除UP主信息缓存');
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
    setEnabled,

    // 存储管理
    getAllKeys,
    removeKeys,

    // 新添加的函数
    getVideoDataKeys,
    getConfigKeys,
    getWhitelistKeys,
    getReservedKeys,
    getAdminResetKeys,
    clearAllVideoData,

    // 视频白名单管理
    loadVideoWhitelist,
    saveVideoWhitelist,
    checkVideoInWhitelist,
    addVideoToWhitelist,
    removeVideoFromWhitelist,

    // 新增的视频无广告白名单和状态管理
    checkVideoInNoAdsWhitelist,
    addVideoToNoAdsWhitelist,
    saveVideoStatus,
    getVideoStatus,

    // 新添加的函数
    clearUploaderCache
};