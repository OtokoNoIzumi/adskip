/**
 * storage.js - 存储模块
 * 处理所有与Chrome存储API相关的操作
 */

'use strict';

// 开发环境优先配置 - 设置后会覆盖外部配置的baseURL
const PRIME_BASE_URL = null; // 开发时设置为 "https://localhost:3000" 等
// const PRIME_BASE_URL = "https://localhost:3000"; // 开发环境
// const PRIME_BASE_URL = "https://izumilife.xyz:3000"; // 测试环境
// const PRIME_BASE_URL = "https://izumihostpab.life:3000"; // 生产环境

// 外部配置文件常量
const EXTERNAL_CONFIG_URL = "https://otokonoizumi.github.io/config.json";
const EXTERNAL_CONFIG_CACHE_KEY = 'bilibili_adskip_external_config_cache';
const EXTERNAL_CONFIG_CACHE_DURATION = 60 * 60 * 1000; // 1小时
const EXTERNAL_CONFIG_TIMEOUT = 5000; // 5秒超时

// 默认配置（超时时使用）
const DEFAULT_CONFIG = {
    version: "1.3.0",
    api: {
        adSkipServerBaseURL: "https://izumihostpab.life:3000"
    },
    version_hint: {
        "default": [
            "没有字幕的视频也可以手动添加广告时间",
            "自己发布的视频默认不会进行AI识别",
            "打开生成的分享链接不会消耗AI识别次数"
        ]
    },
    "post_setting": {
        "default": {
            "main_title": "重新爱上了没广告的B站~✨",
            "sub_title": "朋友们，这波操作你们学会了吗",
            "sub_title_offset": 120,
            "description": "今天也是没被广告打扰的一天",
            "description_offset": 170,
            "conversion_unit_minutes": 1,
            "conversion_template": "✨ 相当于伸了{count}次懒腰",
            "video_count_template": "📺 在 {count} 个含广告视频里进行了跃迁"
        },
        "ranges": [
            {
                "min_seconds": 0,
                "max_seconds": 1200,
                "options": [
                    {
                        "main_title": "舒展一下，放松心情~🧘‍♀️",
                        "sub_title": "伸个懒腰的功夫",
                        "sub_title_offset": 120,
                        "description": "连伸懒腰都比看广告有意义",
                        "description_offset": 170,
                        "conversion_unit_minutes": 1,
                        "conversion_template": "✨ 相当于伸了{count}次懒腰",
                        "video_count_template": "🧘 享受了 {count} 个无广告视频"
                    },
                    {
                        "main_title": "精致生活从这里开始🥚",
                        "sub_title": "煮个完美溏心蛋的时间",
                        "sub_title_offset": 120,
                        "description": "连做早餐都比广告更温暖",
                        "description_offset": 170,
                        "conversion_unit_minutes": 1,
                        "conversion_template": "✨ 相当于煮了{count}个完美溏心蛋",
                        "video_count_template": "🥚 体验了 {count} 个清爽视频"
                    }
                ]
            },
            {
                "min_seconds": 1201,
                "max_seconds": 12000,
                "options": [
                    {
                        "main_title": "二次元快乐时光！🎌",
                        "sub_title": "追番党的胜利",
                        "sub_title_offset": 120,
                        "description": "没有广告打断的纯净观番体验",
                        "description_offset": 170,
                        "conversion_unit_minutes": 20,
                        "conversion_template": "✨ 相当于追了{count}集新番",
                        "video_count_template": "🎌 沉浸享受了 {count} 个视频"
                    },
                    {
                        "main_title": "午后时光，惬意舒适☀️",
                        "sub_title": "美好的小憩时间",
                        "sub_title_offset": 120,
                        "description": "连午休都比看广告更香甜",
                        "description_offset": 170,
                        "conversion_unit_minutes": 20,
                        "conversion_template": "✨ 相当于舒服地午休了{count}次",
                        "video_count_template": "☀️ 惬意观看了 {count} 个视频"
                    },
                    {
                        "main_title": "洗去一身疲惫🛁",
                        "sub_title": "舒爽沐浴时光",
                        "sub_title_offset": 120,
                        "description": "清爽的感觉，就像没有广告的B站",
                        "description_offset": 170,
                        "conversion_unit_minutes": 20,
                        "conversion_template": "✨ 相当于冲了{count}个舒服的澡",
                        "video_count_template": "🛁 舒爽看完了 {count} 个视频"
                    }
                ]
            },
            {
                "min_seconds": 12001,
                "max_seconds": 54000,
                "options": [
                    {
                        "main_title": "电影院级观影体验🎬",
                        "sub_title": "沉浸式大片时间",
                        "sub_title_offset": 120,
                        "description": "没有广告的观影才是真正的享受",
                        "description_offset": 170,
                        "conversion_unit_minutes": 90,
                        "conversion_template": "✨ 相当于看了{count}部电影",
                        "video_count_template": "🎬 深度沉浸享受了 {count} 个视频"
                    },
                    {
                        "main_title": "火锅聚会的温暖时光🍲",
                        "sub_title": "和朋友共享美食",
                        "sub_title_offset": 120,
                        "description": "热气腾腾的快乐，就像清爽的B站",
                        "description_offset": 170,
                        "conversion_unit_minutes": 90,
                        "conversion_template": "✨ 相当于和朋友吃了{count}顿火锅",
                        "video_count_template": "🍲 开心地观赏了 {count} 个视频"
                    },
                    {
                        "main_title": "身心和谐的瑜伽时间🧘‍♀️",
                        "sub_title": "健康生活的选择",
                        "sub_title_offset": 120,
                        "description": "内心平静，就像没广告的纯净体验",
                        "description_offset": 170,
                        "conversion_unit_minutes": 90,
                        "conversion_template": "✨ 相当于做了{count}套完整瑜伽",
                        "video_count_template": "🧘‍♀️ 身心舒畅地享受了 {count} 个视频"
                    }
                ]
            },
            {
                "min_seconds": 54001,
                "options": [
                    {
                        "main_title": "悠闲下午的完美时光☕",
                        "sub_title": "充实而惬意的午后",
                        "sub_title_offset": 120,
                        "description": "这样的下午时光，值得慢慢品味",
                        "description_offset": 170,
                        "conversion_unit_minutes": 360,
                        "conversion_template": "✨ 相当于度过了{count}个充实的下午",
                        "video_count_template": "📺 悠然品味了 {count} 个视频"
                    },
                    {
                        "main_title": "高效工作日的成就感💼",
                        "sub_title": "完美的一天",
                        "sub_title_offset": 120,
                        "description": "充实的工作时光，如此美好",
                        "description_offset": 170,
                        "conversion_unit_minutes": 480,
                        "conversion_template": "✨ 相当于享受了{count}个完美的工作日",
                        "video_count_template": "📺 专注观看了 {count} 个视频"
                    }
                ]
            }
        ]
    }
};

