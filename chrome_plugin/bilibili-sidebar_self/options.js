// 全局变量
let whitelistData = [];

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
    adskipStorage.loadAdSkipPercentage()
  ]).then(function([enabled, percentage]) {
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