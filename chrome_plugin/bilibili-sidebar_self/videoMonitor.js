/**
 * videoMonitor.js - 视频监控模块
 * 处理视频监控和广告跳过的核心逻辑
 */

"use strict";

// 添加全局变量，用于缓存当前播放时间
let lastKnownPlaybackTime = 0;
let lastPlaybackTimeUpdate = 0;
let _hasMarkedReadForCurrentVideo = false; // 用于15s兜底已读标记

// 添加全局变量用于缓存白名单状态
let _lastUploaderName = "";
let _lastWhitelistStatus = false;
let _lastGlobalSkipStatus = true;

// 添加全局函数，用于获取当前播放时间（优先使用缓存的时间）
function getCurrentRealPlaybackTime() {
  const now = Date.now();
  adskipUtils.logDebug(
    "PlaybackMonitor: 刷新播放器引用，来自 getCurrentRealPlaybackTime",
  );
  const videoPlayer = adskipUtils.findVideoPlayer();

  // 如果视频播放器存在，更新缓存的时间
  if (videoPlayer) {
    // 只有当距离上次更新超过100ms时才更新时间，减少频繁获取
    if (now - lastPlaybackTimeUpdate > 100) {
      lastKnownPlaybackTime = videoPlayer.currentTime;
      lastPlaybackTimeUpdate = now;
    }
  }

  return lastKnownPlaybackTime;
}

// 定期更新缓存的播放时间，避免点击时才获取导致不准确
function setupPlaybackTimeMonitor() {
  // 清除旧的监听器
  if (window.playbackTimeMonitorInterval) {
    clearInterval(window.playbackTimeMonitorInterval);
  }

  // 设置新的定时器，定期更新播放时间缓存
  window.playbackTimeMonitorInterval = setInterval(function () {
    // adskipUtils.logDebug('PlaybackMonitor: 刷新播放器引用，来自 setupPlaybackTimeMonitor'); // 暂时屏蔽
    const videoPlayer = adskipUtils.findVideoPlayer();
    if (videoPlayer && !videoPlayer.paused && !videoPlayer.ended) {
      lastKnownPlaybackTime = videoPlayer.currentTime;
      lastPlaybackTimeUpdate = Date.now();

      // 新增：自动记录超15s的已读兜底
      if (
        lastKnownPlaybackTime > 15 &&
        typeof currentVideoId !== "undefined" &&
        currentVideoId &&
        !_hasMarkedReadForCurrentVideo
      ) {
        _hasMarkedReadForCurrentVideo = true;
        if (
          typeof adskipStorage !== "undefined" &&
          typeof adskipStorage.markVideoAsRead === "function"
        ) {
          adskipStorage.markVideoAsRead(currentVideoId).catch(() => {});
        }
      }
    }
  }, 100); // 每100ms更新一次

  // 页面卸载时清理资源
  window.addEventListener("unload", function () {
    if (window.playbackTimeMonitorInterval) {
      clearInterval(window.playbackTimeMonitorInterval);
    }
  });
}

/**
 * 设置广告跳过监控
 * @param {Array} adTimestamps 广告时间戳数组
 */
function setupAdSkipMonitor(adTimestamps) {
  adskipUtils.logDebug("设置广告跳过监控:", adTimestamps);

  // 清除旧监控（无论是否有新的时间段）
  if (window.adSkipCheckInterval) {
    clearInterval(window.adSkipCheckInterval);
    adskipUtils.logDebug("清除旧的广告监控定时器", { throttle: 2000 });
    window.adSkipCheckInterval = null;
  }

  // 更新当前生效的时间段（包括空数组的情况）
  currentAdTimestamps = adTimestamps || [];

  // 保存到本地存储（包括空数组的情况）
  if (currentVideoId) {
    adskipStorage.saveAdTimestampsForVideo(currentVideoId, currentAdTimestamps);
  }

  // 如果没有有效的广告时间段，清空标记并返回
  if (
    !adTimestamps ||
    !Array.isArray(adTimestamps) ||
    adTimestamps.length === 0
  ) {
    adskipUtils.logDebug("无有效广告时间段，已清空监控和标记");
    // 清除进度条上的广告标记
    markAdPositionsOnProgressBar();
    return;
  }

  // 添加window unload事件监听，确保在页面卸载时清理资源
  window.addEventListener("unload", function () {
    if (window.adSkipCheckInterval) {
      clearInterval(window.adSkipCheckInterval);
      window.adSkipCheckInterval = null;
    }
  });

  // 启动播放时间监控
  setupPlaybackTimeMonitor();

  // 设置新监控
  window.adSkipCheckInterval = setInterval(function () {
    checkAndSkip();
  }, 500);
  adskipUtils.logDebug("设置新的广告监控定时器", { throttle: 2000 });

  // 标记进度条上的广告位点
  markAdPositionsOnProgressBar();
}

/**
 * 检查扩展上下文是否有效
 * @returns {boolean} 如果扩展上下文有效返回true，否则返回false
 */
function isExtensionContextValid() {
  try {
    const isValid =
      typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;

    if (!isValid) {
      adskipUtils.logDebug("扩展上下文检查失败：chrome.runtime.id不存在或无效");
    }

    return isValid;
  } catch (e) {
    adskipUtils.logDebug(`扩展上下文检查出现异常: ${e.message}`);
    return false;
  }
}

