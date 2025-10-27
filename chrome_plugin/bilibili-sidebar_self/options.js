// 全局变量
let whitelistData = [];

// 检查是否应该在options页面显示使用说明
async function checkAndShowUsageInstructions() {
  try {
    const videoCount = await adskipStorage.getLocalVideosProcessedCount();
    const instructionsElement = document.getElementById('options-usage-instructions');

    if (instructionsElement) {
      // 相反的条件：当处理视频数大于等于3时显示说明（与popup.js相反）
      if (videoCount >= 3) {
        instructionsElement.style.display = 'block';
        adskipUtils.logDebug('在options页面显示使用说明，当前处理视频数:', videoCount);
      } else {
        instructionsElement.style.display = 'none';
        adskipUtils.logDebug('在options页面隐藏使用说明，当前处理视频数:', videoCount);
      }
    }
  } catch (error) {
    adskipUtils.logDebug('获取本地视频数量失败', error);
    // 出错时不显示说明
    const instructionsElement = document.getElementById('options-usage-instructions');
    if (instructionsElement) {
      instructionsElement.style.display = 'none';
    }
  }
}

// 检查管理员状态并更新UI
function checkAdminStatus() {
  adskipStorage.checkAdminStatus().then(isAdmin => {
    const loginBtn = document.getElementById('admin-login-btn');
    if (loginBtn) {
      if (isAdmin) {
        loginBtn.textContent = '🔓 退出管理员';
        loginBtn.classList.add('admin-logout');
      } else {
        loginBtn.textContent = '🔑 管理员登录';
        loginBtn.classList.remove('admin-logout');
      }
    }
  });
}

// 加载白名单数据，使用adskipStorage接口
function loadWhitelistData() {
  adskipStorage.loadUploaderWhitelist().then(function(whitelist) {
    whitelistData = whitelist;
    renderWhitelist();
  }).catch(function(error) {
    console.error('解析白名单数据失败', error);
    whitelistData = [];
    renderWhitelist();
  });
}

// 渲染白名单列表
function renderWhitelist() {
  const container = document.getElementById('whitelist-list');
  const countElement = document.getElementById('whitelist-count');

  // 更新计数
  const enabledCount = whitelistData.filter(item => item.enabled !== false).length;

  if (countElement) {
    countElement.textContent = enabledCount;
  }

  // 清空容器
  if (!container) return;
  container.innerHTML = '';

  // 如果白名单为空，显示提示
  if (whitelistData.length === 0) {
    container.innerHTML = '<div class="whitelist-empty">白名单为空，您可以在视频页面将UP主添加到白名单</div>';
    return;
  }

  // 创建列表项
  whitelistData.forEach(function(item, index) {
    const itemName = item.name;
    const isEnabled = item.enabled !== false;
    const addedAt = item.addedAt;

    const itemElement = document.createElement('div');
    itemElement.className = 'whitelist-item';

    // 格式化日期
    let dateString = '';
    if (addedAt) {
      const date = new Date(addedAt);
      dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    itemElement.innerHTML = `
      <div class="whitelist-item-name">${itemName}</div>
      ${dateString ? `<div class="whitelist-item-date">添加于: ${dateString}</div>` : ''}
      <div class="whitelist-item-actions">
        ${isEnabled
          ? `<button class="whitelist-btn whitelist-btn-disable" data-index="${index}">禁用</button>`
          : `<button class="whitelist-btn whitelist-btn-enable" data-index="${index}">启用</button>`}
        <button class="whitelist-btn whitelist-btn-delete" data-index="${index}">删除</button>
      </div>
    `;

    container.appendChild(itemElement);
  });

  // 添加事件监听
  container.querySelectorAll('.whitelist-btn-enable').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      toggleWhitelistItem(index, true);
    });
  });

  container.querySelectorAll('.whitelist-btn-disable').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      toggleWhitelistItem(index, false);
    });
  });

  container.querySelectorAll('.whitelist-btn-delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      deleteWhitelistItem(index);
    });
  });
}