// 存储键名常量定义
const STORAGE_KEYS = {
    PREFIX: 'adskip_',
    DEBUG_MODE: 'adskip_debug_mode',
    ENABLED: 'adskip_enabled',
    PERCENTAGE: 'adskip_percentage',
    SKIP_OWN_VIDEOS: 'adskip_skip_own_videos',
    ADMIN_AUTH: 'adskip_admin_authorized',
    UPLOADER_WHITELIST: 'adskip_uploader_whitelist',
    VIDEO_PREFIX: 'adskip_',
    VIDEO_WHITELIST: 'adskip_video_whitelist',
    // 新增: 用户统计相关的键
    USER_STATS: 'adskip_user_stats',
    USER_STATS_CACHE: 'adskip_user_stats_cache',
    LOCAL_VIDEOS_PROCESSED: 'adskip_local_videos_processed',
    USER_UID: 'adskip_user_uid',
    USER_USERNAME: 'adskip_user_username',  // 新增: 用户名存储
    LAST_STATS_FETCH_TIME: 'adskip_last_stats_fetch_time',  // 记录上次获取用户统计的时间
    LAST_FETCH_VIDEOS_COUNT: 'adskip_last_fetch_videos_count',  // 记录上次获取统计时的视频数
    // 新增: 次数耗尽相关的键
    QUOTA_EXHAUSTED_DATE: 'adskip_quota_exhausted_date',     // 次数耗尽日期
    QUOTA_FAILED_VIDEOS: 'adskip_quota_failed_videos',       // 次数耗尽失败的视频缓存
    // 新增: 用户行为统计相关的键
    POPUP_OPEN_COUNT: 'adskip_popup_open_count',            // popup打开计数
    SHARE_CLICK_COUNT: 'adskip_share_click_count',          // 分享按钮点击计数

    // 分类集合，用于过滤操作
    CONFIG_KEYS: [
        'adskip_debug_mode',
        'adskip_enabled',
        'adskip_percentage',
        'adskip_skip_own_videos',
        'adskip_admin_authorized'
    ],
    WHITELIST_KEYS: [
        'adskip_uploader_whitelist'
    ],
    // 所有保留的键（不会被数据清除操作删除的键）
    RESERVED_KEYS: function() {
        return [
            ...this.CONFIG_KEYS,
            ...this.WHITELIST_KEYS,
            this.VIDEO_WHITELIST,
            this.USER_STATS,
            this.USER_STATS_CACHE,
            this.USER_UID,
            this.USER_USERNAME,  // 新增: 用户名也是保留键
            this.LOCAL_VIDEOS_PROCESSED,
            this.LAST_STATS_FETCH_TIME,
            this.LAST_FETCH_VIDEOS_COUNT,
            this.QUOTA_EXHAUSTED_DATE,
            this.QUOTA_FAILED_VIDEOS,
            this.POPUP_OPEN_COUNT,
            this.SHARE_CLICK_COUNT
        ];
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
                adskipUtils.logDebug(`加载广告跳过百分比配置失败: ${chrome.runtime.lastError.message}，使用默认值 1%`);
                resolve(1);
                return;
            }

            const percent = parseInt(data[STORAGE_KEYS.PERCENTAGE], 10);

            // 简单的有效性检查，几乎不会触发，但作为最后保障
            if (isNaN(percent) || percent < 0 || percent > 100) {
                adskipUtils.logDebug(`配置值无效或未设置，使用默认值 1%`);
                resolve(1);
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
    const percent = parseInt(percentage, 10) || 1; // 无效时使用默认值

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
    const validKeyHash = '41e219d2';
    const inputHash = simpleHash(apiKey);
    const isValid = (inputHash === validKeyHash);

    adskipUtils.logDebug(`管理员验证结果: ${isValid ? '通过' : '失败'}, 输入哈希: ${inputHash}, 有效哈希: ${validKeyHash}`);

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
 * 获取"跳过自己视频"功能状态
 * @returns {Promise<boolean>} 是否启用
 */
function getSkipOwnVideos() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.SKIP_OWN_VIDEOS, function(result) {
            // 默认为 true (启用状态)
            const skipOwnVideos = result[STORAGE_KEYS.SKIP_OWN_VIDEOS] !== false;
            resolve(skipOwnVideos);
        });
    });
}

