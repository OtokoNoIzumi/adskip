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

  // 获取manifest.json中的版本信息
  const manifestData = chrome.runtime.getManifest();
  const version = manifestData.version || '1.0';
  const author = 'Izumi.屈源'; // 作者名称固定

  // 修改页脚，作者名后面添加"个人主页"文字和B站、GitHub图标跳转，整体竖直居中
  const footer = document.querySelector('#footer-version');
  if (footer) {
    footer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>版本 ${version} | 作者: ${author}</span>
        <span>个人主页</span>
        <a href="https://space.bilibili.com/82205" target="_blank" title="B站主页" style="display: flex; align-items: center; line-height: 1;">
          <svg viewBox="0 0 1024 1024" width="16" height="16" style="fill: #00a1d6; display: block;">
            <path d="M306.005333 117.632L444.330667 256h135.296l138.368-138.325333a42.666667 42.666667 0 0 1 60.373333 60.373333L700.330667 256H789.333333A149.333333 149.333333 0 0 1 938.666667 405.333333v341.333334a149.333333 149.333333 0 0 1-149.333334 149.333333h-554.666666A149.333333 149.333333 0 0 1 85.333333 746.666667v-341.333334A149.333333 149.333333 0 0 1 234.666667 256h88.96L245.632 177.962667a42.666667 42.666667 0 0 1 60.373333-60.373334zM789.333333 341.333333h-554.666666a64 64 0 0 0-63.701334 57.856L170.666667 405.333333v341.333334a64 64 0 0 0 57.856 63.701333L234.666667 810.666667h554.666666a64 64 0 0 0 63.701334-57.856L853.333333 746.666667v-341.333334a64 64 0 0 0-57.856-63.701333L789.333333 341.333333zM341.333333 469.333333a42.666667 42.666667 0 0 1 42.666667 42.666667v85.333333a42.666667 42.666667 0 0 1-85.333333 0v-85.333333a42.666667 42.666667 0 0 1 42.666666-42.666667z m341.333334 0a42.666667 42.666667 0 0 1 42.666666 42.666667v85.333333a42.666667 42.666667 0 0 1-85.333333 0v-85.333333a42.666667 42.666667 0 0 1 42.666667-42.666667z"></path>
          </svg>
        </a>
        <a href="https://otokonoizumi.github.io" target="_blank" title="GitHub" style="display: flex; align-items: center; line-height: 1;">
          <svg viewBox="0 0 16 16" width="16" height="16" style="fill: #333; display: block;">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
        </a>
      </div>
    `;
  }

  // 添加赞赏码区域（初始隐藏）
  const appreciateArea = document.createElement('div');
  appreciateArea.id = 'appreciate-area';
  appreciateArea.style.display = 'none';
  appreciateArea.style.textAlign = 'center';
  appreciateArea.style.marginTop = '8px';
  appreciateArea.innerHTML = `
    <div style="margin: 8px 0 6px 0; font-size: 14px; color: #ffd700;">✨ ❤️ ✨</div>
    <h3 style="margin: 5px 0 3px 0; font-size: 14px;">支持作者</h3>
    <p style="font-size: 12px; color: #666; margin: 2px 0;">如果此插件对您有帮助，请赞赏支持！记得留下B站id</p>
    <p style="font-size: 12px; color: #666; margin: 2px 0 5px 0;">B站年度大会员每月可以领免费的5B币券用来赞赏充电~</p>
    <img src="https://otokonoizumi.github.io/appreciate.jpg" alt="赞赏码" style="max-width: 180px; border-radius: 5px;">
  `;
  // document.getElementById('go-to-options').insertAdjacentElement('afterend', appreciateArea);
  document.getElementById('footer-version').insertAdjacentElement('beforebegin', appreciateArea);

  // API details for user stats
  // const USER_STATS_API_URL = "https://localhost:3000/api/user/stats";
  const USER_STATS_API_URL = "https://izumilife.xyz:3000/api/user/stats";
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
              level: response.level || 0,
              vipType: response.vipType || 0,
              vipDueDate: response.vipDueDate || 0
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
                level: biliUser.level || 0,
                vipType: biliUser.vipType || 0,
                vipDueDate: biliUser.vipDueDate || 0
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

    let statsHTML = `<div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
      <div style="margin-top: 10px;"><strong>使用统计</strong></div>
      <span style="font-size: 0.75em; color: #999;">更新时间: ${updateTimeDisplay}</span>
    </div>`;

    // 1. 账号类型（包含试用期信息）
    let accountTypeDisplay = data.account_type_display || '未知';
    if (data.is_in_trial_period && data.trial_end_date) {
      accountTypeDisplay += `<span style="color: #28a745;"> (推广体验期至${data.trial_end_date})</span>`;
    }
    statsHTML += `<p style="margin: 5px 0;"><strong>账号类型：</strong> ${accountTypeDisplay}</p>`;

    // 2. 今日AI识别次数（分两行显示，避免过长）
    const remaining = data.daily_gemini_limit - data.daily_gemini_requests_used;
    statsHTML += `<p style="margin: 5px 0;"><strong>今日可用AI识别次数:</strong> <span style="color: ${remaining > 0 ? '#28a745' : '#dc3545'};">${remaining}/${data.daily_gemini_limit}</span></p>`;

    // 分解信息单独一行，更小字体
    let limitBreakdown = [];
    if (data.base_limit_from_level) {
      limitBreakdown.push(`B站等级${data.base_limit_from_level}`);
    }
    if (data.trial_bonus && data.is_in_trial_period) {
      limitBreakdown.push(`推广期${data.trial_bonus}`);
    }
    if (data.vip_bonus && data.is_vip_active) {
      limitBreakdown.push(`年度大会员${data.vip_bonus}`);
    }

    if (limitBreakdown.length > 0) {
      statsHTML += `<p style="margin: 2px 0 5px 0; font-size: 0.85em; color: #666;">　　(${limitBreakdown.join(' + ')})</p>`;
    }

    // 3. 累计统计（紧凑显示）
    statsHTML += `<p style="margin: 5px 0;"><strong>节省广告时间:</strong> ${data.total_ads_duration_display || 'N/A'}</p>`;
    statsHTML += `<p style="margin: 5px 0;"><strong>处理含广告视频:</strong> ${data.total_videos_with_ads !== undefined ? data.total_videos_with_ads : 'N/A'}个</p>`;


    userStatsArea.innerHTML = statsHTML;

    // 保存时间显示以防后续更新失败时使用
    data._updateTimeDisplay = updateTimeDisplay;
  }

  // Call the function to fetch and display user stats
  fetchAndDisplayUserStats();
});