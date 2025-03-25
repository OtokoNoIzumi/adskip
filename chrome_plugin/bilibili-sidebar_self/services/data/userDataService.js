/**
 * userDataService.js - 用户数据服务模块
 * 处理用户数据获取和管理
 */

'use strict';

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
                const videoInfo = await adskipBilibiliApi.getVideoInfo(videoId);
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

window.adskipUserDataService = {
    getVideoUploader,
    getUserPreferences,
    saveUserPreferences
};