/**
 * 设置"跳过自己视频"功能状态
 * @param {boolean} enabled 是否启用
 * @returns {Promise<boolean>} 设置后的状态
 */
function setSkipOwnVideos(enabled) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[STORAGE_KEYS.SKIP_OWN_VIDEOS]: enabled}, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            adskipUtils.logDebug(`已${enabled ? '启用' : '禁用'}"不检测自己视频"功能`);
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
 * @returns {Promise<Array>} 视频ID白名单数组（按添加时间倒序排列）
 */
function loadVideoWhitelist() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.VIDEO_WHITELIST, (result) => {
            if (result[STORAGE_KEYS.VIDEO_WHITELIST]) {
                try {
                    const whitelist = JSON.parse(result[STORAGE_KEYS.VIDEO_WHITELIST]);

                    // 按添加时间倒序排列（最新的在前面）
                    const sortedWhitelist = whitelist.sort((a, b) => {
                        const timeA = (typeof a === 'string') ? 0 : (a.addedAt || a.updatedAt || 0);
                        const timeB = (typeof b === 'string') ? 0 : (b.addedAt || b.updatedAt || 0);
                        return timeB - timeA; // 倒序：新的在前
                    });

                    adskipUtils.logDebug('已加载视频白名单（按时间倒序）', { data: sortedWhitelist, throttle: 5000 });
                    resolve(sortedWhitelist);
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

/**
 * 新增：获取本地处理过的视频数量
 * @returns {Promise<number>} 本地处理视频数量
 */
async function getLocalVideosProcessedCount() {
    adskipUtils.logDebug(`获取本地处理视频数量`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.LOCAL_VIDEOS_PROCESSED, (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`获取本地处理视频数量失败: ${chrome.runtime.lastError.message}`);
                resolve(0);
                return;
            }

            const count = result[STORAGE_KEYS.LOCAL_VIDEOS_PROCESSED] || 0;
            adskipUtils.logDebug(`本地处理视频数量: ${count}`);
            resolve(count);
        });
    });
}

/**
 * 新增：增加本地处理过的视频数量
 * @returns {Promise<number>} 更新后的数量
 */
async function incrementLocalVideosProcessedCount() {
    adskipUtils.logDebug(`增加本地处理视频数量`);

    const currentCount = await getLocalVideosProcessedCount();
    const newCount = currentCount + 1;

    return new Promise(resolve => {
        chrome.storage.local.set({
            [STORAGE_KEYS.LOCAL_VIDEOS_PROCESSED]: newCount
        }, () => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`更新本地处理视频数量失败: ${chrome.runtime.lastError.message}`);
                resolve(currentCount); // 如果失败，返回原值
                return;
            }

            adskipUtils.logDebug(`本地处理视频数量已更新: ${newCount}`);
            resolve(newCount);
        });
    });
}

/**
 * 新增：保存用户信息缓存，包括从API获取的数据
 * @param {Object} userStats 用户统计信息对象
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveUserStatsCache(userStats) {
    adskipUtils.logDebug(`保存用户统计信息缓存`);

    // 添加当前时间戳和可读的更新时间
    const now = Date.now();
    const updateTimeDisplay = new Date().toLocaleString();

    // 将时间戳信息直接添加到数据对象中，而不是创建额外的wrapper
    // 这样 popup.js 可以直接使用 data.updateTimeDisplay
    userStats.timestamp = now;
    userStats.updateTimeDisplay = updateTimeDisplay;

    return new Promise(resolve => {
        chrome.storage.local.set({
            [STORAGE_KEYS.USER_STATS_CACHE]: userStats
        }, () => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`保存用户统计信息缓存失败: ${chrome.runtime.lastError.message}`);
                resolve(false);
                return;
            }

            adskipUtils.logDebug(`用户统计信息缓存已保存，更新时间: ${updateTimeDisplay}`);
            resolve(true);
        });
    });
}

/**
 * 新增：获取用户信息缓存
 * @param {number} maxAge 最大缓存年龄（毫秒），默认1小时
 * @returns {Promise<Object|null>} 缓存的用户统计数据，如果过期或不存在则返回null
 */
async function getUserStatsCache(maxAge = 3600000) {
    adskipUtils.logDebug(`获取用户统计信息缓存`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.USER_STATS_CACHE, (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`获取用户统计信息缓存失败: ${chrome.runtime.lastError.message}`);
                resolve(null);
                return;
            }

            const cacheData = result[STORAGE_KEYS.USER_STATS_CACHE];
            if (!cacheData || !cacheData.timestamp) {
                adskipUtils.logDebug(`用户统计信息缓存不存在或格式无效`);
                resolve(null);
                return;
            }

            // 检查缓存是否过期
            const now = Date.now();
            if (now - cacheData.timestamp > maxAge) {
                adskipUtils.logDebug(`用户统计信息缓存已过期，过期时间：${(now - cacheData.timestamp) / 1000}秒`);
                // 过期时依然返回缓存数据，让调用方决定如何使用
                resolve(cacheData);
                return;
            }

            adskipUtils.logDebug(`成功获取用户统计信息缓存，缓存时间：${(now - cacheData.timestamp) / 1000}秒`);
            resolve(cacheData);
        });
    });
}

