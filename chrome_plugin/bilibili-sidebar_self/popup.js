document.addEventListener('DOMContentLoaded', function() {
  // 为选项按钮添加点击事件
  document.getElementById('go-to-options').addEventListener('click', function() {
    // 打开选项页面
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      // 如果不支持openOptionsPage方法，则直接创建新标签页
      chrome.tabs.create({url: 'options.html'});
    }
  });

  // 获取当前标签页信息
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0 && tabs[0].url) {
      const currentTab = tabs[0];
      const url = currentTab.url;

      // 检查是否是B站视频页面
      if (url && url.includes('bilibili.com/video/')) {
        // 通过正则表达式提取视频ID
        const match = url.match(/\/video\/(BV[\w]+)/);
        let videoId = match ? match[1] : '';

        if (videoId) {
          // 查询这个视频是否有保存的广告时间段以及功能启用状态
          Promise.all([
            adskipStorage.loadAdTimestampsForVideo(videoId),
            adskipStorage.getEnabled()
          ]).then(function([timestamps, isEnabled]) {
            // 如果有时间戳，则在界面上显示
            if (timestamps && timestamps.length > 0) {
              const timeString = adskipUtils.timestampsToString(timestamps);

              // 创建显示区域
              const div = document.createElement('div');
              div.className = 'instructions';
              div.innerHTML = `
                <h2>当前视频设置</h2>
                <p>视频ID: ${videoId}</p>
                <p>广告时间段: <span class="format">${timeString}</span></p>
                <p>功能状态: <span class="format">${isEnabled ? '已启用' : '已禁用'}</span></p>
              `;

              // 插入到按钮前面
              const button = document.getElementById('go-to-options');
              button.parentNode.insertBefore(div, button);

              // 修改按钮文字
              button.textContent = '打开视频页面';
            }
          }).catch(function(error) {
            console.error('获取视频数据失败:', error);
          });
        }
      }
    }
  });

  // 显示管理员状态
  adskipStorage.checkAdminStatus().then(function(isAdmin) {
    if (isAdmin) {
      const adminInfo = document.createElement('div');
      adminInfo.className = 'instructions';
      adminInfo.innerHTML = `
        <h2>管理员状态</h2>
        <p>已登录为管理员</p>
      `;
      document.querySelector('.feature-list').insertAdjacentElement('afterend', adminInfo);
    }
  });
});