/**
 * 核心检查函数 - 简化逻辑
 */
function checkAndSkip() {
  // 检查扩展上下文是否有效
  if (!isExtensionContextValid()) {
    adskipUtils.logDebug("扩展上下文已失效，停止执行 checkAndSkip");
    clearInterval(window.adSkipCheckInterval); // 清除定时器
    window.adSkipCheckInterval = null;
    return;
  }

  // 检查是否启用广告跳过功能
  chrome.storage.local.get("adskip_enabled", async function (result) {
    if (result.adskip_enabled === false) {
      // 使用节流控制，1秒内不重复输出相同消息
      adskipUtils.logDebug("广告跳过功能已禁用，不执行检查", {
        throttle: 1000,
      });
      return;
    }

    // 获取当前视频的UP主信息
    const { uploader } = await adskipStorage.getCurrentVideoUploader();

    // 检查UP主是否在白名单中
    const isUploaderWhitelisted =
      await adskipStorage.checkUploaderInWhitelist(uploader);
    const globalSkipEnabled = result.adskip_enabled !== false;

    // 检查白名单状态是否有变化，只有变化时才输出日志
    const statusChanged =
      uploader !== _lastUploaderName ||
      isUploaderWhitelisted !== _lastWhitelistStatus ||
      globalSkipEnabled !== _lastGlobalSkipStatus;

    // 更新上次状态缓存
    _lastUploaderName = uploader;
    _lastWhitelistStatus = isUploaderWhitelisted;
    _lastGlobalSkipStatus = globalSkipEnabled;

    if (isUploaderWhitelisted) {
      // 只在状态变化时输出日志
      if (statusChanged) {
        adskipUtils.logDebug(
          `UP主"${uploader}"在白名单中且启用状态，不执行自动跳过 (手动模式：${!globalSkipEnabled ? "是" : "否"})`,
        );
      }
      return;
    }

    // 只在状态变化时输出日志
    if (statusChanged) {
      adskipUtils.logDebug(
        `当前视频UP主："${uploader}", 白名单状态：${isUploaderWhitelisted ? "启用" : "未启用/不在白名单"}, 全局跳过：${globalSkipEnabled ? "开启" : "关闭"}`,
      );
    }

    // 以下是检查和跳过广告的实际逻辑
    let lastCheckTime = 0;

    // 查找视频播放器
    // adskipUtils.logDebug('PlaybackMonitor: 刷新播放器引用，来自 checkAndSkip'); // 暂时屏蔽
    const videoPlayer = adskipUtils.findVideoPlayer();

    if (!videoPlayer) {
      // 使用节流控制，1秒内不重复输出相同消息
      adskipUtils.logDebug("未找到视频播放器", { throttle: 1000 });
      return;
    }

    // 设置seeking事件监听
    if (videoPlayer) {
      // 使用命名函数，避免重复添加匿名事件监听器
      if (!videoPlayer._adskipSeekingHandler) {
        videoPlayer._adskipSeekingHandler = function (e) {
          if (scriptInitiatedSeek) {
            adskipUtils.logDebug("这是脚本引起的seeking事件，忽略");
            scriptInitiatedSeek = false;
          }
        };

        videoPlayer.addEventListener(
          "seeking",
          videoPlayer._adskipSeekingHandler,
        );
      }
    }

    if (videoPlayer.paused || videoPlayer.ended) return;

    const currentTime = videoPlayer.currentTime;

    // 更新时间缓存
    lastKnownPlaybackTime = currentTime;
    lastPlaybackTimeUpdate = Date.now();

    // 检查视频ID是否变化
    const newVideoId = adskipUtils.getCurrentVideoId().id;

    if (newVideoId !== currentVideoId && newVideoId !== "") {
      adskipUtils.logDebug(
        `视频ID变化检测 (checkAndSkip): ${currentVideoId} -> ${newVideoId}`,
      );
      lastVideoId = currentVideoId;
      currentVideoId = newVideoId;
      reinitialize();
      return;
    }

    // 记录时间跳跃情况，使用节流避免频繁日志
    if (Math.abs(currentTime - lastCheckTime) > 3 && lastCheckTime > 0) {
      adskipUtils.logDebug(
        `检测到大幅时间跳跃: ${lastCheckTime.toFixed(2)} -> ${currentTime.toFixed(2)}`,
        { throttle: 500 },
      );
    }
    lastCheckTime = currentTime;

    // 广告检测逻辑：使用百分比计算
    for (const ad of currentAdTimestamps) {
      // 计算广告时长
      const adDuration = ad.end_time - ad.start_time;

      // 根据百分比计算跳过点，但至少跳过1秒
      const skipDuration = Math.max(1, (adDuration * adSkipPercentage) / 100);

      // 确定广告的"开始区域"：从开始到min(开始+跳过时长,结束)
      const adStartRange = Math.min(ad.start_time + skipDuration, ad.end_time);

      // 如果在广告开始区域，直接跳到结束
      if (currentTime >= ad.start_time && currentTime < adStartRange) {
        adskipUtils.logDebug(
          `检测到在广告开始区域 [${ad.start_time.toFixed(1)}s-${adStartRange.toFixed(1)}s]，应用跳过范围:前${adSkipPercentage}%，跳过至${ad.end_time.toFixed(1)}s`,
        );

        // 标记为脚本操作并跳转
        scriptInitiatedSeek = true;
        videoPlayer.currentTime = ad.end_time;
        adskipUtils.logDebug(
          `已跳过广告: ${ad.start_time.toFixed(1)}s-${ad.end_time.toFixed(1)}s`,
        );
        break;
      }
    }
  });
}