/**
 * 新增：保存用户UID到本地，确保在非B站页面也能使用
 * @param {string|number} uid 用户UID
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveUserUID(uid) {
    if (!uid) {
        adskipUtils.logDebug(`用户UID为空，无法保存`);
        return false;
    }

    adskipUtils.logDebug(`保存用户UID: ${uid}`);

    return new Promise(resolve => {
        chrome.storage.local.set({
            [STORAGE_KEYS.USER_UID]: uid.toString()
        }, () => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`保存用户UID失败: ${chrome.runtime.lastError.message}`);
                resolve(false);
                return;
            }

            adskipUtils.logDebug(`用户UID已保存: ${uid}`);
            resolve(true);
        });
    });
}

/**
 * 新增：获取保存的用户UID
 * @returns {Promise<string|null>} 用户UID或null（如果不存在）
 */
async function getUserUID() {
    adskipUtils.logDebug(`获取保存的用户UID`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.USER_UID, (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`获取用户UID失败: ${chrome.runtime.lastError.message}`);
                resolve(null);
                return;
            }

            const uid = result[STORAGE_KEYS.USER_UID];
            if (!uid) {
                adskipUtils.logDebug(`未找到保存的用户UID`);
                resolve(null);
                return;
            }

            adskipUtils.logDebug(`成功获取用户UID: ${uid}`);
            resolve(uid);
        });
    });
}

/**
 * 新增：保存用户名到本地，确保在非B站页面也能使用
 * @param {string} username 用户名
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveUserUsername(username) {
    if (!username || username === 'guest') {
        adskipUtils.logDebug(`用户名为空或为guest，不保存`);
        return false;
    }

    adskipUtils.logDebug(`保存用户名: ${username}`);

    return new Promise(resolve => {
        chrome.storage.local.set({
            [STORAGE_KEYS.USER_USERNAME]: username
        }, () => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`保存用户名失败: ${chrome.runtime.lastError.message}`);
                resolve(false);
                return;
            }

            adskipUtils.logDebug(`用户名已保存: ${username}`);
            resolve(true);
        });
    });
}

/**
 * 新增：获取保存的用户名
 * @returns {Promise<string|null>} 用户名或null（如果不存在）
 */
async function getUserUsername() {
    adskipUtils.logDebug(`获取保存的用户名`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.USER_USERNAME, (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`获取用户名失败: ${chrome.runtime.lastError.message}`);
                resolve(null);
                return;
            }

            const username = result[STORAGE_KEYS.USER_USERNAME];
            if (!username) {
                adskipUtils.logDebug(`未找到保存的用户名`);
                resolve(null);
                return;
            }

            adskipUtils.logDebug(`成功获取用户名: ${username}`);
            resolve(username);
        });
    });
}

/**
 * 记录上次获取用户统计的时间和视频处理数量
 * @returns {Promise<boolean>} 保存是否成功
 */
async function recordLastStatsFetch() {
    adskipUtils.logDebug(`记录本次获取用户统计的信息`);

    try {
        // 获取当前本地处理的视频数量
        const videoCount = await getLocalVideosProcessedCount();
        const now = Date.now();

        return new Promise(resolve => {
            chrome.storage.local.set({
                [STORAGE_KEYS.LAST_STATS_FETCH_TIME]: now,
                [STORAGE_KEYS.LAST_FETCH_VIDEOS_COUNT]: videoCount
            }, () => {
                if (chrome.runtime.lastError) {
                    adskipUtils.logDebug(`记录获取统计信息失败: ${chrome.runtime.lastError.message}`);
                    resolve(false);
                    return;
                }

                adskipUtils.logDebug(`已记录本次获取用户统计信息，时间: ${new Date(now).toLocaleString()}, 视频数: ${videoCount}`);
                resolve(true);
            });
        });
    } catch (error) {
        adskipUtils.logDebug(`记录统计获取时发生错误: ${error.message}`);
        return false;
    }
}

/**
 * 获取上次获取用户统计的信息
 * @returns {Promise<Object>} 包含上次获取时间和视频数的对象
 */
async function getLastStatsFetchInfo() {
    adskipUtils.logDebug(`获取上次统计获取信息`);

    return new Promise(resolve => {
        chrome.storage.local.get([
            STORAGE_KEYS.LAST_STATS_FETCH_TIME,
            STORAGE_KEYS.LAST_FETCH_VIDEOS_COUNT
        ], (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`获取上次统计获取信息失败: ${chrome.runtime.lastError.message}`);
                resolve({ time: 0, videoCount: 0 });
                return;
            }

            const info = {
                time: result[STORAGE_KEYS.LAST_STATS_FETCH_TIME] || 0,
                videoCount: result[STORAGE_KEYS.LAST_FETCH_VIDEOS_COUNT] || 0
            };

            adskipUtils.logDebug(`获取到上次统计获取信息: 时间: ${new Date(info.time).toLocaleString()}, 视频数: ${info.videoCount}`);
            resolve(info);
        });
    });
}

/**
 * 检查是否需要更新用户统计数据
 * @returns {Promise<boolean>} 是否需要更新
 */
