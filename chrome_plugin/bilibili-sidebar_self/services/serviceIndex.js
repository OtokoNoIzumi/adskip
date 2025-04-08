/**
 * serviceIndex.js - 服务模块索引
 * 用于加载所有服务模块并确保依赖关系
 */

'use strict';

// 加载顺序很重要，需要按依赖关系加载
// 1. 首先加载apiService
// 2. 然后加载依赖apiService的bilibiliApi
// 3. 最后加载依赖前两者的其他服务

// 立即初始化全局服务对象，确保它们始终存在
window.adskipApiService = window.adskipApiService || {};
window.adskipBilibiliApi = window.adskipBilibiliApi || {};
window.adskipCredentialService = window.adskipCredentialService || {};
window.adskipSubtitleService = window.adskipSubtitleService || {};

// 定义服务模块内容

// API服务 - apiService
(function() {
    /**
     * 发送GET请求 - 使用通信模块通过后台服务发送
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async function get(url, options = {}) {
        try {
            // 通过后台服务发送请求
            return await window.adskipCommunication.fetchViaBackground(url, {
                method: 'GET',
                ...options
            });
        } catch (error) {
            adskipUtils.logDebug('API请求出错:', error);
            throw error;
        }
    }

    /**
     * 发送POST请求 - 使用通信模块通过后台服务发送
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async function post(url, data = {}, options = {}) {
        try {
            // 通过后台服务发送请求
            return await window.adskipCommunication.fetchViaBackground(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data),
                ...options
            });
        } catch (error) {
            adskipUtils.logDebug('API请求出错:', error);
            throw error;
        }
    }

    // 将函数导出到全局服务对象
    window.adskipApiService = {
        get,
        post
    };

    adskipUtils.logDebug('[AdSkip服务] API服务已加载');
})();

// B站API服务 - bilibiliApi
(function() {
    /**
     * 获取视频信息
     * @param {string} bvid 视频BV号
     * @returns {Promise<Object>} 视频信息
     */
    async function getVideoInfo(bvid) {
        if (!bvid) throw new Error('视频ID不能为空');

        const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        const response = await window.adskipApiService.get(url);

        if (response.code !== 0) {
            throw new Error(`获取视频信息失败: ${response.message}`);
        }

        return response.data;
    }

    /**
     * 获取视频字幕列表
     * @param {string} bvid 视频BV号
     * @param {number} cid 视频CID
     * @returns {Promise<Array>} 字幕列表
     */
    async function getVideoSubtitles(bvid, cid) {
        if (!bvid || !cid) throw new Error('视频ID和CID不能为空');

        const url = `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`;
        const response = await window.adskipApiService.get(url);

        if (response.code !== 0) {
            throw new Error(`获取字幕列表失败: ${response.message}`);
        }

        const subtitles = response.data?.subtitle?.list || [];
        return subtitles;
    }

    /**
     * 获取用户信息
     * @returns {Promise<Object>} 用户信息
     */
    async function getUserInfo() {
        const url = 'https://api.bilibili.com/x/web-interface/nav';
        const response = await window.adskipApiService.get(url);

        if (response.code !== 0) {
            throw new Error(`获取用户信息失败: ${response.message}`);
        }

        return response.data;
    }

    /**
     * 获取视频的cid
     * @param {string} bvid 视频BV号
     * @returns {Promise<number>} 视频CID
     */
    async function getVideoCid(bvid) {
        if (!bvid) throw new Error('视频ID不能为空');

        const videoInfo = await getVideoInfo(bvid);
        return videoInfo?.cid || null;
    }

    // 将函数导出到全局服务对象
    window.adskipBilibiliApi = {
        getVideoInfo,
        getVideoSubtitles,
        getUserInfo,
        getVideoCid
    };

    adskipUtils.logDebug('[AdSkip服务] B站API服务已加载');
})();

