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
window.adskipUserDataService = window.adskipUserDataService || {};

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
            const userInfo = await getUserInfoFromAPI();

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
     * 从B站API获取用户信息
     * @returns {Promise<Object>} 用户信息
     */
    async function getUserInfoFromAPI() {
        try {
            const url = 'https://api.bilibili.com/x/web-interface/nav';
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.code !== 0) {
                throw new Error(`获取用户信息失败: ${data.message}`);
            }

            return data.data;
        } catch (error) {
            console.error('API获取用户信息失败:', error);
            throw error;
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
        getUserInfoFromAPI,
        checkVipStatus
    };

    console.log('[AdSkip服务] 凭证服务已加载');
})();

// 字幕服务 - subtitleService
(function() {
    /**
     * 获取视频字幕信息 - 直接通过API获取
     * @returns {Promise<Object>} 字幕信息
     */
    async function getVideoSubtitles() {
        try {
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

            // 根据视频类型选择正确的API
            let url;
            let isBangumi = !!videoData.epid;

            if (isBangumi) {
                // 番剧使用的API
                url = `https://api.bilibili.com/pgc/player/web/v2/playurl?ep_id=${videoData.epid}&cid=${videoData.cid}`;
            } else {
                // 普通视频使用的API
                url = `https://api.bilibili.com/x/player/wbi/v2?aid=${videoData.aid}&cid=${videoData.cid}`;
            }

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

            // 提取字幕列表 - 番剧和普通视频的数据结构可能不同
            let subtitles = [];
            if (isBangumi) {
                subtitles = data.result?.subtitle?.subtitles || [];
            } else {
                subtitles = data.data?.subtitle?.subtitles || [];
            }

            result.subtitles = subtitles.map(sub => ({
                id: sub.id,
                language: sub.lan,
                languageName: sub.lan_doc,
                url: sub.subtitle_url.startsWith('//') ? `https:${sub.subtitle_url}` : sub.subtitle_url,
                isDefault: sub.type === 1 || !!sub.is_default
            }));

            result.hasSubtitleFeature = subtitles.length > 0;
            result.message = subtitles.length > 0 ? `成功获取到${subtitles.length}个字幕` : '此视频没有字幕';

            return result;
        } catch (error) {
            console.error('获取字幕信息失败:', error);
            return {
                hasSubtitleFeature: false,
                subtitles: [],
                message: `获取字幕信息失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前视频的aid和cid
     * @returns {Promise<Object>} 包含aid和cid的对象
     */
    async function getVideoData() {
        try {
            // 检查是普通视频还是番剧页面
            const isBangumi = window.location.pathname.includes('/bangumi/play/');

            // 获取视频ID (BV号或EP号)
            let bvid = null;
            let epid = null;

            if (isBangumi) {
                // 从番剧URL中提取ep号
                epid = window.location.pathname.match(/\/bangumi\/play\/ep(\d+)/)?.[1];
                if (!epid) {
                    // 尝试提取ss号
                    const ssid = window.location.pathname.match(/\/bangumi\/play\/ss(\d+)/)?.[1];
                    if (ssid) {
                        console.log('获取到番剧ssid:', ssid);
                        // 需要通过API获取当前播放剧集的epid
                        // 此处可能需要额外实现，暂时跳过
                    }
                } else {
                    console.log('获取到番剧epid:', epid);
                }
            } else {
                // 从普通视频URL中提取BV号
                bvid = window.location.pathname.match(/\/video\/(BV[\w]+)/)?.[1];
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

            // 尝试从页面脚本获取视频信息
            const videoInfoScript = Array.from(document.querySelectorAll('script'))
                .find(script => script.textContent.includes('window.__INITIAL_STATE__'));

            if (videoInfoScript) {
                const match = videoInfoScript.textContent.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);

                    if (isBangumi) {
                        // 番剧页面的数据结构
                        if (data.epInfo) {
                            result.aid = data.epInfo.aid || null;
                            result.cid = data.epInfo.cid || null;
                            result.bvid = data.epInfo.bvid || null;
                            result.title = data.mediaInfo?.title || data.h1Title || '';
                            result.uploader = '哔哩哔哩番剧';
                            result.epTitle = data.epInfo.longTitle || data.epInfo.title || '';
                        } else if (data.epList && data.epList.length > 0 && epid) {
                            // 在epList中查找对应的ep
                            const ep = data.epList.find(ep => ep.id == epid);
                            if (ep) {
                                result.aid = ep.aid || null;
                                result.cid = ep.cid || null;
                                result.bvid = ep.bvid || null;
                                result.title = data.mediaInfo?.title || data.h1Title || '';
                                result.uploader = '哔哩哔哩番剧';
                                result.epTitle = ep.longTitle || ep.title || '';
                            }
                        }
                    } else {
                        // 普通视频页面的数据结构
                        result.aid = data.videoData?.aid || data.aid || null;
                        result.cid = data.videoData?.cid || data.cid || null;
                        result.bvid = data.videoData?.bvid || data.bvid || bvid || null;
                        result.title = data.videoData?.title || data.title || '';
                        result.uploader = data.videoData?.owner?.name || '';
                    }
                }
            }

            // 如果从页面无法获取完整信息，尝试通过API获取
            if ((!result.aid || !result.cid) && (result.bvid || result.epid)) {
                if (isBangumi && result.epid) {
                    // 使用番剧API获取信息
                    try {
                        const url = `https://api.bilibili.com/pgc/player/web/v2/playurl?ep_id=${result.epid}&qn=120&fnval=4048`;
                        const response = await fetch(url, {
                            method: 'GET',
                            credentials: 'include'
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.code === 0 && data.result) {
                                const epInfo = data.result.play_view_business_info?.episode_info;
                                if (epInfo) {
                                    result.aid = epInfo.aid || result.aid;
                                    result.bvid = epInfo.bvid || result.bvid;
                                    result.cid = epInfo.cid || result.cid;
                                    result.title = epInfo.title || result.title;
                                    result.epTitle = epInfo.long_title || epInfo.title || result.epTitle;

                                    // 如果已有aid但没有cid，尝试使用另一个API
                                    if (result.aid && !result.cid) {
                                        const videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?aid=${result.aid}`;
                                        const videoInfoResp = await fetch(videoInfoUrl, {
                                            method: 'GET',
                                            credentials: 'include'
                                        });

                                        if (videoInfoResp.ok) {
                                            const videoData = await videoInfoResp.json();
                                            if (videoData.code === 0 && videoData.data) {
                                                result.cid = videoData.data.cid || result.cid;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (apiError) {
                        console.error('获取番剧API信息失败:', apiError);
                    }
                } else if (result.bvid) {
                    // 使用普通视频API获取信息
                    try {
                        const url = `https://api.bilibili.com/x/web-interface/view?bvid=${result.bvid}`;
                        const response = await fetch(url, {
                            method: 'GET',
                            credentials: 'include'
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.code === 0 && data.data) {
                                result.aid = data.data.aid || result.aid;
                                result.cid = data.data.cid || result.cid;
                                result.title = data.data.title || result.title;
                                result.uploader = data.data.owner?.name || result.uploader;
                            }
                        }
                    } catch (apiError) {
                        console.error('获取视频API信息失败:', apiError);
                    }
                }
            }

            // 确保输出完整的日志
            console.log('获取到视频数据:', {
                bvid: result.bvid,
                aid: result.aid,
                cid: result.cid,
                epid: result.epid,
                title: result.title,
                epTitle: result.epTitle,
                uploader: result.uploader
            });

            return result;
        } catch (error) {
            console.error('获取视频数据失败:', error);
            return { bvid: null, aid: null, cid: null, epid: null };
        }
    }

    /**
     * 获取字幕内容预览
     * @returns {Promise<Object>} 字幕预览信息
     */
    async function getSubtitlePreview() {
        try {
            const result = {
                availableLanguages: [],
                subtitleContent: [],
                message: ''
            };

            // 获取字幕信息
            const subtitleInfo = await getVideoSubtitles();
            if (!subtitleInfo.hasSubtitleFeature) {
                result.message = subtitleInfo.message;
                return result;
            }

            // 提取可用语言列表
            result.availableLanguages = subtitleInfo.subtitles.map(sub => sub.languageName);

            // 获取默认字幕或第一个字幕的内容
            const defaultSubtitle = subtitleInfo.subtitles.find(sub => sub.isDefault) || subtitleInfo.subtitles[0];
            if (defaultSubtitle && defaultSubtitle.url) {
                // 下载字幕文件
                try {
                    console.log('尝试获取字幕内容预览:', defaultSubtitle.url);
                    const subtitleContent = await downloadSubtitleFile(defaultSubtitle.url);

                    // 检查字幕格式并提取内容
                    if (subtitleContent) {
                        if (subtitleContent.body && Array.isArray(subtitleContent.body)) {
                            // 标准格式
                            result.subtitleContent = subtitleContent.body.slice(0, 10).map(item => ({
                                time: formatSubtitleTime(item.from),
                                text: item.content
                            }));
                            result.message = `成功获取"${defaultSubtitle.languageName}"字幕预览`;
                        } else if (Array.isArray(subtitleContent)) {
                            // 可能是直接返回的数组
                            result.subtitleContent = subtitleContent.slice(0, 10).map(item => ({
                                time: formatSubtitleTime(item.from || item.t || 0),
                                text: item.content || item.text || ''
                            }));
                            result.message = `成功获取"${defaultSubtitle.languageName}"字幕预览 (兼容格式)`;
                        } else {
                            result.message = '字幕文件格式无法识别: ' + JSON.stringify(subtitleContent).substring(0, 100) + '...';
                        }
                    } else {
                        result.message = '字幕内容为空';
                    }
                } catch (downloadError) {
                    console.error('下载字幕失败:', downloadError);
                    result.message = `下载字幕失败: ${downloadError.message}`;
                }
            } else {
                result.message = '找不到可用的字幕文件URL';
            }

            return result;
        } catch (error) {
            console.error('获取字幕预览失败:', error);
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

            console.log('开始下载字幕文件:', url);
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
            console.log('字幕文件下载成功:', subtitleData);
            return subtitleData;
        } catch (error) {
            console.error('下载字幕文件失败:', error);
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

// 用户数据服务 - userDataService
(function() {
    /**
     * 获取视频作者信息
     * @returns {Promise<Object>} 作者信息
     */
    async function getVideoUploader() {
        try {
            let result = {
                uploader: '未知UP主',
                title: '未知视频',
                avatar: '',
                mid: 0
            };

            // 从页面DOM中获取作者信息
            // 主站视频页面
            const authorElements = document.querySelectorAll('.up-name');

            if (authorElements && authorElements.length > 0) {
                const author = authorElements[0].textContent.trim();
                if (author) {
                    result.uploader = author;
                }

                // 同时获取视频标题
                const titleElement = document.querySelector('.video-title');
                if (titleElement) {
                    result.title = titleElement.textContent.trim();
                }

                // 获取UP主头像
                const avatarElement = document.querySelector('.up-info-image img');
                if (avatarElement) {
                    result.avatar = avatarElement.src;
                }

                // 获取UP主ID
                const midElement = document.querySelector('.up-name');
                if (midElement && midElement.href) {
                    const midMatch = midElement.href.match(/\/(\d+)/);
                    if (midMatch && midMatch[1]) {
                        result.mid = parseInt(midMatch[1]);
                    }
                }

                return result;
            }

            // 番剧页面
            const mediaInfoElements = document.querySelectorAll('.media-info');
            if (mediaInfoElements && mediaInfoElements.length > 0) {
                const titleElement = document.querySelector('.media-title');
                if (titleElement) {
                    result.title = titleElement.textContent.trim();
                    result.uploader = '哔哩哔哩番剧';
                }
                return result;
            }

            // 如果DOM方法失败，尝试从API获取
            const videoId = window.location.href.match(/\/video\/([^\/\?]+)/)?.[1];
            if (videoId && videoId.startsWith('BV')) {
                try {
                    const videoInfo = await window.adskipBilibiliApi.getVideoInfo(videoId);
                    result.uploader = videoInfo.owner?.name || '未知UP主';
                    result.title = videoInfo.title || '未知视频';
                    result.avatar = videoInfo.owner?.face || '';
                    result.mid = videoInfo.owner?.mid || 0;
                } catch (error) {
                    console.error('API获取视频作者失败:', error);
                }
            }

            return result;
        } catch (error) {
            console.error('获取视频作者失败:', error);
            return {
                uploader: '未知UP主',
                title: '未知视频',
                avatar: '',
                mid: 0,
                error: error.message
            };
        }
    }

    /**
     * 获取用户偏好设置
     * @returns {Promise<Object>} 用户设置
     */
    async function getUserPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'adskip_enabled',
                'adskip_percentage',
                'adskip_debug_mode',
                'adskip_uploader_whitelist'
            ], function(result) {
                resolve({
                    adSkipEnabled: result.adskip_enabled !== false,
                    adSkipPercentage: result.adskip_percentage || 5,
                    debugMode: result.adskip_debug_mode || false,
                    uploaderWhitelist: JSON.parse(result.adskip_uploader_whitelist || '[]')
                });
            });
        });
    }

    /**
     * 保存用户偏好设置
     * @param {Object} preferences 用户设置
     * @returns {Promise<boolean>} 是否保存成功
     */
    async function saveUserPreferences(preferences) {
        return new Promise((resolve) => {
            const data = {};

            if (preferences.adSkipEnabled !== undefined) {
                data.adskip_enabled = preferences.adSkipEnabled;
            }

            if (preferences.adSkipPercentage !== undefined) {
                data.adskip_percentage = preferences.adSkipPercentage;
            }

            if (preferences.debugMode !== undefined) {
                data.adskip_debug_mode = preferences.debugMode;
            }

            if (preferences.uploaderWhitelist !== undefined) {
                data.adskip_uploader_whitelist = JSON.stringify(preferences.uploaderWhitelist);
            }

            chrome.storage.local.set(data, function() {
                resolve(true);
            });
        });
    }

    // 将函数导出到全局服务对象
    window.adskipUserDataService = {
        getVideoUploader,
        getUserPreferences,
        saveUserPreferences
    };

    console.log('[AdSkip服务] 用户数据服务已加载');
})();

// 服务加载完成后触发事件
console.log('[AdSkip服务] 所有服务模块加载完成');
document.dispatchEvent(new CustomEvent('adskip_services_loaded'));