/**
 * 标记视频进度条上的广告位点
 * 标记视频进度条上的广告位点（包含AI广告和手动设置的跳过片段）
 */
async function markAdPositionsOnProgressBar() {
  // 查找视频播放器
  const videoPlayer = adskipUtils.findVideoPlayer();
  if (!videoPlayer) {
    // 如果播放器不可用，稍后再试
    setTimeout(markAdPositionsOnProgressBar, 1000);
    return;
  }

  // 查找进度条容器
  let progressBarContainer = null;
  const selectors = [
    ".bilibili-player-video-progress",
    ".bpx-player-progress",
    ".squirtle-progress-wrap",
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      progressBarContainer = el;
      break;
    }
  }

  if (!progressBarContainer) {
    // 如果进度条不可用，稍后再试
    setTimeout(markAdPositionsOnProgressBar, 1000);
    return;
  }

  // 获取视频总时长
  const videoDuration = videoPlayer.duration;
  if (!videoDuration || isNaN(videoDuration)) return;

  // 收集所有需要标记的片段
  // 1. AI识别的广告
  const segmentsToMark = currentAdTimestamps.map((ad) => ({
    start: ad.start_time,
    end: ad.end_time,
    label: "广告",
    type: "ad",
  }));

  // 2. 跳过开头/结尾片段
  try {
    const { uploader } = await adskipStorage.getCurrentVideoUploader();
    if (uploader && uploader !== "未知UP主") {
      const uploaderSettings =
        await adskipStorage.getUploaderSkipSettings(uploader);
      const isInSkipList =
        await adskipStorage.checkUploaderInSkipIntroOutroList(uploader);

      if (isInSkipList) {
        // 获取生效的配置
        // 优先使用特定配置，若无则回退到全局默认
        const skipIntroEnabled =
          uploaderSettings && uploaderSettings.skipIntro !== undefined
            ? uploaderSettings.skipIntro
            : await adskipStorage.getSkipIntroEnabled();
        const introDuration =
          uploaderSettings && uploaderSettings.introDuration !== undefined
            ? uploaderSettings.introDuration
            : await adskipStorage.getSkipIntroDuration();

        const skipOutroEnabled =
          uploaderSettings && uploaderSettings.skipOutro !== undefined
            ? uploaderSettings.skipOutro
            : await adskipStorage.getSkipOutroEnabled();
        const outroDuration =
          uploaderSettings && uploaderSettings.outroDuration !== undefined
            ? uploaderSettings.outroDuration
            : await adskipStorage.getSkipOutroDuration();

        adskipUtils.logDebug(
          `[跳过标记调试] UP主:${uploader}, 开头:${skipIntroEnabled}(${introDuration}s), 结尾:${skipOutroEnabled}(${outroDuration}s)`,
        );

        // 添加开头标记
        if (skipIntroEnabled && introDuration > 0) {
          segmentsToMark.push({
            start: 0,
            end: Math.min(introDuration, videoDuration),
            label: "开头",
            type: "intro",
          });
        }

        // 添加结尾标记
        if (skipOutroEnabled && outroDuration > 0) {
          const start = Math.max(0, videoDuration - outroDuration);
          segmentsToMark.push({
            start: start,
            end: videoDuration,
            label: "结尾",
            type: "outro",
          });
        }
      }
    }
  } catch (e) {
    // 忽略错误，仅标记广告
  }

  // 移除旧的标记容器
  const oldContainer = progressBarContainer.querySelector(
    ".adskip-marker-container",
  );
  if (oldContainer) {
    oldContainer.remove();
  }

  // 如果没有什么可标记的，退出
  if (segmentsToMark.length === 0) return;

  // 创建标记容器
  const markerContainer = document.createElement("div");
  markerContainer.className = "adskip-marker-container";
  progressBarContainer.appendChild(markerContainer);

  // 为每个片段创建标记
  segmentsToMark.forEach(function (segment, index) {
    // 计算位置百分比
    const startPercent = (segment.start / videoDuration) * 100;
    const endPercent = (segment.end / videoDuration) * 100;
    const width = Math.max(0.5, endPercent - startPercent); // 至少显示一点宽度

    // 创建区间标记元素
    const marker = document.createElement("div");
    marker.className = "adskip-marker"; // 使用相同的类名，保持样式一致
    marker.style.left = `${startPercent}%`;
    marker.style.width = `${width}%`;
    marker.setAttribute("data-index", index);
    marker.setAttribute("data-type", segment.type);
    marker.setAttribute("data-start-time", segment.start);
    marker.setAttribute("data-end-time", segment.end);
    markerContainer.appendChild(marker);

    // 创建提示元素
    const tooltip = document.createElement("div");
    tooltip.className = "adskip-marker-tooltip";
    tooltip.style.left = `${startPercent + width / 2}%`;
    tooltip.textContent = `${segment.label}: ${adskipUtils.formatSingleTimestamp(segment.start, segment.end)}`;
    markerContainer.appendChild(tooltip);

    // 为标记添加事件监听
    marker.addEventListener("mouseenter", function () {
      tooltip.style.opacity = "1";
    });

    marker.addEventListener("mouseleave", function () {
      tooltip.style.opacity = "0";
    });

    // 添加点击事件 - 实现手动跳过功能
    marker.addEventListener("click", async function (e) {
      // 阻止事件冒泡，以防触发进度条的点击事件
      e.stopPropagation();
      e.preventDefault();

      // 使用缓存的播放时间，而不是直接获取
      const currentPlaybackTime = getCurrentRealPlaybackTime();
      const currentVideoTime = videoPlayer.currentTime;

      const type = marker.getAttribute("data-type");
      const adStartTime = parseFloat(marker.getAttribute("data-start-time"));
      const adEndTime = parseFloat(marker.getAttribute("data-end-time"));

      // 计算点击位置
      const rect = marker.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const markerWidth = rect.width;
      const clickRatio = clickX / markerWidth;
      const adDuration = adEndTime - adStartTime;
      const clickTimePosition = adStartTime + adDuration * clickRatio;

      // 统一打印点击调试日志（无论任何类型）
      adskipUtils.logDebug(
        `[点击调试] 类型:${type}, 点击时间:${clickTimePosition.toFixed(2)}s, 当前播放:${currentPlaybackTime.toFixed(2)}s(实:${currentVideoTime.toFixed(2)}s), 范围:${adStartTime.toFixed(2)}-${adEndTime.toFixed(2)}s`,
      );

      // 针对开头和结尾的特殊逻辑：无论任何条件，只要点击就直接跳转
      if (type === "intro" || type === "outro") {
        const targetTime =
          type === "intro" ? adEndTime : videoPlayer.duration - 0.1;

        adskipUtils.logDebug(
          `[手动跳过] 类型:${type === "intro" ? "开头" : "结尾"}, 执行跳转 -> ${targetTime.toFixed(2)}s`,
        );

        scriptInitiatedSeek = true;
        videoPlayer.currentTime = targetTime;

        // 更新最后跳过时间
        if (type === "intro") _lastSkipIntroTime = Date.now();
        if (type === "outro") _lastSkipOutroTime = Date.now();
        return;
      }

      // --- 以下是原有的广告点击跳过逻辑 ---
      // 记录时间缓存状态
      adskipUtils.logDebug(
        `时间缓存状态: 当前缓存时间=${lastKnownPlaybackTime.toFixed(2)}s, 上次更新=${Date.now() - lastPlaybackTimeUpdate}ms前`,
      );

      // 检查全局是否关闭了广告跳过
      chrome.storage.local.get("adskip_enabled", async function (result) {
        const globalSkipEnabled = result.adskip_enabled !== false;

        // 获取当前UP主信息
        const { uploader } = await adskipStorage.getCurrentVideoUploader();

        // 检查UP主是否在白名单中
        const isUploaderWhitelisted =
          await adskipStorage.checkUploaderInWhitelist(uploader);

        // 检查当前播放器时间 - 用于比较验证
        const currentVideoTime = videoPlayer.currentTime;

        // 检查是否在广告时间范围内
        const isInAdRange =
          currentPlaybackTime >= adStartTime && currentPlaybackTime < adEndTime;

        // 检查点击位置是否在当前播放进度之后
        const isClickAheadOfPlayback = clickTimePosition > currentPlaybackTime;

        // 记录详细的调试信息，同时记录实时播放器时间和缓存时间的差异
        adskipUtils.logDebug(
          `点击处理 - 缓存时间: ${currentPlaybackTime.toFixed(2)}s, 实时时间: ${currentVideoTime.toFixed(2)}s, 差异: ${(currentVideoTime - currentPlaybackTime).toFixed(2)}s, 广告范围: ${adStartTime.toFixed(2)}s-${adEndTime.toFixed(2)}s, 点击位置时间: ${clickTimePosition.toFixed(2)}s, UP主: ${uploader}, 白名单状态: ${isUploaderWhitelisted ? "是" : "否"}`,
        );

        // 满足条件时执行跳过：
        // 1. 全局跳过关闭或UP主在白名单中，且
        // 2. 当前播放位置在广告范围内，且
        // 3. 点击位置在当前播放进度之后
        if (
          (!globalSkipEnabled ||
            (globalSkipEnabled && isUploaderWhitelisted)) &&
          isInAdRange &&
          isClickAheadOfPlayback
        ) {
          adskipUtils.logDebug(
            `手动跳过广告: ${adStartTime.toFixed(2)}s-${adEndTime.toFixed(2)}s (点击位置: ${clickTimePosition.toFixed(2)}s)，跳转前时间: ${currentPlaybackTime.toFixed(2)}s`,
          );
          scriptInitiatedSeek = true;
          videoPlayer.currentTime = adEndTime;
        } else if (globalSkipEnabled && !isUploaderWhitelisted) {
          // 如果全局跳过功能开启且UP主不在白名单中，告知用户
          adskipUtils.logDebug("全局广告跳过已启用，无需手动跳过");
          // 可以在这里添加一个临时提示
        } else if (!isInAdRange) {
          // 如果不在广告范围内
          adskipUtils.logDebug(`当前不在广告范围内，不执行跳过`);
        } else if (!isClickAheadOfPlayback) {
          // 如果点击位置在当前播放进度之前
          adskipUtils.logDebug(
            `点击位置 (${clickTimePosition.toFixed(2)}s) 在当前播放进度 (${currentPlaybackTime.toFixed(2)}s) 之前，不执行跳过`,
          );
        }
      });
    });

    // 如果启用了百分比跳过，显示跳过区域（仅针对AI广告）
    if (adSkipPercentage > 0 && segment.type === "ad") {
      // 计算跳过区域
      const adDuration = segment.end - segment.start;
      const skipDuration = Math.max(1, (adDuration * adSkipPercentage) / 100);
      const skipEndPercent =
        (Math.min(segment.start + skipDuration, segment.end) / videoDuration) *
        100;
      const skipWidth = skipEndPercent - startPercent;

      // 创建跳过区域标记
      const skipMarker = document.createElement("div");
      skipMarker.className = "adskip-marker-skipped";
      skipMarker.style.left = `0`; // 相对于父元素（adskip-marker）定位
      skipMarker.style.width = `${(skipWidth / width) * 100}%`;
      marker.appendChild(skipMarker);
    }
  });

  // 增加节流控制，延长节流时间以减少重复日志
  adskipUtils.logDebug(`已标记 ${currentAdTimestamps.length} 个广告位点`, {
    throttle: 5000,
  });
}

