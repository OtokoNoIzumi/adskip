/**
 * searchPrecheck.js - 搜索页预检模块
 * 在搜索页面检测视频是否有字幕，并标记无字幕视频
 */

'use strict';

// 缓存：已处理的BV号
const processedBVs = new Set();

// 缓存的字幕检测结果 (BV -> {hasSubtitle, timestamp})
const subtitleCache = new Map();
const CACHE_TTL = 60 * 1000; // 24小时

// 并发控制（全局调度器）
const MAX_CONCURRENT = 4;
let runningCount = 0;
let taskSeq = 0;
const queue = [];              // Array<string> - 等待中的BV
const enqueuedBVs = new Set(); // 去重：已在队列中
const runningBVs = new Set();  // 去重：执行中
const bvToCards = new Map();   // Map<bv, Set<HTMLElement>> - 一个BV可能对应多个卡片

/**
 * 从视频链接中提取BV号
 * @param {string} href 视频链接
 * @returns {string|null} BV号
 */
function extractBV(href) {
    const match = href.match(/video\/(BV[\w]+)/);
    return match ? match[1] : null;
}

/**
 * 检查缓存是否有效
 * @param {string} bv BV号
 * @returns {Object|null} 缓存结果或null
 */
function getCachedResult(bv) {
    const cached = subtitleCache.get(bv);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
        subtitleCache.delete(bv);
        return null;
    }

    return cached;
}

/**
 * 从Chrome storage加载缓存
 */
async function loadCacheFromStorage() {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get(['adskip_search_subtitle_cache'], resolve);
        });

        if (result.adskip_search_subtitle_cache) {
            const data = JSON.parse(result.adskip_search_subtitle_cache);
            const now = Date.now();

            // 清理过期项
            for (const [bv, entry] of Object.entries(data)) {
                if (now - entry.timestamp < CACHE_TTL) {
                    subtitleCache.set(bv, entry);
                }
            }

            console.log(`[SearchPrecheck] 从存储加载缓存，有效项数: ${subtitleCache.size}`);
        }
    } catch (error) {
        console.log(`[SearchPrecheck] 加载缓存失败: ${error.message}`);
    }
}

/**
 * 保存缓存到Chrome storage
 */
async function saveCacheToStorage() {
    try {
        const data = {};
        for (const [bv, entry] of subtitleCache) {
            data[bv] = entry;
        }

        await new Promise(resolve => {
            chrome.storage.local.set({
                adskip_search_subtitle_cache: JSON.stringify(data)
            }, resolve);
        });

        console.log(`[SearchPrecheck] 缓存已保存，项数: ${subtitleCache.size}`);
    } catch (error) {
        console.log(`[SearchPrecheck] 保存缓存失败: ${error.message}`);
    }
}

/**
 * 检测视频是否有字幕
 * @param {string} bv BV号
 * @returns {Promise<boolean>} 是否有字幕
 */
async function checkSubtitle(bv) {
    // 仅保留缓存直返逻辑（不再承担调度）
    const cached = getCachedResult(bv);
    if (cached !== null) {
        console.log(`[SearchPrecheck] 使用缓存结果: ${bv} -> ${cached.hasSubtitle}`);
        return cached.hasSubtitle;
    }
    return null;
}

/**
 * 任务执行：获取字幕并缓存
 */
async function runTask(bv, taskId) {
    try {
        const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bv}`;
        const viewResponse = await fetch(viewUrl);
        if (!viewResponse.ok) throw new Error(`HTTP ${viewResponse.status}`);
        const viewData = await viewResponse.json();
        if (viewData.code !== 0) throw new Error(`API ${viewData.code}: ${viewData.message}`);

        const title = viewData?.data?.title || '';
        const aid = viewData?.data?.aid;
        const cid = viewData?.data?.cid;
        if (!aid || !cid) throw new Error('missing aid/cid');

        const subtitleUrl = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`;
        const subtitleResponse = await fetch(subtitleUrl, { credentials: 'include' });
        if (!subtitleResponse.ok) throw new Error(`subtitle HTTP ${subtitleResponse.status}`);
        const subtitleData = await subtitleResponse.json();
        if (subtitleData.code !== 0) throw new Error(`subtitle ${subtitleData.code}: ${subtitleData.message}`);

        const subtitles = subtitleData?.data?.subtitle?.subtitles || [];
        const hasSubtitle = subtitles.length > 0;
        console.log(`[SearchPrecheck] ${bv}: ${hasSubtitle ? '有字幕' : '无字幕'} (${title.substring(0, 20)}...)`);

        subtitleCache.set(bv, { hasSubtitle, timestamp: Date.now() });
        if (subtitleCache.size % 10 === 0) saveCacheToStorage();

        return hasSubtitle;
    } catch (e) {
        console.log(`[SearchPrecheck] ${bv}: 检测失败 ${e.message}`);
        return null;
    }
}

/**
 * 将 BV 调度到全局队列
 */
