/**
 * popup.js - 弹窗界面逻辑
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 获取DOM元素
  const sessdataEl = document.getElementById('sessdata');
  const biliJctEl = document.getElementById('bili_jct');
  const acTimeValueEl = document.getElementById('ac_time_value');
  const dedeUserIdEl = document.getElementById('dedeuserid');
  const timestampEl = document.getElementById('timestamp');
  const apiEndpointEl = document.getElementById('apiEndpoint');
  const adminSecretKeyEl = document.getElementById('adminSecretKey');
  const accountIdEl = document.getElementById('accountId');
  const saveApiBtn = document.getElementById('saveApi');
  const syncNowBtn = document.getElementById('syncNow');
  const exportDataBtn = document.getElementById('exportData');
  const statusEl = document.getElementById('status');
  const syncLogEl = document.getElementById('syncLog');

  // 显示状态信息
  function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';

    // 3秒后自动隐藏
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }

  // 添加同步日志
  function addSyncLog(message, type = 'info', details = null) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;

    let logContent = `<div class="log-timestamp">[${timestamp}]</div>`;
    logContent += `<div class="log-message">${message}</div>`;

    if (details) {
      logContent += `<div class="log-message" style="margin-top: 4px; font-size: 11px; color: #666;">${details}</div>`;
    }

    logItem.innerHTML = logContent;

    // 如果是第一条日志，清除"暂无同步记录"
    if (syncLogEl.children.length === 1 && syncLogEl.children[0].textContent === '暂无同步记录') {
      syncLogEl.innerHTML = '';
    }

    // 添加到顶部
    syncLogEl.insertBefore(logItem, syncLogEl.firstChild);

    // 限制日志数量，最多保留10条
    while (syncLogEl.children.length > 10) {
      syncLogEl.removeChild(syncLogEl.lastChild);
    }
  }

  // 格式化数据显示
  function formatValue(value) {
    if (!value) return '未获取到';
    return value; // 显示完整内容，不截断
  }

  // 格式化时间显示
  function formatTimestamp(timestamp) {
    if (!timestamp) return '未获取到';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // 更新数据显示
  function updateDataDisplay(data) {
    if (!data) {
      sessdataEl.textContent = '未获取到';
      biliJctEl.textContent = '未获取到';
      acTimeValueEl.textContent = '未获取到';
      dedeUserIdEl.textContent = '未获取到';
      timestampEl.textContent = '未获取到';
      return;
    }

    sessdataEl.textContent = formatValue(data.sessdata);
    biliJctEl.textContent = formatValue(data.bili_jct);
    acTimeValueEl.textContent = formatValue(data.ac_time_value);
    dedeUserIdEl.textContent = formatValue(data.dedeuserid);
    timestampEl.textContent = formatTimestamp(data.timestamp);
  }

  // 加载当前数据
  async function loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getData' });
      if (response.success) {
        updateDataDisplay(response.data);
      } else {
        showStatus('加载数据失败', 'error');
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      showStatus('加载数据失败: ' + error.message, 'error');
    }
  }

  // 加载API设置
  async function loadApiSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getApiSettings' });
      if (response.success) {
        apiEndpointEl.value = response.endpoint || '';
        adminSecretKeyEl.value = response.adminSecretKey || '';
        accountIdEl.value = response.accountId || '';
      }
    } catch (error) {
      console.error('加载API设置失败:', error);
    }
  }

  // 保存API设置
  async function saveApiSettings() {
    const endpoint = apiEndpointEl.value.trim();
    const adminSecretKey = adminSecretKeyEl.value.trim();
    const accountId = accountIdEl.value.trim();

    if (!endpoint) {
      showStatus('请输入API端点地址', 'error');
      return;
    }

    if (!adminSecretKey) {
      showStatus('请输入管理员密钥', 'error');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setApiSettings',
        endpoint: endpoint,
        adminSecretKey: adminSecretKey,
        accountId: accountId
      });

      if (response.success) {
        showStatus('API设置保存成功', 'success');
      } else {
        showStatus('保存失败', 'error');
      }
    } catch (error) {
      console.error('保存API设置失败:', error);
      showStatus('保存失败: ' + error.message, 'error');
    }
  }

  // 导出数据
  async function exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getData' });
      if (!response.success || !response.data) {
        showStatus('没有可导出的数据', 'error');
        return;
      }

      const data = response.data;

      // 检查必要字段
      if (!data.sessdata || !data.bili_jct || !data.ac_time_value || !data.dedeuserid) {
        showStatus('数据不完整，无法导出', 'error');
        return;
      }

      // 获取存储的 account_id，如果没有则使用默认值
      const accountId = accountIdEl.value.trim() || 'ou_acid_default';

      // 构建导出数据
      const exportConfig = {
        accounts: {
          [accountId]: {
            sessdata: data.sessdata,
            bili_jct: data.bili_jct,
            ac_time_value: data.ac_time_value,
            dedeuserid: data.dedeuserid
          }
        }
      };

      // 转换为JSON字符串
      const jsonContent = JSON.stringify(exportConfig, null, 2);

      // 创建Blob并下载
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'auth_config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus('数据导出成功', 'success');
    } catch (error) {
      console.error('导出数据失败:', error);
      showStatus('导出失败: ' + error.message, 'error');
    }
  }

  // 立即同步
  async function syncNow() {
    if (!apiEndpointEl.value.trim()) {
      showStatus('请先设置API端点', 'error');
      return;
    }

    if (!adminSecretKeyEl.value.trim()) {
      showStatus('请先设置管理员密钥', 'error');
      return;
    }

    syncNowBtn.disabled = true;
    syncNowBtn.textContent = '同步中...';
    addSyncLog('开始手动同步数据...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({ action: 'manualSync' });

      if (response.success) {
        if (response.result.success) {
          const result = response.result.result;
          let logMessage = `同步成功 (第${response.result.attempt}次尝试)`;
          let logDetails = null;

          if (result && result.success) {
            logMessage = `同步成功: ${result.message || '数据已更新'}`;

            if (result.updated_fields && Object.keys(result.updated_fields).length > 0) {
              const fields = Object.keys(result.updated_fields);
              logDetails = `更新字段: ${fields.join(', ')}`;

              // 显示具体字段变化
              if (result.updated_fields) {
                const fieldDetails = Object.entries(result.updated_fields)
                  .map(([field, change]) => `${field}: ${change}`)
                  .join('; ');
                logDetails += `\n详细变化: ${fieldDetails}`;
              }
            } else {
              logDetails = '数据无变化，无需更新';
            }

            if (result.account_id) {
              logDetails += `\n账号ID: ${result.account_id}`;
            }
          }

          addSyncLog(logMessage, 'success', logDetails);
          showStatus(`同步成功 (第${response.result.attempt}次尝试)`, 'success');
        } else {
          const errorMsg = response.result.error || '未知错误';
          addSyncLog(`同步失败: ${errorMsg}`, 'error');
          showStatus(`同步失败: ${errorMsg}`, 'error');
        }
      } else {
        addSyncLog(`同步失败: ${response.error}`, 'error');
        showStatus('同步失败: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('同步失败:', error);
      addSyncLog(`同步异常: ${error.message}`, 'error');
      showStatus('同步失败: ' + error.message, 'error');
    } finally {
      syncNowBtn.disabled = false;
      syncNowBtn.textContent = '立即同步';
    }
  }

  // 绑定事件
  saveApiBtn.addEventListener('click', saveApiSettings);
  syncNowBtn.addEventListener('click', syncNow);
  exportDataBtn.addEventListener('click', exportData);

  // 回车保存API设置
  apiEndpointEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiSettings();
    }
  });

  adminSecretKeyEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiSettings();
    }
  });

  accountIdEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiSettings();
    }
  });

  // 初始化
  await loadData();
  await loadApiSettings();
});