/**
 * 设置广告标记监控 - 优化版：移除轮询，仅保留事件监听
 */
function setupAdMarkerMonitor() {
  // 清除旧监听器
  if (window.adMarkerInterval) {
    clearInterval(window.adMarkerInterval);
    window.adMarkerInterval = null;
  }

  // 移除轮询逻辑，仅设置视频事件监听
  function setupVideoEvents() {
    adskipUtils.logDebug(
      "PlaybackMonitor: 刷新播放器引用，来自 setupVideoEvents",
    );
    const videoPlayer = adskipUtils.findVideoPlayer();

    if (videoPlayer) {
      // 添加视频元数据加载事件
      if (!videoPlayer._adskipMetadataHandler) {
        videoPlayer._adskipMetadataHandler = function () {
          if (currentAdTimestamps && currentAdTimestamps.length > 0) {
            markAdPositionsOnProgressBar();
            adskipUtils.logDebug("视频元数据加载，更新广告标记");
          }
        };
        videoPlayer.addEventListener(
          "loadedmetadata",
          videoPlayer._adskipMetadataHandler,
        );
      }
    } else {
      // 如果找不到视频播放器，稍后再试
      setTimeout(setupVideoEvents, 1000);
    }
  }

  // 只有在有广告时间戳时才设置视频事件
  if (currentAdTimestamps && currentAdTimestamps.length > 0) {
    setupVideoEvents();
    adskipUtils.logDebug("已设置广告标记事件监听");
  }
}

