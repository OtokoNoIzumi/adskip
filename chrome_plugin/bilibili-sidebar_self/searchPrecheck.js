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

// 已读BV缓存（白名单 + 广告数据）- 用于快速匹配
let readBVs = new Set();
// 已读标记开关状态（默认开启）
let readMarkEnabled = true;

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
    // 如果已读，不进行字幕检测
    if (readBVs.has(bv)) {
        return;
    }

    // 绑定卡片
    if (card) {
        if (!bvToCards.has(bv)) bvToCards.set(bv, new Set());
        bvToCards.get(bv).add(card);
    }

    // 已处理或执行中/已在队列：直接返回
    if (processedBVs.has(bv) || runningBVs.has(bv) || enqueuedBVs.has(bv)) {
        const cached = await getCachedResult(bv);
        if (cached && cached.hasSubtitle === false) {
            // 立即标记无字幕（已读标记优先级更高，但不在此处处理，因为已读检查在更上层）
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
    // 检查是否已添加标记（优先检查高优先级标记）
    if (card.querySelector('.adskip-ad-label') || card.querySelector('.adskip-read-badge') || card.querySelector('.adskip-no-subtitle-badge')) {
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
 * 为视频卡片添加已读标记
 * @param {HTMLElement} card 视频卡片元素
 */
function addReadBadge(card) {
    // 检查开关状态
    if (!readMarkEnabled) {
        return;
    }

    // 检查是否已添加标记（广告标记优先级更高）
    if (card.querySelector('.adskip-ad-label') || card.querySelector('.adskip-read-badge') || card.querySelector('.adskip-read-label')) {
        return;
    }

    // 轻度淡化：为wrap添加已读类（避免与广告类冲突）
    const wrap = card.querySelector('.bili-video-card__wrap');
    if (wrap && !wrap.classList.contains('adskip-identified-ad')) {
        wrap.classList.add('adskip-read-card');
    }

    // 确保外层card是相对定位（与广告标签一致）
    if (!card.style.position) {
        card.style.position = 'relative';
    }

    // 创建"已读"角标（与广告角标同层、同规格，仅颜色不同）
    const readLabel = document.createElement('div');
    readLabel.className = 'adskip-read-label';
    readLabel.textContent = '已读';
    readLabel.title = '已在白名单或有广告数据';

    // 添加到外层card（不受wrap的opacity影响）
    card.appendChild(readLabel);
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
    // 1. 先检查并标记广告（优先级最高，如果是广告，直接返回）
    if (markAdCard(card)) {
        return;
    }

    // 提取BV号
    const link = card.querySelector('a[href*="/video/BV"]');
    if (!link) return;

    const bv = extractBV(link.href);
    if (!bv) return;

    // 2. 检查是否已读（优先级：广告 > 已读 > 无字幕）- 仅在开关开启时标记
    if (readMarkEnabled && readBVs.has(bv)) {
        addReadBadge(card);
        return;
    }

    // 3. 调度字幕检测（优先级最低）
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
        let readCount = 0;
        newAnchors.forEach(a => {
            const card = a.closest('.bili-video-card') || a;
            // 1. 检测并标记广告（优先级最高）
            if (markAdCard(card)) {
                adCount++;
                return;
            }

            const bv = extractBV(a.href);
            if (!bv) return;

            // 2. 检查是否已读（仅在开关开启时）
            if (readMarkEnabled && readBVs.has(bv)) {
                addReadBadge(card);
                readCount++;
                return;
            }

            // 3. 调度字幕检测
            uniqueBV.add(bv);
            scheduleBV(bv, card);
        });
        if (adCount > 0 || readCount > 0) {
            console.log(`[SearchPrecheck] 监听到新增锚点，广告: ${adCount}，已读: ${readCount}，待检测: ${uniqueBV.size}`);
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
    let readCount = 0;

    anchors.forEach(a => {
        const card = a.closest('.bili-video-card') || a;
        // 1. 检测并标记广告（优先级最高）
        if (markAdCard(card)) {
            adCount++;
            return;
        }

        const bv = extractBV(a.href);
        if (!bv) return;

        // 2. 检查是否已读（仅在开关开启时）
        if (readMarkEnabled && readBVs.has(bv)) {
            addReadBadge(card);
            readCount++;
            return;
        }

        // 3. 需要检测字幕的BV
        uniqueBV.add(bv);
    });

    if (adCount > 0 || readCount > 0) {
        console.log(`[SearchPrecheck] 开始处理页面上 ${anchors.length} 个锚点，广告: ${adCount}，已读: ${readCount}，待检测: ${uniqueBV.size}`);
    } else {
        console.log(`[SearchPrecheck] 开始处理页面上 ${anchors.length} 个锚点，唯一BV ${uniqueBV.size}`);
    }

    // 为每个BV找到对应的卡片并调度字幕检测
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

        // 1. 检查是否已读（优先级高于字幕检测，仅在开关开启时）
        if (readMarkEnabled && readBVs.has(bv)) {
            addReadBadge(card);
            processedBVs.add(bv);
            return;
        }

        // 2. 检查字幕缓存
        const cached = await getCachedResult(bv);
        if (cached !== null) {
            processedBVs.add(bv);
            if (cached.hasSubtitle === false) {
                addNoSubtitleBadge(card);
            }
            return;
        }

        // 3. 延迟检测字幕（0.7秒）
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
 * 加载已读BV数据（白名单 + 广告数据）
 * 高效一次性加载，使用Set进行O(1)查找
 */
async function loadReadBVs() {
    try {
        const newReadBVs = new Set();

        // 1. 加载白名单
        const whitelist = await window.adskipStorage.loadVideoWhitelist();
        whitelist.forEach(item => {
            const bv = typeof item === 'string' ? item : item.bvid;
            if (bv) {
                newReadBVs.add(bv);
            }
        });

        // 2. 加载所有广告数据键
        const videoDataKeys = await window.adskipStorage.getVideoDataKeys();
        videoDataKeys.forEach(key => {
            // 从键名提取BV号：adskip_BVxxx -> BVxxx
            const bv = key.replace(window.adskipStorage.KEYS.VIDEO_PREFIX, '');
            if (bv && bv.startsWith('BV')) {
                newReadBVs.add(bv);
            }
        });

        readBVs = newReadBVs;
        console.log(`[SearchPrecheck] 已加载 ${readBVs.size} 个已读BV（白名单: ${whitelist.length}, 广告数据: ${videoDataKeys.length}）`);
    } catch (error) {
        console.error('[SearchPrecheck] 加载已读BV数据失败:', error);
        readBVs = new Set();
    }
}

/**
 * 初始化搜索页预检功能（全局自动模式）
 */
async function initSearchPrecheck() {
    console.log('[SearchPrecheck] 初始化搜索页预检功能（全局自动模式）');

    // 先加载已读标记开关状态
    await loadReadMarkSetting();

    // 加载已读BV数据
    await loadReadBVs();

    // 处理已有卡片
    processExistingCards();

    // 监听页面变化
    observePageChanges();
}

/**
 * 移除已读标记
 * @param {HTMLElement} card 视频卡片元素
 */
function removeReadBadge(card) {
    // 移除已读角标
    const readLabel = card.querySelector('.adskip-read-label');
    if (readLabel) {
        readLabel.remove();
    }

    // 移除已读淡化类
    const wrap = card.querySelector('.bili-video-card__wrap');
    if (wrap) {
        wrap.classList.remove('adskip-read-card');
    }
}

/**
 * 清理所有已读标记（当开关关闭时）
 */
function clearAllReadBadges() {
    const cards = document.querySelectorAll('.bili-video-card');
    cards.forEach(card => {
        removeReadBadge(card);
    });
}

/**
 * 加载已读标记开关状态
 */
async function loadReadMarkSetting() {
    try {
        const newState = await window.adskipStorage.getReadMark();
        const oldState = readMarkEnabled;
        readMarkEnabled = newState;
        console.log(`[AdSkip] 已读标记开关状态: ${readMarkEnabled ? '开启' : '关闭'}`);

        // 如果从开启变为关闭，清理所有已读标记
        if (oldState === true && newState === false) {
            clearAllReadBadges();
        }
    } catch (error) {
        console.error('[AdSkip] 加载已读标记开关状态失败:', error);
        readMarkEnabled = true; // 默认开启
    }
}

/**
 * 初始化广告标记功能（独立于字幕预检）
 */
async function initAdMarking() {
    console.log('[AdSkip] 初始化搜索页广告标记功能');

    // 先加载已读标记开关状态
    await loadReadMarkSetting();

    // 加载已读BV数据（用于已读标记）
    await loadReadBVs();

    // 处理已有卡片
    const cards = document.querySelectorAll('.bili-video-card');
    let adCount = 0;
    let readCount = 0;
    cards.forEach(card => {
        // 1. 标记广告（优先级最高）
        if (markAdCard(card)) {
            adCount++;
            return;
        }

        // 2. 检查并标记已读（仅在开关开启时）
        if (readMarkEnabled) {
            const link = card.querySelector('a[href*="/video/BV"]');
            if (link) {
                const bv = extractBV(link.href);
                if (bv && readBVs.has(bv)) {
                    addReadBadge(card);
                    readCount++;
                }
            }
        }
    });
    if (adCount > 0 || readCount > 0) {
        console.log(`[AdSkip] 标记了 ${adCount} 个广告卡片，${readCount} 个已读卡片`);
    }

    // 监听页面变化
    const observer = new MutationObserver(mutations => {
        let newAdCount = 0;
        let newReadCount = 0;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const card = node.classList?.contains('bili-video-card')
                            ? node
                            : node.querySelector?.('.bili-video-card');
                        if (card) {
                            // 1. 标记广告
                            if (markAdCard(card)) {
                                newAdCount++;
                                continue;
                            }
                            // 2. 检查已读（仅在开关开启时）
                            if (readMarkEnabled) {
                                const link = card.querySelector('a[href*="/video/BV"]');
                                if (link) {
                                    const bv = extractBV(link.href);
                                    if (bv && readBVs.has(bv)) {
                                        addReadBadge(card);
                                        newReadCount++;
                                    }
                                }
                            }
                        } else {
                            // 检查新增节点内的所有卡片
                            const cardsInNode = node.querySelectorAll?.('.bili-video-card');
                            cardsInNode?.forEach(c => {
                                if (markAdCard(c)) {
                                    newAdCount++;
                                    return;
                                }
                                if (readMarkEnabled) {
                                    const link = c.querySelector('a[href*="/video/BV"]');
                                    if (link) {
                                        const bv = extractBV(link.href);
                                        if (bv && readBVs.has(bv)) {
                                            addReadBadge(c);
                                            newReadCount++;
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }
        if (newAdCount > 0 || newReadCount > 0) {
            console.log(`[AdSkip] 新标记了 ${newAdCount} 个广告卡片，${newReadCount} 个已读卡片`);
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

        // 先加载已读标记开关状态
        await loadReadMarkSetting();

        // 加载已读BV数据（两种模式都需要）
        await loadReadBVs();

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
        } else if (changes.adskip_read_mark) {
            // 已读标记开关变化时重新加载状态并刷新页面
            loadReadMarkSetting().then(() => {
                // 重新处理当前页面卡片
                processExistingCards();
            });
        } else if (changes.adskip_video_whitelist || Object.keys(changes).some(key => key.startsWith('adskip_BV'))) {
            // 白名单或广告数据变化时重新加载已读BV
            loadReadBVs().then(() => {
                // 重新处理当前页面卡片
                processExistingCards();
            });
        }
    });
}

