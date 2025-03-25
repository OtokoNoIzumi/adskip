/**
 * videoMonitor.js - 视频监控模块
 * 处理视频监控和广告跳过的核心逻辑
 */

'use strict';

// 添加全局变量，用于缓存当前播放时间
let lastKnownPlaybackTime = 0;
let lastPlaybackTimeUpdate = 0;

// 添加全局变量用于缓存白名单状态
let _lastUploaderName = '';
let _lastWhitelistStatus = false;
let _lastGlobalSkipStatus = true;

// 添加全局函数，用于获取当前播放时间（优先使用缓存的时间）
function getCurrentRealPlaybackTime() {
    const now = Date.now();
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
    window.playbackTimeMonitorInterval = setInterval(function() {
        const videoPlayer = adskipUtils.findVideoPlayer();
        if (videoPlayer && !videoPlayer.paused && !videoPlayer.ended) {
            lastKnownPlaybackTime = videoPlayer.currentTime;
            lastPlaybackTimeUpdate = Date.now();
        }
    }, 100); // 每100ms更新一次

    // 页面卸载时清理资源
    window.addEventListener('unload', function() {
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
    adskipUtils.logDebug('设置广告跳过监控:', adTimestamps);

    if (!adTimestamps || !Array.isArray(adTimestamps) || adTimestamps.length === 0) {
        adskipUtils.logDebug('无效的广告时间段，不设置监控');
        return;
    }

    // 更新当前生效的时间段
    currentAdTimestamps = adTimestamps;

    // 保存到本地存储
    if (currentVideoId) {
        adskipStorage.saveAdTimestampsForVideo(currentVideoId, adTimestamps);
    }

    // 清除旧监控
    if (window.adSkipCheckInterval) {
        clearInterval(window.adSkipCheckInterval);
        adskipUtils.logDebug('清除旧的广告监控定时器', { throttle: 2000 });
        window.adSkipCheckInterval = null;
    }

    // 添加window unload事件监听，确保在页面卸载时清理资源
    window.addEventListener('unload', function() {
        if (window.adSkipCheckInterval) {
            clearInterval(window.adSkipCheckInterval);
            window.adSkipCheckInterval = null;
        }
    });

    // 启动播放时间监控
    setupPlaybackTimeMonitor();

    // 设置新监控，使用try-catch包装以处理可能的错误
    try {
        window.adSkipCheckInterval = setInterval(function() {
            // 先检查扩展上下文是否仍然有效
            if (!extensionAvailable && !adskipUtils.checkExtensionContext()) {
                clearInterval(window.adSkipCheckInterval);
                window.adSkipCheckInterval = null;
                return;
            }

            try {
                checkAndSkip();
            } catch (e) {
                // 捕获checkAndSkip中可能出现的错误
                if (e.message && e.message.includes('Extension context invalidated')) {
                    extensionAvailable = false;
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                    console.log("Bilibili广告跳过插件：扩展上下文已失效，请刷新页面");
                } else {
                    console.error("广告跳过检查出错:", e);
                }
            }
        }, 500);
        adskipUtils.logDebug('设置新的广告监控定时器', { throttle: 2000 });
    } catch (e) {
        console.error("设置广告监控失败:", e);
    }

    // 标记进度条上的广告位点
    markAdPositionsOnProgressBar();
}

/**
 * 核心检查函数 - 简化逻辑
 */
function checkAndSkip() {
    // 检查扩展上下文是否有效
    if (!extensionAvailable && !adskipUtils.checkExtensionContext()) {
        // 如果扩展上下文已失效，停止所有操作
        if (window.adSkipCheckInterval) {
            clearInterval(window.adSkipCheckInterval);
            window.adSkipCheckInterval = null;
        }
        return;
    }

    // 检查是否启用广告跳过功能
    try {
        chrome.storage.local.get('adskip_enabled', async function(result) {
            // 再次检查扩展上下文是否有效
            if (!extensionAvailable) return;

            if (result.adskip_enabled === false) {
                // 使用节流控制，1秒内不重复输出相同消息
                adskipUtils.logDebug('广告跳过功能已禁用，不执行检查', { throttle: 1000 });
                return;
            }

            // 获取当前视频的UP主信息
            const { uploader } = await adskipStorage.getCurrentVideoUploader();

            // 检查UP主是否在白名单中
            const isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);
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
                    adskipUtils.logDebug(`UP主"${uploader}"在白名单中且启用状态，不执行自动跳过 (手动模式：${!globalSkipEnabled ? '是' : '否'})`);
                }
                return;
            }

            // 只在状态变化时输出日志
            if (statusChanged) {
                adskipUtils.logDebug(`当前视频UP主："${uploader}", 白名单状态：${isUploaderWhitelisted ? '启用' : '未启用/不在白名单'}, 全局跳过：${globalSkipEnabled ? '开启' : '关闭'}`);
            }

            // 以下是检查和跳过广告的实际逻辑
            let lastCheckTime = 0;

            // 查找视频播放器
            const videoPlayer = adskipUtils.findVideoPlayer();

            if (!videoPlayer) {
                // 使用节流控制，1秒内不重复输出相同消息
                adskipUtils.logDebug('未找到视频播放器', { throttle: 1000 });
                return;
            }

            // 设置seeking事件监听
            if (videoPlayer) {
                // 使用命名函数，避免重复添加匿名事件监听器
                if (!videoPlayer._adskipSeekingHandler) {
                    videoPlayer._adskipSeekingHandler = function(e) {
                        if (scriptInitiatedSeek) {
                            adskipUtils.logDebug("这是脚本引起的seeking事件，忽略");
                            scriptInitiatedSeek = false;
                        }
                    };

                    videoPlayer.addEventListener('seeking', videoPlayer._adskipSeekingHandler);
                }
            }

            if (videoPlayer.paused || videoPlayer.ended) return;

            const currentTime = videoPlayer.currentTime;

            // 更新时间缓存
            lastKnownPlaybackTime = currentTime;
            lastPlaybackTimeUpdate = Date.now();

            // 检查视频ID是否变化
            const newVideoId = adskipUtils.getCurrentVideoId();
            if (newVideoId !== currentVideoId && newVideoId !== '') {
                adskipUtils.logDebug(`视频ID变化检测 (checkAndSkip): ${currentVideoId} -> ${newVideoId}`);
                lastVideoId = currentVideoId;
                currentVideoId = newVideoId;
                reinitialize();
                return;
            }

            // 记录时间跳跃情况，使用节流避免频繁日志
            if (Math.abs(currentTime - lastCheckTime) > 3 && lastCheckTime > 0) {
                adskipUtils.logDebug(`检测到大幅时间跳跃: ${lastCheckTime.toFixed(2)} -> ${currentTime.toFixed(2)}`, { throttle: 500 });
            }
            lastCheckTime = currentTime;

            // 广告检测逻辑：使用百分比计算
            for (const ad of currentAdTimestamps) {
                // 计算广告时长
                const adDuration = ad.end_time - ad.start_time;

                // 根据百分比计算跳过点，但至少跳过1秒
                const skipDuration = Math.max(1, (adDuration * adSkipPercentage / 100));

                // 确定广告的"开始区域"：从开始到min(开始+跳过时长,结束)
                const adStartRange = Math.min(ad.start_time + skipDuration, ad.end_time);

                // 如果在广告开始区域，直接跳到结束
                if (currentTime >= ad.start_time && currentTime < adStartRange) {
                    adskipUtils.logDebug(`检测到在广告开始区域 [${ad.start_time.toFixed(1)}s-${adStartRange.toFixed(1)}s]，应用跳过范围:前${adSkipPercentage}%，跳过至${ad.end_time.toFixed(1)}s`);

                    // 标记为脚本操作并跳转
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = ad.end_time;
                    adskipUtils.logDebug(`已跳过广告: ${ad.start_time.toFixed(1)}s-${ad.end_time.toFixed(1)}s`);
                    break;
                }
            }
        });
    } catch(e) {
        // 捕获任何可能的错误
        if (e.message && e.message.includes('Extension context invalidated')) {
            extensionAvailable = false;
            if (window.adSkipCheckInterval) {
                clearInterval(window.adSkipCheckInterval);
                window.adSkipCheckInterval = null;
            }
            console.log("Bilibili广告跳过插件：扩展上下文已失效，请刷新页面");
        } else {
            console.error("Bilibili广告跳过插件错误:", e);
        }
    }
}

