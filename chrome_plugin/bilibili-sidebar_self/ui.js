/**
 * ui.js - 用户界面模块
 * 处理所有UI相关的功能
 */

"use strict";

const TRANSCRIBE_ESTIMATE_FACTOR = 5;

// 状态消息的全局计时器
let statusMessageTimerId = null;
let subtitleTimelineSyncTimerId = null;
let subtitleTimelineVideoId = "";
let subtitleTimelineLastSubtitleHash = "";
let subtitleTimelineLastAdHash = "";
let subtitleTimelineLastInsightHash = "";
let subtitleTimelineManualLock = false;
let subtitleTimelineProgrammaticScroll = false;
let subtitleTimelineLockedRange = null; // { startTime, endTime }
const AI_CHAT_LOCAL_KEY = "adskip_ai_subtitle_threads_v1";

function formatSubtitleTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getCurrentAdRanges() {
  if (!Array.isArray(currentAdTimestamps)) {
    return [];
  }
  return currentAdTimestamps.map((item) => ({
    start: Number(item.start_time ?? item.start ?? 0),
    end: Number(item.end_time ?? item.end ?? 0),
  }));
}

function getTimelineInsightData() {
  const button = document.getElementById("adskip-button");
  if (!button) {
    return { mainpoint: "", keyPoints: [] };
  }

  const mainpoint = String(button.dataset.mainpoint || "").trim();
  let keyPoints = [];
  if (button.dataset.keyPoints) {
    try {
      keyPoints = JSON.parse(button.dataset.keyPoints);
    } catch (e) {
      keyPoints = [];
    }
  }
  keyPoints = (Array.isArray(keyPoints) ? keyPoints : [])
    .map((item) => ({
      start_time: Number(item?.start_time ?? 0),
      point: String(item?.point ?? "").trim(),
    }))
    .filter(
      (item) =>
        !Number.isNaN(item.start_time) && item.start_time >= 0 && item.point,
    )
    .slice(0, 3)
    .sort((a, b) => a.start_time - b.start_time);

  return { mainpoint, keyPoints };
}

function buildInsightHash(insightData) {
  const mainpoint = insightData?.mainpoint || "";
  const keyPointsHash = (insightData?.keyPoints || [])
    .map((item) => `${item.start_time}:${item.point}`)
    .join("|");
  return `${mainpoint}__${keyPointsHash}`;
}

function jumpToPlayerTime(targetTime) {
  const player = adskipUtils.findVideoPlayer();
  if (player) {
    player.currentTime = Number(targetTime || 0);
    subtitleTimelineManualLock = false;
    subtitleTimelineLockedRange = null;
  }
}

function renderSubtitleInsightPanel(insightData) {
  const panel = document.getElementById("adskip-subtitle-insight");
  if (!panel) return;

  console.log(insightData);
  const mainpoint = insightData?.mainpoint || "";
  const keyPoints = insightData?.keyPoints || [];
  const hasRecommendation = !!mainpoint;
  const hasKeyPoints = keyPoints.length > 0;

  // 记住上次折叠状态
  const wasCollapsed = panel.dataset.collapsed === "1";

  panel.innerHTML = "";
  if (!hasRecommendation && !hasKeyPoints) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";

  // 标题栏（含折叠按钮）
  const headerBar = document.createElement("div");
  headerBar.className = "adskip-subtitle-insight-header";

  const headerLabel = document.createElement("span");
  headerLabel.textContent = "内容要点";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "adskip-subtitle-insight-toggle";

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "adskip-subtitle-insight-body";

  const applyCollapsed = (collapsed) => {
    bodyWrap.style.display = collapsed ? "none" : "block";
    toggleBtn.textContent = collapsed ? "▸" : "▾";
    panel.dataset.collapsed = collapsed ? "1" : "0";
  };

  toggleBtn.addEventListener("click", () => {
    const nextCollapsed = panel.dataset.collapsed !== "1";
    applyCollapsed(nextCollapsed);
  });

  headerBar.appendChild(headerLabel);
  headerBar.appendChild(toggleBtn);
  panel.appendChild(headerBar);

  if (hasRecommendation) {
    const reasonSection = document.createElement("div");
    reasonSection.className = "adskip-subtitle-insight-section";

    const reasonTitle = document.createElement("div");
    reasonTitle.className = "adskip-subtitle-insight-title";
    reasonTitle.textContent = "核心观点";

    const reasonText = document.createElement("div");
    reasonText.className = "adskip-subtitle-insight-reason";
    reasonText.textContent = mainpoint;

    reasonSection.appendChild(reasonTitle);
    reasonSection.appendChild(reasonText);
    bodyWrap.appendChild(reasonSection);
  }

  if (hasKeyPoints) {
    const navSection = document.createElement("div");
    navSection.className = "adskip-subtitle-insight-section";

    const navTitle = document.createElement("div");
    navTitle.className = "adskip-subtitle-insight-title";
    navTitle.textContent = "快速导航";
    navSection.appendChild(navTitle);

    const navList = document.createElement("div");
    navList.className = "adskip-subtitle-keypoint-list";
    keyPoints.forEach((item) => {
      const navBtn = document.createElement("button");
      navBtn.type = "button";
      navBtn.className = "adskip-subtitle-keypoint-btn";
      navBtn.innerHTML = `<span class="time">${formatSubtitleTime(item.start_time)}</span><span class="point">${item.point}</span>`;
      navBtn.addEventListener("click", () => jumpToPlayerTime(item.start_time));
      navList.appendChild(navBtn);
    });
    navSection.appendChild(navList);
    bodyWrap.appendChild(navSection);
  }

  panel.appendChild(bodyWrap);
  applyCollapsed(wasCollapsed);
}

function isSubtitleInAdRange(timeSec, adRanges) {
  return adRanges.some(
    (range) => timeSec >= range.start && timeSec <= range.end,
  );
}

function isRowVisibleInList(row, list) {
  if (!row || !list) return false;
  const rowTop = row.offsetTop - list.offsetTop;
  const rowBottom = rowTop + row.offsetHeight;
  const viewTop = list.scrollTop;
  const viewBottom = viewTop + list.clientHeight;
  return rowTop >= viewTop && rowBottom <= viewBottom;
}

function getVisibleTimeRange(list) {
  if (!list) return null;
  const rows = Array.from(list.querySelectorAll(".adskip-subtitle-item"));
  if (!rows.length) return null;

  const viewTop = list.scrollTop;
  const viewBottom = viewTop + list.clientHeight;
  const visible = rows.filter((row) => {
    const top = row.offsetTop - list.offsetTop;
    const bottom = top + row.offsetHeight;
    return bottom >= viewTop && top <= viewBottom;
  });
  if (!visible.length) return null;
  const times = visible
    .map((row) => Number(row.dataset.time || 0))
    .filter((v) => !Number.isNaN(v));
  if (!times.length) return null;
  return {
    startTime: Math.min(...times),
    endTime: Math.max(...times),
  };
}