// 切换白名单项目的启用状态，使用adskipStorage接口
function toggleWhitelistItem(index, enabled) {
  if (index < 0 || index >= whitelistData.length) return;

  const item = whitelistData[index];
  const itemName = item.name;

  // 使用adskipStorage接口
  if (enabled) {
    adskipStorage.enableUploaderInWhitelist(itemName).then(function() {
      loadWhitelistData(); // 重新加载数据以更新UI
    });
  } else {
    adskipStorage.disableUploaderInWhitelist(itemName).then(function() {
      loadWhitelistData(); // 重新加载数据以更新UI
    });
  }
}

// 删除白名单项目，使用adskipStorage接口
function deleteWhitelistItem(index) {
  if (index < 0 || index >= whitelistData.length) return;

  const item = whitelistData[index];
  const itemName = item.name;

  if (confirm(`确定要从白名单中删除"${itemName}"吗？`)) {
    adskipStorage.removeUploaderFromWhitelist(itemName).then(function() {
      loadWhitelistData(); // 重新加载数据以更新UI
      showStatus('白名单已更新');
    });
  }
}

// 初始化选项页面
document.addEventListener('DOMContentLoaded', function() {
  // 加载存储的设置
  loadSettings();

  // 检查管理员状态
  checkAdminStatus();

  // 检查是否显示使用说明（相反的条件）
  checkAndShowUsageInstructions();

  // 检查是否有标签切换请求
  chrome.storage.local.get('adskip_open_tab', function(result) {
    if (result.adskip_open_tab) {
      // 切换到指定标签
      const tabName = result.adskip_open_tab;
      const targetTab = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
      if (targetTab) {
        // 更新URL hash
        history.pushState(null, null, `#${tabName}`);

        // 更新选项卡状态
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        targetTab.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 如果是白名单选项卡，加载白名单数据
        if (tabName === 'whitelist') {
          loadWhitelistData();
        }

        // 清除标签切换请求
        chrome.storage.local.remove('adskip_open_tab');
      }
    }
  });

  // 管理员登录/登出按钮
  const adminLoginBtn = document.getElementById('admin-login-btn');
  adminLoginBtn.addEventListener('click', function() {
    adskipStorage.checkAdminStatus().then(isAdmin => {
      if (isAdmin) {
        // 已登录，执行登出
        if (confirm('确定要退出管理员登录吗？')) {
          chrome.storage.local.set({[adskipStorage.KEYS.ADMIN_AUTH]: false}, function() {
            showStatus('已退出管理员登录', 'info');
            checkAdminStatus();
          });
        }
      } else {
        // 未登录，执行登录
        const apiKey = prompt('请输入管理员API密钥:');
        if (!apiKey) return;

        adskipStorage.verifyAdminAccess(apiKey).then(isValid => {
          if (isValid) {
            showStatus('验证成功，已获得管理员权限', 'success');
            checkAdminStatus();
          } else {
            showStatus('API密钥无效', 'error');
          }
        });
      }
    });
  });


  // 功能开关监听
  const adskipToggle = document.getElementById('enable-adskip');
  adskipToggle.addEventListener('change', function() {
    const newEnabled = this.checked;
    // 使用adskipStorage.getEnabled替代直接的chrome.storage调用
    adskipStorage.getEnabled().then(function(currentEnabled) {
      // 只有当状态确实变化时才设置
      if (currentEnabled !== newEnabled) {
        adskipStorage.setEnabled(newEnabled).then(function() {
          showStatus(newEnabled ? '已启用广告跳过功能' : '已禁用广告跳过功能');
        });
      }
    });
  });

  // 调试模式开关监听
  const debugModeToggle = document.getElementById('debug-mode');
  debugModeToggle.addEventListener('change', function() {
    const newDebugMode = this.checked;
    // 使用adskipStorage的方法替代直接调用
    const currentDebugMode = adskipStorage.getDebugMode(); // 同步方法，直接获取当前状态
    // 只有当状态确实变化时才设置
    if (currentDebugMode !== newDebugMode) {
      adskipStorage.setDebugMode(newDebugMode).then(function() {
        showStatus(newDebugMode ? '已启用调试模式' : '已禁用调试模式');
      });
    }
  });

  // "不检测自己视频"开关监听
  const skipOwnVideosToggle = document.getElementById('skip-own-videos');
  skipOwnVideosToggle.addEventListener('change', function() {
    const newSkipOwnVideos = this.checked;
    // 获取当前状态并比较
    adskipStorage.getSkipOwnVideos().then(function(currentSkipOwnVideos) {
      // 只有当状态确实变化时才设置
      if (currentSkipOwnVideos !== newSkipOwnVideos) {
        adskipStorage.setSkipOwnVideos(newSkipOwnVideos).then(function() {
          showStatus(newSkipOwnVideos ? '已启用"不检测自己视频"功能' : '已禁用"不检测自己视频"功能');
        });
      }
    });
  });

  // 搜索页预检开关监听
  const searchPrecheckToggle = document.getElementById('search-precheck');
  searchPrecheckToggle.addEventListener('change', function() {
    const newSearchPrecheck = this.checked;
    // 获取当前状态并比较
    adskipStorage.getSearchPrecheck().then(function(currentSearchPrecheck) {
      // 只有当状态确实变化时才设置
      if (currentSearchPrecheck !== newSearchPrecheck) {
        adskipStorage.setSearchPrecheck(newSearchPrecheck).then(function() {
          showStatus(newSearchPrecheck ? '已启用搜索页预检功能' : '已禁用搜索页预检功能');
        });
      }
    });
  });

  // 广告跳过百分比滑块监听
  const percentageSlider = document.getElementById('skip-percentage');
  const percentageValue = document.getElementById('percentage-value');

  percentageSlider.addEventListener('input', function() {
    percentageValue.textContent = this.value;
  });

  percentageSlider.addEventListener('change', function() {
    const newPercentage = parseInt(this.value, 10);

    // 检查值是否实际变化，使用adskipStorage接口
    adskipStorage.loadAdSkipPercentage().then(function(currentPercentage) {
      if (currentPercentage !== newPercentage) {
        adskipStorage.saveAdSkipPercentage(newPercentage).then(function() {
          showStatus(`已设置广告跳过百分比为 ${newPercentage}%`);
        });
      }
    });
  });

  // 百分比预设按钮
  const presetButtons = document.querySelectorAll('.preset-button');
  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const newValue = parseInt(this.getAttribute('data-value'), 10);

      // 检查值是否变化，使用adskipStorage接口
      adskipStorage.loadAdSkipPercentage().then(function(currentPercentage) {
        // 更新滑块和文本显示
        if (percentageSlider.value != newValue) {
          percentageSlider.value = newValue;
        }

        if (percentageValue.textContent != newValue) {
          percentageValue.textContent = newValue;
        }

        // 只有在值变化时才保存
        if (currentPercentage !== newValue) {
          adskipStorage.saveAdSkipPercentage(newValue).then(function() {
            showStatus(`已设置广告跳过百分比为 ${newValue}%`);
          });
        }
      });
    });
  });

  // 重置数据按钮
  const resetButton = document.getElementById('reset-data');
  resetButton.addEventListener('click', function() {
    if (confirm('确定要重置所有数据吗？此操作无法撤销。\n\n此操作将清除：\n- 所有已保存的广告跳过时间段\n- UP主白名单数据\n- 其他插件数据')) {
      // 使用adskipStorage模块的集中式方法
      adskipStorage.getVideoDataKeys().then(function(adskipDataKeys) {
        // 添加白名单键，一起清除
        adskipStorage.getWhitelistKeys().then(function(whitelistKeys) {
          const allKeysToRemove = [...adskipDataKeys, ...whitelistKeys];

          // 移除所有广告跳过数据和白名单
          adskipStorage.removeKeys(allKeysToRemove).then(function() {
            showStatus('已重置所有广告跳过数据，包括UP主白名单');

            // 如果当前在白名单选项卡，刷新白名单列表
            if (window.location.hash === '#whitelist') {
              loadWhitelistData();
            }
          });
        });
      });
    }
  });

  // 选项卡切换功能
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // 检查URL hash并切换到相应选项卡
  function checkUrlHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const targetTab = document.querySelector(`.tab-button[data-tab="${hash}"]`);
      if (targetTab) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        targetTab.classList.add('active');
        document.getElementById(`${hash}-tab`).classList.add('active');
      }
    }
  }

  // 页面加载时检查hash
  checkUrlHash();

  // 监听hash变化
  window.addEventListener('hashchange', checkUrlHash);

  tabButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');

      // 更新URL hash但不刷新页面
      history.pushState(null, null, `#${tabName}`);

      // 更新选项卡状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      this.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // 如果是白名单选项卡，加载白名单数据
      if (tabName === 'whitelist') {
        loadWhitelistData();
      }
    });
  });

  // 导入白名单按钮
  document.getElementById('whitelist-import').addEventListener('click', function() {
    const textarea = document.getElementById('whitelist-textarea');
    const text = textarea.value.trim();

    if (!text) {
      showStatus('请输入要导入的UP主名称', 'error');
      return;
    }

    // 使用adskipStorage的importUploaderWhitelist方法
    adskipStorage.importUploaderWhitelist(text).then(function(newWhitelist) {
      whitelistData = newWhitelist;
      renderWhitelist();
      showStatus(`已导入UP主到白名单`);
      textarea.value = '';
    }).catch(function(error) {
      showStatus(`导入失败: ${error.message}`, 'error');
    });
  });

  // 导出白名单按钮
  document.getElementById('whitelist-export').addEventListener('click', function() {
    const textarea = document.getElementById('whitelist-textarea');

    // 使用adskipStorage的exportUploaderWhitelist方法
    adskipStorage.exportUploaderWhitelist().then(function(whitelistText) {
      textarea.value = whitelistText;
      showStatus(`已导出UP主到文本框`);
    }).catch(function(error) {
      showStatus(`导出失败: ${error.message}`, 'error');
    });
  });

  // 复制到剪贴板按钮
  document.getElementById('whitelist-copy').addEventListener('click', function() {
    const textarea = document.getElementById('whitelist-textarea');
    const text = textarea.value.trim();

    if (!text) {
      showStatus('文本框为空，请先导出白名单', 'error');
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        showStatus('已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制失败:', err);
        showStatus('复制失败，请手动复制', 'error');
      });
  });

  // 如果页面加载时就在白名单选项卡，立即加载白名单数据
  if (window.location.hash === '#whitelist') {
    loadWhitelistData();
  }

  // 自定义服务器相关按钮
  loadCustomServerSettings();

  document.getElementById('enable-custom-server').addEventListener('change', function() {
    toggleCustomServer();
  });

  document.getElementById('reset-custom-server').addEventListener('click', function() {
    resetCustomServer();
  });

  document.getElementById('custom-server-url').addEventListener('input', function() {
    // 当用户输入时，如果当前是启用状态，则自动保存
    const enableCheckbox = document.getElementById('enable-custom-server');
    if (enableCheckbox.checked) {
      const url = document.getElementById('custom-server-url').value.trim();
      if (isValidServerUrl(url)) {
        chrome.storage.sync.set({customServerUrl: url});
      }
    }
  });

  // URL hash 检查
  checkUrlHash();
});

