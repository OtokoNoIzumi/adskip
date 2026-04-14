/**
 * adDetection.js - 广告检测模块
 * 实现基于字幕的广告检测和处理功能
 */

"use strict";

// 视频状态定义
const VIDEO_STATUS = {
  NO_SUBTITLE: 0, // 当前视频没字幕信息，无法识别广告
  NO_ADS: 1, // 当前视频有字幕信息，且服务器有记录，没有广告信息
  HAS_ADS: 2, // 当前视频有字幕信息，且服务器有记录，有广告区间
  UNDETECTED: 3, // 当前视频有字幕信息，且服务器没有记录
  DETECTING: 4, // 当前视频有字幕信息，且在请求服务器处理识别广告区间中
  PREPARE: 5, // 准备状态，等待自动检测或用户操作
  QUOTA_EXHAUSTED: 6, // 次数耗尽状态，需要等待次日重置
};

// 全局变量
window.adskipAdDetection = window.adskipAdDetection || {};
let autoDetectTimerId = null; // 用于存储自动检测的setTimeout ID
const forcedSubtitleCache = new Map(); // 强制转录结果缓存，按视频ID存储

/**
 * 获取视频字幕数据
 * 整合来自adskipSubtitleService的视频信息和字幕数据
 * @param {boolean} forceRefresh 是否强制刷新缓存
 * @returns {Promise<Object>} 完整的keyParams对象，包含视频元数据和字幕内容
 */
async function getVideoSubtitleData(forceRefresh = false) {
  try {
    adskipUtils.logDebug(
      "[AdSkip广告检测] 开始获取视频字幕数据...",
      {},
      { throttle: 5000 },
    );

    // 获取当前视频信息
    const videoData = await adskipSubtitleService.getVideoData(forceRefresh);
    if (!videoData || !videoData.bvid) {
      throw new Error("无法获取视频信息");
    }

    // 获取字幕信息
    const subtitleInfo = await adskipSubtitleService.getVideoSubtitles();
    const subtitlePreview = await adskipSubtitleService.getSubtitlePreview();

    const previewSubtitles = Array.isArray(subtitlePreview.rawSubtitleOriginal)
      ? subtitlePreview.rawSubtitleOriginal
      : Array.isArray(subtitlePreview.rawFullSubtitle?.subtitles)
        ? subtitlePreview.rawFullSubtitle.subtitles
        : [];

    // 准备重要参数信息对象 - 使用与adminPanel兼容的字段名
    const keyParams = {
      bvid: videoData.bvid || "",
      aid: videoData.aid || "",
      cid: videoData.cid || "",
      title: videoData.title || "",
      owner: videoData.owner || { name: "", mid: "" },
      mid: videoData.owner?.mid || "",
      desc: videoData.desc || "",
      dynamic: videoData.dynamic || "",
      duration: videoData.duration || 0,
      pages: videoData.pages || [],
      pubdate: videoData.pubdate || 0,
      dimension: videoData.dimension,
      subtitle: videoData.subtitle || {},
      hasSubtitle:
        (subtitleInfo.hasSubtitleFeature &&
          subtitleInfo.subtitles.length > 0) ||
        previewSubtitles.length > 0,
      epid: videoData.epid ? "ep" + videoData.epid : "",
    };

    // 添加字幕完整内容（如果有）
    if (keyParams.hasSubtitle) {
      try {
        // 找到默认字幕或第一个字幕
        const firstSubtitle =
          subtitleInfo.subtitles.find((sub) => sub.isDefault) ||
          subtitleInfo.subtitles[0];
        if (firstSubtitle) {
          // 使用已经处理过的字幕数据
          let subtitles = null;

          // 检查是否已经有预处理好的字幕内容
          if (
            subtitlePreview.rawSubtitleOriginal &&
            Array.isArray(subtitlePreview.rawSubtitleOriginal)
          ) {
            adskipUtils.logDebug("[AdSkip广告检测] 使用已有的处理后字幕内容");
            subtitles = subtitlePreview.rawSubtitleOriginal;
          }
          // 如果有完整的字幕处理结果
          else if (
            subtitlePreview.rawFullSubtitle &&
            subtitlePreview.rawFullSubtitle.subtitles
          ) {
            adskipUtils.logDebug("[AdSkip广告检测] 使用完整字幕处理结果");
            subtitles = subtitlePreview.rawFullSubtitle.subtitles;
          }
          // 如果需要重新获取字幕（极少情况）
          else if (!subtitles && firstSubtitle.url) {
            adskipUtils.logDebug(
              "[AdSkip广告检测] 需要重新获取字幕内容:",
              firstSubtitle.url,
            );
            const processedSubtitle =
              await adskipSubtitleService.downloadSubtitleFile(
                firstSubtitle.url,
              );
            if (processedSubtitle && processedSubtitle.subtitles) {
              subtitles = processedSubtitle.subtitles;
            }
          }

          // 保存字幕内容到keyParams，使用与adminPanel兼容的字段名
          if (subtitles && subtitles.length > 0) {
            keyParams.subtitle_contents = [subtitles];
            adskipUtils.logDebug(
              `[AdSkip广告检测] 成功获取${subtitles.length}条字幕内容`,
            );
          } else {
            keyParams.hasSubtitle = false;
            adskipUtils.logDebug("[AdSkip广告检测] 未获取到字幕内容");
          }
        } else if (previewSubtitles.length > 0) {
          keyParams.subtitle_contents = [previewSubtitles];
          adskipUtils.logDebug(
            `[AdSkip广告检测] 使用预览字幕兜底: ${previewSubtitles.length}条`,
          );
        }
      } catch (e) {
        keyParams.hasSubtitle = false;
        adskipUtils.logDebug("[AdSkip广告检测] 获取字幕内容失败:", e);
      }
    }

    const cacheKey = keyParams.bvid || keyParams.epid || "";
    let forcedSubtitles = forcedSubtitleCache.get(cacheKey);

    // 尝试从持久化存储中读取
    if (
      !forcedSubtitles &&
      cacheKey &&
      typeof adskipStorage !== "undefined" &&
      typeof adskipStorage.loadForcedTranscribedSubtitles === "function"
    ) {
      const storedSubtitles =
        await adskipStorage.loadForcedTranscribedSubtitles(cacheKey);
      if (storedSubtitles && storedSubtitles.length > 0) {
        forcedSubtitles = storedSubtitles;
        forcedSubtitleCache.set(cacheKey, forcedSubtitles); // 写回内存
      }
    }

    // 只要有强制转录字幕，就优先替代本地字幕来源
    if (forcedSubtitles && forcedSubtitles.length > 0) {
      keyParams.hasSubtitle = true;
      keyParams.subtitle_contents = [forcedSubtitles];
      keyParams.subtitle_source = "forced_transcribed";
      adskipUtils.logDebug(
        `[AdSkip广告检测] 优先使用强制转录字幕: ${forcedSubtitles.length}条`,
        {},
        { throttle: 5000 },
      );
    }

    adskipUtils.logDebug(
      "[AdSkip广告检测] 字幕数据获取完成:",
      {
        bvid: keyParams.bvid,
        epid: keyParams.epid,
        title: keyParams.title,
        hasSubtitle: keyParams.hasSubtitle,
        subtitlesCount: keyParams.subtitle_contents
          ? keyParams.subtitle_contents[0].length
          : 0,
      },
      { throttle: 5000 },
    );

    return keyParams;
  } catch (error) {
    adskipUtils.logDebug("[AdSkip广告检测] 获取视频字幕数据失败:", error);
    return {
      hasSubtitle: false,
      error: error.message,
    };
  }
}

