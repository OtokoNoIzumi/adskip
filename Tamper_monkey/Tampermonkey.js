// ==UserScript==
// @name         Bilibili Sidebar Chat with Ad Skip (Tampermonkey)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Bilibili sidebar chat with basic ad skipping
// @author       You
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/bangumi/play/*
// @match        *://www.bilibili.com/list/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // == Ad Timestamps Data ==
  const adTimestamps = [
      { "start_time": 5, "end_time": 10, "description": "Ad segment 1 (5s-10s)" },
      { "start_time": 15, "end_time": 20, "description": "Ad segment 2 (15s-20s)" }
  ];

  // == CSS Styles (embedded in JavaScript) ==
  const css = `
    #tampermonkey-sidebar-chat {
        position: fixed;
        right: 10px;
        top: 80px;
        width: 300px;
        height: 500px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    #tampermonkey-chat-header {
        background-color: #FB7299;
        color: white;
        padding: 10px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    #tampermonkey-chat-display {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        background-color: #f8f8f8;
    }
    .tampermonkey-chat-message {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 4px;
        max-width: 80%;
        word-break: break-word;
    }
    .tampermonkey-user-message {
        background-color: #E6F7FF;
        margin-left: auto;
        border-radius: 12px 12px 0 12px;
    }
    .tampermonkey-system-message {
        background-color: #ECECEC;
        border-radius: 12px 12px 12px 0;
    }
    #tampermonkey-chat-input {
        display: flex;
        padding: 10px;
        background-color: white;
        border-top: 1px solid #eee;
    }
    #tampermonkey-message-input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 16px;
        padding: 8px 12px;
        margin-right: 8px;
        outline: none;
    }
    #tampermonkey-send-button {
        background-color: #FB7299;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 0 12px;
        cursor: pointer;
    }
    #tampermonkey-send-button:hover {
        background-color: #fc8bab;
    }
    .tampermonkey-timestamp {
        font-size: 10px;
        color: #999;
        display: block;
        margin-top: 2px;
    }
    #tampermonkey-toggle-button {
        cursor: pointer;
    }
  `;

  // == HTML Structure (embedded in JavaScript) ==
  const sidebarHTML = `
    <div id="tampermonkey-sidebar-chat">
        <div id="tampermonkey-chat-header">
            <span>B站聊天</span>
            <span id="tampermonkey-toggle-button">_</span>
        </div>
        <div id="tampermonkey-chat-display"></div>
        <div id="tampermonkey-chat-input">
            <input type="text" id="tampermonkey-message-input" placeholder="输入消息...">
            <button id="tampermonkey-send-button">发送</button>
        </div>
    </div>
  `;

  // == Inject CSS Styles and Sidebar HTML (Same as before) ==
  const styleElement = document.createElement('style');
  styleElement.textContent = css;
  document.head.appendChild(styleElement);
  document.body.insertAdjacentHTML('beforeend', sidebarHTML);

  // == JavaScript Logic (adapted and extended for ad skipping) ==
  const messageInput = document.getElementById('tampermonkey-message-input');
  const sendButton = document.getElementById('tampermonkey-send-button');
  const chatDisplay = document.getElementById('tampermonkey-chat-display');
  const toggleButton = document.getElementById('tampermonkey-toggle-button');
  let videoPlayer = null; // Variable to store video player element
  let adCheckInterval = null; // Variable for ad check interval

  // Add null checks before attaching event listeners
  if (sendButton) {
    sendButton.addEventListener('click', function() {
      if (messageInput && messageInput.value.trim() !== '') {
        handleMessage(messageInput.value);
        messageInput.value = '';
      }
    });
  } else {
    console.error("Send button element not found!");
  }

  if (messageInput) {
    messageInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && messageInput.value.trim() !== '') {
        handleMessage(messageInput.value);
        messageInput.value = '';
      }
    });
  } else {
    console.error("Message input element not found!");
  }

  // Add a toggle functionality for the sidebar
  if (toggleButton) {
    toggleButton.addEventListener('click', function() {
      const chatContainer = document.getElementById('tampermonkey-sidebar-chat');
      if (chatContainer) {
        if (chatContainer.style.height === '32px') {
          chatContainer.style.height = '500px';
          toggleButton.textContent = '_';
        } else {
          chatContainer.style.height = '32px';
          toggleButton.textContent = '□';
        }
      }
    });
  }

  // == Function to setup ad skipping monitor ==
  function setupAdSkipMonitor() {
      console.log("Setting up ad skip monitor...");
      videoPlayer = document.querySelector('#bilibili-player > div > div > div.bpx-player-primary-area > div.bpx-player-video-area > div.bpx-player-video-perch > div > video'); // Get video player element using verified CSS selector

      if (!videoPlayer) {
          console.error("Video player element not found!");
          return;
      }
      console.log("Video player element found:", videoPlayer);

      adCheckInterval = setInterval(checkAdTime, 500); // Check ad time every 500ms
      console.log("Ad check interval started. Checking for ad segments:", adTimestamps);
  }

  // == Function to check ad time and skip ads ==
  function checkAdTime() {
      if (!videoPlayer || videoPlayer.paused || videoPlayer.ended) { // Check if video player is valid and playing
          return; // Do not check ad time if video is paused or ended
      }

      const currentTime = videoPlayer.currentTime; // Get current playback time
      //console.log("Current time:", currentTime); // Debug: Log current time (can be commented out for less verbose logging)

      for (const ad of adTimestamps) { // Loop through ad timestamps
          if (currentTime >= ad.start_time && currentTime < ad.end_time) { // Check if current time is within ad segment
              console.log(`Ad segment detected! Skipping from ${currentTime}s to ${ad.end_time}s. Description: ${ad.description}`);
              videoPlayer.currentTime = ad.end_time; // Skip to ad end time
              break; // Skip only one ad segment per check
          }
      }
  }

  function handleMessage(message) {
    console.log('User sent message:', message);

    // 显示用户消息
    displayMessage(message, 'user');

    // 根据输入生成简单回复
    let response = '';
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('你好')) {
      response = '你好！我是B站小助手。';
    } else if (message.toLowerCase().includes('time') || message.toLowerCase().includes('时间')) {
      response = '当前视频时间: ' + (videoPlayer ? Math.floor(videoPlayer.currentTime) + '秒' : '未知');
    } else if (message.toLowerCase().includes('ad') || message.toLowerCase().includes('广告')) {
      response = '我会自动跳过检测到的广告片段！';
    } else {
      response = '收到你的消息：' + message;
    }

    // 显示系统回复
    setTimeout(() => {
      displayMessage(response, 'system');
    }, 500);
  }

  function displayMessage(text, messageType) {
    if (!chatDisplay) {
      console.error("Chat display element not found!");
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('tampermonkey-chat-message');

    if (messageType === 'user') {
      messageDiv.classList.add('tampermonkey-user-message');
    } else {
      messageDiv.classList.add('tampermonkey-system-message');
    }

    messageDiv.textContent = text;

    // 添加时间戳
    const timestamp = document.createElement('span');
    timestamp.classList.add('tampermonkey-timestamp');
    const now = new Date();
    timestamp.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    messageDiv.appendChild(timestamp);

    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }

  // == Setup Ad Skip Monitor after page load ==
  window.addEventListener('load', setupAdSkipMonitor); // Setup ad skip monitor on window load
  console.log('Tampermonkey sidebar chat script with ad skip injected and running.'); // Log message

  // 添加事件监听器来接收来自扩展的消息
  window.addEventListener('message', function(event) {
    // 只接受来自当前页面的消息
    if (event.source !== window) return;

    // 检查消息是否来自扩展
    if (event.data.type && event.data.type === 'extension_message') {
      console.log('Tampermonkey script received message from extension:', event.data.text);
      // 处理来自扩展的消息
      handleMessage(event.data.text);

      // 回复扩展
      window.postMessage({
        type: 'tampermonkey_message',
        text: 'Tampermonkey script received: ' + event.data.text
      }, '*');
    }
  });

})();