/**
 * 监控URL变化
 */
function setupUrlChangeMonitor() {
  let lastUrl = window.location.href;
  // 记录上一次URL参数
  let lastBvid = new URLSearchParams(window.location.search).get("bvid") || "";
  let lastOid = new URLSearchParams(window.location.search).get("oid") || "";
  // 监控分P参数变化以触发重新检查
  let lastP = new URLSearchParams(window.location.search).get("p") || "1";

  // 每秒检查一次URL参数变化（特别是播放列表模式下的bvid和oid参数，以及分P参数）
  const paramCheckInterval = setInterval(function () {
    const currentParams = new URLSearchParams(window.location.search);
    const currentBvid = currentParams.get("bvid") || "";
    const currentOid = currentParams.get("oid") || "";
    const currentP = currentParams.get("p") || "1";

    // 检查播放列表参数或分P参数是否变化
    if (
      currentBvid !== lastBvid ||
      currentOid !== lastOid ||
      currentP !== lastP
    ) {
      adskipUtils.logDebug(
        `URL参数变化: bvid ${lastBvid}->${currentBvid}, oid ${lastOid}->${currentOid}, p ${lastP}->${currentP}`,
      );
      lastBvid = currentBvid;
      lastOid = currentOid;
      lastP = currentP;

      // 刷新当前视频ID
      checkForVideoChange();
    }
  }, 1000);

  // 页面卸载时清理资源
  window.addEventListener("unload", function () {
    if (paramCheckInterval) {
      clearInterval(paramCheckInterval);
    }
  });

  // 使用MutationObserver监视DOM变化可能表明URL变化
  const observer = new MutationObserver(function (mutations) {
    if (lastUrl !== window.location.href) {
      adskipUtils.logDebug(
        `URL变化检测到: ${lastUrl} -> ${window.location.href}`,
      );
      lastUrl = window.location.href;

      // 更新参数记录
      const currentParams = new URLSearchParams(window.location.search);
      lastBvid = currentParams.get("bvid") || "";
      lastOid = currentParams.get("oid") || "";
      lastP = currentParams.get("p") || "1";

      // 刷新当前视频ID
      const newVideoId = adskipUtils.getCurrentVideoId().id;
      adskipUtils.logDebug(
        `视频ID变化检测: [${currentVideoId}] -> [${newVideoId}]`,
      );

      if (
        newVideoId !== currentVideoId &&
        newVideoId !== "" &&
        currentVideoId !== ""
      ) {
        lastVideoId = currentVideoId;
        currentVideoId = newVideoId;
        reinitialize();
      }
    }
  });

  observer.observe(document, { subtree: true, childList: true });
  adskipUtils.logDebug("URL变化监视器已设置");

  // 设置直接监听popstate和hashchange事件
  window.addEventListener("popstate", function () {
    adskipUtils.logDebug("检测到popstate事件，可能是URL变化");
    checkForVideoChange();
  });

  window.addEventListener("hashchange", function () {
    adskipUtils.logDebug("检测到hashchange事件，可能是URL变化");
    checkForVideoChange();
  });
}