/**
 * 创建广告跳过按钮
 * @returns {HTMLElement} 创建的按钮元素
 */
function createAdSkipButton() {
  // 检查是否已存在
  let adskipButton = document.getElementById("adskip-button");
  if (adskipButton) {
    return adskipButton;
  }

  // 创建按钮
  adskipButton = document.createElement("div");
  adskipButton.id = "adskip-button";
  adskipButton.className = "adskip-button undetected";
  adskipButton.innerHTML = "点击检测广告";

  // 添加到播放器容器 (这部分可能仍需外部协调，暂时保留)
  // 建议: 按钮的创建和添加到DOM应该分离，或者提供一个父元素参数
  const playerContainer =
    document.querySelector(".bpx-player-container") || document.body;
  playerContainer.appendChild(adskipButton);

  // 设置点击事件监听器
  setupManualDetectionTrigger(adskipButton);

  adskipUtils.logDebug("[AdSkip广告检测] 创建广告跳过按钮完成");
  return adskipButton;
}

/**
 * 更新视频状态和按钮显示
 * @param {number} status - 视频状态，使用VIDEO_STATUS枚举值
 * @param {Object} data - 可选的附加数据，如广告时间戳等
 * @param {string} reason - 更新原因，用于日志记录
 */
function updateVideoStatus(status, data = {}, reason = "未知原因") {
  const button = createAdSkipButton(); // 获取或创建按钮

  adskipUtils.logDebug(
    `[AdSkip广告检测] 更新按钮状态 -> ${Object.keys(VIDEO_STATUS).find((key) => VIDEO_STATUS[key] === status)}(${status}), 原因: ${reason}, 数据:`,
    data,
  );

  const mainpoint =
    typeof data.mainpoint === "string" ? data.mainpoint.trim() : "";
  if (mainpoint) {
    button.dataset.mainpoint = mainpoint;
  } else {
    delete button.dataset.mainpoint;
  }

  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
  if (keyPoints.length > 0) {
    button.dataset.keyPoints = JSON.stringify(keyPoints);
  } else {
    delete button.dataset.keyPoints;
  }

  // 移除所有状态类
  button.classList.remove(
    "no-subtitle",
    "no-ads",
    "has-ads",
    "undetected",
    "detecting",
    "prepare",
  );

  // 清除可能的动画类
  button.style.animation = "";

  // 设置新状态
  switch (status) {
    case VIDEO_STATUS.NO_SUBTITLE:
      button.classList.add("no-subtitle");
      button.innerHTML = "无字幕（点我转录）";
      break;

    case VIDEO_STATUS.NO_ADS:
      button.classList.add("no-ads");
      button.innerHTML = "没有广告";
      break;

    case VIDEO_STATUS.HAS_ADS:
      button.classList.add("has-ads");
      button.innerHTML = "已处理广告";
      // 保存广告时间戳数据
      if (data.adTimestamps) {
        button.dataset.adTimestamps = JSON.stringify(data.adTimestamps);
      } else {
        delete button.dataset.adTimestamps; // 清除旧数据
      }
      break;

    case VIDEO_STATUS.UNDETECTED:
      button.classList.add("undetected");
      button.innerHTML = "点击检测广告";
      delete button.dataset.adTimestamps; // 清除旧数据
      break;

    case VIDEO_STATUS.DETECTING:
      button.classList.add("detecting");
      button.innerHTML = "在检测啦！";
      // 应用动画
      button.style.animation = "adskip-pulse 1.5s infinite";
      delete button.dataset.adTimestamps; // 清除旧数据
      break;

    case VIDEO_STATUS.PREPARE:
      button.classList.add("prepare");
      button.innerHTML = "少女准备中...";
      delete button.dataset.adTimestamps; // 清除旧数据
      break;

    case VIDEO_STATUS.QUOTA_EXHAUSTED:
      button.classList.add("quota-exhausted");
      button.innerHTML = "今日次数已用完";
      delete button.dataset.adTimestamps; // 清除旧数据
      break;

    default:
      adskipUtils.logDebug(
        "[AdSkip广告检测] 未知状态，默认设为UNDETECTED:",
        status,
      );
      button.classList.add("undetected");
      button.innerHTML = "点击检测广告";
      delete button.dataset.adTimestamps; // 清除旧数据
  }

  // 存储当前状态
  button.dataset.status = status;

  if (typeof syncExceptionBadges === "function") {
    setTimeout(() => syncExceptionBadges(), 50);
  }

  return button;
}

/**
 * 处理视频的广告状态（核心逻辑）- 重构版
 * 优先级: URL > Storage > Whitelist > Prepare/Detect
 * @param {string} videoId - 当前视频ID
 * @param {object} urlAdSkipResult - 从URL参数解析的结果对象 {type: string, timestamps: Array}
 * @param {boolean} isInitialLoad - 是否为页面首次加载或视频切换后的首次处理
 * @returns {Promise<Object>} 处理结果，包含状态来源、最终状态等
 */
