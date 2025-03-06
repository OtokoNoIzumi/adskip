document.addEventListener('DOMContentLoaded', function() {
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
    if (url && url.includes('bilibili.com/video/')) {
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
              div.className = 'bg-white border border-gray-200 rounded p-2.5 mb-4 text-sm';
              div.innerHTML = `
                <h2 class="mt-0 text-base font-medium text-gray-800">当前视频设置</h2>
                <p class="my-1">视频ID: ${videoId}</p>
                <p class="my-1">广告时间段: <span class="bg-gray-100 px-1.5 py-0.5 rounded font-mono">${timeString}</span></p>
                <p class="my-1">功能状态: <span class="bg-gray-100 px-1.5 py-0.5 rounded font-mono">${localStorage.getItem('adskip_enabled') === 'false' ? '已禁用' : '已启用'}</span></p>
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
    adminInfo.className = 'bg-white border border-gray-200 rounded p-2.5 mb-4 text-sm';
    adminInfo.innerHTML = `
      <h2 class="mt-0 text-base font-medium text-gray-800">管理员状态</h2>
      <p class="my-1">当前已登录为管理员</p>
      <p class="my-1">会话有效期至浏览器关闭</p>
    `;

    // 插入到页面中
    const featureList = document.querySelector('ul');
    if (featureList) {
      featureList.insertAdjacentElement('afterend', adminInfo);
    }
  }
});