// 初始化选项页面
document.addEventListener('DOMContentLoaded', function() {
  // 加载存储的设置
  loadSettings();

  // 功能开关监听
  document.getElementById('enable-adskip').addEventListener('change', function() {
    const newEnabled = this.checked;
    chrome.storage.local.get('adskip_enabled', function(result) {
      // 只有当状态确实变化时才设置
      if (result.adskip_enabled !== newEnabled) {
        chrome.storage.local.set({'adskip_enabled': newEnabled}, function() {
          showStatus('设置已保存', 'success');
        });
      }
    });
  });

  // 调试模式开关监听
  document.getElementById('debug-mode').addEventListener('change', function() {
    const newDebugMode = this.checked;
    chrome.storage.local.get('adskip_debug_mode', function(result) {
      // 只有当状态确实变化时才设置
      if (result.adskip_debug_mode !== newDebugMode) {
        chrome.storage.local.set({'adskip_debug_mode': newDebugMode}, function() {
          showStatus('调试模式已' + (newDebugMode ? '启用' : '禁用'), 'success');
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
          showStatus(`已设置广告跳过百分比为 ${newPercentage}%`, 'success');
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
            showStatus(`已设置广告跳过百分比为 ${newValue}%`, 'success');
          });
        }
      });
    });
  });

  // 重置数据按钮
  document.getElementById('reset-data').addEventListener('click', function() {
    if (confirm('确定要重置所有数据吗？此操作将清空所有保存的广告跳过时间段和设置！')) {
      resetAllData();
    }
  });

  // 监听存储变化，实时更新界面
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local') {
      // 更新广告跳过百分比
      if (changes.adskip_percentage) {
        const newPercentage = changes.adskip_percentage.newValue;
        const percentageSlider = document.getElementById('skip-percentage');
        const percentageValue = document.getElementById('percentage-value');

        // 只有当值确实不同时才更新，避免事件循环
        if (percentageSlider && parseInt(percentageSlider.value) !== newPercentage) {
          percentageSlider.value = newPercentage;
        }

        if (percentageValue && percentageValue.textContent != newPercentage) {
          percentageValue.textContent = newPercentage;
        }
      }

      // 更新功能开关状态
      if (changes.adskip_enabled !== undefined) {
        const enableCheckbox = document.getElementById('enable-adskip');
        const newEnabled = changes.adskip_enabled.newValue;

        // 避免不必要的触发
        if (enableCheckbox && enableCheckbox.checked !== newEnabled) {
          enableCheckbox.checked = newEnabled;
        }
      }

      // 更新调试模式状态
      if (changes.adskip_debug_mode !== undefined) {
        const debugCheckbox = document.getElementById('debug-mode');
        const newDebugMode = changes.adskip_debug_mode.newValue;

        // 避免不必要的触发
        if (debugCheckbox && debugCheckbox.checked !== newDebugMode) {
          debugCheckbox.checked = newDebugMode;
        }
      }
    }
  });
});

// 加载保存的设置
function loadSettings() {
  // 加载所有设置
  chrome.storage.local.get(['adskip_enabled', 'adskip_debug_mode', 'adskip_percentage'], function(result) {
    // 加载功能启用状态
    document.getElementById('enable-adskip').checked = result.adskip_enabled !== false;

    // 加载调试模式状态
    document.getElementById('debug-mode').checked = result.adskip_debug_mode || false;

    // 加载广告跳过百分比
    if (result.adskip_percentage !== undefined) {
      const percentage = result.adskip_percentage;
      document.getElementById('skip-percentage').value = percentage;
      document.getElementById('percentage-value').textContent = percentage;
    }
  });
}

// 重置所有数据
function resetAllData() {
  // 获取并删除所有adskip_开头的存储键
  chrome.storage.local.get(null, function(items) {
    const allKeys = Object.keys(items);
    const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') &&
      key !== 'adskip_debug_mode' &&
      key !== 'adskip_enabled' &&
      key !== 'adskip_percentage');

    if (adskipKeys.length > 0) {
      chrome.storage.local.remove(adskipKeys, function() {
        showStatus('所有广告跳过时间段数据已重置', 'success');
      });
    } else {
      showStatus('没有找到需要重置的数据', 'success');
    }
  });

  // 保留调试模式设置，重置其他设置为默认值
  chrome.storage.local.get('adskip_debug_mode', function(result) {
    const debugMode = result.adskip_debug_mode || false;

    // 设置默认值
    chrome.storage.local.set({
      'adskip_enabled': true,
      'adskip_percentage': 5,
      'adskip_debug_mode': debugMode
    }, function() {
      // 重置界面控件为默认值
      document.getElementById('enable-adskip').checked = true;
      document.getElementById('skip-percentage').value = 5;
      document.getElementById('percentage-value').textContent = 5;

      showStatus('设置已重置为默认值', 'success');
    });
  });
}

// 显示状态信息
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;

  // 自动隐藏状态信息
  setTimeout(function() {
    statusDiv.className = 'status';
  }, 3000);
}