async function processVideoAdStatus(
  videoId,
  urlAdSkipResult,
  isInitialLoad = false,
) {
  adskipUtils.logDebug(
    `[AdSkip广告检测] 开始处理视频状态. VideoID: ${videoId}, isInitialLoad: ${isInitialLoad}, URL Result Type: ${urlAdSkipResult.type}`,
  );
  // adskipUtils.logDebug(`[AdSkip广告检测] 开始处理视频状态. VideoID: ${videoId}, isInitialLoad: ${isInitialLoad}, URL Params Count: ${urlAdSkipResult.timestamps.length}`);

  // 保守策略：如果是多P视频的非第1P，直接返回无广告状态
  if (adskipUtils.isMultiPartVideoNonFirstPart()) {
    adskipUtils.logDebug(
      `[AdSkip广告检测] 检测到多P视频非第1P，根据保守策略直接返回无广告状态`,
    );

    const noAdsResult = {
      source: "multi_part_conservative",
      status: VIDEO_STATUS.NO_ADS,
      skipDataProcessing: true,
      currentAdTimestamps: [],
      urlAdTimestamps: [],
      statusData: {},
      hasSubtitle: true, // 假设有字幕，避免影响其他逻辑
      duration: 0,
    };

    updateVideoStatus(VIDEO_STATUS.NO_ADS, {}, "多P视频非第1P（保守策略）");
    return noAdsResult;
  }

  // 1. 清理工作：清除上一个视频的自动检测定时器
  if (autoDetectTimerId) {
    clearTimeout(autoDetectTimerId);
    autoDetectTimerId = null;
    adskipUtils.logDebug("[AdSkip广告检测] 清除了上一个视频的自动检测定时器");
  }

  // 2. 初始化结果对象
  let statusResult = {
    source: "error",
    status: VIDEO_STATUS.UNDETECTED, // 默认错误或回退状态
    skipDataProcessing: true, // 默认跳过后续处理，除非明确需要
    currentAdTimestamps: [],
    urlAdTimestamps: [],
    statusData: {},
    hasSubtitle: false,
    duration: 0,
  };

  statusResult.urlAdTimestamps =
    urlAdSkipResult.type === "HAS_ADS" ? urlAdSkipResult.timestamps : [];

  try {
    // 4. 检查URL参数 (优先级 1，但在重新初始化时，应该忽略这个参数，直接获取缓存)
    if (isInitialLoad) {
      // 无论参数来自哪里，都可以视作一个检测结果，应该存入本地。
      if (
        urlAdSkipResult.type === "NO_ADS_CONFIRMED" ||
        urlAdSkipResult.type === "PARSE_ERROR"
      ) {
        if (urlAdSkipResult.type === "NO_ADS_CONFIRMED") {
          adskipUtils.logDebug(
            "[AdSkip广告检测] URL参数明确指定无广告 (adskip=NONE).",
          );
        } else {
          adskipUtils.logDebug(
            "[AdSkip广告检测] URL参数解析出错 (adskip参数格式错误或无效).",
          );
        }
        statusResult.status = VIDEO_STATUS.NO_ADS;
        statusResult.source =
          urlAdSkipResult.type === "NO_ADS_CONFIRMED"
            ? "url_no_ads"
            : "url_parse_error";
        statusResult.currentAdTimestamps = [];
        statusResult.statusData = {};
        updateVideoStatus(
          statusResult.status,
          statusResult.statusData,
          `Source: ${statusResult.source}`,
        );

        await adskipStorage.addVideoToNoAdsWhitelist(videoId);

        return statusResult;
      } else if (urlAdSkipResult.type === "HAS_ADS") {
        adskipUtils.logDebug("[AdSkip广告检测] 使用URL参数中的时间戳.");
        statusResult.status = VIDEO_STATUS.HAS_ADS;
        statusResult.source = "url";
        statusResult.currentAdTimestamps = urlAdSkipResult.timestamps;
        statusResult.statusData.adTimestamps = urlAdSkipResult.timestamps;
        updateVideoStatus(
          statusResult.status,
          statusResult.statusData,
          `Source: ${statusResult.source}`,
        );

        await adskipStorage.saveAdTimestampsForVideo(
          videoId,
          urlAdSkipResult.timestamps,
        );

        return statusResult;
      } else if (urlAdSkipResult.type === "NO_PARAM") {
        adskipUtils.logDebug(
          `[AdSkip广告检测] URL参数类型为 NO_PARAM，继续检查其他来源.`,
        );
        // 继续后续检查
      }
    }

    // 5. 获取视频基础数据（提前到主干，避免重复获取）
    let basicVideoInfo = null;
    try {
      basicVideoInfo = await adskipSubtitleService.getVideoData(false);
    } catch (error) {
      adskipUtils.logDebug("[AdSkip广告检测] 获取基础视频数据失败:", error);
    }

    // 6. 检查"不检测自己视频"设置 (优先级 2)
    const skipOwnVideosEnabled = await adskipStorage.getSkipOwnVideos();
    if (skipOwnVideosEnabled && basicVideoInfo) {
      adskipUtils.logDebug('[AdSkip广告检测] "不检测自己视频"功能已启用');

      try {
        // 获取用户信息（已有1分钟缓存）
        const userInfo = await adskipCredentialService.getBilibiliLoginStatus();

        // 检查是否为自己的视频
        if (
          basicVideoInfo.owner?.mid &&
          userInfo?.uid &&
          basicVideoInfo.owner.mid === userInfo.uid
        ) {
          adskipUtils.logDebug("[AdSkip广告检测] 检测到自己的视频，跳过检测");
          statusResult.status = VIDEO_STATUS.NO_ADS;
          statusResult.source = "own_video_skip";
          statusResult.currentAdTimestamps = [];
          statusResult.statusData = {};
          updateVideoStatus(
            statusResult.status,
            statusResult.statusData,
            "跳过自己的视频",
          );

          return statusResult;
        } else {
          adskipUtils.logDebug("[AdSkip广告检测] 视频检查完成，继续检测流程");
        }
      } catch (error) {
        adskipUtils.logDebug(
          "[AdSkip广告检测] 检查自己视频时出错，继续检测流程:",
          error,
        );
        // 出错时不影响后续检测流程
      }
    }

    // 7. 检查本地存储的广告时间戳 (优先级 3)
    let storedTimestamps = [];
    try {
      storedTimestamps = await adskipStorage.loadAdTimestampsForVideo(videoId);
    } catch (e) {
      adskipUtils.logDebug("[AdSkip广告检测] 检查时间戳数据时出错:", e);
    }

    if (storedTimestamps && storedTimestamps.length > 0) {
      adskipUtils.logDebug("[AdSkip广告检测] 从本地存储加载了广告时间戳.");
      statusResult.status = VIDEO_STATUS.HAS_ADS;
      statusResult.source = "storage";
      statusResult.currentAdTimestamps = storedTimestamps;
      statusResult.statusData.adTimestamps = storedTimestamps;
      // 同时加载缓存的 insight 数据
      const cachedInsight = await adskipStorage.loadVideoInsightData(videoId);
      if (cachedInsight.mainpoint || cachedInsight.keyPoints.length > 0) {
        statusResult.statusData.mainpoint = cachedInsight.mainpoint;
        statusResult.statusData.keyPoints = cachedInsight.keyPoints;
      }
      updateVideoStatus(
        statusResult.status,
        statusResult.statusData,
        `Source: ${statusResult.source}`,
      );
      return statusResult;
    }

    // 8. 检查本地储存的无广告白名单 (优先级 4)
    const isInWhitelist =
      await adskipStorage.checkVideoInNoAdsWhitelist(videoId);
    if (isInWhitelist) {
      adskipUtils.logDebug("[AdSkip广告检测] 视频在无广告白名单中.");
      statusResult.status = VIDEO_STATUS.NO_ADS;
      statusResult.source = "whitelist";
      // 同时加载缓存的 insight 数据
      const cachedInsight = await adskipStorage.loadVideoInsightData(videoId);
      if (cachedInsight.mainpoint || cachedInsight.keyPoints.length > 0) {
        statusResult.statusData.mainpoint = cachedInsight.mainpoint;
        statusResult.statusData.keyPoints = cachedInsight.keyPoints;
      }
      updateVideoStatus(
        statusResult.status,
        statusResult.statusData,
        `Source: ${statusResult.source}`,
      );
      return statusResult;
    }

    // 9. 检查是否为次数耗尽状态下请求失败的视频 (优先级 5)
    const isQuotaFailedVideo =
      await adskipStorage.checkVideoInQuotaFailedCache(videoId);
    if (isQuotaFailedVideo) {
      adskipUtils.logDebug(
        `[AdSkip广告检测] 视频 ${videoId} 在次数耗尽失败缓存中，直接显示耗尽状态`,
      );
      statusResult.source = "quota_failed_cache";
      statusResult.status = VIDEO_STATUS.QUOTA_EXHAUSTED;
      statusResult.statusData = {};
      updateVideoStatus(
        statusResult.status,
        statusResult.statusData,
        `Source: ${statusResult.source}`,
      );
      return statusResult;
    }

    // 10. 检查基于视频时长的快速过滤条件
    if (basicVideoInfo?.duration && basicVideoInfo.duration < 30) {
      adskipUtils.logDebug(
        `[AdSkip广告检测] 视频时长过短 (${basicVideoInfo.duration}s < 30s)，跳过检测`,
      );
      statusResult.status = VIDEO_STATUS.UNDETECTED;
      statusResult.source = "short_duration";
      statusResult.duration = basicVideoInfo.duration;
      updateVideoStatus(statusResult.status, {}, "视频时长过短，请手动检测");
      return statusResult;
    }

    // 11. 获取完整字幕数据：包含字幕信息
    const subtitleData = await getVideoSubtitleData(!isInitialLoad);

    // 判断bvid和videoId是否一致，或者videoId和epid是否一致（允许epid作为videoId的情况，不加'ep'前缀）
    // 支持多P视频ID匹配（格式：BV1234567890_p2）
    let isVideoIdMatch = false;
    if (subtitleData && subtitleData.bvid) {
      // 直接匹配BV ID
      if (subtitleData.bvid === videoId) {
        isVideoIdMatch = true;
      } else if (
        videoId.includes("_p") &&
        videoId.startsWith(subtitleData.bvid)
      ) {
        // 匹配多P格式：BV1234567890_p2
        isVideoIdMatch = true;
        adskipUtils.logDebug(
          `[AdSkip广告检测] 多P视频ID匹配成功: ${videoId} (基础BV: ${subtitleData.bvid})`,
        );
      }
    } else if (
      subtitleData &&
      subtitleData.epid &&
      videoId === subtitleData.epid
    ) {
      isVideoIdMatch = true;
    }

    if (
      !subtitleData ||
      (!subtitleData.bvid && !subtitleData.epid) ||
      !isVideoIdMatch
    ) {
      adskipUtils.logDebug(
        `[AdSkip广告检测] 获取字幕数据失败或视频已切换 (bvid: ${subtitleData?.bvid}, epid: ${subtitleData?.epid} vs videoId: ${videoId}). 中止处理.`,
      );
      // 视频已切换或数据错误，显示中性状态，避免误导
      updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "视频已切换或数据错误");
      return statusResult; // 返回默认错误结果
    }

    // 更新结果对象中的字幕信息
    statusResult.hasSubtitle = subtitleData.hasSubtitle;
    statusResult.duration =
      subtitleData.duration || basicVideoInfo?.duration || 0;

    // 12. 处理无字幕情况
    if (!statusResult.hasSubtitle) {
      adskipUtils.logDebug("[AdSkip广告检测] 视频无字幕信息.");
      statusResult.status = VIDEO_STATUS.NO_SUBTITLE;
      statusResult.source = "no_subtitle";
      // skipDataProcessing 保持 true
      updateVideoStatus(statusResult.status, {}, "无字幕");
      return statusResult;
    }

    // --- 到达此处: 视频有字幕，满足时长要求，但无URL参数、无存储记录、不在白名单中 ---
    // 13. 进入准备/自动检测阶段 (优先级 6)
    adskipUtils.logDebug("[AdSkip广告检测] 进入准备状态 (PREPARE).");
    updateVideoStatus(VIDEO_STATUS.PREPARE, {}, "进入准备状态");
    statusResult.status = VIDEO_STATUS.PREPARE;
    statusResult.source = "prepare";
    statusResult.skipDataProcessing = false; // 需要后续判断是否调度检测

    // 首先检查权限
    const hasAutoDetectPermission = true; // TODO: 替换为实际的权限检查逻辑

    if (!hasAutoDetectPermission) {
      // 没有权限，只能手动检测
      adskipUtils.logDebug(
        "[AdSkip广告检测] 用户无自动检测权限，切换到手动检测模式.",
      );
      statusResult.status = VIDEO_STATUS.UNDETECTED;
      statusResult.source = "no_permission";
      statusResult.skipDataProcessing = true; // 不再进行后续处理
      updateVideoStatus(statusResult.status, {}, "无权限，请手动检测");
      return statusResult;
    }

    // 时长检查已经在前面完成，这里直接准备自动检测
    adskipUtils.logDebug(`[AdSkip广告检测] 视频时长检查已通过，准备自动检测.`);
    statusResult.source = "prepare_scheduled"; // 更新来源

    autoDetectTimerId = setTimeout(async () => {
      adskipUtils.logDebug(
        "[AdSkip广告检测] 自动检测计时器触发，开始执行检测...",
      );
      autoDetectTimerId = null; // 清除 ID
      try {
        const currentVideoCheck = adskipUtils.getCurrentVideoId().id;
        // 再次确认视频未切换，支持bvid、epid和多P格式
        let isVideoIdStillMatch = false;
        if (currentVideoCheck === videoId) {
          isVideoIdStillMatch = true;
        } else {
          // videoId 可能是epid（不带ep前缀），currentVideoCheck可能是ep+数字
          // 允许epid和ep+epid互相匹配
          if (
            videoId &&
            currentVideoCheck &&
            ((videoId.startsWith("ep") &&
              currentVideoCheck === videoId.slice(2)) ||
              (currentVideoCheck.startsWith("ep") &&
                videoId === currentVideoCheck.slice(2)))
          ) {
            isVideoIdStillMatch = true;
          }
          // 支持多P视频检查：比较基础BV ID
          else if (videoId.includes("_p") && currentVideoCheck.includes("_p")) {
            const videoBaseBV = videoId.split("_p")[0];
            const currentBaseBV = currentVideoCheck.split("_p")[0];
            if (videoBaseBV === currentBaseBV) {
              // 基础BV相同但分P不同，说明切换了分P，不匹配
              adskipUtils.logDebug(
                `[AdSkip广告检测] 检测到分P切换: ${videoId} -> ${currentVideoCheck}`,
              );
            } else {
              // 不同的视频
              adskipUtils.logDebug(
                `[AdSkip广告检测] 检测到视频切换: ${videoId} -> ${currentVideoCheck}`,
              );
            }
          }
        }

        if (isVideoIdStillMatch) {
          // 获取最新数据
          const latestSubtitleData = await getVideoSubtitleData();
          if (
            latestSubtitleData.hasSubtitle &&
            (latestSubtitleData.bvid === videoId ||
              (latestSubtitleData.epid &&
                (videoId === latestSubtitleData.epid ||
                  (videoId.startsWith("ep") &&
                    latestSubtitleData.epid === videoId.slice(2)) ||
                  (latestSubtitleData.epid.startsWith("ep") &&
                    videoId === latestSubtitleData.epid.slice(2)))))
          ) {
            // 发送检测请求（内部会处理状态更新：DETECTING -> HAS_ADS/NO_ADS/UNDETECTED）
            await sendDetectionRequest(latestSubtitleData);
            adskipUtils.logDebug(
              "[AdSkip广告检测] 自动检测请求已发送 (或尝试发送).",
            );
          } else {
            adskipUtils.logDebug(
              "[AdSkip广告检测] 自动检测取消：执行前字幕信息丢失.",
            );
            if (isVideoIdStillMatch) {
              // 避免干扰新视频
              updateVideoStatus(
                VIDEO_STATUS.NO_SUBTITLE,
                {},
                "Subtitle lost before auto-detect",
              );
            }
          }
        } else {
          adskipUtils.logDebug(
            "[AdSkip广告检测] 自动检测取消：执行前视频已切换.",
          );
        }
      } catch (error) {
        adskipUtils.logDebug("[AdSkip广告检测] 自动检测执行失败:", error);
        const currentVideoCheck = adskipUtils.getCurrentVideoId().id;
        // 如果视频没变，恢复为可手动检测状态
        if (currentVideoCheck === videoId) {
          updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "自动检测失败");
        }
      }
    }, 10000); // 10秒延迟

    adskipUtils.logDebug(
      `[AdSkip广告检测] 已设置自动检测定时器 (ID: ${autoDetectTimerId}). 状态保持 PREPARE.`,
    );
    // 此时 statusResult.status 保持 PREPARE

    // 最终日志，反映函数返回前的状态
    const finalStatusKey =
      Object.keys(VIDEO_STATUS).find(
        (key) => VIDEO_STATUS[key] === statusResult.status,
      ) || "Unknown";
    adskipUtils.logDebug(
      `[AdSkip广告检测] 处理完成. 最终状态: ${finalStatusKey}(${statusResult.status}), 来源: ${statusResult.source}`,
    );
    return statusResult;
  } catch (error) {
    adskipUtils.logDebug("[AdSkip广告检测] 处理视频状态时发生严重错误:", error);
    // 发生严重错误时，尝试将按钮重置为中性状态
    try {
      updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "Processing error");
    } catch (updateError) {
      adskipUtils.logDebug(
        "[AdSkip广告检测] 发生严重错误后更新状态失败:",
        updateError,
      );
    }
    // 返回默认错误结果
    statusResult.status = VIDEO_STATUS.UNDETECTED;
    statusResult.source = "error";
    statusResult.skipDataProcessing = true;
    return statusResult;
  }
}

