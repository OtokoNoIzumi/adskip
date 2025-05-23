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

  // 修改页脚，作者名后面添加“个人主页”文字和B站、GitHub图标跳转，整体竖直居中
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.innerHTML = `
      <span style="vertical-align: middle;">版本 1.2.7 | 作者: Izumi屈源</span>
      <span style="vertical-align: middle; margin-left: 10px;">个人主页</span>
      <a href="https://space.bilibili.com/82205" target="_blank" title="B站主页" style="display:inline-flex;align-items:center;margin-left:6px;">
        <img src="https://cdn.jsdelivr.net/gh/feathericons/feather/icons/tv.svg" alt="Bilibili" style="width:18px;height:18px;display:block;opacity:0.8;">
      </a>
      <a href="https://github.com/OtokoNoIzumi" target="_blank" title="GitHub主页" style="display:inline-flex;align-items:center;margin-left:6px;">
        <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/github.svg" alt="GitHub" style="width:18px;height:18px;display:block;opacity:0.8;">
      </a>
    `;
  }

  // 添加赞赏码区域（初始隐藏）
  const appreciateArea = document.createElement('div');
  appreciateArea.id = 'appreciate-area';
  appreciateArea.style.display = 'none';
  appreciateArea.style.textAlign = 'center';
  appreciateArea.style.marginTop = '20px';
  appreciateArea.innerHTML = `
    <h3>支持作者</h3>
    <p style="font-size: 13px; color: #666;">如果此插件对您有帮助，欢迎赞赏支持！</p>
    <p style="font-size: 13px; color: #666;">B站年度大会员每月可以领免费的5B币券用来赞赏充电~</p>
    <img src="https://otokonoizumi.github.io/appreciate.jpg" alt="赞赏码" style="max-width: 200px; border-radius: 5px;">
  `;
  document.getElementById('go-to-options').insertAdjacentElement('afterend', appreciateArea);

  // API details for user stats
  const USER_STATS_API_URL = "https://localhost:3000/api/user/stats";
  const USER_STATS_HEADERS = { "Content-Type": "application/json" };

  const userStatsArea = document.getElementById('user-stats-area');
  const usageInstructions = document.getElementById('usage-instructions');
  const featureList = document.getElementById('feature-list');
  const appreciateContainer = document.getElementById('appreciate-area');

  /**
   * 获取用户信息载荷数据，优先使用B站用户信息，其次使用本地存储的UID
   * @returns {Promise<Object>} 包含用户信息的对象
   */
  async function getUserPayload() {
    let payload = {
      username: "guest",
      uid: 0,
      level: 0
    };

    try {
      // 检查当前是否在B站页面上
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({active: true, currentWindow: true}, resolve);
      });

      const currentTab = tabs[0];
      const isBilibili = currentTab && currentTab.url && currentTab.url.includes('bilibili.com');

      // 如果在B站页面上，优先尝试获取B站登录信息
      if (isBilibili) {
        // 通过content script获取B站登录信息
        const message = {
          action: 'getBilibiliUser',
          target: 'content'
        };

        // 发送消息到内容脚本获取B站用户信息
        try {
          const response = await chrome.tabs.sendMessage(currentTab.id, message);
          if (response && response.isLoggedIn && response.uid) {
            adskipUtils.logDebug('B站用户信息获取成功', response);
            payload = {
              username: response.username || "guest",
              uid: response.uid,
              level: response.level || 0
            };

            // 保存UID到本地存储
            await adskipStorage.saveUserUID(response.uid);
            return payload;  // 成功获取B站信息，直接返回
          } else {
            adskipUtils.logDebug('B站未登录或获取用户信息失败', response);
          }
        } catch (error) {
          adskipUtils.logDebug('发送消息到内容脚本失败', error);
          // 尝试备用方式: 使用后台服务获取信息
          try {
            const biliUser = await chrome.runtime.sendMessage({
              action: 'getBilibiliUser',
              target: 'background'
            });

            if (biliUser && biliUser.uid) {
              payload = {
                username: biliUser.username || "guest",
                uid: biliUser.uid,
                level: biliUser.level || 0
              };

              // 保存UID到本地存储
              await adskipStorage.saveUserUID(biliUser.uid);
              return payload;  // 成功获取B站信息，直接返回
            }
          } catch (bgError) {
            adskipUtils.logDebug('后台获取B站用户信息失败', bgError);
          }
        }
      }

      // 如果无法从B站获取，尝试使用本地存储的UID
      const storedUid = await adskipStorage.getUserUID();
      if (storedUid) {
        adskipUtils.logDebug('使用本地存储的UID', storedUid);
        payload.uid = storedUid;
      } else {
        adskipUtils.logDebug('无法获取UID，使用默认信息');
      }
    } catch (error) {
      adskipUtils.logDebug('获取用户信息出错', error);
    }

    return payload;
  }

  /**
   * 检查是否应该显示赞赏码，基于本地处理视频数
   * @returns {Promise<boolean>} 是否应该显示赞赏码
   */
  async function shouldShowAppreciateCode() {
    try {
      const videoCount = await adskipStorage.getLocalVideosProcessedCount();
      return videoCount >= 10; // 当处理视频数大于等于10时显示赞赏码
    } catch (error) {
      adskipUtils.logDebug('获取本地视频数量失败', error);
      return false; // 出错时不显示赞赏码
    }
  }

  /**
   * 检查是否应该显示使用说明，基于本地处理视频数
   * @returns {Promise<boolean>} 是否应该显示使用说明
   */
  async function shouldShowInstructions() {
    try {
      const videoCount = await adskipStorage.getLocalVideosProcessedCount();
      return videoCount < 3; // 当处理视频数小于3时显示说明
    } catch (error) {
      adskipUtils.logDebug('获取本地视频数量失败', error);
      return true; // 出错时保守处理，显示说明
    }
  }

  /**
   * 获取用户统计信息，优先使用缓存，按条件决定是否更新数据
   */
  async function fetchAndDisplayUserStats() {
    if (!userStatsArea) {
      console.warn("User stats area not found in popup.html");
      return;
    }

    // 1. 检查本地视频数量，决定是否显示使用说明和特性列表
    const showInstructions = await shouldShowInstructions();
    if (!showInstructions) {
      if (usageInstructions) usageInstructions.style.display = 'none';
      if (featureList) featureList.style.display = 'none';
    } else {
      if (usageInstructions) usageInstructions.style.display = '';
      if (featureList) featureList.style.display = '';
    }

    // 检查是否显示赞赏码
    const showAppreciate = await shouldShowAppreciateCode();
    if (showAppreciate && appreciateContainer) {
      appreciateContainer.style.display = 'block';
      adskipUtils.logDebug('显示赞赏码');
    } else if (appreciateContainer) {
      appreciateContainer.style.display = 'none';
      adskipUtils.logDebug('隐藏赞赏码，当前处理视频数不足10个');
    }

    // 2. 尝试获取缓存的用户统计数据
    let cachedStats = await adskipStorage.getUserStatsCache();
    if (cachedStats) {
      adskipUtils.logDebug('使用缓存的用户统计数据', cachedStats);
      // 先展示缓存数据
      updateStatsUI(cachedStats);
    }

    // 3. 检查是否需要更新用户数据
    const shouldUpdate = await adskipStorage.shouldUpdateUserStats();
    adskipUtils.logDebug(`是否需要更新用户统计数据: ${shouldUpdate}`);

    if (!shouldUpdate) {
      adskipUtils.logDebug('不需要更新用户统计数据，使用缓存数据');
      return; // 不需要更新，直接返回
    }

    // 4. 需要更新，获取用户信息并请求API
    try {
      adskipUtils.logDebug('开始更新用户统计数据');
      const userPayload = await getUserPayload();
      adskipUtils.logDebug('请求API的用户信息载荷', userPayload);

      const response = await fetch(USER_STATS_API_URL, {
        method: 'POST',
        headers: USER_STATS_HEADERS,
        body: JSON.stringify(userPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }

      const data = await response.json();
      if (data.message === '获取成功' && data.uid) {
        // 记录本次获取时间和视频处理数量
        await adskipStorage.recordLastStatsFetch();

        // 保存到缓存
        await adskipStorage.saveUserStatsCache(data);

        // 更新UI
        updateStatsUI(data);

        adskipUtils.logDebug('用户统计数据更新成功');
      } else {
        throw new Error("API response indicates failure or malformed data: " + JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // 如果有缓存数据，显示一个小的错误提示但保留缓存数据显示
      if (cachedStats) {
        // 向现有stats区域添加错误信息而不是替换
        const errorElem = document.createElement('p');
        errorElem.style.color = 'red';
        errorElem.style.fontSize = '0.8em';
        errorElem.textContent = `更新失败: ${error.message}`;
        userStatsArea.appendChild(errorElem);
      } else {
        // 没有缓存数据时，显示完整错误
        userStatsArea.innerHTML = `
          <p style="color: red;">获取用户统计信息失败。</p>
          <p style="font-size: 0.8em; color: #666;">详情: ${error.message}</p>
        `;

        // 如果获取失败，确保说明仍然可见
        if (usageInstructions) {
          usageInstructions.style.display = '';
        }
        if (featureList) {
          featureList.style.display = '';
        }
      }
    }
  }

  function updateStatsUI(data) {
    if (!userStatsArea) return;

    // 获取缓存时间显示
    const updateTimeDisplay = data.updateTimeDisplay || (data._updateTimeDisplay || "尚未更新");
    adskipUtils.logDebug('数据更新时间', updateTimeDisplay);

    // Hide usage instructions when stats are successfully displayed
    if (usageInstructions) {
      usageInstructions.style.display = 'none';
    }
    // Hide feature list when stats are successfully displayed
    if (featureList) {
      featureList.style.display = 'none';
    }

    let statsHTML = `<h3>个人统计：</h3>`;

    // 1. Account Type (assuming 'account_type' field from backend)
    statsHTML += `<p>账号类型: ${data.account_type || 'N/A'}</p>`;

    // 2. "今日可用的AI识别次数"
    let availableRequests = 'N/A';
    if (data.daily_gemini_limit !== undefined && data.daily_gemini_requests_used !== undefined) {
      availableRequests = data.daily_gemini_limit - data.daily_gemini_requests_used;
    }
    statsHTML += `<p>今日可用的AI识别次数: ${availableRequests}/${data.daily_gemini_limit || 'N/A'}</p>`;

    // 3. "累计节省的广告时间"
    statsHTML += `<p>累计节省的广告时间: ${data.total_ads_duration_display || 'N/A'}</p>`;

    // 4. "累计处理的含广告视频数"
    statsHTML += `<p>累计处理的含广告视频数: ${data.total_videos_with_ads !== undefined ? data.total_videos_with_ads : 'N/A'}</p>`;

    // 显示更新时间
    statsHTML += `<p style="font-size: 0.8em; color: #666;">数据更新时间: ${updateTimeDisplay}</p>`;

    userStatsArea.innerHTML = statsHTML;

    // 保存时间显示以防后续更新失败时使用
    data._updateTimeDisplay = updateTimeDisplay;
  }

  // Call the function to fetch and display user stats
  fetchAndDisplayUserStats();
});