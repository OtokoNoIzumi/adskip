/**
 * background.js - 后台服务工作者
 * 处理cookies获取、数据变化检测、API同步
 */

'use strict';

// 全局状态
let currentData = null;
let apiEndpoint = null;
let adminSecretKey = null;
let accountId = null;

// 从存储加载数据
async function loadStoredData() {
  try {
    const result = await chrome.storage.local.get(['apiEndpoint', 'adminSecretKey', 'accountId', 'credentialData']);
    apiEndpoint = result.apiEndpoint || null;
    adminSecretKey = result.adminSecretKey || null;
    accountId = result.accountId || null;
    currentData = result.credentialData || null;
    console.log('[BiliCredential] 从存储加载数据完成', {
      hasApiEndpoint: !!apiEndpoint,
      hasAdminSecretKey: !!adminSecretKey,
      hasAccountId: !!accountId,
      hasData: !!currentData,
      dataTimestamp: currentData?.timestamp
    });
  } catch (error) {
    console.error('[BiliCredential] 加载存储数据失败:', error);
  }
}

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[BiliCredential] 插件已安装');
  await loadStoredData();
});

// 插件启动时也加载数据（Service Worker可能被重启）
chrome.runtime.onStartup.addListener(async () => {
  console.log('[BiliCredential] 插件启动');
  await loadStoredData();
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    // 确保从存储加载最新数据
    loadStoredData().then(() => {
      sendResponse({ success: true, data: currentData });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  } else if (message.action === 'setApiSettings') {
    // 设置API配置
    apiEndpoint = message.endpoint;
    adminSecretKey = message.adminSecretKey;
    accountId = message.accountId;
    chrome.storage.local.set({
      apiEndpoint: apiEndpoint,
      adminSecretKey: adminSecretKey,
      accountId: accountId
    });
    sendResponse({ success: true });
  } else if (message.action === 'getApiSettings') {
    // 获取API配置
    sendResponse({
      success: true,
      endpoint: apiEndpoint,
      adminSecretKey: adminSecretKey,
      accountId: accountId
    });
  } else if (message.action === 'manualSync') {
    // 手动同步
    syncDataToAPI().then(result => {
      sendResponse({ success: true, result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 异步响应
  }
});

// 监听标签页更新，检测B站页面访问
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('https://www.bilibili.com/')) {
    console.log('[BiliCredential] 检测到B站主站页面访问:', tab.url);

    // 延迟一下确保页面完全加载
    setTimeout(async () => {
      await checkAndUpdateData(tabId);
    }, 2000);
  }
});

/**
 * 检查并更新数据
 */
async function checkAndUpdateData(tabId) {
  try {
    console.log('[BiliCredential] 开始检查数据变化...');

    // 确保先加载一次本地持久化的数据与配置（SW 可能刚被唤醒）
    await loadStoredData();

    // 获取cookies
    const cookies = await getBilibiliCookies();

    // 获取localStorage数据
    const localStorageData = await getLocalStorageData(tabId);

    // 组装新数据（不包含timestamp）
    const newDataWithoutTimestamp = {
      sessdata: cookies.sessdata,
      bili_jct: cookies.bili_jct,
      ac_time_value: localStorageData?.ac_time_value || null,
      dedeuserid: cookies.dedeuserid
    };

    // 检查数据是否变化
    console.log('[BiliCredential] 当前缓存数据:', currentData);
    console.log('[BiliCredential] 新获取数据:', newDataWithoutTimestamp);
    console.log('[BiliCredential] localStorage获取状态:', localStorageData ? '成功' : '失败');

    // 先比较cookies数据
    let hasChanged = !currentData ||
      currentData.sessdata !== newDataWithoutTimestamp.sessdata ||
      currentData.bili_jct !== newDataWithoutTimestamp.bili_jct ||
      currentData.dedeuserid !== newDataWithoutTimestamp.dedeuserid;

    // 只有当localStorage获取成功时才比较ac_time_value
    if (localStorageData) {
      const acTimeValueChanged = currentData?.ac_time_value !== newDataWithoutTimestamp.ac_time_value;
      hasChanged = hasChanged || acTimeValueChanged;
      console.log('[BiliCredential] ac_time_value比较:', {
        cached: currentData?.ac_time_value,
        new: newDataWithoutTimestamp.ac_time_value,
        changed: acTimeValueChanged
      });
    }

    console.log('[BiliCredential] 字段比较结果:', {
      sessdata: currentData?.sessdata !== newDataWithoutTimestamp.sessdata ? 'changed' : 'same',
      bili_jct: currentData?.bili_jct !== newDataWithoutTimestamp.bili_jct ? 'changed' : 'same',
      dedeuserid: currentData?.dedeuserid !== newDataWithoutTimestamp.dedeuserid ? 'changed' : 'same',
      ac_time_value: localStorageData ? (currentData?.ac_time_value !== newDataWithoutTimestamp.ac_time_value ? 'changed' : 'same') : 'skipped'
    });
    console.log('[BiliCredential] 数据是否有变化:', hasChanged);

    if (hasChanged) {
      const previousTimestamp = currentData?.timestamp || 0;
      const currentTimestamp = Date.now();
      const timeDiff = previousTimestamp ? Math.round((currentTimestamp - previousTimestamp) / 1000) : 0;

    // 只有在数据真正变化时才更新timestamp
      const updatedData = {
        ...newDataWithoutTimestamp,
        // 如果本次未能获取到 ac_time_value，则保留已有缓存值，避免把有效值覆盖成 null
        ac_time_value: localStorageData ? newDataWithoutTimestamp.ac_time_value : (currentData?.ac_time_value ?? null),
        timestamp: currentTimestamp
      };

      console.log('[BiliCredential] 检测到数据变化，更新缓存');
      console.log('[BiliCredential] 时间差:', timeDiff > 0 ? `${timeDiff}秒` : '首次获取');
      console.log('[BiliCredential] 变化详情:', {
        sessdata: currentData?.sessdata !== newDataWithoutTimestamp.sessdata ? 'changed' : 'same',
        bili_jct: currentData?.bili_jct !== newDataWithoutTimestamp.bili_jct ? 'changed' : 'same',
        ac_time_value: currentData?.ac_time_value !== newDataWithoutTimestamp.ac_time_value ? 'changed' : 'same',
        dedeuserid: currentData?.dedeuserid !== newDataWithoutTimestamp.dedeuserid ? 'changed' : 'same'
      });
      console.log('[BiliCredential] 新数据:', updatedData);

      // 更新缓存
      currentData = updatedData;
      await chrome.storage.local.set({ credentialData: currentData });

      // 如果有API端点并且有管理员密钥，尝试同步
      if (apiEndpoint && adminSecretKey) {
        const syncResult = await syncDataToAPI();
        if (syncResult.success && syncResult.result) {
          console.log('[BiliCredential] 自动同步成功:', syncResult.result);
        }
      } else {
        console.log('[BiliCredential] 跳过自动同步：缺少 apiEndpoint 或 adminSecretKey', { hasEndpoint: !!apiEndpoint, hasKey: !!adminSecretKey });
      }
    } else {
      console.log('[BiliCredential] 数据无变化，保持原有timestamp:', currentData?.timestamp);
      console.log('[BiliCredential] 当前数据:', currentData);
    }

  } catch (error) {
    console.error('[BiliCredential] 检查数据失败:', error);
  }
}

/**
 * 获取B站cookies
 */
async function getBilibiliCookies() {
  try {
    const [sessdata, biliJct, dedeUserID] = await Promise.all([
      chrome.cookies.get({ url: 'https://www.bilibili.com', name: 'SESSDATA' }),
      chrome.cookies.get({ url: 'https://www.bilibili.com', name: 'bili_jct' }),
      chrome.cookies.get({ url: 'https://www.bilibili.com', name: 'DedeUserID' })
    ]);

    return {
      sessdata: sessdata?.value || null,
      bili_jct: biliJct?.value || null,
      dedeuserid: dedeUserID?.value || null
    };
  } catch (error) {
    console.error('[BiliCredential] 获取cookies失败:', error);
    return { sessdata: null, bili_jct: null, dedeuserid: null };
  }
}

/**
 * 获取localStorage数据
 */
async function getLocalStorageData(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return {
          ac_time_value: localStorage.getItem('ac_time_value')
        };
      }
    });

    const result = results[0]?.result || { ac_time_value: null };
    console.log('[BiliCredential] 获取localStorage结果:', result);
    return result;
  } catch (error) {
    console.error('[BiliCredential] 获取localStorage失败:', error);
    // 返回null表示获取失败，后续逻辑会跳过这个字段的比较
    return null;
  }
}

/**
 * 同步数据到API
 */
async function syncDataToAPI() {
  if (!apiEndpoint || !adminSecretKey || !currentData) {
    console.log('[BiliCredential] 跳过同步：无API端点、无管理员密钥或无数据');
    return { success: false, reason: 'missing_config_or_data' };
  }

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BiliCredential] 尝试同步数据到API (第${attempt}次)...`);

      const requestData = {
        ...currentData,
        admin_secret_key: adminSecretKey
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[BiliCredential] 数据同步成功:', result);
        return { success: true, attempt, result };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      lastError = error;
      console.error(`[BiliCredential] 第${attempt}次同步失败:`, error);

      if (attempt < maxRetries) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error('[BiliCredential] 所有同步尝试都失败了');
  return { success: false, error: lastError?.message, attempts: maxRetries };
}