/**
 * 标记视频进度条上的广告位点
 */
function markAdPositionsOnProgressBar() {
    // 判断是否有广告时间戳
    if (!currentAdTimestamps || currentAdTimestamps.length === 0) {
        // 移除所有现有标记，避免残留
        document.querySelectorAll('.adskip-marker-container').forEach(function(marker) {
            marker.remove();
        });
        // 减少日志输出，只在调试且未被过滤的情况下输出
        if (debugMode && !adskipUtils.isLogFiltered('没有广告时间戳，不标记进度条')) {
            adskipUtils.logDebug('没有广告时间戳，不标记进度条', { throttle: 5000 });
        }
        return;
    }

    // 只在调试模式下输出，且使用节流控制
    adskipUtils.logDebug('标记视频进度条上的广告位点', { throttle: 2000 });

    // 先移除旧的标记
    document.querySelectorAll('.adskip-marker-container').forEach(function(marker) {
        marker.remove();
    });

    // 找到视频元素
    const videoPlayer = adskipUtils.findVideoPlayer();

    if (!videoPlayer || !videoPlayer.duration) {
        adskipUtils.logDebug('未找到视频播放器或视频时长不可用，稍后重试标记', { throttle: 2000 });
        // 如果视频播放器不可用或时长不可用，稍后再试
        setTimeout(markAdPositionsOnProgressBar, 1000);
        return;
    }

    // 找到进度条容器
    const progressBarContainer = adskipUtils.findProgressBar();

    if (!progressBarContainer) {
        adskipUtils.logDebug('未找到进度条容器，稍后重试标记', { throttle: 2000 });
        // 如果进度条不可用，稍后再试
        setTimeout(markAdPositionsOnProgressBar, 1000);
        return;
    }

    // 创建标记容器
    const markerContainer = document.createElement('div');
    markerContainer.className = 'adskip-marker-container';
    // 立即设置时间戳标记，避免重复标记
    markerContainer.setAttribute('data-updated', adskipUtils.timestampsToString(currentAdTimestamps));
    progressBarContainer.appendChild(markerContainer);

    // 获取视频总时长
    const videoDuration = videoPlayer.duration;

    // 为每个广告段创建标记
    currentAdTimestamps.forEach(function(ad, index) {
        // 计算位置百分比
        const startPercent = (ad.start_time / videoDuration) * 100;
        const endPercent = (ad.end_time / videoDuration) * 100;
        const width = endPercent - startPercent;

        // 创建广告区间标记元素
        const marker = document.createElement('div');
        marker.className = 'adskip-marker';
        marker.style.left = `${startPercent}%`;
        marker.style.width = `${width}%`;
        marker.setAttribute('data-index', index);
        marker.setAttribute('data-start-time', ad.start_time);
        marker.setAttribute('data-end-time', ad.end_time);
        markerContainer.appendChild(marker);

        // 创建提示元素
        const tooltip = document.createElement('div');
        tooltip.className = 'adskip-marker-tooltip';
        tooltip.style.left = `${startPercent + (width / 2)}%`;
        tooltip.textContent = `广告: ${adskipUtils.formatSingleTimestamp(ad.start_time, ad.end_time)}`;
        markerContainer.appendChild(tooltip);

        // 为标记添加事件监听
        marker.addEventListener('mouseenter', function() {
            tooltip.style.opacity = '1';
        });

        marker.addEventListener('mouseleave', function() {
            tooltip.style.opacity = '0';
        });

        // 添加点击事件 - 实现手动跳过功能
        marker.addEventListener('click', async function(e) {
            // 阻止事件冒泡，以防触发进度条的点击事件
            e.stopPropagation();
            e.preventDefault(); // 添加阻止默认行为

            // 使用缓存的播放时间，而不是直接获取
            const currentPlaybackTime = getCurrentRealPlaybackTime();

            // 记录调试信息，包括时间缓存更新时间
            adskipUtils.logDebug(`时间缓存状态: 当前缓存时间=${lastKnownPlaybackTime.toFixed(2)}s, 上次更新=${Date.now() - lastPlaybackTimeUpdate}ms前`);

            const adStartTime = parseFloat(marker.getAttribute('data-start-time'));
            const adEndTime = parseFloat(marker.getAttribute('data-end-time'));

            // 计算点击位置对应的视频时间点
            const rect = marker.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const markerWidth = rect.width;
            const clickRatio = clickX / markerWidth; // 点击位置在标记内的比例

            // 根据比例计算对应的时间点
            const adDuration = adEndTime - adStartTime;
            const clickTimePosition = adStartTime + (adDuration * clickRatio);

            // 检查全局是否关闭了广告跳过
            chrome.storage.local.get('adskip_enabled', async function(result) {
                const globalSkipEnabled = result.adskip_enabled !== false;

                // 获取当前UP主信息
                const { uploader } = await adskipStorage.getCurrentVideoUploader();

                // 检查UP主是否在白名单中
                const isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);

                // 检查当前播放器时间 - 用于比较验证
                const currentVideoTime = videoPlayer.currentTime;

                // 检查是否在广告时间范围内
                const isInAdRange = currentPlaybackTime >= adStartTime && currentPlaybackTime < adEndTime;

                // 检查点击位置是否在当前播放进度之后
                const isClickAheadOfPlayback = clickTimePosition > currentPlaybackTime;

                // 记录详细的调试信息，同时记录实时播放器时间和缓存时间的差异
                adskipUtils.logDebug(`点击处理 - 缓存时间: ${currentPlaybackTime.toFixed(2)}s, 实时时间: ${currentVideoTime.toFixed(2)}s, 差异: ${(currentVideoTime - currentPlaybackTime).toFixed(2)}s, 广告范围: ${adStartTime.toFixed(2)}s-${adEndTime.toFixed(2)}s, 点击位置时间: ${clickTimePosition.toFixed(2)}s, UP主: ${uploader}, 白名单状态: ${isUploaderWhitelisted ? '是' : '否'}`);

                // 满足条件时执行跳过：
                // 1. 全局跳过关闭或UP主在白名单中，且
                // 2. 当前播放位置在广告范围内，且
                // 3. 点击位置在当前播放进度之后
                if (((!globalSkipEnabled) || (globalSkipEnabled && isUploaderWhitelisted)) && isInAdRange && isClickAheadOfPlayback) {
                    adskipUtils.logDebug(`手动跳过广告: ${adStartTime.toFixed(2)}s-${adEndTime.toFixed(2)}s (点击位置: ${clickTimePosition.toFixed(2)}s)，跳转前时间: ${currentPlaybackTime.toFixed(2)}s`);
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = adEndTime;
                } else if (globalSkipEnabled && !isUploaderWhitelisted) {
                    // 如果全局跳过功能开启且UP主不在白名单中，告知用户
                    adskipUtils.logDebug('全局广告跳过已启用，无需手动跳过');
                    // 可以在这里添加一个临时提示
                } else if (!isInAdRange) {
                    // 如果不在广告范围内
                    adskipUtils.logDebug(`当前不在广告范围内，不执行跳过`);
                } else if (!isClickAheadOfPlayback) {
                    // 如果点击位置在当前播放进度之前
                    adskipUtils.logDebug(`点击位置 (${clickTimePosition.toFixed(2)}s) 在当前播放进度 (${currentPlaybackTime.toFixed(2)}s) 之前，不执行跳过`);
                }
            });
        });

        // 如果启用了百分比跳过，显示跳过区域
        if (adSkipPercentage > 0) {
            // 计算跳过区域
            const adDuration = ad.end_time - ad.start_time;
            const skipDuration = Math.max(1, (adDuration * adSkipPercentage / 100));
            const skipEndPercent = (Math.min(ad.start_time + skipDuration, ad.end_time) / videoDuration) * 100;
            const skipWidth = skipEndPercent - startPercent;

            // 创建跳过区域标记
            const skipMarker = document.createElement('div');
            skipMarker.className = 'adskip-skip-marker';
            skipMarker.style.left = `${startPercent}%`;
            skipMarker.style.width = `${skipWidth}%`;
            skipMarker.setAttribute('data-index', `skip-${index}`);
            markerContainer.appendChild(skipMarker);
        }
    });

    // 增加节流控制，延长节流时间以减少重复日志
    adskipUtils.logDebug(`已标记 ${currentAdTimestamps.length} 个广告位点`, { throttle: 5000 });
}

