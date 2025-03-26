/**
 * background.js - 后台服务工作者
 * 处理插件后台任务，消息通信，网络请求等
 */

'use strict';

// 记录Service Worker激活
console.log('[AdSkip] Service Worker 已启动');

// 全局状态对象
const adskipState = {
  isEnabled: true,
  debugMode: false,
};

// 初始化服务
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AdSkip] 插件已安装/更新');

  // 初始化存储设置
  const result = await chrome.storage.local.get(['adskip_enabled', 'adskip_debug_mode']);

  // 设置默认值
  if (result.adskip_enabled === undefined) {
    await chrome.storage.local.set({ 'adskip_enabled': true });
  }

  // 更新状态对象
  adskipState.isEnabled = result.adskip_enabled !== undefined ? result.adskip_enabled : true;
  adskipState.debugMode = result.adskip_debug_mode === true;

  console.log('[AdSkip] 初始化设置完成:', adskipState);
});

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AdSkip] 接收到消息:', message);

  if (message.action === 'getState') {
    // 返回全局状态
    sendResponse({ success: true, state: adskipState });
  }
  else if (message.action === 'fetchData') {
    // 处理网络请求
    handleFetch(message.url, message.options)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    // 异步响应需要返回true
    return true;
  }
  else if (message.action === 'updateState') {
    // 更新插件状态
    if (message.state && typeof message.state === 'object') {
      Object.assign(adskipState, message.state);
      // 同步到存储
      if (message.state.isEnabled !== undefined) {
        chrome.storage.local.set({ 'adskip_enabled': message.state.isEnabled });
      }
      if (message.state.debugMode !== undefined) {
        chrome.storage.local.set({ 'adskip_debug_mode': message.state.debugMode });
      }
    }
    sendResponse({ success: true });
  }
  else {
    sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * 处理网络请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} - 响应数据
 */
async function handleFetch(url, options = {}) {
  console.log(`[AdSkip] 执行网络请求: ${url}`);

  const response = await fetch(url, {
    ...options,
    // 确保包含凭据
    credentials: options.credentials || 'include'
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}