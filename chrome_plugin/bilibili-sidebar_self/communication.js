/**
 * communication.js - 通信工具模块
 * 处理内容脚本与后台服务工作者之间的消息通信
 */

'use strict';

// 创建全局通信对象
window.adskipCommunication = window.adskipCommunication || {};

/**
 * 发送消息到后台服务工作者
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} - 响应结果
 */
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      // 检查runtime错误
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      // 检查响应是否存在
      if (!response) {
        reject(new Error('未收到响应'));
        return;
      }

      // 检查响应是否成功
      if (!response.success) {
        reject(new Error(response.error || '请求失败'));
        return;
      }

      resolve(response);
    });
  });
}

/**
 * 获取插件的全局状态
 * @returns {Promise<Object>} - 全局状态对象
 */
async function getPluginState() {
  const response = await sendMessageToBackground({ action: 'getState' });
  return response.state;
}

/**
 * 更新插件状态
 * @param {Object} state - 要更新的状态
 * @returns {Promise<boolean>} - 是否成功
 */
async function updatePluginState(state) {
  await sendMessageToBackground({
    action: 'updateState',
    state: state
  });
  return true;
}

/**
 * 通过后台服务工作者执行网络请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} - 响应数据
 */
async function fetchViaBackground(url, options = {}) {
  const response = await sendMessageToBackground({
    action: 'fetchData',
    url: url,
    options: options
  });
  return response.data;
}

// 将函数导出到全局通信对象
window.adskipCommunication = {
  sendMessageToBackground,
  getPluginState,
  updatePluginState,
  fetchViaBackground
};