function scheduleBV(bv, card) {
    // 绑定卡片
    if (card) {
        if (!bvToCards.has(bv)) bvToCards.set(bv, new Set());
        bvToCards.get(bv).add(card);
    }

    // 已处理或执行中/已在队列：直接返回
    if (processedBVs.has(bv) || runningBVs.has(bv) || enqueuedBVs.has(bv)) {
        const cached = getCachedResult(bv);
        if (cached && cached.hasSubtitle === false) {
            // 立即标记
            const cards = bvToCards.get(bv) || [];
            cards.forEach(c => addNoSubtitleBadge(c));
        }
        return;
    }

    // 缓存命中：直接使用
    const cached = getCachedResult(bv);
    if (cached !== null) {
        processedBVs.add(bv);
        if (cached.hasSubtitle === false) {
            const cards = bvToCards.get(bv) || [];
            cards.forEach(c => addNoSubtitleBadge(c));
        }
        console.log(`[SearchPrecheck] cache-hit, skip queue: ${bv}`);
        return;
    }

    // 入队
    queue.push(bv);
    enqueuedBVs.add(bv);
    pumpQueue();
}

/**
 * 队列泵：按并发上限执行任务
 */
function pumpQueue() {
    while (runningCount < MAX_CONCURRENT && queue.length > 0) {
        const bv = queue.shift();
        enqueuedBVs.delete(bv);
        runningBVs.add(bv);
        runningCount++;

        const taskId = `${bv}#${++taskSeq}`;
        runTask(bv, taskId).then(result => {
            processedBVs.add(bv);
            runningBVs.delete(bv);
            runningCount--;

            // 标记UI（仅当确定无字幕）
            if (result === false) {
                const cards = bvToCards.get(bv) || [];
                cards.forEach(c => addNoSubtitleBadge(c));
            }

            // 清理
            const set = bvToCards.get(bv);
            if (set && set.size > 0) {
                // 不强制清空，保留以防复用；但可按需：bvToCards.delete(bv);
            }

            pumpQueue();
        });
    }
}

/**
 * 为视频卡片添加无字幕标记
 * @param {HTMLElement} card 视频卡片元素
 */
function addNoSubtitleBadge(card) {
    // 检查是否已添加标记
    if (card.querySelector('.adskip-no-subtitle-badge')) {
        return;
    }

    // 查找封面容器
    const coverContainer = card.querySelector('.bili-video-card__image--wrap');
    if (!coverContainer) {
        return;
    }

    // 创建徽标
    const badge = document.createElement('div');
    badge.className = 'adskip-no-subtitle-badge';
    badge.textContent = '无字幕';
    badge.title = '检测到无字幕';

    coverContainer.appendChild(badge);
}

/**
 * 处理视频卡片
 * @param {HTMLElement} card 视频卡片元素
 */
async function processVideoCard(card) {
    // 提取BV号
    const link = card.querySelector('a[href*="/video/BV"]');
    if (!link) return;

    const bv = extractBV(link.href);
    if (!bv) return;

    scheduleBV(bv, card);
}

/**
 * 监听页面变化
 */
function observePageChanges() {
    const observer = new MutationObserver(mutations => {
        const newAnchors = new Set();

        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const anchors = node.querySelectorAll?.('a[href*="/video/BV"]') || [];
                        for (const a of anchors) {
                            newAnchors.add(a);
                        }
                    }
                }
            }
        }

        if (newAnchors.size > 0) {
            const uniqueBV = new Set();
            newAnchors.forEach(a => {
                const bv = extractBV(a.href);
                if (!bv) return;
                uniqueBV.add(bv);
                const card = a.closest('.bili-video-card') || a;
                scheduleBV(bv, card);
            });
            console.log(`[SearchPrecheck] 监听到新增锚点，共 ${newAnchors.size}，唯一BV ${uniqueBV.size}`);
        }
    });

    // 开始监听
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * 处理当前页面已有卡片
 */
async function processExistingCards() {
    const anchors = document.querySelectorAll('a[href*="/video/BV"]');
    const uniqueBV = new Set();
    anchors.forEach(a => {
        const bv = extractBV(a.href);
        if (bv) uniqueBV.add(bv);
    });
    console.log(`[SearchPrecheck] 开始处理页面上 ${anchors.length} 个锚点，唯一BV ${uniqueBV.size}`);

    uniqueBV.forEach(bv => {
        const a = Array.from(anchors).find(x => extractBV(x.href) === bv);
        const card = a ? (a.closest('.bili-video-card') || a) : document.body;
        scheduleBV(bv, card);
    });
}

/**
 * 初始化搜索页预检功能
 */
async function initSearchPrecheck() {
    console.log('[SearchPrecheck] 初始化搜索页预检功能');

    // 加载缓存
    await loadCacheFromStorage();

    // 处理已有卡片
    processExistingCards();

    // 监听页面变化
    observePageChanges();

    // 定期保存缓存
    setInterval(() => {
        if (subtitleCache.size > 0) {
            saveCacheToStorage();
        }
    }, 60000); // 每分钟保存一次
}

// 检查是否是搜索页，且功能已启用
if (window.location.hostname === 'search.bilibili.com') {
    let isInitialized = false;

    // 检查功能是否启用
    async function checkAndInit() {
        const enabled = await window.adskipStorage.getSearchPrecheck();
        if (enabled && !isInitialized) {
            console.log('[SearchPrecheck] 功能已启用，开始初始化');
            initSearchPrecheck();
            isInitialized = true;
        } else if (!enabled && isInitialized) {
            console.log('[SearchPrecheck] 功能已禁用');
            // 可以在这里添加清理逻辑
            isInitialized = false;
        } else if (!enabled) {
            console.log('[SearchPrecheck] 功能已禁用');
        }
    }

    checkAndInit();

    // 监听storage变化
    chrome.storage.local.onChanged.addListener((changes) => {
        if (changes.adskip_search_precheck) {
            checkAndInit();
        }
    });
}

