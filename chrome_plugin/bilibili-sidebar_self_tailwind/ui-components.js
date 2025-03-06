'use strict';

// UI Component Functions using Tailwind CSS classes

// 创建广告跳过按钮
function createAdSkipButton() {
  const button = document.createElement('div');
  button.id = 'adskip-button';
  button.className = 'adskip-button';
  button.innerHTML = '⏩ 广告跳过';
  return button;
}

// 创建广告跳过面板
function createAdSkipPanel() {
  const panel = document.createElement('div');
  panel.id = 'adskip-panel';
  panel.className = 'adskip-panel';

  // 面板头部
  const header = document.createElement('div');
  header.className = 'adskip-panel-header';

  const title = document.createElement('h3');
  title.className = 'adskip-title';
  title.textContent = '广告跳过设置';

  // 开关容器
  const switchContainer = document.createElement('label');
  switchContainer.className = 'adskip-switch';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'adskip-toggle';

  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'adskip-slider';

  // 组装开关
  switchContainer.appendChild(checkbox);
  switchContainer.appendChild(toggleSlider);

  // 组装头部
  header.appendChild(title);
  header.appendChild(switchContainer);
  panel.appendChild(header);

  // 视频ID显示
  const videoId = document.createElement('div');
  videoId.id = 'adskip-video-id';
  videoId.className = 'mb-1.5 text-xs text-gray-500';
  panel.appendChild(videoId);

  // 广告时间输入区域
  const inputLabel = document.createElement('p');
  inputLabel.className = 'mt-2.5 mb-1.5';
  inputLabel.textContent = '广告时间段 (开始-结束,开始-结束)';
  panel.appendChild(inputLabel);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'adskip-timestamps';
  input.placeholder = '例如: 61-87,120-145';
  panel.appendChild(input);

  // 按钮行
  const buttonRow = document.createElement('div');
  buttonRow.className = 'adskip-button-row';

  const saveButton = document.createElement('button');
  saveButton.textContent = '保存';
  saveButton.id = 'adskip-save';
  saveButton.className = 'adskip-btn';

  const genLinkButton = document.createElement('button');
  genLinkButton.textContent = '生成分享链接';
  genLinkButton.id = 'adskip-gen-link';
  genLinkButton.className = 'adskip-btn';

  buttonRow.appendChild(saveButton);
  buttonRow.appendChild(genLinkButton);
  panel.appendChild(buttonRow);

  // 百分比滑块容器
  const percentageContainer = document.createElement('div');
  percentageContainer.className = 'my-4 p-2.5 bg-gray-50 rounded-md';

  const percentageLabel = document.createElement('div');
  percentageLabel.className = 'mb-2.5 font-bold text-gray-700';
  percentageLabel.innerHTML = '广告识别门槛: <span id="adskip-percentage-value" style="color: #FB7299; font-weight: bold;">5</span>%';

  const percentageSlider = document.createElement('input');
  percentageSlider.type = 'range';
  percentageSlider.min = '1';
  percentageSlider.max = '20';
  percentageSlider.value = '5';
  percentageSlider.id = 'adskip-percentage-slider';
  percentageSlider.className = 'adskip-percentage-slider';

  const hints = document.createElement('div');
  hints.style.display = 'flex';
  hints.style.justifyContent = 'space-between';
  hints.style.fontSize = '12px';
  hints.style.color = '#666';
  hints.style.marginTop = '5px';

  const leftHint = document.createElement('span');
  leftHint.style.cursor = 'pointer';
  leftHint.style.padding = '3px 6px';
  leftHint.style.borderRadius = '3px';
  leftHint.textContent = '低 (1%)';
  leftHint.dataset.value = '1';

  const midHint = document.createElement('span');
  midHint.style.cursor = 'pointer';
  midHint.style.padding = '3px 6px';
  midHint.style.borderRadius = '3px';
  midHint.textContent = '中 (5%)';
  midHint.dataset.value = '5';

  const highHint = document.createElement('span');
  highHint.style.cursor = 'pointer';
  highHint.style.padding = '3px 6px';
  highHint.style.borderRadius = '3px';
  highHint.textContent = '高 (15%)';
  highHint.dataset.value = '15';

  hints.appendChild(leftHint);
  hints.appendChild(midHint);
  hints.appendChild(highHint);

  percentageContainer.appendChild(percentageLabel);
  percentageContainer.appendChild(percentageSlider);
  percentageContainer.appendChild(hints);
  panel.appendChild(percentageContainer);

  // 状态信息
  const status = document.createElement('div');
  status.id = 'adskip-status';
  status.style.marginTop = '10px';
  status.style.color = '#4CAF50';
  status.style.display = 'none';
  panel.appendChild(status);

  // 结果区域
  const result = document.createElement('div');
  result.id = 'adskip-result';
  result.style.marginTop = '10px';
  result.style.wordBreak = 'break-all';
  panel.appendChild(result);

  // 管理员区域
  const adminContainer = document.createElement('div');
  adminContainer.style.marginTop = '15px';
  adminContainer.style.paddingTop = '10px';
  adminContainer.style.borderTop = '1px solid #eee';

  const adminButton = document.createElement('button');
  adminButton.id = 'adskip-admin-btn';
  adminButton.style.background = '#333';
  adminButton.style.color = 'white';
  adminButton.style.border = 'none';
  adminButton.style.padding = '6px 10px';
  adminButton.style.borderRadius = '4px';
  adminButton.style.cursor = 'pointer';
  adminButton.style.fontSize = '12px';
  adminButton.style.width = '100%';
  adminButton.textContent = '管理员功能';

  adminContainer.appendChild(adminButton);
  panel.appendChild(adminContainer);

  return panel;
}