async function shouldUpdateUserStats() {
    try {
        // 获取上次获取信息
        const lastFetchInfo = await getLastStatsFetchInfo();

        // 获取当前本地处理的视频数
        const currentVideoCount = await getLocalVideosProcessedCount();

        // 当前时间
        const now = Date.now();

        // 上次获取的时间距现在超过1小时
        const timeCondition = now - lastFetchInfo.time >= 3600000; // 1小时 = 3600000毫秒

        // 本地处理的视频数比上次获取时增加了2个或更多
        const videoCountCondition = currentVideoCount - lastFetchInfo.videoCount >= 2;

        // 如果是首次获取(时间为0)，也应该更新
        const isFirstFetch = lastFetchInfo.time === 0;

        const shouldUpdate = isFirstFetch || timeCondition || videoCountCondition;

        adskipUtils.logDebug(`检查是否需要更新用户统计:
            上次获取时间: ${new Date(lastFetchInfo.time).toLocaleString()}
            上次视频数: ${lastFetchInfo.videoCount}
            当前视频数: ${currentVideoCount}
            时间条件满足: ${timeCondition}
            视频数条件满足: ${videoCountCondition}
            首次获取: ${isFirstFetch}
            需要更新: ${shouldUpdate}`);

        return shouldUpdate;
    } catch (error) {
        adskipUtils.logDebug(`检查是否需要更新统计时出错: ${error.message}`);
        return true; // 出错时保守处理，返回需要更新
    }
}

/**
 * 强制刷新用户统计缓存，在次数耗尽等情况下使用
 * 清除缓存数据并重置获取时间，使下次popup打开时重新获取最新数据
 * @returns {Promise<boolean>} 操作是否成功
 */
