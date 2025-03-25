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
     * 发送GET请求
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async function get(url, options = {}) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                ...options
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求出错:', error);
            throw error;
        }
    }

    /**
     * 发送POST请求
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async function post(url, data = {}, options = {}) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data),
                ...options
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求出错:', error);
            throw error;
        }
    }

    // 将函数导出到全局服务对象
    window.adskipApiService = {
        get,
        post
    };

    console.log('[AdSkip服务] API服务已加载');
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

    console.log('[AdSkip服务] B站API服务已加载');
})();

// 凭证服务 - credentialService
(function() {
    /**
     * 获取B站登录状态和用户信息 - 通过API获取
     * @returns {Promise<Object>} 用户登录状态信息
     */
    async function getBilibiliLoginStatus() {
        try {
            console.log('[AdSkip服务] 正在获取B站登录状态...');
            const url = 'https://api.bilibili.com/x/web-interface/nav';
            const data = await window.adskipApiService.get(url);

            if (data.code !== 0) {
                throw new Error(`获取用户信息失败: ${data.message}`);
            }

            const userInfo = data.data;
            console.log('[AdSkip服务] 成功获取登录状态:', userInfo.isLogin ? '已登录' : '未登录');

            // 返回标准格式的用户信息
            return {
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
        } catch (error) {
            console.error('获取登录状态失败:', error);
            return {
                isLoggedIn: false,
                username: '未知用户',
                message: `API获取失败: ${error.message}`
            };
        }
    }

    /**
     * 检查用户是否为大会员
     * @returns {Promise<boolean>} 是否为大会员
     */
    async function checkVipStatus() {
        try {
            const userInfo = await getBilibiliLoginStatus();
            return userInfo.isLoggedIn && (userInfo.vipType > 0) && (userInfo.vipStatus === 1);
        } catch (error) {
            console.error('检查大会员状态失败:', error);
            return false;
        }
    }

    // 将函数导出到全局服务对象
    window.adskipCredentialService = {
        getBilibiliLoginStatus,
        checkVipStatus
    };

    console.log('[AdSkip服务] 凭证服务已加载');
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

    /**
     * 获取视频字幕信息 - 直接通过API获取
     * @returns {Promise<Object>} 字幕信息
     */
    async function getVideoSubtitles() {
        try {
            // 检查缓存是否有效
            const now = Date.now();
            if (subtitlesCache && (now - subtitlesCacheTimestamp < CACHE_LIFETIME)) {
                console.log('[AdSkip服务] 使用缓存的字幕列表数据');
                return subtitlesCache;
            }

            const result = {
                hasSubtitleFeature: false,
                subtitles: [],
                message: ''
            };

            // 获取当前视频ID和CID
            const videoData = await getVideoData();
            if (!videoData.aid || !videoData.cid) {
                result.message = '无法获取视频aid或cid';
                return result;
            }

            // 所有视频（包括番剧）都使用统一的API通过aid和cid获取字幕
            const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${videoData.aid}&cid=${videoData.cid}`;
            console.log('[AdSkip服务] 使用统一字幕API获取字幕列表:', url);

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
                console.error('[AdSkip服务] 字幕API请求失败:', apiError);
                result.message = `字幕API请求失败: ${apiError.message}`;
                return result;
            }
        } catch (error) {
            console.error('[AdSkip服务] 获取字幕信息失败:', error);
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
            console.log('[AdSkip服务] 使用缓存的视频数据');
            return videoDataCache;
        }

        try {
            console.log('[AdSkip服务] 开始获取视频数据...');
            // 检查是普通视频还是番剧页面
            const currentUrl = window.location.href;
            const isBangumi = currentUrl.includes('/bangumi/play/') ||
                              currentUrl.includes('/play/ep') ||
                              currentUrl.includes('/play/ss');
            console.log('[AdSkip服务] 视频类型:', isBangumi ? '番剧页面' : '普通视频页面');

            // 获取视频ID (BV号或EP号)
            let bvid = null;
            let epid = null;

            if (isBangumi) {
                // 从番剧URL中提取ep号
                const epMatch = currentUrl.match(/\/play\/ep(\d+)/);
                if (epMatch && epMatch[1]) {
                    epid = epMatch[1];
                    console.log('[AdSkip服务] 从URL提取到番剧epid:', epid);
                } else {
                    // 尝试提取ss号 - 如果需要
                    const ssMatch = currentUrl.match(/\/bangumi\/play\/ss(\d+)/) ||
                                   currentUrl.match(/\/play\/ss(\d+)/);
                    if (ssMatch && ssMatch[1]) {
                        console.log('[AdSkip服务] 从URL提取到番剧ssid:', ssMatch[1]);
                        // 这里可以添加ss号的处理逻辑
                    }
                }
            } else {
                // 从普通视频URL中提取BV号
                const bvMatch = currentUrl.match(/\/video\/(BV[\w]+)/);
                if (bvMatch && bvMatch[1]) {
                    bvid = bvMatch[1];
                    console.log('[AdSkip服务] 从URL提取到BV号:', bvid);
                }
            }

            // 初始化返回对象
            let result = {
                bvid: bvid,
                aid: null,
                cid: null,
                title: '',
                uploader: '',
                epid: epid
            };

            // 先处理番剧，获取其BVid
            if (isBangumi && epid) {
                // 使用番剧API获取信息
                console.log('[AdSkip服务] 使用番剧API获取信息');
                try {
                    const url = `https://api.bilibili.com/pgc/player/web/v2/playurl?ep_id=${epid}&qn=120&fnval=4048`;
                    const data = await window.adskipApiService.get(url);

                    if (data.code === 0 && data.result) {
                        console.log('[AdSkip服务] 番剧API返回成功');
                        const epInfo = data.result.play_view_business_info?.episode_info;

                        // 保存原始番剧API响应数据
                        result.rawBangumiData = data.result;
                        result.epInfo = epInfo;

                        if (epInfo) {
                            // result.aid = epInfo.aid;
                            result.bvid = epInfo.bvid;
                            // result.cid = epInfo.cid;
                            result.title = epInfo.epTitle;
                            // result.uploader = epInfo.title;
                        }
                    } else {
                        console.log('[AdSkip服务] 番剧API返回失败:', data?.message || '未知错误');
                    }
                } catch (apiError) {
                    console.error('[AdSkip服务] 获取番剧API信息失败:', apiError);
                }
            }

            // 如果现在有bvid（无论是番剧获取的还是普通视频的），都用统一的方式获取详细信息
            if (result.bvid || bvid) {
                // 使用普通视频API获取信息
                const videoBvid = result.bvid || bvid;
                console.log('[AdSkip服务] 使用视频API获取详细信息, BVid:', videoBvid);
                try {
                    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${videoBvid}`;
                    const data = await window.adskipApiService.get(url);

                    if (data.code === 0 && data.data) {
                        console.log('[AdSkip服务] 视频API返回成功');
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
                        console.log('[AdSkip服务] 视频API返回失败:', data?.message || '未知错误');
                    }
                } catch (apiError) {
                    console.error('[AdSkip服务] 获取视频API信息失败:', apiError);
                }
            }

            // 检查最终结果是否完整
            const hasCompleteInfo = !!(result.aid && result.cid);
            console.log('[AdSkip服务] 最终获取到的视频数据' + (hasCompleteInfo ? '完整' : '不完整') + ':', {
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
            console.error('[AdSkip服务] 获取视频数据失败:', error);
            return { bvid: null, aid: null, cid: null, epid: null };
        }
    }

    /**
     * 获取字幕内容预览
     * @returns {Promise<Object>} 字幕预览信息
     */
    async function getSubtitlePreview() {
        try {
            console.log('[AdSkip服务] 开始获取字幕预览...');
            const result = {
                availableLanguages: [],
                subtitleContent: [],
                message: ''
            };

            // 使用已缓存的字幕信息
            const subtitleInfo = await getVideoSubtitles();
            if (!subtitleInfo.hasSubtitleFeature) {
                console.log('[AdSkip服务] 当前视频没有字幕功能:', subtitleInfo.message);
                result.message = subtitleInfo.message;
                return result;
            }

            console.log('[AdSkip服务] 获取到字幕列表:', subtitleInfo.subtitles.length, '个字幕');

            // 提取可用语言列表
            result.availableLanguages = subtitleInfo.subtitles.map(sub => sub.languageName);
            console.log('[AdSkip服务] 可用字幕语言:', result.availableLanguages.join(', '));

            // 如果没有字幕，直接返回可用语言列表
            if (subtitleInfo.subtitles.length === 0) {
                result.message = '此视频没有字幕';
                return result;
            }

            // 获取默认字幕或第一个字幕的内容
            const defaultSubtitle = subtitleInfo.subtitles.find(sub => sub.isDefault) || subtitleInfo.subtitles[0];
            if (defaultSubtitle && defaultSubtitle.url) {
                console.log('[AdSkip服务] 尝试获取字幕内容:', defaultSubtitle.languageName, defaultSubtitle.url);

                try {
                    // 下载字幕文件
                    const subtitleContent = await downloadSubtitleFile(defaultSubtitle.url);

                    if (!subtitleContent) {
                        console.log('[AdSkip服务] 字幕内容为空');
                        result.message = '字幕内容为空';
                        return result;
                    }

                    // 保存原始字幕数据供完整展示使用
                    if (subtitleContent.body && Array.isArray(subtitleContent.body)) {
                        result.rawSubtitleOriginal = subtitleContent.body;
                    }

                    // B站字幕只处理标准格式: {body: [{from, to, content}]}
                    if (subtitleContent.body && Array.isArray(subtitleContent.body)) {
                        console.log('[AdSkip服务] 检测到标准字幕格式 (body数组)');
                        result.subtitleContent = subtitleContent.body.slice(0, 10).map(item => ({
                            time: formatSubtitleTime(item.from),
                            text: item.content
                        }));
                        result.message = `成功获取"${defaultSubtitle.languageName}"字幕预览`;
                        console.log('[AdSkip服务] 提取到', result.subtitleContent.length, '条字幕预览，共', subtitleContent.body.length, '条完整字幕');
                    } else {
                        console.log('[AdSkip服务] 未知字幕格式:', typeof subtitleContent, Object.keys(subtitleContent).join(', '));
                        result.message = '字幕文件格式无法识别';
                    }
                } catch (downloadError) {
                    console.error('[AdSkip服务] 下载字幕失败:', downloadError);
                    result.message = `下载字幕失败: ${downloadError.message}`;
                }
            } else {
                console.log('[AdSkip服务] 找不到可用的字幕文件URL');
                result.message = '找不到可用的字幕文件URL';
            }

            // 添加原始响应数据
            result.rawSubtitleInfo = subtitleInfo.rawData;

            return result;
        } catch (error) {
            console.error('[AdSkip服务] 获取字幕预览失败:', error);
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
     * 下载字幕文件
     * @param {string} url 字幕文件URL
     * @returns {Promise<Object>} 字幕内容
     */
    async function downloadSubtitleFile(url) {
        try {
            if (!url) throw new Error('字幕URL不能为空');

            console.log('[AdSkip服务] 开始下载字幕文件:', url);
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

            const subtitleData = await response.json();
            console.log('[AdSkip服务] 字幕文件下载成功');
            return subtitleData;
        } catch (error) {
            console.error('[AdSkip服务] 下载字幕文件失败:', error);
            throw error;
        }
    }

    // 将函数导出到全局服务对象
    window.adskipSubtitleService = {
        getVideoSubtitles,
        getSubtitlePreview,
        downloadSubtitleFile,
        getVideoData
    };

    console.log('[AdSkip服务] 字幕服务已加载');
})();

// 服务加载完成后触发事件
console.log('[AdSkip服务] 所有服务模块加载完成');
document.dispatchEvent(new CustomEvent('adskip_services_loaded'));