function loadAiThreadStore() {
  try {
    return JSON.parse(localStorage.getItem(AI_CHAT_LOCAL_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function saveAiThreadStore(store) {
  localStorage.setItem(AI_CHAT_LOCAL_KEY, JSON.stringify(store || {}));
}

async function readCurrentUserForAi() {
  if (typeof adskipCredentialService === "undefined") {
    return { uid: 0, username: "guest" };
  }
  const userInfo = await adskipCredentialService
    .getBilibiliLoginStatus()
    .catch(() => null);
  return {
    uid: userInfo?.uid || 0,
    username: userInfo?.username || "guest",
  };
}

async function checkAiChatAccessAndConsumeIfNeeded() {
  const quota = await adskipStorage.getQuotaEntitlement("ai_chat", true);
  if (quota.allowed) {
    return { allowed: true };
  }
  return {
    allowed: false,
    message: quota.message || "AI对话次数已用完",
  };
}

async function submitAiChatStream(endpoint, payload, handlers) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) {
    throw new Error(`AI接口错误: HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const json = await response.json().catch(() => ({}));
    handlers.onDone?.(json || {});
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      handlers.onEnd?.();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      if (data?.text) {
        handlers.onText?.(data.text);
      }
      if (data?.done) {
        handlers.onDone?.(data.turn || {});
        return;
      }
      if (data?.error) {
        throw new Error(data.error);
      }
    }
  }
}

async function sendSelectedSubtitleToAi() {
  const selected = String(window.getSelection()?.toString() || "").trim();
  const outputEl = document.getElementById("adskip-subtitle-chat-output");
  if (!selected) {
    if (outputEl) {
      outputEl.textContent = "请先在字幕轴中选中一段字幕内容";
    }
    return;
  }

  const access = await checkAiChatAccessAndConsumeIfNeeded();
  if (!access.allowed) {
    if (outputEl) {
      outputEl.textContent = access.message;
    }
    return;
  }

  if (!outputEl) return;

  const videoId = adskipUtils.getCurrentVideoId().id || "unknown";
  const user = await readCurrentUserForAi();
  const apiUrls = await adskipStorage.getApiUrls();
  const threadKey = `${videoId}|${selected.slice(0, 120)}`;
  const store = loadAiThreadStore();
  const thread = store[threadKey] || { turns: [] };
  const history = thread.turns.slice(-10);

  outputEl.textContent = "AI思考中...";
  let aiText = "";
  await submitAiChatStream(
    apiUrls.commentSubmit,
    {
      message: selected,
      quote: selected,
      thread_key: threadKey,
      video_id: videoId,
      userId: user.uid,
      username: user.username,
      fingerprint: btoa(`${navigator.userAgent}|${screen.width}`),
      history,
    },
    {
      onText: (chunk) => {
        aiText += chunk;
        outputEl.textContent = aiText;
      },
      onDone: async (turn) => {
        const finalText = aiText || turn?.aiReply || turn?.reply || "";
        thread.turns.push({
          userText: selected,
          aiReply: finalText,
          time: Date.now(),
        });
        store[threadKey] = thread;
        saveAiThreadStore(store);
        outputEl.textContent = finalText || "AI未返回内容";

        if (turn?.usage_deducted) {
          await window.adskipStorage
            .syncQuotaFromAPIResponse(turn.usage_deducted)
            .catch((e) => {
              console.log("[AdSkip AI Chat] 同步扣费信息失败:", e);
            });
        }
      },
      onEnd: () => {
        if (!aiText) {
          outputEl.textContent = "AI响应结束，但没有有效内容";
        }
      },
    },
  );
}

async function submitProUpdateAds(inputValue) {
  const quota = await adskipStorage.getQuotaEntitlement("ad_correction", true);
  if (!quota.allowed) {
    updateStatusDisplay(quota.message || "今日提交修正次数已用完", "warning");
    return;
  }

  const currentVideoId = adskipUtils.getCurrentVideoId().id || "";
  const bvid = currentVideoId.split("_p")[0];
  if (!bvid.startsWith("BV")) {
    updateStatusDisplay("当前视频不是可提交修正的BV视频", "warning");
    return;
  }

  const apiUrls = await adskipStorage.getApiUrls();
  const adminSecret = await adskipStorage.getAdminUpdateAdsSecret();

  // 获取当前用户信息
  const userInfo =
    typeof adskipCredentialService !== "undefined"
      ? await adskipCredentialService.getBilibiliLoginStatus().catch(() => null)
      : null;

  let payload = {
    bvid,
    ad_timestamps: inputValue || "",
    uid: String(userInfo?.uid || 0),
    clientVersion: chrome.runtime.getManifest().version,
  };

  // 如果后端需要签名校验则保留，否则也可以移除
  if (
    typeof adskipAdDetection !== "undefined" &&
    typeof adskipAdDetection.signRequest === "function"
  ) {
    payload = adskipAdDetection.signRequest(payload);
  }

  const headers = { "Content-Type": "application/json" };
  if (adminSecret) {
    headers["X-Admin-Secret-Key"] = adminSecret;
  }

  const response = await fetch(apiUrls.updateAds, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (result?.success) {
    if (result.usage_deducted) {
      await window.adskipStorage
        .syncQuotaFromAPIResponse(result.usage_deducted)
        .catch((e) => {
          adskipUtils.logDebug("[AdSkip广告检测] - 同步修正额度扣减失败:", e);
        });
    }
    updateStatusDisplay("已提交广告片段修正", "success");
  } else {
    updateStatusDisplay(result?.message || "提交失败，请稍后重试", "error");
  }
}

async function renderSubtitleTimelinePanel(forceRefresh = false) {
  const panel = document.getElementById("adskip-subtitle-panel");
  const list = document.getElementById("adskip-subtitle-list");
  if (!panel || !list) return;

  const currentVideoId = adskipUtils.getCurrentVideoId().id || "";
  const adRanges = getCurrentAdRanges();
  const insightData = getTimelineInsightData();
  const adHash = adRanges.map((item) => `${item.start}-${item.end}`).join("|");
  const insightHash = buildInsightHash(insightData);

  if (
    !forceRefresh &&
    subtitleTimelineVideoId === currentVideoId &&
    subtitleTimelineLastAdHash === adHash &&
    subtitleTimelineLastInsightHash === insightHash
  ) {
    return;
  }

  const subtitleData = await adskipAdDetection
    .getVideoSubtitleData(forceRefresh)
    .catch(() => null);
  const subtitles = subtitleData?.subtitle_contents?.[0] || [];
  const subtitleHash = subtitles.length
    ? `${subtitles.length}_${subtitles[0]?.from || 0}_${subtitles[subtitles.length - 1]?.from || 0}`
    : "0";

  if (
    !forceRefresh &&
    subtitleTimelineVideoId === currentVideoId &&
    subtitleTimelineLastSubtitleHash === subtitleHash &&
    subtitleTimelineLastAdHash === adHash &&
    subtitleTimelineLastInsightHash === insightHash
  ) {
    return;
  }

  subtitleTimelineVideoId = currentVideoId;
  subtitleTimelineLastSubtitleHash = subtitleHash;
  subtitleTimelineLastAdHash = adHash;
  subtitleTimelineLastInsightHash = insightHash;
  list.innerHTML = "";
  // 数据更新导致的重渲染，重置手动滚动锁
  subtitleTimelineManualLock = false;
  subtitleTimelineLockedRange = null;
  renderSubtitleInsightPanel(insightData);

  if (!subtitles.length) {
    list.innerHTML =
      '<div class="adskip-subtitle-item"><div class="adskip-subtitle-text">暂无可展示字幕</div></div>';
    return;
  }

  const maskGroupByIndex = [];
  let groupId = 0;
  for (let i = 0; i < subtitles.length; i++) {
    const isMasked = isSubtitleInAdRange(
      Number(subtitles[i].from || 0),
      adRanges,
    );
    if (!isMasked) continue;
    const prevMasked =
      i > 0 &&
      isSubtitleInAdRange(Number(subtitles[i - 1].from || 0), adRanges);
    if (!prevMasked) {
      groupId++;
    }
    maskGroupByIndex[i] = `ad-group-${groupId}`;
  }

  const maskGroupEls = new Map();
  const keyPoints = insightData.keyPoints || [];
  let keyPointIndex = 0;
  const appendKeyPointRow = (keyPoint) => {
    const markerRow = document.createElement("div");
    markerRow.className = "adskip-subtitle-item key-point-segment";
    markerRow.dataset.time = String(keyPoint.start_time || 0);

    const markerTime = document.createElement("div");
    markerTime.className = "adskip-subtitle-time";
    markerTime.textContent = formatSubtitleTime(keyPoint.start_time || 0);

    const markerText = document.createElement("div");
    markerText.className = "adskip-subtitle-text";
    markerText.textContent = keyPoint.point || "";

    markerRow.appendChild(markerTime);
    markerRow.appendChild(markerText);
    markerRow.addEventListener("click", () =>
      jumpToPlayerTime(keyPoint.start_time),
    );
    list.appendChild(markerRow);
  };

  subtitles.forEach((item, index) => {
    const subtitleTime = Number(item.from || 0);
    while (
      keyPointIndex < keyPoints.length &&
      keyPoints[keyPointIndex].start_time <= subtitleTime
    ) {
      appendKeyPointRow(keyPoints[keyPointIndex]);
      keyPointIndex++;
    }

    const row = document.createElement("div");
    row.className = "adskip-subtitle-item";
    row.dataset.time = String(subtitleTime || 0);

    const timeEl = document.createElement("div");
    timeEl.className = "adskip-subtitle-time";
    timeEl.textContent = formatSubtitleTime(subtitleTime || 0);

    const textEl = document.createElement("div");
    textEl.className = "adskip-subtitle-text";
    textEl.textContent = item.content || "";
    const maskGroup = maskGroupByIndex[index];
    if (maskGroup) {
      row.classList.add("ad-segment");
      row.dataset.maskGroup = maskGroup;
      textEl.classList.add("ad-mask");
      textEl.dataset.maskGroup = maskGroup;
      if (!maskGroupEls.has(maskGroup)) {
        maskGroupEls.set(maskGroup, { textEls: [], rowEls: [] });
      }
      maskGroupEls.get(maskGroup).textEls.push(textEl);
      maskGroupEls.get(maskGroup).rowEls.push(row);
    }

    row.appendChild(timeEl);
    row.appendChild(textEl);
    row.addEventListener("click", () => jumpToPlayerTime(subtitleTime));
    list.appendChild(row);
  });

  while (keyPointIndex < keyPoints.length) {
    appendKeyPointRow(keyPoints[keyPointIndex]);
    keyPointIndex++;
  }

  maskGroupEls.forEach((group, groupKey) => {
    let isGroupHovered = false;
    let revealTimer = null;
    let hideTimer = null;
    const revealAll = () =>
      group.textEls.forEach((el) => el.classList.add("reveal-group"));
    const hideAll = () =>
      group.textEls.forEach((el) => el.classList.remove("reveal-group"));
    const isRelatedTargetInSameGroup = (relatedTarget) => {
      if (!relatedTarget || typeof relatedTarget.closest !== "function") {
        return false;
      }
      const row = relatedTarget.closest(".adskip-subtitle-item");
      return !!row && row.dataset.maskGroup === groupKey;
    };

    const scheduleReveal = () => {
      if (revealTimer) return;
      clearTimeout(hideTimer);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        if (isGroupHovered) {
          revealAll();
        }
      }, 1000);
    };

    const scheduleHide = () => {
      clearTimeout(revealTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isGroupHovered) {
          hideAll();
        }
      }, 150);
    };

    group.rowEls.forEach((row) => {
      row.addEventListener("mouseenter", (event) => {
        if (isRelatedTargetInSameGroup(event.relatedTarget)) {
          return;
        }
        isGroupHovered = true;
        scheduleReveal();
      });
      row.addEventListener("mouseleave", (event) => {
        if (isRelatedTargetInSameGroup(event.relatedTarget)) {
          return;
        }
        isGroupHovered = false;
        scheduleHide();
      });
    });
  });
}

function syncSubtitleTimelineCurrentLine() {
  const list = document.getElementById("adskip-subtitle-list");
  if (!list) return;
  const player = adskipUtils.findVideoPlayer();
  if (!player) return;
  const currentTime = player.currentTime || 0;
  const rows = list.querySelectorAll(".adskip-subtitle-item");
  let activeRow = null;
  rows.forEach((row) => {
    const rowTime = Number(row.dataset.time || 0);
    if (rowTime <= currentTime) {
      activeRow = row;
    }
    row.classList.remove("current");
  });
  if (activeRow) {
    activeRow.classList.add("current");
    if (subtitleTimelineManualLock) {
      if (isRowVisibleInList(activeRow, list)) {
        subtitleTimelineManualLock = false;
        subtitleTimelineLockedRange = null;
      } else if (
        subtitleTimelineLockedRange &&
        currentTime >= subtitleTimelineLockedRange.startTime &&
        currentTime <= subtitleTimelineLockedRange.endTime
      ) {
        subtitleTimelineManualLock = false;
        subtitleTimelineLockedRange = null;
      } else {
        return;
      }
    }

    if (!isRowVisibleInList(activeRow, list)) {
      subtitleTimelineProgrammaticScroll = true;
      activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => {
        subtitleTimelineProgrammaticScroll = false;
      }, 450);
    }
  }
}

async function ensureSubtitleTimelineUI() {
  let toggleBtn = document.getElementById("adskip-subtitle-toggle");
  let panel = document.getElementById("adskip-subtitle-panel");
  const defaultCollapsed =
    await adskipStorage.getSubtitleTimelineDefaultCollapsed();

  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "adskip-subtitle-toggle";
    toggleBtn.className = "adskip-subtitle-toggle";
    toggleBtn.textContent = "展开字幕轴";
    document.body.appendChild(toggleBtn);
  }

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "adskip-subtitle-panel";
    panel.className = "adskip-subtitle-panel";
    panel.innerHTML = `
            <div class="adskip-subtitle-header">
                <span>字幕轴</span>
                <button id="adskip-subtitle-collapse-btn" type="button">收起</button>
            </div>
            <div id="adskip-subtitle-insight" class="adskip-subtitle-insight"></div>
            <div id="adskip-subtitle-list" class="adskip-subtitle-list"></div>
            <div class="adskip-subtitle-chat">
                <div class="adskip-subtitle-chat-note">选中字幕后可直接发起AI对话（Pro及以上可长期使用）</div>
                <div class="adskip-subtitle-chat-actions">
                    <button id="adskip-subtitle-send-ai">和AI讨论选中内容</button>
                </div>
                <div id="adskip-subtitle-chat-output" class="adskip-subtitle-chat-output"></div>
            </div>
        `;
    document.body.appendChild(panel);
  }

  const setCollapse = (collapsed) => {
    panel.style.display = collapsed ? "none" : "flex";
    toggleBtn.style.display = collapsed ? "inline-block" : "none";
  };

  setCollapse(defaultCollapsed);
  toggleBtn.onclick = async () => {
    const isCollapsed = panel.style.display === "none";
    const nextCollapsed = !isCollapsed;
    setCollapse(nextCollapsed);
    await adskipStorage.setSubtitleTimelineDefaultCollapsed(nextCollapsed);
    if (!nextCollapsed) {
      renderSubtitleTimelinePanel(true);
    }
  };
  const collapseBtn = document.getElementById("adskip-subtitle-collapse-btn");
  if (collapseBtn && !collapseBtn.dataset.bound) {
    collapseBtn.dataset.bound = "1";
    collapseBtn.addEventListener("click", async () => {
      setCollapse(true);
      await adskipStorage.setSubtitleTimelineDefaultCollapsed(true);
    });
  }

  const sendAiBtn = document.getElementById("adskip-subtitle-send-ai");
  const chatNote = panel.querySelector(".adskip-subtitle-chat-note");
  const chatOutput = document.getElementById("adskip-subtitle-chat-output");

  const aiQuota = await adskipStorage.getQuotaEntitlement("ai_chat", false);
  const quotaTextObj = adskipStorage.getConsolidatedQuotaText(
    "ai_chat",
    aiQuota.raw,
  );

  const activationHtml = `
        <div id="ai-chat-activation-container" style="display: none; margin-top: 8px;">
            <div style="display: flex; gap: 8px;">
                <input type="text" id="ai-chat-activation-input" placeholder="输入兑换码" style="flex:1; padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px; outline:none;">
                <button id="ai-chat-activation-btn" style="padding:4px 10px; background:#fb7299; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer;">核销</button>
            </div>
            <div id="ai-chat-activation-msg" style="font-size:11px; margin-top:4px;"></div>
        </div>
    `;

  if (chatNote) {
    const color =
      quotaTextObj.status === "exhausted"
        ? "#dc3545"
        : quotaTextObj.status === "warn"
          ? "#f57c00"
          : "#28a745";
    const triggerHtml =
      quotaTextObj.status === "exhausted"
        ? ' <a href="#" id="ai-chat-trigger-activation" style="color:#00a1d6;text-decoration:none;">获取额度</a>'
        : "";

    chatNote.innerHTML = `可选中字幕并进行AI对话（AI对话：<span style="color:${color};font-weight:bold;">${quotaTextObj.text}</span>）${triggerHtml}`;

    if (quotaTextObj.status === "exhausted") {
      chatNote.insertAdjacentHTML("afterend", activationHtml);
      const trigger = document.getElementById("ai-chat-trigger-activation");
      const actContainer = document.getElementById(
        "ai-chat-activation-container",
      );
      const actBtn = document.getElementById("ai-chat-activation-btn");
      const actInput = document.getElementById("ai-chat-activation-input");
      const actMsg = document.getElementById("ai-chat-activation-msg");

      trigger.onclick = (e) => {
        e.preventDefault();
        actContainer.style.display =
          actContainer.style.display === "none" ? "block" : "none";
      };

      actBtn.onclick = async () => {
        const code = actInput.value.trim();
        if (!code)
          return (
            (actMsg.textContent = "请输入激活码"),
            (actMsg.style.color = "#dc3545")
          );
        actBtn.textContent = "验证中..";
        actBtn.disabled = true;

        try {
          const res = await window.adskipStorage.redeemActivationCode(code);
          actBtn.disabled = false;
          actBtn.textContent = "核销";
          if (res.success) {
            actMsg.textContent = "核销成功，已为您增加配额！";
            actMsg.style.color = "#28a745";
            sendAiBtn.disabled = false;
            sendAiBtn.textContent = "和AI讨论选中内容";
            chatNote.innerHTML = `额度已增加，请继续使用！`;
            setTimeout(() => {
              actContainer.style.display = "none";
            }, 2000);
          } else {
            actMsg.textContent = res.message || "核销失败";
            actMsg.style.color = "#dc3545";
          }
        } catch (e) {
          actBtn.disabled = false;
          actBtn.textContent = "核销";
          actMsg.textContent = "网络错误";
          actMsg.style.color = "#dc3545";
        }
      };
    }
  }

  if (!aiQuota.allowed) {
    if (sendAiBtn) {
      sendAiBtn.disabled = true;
      sendAiBtn.textContent = "次数已用完";
    }
    if (chatOutput) chatOutput.textContent = "";
  }
  if (sendAiBtn && !sendAiBtn.dataset.bound) {
    sendAiBtn.dataset.bound = "1";
    sendAiBtn.addEventListener("click", async () => {
      await sendSelectedSubtitleToAi().catch((e) => {
        updateStatusDisplay(`AI对话失败: ${e.message}`, "error");
      });
    });
  }

  await renderSubtitleTimelinePanel(true);
  const list = document.getElementById("adskip-subtitle-list");
  if (list && !list.dataset.boundScroll) {
    list.dataset.boundScroll = "1";
    list.addEventListener(
      "scroll",
      () => {
        if (subtitleTimelineProgrammaticScroll) {
          return;
        }
        subtitleTimelineManualLock = true;
        subtitleTimelineLockedRange = getVisibleTimeRange(list);
      },
      { passive: true },
    );
    list.addEventListener(
      "wheel",
      () => {
        subtitleTimelineManualLock = true;
        subtitleTimelineLockedRange = getVisibleTimeRange(list);
      },
      { passive: true },
    );
  }
  if (subtitleTimelineSyncTimerId) {
    clearInterval(subtitleTimelineSyncTimerId);
  }
  subtitleTimelineSyncTimerId = setInterval(async () => {
    await renderSubtitleTimelinePanel(false);
    syncSubtitleTimelineCurrentLine();
  }, 700);
}

/**
 * 更新状态显示
 * @param {string} message 状态信息
 * @param {string} type 消息类型: 'success', 'warning', 'error', 'info'
 * @param {number} duration 显示持续时间（毫秒）
 */
function updateStatusDisplay(message, type = "success", duration = 3000) {
  // 找到主状态显示元素
  const statusElement = document.getElementById("adskip-status");
  if (!statusElement) {
    console.log("未找到状态显示元素");
    return;
  }

  // 清除之前的计时器
  if (statusMessageTimerId) {
    clearTimeout(statusMessageTimerId);
    statusMessageTimerId = null;
  }

  // 移除所有状态类
  statusElement.classList.remove(
    "status-success",
    "status-warning",
    "status-error",
    "status-info",
  );

  // 添加对应的状态类
  statusElement.classList.add(`status-${type}`);

  // 设置消息内容
  statusElement.textContent = message;

  // 确保元素显示
  statusElement.style.opacity = "1";
  statusElement.style.display = "block";

  // 添加即将淡出的类（用于CSS过渡效果）
  statusElement.classList.remove("fade-out");

  // 设置定时器准备淡出
  statusMessageTimerId = setTimeout(() => {
    // 添加淡出类
    statusElement.classList.add("fade-out");

    // 设置淡出后隐藏的计时器
    setTimeout(() => {
      statusElement.style.display = "none";
      statusElement.classList.remove("fade-out");
    }, 500); // 与CSS过渡时间一致

    statusMessageTimerId = null;
  }, duration);
}

/**
 * 创建链接生成器UI
 */
function createLinkGenerator() {
  let button;

  button = adskipAdDetection.createAdSkipButton();
  adskipUtils.logDebug("[AdSkip] 使用广告检测模块的按钮");

  // 无论使用哪种按钮，都添加点击事件展开操作面板
  button.addEventListener("click", async function () {
    // 如果按钮处于检测中状态，不响应点击
    if (button.classList.contains("detecting")) {
      adskipUtils.logDebug("[AdSkip] 按钮处于检测中状态，不响应点击");
      return;
    }

    // 检查点击来源
    const isFromManualSetup = button.dataset.triggerSource === "manual-setup";

    // 如果面板已经存在，且不是来自手动设置的点击，则移除它
    if (document.getElementById("adskip-panel")) {
      if (!isFromManualSetup) {
        document.getElementById("adskip-panel").remove();
        return;
      }
      // 如果是来自手动设置，移除现有面板但继续创建新面板
      document.getElementById("adskip-panel").remove();
    }

    // 检查是否为次数耗尽状态，但如果是来自手动设置则跳过特殊面板
    const isQuotaExhausted = button.classList.contains("quota-exhausted");
    if (isQuotaExhausted && !isFromManualSetup) {
      // 显示次数耗尽状态的特殊面板
      createQuotaExhaustedPanel();
      return;
    }

    // 刷新当前视频ID
    const currentVideoId = adskipUtils.getCurrentVideoId().id;

    // 获取当前视频UP主信息
    const { uploader: currentUploader, title: currentTitle } =
      await adskipStorage.getCurrentVideoUploader();
    // 检查UP主是否在白名单中及其状态
    const whitelistItem = await adskipStorage
      .loadUploaderWhitelist()
      .then((list) => list.find((item) => item.name === currentUploader));
    const isInWhitelist = !!whitelistItem;
    const isWhitelistEnabled = whitelistItem && whitelistItem.enabled !== false;

    const panel = document.createElement("div");
    panel.id = "adskip-panel";
    panel.className = "adskip-panel";

    // 获取当前生效的时间段字符串
    const currentTimeString =
      adskipUtils.timestampsToString(currentAdTimestamps);

    // 异步检查管理员状态
    const isAdmin = await adskipStorage.checkAdminStatus();
    const subtitleDataForEstimate = await adskipAdDetection
      .getVideoSubtitleData(false)
      .catch(() => null);
    const videoDurationSeconds = Number(subtitleDataForEstimate?.duration || 0);
    const estimatedMinutes =
      videoDurationSeconds > 0
        ? Math.max(
            1,
            Math.ceil(videoDurationSeconds / 60 / TRANSCRIBE_ESTIMATE_FACTOR),
          )
        : 0;
    const estimateText =
      estimatedMinutes > 0
        ? `重新分析预计耗时约 ${estimatedMinutes} 分钟`
        : `预计耗时计算中`;

    // 检查是否启用广告跳过功能
    adskipStorage.getEnabled().then(function (globalSkipEnabled) {
      // 生成白名单UP主管理相关元素
      let whitelistControls = "";
      if (currentUploader && currentUploader !== "未知UP主") {
        whitelistControls = `
                    <div class="adskip-whitelist-container">
                        <div class="adskip-uploader-info">
                            <div class="adskip-uploader-name">
                                <span>UP主：${currentUploader}</span>
                                <label class="adskip-whitelist-label">
                                    <span>白名单</span>
                                    <label class="adskip-switch adskip-switch-small">
                                        <input type="checkbox" id="adskip-whitelist-toggle" ${isInWhitelist && isWhitelistEnabled ? "checked" : ""}>
                                        <span class="adskip-slider"></span>
                                    </label>
                                </label>
                            </div>
                        </div>
                    </div>
                `;
      }

      // 获取跳过模式描述
      const getSkipModeDesc = () => {
        if (!globalSkipEnabled) return "⏸️ 手动模式，可以点击广告区域手动跳过";
        if (isInWhitelist && isWhitelistEnabled)
          return "🔹 白名单已启用，仅手动跳过";
        return "✅ 自动跳过已启用";
      };

      // 面板内容
      panel.innerHTML = `
                <div class="adskip-panel-header">
                    <h3 class="adskip-title">广告跳过 - 时间设置</h3>
                    <label class="adskip-switch">
                        <input type="checkbox" id="adskip-toggle" ${globalSkipEnabled ? "checked" : ""}>
                        <span class="adskip-slider"></span>
                    </label>
                </div>
                <div class="adskip-toggle-desc">${getSkipModeDesc()}</div>
                <div class="adskip-video-id">当前视频: ${currentVideoId || "未识别"}</div>

                ${whitelistControls}

                <p>设置广告时间段（格式: 开始-结束,开始-结束）</p>
                                        <input id="adskip-input" type="text" value="${currentTimeString}" placeholder="例如: 22-33,114-514 或 03:39-1:34:05">

                <div class="adskip-percentage-container">
                    <div class="adskip-percentage-label">广告跳过触发范围：前 <span id="adskip-percentage-value">${adSkipPercentage}</span>%</div>
                    <input type="range" id="adskip-percentage-slider" min="1" max="100" value="${adSkipPercentage}" class="adskip-percentage-slider">
                    <div class="adskip-percentage-hints">
                        <span class="adskip-percentage-preset" data-value="1">仅起始(1%)</span>
                        <span class="adskip-percentage-preset" data-value="50">前半段(50%)</span>
                        <span class="adskip-percentage-preset" data-value="100">全程(100%)</span>
                    </div>
                </div>

                <div class="adskip-button-row">
                    <button id="adskip-generate" class="adskip-btn">🔗 创建分享链接</button>
                    <button id="adskip-apply" class="adskip-btn">✅ 更新跳过设置</button>
                </div>
                <div class="adskip-button-row">
                    <button id="adskip-restore" class="adskip-btn">↩️ 还原原始设置</button>
                    <button id="adskip-reset" class="adskip-btn">🗑️ 清空记录</button>
                </div>
                <div class="adskip-button-row">
                    <button id="adskip-reanalyze" class="adskip-btn">🔁 重新分析</button>
                    <button id="adskip-submit-update" class="adskip-btn">🛠️ 提交修正</button>
                </div>
                <div id="adskip-transcribe-estimate" class="adskip-transcribe-estimate">${estimateText}</div>
                <div id="adskip-status" class="adskip-status"></div>
                <div id="adskip-result" class="adskip-result"></div>
                ${
                  isAdmin
                    ? `
                <div class="adskip-admin-container">
                    <button id="adskip-admin" class="adskip-admin-btn">🔧 管理员设置</button>
                </div>
                `
                    : ``
                }
            `;

      // 添加样式
      const style = document.createElement("style");
      style.textContent = `
                .adskip-whitelist-container {
                    background-color: #f8f9fa;
                    border-radius: 6px;
                    padding: 8px 10px;
                    margin: 10px 0;
                    border: 1px solid #e0e0e0;
                }
                .adskip-uploader-name {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #333;
                    font-size: 14px;
                }
                .adskip-whitelist-label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    color: #555;
                }
                .adskip-switch-small {
                    width: 36px;
                    height: 20px;
                }
                .adskip-switch-small .adskip-slider:before {
                    height: 14px;
                    width: 14px;
                    left: 3px;
                    bottom: 3px;
                }
                .adskip-switch-small input:checked + .adskip-slider:before {
                    transform: translateX(16px);
                }
                /* 状态信息样式 */
                .adskip-status {
                    transition: opacity 0.5s ease;
                    border-radius: 4px;
                    padding: 8px;
                    margin-top: 8px;
                    display: none;
                    opacity: 1;
                }
                /* 淡出效果类 */
                .adskip-status.fade-out {
                    opacity: 0;
                }
                /* 状态类型样式 */
                .adskip-status.status-success {
                    background-color: rgba(40, 167, 69, 0.1);
                    border-left: 3px solid #28a745;
                    color: #155724;
                }
                .adskip-status.status-warning {
                    background-color: rgba(255, 193, 7, 0.1);
                    border-left: 3px solid #ffc107;
                    color: #856404;
                }
                .adskip-status.status-error {
                    background-color: rgba(220, 53, 69, 0.1);
                    border-left: 3px solid #dc3545;
                    color: #721c24;
                }
                .adskip-status.status-info {
                    background-color: rgba(23, 162, 184, 0.1);
                    border-left: 3px solid #17a2b8;
                    color: #0c5460;
                }
                /* 白名单标签状态变化反馈 */
                .adskip-whitelist-label span {
                    transition: color 0.3s ease;
                }
                .adskip-whitelist-toggle:checked ~ .adskip-whitelist-label span {
                    color: #00a1d6;
                    font-weight: 500;
                }
                /* 开关过渡效果 */
                .adskip-slider {
                    transition: background-color 0.3s ease;
                }
                .adskip-slider:before {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                /* 面板内容平滑过渡 */
                .adskip-toggle-desc {
                    transition: color 0.3s ease, opacity 0.2s ease;
                }
                .adskip-transcribe-estimate {
                    margin-top: 8px;
                    font-size: 12px;
                    color: #666;
                    line-height: 1.5;
                }
            `;
      document.head.appendChild(style);

      // 开关逻辑
      document
        .getElementById("adskip-toggle")
        .addEventListener("change", function () {
          const isEnabled = this.checked;
          adskipStorage.setEnabled(isEnabled).then(() => {
            // 更新开关描述
            const toggleDesc = document.querySelector(".adskip-toggle-desc");
            if (toggleDesc) {
              if (isEnabled && isInWhitelist && isWhitelistEnabled) {
                toggleDesc.textContent = "🔹 白名单已启用，仅手动跳过";
              } else if (isEnabled) {
                toggleDesc.textContent = "✅ 自动跳过已启用";
              } else {
                toggleDesc.textContent =
                  "⏸️ 手动模式，可以点击广告区域手动跳过";
              }
            }
            if (
              typeof window.adskipAdDetection !== "undefined" &&
              window.adskipAdDetection.syncExceptionBadges
            ) {
              setTimeout(
                () => window.adskipAdDetection.syncExceptionBadges(),
                50,
              );
            }
            // 如果禁用，清除当前的监控
            if (!isEnabled && window.adSkipCheckInterval) {
              clearInterval(window.adSkipCheckInterval);
              window.adSkipCheckInterval = null;
              adskipUtils.logDebug("已临时禁用广告跳过功能");
              updateStatusDisplay("已临时禁用广告跳过功能", "warning");
            } else if (isEnabled) {
              // 重新启用监控
              if (currentAdTimestamps.length > 0) {
                adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
                adskipUtils.logDebug("已重新启用广告跳过功能");
                updateStatusDisplay("已重新启用广告跳过功能", "success");
              }
            }
          });
        });

      // 白名单开关逻辑
      if (currentUploader && currentUploader !== "未知UP主") {
        document
          .getElementById("adskip-whitelist-toggle")
          .addEventListener("change", async function () {
            try {
              const isChecked = this.checked;
              const toggleDesc = document.querySelector(".adskip-toggle-desc");
              let statusMessage = "";

              // 保存开关原始状态，以便在操作失败时恢复
              const originalState = this.checked;

              // 尝试重新获取最新的白名单状态（以防白名单在其他页面被删除）
              const freshWhitelistItem = await adskipStorage
                .loadUploaderWhitelist()
                .then((list) =>
                  list.find((item) => item.name === currentUploader),
                );

              // 刷新白名单状态变量
              const freshIsInWhitelist = !!freshWhitelistItem;
              const freshIsWhitelistEnabled =
                freshWhitelistItem && freshWhitelistItem.enabled !== false;

              // 根据当前最新状态和开关操作执行响应动作
              if (isChecked) {
                // 启用白名单（如果不在白名单则添加）
                if (!freshIsInWhitelist) {
                  await adskipStorage.addUploaderToWhitelist(currentUploader);
                  statusMessage = `已将UP主 "${currentUploader}" 加入白名单`;
                } else if (!freshIsWhitelistEnabled) {
                  // 如果在白名单但被禁用，则启用
                  await adskipStorage.enableUploaderInWhitelist(
                    currentUploader,
                  );
                  statusMessage = `已启用UP主 "${currentUploader}" 的白名单`;
                }
              } else {
                // 禁用白名单
                if (freshIsInWhitelist && freshIsWhitelistEnabled) {
                  await adskipStorage.disableUploaderInWhitelist(
                    currentUploader,
                  );
                  statusMessage = `已禁用UP主 "${currentUploader}" 的白名单`;
                }
              }

              // 直接更新UI状态（无需关闭重开面板）
              if (toggleDesc && globalSkipEnabled) {
                if (isChecked) {
                  toggleDesc.textContent = "🔹 白名单已启用，仅手动跳过";
                } else {
                  toggleDesc.textContent = "✅ 自动跳过已启用";
                }
              }

              if (
                typeof window.adskipAdDetection !== "undefined" &&
                window.adskipAdDetection.syncExceptionBadges
              ) {
                setTimeout(
                  () => window.adskipAdDetection.syncExceptionBadges(),
                  50,
                );
              }

              // 更新状态显示
              if (statusMessage) {
                updateStatusDisplay(statusMessage, "info");
              }
            } catch (error) {
              console.error("白名单操作失败:", error);
              // 显示错误消息
              updateStatusDisplay(`操作失败: ${error.message}`, "error");

              // 恢复开关状态
              this.checked = !this.checked;
            }
          });
      }

      // 广告跳过百分比滑块逻辑
      const percentageSlider = document.getElementById(
        "adskip-percentage-slider",
      );
      const percentageValue = document.getElementById(
        "adskip-percentage-value",
      );

      percentageSlider.addEventListener("input", function () {
        const newValue = parseInt(this.value, 10);
        percentageValue.textContent = newValue;
      });

      percentageSlider.addEventListener("change", function () {
        const newValue = parseInt(this.value, 10);
        adskipStorage.saveAdSkipPercentage(newValue);

        // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
        adskipStorage.getEnabled().then(function (globalSkipEnabled) {
          if (globalSkipEnabled && currentAdTimestamps.length > 0) {
            adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
          }

          updateStatusDisplay(
            `已更新广告跳过范围为：前${newValue}%`,
            "success",
          );
        });
      });

      // 为百分比预设值添加点击事件
      const percentagePresets = document.querySelectorAll(
        ".adskip-percentage-preset",
      );
      percentagePresets.forEach((preset) => {
        preset.addEventListener("click", function () {
          const presetValue = parseInt(this.getAttribute("data-value"), 10);

          // 更新滑块值和显示值
          percentageSlider.value = presetValue;
          percentageValue.textContent = presetValue;

          // 保存设置并应用
          adskipStorage.saveAdSkipPercentage(presetValue);

          // 如果当前已启用广告跳过且有广告时间段，则重新应用设置
          adskipStorage.getEnabled().then(function (globalSkipEnabled) {
            if (globalSkipEnabled && currentAdTimestamps.length > 0) {
              adskipVideoMonitor.setupAdSkipMonitor(currentAdTimestamps);
            }

            updateStatusDisplay(
              `已更新广告跳过范围为：前${presetValue}%`,
              "success",
            );
          });
        });
      });

      // 生成链接按钮
      document
        .getElementById("adskip-generate")
        .addEventListener("click", function () {
          const input = document.getElementById("adskip-input").value.trim();

          const currentUrl = new URL(window.location.href);

          if (!input) {
            // 当输入为空时，生成 adskip=none 的特殊标记链接
            currentUrl.searchParams.set("adskip", "none");

            adskipUtils.logDebug(`生成无广告标记链接`);

            const resultDiv = document.getElementById("adskip-result");
            resultDiv.innerHTML = `
                        <p>无广告标记链接:</p>
                        <a href="${currentUrl.toString()}" target="_blank">${currentUrl.toString()}</a>
                    `;

            updateStatusDisplay("无广告标记链接已生成", "success");
            return;
          }

          try {
            // 解析时间戳，确保所有时间都转换为整数秒
            const integerTimestamps = input
              .split(",")
              .map((segment) => {
                const [startStr, endStr] = segment
                  .split("-")
                  .map((s) => s.trim());
                if (!startStr || !endStr) {
                  throw new Error("时间段格式无效");
                }

                const start = adskipUtils.parseTimeString(startStr);
                const end = adskipUtils.parseTimeString(endStr);

                if (
                  isNaN(start) ||
                  isNaN(end) ||
                  start >= end ||
                  start < 0 ||
                  end < 0
                ) {
                  throw new Error("时间格式无效");
                }
                // 返回整数格式的字符串
                return `${Math.round(start)}-${Math.round(end)}`;
              })
              .join(",");

            currentUrl.searchParams.set("adskip", integerTimestamps);

            adskipUtils.logDebug(`生成广告跳过链接`);

            const resultDiv = document.getElementById("adskip-result");
            resultDiv.innerHTML = `
                        <p>广告跳过链接:</p>
                        <a href="${currentUrl.toString()}" target="_blank">${currentUrl.toString()}</a>
                    `;

            updateStatusDisplay("分享链接已生成", "success");
          } catch (e) {
            updateStatusDisplay(
              "格式错误，请使用正确的格式：开始-结束,开始-结束 (支持秒数或时:分:秒格式)",
              "error",
            );
          }
        });

      // 立即应用按钮
      document
        .getElementById("adskip-apply")
        .addEventListener("click", async function () {
          const input = document.getElementById("adskip-input").value.trim();

          if (!input) {
            // 如果输入为空，则清空时间段并加入白名单
            adskipVideoMonitor.setupAdSkipMonitor([]);

            // 删除时间戳记录
            const currentVideoId = adskipUtils.getCurrentVideoId().id;
            if (currentVideoId) {
              // 使用现有的removeKeys方法删除时间戳
              await adskipStorage.removeKeys([
                `${adskipStorage.KEYS.VIDEO_PREFIX}${currentVideoId}`,
              ]);
              // 加入白名单
              await adskipStorage.addVideoToNoAdsWhitelist(currentVideoId);
              // 更新按钮状态为NO_ADS
              if (typeof adskipAdDetection !== "undefined") {
                adskipAdDetection.updateVideoStatus(
                  adskipAdDetection.VIDEO_STATUS.NO_ADS,
                  {},
                  "Apply: 清空时间段",
                );
              }
            }

            updateStatusDisplay(
              "设置已应用: 已清空所有时间段并加入无广告白名单",
              "info",
            );
            return;
          }

          try {
            const adTimestamps = input.split(",").map((segment) => {
              const [startStr, endStr] = segment.split("-");
              if (!startStr || !endStr) {
                throw new Error("时间段格式无效");
              }

              const start = adskipUtils.parseTimeString(startStr);
              const end = adskipUtils.parseTimeString(endStr);

              if (
                isNaN(start) ||
                isNaN(end) ||
                start >= end ||
                start < 0 ||
                end < 0
              ) {
                throw new Error("时间格式无效");
              }

              return {
                start_time: start,
                end_time: end,
              };
            });

            adskipVideoMonitor.setupAdSkipMonitor(adTimestamps); // 覆盖而不是添加

            // 保存时间戳并处理白名单
            const currentVideoId = adskipUtils.getCurrentVideoId().id;
            if (currentVideoId) {
              // 保存时间戳
              await adskipStorage.saveAdTimestampsForVideo(
                currentVideoId,
                adTimestamps,
              );
              // 如果视频在白名单中，从白名单移除
              const isInWhitelist =
                await adskipStorage.checkVideoInNoAdsWhitelist(currentVideoId);
              if (isInWhitelist) {
                await adskipStorage.removeVideoFromWhitelist(currentVideoId);
              }
              // 更新按钮状态为HAS_ADS
              if (typeof adskipAdDetection !== "undefined") {
                adskipAdDetection.updateVideoStatus(
                  adskipAdDetection.VIDEO_STATUS.HAS_ADS,
                  { adTimestamps },
                  "Apply: 设置时间段",
                );
              }
            }

            updateStatusDisplay("设置已应用: " + input, "success");
          } catch (e) {
            updateStatusDisplay(
              "格式错误，请使用正确的格式：开始-结束,开始-结束 (支持秒数或时:分:秒格式)",
              "error",
            );
          }
        });

      // 还原按钮
      document
        .getElementById("adskip-restore")
        .addEventListener("click", function () {
          // 如果有URL参数，使用URL中的值
          if (urlAdTimestamps.length > 0) {
            adskipVideoMonitor.setupAdSkipMonitor(urlAdTimestamps);
            document.getElementById("adskip-input").value =
              adskipUtils.timestampsToString(urlAdTimestamps);
            updateStatusDisplay("已还原为URL中的设置", "info");
          } else {
            // 否则清空
            adskipVideoMonitor.setupAdSkipMonitor([]);
            document.getElementById("adskip-input").value = "";
            updateStatusDisplay("已还原（清空所有设置）", "info");
          }
        });

      document
        .getElementById("adskip-reanalyze")
        .addEventListener("click", async function () {
          try {
            const result = await adskipAdDetection.reanalyzeCurrentVideo();
            updateStatusDisplay(
              result.message || "已触发重新分析",
              result.success ? "success" : "warning",
            );
          } catch (e) {
            updateStatusDisplay(`重新分析失败: ${e.message}`, "error");
          }
        });

      document
        .getElementById("adskip-submit-update")
        .addEventListener("click", async function () {
          const input = document.getElementById("adskip-input").value.trim();
          await submitProUpdateAds(input).catch((e) => {
            updateStatusDisplay(`提交修正失败: ${e.message}`, "error");
          });
        });

      // 管理员设置按钮
      if (isAdmin) {
        document
          .getElementById("adskip-admin")
          .addEventListener("click", function () {
            adskipAdmin.showAdminPanel();
          });
      }
      // 重置按钮 - 清空已保存的视频广告数据
      document
        .getElementById("adskip-reset")
        .addEventListener("click", function () {
          // 使用storage模块的集中式方法，获取视频数据键
          adskipStorage.getVideoDataKeys().then(function (videoKeys) {
            if (videoKeys.length > 0) {
              if (
                confirm(
                  "确定要清空【所有】已保存的视频广告数据吗？\n注意：此操作不会影响白名单和其他设置。",
                )
              ) {
                adskipStorage.removeKeys(videoKeys).then(() => {
                  // 清空当前设置
                  currentAdTimestamps = [];
                  urlAdTimestamps = [];

                  // 清除现有的监控
                  if (window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                  }

                  // 更新输入框
                  document.getElementById("adskip-input").value = "";
                  updateStatusDisplay("已清空所有视频广告数据", "warning");

                  adskipUtils.logDebug("已清空所有视频广告数据");
                });
              }
            } else {
              updateStatusDisplay("没有已保存的视频广告数据", "info");
            }
          });
        });
    });

    document.body.appendChild(panel);
  });

  document.body.appendChild(button);
  ensureSubtitleTimelineUI().catch((error) => {
    adskipUtils.logDebug(`[AdSkip] 初始化字幕动态轴失败: ${error.message}`);
  });
}

/**
 * 创建次数耗尽状态的引导面板
 */
function createQuotaExhaustedPanel() {
  const panel = document.createElement("div");
  panel.id = "adskip-panel";
  panel.className = "adskip-panel quota-exhausted-panel";

  panel.innerHTML = `
        <div class="adskip-panel-header">
            <h3 class="adskip-title">🚫 AI识别次数已用完</h3>
        </div>

        <div class="quota-exhausted-content">
            <div class="quota-message">
                <p><strong>🔍 </strong>AI识别广告次数已达到每日限制</p>
                <p><strong>⏰ </strong>请明天再试，次数会在每日0点重置</p>
            </div>

            <div class="quota-tips">
                <h4>💡 使用建议：</h4>
                <ol>
                    <li><strong>查看次数使用情况：</strong>在浏览器插件管理页面，点击"B站 切片广告之友"图标，可以查看次数的构成和消耗情况</li>
                    <li><strong>碰碰运气：</strong>如果您查看的新视频在服务器已有识别记录，可以不消耗次数直接加载广告跳过信息</li>
                    <li><strong>提升B站等级：</strong>更高B站等级和年度大会员都会增加每日可用次数</li>
                    <li><strong>手动设置：</strong>您仍可以手动设置广告时间段来跳过广告</li>
                </ol>
            </div>

            <div class="quota-actions">
                <button id="open-extension-popup" class="adskip-btn quota-btn">📊 查看次数详情</button>
                <button id="manual-setup" class="adskip-btn quota-btn">⚙️ 手动设置广告</button>
            </div>
            
            <!-- 内嵌激活码兑换与补充组建 -->
            <div style="margin-top: 15px;">
                <button id="exhausted-activation-toggle" style="width: 100%; padding: 8px; background: #fff; border: 1px dashed #fe8585; border-radius: 6px; cursor: pointer; color: #ff6b6b; font-size: 13px; font-weight: bold; transition: 0.2s;">
                    💎 获取额度 / 兑换激活码 ▼
                </button>
                <div id="exhausted-activation-panel" style="display: none; padding: 12px; background: #fff; border: 1px solid #ffeaea; border-radius: 6px; margin-top: 6px;">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="exhausted-activation-input" placeholder="输入16位兑换码" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                        <button id="exhausted-activation-btn" style="padding: 8px 16px; background-color: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">核销</button>
                    </div>
                    <div id="exhausted-activation-msg" style="margin-top: 8px; font-size: 12px; height: 16px; text-align: center;"></div>
                </div>
            </div>
        </div>
    `;

  setTimeout(() => {
    const toggleBtn = document.getElementById("exhausted-activation-toggle");
    const panelEl = document.getElementById("exhausted-activation-panel");
    const inputEl = document.getElementById("exhausted-activation-input");
    const btnEl = document.getElementById("exhausted-activation-btn");
    const msgEl = document.getElementById("exhausted-activation-msg");

    if (toggleBtn && panelEl) {
      toggleBtn.onclick = () => {
        const isHidden = panelEl.style.display === "none";
        panelEl.style.display = isHidden ? "block" : "none";
        toggleBtn.innerHTML = isHidden
          ? "💎 隐藏面板 ▲"
          : "💎 获取额度 / 兑换激活码 ▼";
      };
    }
    if (btnEl && inputEl) {
      btnEl.onclick = async () => {
        const code = inputEl.value.trim();
        if (!code)
          return (
            (msgEl.textContent = "请输入兑换码"),
            (msgEl.style.color = "#dc3545")
          );
        btnEl.textContent = "验证中..";
        btnEl.disabled = true;
        msgEl.textContent = "正在与服务端通信..";
        msgEl.style.color = "#666";

        try {
          const res = await window.adskipStorage.redeemActivationCode(code);
          btnEl.disabled = false;
          btnEl.textContent = "核销";
          if (res.success) {
            msgEl.textContent = "核销成功！请重新触发按钮进行验证。";
            msgEl.style.color = "#28a745";
            inputEl.value = "";
            setTimeout(() => {
              document.getElementById("adskip-panel")?.remove();
            }, 2000);
          } else {
            msgEl.textContent = res.message || "核销失败，请重试";
            msgEl.style.color = "#dc3545";
          }
        } catch (e) {
          btnEl.disabled = false;
          btnEl.textContent = "核销";
          msgEl.textContent = "网络异常，请重试";
          msgEl.style.color = "#dc3545";
        }
      };
    }
  }, 50);

  // 添加特殊样式
  const style = document.createElement("style");
  style.textContent = `
        .quota-exhausted-panel {
            background: linear-gradient(135deg, #fff5f5 0%, #ffeaea 100%);
            border: 2px solid #ff6b6b;
            box-shadow: 0 4px 20px rgba(255, 107, 107, 0.15);
        }

        .quota-exhausted-content {
            padding: 10px 0;
        }

        .quota-message {
            background: rgba(255, 107, 107, 0.1);
            border-left: 4px solid #ff6b6b;
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
        }

        .quota-message p {
            margin: 5px 0;
            color: #d63031;
            font-size: 14px;
        }

        .quota-tips {
            margin: 15px 0;
        }

        .quota-tips h4 {
            color: #e17055;
            margin: 8px 0;
            font-size: 14px;
        }

        .quota-tips ol {
            padding-left: 18px;
            color: #2d3436;
        }

        .quota-tips li {
            margin: 8px 0;
            line-height: 1.4;
            font-size: 13px;
        }

        .quota-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .quota-btn {
            flex: 1;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
            border: none;
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .quota-btn:hover {
            background: linear-gradient(135deg, #ff5252 0%, #ff3d3d 100%);
            transform: translateY(-1px);
            box-shadow: 0 3px 10px rgba(255, 107, 107, 0.3);
        }

        .quota-btn:active {
            transform: translateY(0);
        }
    `;

  if (!document.getElementById("quota-exhausted-styles")) {
    style.id = "quota-exhausted-styles";
    document.head.appendChild(style);
  }

  // 添加事件监听器
  panel.addEventListener("click", function (e) {
    if (e.target.id === "open-extension-popup") {
      // 尝试打开扩展弹窗
      if (chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // 备用方案：提示用户手动操作
        alert('请在浏览器右上角扩展图标中找到"B站 切片广告之友"并点击查看');
      }
    } else if (e.target.id === "manual-setup") {
      // 切换到手动设置模式
      panel.remove();

      // 不修改按钮状态，直接创建正常面板
      // 复制正常面板创建逻辑，但不通过按钮点击触发
      const button = document.getElementById("adskip-button");
      if (button) {
        // 触发正常的面板创建逻辑，但标记为来自手动设置
        button.dataset.triggerSource = "manual-setup";
        button.click();
        delete button.dataset.triggerSource;
      }
    }
  });

  document.body.appendChild(panel);
}

// 添加存储变更监听器
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace !== "local") return;

  // 监听广告跳过功能开关变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.ENABLED] !== undefined) {
    const globalSkipEnabled =
      changes[adskipStorage.KEYS.ENABLED].newValue !== false;
    const toggleButton = document.getElementById("adskip-toggle");
    if (toggleButton) {
      toggleButton.checked = globalSkipEnabled;
    }
  }

  // 监听广告跳过百分比变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.PERCENTAGE] !== undefined) {
    const newPercentage = changes[adskipStorage.KEYS.PERCENTAGE].newValue;

    // 更新滑块和显示值
    const percentageSlider = document.getElementById(
      "adskip-percentage-slider",
    );
    const percentageValue = document.getElementById("adskip-percentage-value");

    if (percentageSlider && percentageValue) {
      percentageSlider.value = newPercentage;
      percentageValue.textContent = newPercentage;
    }
  }

  // 监听白名单变化，使用adskipStorage.KEYS常量
  if (changes[adskipStorage.KEYS.UPLOADER_WHITELIST] !== undefined) {
    adskipStorage
      .getCurrentVideoUploader()
      .then(({ uploader: currentUploader }) => {
        if (!currentUploader || currentUploader === "未知UP主") return;

        adskipStorage
          .checkUploaderInWhitelist(currentUploader)
          .then((isInWhitelist) => {
            const whitelistToggle = document.getElementById(
              "adskip-whitelist-toggle",
            );
            if (whitelistToggle) {
              whitelistToggle.checked = isInWhitelist;
            }
          });
      });
  }
});

// 导出函数到全局
window.adskipUI = {
  updateStatusDisplay,
  createLinkGenerator,
};