// 加载保存的设置，使用adskipStorage接口
function loadSettings() {
  // 由于getDebugMode是同步方法，我们单独处理它
  const debugMode = adskipStorage.getDebugMode();
  const debugModeToggle = document.getElementById('debug-mode');
  if (debugModeToggle) {
    debugModeToggle.checked = debugMode;
  }

  // 获取其他需要异步处理的设置
  Promise.all([
    adskipStorage.getEnabled(),
    adskipStorage.loadAdSkipPercentage(),
    adskipStorage.getSkipOwnVideos(),
    adskipStorage.getSearchPrecheck()
  ]).then(function([enabled, percentage, skipOwnVideos, searchPrecheck]) {
    // 加载功能启用状态
    const adskipToggle = document.getElementById('enable-adskip');
    if (adskipToggle) {
      adskipToggle.checked = enabled;
    }

    // 加载广告跳过百分比
    if (percentage !== undefined) {
      const percentageSlider = document.getElementById('skip-percentage');
      const percentageValue = document.getElementById('percentage-value');

      if (percentageSlider && percentageValue) {
        percentageSlider.value = percentage;
        percentageValue.textContent = percentage;
      }
    }

    // 加载"不检测自己视频"状态
    const skipOwnVideosToggle = document.getElementById('skip-own-videos');
    if (skipOwnVideosToggle) {
      skipOwnVideosToggle.checked = skipOwnVideos;
    }

    // 加载搜索页预检状态
    const searchPrecheckToggle = document.getElementById('search-precheck');
    if (searchPrecheckToggle) {
      searchPrecheckToggle.checked = searchPrecheck;
    }
  });
}