// 创建管理员面板
function createAdminPanel() {
  const panel = document.createElement('div');
  panel.id = 'adskip-admin-panel';
  panel.style.position = 'fixed';
  panel.style.top = '50%';
  panel.style.left = '50%';
  panel.style.transform = 'translate(-50%, -50%)';
  panel.style.width = '600px';
  panel.style.maxHeight = '80vh';
  panel.style.padding = '20px';
  panel.style.backgroundColor = 'white';
  panel.style.borderRadius = '8px';
  panel.style.zIndex = '10001';
  panel.style.boxShadow = '0 4px 25px rgba(0,0,0,0.25)';
  panel.style.fontSize = '14px';
  panel.style.overflowY = 'auto';

  // 管理员面板头部
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '15px';

  const title = document.createElement('h3');
  title.style.margin = '0';
  title.style.fontSize = '18px';
  title.style.fontWeight = 'bold';
  title.style.color = '#333';
  title.textContent = '管理员功能';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'adskip-close-admin';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#666';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.innerHTML = '&times;';

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // 调试切换
  const debugContainer = document.createElement('div');
  debugContainer.style.marginBottom = '20px';

  const debugToggle = document.createElement('label');
  debugToggle.style.display = 'flex';
  debugToggle.style.alignItems = 'center';
  debugToggle.style.cursor = 'pointer';

  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';
  debugCheckbox.id = 'adskip-debug-mode';
  debugCheckbox.style.marginRight = '8px';

  const debugLabel = document.createElement('span');
  debugLabel.textContent = '启用调试模式';
  debugLabel.style.color = '#333';

  debugToggle.appendChild(debugCheckbox);
  debugToggle.appendChild(debugLabel);
  debugContainer.appendChild(debugToggle);
  panel.appendChild(debugContainer);

  // 状态部分
  const statusSection = document.createElement('div');
  statusSection.style.marginBottom = '20px';

  const statusTitle = document.createElement('h4');
  statusTitle.style.fontSize = '16px';
  statusTitle.style.fontWeight = '500';
  statusTitle.style.color = '#333';
  statusTitle.style.marginBottom = '8px';
  statusTitle.textContent = '当前状态';

  const statusInfo = document.createElement('div');
  statusInfo.id = 'adskip-status-info';
  statusInfo.style.padding = '12px';
  statusInfo.style.backgroundColor = '#f5f5f5';
  statusInfo.style.borderRadius = '4px';
  statusInfo.style.color = '#333';

  statusSection.appendChild(statusTitle);
  statusSection.appendChild(statusInfo);
  panel.appendChild(statusSection);

  // 数据区域
  const dataSection = document.createElement('div');
  dataSection.style.marginBottom = '20px';

  const dataTitle = document.createElement('h4');
  dataTitle.style.fontSize = '16px';
  dataTitle.style.fontWeight = '500';
  dataTitle.style.color = '#333';
  dataTitle.style.marginBottom = '8px';
  dataTitle.textContent = '已保存数据';

  const dataList = document.createElement('div');
  dataList.id = 'adskip-video-list';
  dataList.style.maxHeight = '200px';
  dataList.style.overflowY = 'auto';
  dataList.style.border = '1px solid #ddd';
  dataList.style.borderRadius = '4px';
  dataList.style.padding = '8px';

  const noData = document.createElement('div');
  noData.id = 'adskip-no-data';
  noData.style.textAlign = 'center';
  noData.style.color = '#999';
  noData.style.padding = '20px 0';
  noData.textContent = '没有找到任何已保存的数据';
  noData.style.display = 'none';

  dataList.appendChild(noData);
  dataSection.appendChild(dataTitle);
  dataSection.appendChild(dataList);
  panel.appendChild(dataSection);

  // 底部按钮
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.marginTop = '20px';

  const exportBtn = document.createElement('button');
  exportBtn.id = 'adskip-export';
  exportBtn.style.backgroundColor = '#555';
  exportBtn.style.color = 'white';
  exportBtn.style.padding = '8px 16px';
  exportBtn.style.borderRadius = '4px';
  exportBtn.style.border = 'none';
  exportBtn.style.cursor = 'pointer';
  exportBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
  exportBtn.textContent = '导出所有数据';

  const clearBtn = document.createElement('button');
  clearBtn.id = 'adskip-clear-all';
  clearBtn.style.backgroundColor = '#e53935';
  clearBtn.style.color = 'white';
  clearBtn.style.padding = '8px 16px';
  clearBtn.style.borderRadius = '4px';
  clearBtn.style.border = 'none';
  clearBtn.style.cursor = 'pointer';
  clearBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
  clearBtn.textContent = '清除所有数据';

  footer.appendChild(exportBtn);
  footer.appendChild(clearBtn);
  panel.appendChild(footer);

  return panel;
}

