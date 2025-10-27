/**
 * searchPrecheck.js - 搜索页预检模块
 * 在搜索页面检测视频是否有字幕，并标记无字幕视频
 */

'use strict';

// 缓存：已处理的BV号
const processedBVs = new Set();

// 缓存使用 Chrome storage 持久化存储，不再使用内存 Map
const CACHE_TTL = 60 * 60 * 1000; // 1小时缓存（修正：之前写的是60分钟实际是60秒）
const CACHE_KEY = 'adskip_search_subtitle_cache';

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
 * @returns {Promise<Object|null>} 缓存结果或null
 */
async function getCachedResult(bv) {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get([CACHE_KEY], resolve);
        });

        if (!result[CACHE_KEY]) return null;

        const cache = JSON.parse(result[CACHE_KEY]);
        const cached = cache[bv];

        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > CACHE_TTL) {
            // 删除过期项并保存
            delete cache[bv];
            await new Promise(resolve => {
                chrome.storage.local.set({ [CACHE_KEY]: JSON.stringify(cache) }, resolve);
            });
            return null;
        }

        return cached;
    } catch (error) {
        console.log(`[SearchPrecheck] 获取缓存失败: ${error.message}`);
        return null;
    }
}

/**
 * 设置缓存项
 * @param {string} bv BV号
 * @param {boolean} hasSubtitle 是否有字幕
 */
async function setCacheResult(bv, hasSubtitle) {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get([CACHE_KEY], resolve);
        });

        const cache = result[CACHE_KEY] ? JSON.parse(result[CACHE_KEY]) : {};
        cache[bv] = { hasSubtitle, timestamp: Date.now() };

        await new Promise(resolve => {
            chrome.storage.local.set({ [CACHE_KEY]: JSON.stringify(cache) }, resolve);
        });
    } catch (error) {
        console.log(`[SearchPrecheck] 设置缓存失败: ${error.message}`);
    }
}

/**
 * 检测视频是否有字幕
 * @param {string} bv BV号
 * @returns {Promise<boolean|null>} 是否有字幕，null表示需要重新检测
 */
async function checkSubtitle(bv) {
    // 仅保留缓存直返逻辑（不再承担调度）
    const cached = await getCachedResult(bv);
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

        // 保存到持久化存储
        await setCacheResult(bv, hasSubtitle);

        return hasSubtitle;
    } catch (e) {
        console.log(`[SearchPrecheck] ${bv}: 检测失败 ${e.message}`);
        return null;
    }
}

/**
 * 将 BV 调度到全局队列
 */
