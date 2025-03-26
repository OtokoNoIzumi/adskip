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

// 等待adskipStorage模块加载完成
let storageModuleReady = false;

// 初始化服务
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AdSkip] 插件已安装/更新');

  // 初始化存储模块(如果需要的话)
  await initStorageModule();

  // 加载保存的设置
  await loadSavedSettings();

  console.log('[AdSkip] 初始化设置完成:', adskipState);
});

/**
 * 初始化存储模块
 */
async function initStorageModule() {
  // 如果adskipStorage不存在，我们需要直接使用chrome.storage.local
  // 在实际的background脚本中，应该导入storage.js
  // 这里我们检查adskipStorage是否存在
  if (typeof adskipStorage === 'undefined') {
    console.log('[AdSkip] 存储模块未加载，使用直接存储访问');

    // 检查enabled设置
    const result = await chrome.storage.local.get(['adskip_enabled', 'adskip_debug_mode']);

    // 设置默认值
    if (result.adskip_enabled === undefined) {
      await chrome.storage.local.set({ 'adskip_enabled': true });
    }

    // 更新状态对象
    adskipState.isEnabled = result.adskip_enabled !== undefined ? result.adskip_enabled : true;
    adskipState.debugMode = result.adskip_debug_mode === true;
  } else {
    storageModuleReady = true;
    console.log('[AdSkip] 存储模块已加载');
  }
}

/**
 * 加载已保存的设置
 */
async function loadSavedSettings() {
  if (storageModuleReady && typeof adskipStorage !== 'undefined') {
    // 使用存储模块API加载设置
    adskipState.isEnabled = await adskipStorage.getEnabled();
    adskipState.debugMode = await adskipStorage.getDebugMode();
  } else {
    // 直接使用chrome.storage.local (回退方案)
    const result = await chrome.storage.local.get(['adskip_enabled', 'adskip_debug_mode']);
    adskipState.isEnabled = result.adskip_enabled !== undefined ? result.adskip_enabled : true;
    adskipState.debugMode = result.adskip_debug_mode === true;
  }
}

/**
 * 保存插件状态
 */
async function saveState() {
  if (storageModuleReady && typeof adskipStorage !== 'undefined') {
    // 使用存储模块API保存设置
    await adskipStorage.setEnabled(adskipState.isEnabled);
    await adskipStorage.setDebugMode(adskipState.debugMode);
  } else {
    // 直接使用chrome.storage.local (回退方案)
    await chrome.storage.local.set({
      'adskip_enabled': adskipState.isEnabled,
      'adskip_debug_mode': adskipState.debugMode
    });
  }
}

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
      saveState().then(() => {
        console.log('[AdSkip] 状态已更新并保存:', adskipState);
      });
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