/**
 * 设置广告标记监控
 */
function setupAdMarkerMonitor() {
    // 清除旧监听器
    if (window.adMarkerInterval) {
        clearInterval(window.adMarkerInterval);
        window.adMarkerInterval = null;
    }

    // 定期检查进度条和更新标记
    window.adMarkerInterval = setInterval(function() {
        // 如果没有广告时间戳，则不执行任何操作
        if (!currentAdTimestamps || currentAdTimestamps.length === 0) {
            return;
        }

        // 检查视频播放器和进度条是否存在
        const videoPlayer = adskipUtils.findVideoPlayer();
        const progressBar = adskipUtils.findProgressBar();

        if (videoPlayer && progressBar) {
            // 检查是否需要更新标记
            const markerContainer = document.querySelector('.adskip-marker-container');

            // 检查标记容器是否存在且已更新
            const currentTimestampsString = adskipUtils.timestampsToString(currentAdTimestamps);
            const isUpdated = markerContainer &&
                              markerContainer.getAttribute('data-updated') === currentTimestampsString;

            // 只有当标记不存在或时间戳变化时才更新
            if (!isUpdated) {
                adskipUtils.logDebug('广告时间戳变化或进度条更新，重新标记进度条', { throttle: 3000 });
                markAdPositionsOnProgressBar();

                // 标记容器已更新
                const updatedContainer = document.querySelector('.adskip-marker-container');
                if (updatedContainer) {
                    updatedContainer.setAttribute('data-updated', currentTimestampsString);
                }
            }
        }
    }, 2000);

    // 视频加载事件，确保获取准确的视频时长
    function setupVideoEvents() {
        const videoPlayer = adskipUtils.findVideoPlayer();

        if (videoPlayer) {
            // 使用命名函数来避免添加重复的事件监听器
            if (!videoPlayer._adskipMetadataHandler) {
                videoPlayer._adskipMetadataHandler = function() {
                    if (currentAdTimestamps && currentAdTimestamps.length > 0) {
                        markAdPositionsOnProgressBar();
                    }
                };
                videoPlayer.addEventListener('loadedmetadata', videoPlayer._adskipMetadataHandler);
            }

            if (!videoPlayer._adskipDurationHandler) {
                videoPlayer._adskipDurationHandler = function() {
                    if (currentAdTimestamps && currentAdTimestamps.length > 0) {
                        markAdPositionsOnProgressBar();
                    }
                };
                videoPlayer.addEventListener('durationchange', videoPlayer._adskipDurationHandler);
            }
        } else {
            // 如果找不到视频播放器，稍后再试
            setTimeout(setupVideoEvents, 1000);
        }
    }

    // 只有在有广告时间戳时才设置视频事件
    if (currentAdTimestamps && currentAdTimestamps.length > 0) {
        setupVideoEvents();
    }
}

