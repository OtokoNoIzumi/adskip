/**
 * subtitleService.js - 字幕服务模块
 * 处理字幕数据获取与解析
 */

'use strict';

/**
 * 获取视频字幕信息
 * @returns {Promise<Object>} 字幕信息
 */
async function getVideoSubtitles() {
    try {
        const result = {
            hasSubtitleFeature: false,
            subtitles: [],
            message: ''
        };

        // 检查字幕按钮是否存在
        const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle') ||
                              document.querySelector('.bilibili-player-video-subtitle-btn');

        result.hasSubtitleFeature = !!subtitleButton;

        if (!result.hasSubtitleFeature) {
            result.message = '此视频不支持字幕功能';
            return result;
        }

        // 尝试从页面脚本获取字幕信息
        const subtitles = await getSubtitlesFromPageData();
        if (subtitles.length > 0) {
            result.subtitles = subtitles;
            result.message = '成功获取字幕信息';
        } else {
            result.message = '视频支持字幕功能，但未找到字幕数据';
        }

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
 * 从页面数据中获取字幕信息
 * @returns {Promise<Array>} 字幕列表
 */
async function getSubtitlesFromPageData() {
    return new Promise((resolve) => {
        try {
            // 尝试从页面获取cid和bvid
            const videoInfoScript = Array.from(document.querySelectorAll('script'))
                .find(script => script.textContent.includes('window.__INITIAL_STATE__'));

            if (videoInfoScript) {
                const match = videoInfoScript.textContent.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    const bvid = data.bvid || data.videoData?.bvid;
                    const cid = data.epInfo?.cid || data.videoData?.cid;

                    if (bvid && cid) {
                        // 调用API获取字幕信息
                        adskipBilibiliApi.getVideoSubtitles(bvid, cid)
                            .then(subtitles => {
                                resolve(subtitles.map(sub => ({
                                    language: sub.lan,
                                    languageName: sub.lan_doc,
                                    url: sub.subtitle_url
                                })));
                            })
                            .catch(error => {
                                console.error('API获取字幕失败:', error);
                                resolve([]);
                            });
                        return;
                    }
                }
            }

            resolve([]);
        } catch (error) {
            console.error('从页面获取字幕信息失败:', error);
            resolve([]);
        }
    });
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

        // 检查字幕按钮是否存在
        const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle') ||
                              document.querySelector('.bilibili-player-video-subtitle-btn');

        if (!subtitleButton) {
            result.message = '未找到字幕按钮，此视频可能不支持字幕';
            return result;
        }

        // 尝试获取已加载的字幕内容
        const subtitleElements = document.querySelectorAll('.bpx-player-subtitle-item') ||
                                document.querySelectorAll('.bilibili-player-video-subtitle-item');

        if (subtitleElements && subtitleElements.length > 0) {
            // 从当前显示的字幕内容获取预览
            result.subtitleContent = Array.from(subtitleElements).map(el => ({
                time: '当前时间',
                text: el.textContent.trim()
            }));
        }

        // 尝试获取可用语言列表
        const subtitleInfo = await getVideoSubtitles();
        if (subtitleInfo.subtitles && subtitleInfo.subtitles.length > 0) {
            result.availableLanguages = subtitleInfo.subtitles.map(sub => sub.languageName);
        }

        if (result.availableLanguages.length === 0 && result.subtitleContent.length === 0) {
            result.message = '视频支持字幕，但无法获取字幕内容预览';
        } else {
            result.message = '成功获取字幕预览';
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

window.adskipSubtitleService = {
    getVideoSubtitles,
    getSubtitlesFromPageData,
    getSubtitlePreview,
    downloadSubtitleFile
};