/**
 * 检查视频是否变化
 */
function checkForVideoChange() {
  const newVideoId = adskipUtils.getCurrentVideoId().id; // 直接使用字符串模式

  adskipUtils.logDebug(
    `检测视频变化: 当前=[${currentVideoId}], 新=[${newVideoId}]`,
  );

  // 检查视频ID是否变化
  if (
    newVideoId !== currentVideoId &&
    newVideoId !== "" &&
    currentVideoId !== ""
  ) {
    adskipUtils.logDebug(
      `视频ID变化检测 (event): ${currentVideoId} -> ${newVideoId}`,
    );
    lastVideoId = currentVideoId;
    currentVideoId = newVideoId;
    reinitialize();
  }
}

/**
 * 重新初始化
 */
async function reinitialize() {
  adskipUtils.logDebug(`重新初始化，当前视频ID: ${currentVideoId}`);

  // 清空当前广告时间戳
  currentAdTimestamps = [];

  // 重置15秒已读标记兜底判断
  _hasMarkedReadForCurrentVideo = false;

  // 重置计时器
  if (window.adSkipCheckInterval) {
    clearInterval(window.adSkipCheckInterval);
    window.adSkipCheckInterval = null;
  }

  // 清除UP主信息缓存 - 无论任何情况都需要
  adskipStorage.clearUploaderCache();

  // 重置监测器状态，确保切视频后（即使同UP主）也能刷新UI和配置
  _monitorLastUploader = null;
  _currentSkipConfig = null;

  // 刷新播放器引用 - 无论任何情况都需要
  adskipUtils.logDebug("强制刷新播放器引用");
  const videoPlayer = adskipUtils.findVideoPlayer();
  adskipUtils.logDebug(videoPlayer ? "成功找到播放器" : "未找到播放器");

  // 更新面板中的信息（如果面板已打开）- 无论任何情况都需要
  updatePanelInfo();

  // 重置跳过开头/结尾状态
  resetSkipIntroOutroState();

  // 重新解析URL中的广告跳过参数
  const currentUrlAdTimestamps = adskipUtils.parseAdSkipParam();

  // 使用集中处理函数处理视频状态
  if (typeof adskipAdDetection !== "undefined" && currentVideoId) {
    const statusResult = await adskipAdDetection.processVideoAdStatus(
      currentVideoId,
      currentUrlAdTimestamps,
      false,
    );

    // 更新全局状态
    urlAdTimestamps = statusResult.urlAdTimestamps;
    currentAdTimestamps = statusResult.currentAdTimestamps;

    // 根据时间戳状态设置广告跳过监控 - 仅当有广告时间戳时
    if (currentAdTimestamps.length > 0) {
      setupAdSkipMonitor(currentAdTimestamps);
    }

    // 确保启动播放时间监控（用于处理超过15s的自动已读标记等逻辑）
    // 这一步必须无视是否存在对应广告轴独立执行
    setupPlaybackTimeMonitor();
  }
}

/**
 * 更新面板信息
 */
function updatePanelInfo() {
  const inputElement = document.getElementById("adskip-input");
  if (inputElement) {
    inputElement.value = adskipUtils.timestampsToString(currentAdTimestamps);

    // 更新视频ID显示
    const videoIdElement = document.querySelector(".adskip-video-id");
    if (videoIdElement) {
      videoIdElement.textContent = `当前视频: ${currentVideoId || "未识别"}`;
    }
  }
}