/**
 * 监控URL变化
 */
function setupUrlChangeMonitor() {
    let lastUrl = window.location.href;

    // 使用MutationObserver监视DOM变化可能表明URL变化
    const observer = new MutationObserver(function(mutations) {
        if (lastUrl !== window.location.href) {
            adskipUtils.logDebug(`URL变化检测到: ${lastUrl} -> ${window.location.href}`);
            lastUrl = window.location.href;

            // 刷新当前视频ID
            const newVideoId = adskipUtils.getCurrentVideoId();
            if (newVideoId !== currentVideoId && newVideoId !== '') {
                adskipUtils.logDebug(`视频ID变化检测 (observer): ${currentVideoId} -> ${newVideoId}`);
                lastVideoId = currentVideoId;
                currentVideoId = newVideoId;
                reinitialize();
            }
        }
    });

    observer.observe(document, {subtree: true, childList: true});
    adskipUtils.logDebug('URL变化监视器已设置');

    // 设置直接监听popstate和hashchange事件
    window.addEventListener('popstate', function() {
        adskipUtils.logDebug('检测到popstate事件，可能是URL变化');
        checkForVideoChange();
    });

    window.addEventListener('hashchange', function() {
        adskipUtils.logDebug('检测到hashchange事件，可能是URL变化');
        checkForVideoChange();
    });
}