/**
 * 签名请求数据
 * @param {Object} data - 要签名的数据
 * @returns {Object} - 添加了签名的数据
 */
function signRequest(data) {
  // 添加时间戳
  data.timestamp = Date.now();

  // 创建用于签名的简化数据对象（只包含关键字段）
  const signatureData = {
    timestamp: data.timestamp,
    videoId: data.videoId,
    // 如果要添加其他小型关键字段用于签名，放在这里
    clientVersion: data.clientVersion,
  };

  // 准备要签名的字符串
  // 使用与Python的json.dumps(obj, sort_keys=True)完全一致的格式
  const sortedData = {};
  Object.keys(signatureData)
    .sort()
    .forEach((key) => {
      sortedData[key] = signatureData[key];
    });
  const dataString = JSON.stringify(sortedData);

  // 计算签名
  const SECRET_KEY = "adskip_plugin_2024_secure_key"; // 与服务器匹配
  const stringToEncode = dataString + SECRET_KEY;

  // 使用与Python base64.b64encode()兼容的编码方式
  const utf8Encoder = new TextEncoder();
  const utf8Bytes = utf8Encoder.encode(stringToEncode);
  const base64String = btoa(String.fromCharCode.apply(null, utf8Bytes));

  // 添加签名到原始数据
  data.signature = base64String;

  return data;
}

