/**
 * content.js - 内容脚本
 * 在B站页面中运行，用于获取localStorage数据
 */

'use strict';

console.log('[BiliCredential] 内容脚本已加载');

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLocalStorage') {
    try {
      const acTimeValue = localStorage.getItem('ac_time_value');
      sendResponse({
        success: true,
        data: {
          ac_time_value: acTimeValue
        }
      });
    } catch (error) {
      console.error('[BiliCredential] 获取localStorage失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
});

// 页面加载完成后，通知background脚本
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[BiliCredential] 页面加载完成');
  });
} else {
  console.log('[BiliCredential] 页面已加载完成');
}
