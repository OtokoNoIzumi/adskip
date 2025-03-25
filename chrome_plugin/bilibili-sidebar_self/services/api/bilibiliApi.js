/**
 * bilibiliApi.js - B站API服务模块
 * 封装B站特定的API调用
 */

'use strict';

/**
 * 获取视频信息
 * @param {string} bvid 视频BV号
 * @returns {Promise<Object>} 视频信息
 */
async function getVideoInfo(bvid) {
    if (!bvid) throw new Error('视频ID不能为空');

    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const response = await adskipApiService.get(url);

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
    const response = await adskipApiService.get(url);

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
    const response = await adskipApiService.get(url);

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

window.adskipBilibiliApi = {
    getVideoInfo,
    getVideoSubtitles,
    getUserInfo,
    getVideoCid
};