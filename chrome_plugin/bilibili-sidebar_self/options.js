// 初始化选项页面
document.addEventListener('DOMContentLoaded', function() {
  // 加载存储的设置
  loadSettings();

  // 功能开关监听
  const adskipToggle = document.getElementById('enable-adskip');
  adskipToggle.addEventListener('change', function() {
    const newEnabled = this.checked;
    chrome.storage.local.get('adskip_enabled', function(result) {
      // 只有当状态确实变化时才设置
      if (result.adskip_enabled !== newEnabled) {
        chrome.storage.local.set({'adskip_enabled': newEnabled}, function() {
          showStatus(newEnabled ? '已启用广告跳过功能' : '已禁用广告跳过功能');
        });
      }
    });
  });

  // 调试模式开关监听
  const debugModeToggle = document.getElementById('debug-mode');
  debugModeToggle.addEventListener('change', function() {
    const newDebugMode = this.checked;
    chrome.storage.local.get('adskip_debug_mode', function(result) {
      // 只有当状态确实变化时才设置
      if (result.adskip_debug_mode !== newDebugMode) {
        chrome.storage.local.set({'adskip_debug_mode': newDebugMode}, function() {
          showStatus(newDebugMode ? '已启用调试模式' : '已禁用调试模式');
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

    // 检查值是否实际变化
    chrome.storage.local.get('adskip_percentage', function(result) {
      const currentPercentage = result.adskip_percentage || 5;

      if (currentPercentage !== newPercentage) {
        chrome.storage.local.set({'adskip_percentage': newPercentage}, function() {
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

      // 检查值是否变化
      chrome.storage.local.get('adskip_percentage', function(result) {
        const currentPercentage = result.adskip_percentage || 5;

        // 更新滑块和文本显示
        if (percentageSlider.value != newValue) {
          percentageSlider.value = newValue;
        }

        if (percentageValue.textContent != newValue) {
          percentageValue.textContent = newValue;
        }

        // 只有在值变化时才保存
        if (currentPercentage !== newValue) {
          chrome.storage.local.set({'adskip_percentage': newValue}, function() {
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
      chrome.storage.local.get(null, function(items) {
        const allKeys = Object.keys(items);

        // 过滤出广告跳过相关的键，但排除核心配置项
        const adskipDataKeys = allKeys.filter(key =>
          key.startsWith('adskip_') &&
          key !== 'adskip_debug_mode' &&
          key !== 'adskip_enabled' &&
          key !== 'adskip_percentage' &&
          key !== 'adskip_admin_authorized'
        );

        // 移除所有广告跳过数据
        chrome.storage.local.remove(adskipDataKeys, function() {
          showStatus('已重置所有广告跳过数据，包括UP主白名单');

          // 如果当前在白名单选项卡，刷新白名单列表
          if (window.location.hash === '#whitelist') {
            loadWhitelistData();
          }
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

  // 白名单管理功能
  let whitelistData = [];

  // 加载白名单数据
  function loadWhitelistData() {
    chrome.storage.local.get('adskip_uploader_whitelist', function(result) {
      if (result.adskip_uploader_whitelist) {
        try {
          whitelistData = JSON.parse(result.adskip_uploader_whitelist);
          renderWhitelist();
        } catch (e) {
          console.error('解析白名单数据失败', e);
          whitelistData = [];
          renderWhitelist();
        }
      } else {
        whitelistData = [];
        renderWhitelist();
      }
    });
  }

  // 渲染白名单列表
  function renderWhitelist() {
    const container = document.getElementById('whitelist-list');
    const countElement = document.getElementById('whitelist-count');

    // 更新计数
    const enabledCount = whitelistData.filter(item =>
      typeof item === 'string' || item.enabled !== false
    ).length;
    countElement.textContent = enabledCount;

    // 清空容器
    container.innerHTML = '';

    // 如果白名单为空，显示提示
    if (whitelistData.length === 0) {
      container.innerHTML = '<div class="whitelist-empty">白名单为空，您可以在视频页面将UP主添加到白名单</div>';
      return;
    }

    // 创建列表项
    whitelistData.forEach(function(item, index) {
      const itemName = typeof item === 'string' ? item : item.name;
      const isEnabled = typeof item === 'string' ? true : (item.enabled !== false);
      const addedAt = typeof item === 'string' ? null : item.addedAt;

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

  // 切换白名单项目的启用状态
  function toggleWhitelistItem(index, enabled) {
    if (index < 0 || index >= whitelistData.length) return;

    // 如果是字符串形式，转换为对象
    if (typeof whitelistData[index] === 'string') {
      const name = whitelistData[index];
      whitelistData[index] = {
        name: name,
        addedAt: Date.now(),
        enabled: enabled
      };
    } else {
      whitelistData[index].enabled = enabled;
    }

    saveWhitelist();
  }

  // 删除白名单项目
  function deleteWhitelistItem(index) {
    if (index < 0 || index >= whitelistData.length) return;

    const item = whitelistData[index];
    const itemName = typeof item === 'string' ? item : item.name;

    if (confirm(`确定要从白名单中删除"${itemName}"吗？`)) {
      whitelistData.splice(index, 1);
      saveWhitelist();
    }
  }

  // 保存白名单到存储
  function saveWhitelist() {
    chrome.storage.local.set({
      'adskip_uploader_whitelist': JSON.stringify(whitelistData)
    }, function() {
      renderWhitelist();
      showStatus('白名单已更新');

      // 确保触发事件，即使内容相同
      // 这有助于通知所有页面刷新白名单状态
      chrome.storage.local.get('adskip_uploader_whitelist', function(result) {
        // 简单地重新保存一次，强制触发事件
        chrome.storage.local.set({
          'adskip_uploader_whitelist': result.adskip_uploader_whitelist
        }, function() {
          console.log("已强制触发白名单更新事件");
        });
      });
    });
  }

  // 导入白名单按钮
  document.getElementById('whitelist-import').addEventListener('click', function() {
    const textarea = document.getElementById('whitelist-textarea');
    const text = textarea.value.trim();

    if (!text) {
      showStatus('请输入要导入的UP主名称', 'error');
      return;
    }

    // 解析文本
    const names = text.split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) {
      showStatus('未找到有效的UP主名称', 'error');
      return;
    }

    // 合并到现有白名单
    const existingNames = new Set(whitelistData.map(item =>
      typeof item === 'string' ? item : item.name
    ));

    const newItems = [];
    const duplicates = [];

    names.forEach(name => {
      if (existingNames.has(name)) {
        duplicates.push(name);
      } else {
        newItems.push({
          name: name,
          addedAt: Date.now(),
          enabled: true
        });
        existingNames.add(name);
      }
    });

    // 添加新项目
    whitelistData = [...whitelistData, ...newItems];

    // 保存并提示
    if (newItems.length > 0) {
      saveWhitelist();
      showStatus(`已导入 ${newItems.length} 个UP主到白名单` +
        (duplicates.length > 0 ? `，${duplicates.length} 个重复项已忽略` : ''));
      textarea.value = '';
    } else {
      showStatus(`所有UP主(${duplicates.length}个)均已存在于白名单中`, 'error');
    }
  });

  // 导出白名单按钮
  document.getElementById('whitelist-export').addEventListener('click', function() {
    const textarea = document.getElementById('whitelist-textarea');

    // 提取启用的UP主名称
    const names = whitelistData
      .filter(item => typeof item === 'string' || item.enabled !== false)
      .map(item => typeof item === 'string' ? item : item.name);

    if (names.length === 0) {
      showStatus('白名单为空，无法导出', 'error');
      return;
    }

    textarea.value = names.join('\n');
    showStatus(`已导出 ${names.length} 个UP主到文本框`);
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

// 加载保存的设置
function loadSettings() {
  // 加载所有设置
  chrome.storage.local.get(['adskip_enabled', 'adskip_debug_mode', 'adskip_percentage'], function(result) {
    // 加载功能启用状态
    const adskipToggle = document.getElementById('enable-adskip');
    adskipToggle.checked = result.adskip_enabled !== false;

    // 加载调试模式状态
    const debugModeToggle = document.getElementById('debug-mode');
    debugModeToggle.checked = result.adskip_debug_mode || false;

    // 加载广告跳过百分比
    if (result.adskip_percentage !== undefined) {
      const percentage = result.adskip_percentage;
      const percentageSlider = document.getElementById('skip-percentage');
      const percentageValue = document.getElementById('percentage-value');

      percentageSlider.value = percentage;
      percentageValue.textContent = percentage;
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

  // 监听广告跳过功能开关变化
  if (changes.adskip_enabled !== undefined) {
    const adskipToggle = document.getElementById('enable-adskip');
    if (adskipToggle) {
      adskipToggle.checked = changes.adskip_enabled.newValue !== false;
    }
  }

  // 监听调试模式变化
  if (changes.adskip_debug_mode !== undefined) {
    const debugModeToggle = document.getElementById('debug-mode');
    if (debugModeToggle) {
      debugModeToggle.checked = changes.adskip_debug_mode.newValue || false;
    }
  }

  // 监听广告跳过百分比变化
  if (changes.adskip_percentage !== undefined) {
    const percentageSlider = document.getElementById('skip-percentage');
    const percentageValue = document.getElementById('percentage-value');

    if (percentageSlider && percentageValue) {
      const percentage = changes.adskip_percentage.newValue;
      percentageSlider.value = percentage;
      percentageValue.textContent = percentage;
    }
  }

  // 监听白名单变化，如果当前在白名单选项卡，则刷新白名单列表
  if (changes.adskip_uploader_whitelist !== undefined && window.location.hash === '#whitelist') {
    // 检查函数是否存在再调用，避免在非选项页面调用时报错
    if (typeof loadWhitelistData === 'function') {
      loadWhitelistData();
    }
  }
});