/**
 * 发送检测请求到服务端
 * @param {Object} subtitleData - 包含视频和字幕信息的数据对象
 * @returns {Promise<Object>} 广告检测结果
 */
async function sendDetectionRequest(subtitleData) {
  const videoId = subtitleData?.bvid;
  adskipUtils.logDebug(
    `[AdSkip广告检测] - 开始发送检测请求 for VideoID: ${videoId}`,
  );

  // 清除可能存在的自动检测定时器（如果手动触发时自动的还没执行）
  if (autoDetectTimerId) {
    clearTimeout(autoDetectTimerId);
    autoDetectTimerId = null;
    adskipUtils.logDebug("[AdSkip广告检测] - 清除了待执行的自动检测定时器");
  }

  // 更新按钮状态为检测中
  updateVideoStatus(VIDEO_STATUS.DETECTING, {}, "发送检测请求");

  try {
    // 获取用户信息
    let userInfo = null;
    if (typeof adskipCredentialService !== "undefined") {
      userInfo = await adskipCredentialService
        .getBilibiliLoginStatus()
        .catch((error) => {
          adskipUtils.logDebug("[AdSkip广告检测] 获取用户信息失败:", error);
          return null;
        });
    }
    adskipUtils.logDebug("[AdSkip广告检测] - 用户信息:", userInfo);
    // 准备请求数据
    const requestData = {
      videoId: videoId,
      title: subtitleData.title || "",
      uploader: subtitleData.owner?.name || "",
      mid: subtitleData.mid || "",
      duration: subtitleData.duration || 0,
      // subtitles: subtitleData.subtitle_contents[0] || [],
      autoDetect: true, // 非付费用户
      forceReanalyze: subtitleData.forceReanalyze === true,
      clientVersion: chrome.runtime.getManifest().version, // 从manifest获取客户端版本
      videoData: subtitleData, // 保留完整原始数据，对服务器端处理很重要
      user: userInfo
        ? {
            username: userInfo.username || "",
            uid: userInfo.uid || "",
            level: userInfo.level || 0,
            vipType: userInfo.vipType || 0,
            vipDueDate: userInfo.vipDueDate || 0,
          }
        : null,
    };

    const signedData = signRequest(requestData);

    // 动态获取API URL
    const apiUrls = await adskipStorage.getApiUrls();
    const apiUrl = apiUrls.detect;

    adskipUtils.logDebug("[AdSkip广告检测] - 使用API URL:", apiUrl);
    adskipUtils.logDebug("[AdSkip广告检测] - 发送请求，签名：", signedData);

    // --- 添加重试逻辑 ---
    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 1000; // 1秒
    let attempts = 0;
    let currentDelay = INITIAL_DELAY_MS;
    let response;
    let lastError;

    while (attempts < MAX_RETRIES) {
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(signedData),
        });

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          // 对于服务器错误，不进行重试，直接抛出
          throw new Error(`服务器响应错误 (${response.status}): ${errorText}`);
        }
        // 如果fetch成功且response.ok，则跳出重试循环
        break;
      } catch (error) {
        lastError = error;
        adskipUtils.logDebug(
          `[AdSkip广告检测] - fetch尝试 #${attempts + 1} 失败:`,
          error.message,
        );

        // 只对网络相关的错误 (TypeError: Failed to fetch) 进行重试
        // 其他如 response.ok === false 的错误由上面的 if (!response.ok) 抛出，不会进入这里重试
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError")
        ) {
          // 增加对 NetworkError 的判断，以兼容不同浏览器
          attempts++;
          if (attempts < MAX_RETRIES) {
            adskipUtils.logDebug(
              `[AdSkip广告检测] - 等待 ${currentDelay / 1000}秒 后重试...`,
            );
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= 2; // 指数退避
          } else {
            adskipUtils.logDebug(
              "[AdSkip广告检测] - 已达到最大重试次数，放弃请求。",
            );
            // 抛出最后一次的错误
            throw lastError;
          }
        } else {
          // 对于非预期的 fetch 错误 (非网络错误)，直接抛出，不重试
          throw error;
        }
      }
    }
    // --- 重试逻辑结束 ---

    const result = await response.json();
    adskipUtils.logDebug("[AdSkip广告检测] - 收到服务器响应JSON:", result);

    if (!result || typeof result.success !== "boolean") {
      throw new Error("服务器返回了无效的响应格式");
    }

    if (!result.success) {
      // 服务端明确告知失败，但不是网络或格式错误
      adskipUtils.logDebug(
        "[AdSkip广告检测] - 服务器返回失败消息:",
        result.message,
      );

      // 检查是否是次数耗尽错误
      if (
        result.message &&
        (result.message.includes("已达到每日分析限制") ||
          result.message.includes("Gemini权限不足") ||
          result.message.includes("已达限制"))
      ) {
        // 保存次数耗尽状态（使用统一的东八区日期函数）
        const today = adskipUtils.getTodayInEast8();

        await adskipStorage.saveQuotaExhaustedStatus(today);

        // 将视频添加到次数耗尽失败缓存
        await adskipStorage.addVideoToQuotaFailedCache(videoId);

        // 更新状态为次数耗尽
        updateVideoStatus(
          VIDEO_STATUS.QUOTA_EXHAUSTED,
          { quotaDate: today },
          `次数耗尽: ${result.message}`,
        );

        // 返回次数耗尽的结果，但不保存任何状态到白名单或广告记录
        return {
          success: false,
          hasAds: false,
          adTimestamps: [],
          message: result.message,
          quotaExhausted: true,
        };
      }

      // 根据服务器返回决定是否需要关闭免费体验 (未来实现)
      // if (result.disableTrial) { ... }

      // 更新状态为 UNDETECTED
      updateVideoStatus(
        VIDEO_STATUS.UNDETECTED,
        {},
        `检测失败: ${result.message || "未知原因"}`,
      );
      // 返回一个表示失败的结构，避免后续处理出错
      return {
        success: false,
        hasAds: false,
        adTimestamps: [],
        message: result.message || "检测失败",
      };
    }

    // --- 检测成功 ---
    const adTimestamps = result.adTimestamps || [];
    const mainpoint =
      typeof result.main_point === "string" ? result.main_point.trim() : "";
    const keyPoints = (
      Array.isArray(result.key_points) ? result.key_points : []
    )
      .map((item) => ({
        start_time: Number(item?.start_time ?? 0),
        point: String(item?.point ?? "").trim(),
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.start_time) && item.start_time >= 0 && item.point,
      )
      .slice(0, 3);
    // 基于实际时间戳数量判断是否有广告，而不是依赖后端的hasAds字段
    const newStatus =
      adTimestamps.length > 0 ? VIDEO_STATUS.HAS_ADS : VIDEO_STATUS.NO_ADS;

    // 更新按钮状态和数据
    updateVideoStatus(
      newStatus,
      {
        adTimestamps: adTimestamps,
        mainpoint: mainpoint,
        keyPoints: keyPoints,
      },
      "检测成功",
    );

    // 同步扣减缓存
    if (result.usage_deducted) {
      await adskipStorage
        .syncQuotaFromAPIResponse(result.usage_deducted)
        .catch((e) => {
          adskipUtils.logDebug("[AdSkip广告检测] - 同步扣减缓存失败:", e);
        });
    }

    // 保存时间戳或白名单到本地存储（使用包含分P信息的完整videoId）
    if (newStatus === VIDEO_STATUS.HAS_ADS) {
      await adskipStorage.saveAdTimestampsForVideo(videoId, adTimestamps);
      adskipUtils.logDebug("[AdSkip广告检测] - 已保存广告时间戳");
    } else {
      // 如果检测结果是无广告，加入白名单
      await adskipStorage.addVideoToNoAdsWhitelist(videoId);
      adskipUtils.logDebug("[AdSkip广告检测] - 已加入无广告白名单");
    }

    // 持久化 insight 数据（核心观点 + 关键段落），有广告和无广告的视频都保存
    await adskipStorage.saveVideoInsightData(videoId, {
      mainpoint: mainpoint,
      keyPoints: keyPoints,
    });

    // 无论检测到广告与否，都增加处理视频计数
    try {
      const newCount = await adskipStorage.incrementLocalVideosProcessedCount();
      adskipUtils.logDebug(
        `[AdSkip广告检测] - 本地处理视频计数已更新为 ${newCount}`,
      );
    } catch (countError) {
      adskipUtils.logDebug(
        "[AdSkip广告检测] - 更新本地处理视频计数失败:",
        countError,
      );
    }

    // 如果检测到广告，调用核心应用函数处理
    if (
      newStatus === VIDEO_STATUS.HAS_ADS &&
      typeof adskipCore !== "undefined" &&
      adskipCore.applyNewAdTimestamps
    ) {
      const convertedTimestamps = adTimestamps.map((ts) => ({
        start_time: ts.start,
        end_time: ts.end,
        ...ts, // 保留其他可能的字段
      }));
      adskipUtils.logDebug(
        "[AdSkip广告检测] - 检测到广告，调用核心应用函数处理",
        convertedTimestamps,
      );
      adskipCore.applyNewAdTimestamps(convertedTimestamps);
    }

    return result; // 返回原始成功结果
  } catch (error) {
    adskipUtils.logDebug("[AdSkip广告检测] - 检测请求失败:", error);
    // 请求失败时（网络错误、JSON解析错误等），尝试将状态恢复为UNDETECTED
    // 但要确保当前视频还是发送请求时的视频
    const currentVideoCheck = adskipUtils.getCurrentVideoId().id;
    if (currentVideoCheck === videoId) {
      updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "检测请求异常");
    }
    // 重新抛出错误以便API测试按钮能捕获
    throw error;
  }
}