// 显示状态信息
function showStatus(message, type = 'success') {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;

  // 自动隐藏状态信息
  setTimeout(function() {
    statusElement.className = 'status';
  }, 3000);
}

// 添加存储变更监听器，保持UI与其他页面同步
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace !== 'local') return;

  console.log('changes', changes);
  console.log('namespace', namespace);
  console.log('typeof loadWhitelistData', typeof loadWhitelistData);
  console.log('window.location.hash', window.location.hash);

  // 监听管理员状态变化
  if (changes[adskipStorage.KEYS.ADMIN_AUTH] !== undefined) {
    checkAdminStatus();
  }

  // 监听广告跳过功能开关变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.ENABLED] !== undefined) {
    const adskipToggle = document.getElementById('enable-adskip');
    if (adskipToggle) {
      adskipToggle.checked = changes[adskipStorage.KEYS.ENABLED].newValue !== false;
    }
  }

  // 监听调试模式变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.DEBUG_MODE] !== undefined) {
    const debugModeToggle = document.getElementById('debug-mode');
    if (debugModeToggle) {
      debugModeToggle.checked = changes[adskipStorage.KEYS.DEBUG_MODE].newValue || false;
    }
  }

  // 监听"不检测自己视频"变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.SKIP_OWN_VIDEOS] !== undefined) {
    const skipOwnVideosToggle = document.getElementById('skip-own-videos');
    if (skipOwnVideosToggle) {
      skipOwnVideosToggle.checked = changes[adskipStorage.KEYS.SKIP_OWN_VIDEOS].newValue !== false;
    }
  }

  // 监听搜索页预检变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.SEARCH_PRECHECK] !== undefined) {
    const searchPrecheckToggle = document.getElementById('search-precheck');
    if (searchPrecheckToggle) {
      searchPrecheckToggle.checked = changes[adskipStorage.KEYS.SEARCH_PRECHECK].newValue === true;
    }
  }

  // 监听广告跳过百分比变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.PERCENTAGE] !== undefined) {
    const percentageSlider = document.getElementById('skip-percentage');
    const percentageValue = document.getElementById('percentage-value');

    if (percentageSlider && percentageValue) {
      const percentage = changes[adskipStorage.KEYS.PERCENTAGE].newValue;
      percentageSlider.value = percentage;
      percentageValue.textContent = percentage;
    }
  }

  // 监听白名单变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.UPLOADER_WHITELIST] !== undefined) {
    if (window.location.hash === '#whitelist') {
      loadWhitelistData();
    }
  }
});