// 创建视频项
function createVideoItem(videoId, timestamp, formattedTime) {
  const item = document.createElement('div');
  item.className = 'adskip-video-item';
  item.style.borderBottom = '1px solid #eee';
  item.style.padding = '8px 0';
  item.dataset.videoId = videoId;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '4px';

  const id = document.createElement('div');
  id.style.fontSize = '12px';
  id.style.fontWeight = '500';
  id.style.color = '#333';
  id.textContent = 'ID: ' + videoId;

  const time = document.createElement('div');
  time.style.fontSize = '12px';
  time.style.color = '#999';
  time.textContent = formattedTime;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'adskip-delete-btn';
  deleteBtn.style.marginLeft = '8px';
  deleteBtn.style.background = '#f1f1f1';
  deleteBtn.style.color = '#666';
  deleteBtn.style.border = 'none';
  deleteBtn.style.borderRadius = '50%';
  deleteBtn.style.width = '20px';
  deleteBtn.style.height = '20px';
  deleteBtn.style.fontSize = '12px';
  deleteBtn.style.display = 'flex';
  deleteBtn.style.alignItems = 'center';
  deleteBtn.style.justifyContent = 'center';
  deleteBtn.style.cursor = 'pointer';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.dataset.videoId = videoId;

  header.appendChild(id);
  const rightSide = document.createElement('div');
  rightSide.style.display = 'flex';
  rightSide.style.alignItems = 'center';
  rightSide.appendChild(time);
  rightSide.appendChild(deleteBtn);
  header.appendChild(rightSide);

  const content = document.createElement('div');
  content.style.fontSize = '12px';
  content.style.color = '#666';
  content.textContent = timestamp;

  item.appendChild(header);
  item.appendChild(content);

  return item;
}

// Export UI component functions
window.createAdSkipButton = createAdSkipButton;
window.createAdSkipPanel = createAdSkipPanel;
window.createAdminPanel = createAdminPanel;
window.createVideoItem = createVideoItem;