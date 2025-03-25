/**
 * apiService.js - API 服务基础模块
 * 处理所有基础 API 请求功能
 */

'use strict';

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

window.adskipApiService = {
    get,
    post
};