// 自定义服务器URL验证函数
function isValidServerUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // 只允许 https，但 localhost:3000 可以用 http
    if (parsed.protocol === 'https:') {
      return true;
    } else if (parsed.protocol === 'http:' &&
               parsed.hostname === 'localhost' &&
               parsed.port === '3000') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// 加载自定义服务器设置
function loadCustomServerSettings() {
  chrome.storage.sync.get(['customServerUrl', 'customServerEnabled'], function(result) {
    const urlInput = document.getElementById('custom-server-url');
    const enableCheckbox = document.getElementById('enable-custom-server');
    const statusDiv = document.getElementById('custom-server-status');

    // 设置URL输入框
    if (result.customServerUrl) {
      urlInput.value = result.customServerUrl;
    }

    // 设置开关状态
    const isEnabled = result.customServerEnabled || false;
    enableCheckbox.checked = isEnabled;

    // 显示当前状态
    updateCustomServerStatus(isEnabled, result.customServerUrl);
  });
}

// 切换自定义服务器启用状态
function toggleCustomServer() {
  const enableCheckbox = document.getElementById('enable-custom-server');
  const newEnabled = enableCheckbox.checked;
  const urlInput = document.getElementById('custom-server-url');

  if (newEnabled) {
    let url = urlInput.value.trim();

    // 如果输入为空，则自动使用placeholder的值
    if (!url) {
      url = urlInput.placeholder;
      urlInput.value = url;
    }

    if (!isValidServerUrl(url)) {
      enableCheckbox.checked = false; // 验证失败，取消勾选
      showCustomServerStatus('无效的服务器地址。支持 https:// 或 http://localhost:3000', 'error');
      return;
    }

    // 保存设置
    chrome.storage.sync.set({
      customServerEnabled: true,
      customServerUrl: url
    }, function() {
      updateCustomServerStatus(true, url);
      showCustomServerStatus(`已启用自定义服务器: ${url}`, 'success');
    });
  } else {
    // 禁用自定义服务器
    chrome.storage.sync.set({
      customServerEnabled: false
    }, function() {
      updateCustomServerStatus(false);
      showCustomServerStatus('已关闭自定义服务器，使用默认官方服务器', 'info');
    });
  }
}