/**
 * 检查视频是否变化
 */
function checkForVideoChange() {
    const newVideoId = adskipUtils.getCurrentVideoId();
    if (newVideoId !== currentVideoId && newVideoId !== '') {
        adskipUtils.logDebug(`视频ID变化检测 (event): ${currentVideoId} -> ${newVideoId}`);
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

    // 重新解析URL中的广告跳过参数
    const currentUrlAdTimestamps = adskipUtils.parseAdSkipParam();
    urlAdTimestamps = currentUrlAdTimestamps; // 更新全局变量

    // 尝试从本地存储加载
    const savedTimestamps = await adskipStorage.loadAdTimestampsForVideo(currentVideoId);

    // 获取所有保存的数据，用于比较
    chrome.storage.local.get(null, function(items) {
        const allKeys = Object.keys(items);
        // 正确过滤出只与视频ID相关的键，排除所有设置键和当前视频
        const adskipKeys = allKeys.filter(key =>
            key.startsWith('adskip_') &&
            key !== 'adskip_debug_mode' &&
            key !== 'adskip_enabled' &&
            key !== 'adskip_percentage' &&
            key !== 'adskip_admin_authorized' &&
            key !== 'adskip_uploader_whitelist' &&
            // 重要：排除当前视频自己的记录
            key !== `adskip_${currentVideoId}`
        );
        let matchFound = false;

        // 检查当前URL中的时间戳是否与任何已保存的时间戳匹配
        if (currentUrlAdTimestamps.length > 0) {
            const currentTimeString = adskipUtils.timestampsToString(currentUrlAdTimestamps);

            adskipUtils.logDebug(`检查URL参数 [${currentTimeString}] 是否与其他视频的广告时间戳匹配`, { throttle: 1000 });

            // 遍历所有保存的其他视频数据，检查是否有匹配的时间戳
            for (const key of adskipKeys) {
                try {
                    const data = items[key];
                    const parsed = JSON.parse(data);

                    // 适应数据格式，确保获取正确的timestamps数组
                    const timestamps = parsed.timestamps || parsed;

                    if (Array.isArray(timestamps)) {
                        const savedTimeString = adskipUtils.timestampsToString(timestamps);

                        if (currentTimeString === savedTimeString) {
                            matchFound = true;
                            const otherVideoId = key.replace('adskip_', '');
                            adskipUtils.logDebug(`找到匹配的时间戳记录: 视频 ${otherVideoId} 的时间戳 [${savedTimeString}] 与当前URL参数相同，可能是视频切换造成的污染`);
                            break;
                        }
                    }
                } catch (e) {
                    adskipUtils.logDebug(`解析存储数据失败: ${key}`, e);
                }
            }

            if (matchFound) {
                // 如果找到其他视频的匹配记录，则判定为污染，设置为空值
                adskipUtils.logDebug('URL adskip 参数与其他视频记录匹配，判定为视频切换污染，清空参数');
                currentAdTimestamps = [];
                urlAdTimestamps = [];

                // 清除现有的监控
                if (window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                }
            } else if (savedTimestamps.length > 0) {
                // 如果没有匹配的污染，但当前视频有保存的时间戳，优先使用保存的
                setupAdSkipMonitor(savedTimestamps);
                currentAdTimestamps = [...savedTimestamps];
                adskipUtils.logDebug('没有检测到URL参数污染，优先使用当前视频已保存的广告时间段');
            } else {
                // 没有匹配的污染，且当前视频没有保存的时间戳，使用URL中的参数
                setupAdSkipMonitor(currentUrlAdTimestamps);
                currentAdTimestamps = [...currentUrlAdTimestamps];
                urlAdTimestamps = [...currentUrlAdTimestamps];
                adskipUtils.logDebug('使用URL中的广告时间段初始化或更新');
            }
        } else if (savedTimestamps.length > 0) {
            setupAdSkipMonitor(savedTimestamps);
            currentAdTimestamps = [...savedTimestamps];
            adskipUtils.logDebug('使用保存的广告时间段');
        } else {
            currentAdTimestamps = [];
            // 清除现有的监控
            if (window.adSkipCheckInterval) {
                clearInterval(window.adSkipCheckInterval);
                window.adSkipCheckInterval = null;
            }
            adskipUtils.logDebug('没有找到广告时间段，清除监控');
        }

        // 更新面板中的信息（如果面板已打开）
        const inputElement = document.getElementById('adskip-input');
        if (inputElement) {
            inputElement.value = adskipUtils.timestampsToString(currentAdTimestamps);

            // 更新视频ID显示
            const videoIdElement = document.querySelector('.adskip-video-id');
            if (videoIdElement) {
                videoIdElement.textContent = `当前视频: ${currentVideoId || '未识别'}`;
            }
        }
    });
}

// 添加存储变更监听器
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace !== 'local') return;

    // 监听广告跳过功能开关变化
    if (changes.adskip_enabled !== undefined) {
        const isEnabled = changes.adskip_enabled.newValue !== false;
        adskipUtils.logDebug(`广告跳过功能状态已更新: ${isEnabled ? '启用' : '禁用'}`);

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
        debugMode = changes.adskip_debug_mode.newValue || false;
        adskipUtils.logDebug(`调试模式状态已更新: ${debugMode ? '启用' : '禁用'}`);
    }

    // 监听广告跳过百分比变化
    if (changes.adskip_percentage !== undefined) {
        adSkipPercentage = changes.adskip_percentage.newValue;
        adskipUtils.logDebug(`广告跳过百分比已更新: ${adSkipPercentage}%`);

        // 如果已启用自动跳过且有广告时间段，重新应用设置
        chrome.storage.local.get('adskip_enabled', function(result) {
            if (result.adskip_enabled !== false && currentAdTimestamps.length > 0) {
                setupAdSkipMonitor(currentAdTimestamps);
            }
        });
    }

    // 监听白名单变化
    if (changes.adskip_uploader_whitelist !== undefined) {
        adskipUtils.logDebug('白名单已更新，重新检查当前视频UP主状态');

        // 重新检查当前视频UP主是否在白名单中
        (async function() {
            const { uploader } = await adskipStorage.getCurrentVideoUploader();
            const isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);
            adskipUtils.logDebug(`白名单更新后检查: UP主 "${uploader}" 白名单状态: ${isUploaderWhitelisted ? '在白名单中' : '不在白名单中'}`);

            // 更新已打开面板中的UI元素（如果面板已打开）
            const panel = document.getElementById('adskip-panel');
            if (panel) {
                // 更新开关状态
                const whitelistToggle = document.getElementById('adskip-whitelist-toggle');
                if (whitelistToggle) {
                    whitelistToggle.checked = isUploaderWhitelisted;
                }

                // 更新模式描述
                chrome.storage.local.get('adskip_enabled', function(result) {
                    const globalSkipEnabled = result.adskip_enabled !== false;
                    const toggleDesc = document.querySelector('.adskip-toggle-desc');

                    if (toggleDesc) {
                        if (!globalSkipEnabled) {
                            toggleDesc.textContent = '⏸️ 手动模式，可以点击广告区域手动跳过';
                        } else if (isUploaderWhitelisted) {
                            toggleDesc.textContent = '🔹 白名单已启用，仅手动跳过';
                        } else {
                            toggleDesc.textContent = '✅ 自动跳过已启用';
                        }
                    }
                });

                // 使用统一的状态显示函数，传递正确的参数顺序
                if (typeof adskipUI !== 'undefined' && adskipUI.updateStatusDisplay) {
                    adskipUI.updateStatusDisplay('白名单状态已更新', 'info');
                }
            }
        })();
    }
});

// 导出模块函数
window.adskipVideoMonitor = {
    setupAdSkipMonitor,
    checkAndSkip,
    markAdPositionsOnProgressBar,
    setupAdMarkerMonitor,
    setupUrlChangeMonitor,
    checkForVideoChange,
    reinitialize,
    getCurrentRealPlaybackTime // 导出新函数
};