function normalizeTranscribedSubtitles(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      const from = Number(item.from ?? item.start ?? item.start_time ?? 0);
      const content = String(item.content ?? item.text ?? "").trim();
      if (!content || Number.isNaN(from) || from < 0) {
        return null;
      }
      return { from, content };
    })
    .filter(Boolean);
}

async function reanalyzeCurrentVideo() {
  // 重新分析必须强制重新识别，不走缓存
  const result = await forceTranscribeForCurrentVideo({ forceReanalyze: true });
  if (!result?.success) {
    return { success: false, message: result?.message || "重新分析失败" };
  }
  return { success: true, message: "已完成重新听译并重新分析" };
}

/**
 * 为按钮设置手动触发检测的点击事件
 * @param {HTMLElement} button - 广告跳过按钮元素
 */
/**
 * 强制进行当前无字幕视频的音频提取与听译转录
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function forceTranscribeForCurrentVideo(options = {}) {
  adskipUtils.logDebug("[AdSkip广告检测] 开始执行音频转录请求...");
  const button = document.getElementById("adskip-button");
  if (!button) return { success: false, message: "无可操作按钮" };
  const forceReanalyze = options?.forceReanalyze === true;

  try {
    const quota = await adskipStorage.getQuotaEntitlement(
      "audio_subtitle",
      true,
    );
    if (!quota.allowed) {
      return { success: false, message: quota.message || "今日听译次数已用完" };
    }

    // 先获取一次视频基础信息和权限
    const videoData = await adskipSubtitleService.getVideoData(false);
    if (!videoData || !videoData.bvid || !videoData.cid) {
      throw new Error("无法获取视频标识");
    }

    // 修改UI状态为获取音频链接
    button.innerHTML = "正在获取音频流...";

    // 1. 获取带有鉴权的 B站 dash 音频源
    const playUrlRes = await fetch(
      `https://api.bilibili.com/x/player/playurl?fnval=16&bvid=${videoData.bvid}&cid=${videoData.cid}`,
    );
    const playUrlJson = await playUrlRes.json();
    let dashAudioUrl = "";

    if (
      playUrlJson.code === 0 &&
      playUrlJson.data &&
      playUrlJson.data.dash &&
      playUrlJson.data.dash.audio
    ) {
      dashAudioUrl = playUrlJson.data.dash.audio[0].baseUrl;
      adskipUtils.logDebug(
        `[AdSkip广告检测] 成功获取dash音频直链:${dashAudioUrl}`,
      );
    } else {
      throw new Error("无法从B站接口解析出音频源");
    }

    button.innerHTML = "正在下载音频...";

    // 2. 将音频内容下载至缓存在本地内存的Blob对象
    const audioRes = await fetch(dashAudioUrl);
    if (!audioRes.ok)
      throw new Error(`音频流下载失败: HTTP ${audioRes.status}`);
    const audioBlob = await audioRes.blob();

    button.innerHTML = "正在提交听译(需较长时间)...";

    // 3. 构建表单发送到后端 - 严格匹配后端参数: audioFile, videoId, uid, forceTranscribe
    const formData = new FormData();
    formData.append("audioFile", audioBlob, "audio.m4s");
    formData.append("videoId", videoData.bvid || "");
    formData.append("forceTranscribe", String(forceReanalyze));

    let userInfo = null;
    if (typeof adskipCredentialService !== "undefined") {
      userInfo = await adskipCredentialService
        .getBilibiliLoginStatus()
        .catch(() => null);
    }
    if (userInfo && userInfo.uid) {
      formData.append("uid", String(userInfo.uid));
    }

    const apiUrls = await adskipStorage.getApiUrls();
    const transcribeRequest = await fetch(apiUrls.transcribe, {
      method: "POST",
      // 注意不要手动设置 Content-Type，让浏览器自动设置 boundary
      body: formData,
    });

    const resultText = await transcribeRequest.text();
    let transcribeResult;
    try {
      transcribeResult = JSON.parse(resultText);
    } catch (e) {
      throw new Error(
        `服务器响应错误 (${transcribeRequest.status}): ` +
          resultText.substring(0, 50),
      );
    }

    if (!transcribeResult.success) {
      throw new Error(transcribeResult.message || "转录过程发生错误");
    }

    // 同步听译配额扣减
    if (transcribeResult.usage_deducted) {
      await adskipStorage
        .syncQuotaFromAPIResponse(transcribeResult.usage_deducted)
        .catch((e) => {
          adskipUtils.logDebug("[AdSkip广告检测] - 同步听译扣减失败:", e);
        });
    }

    const normalizedSubtitles = normalizeTranscribedSubtitles(
      transcribeResult.subtitles || transcribeResult.subtitle_contents || [],
    );
    if (normalizedSubtitles.length > 0) {
      adskipUtils.logDebug(
        `[AdSkip广告检测] ASR听译成功，共返回 ${normalizedSubtitles.length} 条字幕轴`,
      );
      // 将获得的字幕强塞进缓存以支撑接下来的常规检测
      forcedSubtitleCache.set(
        videoData.bvid || videoData.epid,
        normalizedSubtitles,
      );

      // 同时持久化到本地存储
      if (typeof adskipStorage.saveForcedTranscribedSubtitles === "function") {
        await adskipStorage.saveForcedTranscribedSubtitles(
          videoData.bvid || videoData.epid,
          normalizedSubtitles,
        );
      }

      button.innerHTML = "录入成功，开始检测...";
      // 用最新听译字幕直接驱动检测；重新分析场景强制绕过缓存
      const subtitleData = await getVideoSubtitleData(true);
      const mergedSubtitleData = {
        ...subtitleData,
        bvid: videoData.bvid || subtitleData?.bvid,
        hasSubtitle: true,
        subtitle_contents: [normalizedSubtitles],
        forceReanalyze,
      };
      await sendDetectionRequest(mergedSubtitleData);
      return { success: true, message: "转录成功并已启动重检测" };
    } else {
      throw new Error("服务端返回了成功状态但并未包含有效的字幕内容");
    }
  } catch (e) {
    adskipUtils.logDebug("[AdSkip广告检测] 强制提取过程错误:", e);
    return { success: false, message: e.message || "操作失败" };
  } finally {
    // 恢复状态的逻辑由后续 sendDetectionRequest 控制，如果失败我们重置
    if (button && button.innerHTML.includes("...")) {
      updateVideoStatus(VIDEO_STATUS.NO_SUBTITLE, {}, "恢复原样");
    }
  }
}

function setupManualDetectionTrigger(button) {
  if (!button) return;

  button.addEventListener("click", async function () {
    const videoId = adskipUtils.getCurrentVideoId().id;
    adskipUtils.logDebug(
      `[AdSkip广告检测] - 按钮被点击 for VideoID: ${videoId}`,
    );

    // 获取当前按钮状态
    const currentStatus = parseInt(
      button.dataset.status || VIDEO_STATUS.UNDETECTED,
    );
    adskipUtils.logDebug(
      "[AdSkip广告检测] - 当前按钮状态:",
      Object.keys(VIDEO_STATUS).find(
        (key) => VIDEO_STATUS[key] === currentStatus,
      ),
      `(${currentStatus})`,
    );

    // 只有 UNDETECTED 状态下才触发手动检测
    if (currentStatus === VIDEO_STATUS.UNDETECTED) {
      adskipUtils.logDebug(
        "[AdSkip广告检测] - 状态为 UNDETECTED，尝试手动检测",
      );

      // 清除可能存在的自动检测定时器
      if (autoDetectTimerId) {
        clearTimeout(autoDetectTimerId);
        autoDetectTimerId = null;
        adskipUtils.logDebug("[AdSkip广告检测] - 清除了待执行的自动检测定时器");
      }

      try {
        // 获取字幕数据
        adskipUtils.logDebug("[AdSkip广告检测] - 获取字幕数据...");
        const subtitleData = await getVideoSubtitleData();

        // 再次检查视频ID是否匹配
        if (!subtitleData || subtitleData.bvid !== videoId) {
          adskipUtils.logDebug(
            "[AdSkip广告检测] - 获取字幕数据失败或视频已切换，取消手动检测",
          );
          return;
        }

        if (!subtitleData.hasSubtitle) {
          adskipUtils.logDebug("[AdSkip广告检测] - 无法检测：该视频没有字幕");
          updateVideoStatus(
            VIDEO_STATUS.NO_SUBTITLE,
            {},
            "手动检测前发现无字幕",
          );
          return;
        }

        adskipUtils.logDebug(
          "[AdSkip广告检测] - 字幕数据获取成功，发送检测请求...",
        );
        // 直接调用发送请求函数 (内部会更新状态为DETECTING)
        await sendDetectionRequest(subtitleData);
      } catch (error) {
        // sendDetectionRequest 内部已经处理了错误和状态恢复
        adskipUtils.logDebug(
          "[AdSkip广告检测] - 手动检测过程中发生错误 (已被sendDetectionRequest处理):",
          error.message,
        );
      }
    } else if (currentStatus === VIDEO_STATUS.NO_SUBTITLE) {
      try {
        const transcribeResult = await forceTranscribeForCurrentVideo();
        if (!transcribeResult.success) {
          if (window.adskipUI?.updateStatusDisplay) {
            window.adskipUI.updateStatusDisplay(
              transcribeResult.message,
              "warning",
            );
          } else {
            alert(transcribeResult.message);
          }
        } else if (window.adskipUI?.updateStatusDisplay) {
          window.adskipUI.updateStatusDisplay(
            transcribeResult.message,
            "success",
          );
        }
      } catch (error) {
        if (window.adskipUI?.updateStatusDisplay) {
          window.adskipUI.updateStatusDisplay(
            `强制转录失败: ${error.message}`,
            "error",
          );
        }
      }
    } else {
      adskipUtils.logDebug(
        `[AdSkip广告检测] - 当前状态 (${currentStatus}) 非 UNDETECTED，不执行特殊操作`,
      );
      // 其他状态 (NO_SUBTITLE, NO_ADS, DETECTING) 点击无特殊效果
    }
  });
  adskipUtils.logDebug("[AdSkip广告检测] - 手动触发检测监听器已设置");
}

/**
 * 同步浮窗按钮异常状态徽标
 */
