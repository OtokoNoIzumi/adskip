document.addEventListener('DOMContentLoaded', function() {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatDisplay = document.getElementById('chat-display');

  // 确保元素存在后再添加事件监听器
  if (sendButton) {
    sendButton.addEventListener('click', function() {
      const message = messageInput.value;
      if (message && message.trim() !== "") {
        sendMessageToContentScript(message); // 发送消息到 content.js
        messageInput.value = ""; // 清空输入框
      }
    });
  } else {
    console.error('元素未找到: 请确认HTML中包含id为message-input、send-button和chat-display的元素');
  }

  // 监听输入框回车事件
  messageInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      sendButton.click(); // 触发发送按钮的点击事件
      event.preventDefault(); // 阻止默认的回车换行行为
    }
  });

  // 接收来自 content.js 的消息
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'response') {
      displayMessage('插件回复: ' + message.text, 'plugin-message'); // 显示插件回复
    }
  });

  // 发送消息到 content.js 的函数
  function sendMessageToContentScript(message) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {type: 'chatMessage', text: message}, function(response) {
        if (response && response.text) {
          displayMessage('你: ' + message, 'user-message'); // 显示用户发送的消息
          displayMessage('插件回复: ' + response.text, 'plugin-message'); // 显示插件回复
        } else {
          displayMessage('你: ' + message, 'user-message'); // 即使没有回复，也显示用户消息
          displayMessage('插件回复: (无回复)', 'plugin-message'); // 显示无回复提示
        }
      });
    });
  }

  // 显示消息在聊天框的函数
  function displayMessage(text, messageType) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = text;
    messageDiv.classList.add('message', messageType); // 添加消息类型 class
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight; // 滚动到底部
  }

  // 为选项按钮添加点击事件
  document.getElementById('go-to-options').addEventListener('click', function() {
    // 打开B站主页
    chrome.tabs.create({url: 'https://www.bilibili.com/video/'});
  });

  // 获取当前标签页信息
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;

    // 检查是否是B站视频页面
    if (url.includes('bilibili.com/video/')) {
      // 通过正则表达式提取视频ID
      const match = url.match(/\/video\/(BV[\w]+)/);
      let videoId = match ? match[1] : '';

      if (videoId) {
        // 查询这个视频是否有保存的广告时间段
        chrome.storage.local.get(`adskip_${videoId}`, function(result) {
          const savedData = result[`adskip_${videoId}`];

          // 如果有，则在界面上显示
          if (savedData) {
            try {
              const timestamps = JSON.parse(savedData);
              const timeString = timestamps.map(ad => `${ad.start_time}-${ad.end_time}`).join(',');

              // 创建显示区域
              const div = document.createElement('div');
              div.className = 'instructions';
              div.innerHTML = `
                <h2>当前视频设置</h2>
                <p>视频ID: ${videoId}</p>
                <p>广告时间段: <span class="format">${timeString}</span></p>
                <p>功能状态: <span class="format">${localStorage.getItem('adskip_enabled') === 'false' ? '已禁用' : '已启用'}</span></p>
              `;

              // 插入到按钮前面
              const button = document.getElementById('go-to-options');
              button.parentNode.insertBefore(div, button);

              // 修改按钮文字
              button.textContent = '打开视频页面';
            } catch (e) {
              console.error('解析存储数据失败:', e);
            }
          }
        });
      }
    }
  });

  // 尝试显示管理员状态
  const isAdmin = sessionStorage.getItem('adskip_admin_authorized') === 'true';
  if (isAdmin) {
    const adminInfo = document.createElement('div');
    adminInfo.className = 'instructions';
    adminInfo.innerHTML = `
      <h2>管理员状态</h2>
      <p>当前已登录为管理员</p>
      <p>会话有效期至浏览器关闭</p>
    `;

    // 插入到页面中
    document.querySelector('.feature-list').insertAdjacentElement('afterend', adminInfo);
  }
});