// 重置自定义服务器设置
function resetCustomServer() {
  if (confirm('确定要重置自定义服务器设置吗？这将清除保存的服务器地址并关闭自定义服务器功能。')) {
    chrome.storage.sync.remove(['customServerUrl', 'customServerEnabled'], function() {
      document.getElementById('custom-server-url').value = '';
      document.getElementById('enable-custom-server').checked = false;
      updateCustomServerStatus(false);
      showCustomServerStatus('已重置为默认设置', 'info');
    });
  }
}

// 更新自定义服务器状态显示
function updateCustomServerStatus(isEnabled, serverUrl = '') {
  const statusDiv = document.getElementById('custom-server-status');
  statusDiv.style.display = 'block'; // 确保状态区域可见

  if (isEnabled && serverUrl) {
    statusDiv.innerHTML = `<span style="color: #28a745;">✅ 当前使用: ${serverUrl}</span>`;
  } else {
    statusDiv.innerHTML = `<span style="color: #6c757d;">📡 使用默认官方服务器</span>`;
  }
}

// 显示自定义服务器状态消息
function showCustomServerStatus(message, type = 'info') {
  const statusDiv = document.getElementById('custom-server-status');
  statusDiv.style.display = 'block'; // 确保状态区域可见

  let color, icon;
  switch (type) {
    case 'success': color = '#28a745'; icon = '✅'; break;
    case 'error': color = '#dc3545'; icon = '❌'; break;
    case 'warning': color = '#ffc107'; icon = '⚠️'; break;
    default: color = '#6c757d'; icon = 'ℹ️';
  }

  statusDiv.innerHTML = `<span style="color: ${color};">${icon} ${message}</span>`;

  // 3秒后恢复到默认状态显示
  setTimeout(() => {
    chrome.storage.sync.get(['customServerEnabled', 'customServerUrl'], function(result) {
      updateCustomServerStatus(result.customServerEnabled, result.customServerUrl);
    });
  }, 3000);
}