async function syncExceptionBadges() {
  const button = document.getElementById("adskip-button");
  if (!button) return;

  let container = button.querySelector(".adskip-badge-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "adskip-badge-container";
    button.appendChild(container);
  }

  if (typeof adskipStorage === "undefined") return;

  const globalEnabled = await adskipStorage.getEnabled();
  const uploaderInfo = await adskipStorage.getCurrentVideoUploader();
  let whitelistEnabled = false;
  let upName = "";

  if (
    uploaderInfo &&
    uploaderInfo.uploader &&
    uploaderInfo.uploader !== "未知UP主"
  ) {
    upName = uploaderInfo.uploader;
    const list = await adskipStorage.loadUploaderWhitelist();
    const item = list.find((i) => i.name === upName);
    if (item && item.enabled !== false) {
      whitelistEnabled = true;
    }
  }

  container.innerHTML = "";

  if (!globalEnabled) {
    const badge1 = document.createElement("div");
    badge1.className = "adskip-badge badge-global";
    badge1.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    badge1.title = "仅识别：点击恢复自动跳过";
    badge1.onclick = async (e) => {
      e.stopPropagation();
      await adskipStorage.setEnabled(true);

      syncExceptionBadges();

      const checkbox = document.getElementById("adskip-toggle");
      if (checkbox) checkbox.checked = true;

      const desc = document.querySelector(".adskip-toggle-desc");
      if (desc) {
        if (whitelistEnabled) {
          desc.textContent = "🔹 白名单已启用，仅手动跳过";
        } else {
          desc.textContent = "✅ 自动跳过已启用";
        }
      }

      if (
        typeof currentAdTimestamps !== "undefined" &&
        currentAdTimestamps.length > 0
      ) {
        if (
          typeof adskipVideoMonitor !== "undefined" &&
          adskipVideoMonitor.setupAdSkipMonitor
        ) {
          adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
        }
      }
    };
    container.appendChild(badge1);
  }

  if (whitelistEnabled) {
    const badge2 = document.createElement("div");
    badge2.className = "adskip-badge badge-whitelist";
    badge2.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    badge2.title = `白名单：点击取消对 ${upName} 的白名单`;
    badge2.onclick = async (e) => {
      e.stopPropagation();
      await adskipStorage.disableUploaderInWhitelist(upName);

      syncExceptionBadges();

      const checkbox = document.getElementById("adskip-whitelist-toggle");
      if (checkbox) checkbox.checked = false;

      const desc = document.querySelector(".adskip-toggle-desc");
      if (desc && globalEnabled) {
        desc.textContent = "✅ 自动跳过已启用";
      }
    };
    container.appendChild(badge2);
  }
}