async function forceRefreshUserStatsCache() {
    try {
        adskipUtils.logDebug('[AdSkip存储] 强制刷新用户统计缓存');

        return new Promise(resolve => {
            // 清除用户统计缓存和上次获取时间记录
            chrome.storage.local.remove([
                STORAGE_KEYS.USER_STATS_CACHE,
                STORAGE_KEYS.LAST_STATS_FETCH_TIME,
                STORAGE_KEYS.LAST_FETCH_VIDEOS_COUNT
            ], () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug('[AdSkip存储] 用户统计缓存已强制刷新，popup下次打开将重新获取最新数据');
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 强制刷新用户统计缓存失败: ${chrome.runtime.lastError?.message}`);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 强制刷新用户统计缓存异常: ${e.message}`);
        return false;
    }
}

/**
 * 保存次数耗尽状态到本地存储
 * @param {string} date - 次数耗尽的日期 (YYYY-MM-DD格式)
 * @returns {Promise<boolean>} 保存是否成功
 */
async function saveQuotaExhaustedStatus(date) {
    try {
        return new Promise(resolve => {
            chrome.storage.local.set({ [STORAGE_KEYS.QUOTA_EXHAUSTED_DATE]: date }, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug(`[AdSkip存储] 次数耗尽状态已保存，日期: ${date}`);
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 保存次数耗尽状态失败: ${chrome.runtime.lastError?.message}`);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 保存次数耗尽状态异常: ${e.message}`);
        return false;
    }
}

/**
 * 获取次数耗尽状态
 * @returns {Promise<string|null>} 次数耗尽的日期或null
 */
async function getQuotaExhaustedStatus() {
    try {
        return new Promise(resolve => {
            chrome.storage.local.get(STORAGE_KEYS.QUOTA_EXHAUSTED_DATE, result => {
                if (chrome.runtime.lastError || !result[STORAGE_KEYS.QUOTA_EXHAUSTED_DATE]) {
                    resolve(null);
                    return;
                }
                resolve(result[STORAGE_KEYS.QUOTA_EXHAUSTED_DATE]);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 获取次数耗尽状态异常: ${e.message}`);
        return null;
    }
}

/**
 * 清除次数耗尽状态
 * @returns {Promise<boolean>} 清除是否成功
 */
async function clearQuotaExhaustedStatus() {
    try {
        return new Promise(resolve => {
            chrome.storage.local.remove(STORAGE_KEYS.QUOTA_EXHAUSTED_DATE, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug('[AdSkip存储] 次数耗尽状态已清除');
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 清除次数耗尽状态失败: ${chrome.runtime.lastError?.message}`);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 清除次数耗尽状态异常: ${e.message}`);
        return false;
    }
}

/**
 * 检查是否应该清除次数耗尽状态（如果已经到了第二天）
 * @returns {Promise<boolean>} 是否已清除状态
 */
async function checkAndClearQuotaIfNewDay() {
    try {
        const quotaDate = await getQuotaExhaustedStatus();
        if (!quotaDate) {
            return false; // 没有次数耗尽记录
        }

        const today = adskipUtils.getTodayInEast8(); // 使用统一的东八区日期函数

        if (quotaDate !== today) {
            // 不是同一天，清除次数耗尽状态
            await clearQuotaExhaustedStatus();
            // 同时清除次数耗尽失败视频缓存
            await clearQuotaFailedCache();
            adskipUtils.logDebug(`[AdSkip存储] 检测到新的一天 (${today})，已清除昨日的次数耗尽状态和失败视频缓存 (${quotaDate})`);
            return true;
        }

        adskipUtils.logDebug(`[AdSkip存储] 仍在同一天 (${today})，次数耗尽状态保持`);
        return false;
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 检查次数耗尽状态异常: ${e.message}`);
        return false;
    }
}

/**
 * 添加视频到次数耗尽失败缓存
 * @param {string} videoId - 视频ID
 * @returns {Promise<boolean>} 添加是否成功
 */
async function addVideoToQuotaFailedCache(videoId) {
    try {
        return new Promise(resolve => {
            chrome.storage.local.get(STORAGE_KEYS.QUOTA_FAILED_VIDEOS, result => {
                const failedVideos = result[STORAGE_KEYS.QUOTA_FAILED_VIDEOS]
                    ? JSON.parse(result[STORAGE_KEYS.QUOTA_FAILED_VIDEOS]) : [];

                if (!failedVideos.includes(videoId)) {
                    failedVideos.push(videoId);
                    chrome.storage.local.set({
                        [STORAGE_KEYS.QUOTA_FAILED_VIDEOS]: JSON.stringify(failedVideos)
                    }, () => {
                        const success = !chrome.runtime.lastError;
                        if (success) {
                            adskipUtils.logDebug(`[AdSkip存储] 视频 ${videoId} 已添加到次数耗尽失败缓存`);
                        } else {
                            adskipUtils.logDebug(`[AdSkip存储] 添加视频到失败缓存失败: ${chrome.runtime.lastError?.message}`);
                        }
                        resolve(success);
                    });
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 视频 ${videoId} 已在失败缓存中`);
                    resolve(true);
                }
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 添加视频到失败缓存异常: ${e.message}`);
        return false;
    }
}

/**
 * 检查视频是否在次数耗尽失败缓存中
 * @param {string} videoId - 视频ID
 * @returns {Promise<boolean>} 是否在缓存中
 */
async function checkVideoInQuotaFailedCache(videoId) {
    try {
        // 首先检查并清除过期的次数耗尽状态
        await checkAndClearQuotaIfNewDay();

        return new Promise(resolve => {
            chrome.storage.local.get(STORAGE_KEYS.QUOTA_FAILED_VIDEOS, result => {
                if (chrome.runtime.lastError || !result[STORAGE_KEYS.QUOTA_FAILED_VIDEOS]) {
                    resolve(false);
                    return;
                }
                try {
                    const failedVideos = JSON.parse(result[STORAGE_KEYS.QUOTA_FAILED_VIDEOS]);
                    const isInCache = failedVideos.includes(videoId);
                    adskipUtils.logDebug(`[AdSkip存储] 检查视频 ${videoId} 是否在失败缓存中: ${isInCache}`);
                    resolve(isInCache);
                } catch (e) {
                    adskipUtils.logDebug(`[AdSkip存储] 解析失败缓存时异常: ${e.message}`);
                    resolve(false);
                }
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 检查失败缓存异常: ${e.message}`);
        return false;
    }
}

/**
 * 清除次数耗尽失败视频缓存
 * @returns {Promise<boolean>} 清除是否成功
 */
async function clearQuotaFailedCache() {
    try {
        return new Promise(resolve => {
            chrome.storage.local.remove(STORAGE_KEYS.QUOTA_FAILED_VIDEOS, () => {
                const success = !chrome.runtime.lastError;
                if (success) {
                    adskipUtils.logDebug('[AdSkip存储] 次数耗尽失败视频缓存已清除');
                } else {
                    adskipUtils.logDebug(`[AdSkip存储] 清除失败视频缓存失败: ${chrome.runtime.lastError?.message}`);
                }
                resolve(success);
            });
        });
    } catch (e) {
        adskipUtils.logDebug(`[AdSkip存储] 清除失败视频缓存异常: ${e.message}`);
        return false;
    }
}

/**
 * 增加popup打开计数
 * @returns {Promise<number>} 当前计数值
 */
async function incrementPopupOpenCount() {
    adskipUtils.logDebug(`[AdSkip存储] 增加popup打开计数`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.POPUP_OPEN_COUNT, (result) => {
            const currentCount = result[STORAGE_KEYS.POPUP_OPEN_COUNT] || 0;
            const newCount = currentCount + 1;

            chrome.storage.local.set({
                [STORAGE_KEYS.POPUP_OPEN_COUNT]: newCount
            }, () => {
                if (chrome.runtime.lastError) {
                    adskipUtils.logDebug(`[AdSkip存储] 增加popup打开计数失败: ${chrome.runtime.lastError.message}`);
                    resolve(currentCount);
                    return;
                }

                adskipUtils.logDebug(`[AdSkip存储] popup打开计数已更新: ${newCount}`);
                resolve(newCount);
            });
        });
    });
}

/**
 * 增加分享按钮点击计数
 * @returns {Promise<number>} 当前计数值
 */
async function incrementShareClickCount() {
    adskipUtils.logDebug(`[AdSkip存储] 增加分享按钮点击计数`);

    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.SHARE_CLICK_COUNT, (result) => {
            const currentCount = result[STORAGE_KEYS.SHARE_CLICK_COUNT] || 0;
            const newCount = currentCount + 1;

            chrome.storage.local.set({
                [STORAGE_KEYS.SHARE_CLICK_COUNT]: newCount
            }, () => {
                if (chrome.runtime.lastError) {
                    adskipUtils.logDebug(`[AdSkip存储] 增加分享按钮点击计数失败: ${chrome.runtime.lastError.message}`);
                    resolve(currentCount);
                    return;
                }

                adskipUtils.logDebug(`[AdSkip存储] 分享按钮点击计数已更新: ${newCount}`);
                resolve(newCount);
            });
        });
    });
}

/**
 * 获取使用统计数据
 * @returns {Promise<Object>} 包含各种计数的对象
 */
async function getUsageStats() {
    adskipUtils.logDebug(`[AdSkip存储] 获取使用统计数据`);

    return new Promise(resolve => {
        chrome.storage.local.get([
            STORAGE_KEYS.POPUP_OPEN_COUNT,
            STORAGE_KEYS.SHARE_CLICK_COUNT
        ], (result) => {
            if (chrome.runtime.lastError) {
                adskipUtils.logDebug(`[AdSkip存储] 获取使用统计数据失败: ${chrome.runtime.lastError.message}`);
                resolve({
                    popupOpens: 0,
                    shareClicks: 0
                });
                return;
            }

            const stats = {
                popupOpens: result[STORAGE_KEYS.POPUP_OPEN_COUNT] || 0,
                shareClicks: result[STORAGE_KEYS.SHARE_CLICK_COUNT] || 0
            };

            adskipUtils.logDebug(`[AdSkip存储] 使用统计数据:`, stats);
            resolve(stats);
        });
    });
}



// ==================== 统一配置管理 ====================

/**
 * 带超时的fetch函数
 * @param {string} url - 请求URL
 * @param {number} timeout - 超时时间（毫秒）
 * @param {Object} options - fetch选项
 * @returns {Promise<Response>} fetch响应
 */
async function fetchWithTimeout(url, timeout = 5000, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * 获取缓存的外部配置
 * @returns {Promise<Object|null>} 缓存的配置或null
 */
async function getCachedExternalConfig() {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get(EXTERNAL_CONFIG_CACHE_KEY, resolve);
        });

        const cached = result[EXTERNAL_CONFIG_CACHE_KEY];
        if (cached && cached.timestamp && cached.data) {
            const now = Date.now();
            if (now - cached.timestamp < EXTERNAL_CONFIG_CACHE_DURATION) {
                console.log('[AdSkip存储] 使用缓存的外部配置');
                return cached.data;
            } else {
                console.log('[AdSkip存储] 外部配置缓存已过期');
            }
        }
        return null;
    } catch (error) {
        console.log('[AdSkip存储] 获取外部配置缓存失败:', error);
        return null;
    }
}

/**
 * 保存外部配置到缓存
 * @param {Object} data - 配置数据
 * @returns {Promise<boolean>} 保存是否成功
 */
async function cacheExternalConfig(data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        await new Promise(resolve => {
            chrome.storage.local.set({[EXTERNAL_CONFIG_CACHE_KEY]: cacheData}, resolve);
        });
        console.log('[AdSkip存储] 外部配置已缓存');
        return true;
    } catch (error) {
        console.log('[AdSkip存储] 缓存外部配置失败:', error);
        return false;
    }
}

/**
 * 加载外部配置
 * @returns {Promise<Object>} 外部配置对象
 */
async function loadExternalConfig() {
    // 如果设置了PRIME_BASE_URL，仍然加载外部配置以获取version_hint等信息
    // 但API base URL会被PRIME_BASE_URL覆盖
    if (PRIME_BASE_URL) {
        console.log('[AdSkip存储] 检测到PRIME_BASE_URL设置，API请求将使用开发环境地址:', PRIME_BASE_URL);
    }

    try {
        // 先尝试使用缓存
        let config = await getCachedExternalConfig();

        if (!config) {
            // 缓存不存在或已过期，请求API
            console.log('[AdSkip存储] 请求外部配置文件');

            try {
                const response = await fetchWithTimeout(EXTERNAL_CONFIG_URL, EXTERNAL_CONFIG_TIMEOUT);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                config = await response.json();
                console.log('[AdSkip存储] 外部配置加载成功:', config);

                // 缓存新数据
                await cacheExternalConfig(config);
            } catch (fetchError) {
                console.log('[AdSkip存储] 外部配置请求失败，使用默认配置:', fetchError.message);
                config = DEFAULT_CONFIG;

                // 缓存默认配置（较短的缓存时间）
                const shortCacheData = {
                    timestamp: Date.now(),
                    data: config
                };
                await new Promise(resolve => {
                    chrome.storage.local.set({[EXTERNAL_CONFIG_CACHE_KEY]: shortCacheData}, resolve);
                });
            }
        }

        return config;
    } catch (error) {
        console.log('[AdSkip存储] 加载外部配置失败，使用默认配置:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * 动态构建API URL
 * @param {Object} config - 外部配置对象
 * @returns {Object} 包含各种API URL的对象
 */
function buildApiUrls(config) {
    // 优先级：PRIME_BASE_URL > 外部配置 > 默认配置
    let baseURL;

    if (PRIME_BASE_URL) {
        baseURL = PRIME_BASE_URL;
        console.log('[AdSkip存储] 使用开发环境配置的PRIME_BASE_URL:', baseURL);
    } else {
        baseURL = config?.api?.adSkipServerBaseURL || DEFAULT_CONFIG.api.adSkipServerBaseURL;
        console.log('[AdSkip存储] 使用外部配置或默认配置的baseURL:', baseURL);
    }

    return {
        detect: `${baseURL}/api/detect`,
        supportInfo: `${baseURL}/api/getSupportPicUrl`,
        userStats: `${baseURL}/api/user/stats`
    };
}

/**
 * 获取API URLs（统一接口）
 * @returns {Promise<Object>} 包含各种API URL的对象
 */
async function getApiUrls() {
    try {
        const baseURL = await getEffectiveBaseUrl();
        return buildApiUrls({ api: { adSkipServerBaseURL: baseURL } });
    } catch (error) {
        adskipUtils.logDebug('获取API URLs失败，使用默认配置:', error);
        return buildApiUrls(DEFAULT_CONFIG);
    }
}

/**
 * 新增：同步服务端数据到本地存储
 * @param {Object} serverData 服务端返回的统计数据
 * @returns {Promise<boolean>} 同步是否成功
 */
async function syncServerDataToLocal(serverData) {
    adskipUtils.logDebug(`[AdSkip存储] 开始同步服务端数据到本地`);

    try {
        const updates = {};
        let hasUpdates = false;

        // 获取当前本地数据
        const currentUsageStats = await getUsageStats();

        // 同步popup打开次数（使用较大值）
        if (serverData.local_popup_opens !== undefined) {
            const serverPopupOpens = serverData.local_popup_opens;
            const localPopupOpens = currentUsageStats.popupOpens;

            if (serverPopupOpens > localPopupOpens) {
                updates[STORAGE_KEYS.POPUP_OPEN_COUNT] = serverPopupOpens;
                hasUpdates = true;
                adskipUtils.logDebug(`[AdSkip存储] 更新popup打开次数: ${localPopupOpens} -> ${serverPopupOpens}`);
            }
        }

        // 同步分享按钮点击次数（使用较大值）
        if (serverData.local_share_clicks !== undefined) {
            const serverShareClicks = serverData.local_share_clicks;
            const localShareClicks = currentUsageStats.shareClicks;

            if (serverShareClicks > localShareClicks) {
                updates[STORAGE_KEYS.SHARE_CLICK_COUNT] = serverShareClicks;
                hasUpdates = true;
                adskipUtils.logDebug(`[AdSkip存储] 更新分享点击次数: ${localShareClicks} -> ${serverShareClicks}`);
            }
        }

        // 如果有更新，批量执行
        if (hasUpdates) {
            return new Promise(resolve => {
                chrome.storage.local.set(updates, () => {
                    const success = !chrome.runtime.lastError;
                    if (success) {
                        adskipUtils.logDebug(`[AdSkip存储] 服务端数据同步完成`);
                    } else {
                        adskipUtils.logDebug(`[AdSkip存储] 服务端数据同步失败: ${chrome.runtime.lastError?.message}`);
                    }
                    resolve(success);
                });
            });
        } else {
            adskipUtils.logDebug(`[AdSkip存储] 无需同步，本地数据已是最新`);
            return true;
        }
    } catch (error) {
        adskipUtils.logDebug(`[AdSkip存储] 同步服务端数据异常: ${error.message}`);
        return false;
    }
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
    getSkipOwnVideos,
    setSkipOwnVideos,

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

    // 新增的视频无广告白名单管理
    checkVideoInNoAdsWhitelist,
    addVideoToNoAdsWhitelist,

    // 新添加的函数
    clearUploaderCache,

    // 新增方法
    getLocalVideosProcessedCount,
    incrementLocalVideosProcessedCount,
    saveUserStatsCache,
    getUserStatsCache,
    saveUserUID,
    getUserUID,
    saveUserUsername,     // 新增: 用户名相关方法
    getUserUsername,      // 新增: 用户名相关方法

    // 新增方法
    recordLastStatsFetch,
    getLastStatsFetchInfo,
    shouldUpdateUserStats,

    // 新增方法
    saveQuotaExhaustedStatus,
    getQuotaExhaustedStatus,
    clearQuotaExhaustedStatus,
    checkAndClearQuotaIfNewDay,
    addVideoToQuotaFailedCache,
    checkVideoInQuotaFailedCache,
    clearQuotaFailedCache,

    // 新增方法
    forceRefreshUserStatsCache,

    // 新增: 用户行为统计相关函数
    incrementPopupOpenCount,
    incrementShareClickCount,
    getUsageStats,

    // 新增: 统一配置管理
    loadExternalConfig,
    getApiUrls,
    buildApiUrls,

    // 新增: 服务端数据同步
    syncServerDataToLocal,         // 新增: 服务端数据同步方法

    // 新增: 自定义服务器支持
    getEffectiveBaseUrl           // 新增: 获取有效的Base URL
};

/**
 * 获取有效的Base URL
 * 优先级: 用户自定义服务器 > 开发环境硬编码 > 外部配置 > 默认配置
 * @returns {Promise<string>} 有效的Base URL
 */
async function getEffectiveBaseUrl() {
    try {
        // 1. 检查用户自定义服务器配置
        const customConfig = await new Promise(resolve => {
            chrome.storage.sync.get(['customServerEnabled', 'customServerUrl'], resolve);
        });

        if (customConfig.customServerEnabled && customConfig.customServerUrl) {
            adskipUtils.logDebug('使用用户自定义服务器:', customConfig.customServerUrl);
            return customConfig.customServerUrl;
        }

        // 2. 检查开发环境硬编码
        if (PRIME_BASE_URL) {
            adskipUtils.logDebug('使用开发环境硬编码服务器:', PRIME_BASE_URL);
            return PRIME_BASE_URL;
        }

        // 3. 尝试加载外部配置
        const externalConfig = await loadExternalConfig();
        if (externalConfig && externalConfig.api && externalConfig.api.adSkipServerBaseURL) {
            adskipUtils.logDebug('使用外部配置服务器:', externalConfig.api.adSkipServerBaseURL);
            return externalConfig.api.adSkipServerBaseURL;
        }

        // 4. 使用默认配置
        adskipUtils.logDebug('使用默认服务器:', DEFAULT_CONFIG.api.adSkipServerBaseURL);
        return DEFAULT_CONFIG.api.adSkipServerBaseURL;

    } catch (error) {
        adskipUtils.logDebug('获取Base URL失败，使用默认配置:', error);
        return DEFAULT_CONFIG.api.adSkipServerBaseURL;
    }
}

/**
 * 从外部配置源加载配置，缓存策略
 */