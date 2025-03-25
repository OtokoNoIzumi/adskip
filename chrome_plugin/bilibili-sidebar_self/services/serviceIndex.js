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

            // 使用官方API获取字幕信息（player/wbi/v2接口）
            const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${videoData.aid}&cid=${videoData.cid}`;
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

            // 提取字幕列表
            const subtitles = data.data?.subtitle?.subtitles || [];
            result.subtitles = subtitles.map(sub => ({
                id: sub.id,
                language: sub.lan,
                languageName: sub.lan_doc,
                url: sub.subtitle_url.startsWith('//') ? `https:${sub.subtitle_url}` : sub.subtitle_url,
                isDefault: sub.type === 1
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
            // 尝试从URL获取视频BV号
            const bvid = window.location.pathname.match(/\/video\/(BV[\w]+)/)?.[1];
            if (!bvid) {
                throw new Error('无法从URL获取BV号');
            }

            // 尝试从页面脚本中获取aid和CID
            const videoInfoScript = Array.from(document.querySelectorAll('script'))
                .find(script => script.textContent.includes('window.__INITIAL_STATE__'));

            let aid = null;
            let cid = null;
            let title = '';
            let uploader = '';

            if (videoInfoScript) {
                const match = videoInfoScript.textContent.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    aid = data.videoData?.aid || data.aid;
                    cid = data.videoData?.cid || data.cid;
                    title = data.videoData?.title || data.title || '';
                    uploader = data.videoData?.owner?.name || '';
                }
            }

            // 如果从页面获取不到，通过API获取
            if (!aid || !cid) {
                // 先通过bvid获取aid
                const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data.code !== 0) {
                    throw new Error(`获取视频信息失败: ${data.message}`);
                }

                aid = data.data.aid;
                cid = data.data.cid;
                title = data.data.title;
                uploader = data.data.owner?.name || '';
            }

            return {
                bvid,
                aid,
                cid,
                title,
                uploader
            };
        } catch (error) {
            console.error('获取视频数据失败:', error);
            return { bvid: null, aid: null, cid: null };
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
                const subtitleContent = await downloadSubtitleFile(defaultSubtitle.url);
                if (subtitleContent && subtitleContent.body) {
                    // 提取前10条字幕作为预览
                    result.subtitleContent = subtitleContent.body.slice(0, 10).map(item => ({
                        time: formatSubtitleTime(item.from),
                        text: item.content
                    }));
                    result.message = `成功获取"${defaultSubtitle.languageName}"字幕预览`;
                } else {
                    result.message = '字幕文件格式异常，无法提取内容';
                }
            } else {
                result.message = '找不到可用的字幕文件';
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

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`下载字幕失败: ${response.status} ${response.statusText}`);
            }

            return await response.json();
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