// 添加存储变更监听器
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace !== "local") return;

  // 监听广告跳过功能开关变化
  if (changes.adskip_enabled !== undefined) {
    const isEnabled = changes.adskip_enabled.newValue !== false;
    adskipUtils.logDebug(
      `广告跳过功能状态已更新: ${isEnabled ? "启用" : "禁用"}`,
    );

    // 如果禁用，清除当前的监控
    if (!isEnabled && window.adSkipCheckInterval) {
      clearInterval(window.adSkipCheckInterval);
      window.adSkipCheckInterval = null;
    } else if (isEnabled && currentAdTimestamps.length > 0) {
      // 重新启用监控
      setupAdSkipMonitor(currentAdTimestamps);
    }
  }

  // 监听调试模式变化
  if (changes.adskip_debug_mode !== undefined) {
    const newDebugMode = changes.adskip_debug_mode.newValue || false;
    window.adskipStorage.setDebugMode(newDebugMode);
    adskipUtils.logDebug(
      `调试模式状态已更新: ${newDebugMode ? "启用" : "禁用"}`,
    );
  }

  // 监听广告跳过百分比变化
  if (changes.adskip_percentage !== undefined) {
    adSkipPercentage = changes.adskip_percentage.newValue;
    adskipUtils.logDebug(`广告跳过百分比已更新: ${adSkipPercentage}%`);

    // 如果已启用自动跳过且有广告时间段，重新应用设置
    chrome.storage.local.get("adskip_enabled", function (result) {
      if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
        setupAdSkipMonitor(currentAdTimestamps);
      }
    });
  }

  // 监听白名单变化
  if (changes.adskip_uploader_whitelist !== undefined) {
    adskipUtils.logDebug("白名单已更新，重新检查当前视频UP主状态");

    // 重新检查当前视频UP主是否在白名单中
    (async function () {
      const { uploader } = await adskipStorage.getCurrentVideoUploader();
      const isUploaderWhitelisted =
        await adskipStorage.checkUploaderInWhitelist(uploader);
      adskipUtils.logDebug(
        `白名单更新后检查: UP主 "${uploader}" 白名单状态: ${isUploaderWhitelisted ? "在白名单中" : "不在白名单中"}`,
      );

      // 更新已打开面板中的UI元素（如果面板已打开）
      const panel = document.getElementById("adskip-panel");
      if (panel) {
        // 更新开关状态
        const whitelistToggle = document.getElementById(
          "adskip-whitelist-toggle",
        );
        if (whitelistToggle) {
          whitelistToggle.checked = isUploaderWhitelisted;
        }

        // 更新模式描述
        chrome.storage.local.get("adskip_enabled", function (result) {
          const globalSkipEnabled = result.adskip_enabled !== false;
          const toggleDesc = document.querySelector(".adskip-toggle-desc");

          if (toggleDesc) {
            if (!globalSkipEnabled) {
              toggleDesc.textContent = "⏸️ 手动模式，可以点击广告区域手动跳过";
            } else if (isUploaderWhitelisted) {
              toggleDesc.textContent = "🔹 白名单已启用，仅手动跳过";
            } else {
              toggleDesc.textContent = "✅ 自动跳过已启用";
            }
          }
        });

        // 使用统一的状态显示函数，传递正确的参数顺序
        if (typeof adskipUI !== "undefined" && adskipUI.updateStatusDisplay) {
          adskipUI.updateStatusDisplay("白名单状态已更新", "info");
        }
      }
    })();
  }

  // 监听跳过开头/结尾设置变化，重新绘制进度条
  const skipSettingsKeys = [
    adskipStorage.KEYS.SKIP_INTRO_ENABLED,
    adskipStorage.KEYS.SKIP_INTRO_DURATION,
    adskipStorage.KEYS.SKIP_OUTRO_ENABLED,
    adskipStorage.KEYS.SKIP_OUTRO_DURATION,
    adskipStorage.KEYS.SKIP_INTRO_OUTRO_UPLOADER_LIST,
  ];

  if (Object.keys(changes).some((key) => skipSettingsKeys.includes(key))) {
    adskipUtils.logDebug("跳过开头/结尾设置已更新，刷新进度条标记", {
      throttle: 1000,
    });

    // 强制重置配置缓存，以便下次循环读取新配置
    _currentSkipConfig = null;

    // 延迟一点以确保数据已完全同步
    setTimeout(markAdPositionsOnProgressBar, 100);
  }
});

// ==================== 独立的跳过开头/结尾监控器 ====================

// 全局变量：跳过开头/结尾监控器状态
let _skipIntroOutroMonitorInterval = null;
let _lastSkipIntroTime = 0; // 防止重复跳过
let _lastSkipOutroTime = 0; // 防止重复跳过

// 缓存当前的跳过配置，避免每500ms读取一次Storage
let _currentSkipConfig = null;
let _monitorLastUploader = null;

/**
 * 获取完整的跳过配置（合并UP主特定设置和全局默认）
 */
async function fetchFullSkipConfig(uploader) {
  if (!uploader || uploader === "未知UP主") return null;

  const uploaderSettings =
    await adskipStorage.getUploaderSkipSettings(uploader);
  const isInSkipList = uploaderSettings && uploaderSettings.enabled !== false;

  if (!isInSkipList) return null;

  // 并行获取全局默认值，以备 fallback
  const [gIntroDuration, gOutroDuration] = await Promise.all([
    adskipStorage.getSkipIntroDuration(),
    adskipStorage.getSkipOutroDuration(),
  ]);

  return {
    skipIntro:
      uploaderSettings.skipIntro !== undefined
        ? uploaderSettings.skipIntro
        : true,
    introDuration:
      uploaderSettings.introDuration !== undefined
        ? uploaderSettings.introDuration
        : gIntroDuration,
    skipOutro:
      uploaderSettings.skipOutro !== undefined
        ? uploaderSettings.skipOutro
        : true,
    outroDuration:
      uploaderSettings.outroDuration !== undefined
        ? uploaderSettings.outroDuration
        : gOutroDuration,
  };
}

/**
 * 设置独立的跳过开头/结尾监控器
 * 不依赖AI广告检测，页面加载即运行
 */