async function scheduleBV(bv, card) {
    // 绑定卡片
    if (card) {
        if (!bvToCards.has(bv)) bvToCards.set(bv, new Set());
        bvToCards.get(bv).add(card);
    }

    // 已处理或执行中/已在队列：直接返回
    if (processedBVs.has(bv) || runningBVs.has(bv) || enqueuedBVs.has(bv)) {
        const cached = await getCachedResult(bv);
        if (cached && cached.hasSubtitle === false) {
            // 立即标记
            const cards = bvToCards.get(bv) || [];
            cards.forEach(c => addNoSubtitleBadge(c));
        }
        return;
    }

    // 缓存命中：直接使用
    const cached = await getCachedResult(bv);
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
 * 检测并标记广告卡片
 * @param {HTMLElement} card 视频卡片元素
 * @returns {boolean} 是否为广告卡片
 */
function markAdCard(card) {
    // 检查广告标识：小火箭图标
    const adMarker = card.querySelector('.bili-video-card__info--ad-creative');
    // 检查广告链接：包含 cm.bilibili.com 的链接
    const link = card.querySelector('a[href*="cm.bilibili.com"]');

    if (adMarker || link) {
        // 在 wrap 上添加透明度（只影响内容区域）
        const wrap = card.querySelector('.bili-video-card__wrap');
        if (wrap) {
            // 已经标记过，跳过
            if (wrap.classList.contains('adskip-identified-ad')) {
                return true;
            }

            wrap.classList.add('adskip-identified-ad');

            // 确保外层card是相对定位
            if (!card.style.position) {
                card.style.position = 'relative';
            }

            // 创建独立的广告标签
            const adLabel = document.createElement('div');
            adLabel.className = 'adskip-ad-label';
            adLabel.textContent = '广告';

            // 添加到外层card（不受wrap的opacity影响）
            card.appendChild(adLabel);

            console.log('[SearchPrecheck] 广告卡片已标记');
            return true;
        }
    }
    return false;
}

/**
 * 处理视频卡片
 * @param {HTMLElement} card 视频卡片元素
 */
async function processVideoCard(card) {
    // 先检查并标记广告（如果是广告，直接返回，不进行字幕检测）
    if (markAdCard(card)) {
        return;
    }

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
        let adCount = 0;
        newAnchors.forEach(a => {
            const card = a.closest('.bili-video-card') || a;
            // 检测并标记广告
            if (markAdCard(card)) {
                adCount++;
                return;
            }

            const bv = extractBV(a.href);
            if (!bv) return;
            uniqueBV.add(bv);
            scheduleBV(bv, card);
        });
        if (adCount > 0) {
            console.log(`[SearchPrecheck] 监听到新增锚点，广告卡片: ${adCount}，有效视频: ${uniqueBV.size}`);
        } else {
            console.log(`[SearchPrecheck] 监听到新增锚点，共 ${newAnchors.size}，唯一BV ${uniqueBV.size}`);
        }
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
    let adCount = 0;

    anchors.forEach(a => {
        const card = a.closest('.bili-video-card') || a;
        // 检测并标记广告
        if (markAdCard(card)) {
            adCount++;
            return;
        }

        const bv = extractBV(a.href);
        if (bv) uniqueBV.add(bv);
    });

    if (adCount > 0) {
        console.log(`[SearchPrecheck] 开始处理页面上 ${anchors.length} 个锚点，广告卡片: ${adCount}，有效视频: ${uniqueBV.size}`);
    } else {
        console.log(`[SearchPrecheck] 开始处理页面上 ${anchors.length} 个锚点，唯一BV ${uniqueBV.size}`);
    }

    // 为每个BV找到对应的卡片并调度
    uniqueBV.forEach(bv => {
        const a = Array.from(anchors).find(x => extractBV(x.href) === bv);
        const card = a ? (a.closest('.bili-video-card') || a) : document.body;
        scheduleBV(bv, card);
    });
}

/**
 * 悬停检测处理单个卡片（关闭全局开关时的备用方案）
 */
function setupHoverPrecheck() {
    // 不再输出日志，静默启动

    document.body.addEventListener('mouseover', async (e) => {
        const card = e.target.closest('.bili-video-card');
        if (!card) return;

        // 检查是否已经处理过
        const link = card.querySelector('a[href*="/video/BV"]');
        if (!link) return;

        const bv = extractBV(link.href);
        if (!bv || processedBVs.has(bv)) return;

        // 检查缓存
        const cached = await getCachedResult(bv);
        if (cached !== null) {
            processedBVs.add(bv);
            if (cached.hasSubtitle === false) {
                addNoSubtitleBadge(card);
            }
            return;
        }

        // 延迟检测（0.7秒）
        const timer = setTimeout(() => {
            scheduleBV(bv, card);
        }, 700);

        // 鼠标离开时取消检测
        const cancelOnLeave = () => {
            clearTimeout(timer);
            card.removeEventListener('mouseleave', cancelOnLeave);
        };
        card.addEventListener('mouseleave', cancelOnLeave);
    }, { passive: true });
}

/**
 * 初始化搜索页预检功能（全局自动模式）
 */
async function initSearchPrecheck() {
    console.log('[SearchPrecheck] 初始化搜索页预检功能（全局自动模式）');

    // 处理已有卡片
    processExistingCards();

    // 监听页面变化
    observePageChanges();
}

/**
 * 初始化广告标记功能（独立于字幕预检）
 */
function initAdMarking() {
    console.log('[AdSkip] 初始化搜索页广告标记功能');

    // 处理已有卡片
    const cards = document.querySelectorAll('.bili-video-card');
    let adCount = 0;
    cards.forEach(card => {
        if (markAdCard(card)) {
            adCount++;
        }
    });
    if (adCount > 0) {
        console.log(`[AdSkip] 标记了 ${adCount} 个广告卡片`);
    }

    // 监听页面变化
    const observer = new MutationObserver(mutations => {
        let newAdCount = 0;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const card = node.classList?.contains('bili-video-card')
                            ? node
                            : node.querySelector?.('.bili-video-card');
                        if (card) {
                            if (markAdCard(card)) {
                                newAdCount++;
                            }
                        } else {
                            // 检查新增节点内的所有卡片
                            const cardsInNode = node.querySelectorAll?.('.bili-video-card');
                            cardsInNode?.forEach(c => {
                                if (markAdCard(c)) {
                                    newAdCount++;
                                }
                            });
                        }
                    }
                }
            }
        }
        if (newAdCount > 0) {
            console.log(`[AdSkip] 新标记了 ${newAdCount} 个广告卡片`);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[AdSkip] 广告标记功能已启动');
}

// 检查是否是搜索页
if (window.location.hostname === 'search.bilibili.com') {
    // 立即初始化广告标记功能（独立运行）
    initAdMarking();

    // 字幕预检功能的独立初始化
    let isInitialized = false;

    async function checkAndInit() {
        const enabled = await window.adskipStorage.getSearchPrecheck();

        if (enabled && !isInitialized) {
            console.log('[SearchPrecheck] 全局自动模式已启用');
            // 处理已有卡片
            processExistingCards();
            // 监听页面变化
            observePageChanges();
            isInitialized = true;
        } else if (!enabled && !isInitialized) {
            console.log('[SearchPrecheck] 全局模式已禁用，使用悬停预检测模式');
            // 悬停模式
            setupHoverPrecheck();
            isInitialized = true;
        } else if (!enabled && isInitialized) {
            console.log('[SearchPrecheck] 从全局模式切换到悬停模式');
            // 切换到悬停模式
            location.reload(); // 简单粗暴地重载页面
        } else if (enabled && isInitialized) {
            console.log('[SearchPrecheck] 从悬停模式切换到全局模式');
            location.reload();
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