// 导出函数到全局对象
window.adskipAdDetection = {
  getVideoSubtitleData,
  VIDEO_STATUS,
  updateVideoStatus,
  createAdSkipButton,
  syncExceptionBadges,
  // cycleButtonStatus, // 保留测试函数
  // updateButtonStatusBasedOnSubtitle, // 保留辅助函数
  processVideoAdStatus, // 核心状态处理函数
  sendDetectionRequest, // API请求函数
  signRequest, // 签名函数
  setupManualDetectionTrigger, // 手动触发设置函数
  forceTranscribeForCurrentVideo,
  reanalyzeCurrentVideo,
  // 移除了 checkAutoDetectionEligibility, startAutoDetectionProcess, initAutoDetection, onVideoUrlChange
};

// 设置消息监听，用于响应popup请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getBilibiliUser" && message.target === "content") {
    adskipUtils.logDebug("[AdSkip消息处理] - 收到获取用户信息请求");

    // 尝试获取B站用户信息
    if (typeof adskipCredentialService !== "undefined") {
      adskipCredentialService
        .getBilibiliLoginStatus()
        .then((userInfo) => {
          adskipUtils.logDebug("[AdSkip消息处理] - 用户信息获取成功", userInfo);
          sendResponse(userInfo);
        })
        .catch((error) => {
          adskipUtils.logDebug("[AdSkip消息处理] - 用户信息获取失败", error);
          sendResponse({
            isLoggedIn: false,
            username: "guest",
            uid: 0,
            level: 0,
            vipType: 0,
            vipDueDate: 0,
            error: error.message,
          });
        });

      // 返回true表示异步响应
      return true;
    } else {
      adskipUtils.logDebug("[AdSkip消息处理] - 凭证服务未定义");
      sendResponse({
        isLoggedIn: false,
        username: "guest",
        uid: 0,
        level: 0,
        vipType: 0,
        vipDueDate: 0,
        error: "凭证服务未定义",
      });
    }
  }
  // 不处理其他消息，让其他监听器处理
});
