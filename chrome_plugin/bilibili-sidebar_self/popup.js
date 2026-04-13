document.addEventListener("DOMContentLoaded", function () {
  // 简单统计：增加popup打开计数
  incrementPopupOpenCount();

  // 为选项按钮添加点击事件
  document
    .getElementById("go-to-options")
    .addEventListener("click", function () {
      // 打开选项页面
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // 如果不支持openOptionsPage方法，则直接创建新标签页
        chrome.tabs.create({ url: "options.html" });
      }
    });

  // 显示管理员状态
  adskipStorage.checkAdminStatus().then(function (isAdmin) {
    if (isAdmin) {
      const adminInfo = document.createElement("div");
      adminInfo.className = "instructions";
      adminInfo.innerHTML = `
        <h2>管理员状态</h2>
        <p>已登录为管理员</p>
      `;
      document
        .querySelector(".feature-list")
        .insertAdjacentElement("afterend", adminInfo);
    }
  });

  // 获取manifest.json中的版本信息
  const manifestData = chrome.runtime.getManifest();
  const version = manifestData.version || "1.0";
  const author = "Izumi.屈源"; // 作者名称固定

  // 修改页脚，作者名后面添加"个人主页"文字和B站、GitHub图标跳转，整体竖直居中
  const footer = document.querySelector("#footer-version");
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

  // 添加版本提示区域（放在user-stats-area前面）
  const versionHintArea = document.createElement("div");
  versionHintArea.id = "version-hint-area";
  versionHintArea.style.display = "none";
  // 初始为空，等待加载后再填充内容
  versionHintArea.innerHTML = "";
  document
    .getElementById("user-stats-area")
    .insertAdjacentElement("beforebegin", versionHintArea);

  // 添加支持区域（初始完全隐藏，加载成功后再显示）
  const appreciateArea = document.createElement("div");
  appreciateArea.id = "appreciate-area";
  appreciateArea.style.display = "none";
  appreciateArea.style.textAlign = "center";
  appreciateArea.style.marginTop = "8px";
  // 初始为空，等待API加载后再填充内容
  appreciateArea.innerHTML = "";
  document
    .getElementById("footer-version")
    .insertAdjacentElement("beforebegin", appreciateArea);

  // ==================== 跳过开头/结尾设置初始化 ====================
  initSkipIntroOutroSettings();

  // API相关常量
  const SUPPORT_INFO_CACHE_KEY = "bilibili_adskip_support_cache";
  const SUPPORT_INFO_CACHE_DURATION = 48 * 60 * 60 * 1000; // 48小时

  // 注意：配置常量已移至 storage.js 中统一管理
  // 这里的常量仅用于备注，实际配置从 adskipStorage 获取

  // 获取缓存的支持信息
  async function getCachedSupportInfo() {
    try {
      // 清理旧的缓存键（如果存在）
      chrome.storage.local.remove("adskip_support_info_cache");

      const result = await new Promise((resolve) => {
        chrome.storage.local.get(SUPPORT_INFO_CACHE_KEY, resolve);
      });

      const cached = result[SUPPORT_INFO_CACHE_KEY];
      if (cached && cached.timestamp && cached.data) {
        const now = Date.now();
        if (now - cached.timestamp < SUPPORT_INFO_CACHE_DURATION) {
          console.log("使用缓存的支持信息");
          return cached.data;
        } else {
          console.log("支持信息缓存已过期");
        }
      }
      return null;
    } catch (error) {
      console.log("获取支持信息缓存失败:", error);
      return null;
    }
  }

  // 保存支持信息到缓存
  async function cacheSupportInfo(data) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        data: data,
      };
      await new Promise((resolve) => {
        chrome.storage.local.set(
          { [SUPPORT_INFO_CACHE_KEY]: cacheData },
          resolve,
        );
      });
      console.log("支持信息已缓存");
    } catch (error) {
      console.log("缓存支持信息失败:", error);
    }
  }

  // 注意：外部配置缓存函数已移至 storage.js 中统一管理

  // 版本比较函数
  function compareVersions(version1, version2) {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  // 获取版本提示信息
  function getVersionHint(currentVersion, versionHints) {
    try {
      // 首先尝试完全匹配
      if (versionHints[currentVersion]) {
        console.log(`找到完全匹配的版本提示: ${currentVersion}`);
        return versionHints[currentVersion];
      }

      // 获取配置中所有版本号（排除 default 和 degrade）
      const configVersions = Object.keys(versionHints).filter(
        (v) => v !== "default" && v !== "degrade" && /^\d+\.\d+\.\d+$/.test(v),
      );

      if (configVersions.length === 0) {
        console.log("配置中没有版本号，使用 default");
        return versionHints.default || [];
      }

      // 比较当前版本与配置中的版本
      let isNewerThanAll = true;
      let isOlderThanAll = true;

      for (const configVersion of configVersions) {
        const comparison = compareVersions(currentVersion, configVersion);
        if (comparison <= 0) isNewerThanAll = false;
        if (comparison >= 0) isOlderThanAll = false;
      }

      if (isNewerThanAll) {
        console.log(
          `当前版本 ${currentVersion} 比配置中所有版本都新，使用 default`,
        );
        return versionHints.default || [];
      } else if (isOlderThanAll) {
        console.log(
          `当前版本 ${currentVersion} 比配置中所有版本都旧，使用 degrade`,
        );
        return versionHints.degrade || [];
      } else {
        console.log(
          `当前版本 ${currentVersion} 在配置版本范围内，使用 default`,
        );
        return versionHints.default || [];
      }
    } catch (error) {
      console.log("获取版本提示失败:", error);
      return versionHints.default || [];
    }
  }

  // 注意：外部配置和API URL管理函数已移至 storage.js 中统一管理

  // 加载版本提示信息
  async function loadVersionHint() {
    try {
      // 使用统一的外部配置加载函数
      const externalConfig = await adskipStorage.loadExternalConfig();
      let versionHintHTML = "";

      if (externalConfig && externalConfig.version_hint) {
        // 获取当前版本
        const manifestData = chrome.runtime.getManifest();
        const currentVersion = manifestData.version || "1.0.0";

        // 获取版本提示数组
        const versionHints = getVersionHint(
          currentVersion,
          externalConfig.version_hint,
        );

        if (versionHints && versionHints.length > 0) {
          // 从数组中随机选择一条
          const randomIndex = Math.floor(Math.random() * versionHints.length);
          const selectedHint = versionHints[randomIndex];

          console.log(
            `版本提示选择: 版本${currentVersion}, 提示: ${selectedHint}`,
          );

          // 构建版本提示HTML
          versionHintHTML = `
            <div style="margin: 8px 0; padding: 8px; background-color: rgba(255, 235, 59, 0.1); border-left: 3px solid #ffeb3b; border-radius: 4px;">
              <div style="font-size: 12px; color: #e65100; font-weight: bold; margin-bottom: 4px;">💡 使用提示</div>
              <div style="font-size: 12px; color: #333; line-height: 1.4;">${selectedHint}</div>
            </div>
          `;
        }
      }

      // 显示版本提示
      if (versionHintHTML) {
        versionHintArea.innerHTML = versionHintHTML;
        versionHintArea.style.display = "block";
      } else {
        versionHintArea.style.display = "none";
      }
    } catch (error) {
      console.log("加载版本提示失败:", error);
      versionHintArea.style.display = "none";
    }
  }

  // 加载支持信息
  async function loadSupportInfo() {
    try {
      // 使用统一的API URL获取函数
      const apiUrls = await adskipStorage.getApiUrls();

      // 先尝试使用缓存
      let data = await getCachedSupportInfo();

      if (!data) {
        // 缓存不存在或已过期，请求API
        console.log("请求支持信息API:", apiUrls.supportInfo);
        try {
          const response = await fetch(apiUrls.supportInfo, {
            signal: AbortSignal.timeout(10000), // 10秒超时
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          data = await response.json();

          // 缓存新数据
          await cacheSupportInfo(data);
        } catch (fetchError) {
          console.log("支持信息API请求失败:", fetchError.message);
          // 如果API请求失败，使用一个默认的禁用状态
          data = { enabled: false };
        }
      }

      // 添加调试信息
      console.log("支持信息API返回数据:", data);

      if (data.enabled) {
        // 构建支持信息内容
        let contentHTML = `<div style="margin: 8px 0 6px 0; font-size: 14px; color: #ffd700;">✨ ❤️ ✨</div>`;

        if (data.supportPicUrl) {
          console.log("显示图片模式, type:", data.supportType);
          contentHTML += `
            <h3 style="margin: 5px 0 3px 0; font-size: 14px;">${data.title}</h3>
            <p style="font-size: 12px; color: #666; margin: 2px 0;">${data.description}</p>
            ${data.supportType === "donate" ? '<p style="font-size: 12px; color: #666; margin: 2px 0 5px 0;">B站年度大会员每月可以领免费的5B币券用来赞赏充电~</p>' : ""}
            <img src="${data.supportPicUrl}" alt="${data.altText}" style="max-width: 180px; border-radius: 5px;">
          `;
        } else {
          console.log("显示纯文字模式, type:", data.supportType);
          contentHTML += `
            <h3 style="margin: 5px 0 3px 0; font-size: 14px;">${data.title}</h3>
            <p style="font-size: 12px; color: #666; margin: 2px 0 5px 0;">${data.description}</p>
            <p style="font-size: 12px; color: #999; margin: 2px 0;">点击下方"个人主页"了解更多项目信息</p>
          `;
        }

        // 设置内容并显示
        appreciateArea.innerHTML = contentHTML;
        appreciateArea.style.display = "block";
      } else {
        // 如果禁用，保持隐藏
        appreciateArea.style.display = "none";
      }
    } catch (error) {
      console.log("加载支持信息失败:", error);
      // 失败时保持隐藏
      appreciateArea.style.display = "none";
    }
  }

  // API details for user stats
  const USER_STATS_HEADERS = { "Content-Type": "application/json" };

  const userStatsArea = document.getElementById("user-stats-area");
  const usageInstructions = document.getElementById("usage-instructions");
  const featureList = document.getElementById("feature-list");
  const appreciateContainer = document.getElementById("appreciate-area");

  /**
   * 获取用户信息载荷数据，优先使用B站用户信息，其次使用本地存储的UID
   * @returns {Promise<Object>} 包含用户信息的对象
   */
  async function getUserPayload() {
    let payload = {
      username: "guest",
      uid: 0,
      level: 0,
    };

    try {
      // 检查当前是否在B站页面上
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      const currentTab = tabs[0];
      const isBilibili =
        currentTab && currentTab.url && currentTab.url.includes("bilibili.com");

      // 如果在B站页面上，优先尝试获取B站登录信息
      if (isBilibili) {
        // 通过content script获取B站登录信息
        const message = {
          action: "getBilibiliUser",
          target: "content",
        };

        // 发送消息到内容脚本获取B站用户信息
        try {
          const response = await chrome.tabs.sendMessage(
            currentTab.id,
            message,
          );
          if (response && response.isLoggedIn && response.uid) {
            console.log("B站用户信息获取成功", response);
            payload = {
              username: response.username || "guest",
              uid: response.uid,
              level: response.level || 0,
              vipType: response.vipType || 0,
              vipDueDate: response.vipDueDate || 0,
            };

            // 保存UID和用户名到本地存储
            await adskipStorage.saveUserUID(response.uid);
            await adskipStorage.saveUserUsername(response.username);
            return payload; // 成功获取B站信息，直接返回
          } else {
            console.log("B站未登录或获取用户信息失败", response);
          }
        } catch (error) {
          console.log("发送消息到内容脚本失败", error);
          // 尝试备用方式: 使用后台服务获取信息
          try {
            const biliUser = await chrome.runtime.sendMessage({
              action: "getBilibiliUser",
              target: "background",
            });

            if (biliUser && biliUser.uid) {
              payload = {
                username: biliUser.username || "guest",
                uid: biliUser.uid,
                level: biliUser.level || 0,
                vipType: biliUser.vipType || 0,
                vipDueDate: biliUser.vipDueDate || 0,
              };

              // 保存UID和用户名到本地存储
              await adskipStorage.saveUserUID(biliUser.uid);
              await adskipStorage.saveUserUsername(biliUser.username);
              return payload; // 成功获取B站信息，直接返回
            }
          } catch (bgError) {
            console.log("后台获取B站用户信息失败", bgError);
          }
        }
      }

      // 如果无法从B站获取，尝试使用本地存储的UID和用户名
      const storedUid = await adskipStorage.getUserUID();
      const storedUsername = await adskipStorage.getUserUsername();

      if (storedUid) {
        console.log("使用本地存储的UID", storedUid);
        payload.uid = storedUid;

        if (storedUsername) {
          console.log("使用本地存储的用户名", storedUsername);
          payload.username = storedUsername;
        }
      } else {
        console.log("无法获取UID，使用默认信息");
      }
    } catch (error) {
      console.log("获取用户信息出错", error);
    }

    return payload;
  }

  /**
   * 检查是否应该显示赞赏码，优先基于云端同步的视频数，本地数据作为备选
   * @returns {Promise<boolean>} 是否应该显示赞赏码
   */
  async function shouldShowAppreciateCode() {
    try {
      // 优先使用缓存的云端数据
      const cachedStats = await adskipStorage.getUserStatsCache();
      let videoCount = 0;

      if (cachedStats && cachedStats.total_videos_with_ads !== undefined) {
        // 使用云端同步的含广告视频数
        videoCount = cachedStats.total_videos_with_ads;
        console.log("使用云端同步的含广告视频数:", videoCount);
      } else {
        // 备选方案：使用本地处理视频数
        videoCount = await adskipStorage.getLocalVideosProcessedCount();
        console.log("使用本地处理视频数作为备选:", videoCount);
      }

      return videoCount >= 10; // 当处理视频数大于等于10时显示赞赏码
    } catch (error) {
      console.log("获取视频数量失败", error);
      return false; // 出错时不显示赞赏码
    }
  }

  /**
   * 检查是否应该显示使用说明，优先基于云端同步的视频数，本地数据作为备选
   * @returns {Promise<boolean>} 是否应该显示使用说明
   */
  async function shouldShowInstructions() {
    try {
      // 优先使用缓存的云端数据
      const cachedStats = await adskipStorage.getUserStatsCache();
      let videoCount = 0;

      if (cachedStats && cachedStats.total_videos_with_ads !== undefined) {
        // 使用云端同步的含广告视频数
        videoCount = cachedStats.total_videos_with_ads;
        console.log("使用云端同步的含广告视频数判断显示说明:", videoCount);
      } else {
        // 备选方案：使用本地处理视频数
        videoCount = await adskipStorage.getLocalVideosProcessedCount();
        console.log("使用本地处理视频数作为备选判断显示说明:", videoCount);
      }

      return videoCount < 3; // 当处理视频数小于3时显示说明
    } catch (error) {
      console.log("获取视频数量失败", error);
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

    // 0. 首先加载版本提示（始终显示）
    await loadVersionHint();

    // 1. 检查本地视频数量，决定是否显示使用说明和特性列表
    const showInstructions = await shouldShowInstructions();
    if (!showInstructions) {
      if (usageInstructions) usageInstructions.style.display = "none";
      if (featureList) featureList.style.display = "none";
    } else {
      if (usageInstructions) usageInstructions.style.display = "";
      if (featureList) featureList.style.display = "";
    }

    // 检查是否显示赞赏码
    const showAppreciate = await shouldShowAppreciateCode();
    if (showAppreciate && appreciateContainer) {
      appreciateContainer.style.display = "block";
      // 动态加载支持信息
      await loadSupportInfo();
      console.log("显示赞赏码");
    } else if (appreciateContainer) {
      appreciateContainer.style.display = "none";
      console.log("隐藏赞赏码，当前处理视频数不足10个");
    }

    // 2. 尝试获取缓存的用户统计数据
    let cachedStats = await adskipStorage.getUserStatsCache();
    if (cachedStats) {
      console.log("使用缓存的用户统计数据", cachedStats);
      // 先展示缓存数据
      updateStatsUI(cachedStats);
    }

    // 3. 检查次数耗尽与缓存数据的一致性
    // 如果当日次数耗尽 且 缓存显示还有次数，则强制更新
    let forceUpdateDueToQuotaInconsistency = false;
    if (
      cachedStats &&
      cachedStats.daily_gemini_limit &&
      cachedStats.daily_gemini_requests_used !== undefined
    ) {
      const cachedRemaining =
        cachedStats.daily_gemini_limit - cachedStats.daily_gemini_requests_used;
      // 检查是否处于次数耗尽状态（修正时区问题，强制用东八区日期）
      const quotaExhaustedStatus =
        await adskipStorage.getQuotaExhaustedStatus();
      // 用东八区时间获取今天的日期
      function getTodayInEast8() {
        const now = new Date();
        // UTC+8:00
        const east8 = new Date(
          now.getTime() + (8 - now.getTimezoneOffset() / 60) * 60 * 60 * 1000,
        );
        // 取东八区的年月日
        const year = east8.getUTCFullYear();
        const month = String(east8.getUTCMonth() + 1).padStart(2, "0");
        const day = String(east8.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      const today = getTodayInEast8();
      const isQuotaExhausted = quotaExhaustedStatus === today;
      console.log(
        "quotaExhaustedStatus:",
        quotaExhaustedStatus,
        "today:",
        today,
        "isQuotaExhausted:",
        isQuotaExhausted,
      );

      if (isQuotaExhausted && cachedRemaining > 0) {
        console.log(
          `检测到数据不一致：当日次数已耗尽但缓存显示还有${cachedRemaining}次，强制更新`,
        );
        forceUpdateDueToQuotaInconsistency = true;
      }
    }

    // 4. 检查是否需要更新用户数据（包含强制更新条件）
    const shouldUpdate =
      forceUpdateDueToQuotaInconsistency ||
      (await adskipStorage.shouldUpdateUserStats());
    console.log(
      `是否需要更新用户统计数据: ${shouldUpdate} (强制更新: ${forceUpdateDueToQuotaInconsistency})`,
    );

    if (!shouldUpdate) {
      console.log("不需要更新用户统计数据，使用缓存数据");
      return; // 不需要更新，直接返回
    }

    // 5. 需要更新，获取用户信息并请求API
    try {
      console.log("开始更新用户统计数据");

      // 使用统一的API URL获取函数
      const apiUrls = await adskipStorage.getApiUrls();

      const userPayload = await getUserPayload();

      // 添加本地统计计数器到请求中
      const usageStats = await adskipStorage.getUsageStats();
      const requestPayload = {
        ...userPayload,
        // 本地使用统计
        local_popup_opens: usageStats.popupOpens,
        local_share_clicks: usageStats.shareClicks,
      };

      console.log("请求API的用户信息载荷（含本地统计）", requestPayload);
      console.log("用户统计API URL:", apiUrls.userStats);

      const response = await fetch(apiUrls.userStats, {
        method: "POST",
        headers: USER_STATS_HEADERS,
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(15000), // 15秒超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`,
        );
      }

      const data = await response.json();
      if (data.message === "获取成功" && data.uid) {
        // 后端返回中不一定带有B站用户名，向下穿透保留请求时的真实用户名
        data.username = data.username || requestPayload.username;

        // 同步服务端数据到本地存储
        await adskipStorage.syncServerDataToLocal(data);

        // 记录本次获取时间和视频处理数量
        await adskipStorage.recordLastStatsFetch();

        // 保存到缓存
        await adskipStorage.saveUserStatsCache(data);

        // 更新UI
        updateStatsUI(data);

        console.log("用户统计数据更新成功");
      } else {
        throw new Error(
          "API response indicates failure or malformed data: " +
            JSON.stringify(data),
        );
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // 如果有缓存数据，显示一个小的错误提示但保留缓存数据显示
      if (cachedStats) {
        // 向现有stats区域添加错误信息而不是替换
        const errorElem = document.createElement("p");
        errorElem.style.color = "red";
        errorElem.style.fontSize = "0.8em";
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
          usageInstructions.style.display = "";
        }
        if (featureList) {
          featureList.style.display = "";
        }
      }
    }
  }

  function updateStatsUI(data) {
    if (!userStatsArea) return;

    // 当有统计数据时，隐藏使用说明等初始区域
    if (usageInstructions) usageInstructions.style.display = "none";
    if (featureList) featureList.style.display = "none";

    // ========= 【核心变更】：身份与阶级色彩 (B站色系) =========
    const renderTierBadge = (tier) => {
      if (tier === "ultra") {
        return `<span style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; box-shadow: 0 2px 4px rgba(255,165,0,0.3);">Ultra</span>`;
      } else if (tier === "pro") {
        // B站专版粉红 #fb7299
        return `<span style="background-color: #fb7299; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">Pro</span>`;
      } else {
        // B站标准蓝 #00a1d6
        return `<span style="background-color: #00a1d6; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">Basic</span>`;
      }
    };

    // ========= 【核心变更】：智能折叠与平滑降级展示 =========
    // 调动底层封装方法，自动隐藏烦人的/Max，无配额时暴露充值引导
    const qVideo = adskipStorage.getConsolidatedQuotaText(
      "video_analyze",
      data,
    );
    const qChat = adskipStorage.getConsolidatedQuotaText("ai_chat", data);
    const qAudio = adskipStorage.getConsolidatedQuotaText(
      "audio_subtitle",
      data,
    );
    const qAd = adskipStorage.getConsolidatedQuotaText("ad_correction", data);

    const getRowColor = (status) => {
      if (status === "normal") return "#333";
      if (status === "warn") return "#f57c00"; // 橙色体验警戒线
      return "#dc3545"; // 耗尽红灯
    };

    const quotaHtml = `
        <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>🎯 视频分析</strong>
                <span style="color: ${getRowColor(qVideo.status)}; font-weight: ${qVideo.status !== "normal" ? "bold" : "normal"};">${qVideo.text}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>💬 AI 对话</strong>
                <span style="color: ${getRowColor(qChat.status)};">${qChat.text}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>🎤 音频转录</strong>
                <span style="color: ${getRowColor(qAudio.status)};">${qAudio.text}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>🛠️ 广告修正</strong>
                <span style="color: ${getRowColor(qAd.status)};">${qAd.text}</span>
            </div>
        </div>
    `;

    // ========= 【核心变更】：抛弃原生窗，引入就地折叠面板 (Inline Accordion) =========
    const activationHtml = `
        <div style="margin-top: 10px;">
            <button id="toggle-activation-btn" style="width: 100%; padding: 8px; background: #fdfdfd; border: 1px dashed #ccc; border-radius: 6px; cursor: pointer; color: #666; font-size: 13px; transition: 0.2s;">
                使用激活码 / 获取额度 ▼
            </button>
            <div id="activation-panel" style="display: none; padding: 12px; background: #fafafa; border: 1px solid #eee; border-radius: 6px; margin-top: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" id="activation-code-input" placeholder="输入兑换码" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                    <button id="submit-activation-btn" style="padding: 8px 16px; background-color: #fb7299; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s;">核销</button>
                </div>
                <div id="activation-message" style="margin-top: 8px; font-size: 12px; text-align: center; height: 16px; line-height: 16px;"></div>
            </div>
        </div>
    `;

    // 临近过期时间预警计算与展示
    let expireHtml = "";
    if (
      data.subscriptions &&
      data.subscriptions.pro &&
      data.subscriptions.pro.end_date
    ) {
      const endDate = new Date(data.subscriptions.pro.end_date);
      const daysLeft = Math.ceil(
        (endDate - new Date()) / (1000 * 60 * 60 * 24),
      );
      const color = daysLeft <= 7 ? "#dc3545" : "#888";
      const warnIcon = daysLeft <= 7 ? "⚠️ " : "";
      expireHtml = `<div style="font-size: 12px; color: ${color}; margin-top: 6px;">${warnIcon}会员有效期至: ${data.subscriptions.pro.end_date} (剩余${daysLeft}天)</div>`;
    } else if (data.tier === "basic" || !data.tier) {
      expireHtml = `<div style="font-size: 12px; color: #888; margin-top: 6px;">普通用户，支持升级解锁多维度功能</div>`;
    }

    // 生成收起视图（推荐任务）
    let recommendationHTML = "";
    const summaryItem = Array.isArray(data?.usage_info)
      ? data.usage_info.find((item) => item.show_in_summary === true)
      : null;
    if (summaryItem) {
      let progressText = `+${summaryItem.current_value}`;
      if (summaryItem.max_value) {
        progressText += ` / ${summaryItem.max_value}`;
      }
      recommendationHTML = `<div style="font-size: 0.85em; color: #007bff; margin: 6px 0 5px 0;">💡 ${summaryItem.description} (可获得 ${progressText} 次)</div>`;
    }

    let accountTypeDisplay = data.account_type_display || "未知";
    if (data.is_in_trial_period && data.trial_end_date) {
      accountTypeDisplay += `<span style="color: #28a745;"> (推广体验期至${data.trial_end_date})</span>`;
    }

    // ========= 【总装组合】 =========
    let statsHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <div style="font-size: 16px; font-weight: bold; color: #222; display: flex; align-items: center; gap: 8px;">
                <span title="B站用户 ${data.uid || "未知 UID"}">${data.username || "神秘过客"}</span> 
                ${renderTierBadge(data.tier)}
            </div>
            <span style="font-size: 10px; color: #aaa;" title="数据时间戳">更新: ${data.updateTimeDisplay || "刚刚"}</span>
        </div>
        ${expireHtml}
        ${quotaHtml}
        ${activationHtml}
        ${recommendationHTML}
        <div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 13px; color: #666;">
            <div style="display: flex; justify-content: space-between;">
                <span>总共为您节省时间</span>
                <span style="color: #fb7299; font-weight: bold;">${data.total_ads_duration_display || "0秒"}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                <span>处理含广视频</span>
                <span>${data.total_videos_with_ads !== undefined ? data.total_videos_with_ads : "0"} 个</span>
            </div>
        </div>
    `;

    userStatsArea.innerHTML = statsHTML;

    // ========= 【就地交互绑定逻辑】 =========
    const toggleBtn = document.getElementById("toggle-activation-btn");
    const actPanel = document.getElementById("activation-panel");
    const submitBtn = document.getElementById("submit-activation-btn");
    const actInput = document.getElementById("activation-code-input");
    const actMsg = document.getElementById("activation-message");

    if (toggleBtn && actPanel) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = actPanel.style.display === "none";
        actPanel.style.display = isHidden ? "block" : "none";
        toggleBtn.innerHTML = isHidden
          ? "💎 隐藏激活组件 ▲"
          : "💎 使用激活码 / 获取额度 ▼";
        if (isHidden) actInput.focus();
      });
    }

    if (submitBtn && actInput && actMsg) {
      submitBtn.addEventListener("click", async () => {
        const code = actInput.value.trim();
        if (!code) {
          actMsg.style.color = "#dc3545";
          actMsg.textContent = "请输入激活码";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "验证中..";
        actMsg.style.color = "#666";
        actMsg.textContent = "正在与服务端通讯，请稍候...";

        try {
          const res = await adskipStorage.redeemActivationCode(code);
          if (res.success) {
            actMsg.style.color = "#28a745";
            actMsg.textContent = "核销成功！您的额度和有效期已增加。";
            actInput.value = "";
            // 局部刷新自身，让用户看着数字变大，体验更好！
            setTimeout(() => {
              submitBtn.disabled = false;
              submitBtn.textContent = "核销";
              fetchAndDisplayUserStats(); // 这个函数自己会重走全流程拉最新数据
            }, 1200);
          } else {
            actMsg.style.color = "#dc3545";
            actMsg.textContent =
              res.message || "核销失败，请检查网络或核验码有效性";
            submitBtn.disabled = false;
            submitBtn.textContent = "核销";
          }
        } catch (err) {
          actMsg.style.color = "#dc3545";
          actMsg.textContent = "前端出现系统错误，请在设置提交反馈";
          submitBtn.disabled = false;
          submitBtn.textContent = "核销";
        }
      });

      // 增加回车快捷支持
      actInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") submitBtn.click();
      });
    }

    // 保留原始的防抖功能
    data._updateTimeDisplay =
      data.updateTimeDisplay || data._updateTimeDisplay || "刚刚";
  }

  // Call the function to fetch and display user stats
  fetchAndDisplayUserStats();

  // 添加分享功能区域
  const shareContainer = document.createElement("div");
  shareContainer.id = "share-container";
  shareContainer.style.marginTop = "15px";
  shareContainer.style.textAlign = "center";

  const shareButton = document.createElement("button");
  shareButton.textContent = "📤 分享给朋友";
  shareButton.style.cssText = `
    background-color: #FB7299;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    width: 100%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(230, 73, 128, 0.3);
  `;

  shareButton.addEventListener("mouseenter", () => {
    shareButton.style.transform = "translateY(-2px)";
    shareButton.style.boxShadow = "0 4px 12px rgba(230, 73, 128, 0.4)";
  });

  shareButton.addEventListener("mouseleave", () => {
    shareButton.style.transform = "translateY(0)";
    shareButton.style.boxShadow = "0 2px 8px rgba(230, 73, 128, 0.3)";
  });

  const shareStatus = document.createElement("div");
  shareStatus.id = "share-status";
  shareStatus.style.cssText = `
    margin-top: 10px;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    display: none;
  `;

  shareContainer.appendChild(shareButton);
  shareContainer.appendChild(shareStatus);

  // 在版本信息前插入分享容器
  const footerElement = document.querySelector("#footer-version");
  footerElement.insertAdjacentElement("afterend", shareContainer);

  /**
   * 获取用于分享的用户统计数据 - 使用现有的popup.js方法
   * @returns {Promise<Object>} 用户统计数据
   */
  async function getShareUserStats() {
    try {
      // 获取本地处理的视频数量
      const localVideoCount =
        await adskipStorage.getLocalVideosProcessedCount();

      // 获取缓存的用户统计数据
      const cachedStats = await adskipStorage.getUserStatsCache();

      // 获取用户信息 - 复用现有的getUserPayload方法
      const userPayload = await getUserPayload();
      // 计算节省时间 - 使用服务端数据优先，本地数据作为后备
      let timeSavedDisplay = "0秒";
      if (cachedStats && cachedStats.total_ads_duration_display) {
        timeSavedDisplay = cachedStats.total_ads_duration_display;
      } else {
        // 后备计算：假设每个广告平均30秒
        const avgAdDuration = 30;
        const timeSavedSeconds = localVideoCount * avgAdDuration;
        const timeSavedMinutes = Math.floor(timeSavedSeconds / 60);
        const timeSavedHours = Math.floor(timeSavedMinutes / 60);

        if (timeSavedHours > 0) {
          timeSavedDisplay = `${timeSavedHours}小时${timeSavedMinutes % 60}分钟`;
        } else if (timeSavedMinutes > 0) {
          timeSavedDisplay = `${timeSavedMinutes}分钟`;
        } else {
          timeSavedDisplay = `${timeSavedSeconds}秒`;
        }
      }

      return {
        userName: userPayload.username || "匿名用户",
        videoCount:
          cachedStats && cachedStats.total_videos_with_ads !== undefined
            ? cachedStats.total_videos_with_ads
            : localVideoCount,
        timeSaved: timeSavedDisplay,
        apiRequests: cachedStats ? cachedStats.total_gemini_requests || 0 : 0,
        accountType: cachedStats
          ? cachedStats.account_type_display || "免费用户"
          : "免费用户",
      };
    } catch (error) {
      console.log("获取分享数据失败:", error);
      return {
        userName: "匿名用户",
        videoCount: 0,
        timeSaved: "0秒",
        apiRequests: 0,
        accountType: "免费用户",
      };
    }
  }

  /**
   * 生成QR码数据URL
   * @param {string} text - 要编码的文本
   * @returns {Promise<string>} QR码的data URL
   */
  async function generateQRCode(text) {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;

    try {
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.log("生成QR码失败:", error);
      return null;
    }
  }

  /**
   * 圆角矩形辅助函数
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} radius - 圆角半径
   */
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 解析时间字符串为总秒数
   * 支持格式：HH:MM:SS, MM:SS, 纯秒数
   * @param {string|number} timeSaved - 时间字符串或秒数
   * @returns {number} 总秒数
   */
  function parseTimeSavedToSeconds(timeSaved) {
    // 如果已经是数字，直接返回
    if (typeof timeSaved === "number") {
      return Math.max(0, timeSaved);
    }

    // 如果是字符串，尝试解析
    if (typeof timeSaved === "string") {
      const timeStr = timeSaved.trim();

      // 尝试解析时间格式 HH:MM:SS 或 MM:SS
      const timeMatch = timeStr.match(/^(\d+):(\d+):(\d+)$|^(\d+):(\d+)$/);
      if (timeMatch) {
        if (
          timeMatch[1] !== undefined &&
          timeMatch[2] !== undefined &&
          timeMatch[3] !== undefined
        ) {
          // HH:MM:SS 格式
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          return hours * 3600 + minutes * 60 + seconds;
        } else if (timeMatch[4] !== undefined && timeMatch[5] !== undefined) {
          // MM:SS 格式
          const minutes = parseInt(timeMatch[4], 10);
          const seconds = parseInt(timeMatch[5], 10);
          return minutes * 60 + seconds;
        }
      }

      // 尝试直接解析为数字（纯秒数格式）
      const directNum = parseFloat(timeStr);
      if (!isNaN(directNum)) {
        return Math.max(0, directNum);
      }
    }

    // 解析失败，返回0
    console.warn("无法解析时间格式:", timeSaved);
    return 0;
  }

  /**
   * 根据时间匹配海报配置
   * @param {number} totalSeconds - 总秒数
   * @param {Object} postSettings - 海报配置对象
   * @returns {Object} 匹配的配置项
   */
  function matchPostConfigByTime(totalSeconds, postSettings) {
    try {
      // 如果没有配置或配置无效，使用默认配置
      if (
        !postSettings ||
        !postSettings.ranges ||
        !Array.isArray(postSettings.ranges)
      ) {
        console.warn("海报配置无效，使用默认配置");
        return postSettings?.default || {};
      }

      // 在ranges中查找匹配的范围
      for (const range of postSettings.ranges) {
        const minSeconds = range.min_seconds || 0;
        const maxSeconds = range.max_seconds;

        // 检查是否在范围内
        const inRange =
          totalSeconds >= minSeconds &&
          (maxSeconds === undefined || totalSeconds <= maxSeconds);

        if (
          inRange &&
          range.options &&
          Array.isArray(range.options) &&
          range.options.length > 0
        ) {
          // 从匹配的选项中随机选择一个
          const randomIndex = Math.floor(Math.random() * range.options.length);
          const selectedOption = range.options[randomIndex];

          console.log(
            `匹配到时间范围: ${minSeconds}-${maxSeconds || "∞"}秒，选择配置:`,
            selectedOption,
          );
          return selectedOption;
        }
      }

      // 没有匹配到任何范围，使用默认配置
      console.log("没有匹配到任何时间范围，使用默认配置");
      return postSettings.default || {};
    } catch (error) {
      console.error("匹配海报配置时出错:", error);
      return postSettings?.default || {};
    }
  }

  /**
   * 计算换算文案
   * @param {number} totalSeconds - 总秒数
   * @param {number} unitMinutes - 单位时间（分钟）
   * @param {string} template - 模板字符串
   * @returns {string} 换算后的文案
   */
  function calculateConversionText(totalSeconds, unitMinutes, template) {
    try {
      if (!unitMinutes || unitMinutes <= 0) {
        return "";
      }

      const unitSeconds = unitMinutes * 60;
      const count = Math.floor(totalSeconds / unitSeconds);

      if (count <= 0) {
        return "";
      }

      return template.replace("{count}", count);
    } catch (error) {
      console.error("计算换算文案时出错:", error);
      return "";
    }
  }

  /**
   * 生成分享图片 - 使用现代化设计和动态配置
   * @param {Object} userStats - 用户统计数据
   * @returns {Promise<Blob>} 生成的图片Blob
   */
  async function generateShareImage(userStats) {
    try {
      // 加载外部配置
      const externalConfig = await adskipStorage.loadExternalConfig();
      const postSettings = externalConfig?.post_setting || {};

      // 解析时间为秒数
      const totalSeconds = parseTimeSavedToSeconds(userStats.timeSaved);
      console.log(`解析时间: ${userStats.timeSaved} -> ${totalSeconds}秒`);

      // 根据时间匹配配置
      const selectedConfig = matchPostConfigByTime(totalSeconds, postSettings);
      console.log("选择的海报配置:", selectedConfig);

      // 使用默认配置作为回退
      const config = {
        main_title: selectedConfig.main_title || "重新爱上了没广告的B站~✨",
        sub_title: selectedConfig.sub_title || "朋友们，这波操作你们学会了吗",
        sub_title_offset: selectedConfig.sub_title_offset || 120,
        description: selectedConfig.description || "今天也是没被广告打扰的一天",
        description_offset: selectedConfig.description_offset || 170,
        conversion_unit_minutes: selectedConfig.conversion_unit_minutes || 1,
        conversion_template:
          selectedConfig.conversion_template || "✨ 相当于伸了{count}次懒腰",
        video_count_template:
          selectedConfig.video_count_template ||
          "📺 在 {count} 个含广告视频里进行了跃迁",
      };

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 设置画布尺寸 - 更大气的尺寸
      canvas.width = 800;
      canvas.height = 1200;

      // 使用更精致的渐变配色
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      gradient.addColorStop(0, "#ff7eb3"); // 更柔和的粉色
      gradient.addColorStop(0.5, "#ff5c8d");
      gradient.addColorStop(1, "#d83770"); // 更深的品红
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 添加现代感纹理
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 20 + 5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 重新规划布局 - 根据内容调整
      const sections = {
        header: { start: 80, height: 200 }, // 顶部标题区域 - 稍微增加高度
        content: { start: 320, height: 380 }, // 内容卡片区域
        qr: { start: 780, height: 280 }, // 二维码区域
        footer: { start: 1060, height: 120 }, // 底部区域
      };

      // 主标题区域 - 居中但不过分靠上
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";

      // 主标题
      ctx.font = "bold 48px PingFang SC, Microsoft YaHei, sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.fillText(
        config.main_title,
        canvas.width / 2,
        sections.header.start + 45,
      );

      // 副标题（如果有的话）
      if (config.sub_title) {
        ctx.font = "500 36px PingFang SC, Microsoft YaHei, sans-serif";
        ctx.shadowBlur = 6;
        ctx.fillText(
          config.sub_title,
          canvas.width / 2,
          sections.header.start + config.sub_title_offset,
        );
      }

      // 功能描述（如果有的话）
      if (config.description) {
        ctx.font = "300 30px PingFang SC, Microsoft YaHei, sans-serif";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillText(
          config.description,
          canvas.width / 2,
          sections.header.start + config.description_offset,
        );
      }

      // 用户信息卡片 - 居中放置
      const cardY = sections.content.start;
      const cardHeight = sections.content.height;

      // 卡片背景
      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      roundRect(ctx, 80, cardY, canvas.width - 160, cardHeight, 25);
      ctx.fill();

      // 卡片标题
      ctx.shadowBlur = 0;
      ctx.fillStyle = "white";
      ctx.font = "bold 38px PingFang SC, Microsoft YaHei, sans-serif";
      ctx.fillText(
        `🏆  ${userStats.userName} 的使用成就`,
        canvas.width / 2,
        cardY + 90,
      );

      // 生成视频数量文案
      const videoCountText = config.video_count_template.replace(
        "{count}",
        userStats.videoCount,
      );

      // 计算换算文案
      const conversionText = calculateConversionText(
        totalSeconds,
        config.conversion_unit_minutes,
        config.conversion_template,
      );
      console.log("test-", conversionText);
      // 统计数据 - 根据是否有换算文案决定布局
      ctx.font = "32px PingFang SC, Microsoft YaHei, sans-serif";
      const stats = [
        { icon: "", text: videoCountText },
        { icon: "", text: `⏰ 累计节省时间 ${userStats.timeSaved}` },
      ];

      // 如果有换算文案，添加到统计数据中
      if (conversionText) {
        stats.push({ icon: "", text: conversionText });
      }

      // 计算统计数据的垂直居中位置
      const statsStartY = cardY + 180;
      const statsSpacing = Math.min(
        90,
        Math.floor((cardHeight - 200) / stats.length),
      ); // 根据数据量动态调整间距

      stats.forEach((stat, i) => {
        const y = statsStartY + i * statsSpacing;

        // 图标
        ctx.font = "36px sans-serif";
        ctx.fillText(stat.icon, canvas.width / 2 - 180, y);

        // 文字
        ctx.font = "32px PingFang SC, Microsoft YaHei, sans-serif";
        ctx.fillText(stat.text, canvas.width / 2 + 20, y);
      });

      // 生成并绘制QR码 - 给予充足空间
      const personalPageUrl =
        "https://otokonoizumi.github.io/?source=adskip-post#projects";
      const qrCodeDataUrl = await generateQRCode(personalPageUrl);

      // 统计分享图片生成次数
      try {
        const workspace = "adskip";
        const baseUrl = "https://api.counterapi.dev/v2";

        // 递增总访问量（按官方文档格式）
        await fetch(`${baseUrl}/${workspace}/share-post/up`, {
          method: "GET",
        });
      } catch (error) {
        console.log("countapi统计失败:", error);
      }

      if (qrCodeDataUrl) {
        const qrImg = new Image();
        return new Promise((resolve) => {
          qrImg.onload = () => {
            // QR码区域 - 居中且有充足空间
            const qrContainerY = sections.qr.start;
            const qrSize = 160;

            // 装饰性背景
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            roundRect(
              ctx,
              (canvas.width - qrSize - 90) / 2,
              qrContainerY - 30,
              qrSize + 90,
              qrSize + 120,
              30,
            );
            ctx.fill();

            // QR码
            ctx.shadowBlur = 0;
            ctx.drawImage(
              qrImg,
              (canvas.width - qrSize) / 2,
              qrContainerY,
              qrSize,
              qrSize,
            );

            // QR码说明
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.font = "28px PingFang SC, Microsoft YaHei, sans-serif";
            ctx.fillText(
              "扫码上车 告别广告",
              canvas.width / 2,
              qrContainerY + qrSize + 60,
            );

            // 底部区域 - 简洁不拥挤
            const footerY = sections.footer.start;

            // 底部装饰线
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(200, footerY);
            ctx.lineTo(canvas.width - 200, footerY);
            ctx.stroke();

            // 装饰点
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.beginPath();
            ctx.arc(canvas.width / 2, footerY, 3, 0, Math.PI * 2);
            ctx.fill();

            // 底部文案 - 给予充足间距
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.font = "28px PingFang SC, Microsoft YaHei, sans-serif";
            ctx.fillText(
              "♪(´▽｀) 守护您的观影情绪 (´∀｀)♡",
              canvas.width / 2,
              footerY + 50,
            );

            // 项目名称
            ctx.font = "bold 36px PingFang SC, Microsoft YaHei, sans-serif";
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.fillText("B站切片广告之友", canvas.width / 2, footerY + 100);

            canvas.toBlob(resolve, "image/png", 0.9);
          };
          qrImg.src = qrCodeDataUrl;
        });
      } else {
        // 如果QR码生成失败，直接返回不含QR码的图片
        return new Promise((resolve) => {
          canvas.toBlob(resolve, "image/png", 0.9);
        });
      }
    } catch (error) {
      console.error("生成分享图片时出错:", error);

      // 出错时生成一个简单的错误图片
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 800;
      canvas.height = 1200;

      ctx.fillStyle = "#ff7eb3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "48px Arial";
      ctx.textAlign = "center";
      ctx.fillText("生成海报时出错", canvas.width / 2, canvas.height / 2);

      return new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png", 0.9);
      });
    }
  }

  /**
   * 显示生成的分享图片
   * @param {Blob} imageBlob - 图片Blob
   */
  async function displayShareImage(imageBlob) {
    try {
      // 创建图片URL
      const imageUrl = URL.createObjectURL(imageBlob);

      // 创建预览图片
      const previewImg = document.createElement("img");
      previewImg.src = imageUrl;
      previewImg.style.cssText = `
        max-width: 280px;
        border-radius: 8px;
        margin: 10px auto;
        display: block;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      `;

      // 创建下载链接
      const downloadLink = document.createElement("a");
      downloadLink.href = imageUrl;
      downloadLink.download = `B站切片广告之友_分享图片_${new Date().getTime()}.png`;
      downloadLink.style.cssText = `
        display: inline-block;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 4px;
        margin: 8px 4px;
        font-size: 12px;
        transition: all 0.3s ease;
      `;
      downloadLink.textContent = "💾 保存到本地";

      // 添加下载链接悬停效果
      downloadLink.addEventListener("mouseenter", () => {
        downloadLink.style.transform = "translateY(-1px)";
        downloadLink.style.boxShadow = "0 4px 12px rgba(40, 167, 69, 0.3)";
      });

      downloadLink.addEventListener("mouseleave", () => {
        downloadLink.style.transform = "translateY(0)";
        downloadLink.style.boxShadow = "none";
      });

      // 移除图片点击保存功能
      // previewImg.addEventListener('click', () => {
      //   downloadLink.click();
      // });

      // 更新状态显示
      shareStatus.innerHTML = "";
      shareStatus.appendChild(previewImg);

      const actionsDiv = document.createElement("div");
      actionsDiv.style.textAlign = "center";
      actionsDiv.appendChild(downloadLink);

      shareStatus.appendChild(actionsDiv);
      shareStatus.style.display = "block";
      shareStatus.style.backgroundColor = "rgba(40, 167, 69, 0.1)";
      shareStatus.style.borderLeft = "3px solid #28a745";
      shareStatus.style.color = "#155724";

      const successText = document.createElement("div");
      successText.innerHTML = "✅ 分享图片生成成功！";
      successText.style.marginTop = "8px";
      successText.style.fontSize = "12px";
      shareStatus.appendChild(successText);

      // 延长URL生命周期，但设置最长清理时间
      setTimeout(() => {
        URL.revokeObjectURL(imageUrl);
      }, 300000); // 5分钟后清理
    } catch (error) {
      console.log("显示分享图片失败:", error);
      shareStatus.textContent = "❌ 显示图片失败";
      shareStatus.style.display = "block";
      shareStatus.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
      shareStatus.style.borderLeft = "3px solid #dc3545";
      shareStatus.style.color = "#721c24";
    }
  }

  /**
   * 简单统计：增加popup打开计数
   */
  async function incrementPopupOpenCount() {
    try {
      await adskipStorage.incrementPopupOpenCount();
      console.log("Popup打开计数已增加");
    } catch (error) {
      console.log(`增加popup打开计数失败: ${error.message}`);
    }
  }

  // 分享按钮事件监听
  shareButton.addEventListener("click", async () => {
    try {
      shareButton.disabled = true;
      shareButton.textContent = "🎨 生成中...";
      shareStatus.style.display = "block";
      shareStatus.style.backgroundColor = "rgba(23, 162, 184, 0.1)";
      shareStatus.style.borderLeft = "3px solid #17a2b8";
      shareStatus.style.color = "#0c5460";
      shareStatus.textContent = "正在生成分享图片，请稍候...";

      // 简单统计：增加分享按钮点击计数
      await adskipStorage.incrementShareClickCount();

      // 获取用户数据
      const userStats = await getShareUserStats();

      // 生成分享图片
      const shareImage = await generateShareImage(userStats);

      // 显示生成的图片
      await displayShareImage(shareImage);
    } catch (error) {
      console.log("生成分享图片失败:", error);
      shareStatus.style.display = "block";
      shareStatus.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
      shareStatus.style.borderLeft = "3px solid #dc3545";
      shareStatus.style.color = "#721c24";
      shareStatus.textContent = "❌ 生成失败，请稍后重试";
    } finally {
      shareButton.disabled = false;
      shareButton.textContent = "📤 分享给朋友";
    }
  });

  /**
   * 初始化跳过开头/结尾设置
   */
  async function initSkipIntroOutroSettings() {
    const skipSection = document.getElementById("skip-intro-outro-section");
    const skipIntroToggle = document.getElementById("skip-intro-toggle");
    const skipIntroDuration = document.getElementById("skip-intro-duration");
    const skipOutroToggle = document.getElementById("skip-outro-toggle");
    const skipOutroDuration = document.getElementById("skip-outro-duration");
    const currentUploaderSection = document.getElementById(
      "current-uploader-skip-section",
    );
    const currentUploaderName = document.getElementById(
      "current-uploader-name-skip",
    );
    const currentUploaderToggle = document.getElementById(
      "current-uploader-skip-toggle",
    );

    if (!skipSection) return;

    // 总是显示跳过设置区域
    skipSection.style.display = "block";

    // 当前上下文变量
    let currentUploader = null;
    let hasUploaderConfig = false;

    // 加载全局默认设置
    const [
      globalIntroEnabled,
      globalIntroDuration,
      globalOutroEnabled,
      globalOutroDuration,
    ] = await Promise.all([
      adskipStorage.getSkipIntroEnabled(),
      adskipStorage.getSkipIntroDuration(),
      adskipStorage.getSkipOutroEnabled(),
      adskipStorage.getSkipOutroDuration(),
    ]);

    // 辅助函数：更新UI值
    function updateUI(
      introEnabled,
      introDuration,
      outroEnabled,
      outroDuration,
    ) {
      skipIntroToggle.checked = introEnabled;
      skipIntroDuration.value = introDuration;
      skipOutroToggle.checked = outroEnabled;
      skipOutroDuration.value = outroDuration;
    }

    // 初始显示全局默认
    updateUI(
      globalIntroEnabled,
      globalIntroDuration,
      globalOutroEnabled,
      globalOutroDuration,
    );

    // 检查是否在B站视频页面并获取UP主信息
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const currentTab = tabs[0];
      const isBilibiliVideo =
        currentTab &&
        currentTab.url &&
        (currentTab.url.includes("bilibili.com/video/") ||
          currentTab.url.includes("bilibili.com/bangumi/"));

      if (isBilibiliVideo) {
        try {
          const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: "getCurrentUploader",
            target: "content",
          });
          if (
            response &&
            response.uploader &&
            response.uploader !== "未知UP主"
          ) {
            currentUploader = response.uploader;

            // 显示UP主控制区
            currentUploaderSection.style.display = "block";
            currentUploaderName.textContent = currentUploader;

            // 获取该UP主的特定配置
            const uploaderSettings =
              await adskipStorage.getUploaderSkipSettings(currentUploader);

            if (uploaderSettings) {
              hasUploaderConfig = true;
              currentUploaderToggle.checked =
                uploaderSettings.enabled !== false;

              // 使用UP主的特定设置覆盖UI（兼容旧数据：如果没有特定字段，回退到全局/默认）
              const uIntroEn =
                uploaderSettings.skipIntro !== undefined
                  ? uploaderSettings.skipIntro
                  : true;
              const uIntroDur =
                uploaderSettings.introDuration !== undefined
                  ? uploaderSettings.introDuration
                  : globalIntroDuration;
              const uOutroEn =
                uploaderSettings.skipOutro !== undefined
                  ? uploaderSettings.skipOutro
                  : true;
              const uOutroDur =
                uploaderSettings.outroDuration !== undefined
                  ? uploaderSettings.outroDuration
                  : globalOutroDuration;

              updateUI(uIntroEn, uIntroDur, uOutroEn, uOutroDur);
            } else {
              hasUploaderConfig = false;
              currentUploaderToggle.checked = false;
              // 保持显示全局默认值
            }
          }
        } catch (e) {
          console.log("获取UP主失败", e);
        }
      }
    } catch (e) {
      console.log("Tab check failed", e);
    }

    // 事件处理：数值/开关变更
    async function handleSettingChange() {
      // 只有当UP主已有配置（无论是否启用）时，才自动保存修改
      if (currentUploader && hasUploaderConfig) {
        const newSettings = {
          skipIntro: skipIntroToggle.checked,
          introDuration: parseInt(skipIntroDuration.value, 10) || 0,
          skipOutro: skipOutroToggle.checked,
          outroDuration: parseInt(skipOutroDuration.value, 10) || 0,
        };
        await adskipStorage.updateUploaderSkipSettings(
          currentUploader,
          newSettings,
        );
      }
      // 如果没有配置，这里什么都不做，在这个状态下的修改只是临时的UI变化
      // 等用户点击"开启"时，会读取当前的UI值进行保存
    }

    skipIntroToggle.addEventListener("change", handleSettingChange);
    skipIntroDuration.addEventListener("change", handleSettingChange);
    skipOutroToggle.addEventListener("change", handleSettingChange);
    skipOutroDuration.addEventListener("change", handleSettingChange);

    // 事件处理：UP主开关变更
    if (currentUploaderToggle) {
      currentUploaderToggle.addEventListener("change", async function () {
        if (this.checked) {
          // 开启：保存当前UI上的值（无论是默认的还是刚才改的）作为该UP主的设置
          const currentSettings = {
            skipIntro: skipIntroToggle.checked,
            introDuration: parseInt(skipIntroDuration.value, 10) || 0,
            skipOutro: skipOutroToggle.checked,
            outroDuration: parseInt(skipOutroDuration.value, 10) || 0,
            enabled: true,
          };

          await adskipStorage.addUploaderToSkipIntroOutroList(
            currentUploader,
            currentSettings,
          );
          hasUploaderConfig = true;
        } else {
          // 关闭：禁用该UP主（不删除数据）
          if (hasUploaderConfig) {
            await adskipStorage.disableUploaderInSkipIntroOutroList(
              currentUploader,
            );
            // hasUploaderConfig 保持为 true，因为数据并未删除，只是disabled
            // 此时修改数值依然会生效（保存到该UP主的配置中）
          }
        }
      });
    }
  }
});