// 凭证服务 - credentialService
(function() {
    // 添加缓存变量
    let loginStatusCache = null;
    let loginStatusCacheTimestamp = 0;
    const LOGIN_CACHE_LIFETIME = 60000; // 登录状态缓存1分钟

    /**
     * 获取B站登录状态和用户信息 - 通过API获取
     * @returns {Promise<Object>} 用户登录状态信息
     */
    async function getBilibiliLoginStatus() {
        try {
            // 检查缓存是否有效
            const now = Date.now();
            if (loginStatusCache && (now - loginStatusCacheTimestamp < LOGIN_CACHE_LIFETIME)) {
                adskipUtils.logDebug('[AdSkip服务] 使用缓存的登录状态数据');
                return loginStatusCache;
            }

            adskipUtils.logDebug('[AdSkip服务] 正在获取B站登录状态...');
            const url = 'https://api.bilibili.com/x/web-interface/nav';
            const data = await window.adskipApiService.get(url);

            if (data.code !== 0) {
                throw new Error(`获取用户信息失败: ${data.message}`);
            }

            const userInfo = data.data;
            adskipUtils.logDebug('[AdSkip服务] 成功获取登录状态:', userInfo.isLogin ? '已登录' : '未登录');

            // 返回标准格式的用户信息
            const result = {
                isLoggedIn: userInfo.isLogin,
                username: userInfo.uname || '未知用户',
                uid: userInfo.mid,
                avatar: userInfo.face,
                vipType: userInfo.vipType,
                vipStatus: userInfo.vipStatus,
                vipDueDate: userInfo.vipDueDate,
                level: userInfo.level_info?.current_level,
                money: userInfo.money,
                // 包含原始数据，用于调试
                ...userInfo,
                source: 'API'
            };

            // 更新缓存
            loginStatusCache = result;
            loginStatusCacheTimestamp = now;

            return result;
        } catch (error) {
            adskipUtils.logDebug('获取登录状态失败:', error);
            return {
                isLoggedIn: false,
                username: '未知用户',
                message: `API获取失败: ${error.message}`
            };
        }
    }

    // 将函数导出到全局服务对象
    window.adskipCredentialService = {
        getBilibiliLoginStatus
    };

    adskipUtils.logDebug('[AdSkip服务] 凭证服务已加载');
})();

