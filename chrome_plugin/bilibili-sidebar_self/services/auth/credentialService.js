/**
 * credentialService.js - 凭证服务模块
 * 处理用户凭证获取与管理
 */

'use strict';

/**
 * 获取B站登录状态
 * @returns {Promise<Object>} 用户登录状态信息
 */
async function getBilibiliLoginStatus() {
    try {
        // adskipUtils.logDebug("开始获取完整用户信息raw");
        // 方法1：尝试从页面DOM获取用户信息
        let userInfo = await getUserInfoFromDOM();

        // 方法2：如果DOM方法失败，尝试从API获取
        if (!userInfo.isLoggedIn) {
            userInfo = await getUserInfoFromAPI();
            // adskipUtils.logDebug("完整用户信息raw:", JSON.stringify(userInfo, null, 2));
        }

        return userInfo;
    } catch (error) {
        console.error('获取登录状态失败:', error);
        return {
            isLoggedIn: false,
            username: '未知用户',
            message: `获取登录状态失败: ${error.message}`
        };
    }
}

/**
 * 从页面DOM获取用户信息
 * @returns {Promise<Object>} 用户信息
 */
async function getUserInfoFromDOM() {
    return new Promise((resolve) => {
        try {
            // 检查页面顶部用户名元素
            const usernameElement = document.querySelector('.nav-user-name') ||
                                   document.querySelector('.username');

            // 检查头像元素
            const avatarElement = document.querySelector('.nav-user-avatar') ||
                                 document.querySelector('.bili-avatar img');

            if (usernameElement) {
                const username = usernameElement.textContent.trim();
                const avatar = avatarElement ? avatarElement.src : null;

                resolve({
                    isLoggedIn: true,
                    username,
                    avatar,
                    source: 'DOM'
                });
            } else {
                resolve({
                    isLoggedIn: false,
                    message: '未从DOM检测到登录状态'
                });
            }
        } catch (error) {
            resolve({
                isLoggedIn: false,
                message: `DOM检测错误: ${error.message}`
            });
        }
    });
}

/**
 * 从B站API获取用户信息
 * @returns {Promise<Object>} 用户信息
 */
async function getUserInfoFromAPI() {
    try {
        const userInfo = await adskipBilibiliApi.getUserInfo();

        // adskipUtils.logDebug("完整用户信息api:", JSON.stringify(userInfo, null, 2));
        return {
            isLoggedIn: userInfo.isLogin,
            username: userInfo.uname || '未知用户',
            uid: userInfo.mid,
            avatar: userInfo.face,
            vipType: userInfo.vipType,
            // source: 'API'
        };
    } catch (error) {
        return {
            isLoggedIn: false,
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
        return userInfo.isLoggedIn && (userInfo.vipType > 0);
    } catch (error) {
        console.error('检查大会员状态失败:', error);
        return false;
    }
}

window.adskipCredentialService = {
    getBilibiliLoginStatus,
    getUserInfoFromDOM,
    getUserInfoFromAPI,
    checkVipStatus
};