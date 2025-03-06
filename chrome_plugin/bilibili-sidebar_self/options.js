// 初始化选项页面
document.addEventListener('DOMContentLoaded', function() {
  // 加载存储的设置
  loadSettings();

  // 功能开关监听
  document.getElementById('enable-adskip').addEventListener('change', function() {
    localStorage.setItem('adskip_enabled', this.checked ? 'true' : 'false');
    showStatus('设置已保存', 'success');
  });

  // 调试模式开关监听
  document.getElementById('debug-mode').addEventListener('change', function() {
    chrome.storage.local.set({'adskip_debug_mode': this.checked}, function() {
      showStatus('调试模式已' + (this.checked ? '启用' : '禁用'), 'success');
    }.bind(this));
  });

  // 广告跳过百分比滑块监听
  const percentageSlider = document.getElementById('skip-percentage');
  const percentageValue = document.getElementById('percentage-value');

  percentageSlider.addEventListener('input', function() {
    percentageValue.textContent = this.value;
  });

  percentageSlider.addEventListener('change', function() {
    localStorage.setItem('adskip_percentage', this.value);
    showStatus(`已设置广告跳过百分比为 ${this.value}%`, 'success');
  });

  // 百分比预设按钮
  const presetButtons = document.querySelectorAll('.preset-button');
  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const value = this.getAttribute('data-value');
      percentageSlider.value = value;
      percentageValue.textContent = value;
      localStorage.setItem('adskip_percentage', value);
      showStatus(`已设置广告跳过百分比为 ${value}%`, 'success');
    });
  });

  // 重置数据按钮
  document.getElementById('reset-data').addEventListener('click', function() {
    if (confirm('确定要重置所有数据吗？此操作将清空所有保存的广告跳过时间段和设置！')) {
      resetAllData();
    }
  });
});

// 加载保存的设置
function loadSettings() {
  // 加载功能启用状态
  const isEnabled = localStorage.getItem('adskip_enabled') !== 'false';
  document.getElementById('enable-adskip').checked = isEnabled;

  // 加载调试模式状态
  chrome.storage.local.get('adskip_debug_mode', function(result) {
    document.getElementById('debug-mode').checked = result.adskip_debug_mode || false;
  });

  // 加载广告跳过百分比
  const savedPercentage = localStorage.getItem('adskip_percentage');
  if (savedPercentage !== null) {
    const percentage = parseInt(savedPercentage, 10);
    document.getElementById('skip-percentage').value = percentage;
    document.getElementById('percentage-value').textContent = percentage;
  }
}

// 重置所有数据
function resetAllData() {
  // 获取并删除所有adskip_开头的存储键
  chrome.storage.local.get(null, function(items) {
    const allKeys = Object.keys(items);
    const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');

    if (adskipKeys.length > 0) {
      chrome.storage.local.remove(adskipKeys, function() {
        showStatus('所有广告跳过时间段数据已重置', 'success');
      });
    } else {
      showStatus('没有找到需要重置的数据', 'success');
    }
  });

  // 保留调试模式设置，但重置其他localStorage设置
  const debugMode = localStorage.getItem('adskip_debug_mode');
  localStorage.clear();
  if (debugMode !== null) {
    localStorage.setItem('adskip_debug_mode', debugMode);
  }

  // 重置界面控件为默认值
  document.getElementById('enable-adskip').checked = true;
  document.getElementById('skip-percentage').value = 5;
  document.getElementById('percentage-value').textContent = 5;

  // 保存默认设置
  localStorage.setItem('adskip_enabled', 'true');
  localStorage.setItem('adskip_percentage', '5');
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