// 字幕服务 - subtitleService
(function() {
    // 添加视频数据缓存
    let videoDataCache = null;
    let cacheTimestamp = 0;
    const CACHE_LIFETIME = 30000; // 缓存有效期30秒

    // 添加字幕列表缓存
    let subtitlesCache = null;
    let subtitlesCacheTimestamp = 0;

    // 添加字幕文件缓存
    const subtitleFileCache = new Map();
    const SUBTITLE_CACHE_LIFETIME = 60000; // 字幕文件缓存1分钟

    /**
     * 获取视频字幕信息 - 直接通过API获取
     * @param {string} bvid 视频BV号
     * @returns {Promise<Object>} 字幕信息
     */
    async function getVideoSubtitles() {
        try {
            const result = {
                hasSubtitleFeature: false,
                subtitles: [],
                message: ''
            };

            // 使用utils中的函数获取视频ID信息
            const videoIdInfo = adskipUtils.getCurrentVideoId();
            const { bvid, epid, id } = videoIdInfo;

            // 检查缓存是否有效
            const now = Date.now();
            if (subtitlesCache && (now - subtitlesCacheTimestamp < CACHE_LIFETIME) && subtitlesCache.rawData.bvid === bvid) {
                adskipUtils.logDebug('[AdSkip服务] 使用缓存的字幕列表数据', { data: subtitlesCache, timestamp: subtitlesCacheTimestamp });
                return subtitlesCache;
            }

            // 获取当前视频ID和CID
            const videoData = await getVideoData();
            if (!videoData.aid || !videoData.cid) {
                result.message = '无法获取视频aid或cid';
                return result;
            }

            // 所有视频（包括番剧）都使用统一的API通过aid和cid获取字幕
            const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${videoData.aid}&cid=${videoData.cid}`;
            adskipUtils.logDebug('[AdSkip服务] 使用统一字幕API获取字幕列表:', url);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data.code !== 0) {
                    throw new Error(`获取字幕列表失败: ${data.message}`);
                }

                // 保存原始API响应数据
                result.rawData = data.data;

                // 提取字幕列表
                const subtitles = data.data?.subtitle?.subtitles || [];

                result.subtitles = subtitles.map(sub => ({
                    id: sub.id,
                    language: sub.lan,
                    languageName: sub.lan_doc,
                    url: sub.subtitle_url.startsWith('//') ? `https:${sub.subtitle_url}` : sub.subtitle_url,
                    isDefault: sub.type === 1 || !!sub.is_default
                }));

                result.hasSubtitleFeature = true; // 如果API调用成功，我们认为该视频支持字幕功能，即使当前可能没有字幕
                result.message = subtitles.length > 0 ? `成功获取到${subtitles.length}个字幕` : '此视频没有字幕';

                // 更新缓存
                subtitlesCache = result;
                subtitlesCacheTimestamp = now;

                return result;
            } catch (apiError) {
                adskipUtils.logDebug('[AdSkip服务] 字幕API请求失败:', apiError);
                result.message = `字幕API请求失败: ${apiError.message}`;
                return result;
            }
        } catch (error) {
            adskipUtils.logDebug('[AdSkip服务] 获取字幕信息失败:', error);
            return {
                hasSubtitleFeature: false,
                subtitles: [],
                message: `获取字幕信息失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前视频的aid和cid（带缓存）
     * @param {boolean} forceRefresh 是否强制刷新缓存
     * @returns {Promise<Object>} 包含aid和cid的对象
     */
    async function getVideoData(forceRefresh = false) {
        // 检查缓存是否有效
        const now = Date.now();
        if (!forceRefresh && videoDataCache && (now - cacheTimestamp < CACHE_LIFETIME)) {
            adskipUtils.logDebug('[AdSkip服务] 使用缓存的视频数据');
            return videoDataCache;
        }

        try {
            adskipUtils.logDebug('[AdSkip服务] 开始获取视频数据...');

            // 使用utils中的函数获取视频ID信息
            const videoIdInfo = adskipUtils.getCurrentVideoId();
            const { bvid, epid, id } = videoIdInfo;


            adskipUtils.logDebug('[AdSkip服务] 视频ID信息:', videoIdInfo);

            // 初始化返回对象
            let result = {
                bvid: bvid,
                aid: null,
                cid: null,
                title: '',
                uploader: '',
                epid: epid
            };

            // 处理番剧信息获取
            if (epid) {
                // 使用番剧API获取信息
                adskipUtils.logDebug('[AdSkip服务] 使用番剧API获取信息，EP ID:', epid);
                try {
                    const url = `https://api.bilibili.com/pgc/player/web/v2/playurl?ep_id=${epid}&qn=120&fnval=4048`;
                    const data = await window.adskipApiService.get(url);

                    if (data.code === 0 && data.result) {
                        adskipUtils.logDebug('[AdSkip服务] 番剧API返回成功');
                        const epInfo = data.result.play_view_business_info?.episode_info;

                        // 保存原始番剧API响应数据
                        result.rawBangumiData = data.result;
                        result.epInfo = epInfo;

                        if (epInfo) {
                            // result.aid = epInfo.aid;
                            result.bvid = epInfo.bvid;
                            // result.cid = epInfo.cid;
                            result.title = epInfo.long_title || epInfo.ep_title || epInfo.title;
                            // result.uploader = epInfo.title;

                            adskipUtils.logDebug('[AdSkip服务] 成功获取番剧信息:', {
                                title: result.title,
                                bvid: result.bvid,
                                long_title: epInfo.long_title,
                                ep_title: epInfo.ep_title,
                                raw_title: epInfo.title
                            });
                        }
                    } else {
                        adskipUtils.logDebug('[AdSkip服务] 番剧API返回失败:', data?.message || '未知错误');
                    }
                } catch (apiError) {
                    adskipUtils.logDebug('[AdSkip服务] 获取番剧API信息失败:', apiError);
                }
            }

            // 如果现在有bvid（无论是番剧获取的还是普通视频的），都用统一的方式获取详细信息
            if (result.bvid || bvid) {
                // 使用普通视频API获取信息
                const videoBvid = result.bvid || bvid;
                adskipUtils.logDebug('[AdSkip服务] 使用视频API获取详细信息, BVid:', videoBvid);
                try {
                    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${videoBvid}`;
                    const data = await window.adskipApiService.get(url);

                    if (data.code === 0 && data.data) {
                        adskipUtils.logDebug('[AdSkip服务] 视频API返回成功');
                        result.aid = data.data.aid;
                        result.cid = data.data.cid;
                        result.title = result.title || data.data.title;
                        result.uploader = data.data.owner?.name || '未知UP主';

                        // 保存原始视频API响应数据
                        result.rawVideoData = data.data;

                        // 保存服务器通信所需的关键字段
                        result.pages = data.data.pages;
                        result.owner = data.data.owner;
                        result.desc = data.data.desc;
                        result.dynamic = data.data.dynamic;
                        result.duration = data.data.duration;
                        result.pubdate = data.data.pubdate;
                        result.dimension = data.data.dimension;
                        result.subtitle = data.data.subtitle;
                    } else {
                        adskipUtils.logDebug('[AdSkip服务] 视频API返回失败:', data?.message || '未知错误');
                    }
                } catch (apiError) {
                    adskipUtils.logDebug('[AdSkip服务] 获取视频API信息失败:', apiError);
                }
            }

            // 检查最终结果是否完整
            const hasCompleteInfo = !!(result.aid && result.cid);
            adskipUtils.logDebug('[AdSkip服务] 最终获取到的视频元数据' + (hasCompleteInfo ? '完整' : '不完整') + ':', {
                bvid: result.bvid,
                aid: result.aid,
                cid: result.cid,
                epid: result.epid,
                title: result.title,
                epTitle: result.epTitle,
                uploader: result.uploader
            });

            // 更新缓存
            if (hasCompleteInfo) {
                videoDataCache = result;
                cacheTimestamp = now;
            }

            return result;
        } catch (error) {
            adskipUtils.logDebug('[AdSkip服务] 获取视频数据失败:', error);
            return { bvid: null, aid: null, cid: null, epid: null };
        }
    }

    /**
     * 下载字幕文件
     * @param {string} url 字幕文件URL
     * @returns {Promise<Object>} 字幕内容 - 已优化格式的字幕数据，以及原始完整字幕
     */
    async function downloadSubtitleFile(url) {
        try {
            if (!url) throw new Error('字幕URL不能为空');

            // 检查缓存
            const now = Date.now();
            if (subtitleFileCache.has(url)) {
                const cacheEntry = subtitleFileCache.get(url);
                if (now - cacheEntry.timestamp < SUBTITLE_CACHE_LIFETIME) {
                    adskipUtils.logDebug('[AdSkip服务] 使用缓存的字幕文件数据:', url);
                    return cacheEntry.data;
                }
            }

            adskipUtils.logDebug('[AdSkip服务] 开始下载字幕文件:', url);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Referer': 'https://www.bilibili.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`下载字幕失败: ${response.status} ${response.statusText}`);
            }

            const rawSubtitleData = await response.json();
            adskipUtils.logDebug('[AdSkip服务] 字幕文件下载成功');

            // 返回标准格式的字幕数据
            let processedData = {
                originalData: null,   // 原始完整数据，供需要的地方使用
                subtitles: [],        // 标准化处理后的字幕数组 [{ from, content }]
                preview: []           // 前10条预览 [{ time: "mm:ss", text: "内容" }]
            };

            // 处理B站字幕标准格式: {body: [{from, to, content}]}
            if (rawSubtitleData && rawSubtitleData.body && Array.isArray(rawSubtitleData.body)) {
                // 保存原始数据引用（可以用于特殊场景）
                processedData.originalData = rawSubtitleData;

                // 提取标准化字幕内容（只保留from和content字段）
                processedData.subtitles = rawSubtitleData.body.map(item => ({
                    from: item.from,
                    content: item.content
                }));

                // 生成预览内容（前10条，格式化时间）
                processedData.preview = rawSubtitleData.body.slice(0, 10).map(item => ({
                    time: formatSubtitleTime(item.from),
                    text: item.content
                }));

                adskipUtils.logDebug('[AdSkip服务] 成功处理字幕内容，共', rawSubtitleData.body.length, '条');
            } else {
                // 如果不是标准格式，保留原始数据
                processedData.originalData = rawSubtitleData;
                adskipUtils.logDebug('[AdSkip服务] 非标准字幕格式，保留原始数据');
            }

            // 更新缓存
            subtitleFileCache.set(url, {
                data: processedData,
                timestamp: now
            });

            // 清理过期缓存
            if (subtitleFileCache.size > 20) {
                // 如果缓存项超过20个，清理过期项
                for (const [cacheUrl, cacheEntry] of subtitleFileCache.entries()) {
                    if (now - cacheEntry.timestamp > SUBTITLE_CACHE_LIFETIME) {
                        subtitleFileCache.delete(cacheUrl);
                    }
                }
            }

            return processedData;
        } catch (error) {
            adskipUtils.logDebug('[AdSkip服务] 下载字幕文件失败:', error);
            throw error;
        }
    }

    /**
     * 获取字幕内容预览
     * @returns {Promise<Object>} 字幕预览信息
     */
    async function getSubtitlePreview() {
        try {
            adskipUtils.logDebug('[AdSkip服务] 开始获取字幕预览...');
            const result = {
                availableLanguages: [],
                subtitleContent: [],
                message: ''
            };

            // 使用已缓存的字幕信息
            const subtitleInfo = await getVideoSubtitles();
            if (!subtitleInfo.hasSubtitleFeature) {
                adskipUtils.logDebug('[AdSkip服务] 当前视频没有字幕功能:', subtitleInfo.message);
                result.message = subtitleInfo.message;
                return result;
            }

            adskipUtils.logDebug('[AdSkip服务] 获取到字幕列表:', subtitleInfo.subtitles.length, '个字幕');

            // 提取可用语言列表
            result.availableLanguages = subtitleInfo.subtitles.map(sub => sub.languageName);
            adskipUtils.logDebug('[AdSkip服务] 可用字幕语言:', result.availableLanguages.join(', '));

            // 如果没有字幕，直接返回可用语言列表
            if (subtitleInfo.subtitles.length === 0) {
                result.message = '此视频没有字幕';
                return result;
            }

            // 获取默认字幕或第一个字幕的内容
            const defaultSubtitle = subtitleInfo.subtitles.find(sub => sub.isDefault) || subtitleInfo.subtitles[0];
            if (defaultSubtitle && defaultSubtitle.url) {
                adskipUtils.logDebug('[AdSkip服务] 尝试获取字幕内容:', defaultSubtitle.languageName, defaultSubtitle.url);

                try {
                    // 下载字幕文件 - 已处理格式
                    const processedSubtitle = await downloadSubtitleFile(defaultSubtitle.url);

                    if (!processedSubtitle || processedSubtitle.subtitles.length === 0) {
                        adskipUtils.logDebug('[AdSkip服务] 字幕内容为空');
                        result.message = '字幕内容为空';
                        return result;
                    }

                    // 使用已处理好的字幕内容
                    result.subtitleContent = processedSubtitle.preview; // 使用已经处理好的预览
                    result.rawSubtitleOriginal = processedSubtitle.subtitles; // 使用标准化的字幕内容
                    result.rawFullSubtitle = processedSubtitle; // 保存完整的处理结果
                    result.message = `成功获取"${defaultSubtitle.languageName}"字幕预览`;
                    adskipUtils.logDebug('[AdSkip服务] 提取到', result.subtitleContent.length, '条字幕预览，共', processedSubtitle.subtitles.length, '条完整字幕');
                } catch (downloadError) {
                    adskipUtils.logDebug('[AdSkip服务] 下载字幕失败:', downloadError);
                    result.message = `下载字幕失败: ${downloadError.message}`;
                }
            } else {
                adskipUtils.logDebug('[AdSkip服务] 找不到可用的字幕文件URL');
                result.message = '找不到可用的字幕文件URL';
            }

            // 添加原始响应数据
            result.rawSubtitleInfo = subtitleInfo.rawData;

            return result;
        } catch (error) {
            adskipUtils.logDebug('[AdSkip服务] 获取字幕预览失败:', error);
            return {
                availableLanguages: [],
                subtitleContent: [],
                message: `获取字幕预览失败: ${error.message}`
            };
        }
    }

    /**
     * 格式化字幕时间
     * @param {number} seconds 秒数
     * @returns {string} 格式化的时间字符串 mm:ss
     */
    function formatSubtitleTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 清除字幕相关缓存
     * 在视频切换时调用，确保获取到新视频的字幕信息
     */
    function clearCache() {
        subtitlesCache = null;
        subtitlesCacheTimestamp = 0;
        videoDataCache = null;
        cacheTimestamp = 0;
        // subtitleFileCache.clear(); // 清除字幕文件缓存
        adskipUtils.logDebug('[AdSkip服务] 字幕服务缓存已清除');
        return true;
    }

    window.adskipSubtitleService = {
        getVideoSubtitles,
        getSubtitlePreview,
        downloadSubtitleFile,
        getVideoData,
        clearCache
    };

    adskipUtils.logDebug('[AdSkip服务] 字幕服务已加载');
})();