function setupSkipIntroOutroMonitor() {
  adskipUtils.logDebug("[跳过开头/结尾] 初始化监控器...");

  if (window.skipIntroOutroInterval) {
    clearInterval(window.skipIntroOutroInterval);
  }

  // 重置状态
  _monitorLastUploader = null;

  window.skipIntroOutroInterval = setInterval(async () => {
    // 1. 获取播放器
    const videoPlayer = document.querySelector("video");
    if (!videoPlayer || videoPlayer.paused) return;

    const currentTime = videoPlayer.currentTime;
    const videoDuration = videoPlayer.duration;

    if (!videoDuration || isNaN(videoDuration)) return;

    // 2. 获取当前UP主（带缓存）
    const { uploader } = await adskipStorage.getCurrentVideoUploader();

    // 3. 检测UP主变化或配置需刷新
    // 如果UP主变了，或者还没有配置缓存（且UP主有效），则更新配置
    if (uploader && uploader !== "未知UP主") {
      if (uploader !== _monitorLastUploader) {
        adskipUtils.logDebug(
          `[跳过开头/结尾] 检测到UP主变化: ${_monitorLastUploader} -> ${uploader}`,
        );
        _monitorLastUploader = uploader;
        _currentSkipConfig = await fetchFullSkipConfig(uploader);
        // 刷新进度条标记
        setTimeout(markAdPositionsOnProgressBar, 100);
      } else if (_currentSkipConfig === null) {
        // 可能是之前获取失败，重试
        _currentSkipConfig = await fetchFullSkipConfig(uploader);
      }
    }

    // 4. 检查是否在跳过状态中（避免频繁触发）
    const now = Date.now();
    if (now - _lastSkipIntroTime < 5000 || now - _lastSkipOutroTime < 5000) {
      return;
    }

    // 5. 执行检查（传入缓存的配置）
    if (_currentSkipConfig) {
      checkAndSkipIntroOutro(
        videoPlayer,
        currentTime,
        videoDuration,
        uploader,
        _currentSkipConfig,
      );
    }
  }, 500); // 500ms检查一次，现在因为无IO阻塞，非常高效

  adskipUtils.logDebug("[跳过开头/结尾] 监控器已启动");
}

/**
 * 检查并执行跳过开头/结尾
 * 独立的检查逻辑，不依赖于广告检测结果
 * @param {HTMLVideoElement} videoPlayer 视频元素
 * @param {number} currentTime 当前时间
 * @param {number} videoDuration 视频总时长
 * @param {string} uploaderArg UP主名称
 * @param {Object} configArg 预加载的配置对象
 */
async function checkAndSkipIntroOutro(
  videoPlayer,
  currentTime,
  videoDuration,
  uploaderArg,
  configArg,
) {
  if (!isExtensionContextValid()) return;

  // 参数回退处理（兼容性）
  if (!videoPlayer) {
    videoPlayer = adskipUtils.findVideoPlayer();
    if (!videoPlayer || videoPlayer.paused || videoPlayer.ended) return;
    currentTime = videoPlayer.currentTime;
    videoDuration = videoPlayer.duration;
  }

  // 如果没有传入配置，尝试获取（低效路径）
  let config = configArg;
  let uploader = uploaderArg;

  if (!config) {
    if (!uploader) {
      try {
        const info = await adskipStorage.getCurrentVideoUploader();
        uploader = info.uploader;
      } catch (e) {
        return;
      }
    }
    config = await fetchFullSkipConfig(uploader);
  }

  if (!config) return;

  // 确保视频时长有效
  if (!videoDuration || videoDuration <= 0 || isNaN(videoDuration)) {
    return;
  }

  // 跳过开头逻辑
  if (config.skipIntro && config.introDuration > 0) {
    const maxIntroDuration = Math.min(config.introDuration, videoDuration / 3);

    // 只要小于跳过时长，且大于0.1s就跳
    if (currentTime < maxIntroDuration && currentTime >= 0.1) {
      const nowTime = Date.now();
      if (nowTime - _lastSkipIntroTime > 2000) {
        adskipUtils.logDebug(
          `[跳过开头/结尾] UP主"${uploader}"在列表中，跳过开头 ${maxIntroDuration} 秒`,
        );
        scriptInitiatedSeek = true;
        videoPlayer.currentTime = maxIntroDuration;
        _lastSkipIntroTime = nowTime;
      }
    }
  }

  // 跳过结尾逻辑
  if (config.skipOutro && config.outroDuration > 0) {
    const maxOutroDuration = Math.min(config.outroDuration, videoDuration / 3);
    const outroStartTime = videoDuration - maxOutroDuration;

    if (currentTime >= outroStartTime && currentTime < videoDuration - 0.5) {
      const nowTime = Date.now();
      if (nowTime - _lastSkipOutroTime > 2000) {
        adskipUtils.logDebug(
          `[跳过开头/结尾] UP主"${uploader}"在列表中，跳过结尾 ${maxOutroDuration} 秒`,
        );
        scriptInitiatedSeek = true;
        videoPlayer.currentTime = videoDuration - 0.1;
        _lastSkipOutroTime = nowTime;
      }
    }
  }
}

/**
 * 重置跳过开头/结尾状态（视频切换时调用）
 */
function resetSkipIntroOutroState() {
  _lastSkipIntroTime = 0;
  _lastSkipOutroTime = 0;
  adskipUtils.logDebug("[跳过开头/结尾] 已重置跳过状态");
}

// 导出模块函数
window.adskipVideoMonitor = {
  setupAdSkipMonitor,
  checkAndSkip,
  markAdPositionsOnProgressBar,
  setupAdMarkerMonitor,
  setupUrlChangeMonitor,
  checkForVideoChange,
  reinitialize,
  getCurrentRealPlaybackTime,
  setupPlaybackTimeMonitor,
  // 新增：跳过开头/结尾相关函数
  setupSkipIntroOutroMonitor,
  checkAndSkipIntroOutro,
  resetSkipIntroOutroState,
};
