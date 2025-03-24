/**
 * videoMonitor.js - 视频监控模块
 * 处理视频监控和广告跳过的核心逻辑
 */

'use strict';

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
        adskipUtils.logDebug('清除旧的广告监控定时器');
        window.adSkipCheckInterval = null;
    }

    // 添加window unload事件监听，确保在页面卸载时清理资源
    window.addEventListener('unload', function() {
        if (window.adSkipCheckInterval) {
            clearInterval(window.adSkipCheckInterval);
            window.adSkipCheckInterval = null;
        }
    });

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
        adskipUtils.logDebug('设置新的广告监控定时器');
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
        chrome.storage.local.get('adskip_enabled', function(result) {
            // 再次检查扩展上下文是否有效
            if (!extensionAvailable) return;

            if (result.adskip_enabled === false) {
                adskipUtils.logDebug('广告跳过功能已禁用，不执行检查');
                return;
            }

            // 以下是检查和跳过广告的实际逻辑
            let lastCheckTime = 0;

            // 查找视频播放器
            const videoPlayer = adskipUtils.findVideoPlayer();

            if (!videoPlayer) {
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

            // 检查视频ID是否变化
            const newVideoId = adskipUtils.getCurrentVideoId();
            if (newVideoId !== currentVideoId && newVideoId !== '') {
                adskipUtils.logDebug(`视频ID变化检测 (checkAndSkip): ${currentVideoId} -> ${newVideoId}`);
                lastVideoId = currentVideoId;
                currentVideoId = newVideoId;
                reinitialize();
                return;
            }

            // 记录时间跳跃情况
            if (Math.abs(currentTime - lastCheckTime) > 3 && lastCheckTime > 0) {
                adskipUtils.logDebug(`检测到大幅时间跳跃: ${lastCheckTime} -> ${currentTime}`);
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
                    adskipUtils.logDebug(`检测到在广告开始区域 [${ad.start_time}s-${adStartRange}s]，应用跳过范围:前${adSkipPercentage}%，跳过至${ad.end_time}s`);

                    // 标记为脚本操作并跳转
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = ad.end_time;
                    adskipUtils.logDebug(`已跳过广告: ${ad.start_time}s-${ad.end_time}s`);
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
    adskipUtils.logDebug('标记视频进度条上的广告位点');

    // 先移除旧的标记
    document.querySelectorAll('.adskip-marker-container').forEach(function(marker) {
        marker.remove();
    });

    // 如果没有广告时间戳，则不标记
    if (!currentAdTimestamps || currentAdTimestamps.length === 0) {
        adskipUtils.logDebug('没有广告时间戳，不标记进度条');
        return;
    }

    // 找到视频元素
    const videoPlayer = adskipUtils.findVideoPlayer();

    if (!videoPlayer || !videoPlayer.duration) {
        adskipUtils.logDebug('未找到视频播放器或视频时长不可用，稍后重试标记');
        // 如果视频播放器不可用或时长不可用，稍后再试
        setTimeout(markAdPositionsOnProgressBar, 1000);
        return;
    }

    // 找到进度条容器
    const progressBarContainer = adskipUtils.findProgressBar();

    if (!progressBarContainer) {
        adskipUtils.logDebug('未找到进度条容器，稍后重试标记');
        // 如果进度条不可用，稍后再试
        setTimeout(markAdPositionsOnProgressBar, 1000);
        return;
    }

    // 创建标记容器
    const markerContainer = document.createElement('div');
    markerContainer.className = 'adskip-marker-container';
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
        marker.addEventListener('click', function(e) {
            // 阻止事件冒泡，以防触发进度条的点击事件
            e.stopPropagation();

            // 检查全局是否关闭了广告跳过
            chrome.storage.local.get('adskip_enabled', function(result) {
                const globalSkipEnabled = result.adskip_enabled !== false;
                const currentTime = videoPlayer.currentTime;
                const adStartTime = parseFloat(marker.getAttribute('data-start-time'));
                const adEndTime = parseFloat(marker.getAttribute('data-end-time'));

                // 检查是否在广告时间范围内
                const isInAdRange = currentTime >= adStartTime && currentTime < adEndTime;

                // 如果全局跳过功能关闭，并且当前时间在广告范围内，允许手动跳过
                if (!globalSkipEnabled && isInAdRange) {
                    adskipUtils.logDebug(`手动跳过广告: ${adStartTime}s-${adEndTime}s`);
                    scriptInitiatedSeek = true;
                    videoPlayer.currentTime = adEndTime;
                } else if (globalSkipEnabled) {
                    // 如果全局跳过功能开启，告知用户
                    adskipUtils.logDebug('全局广告跳过已启用，无需手动跳过');
                    // 可以在这里添加一个临时提示
                } else if (!isInAdRange) {
                    // 如果不在广告范围内，可以选择跳转到广告开始处或结束处
                    adskipUtils.logDebug(`当前不在广告范围内，不执行跳过`);
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

    adskipUtils.logDebug(`已标记 ${currentAdTimestamps.length} 个广告位点`);
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
        // 检查视频播放器和进度条是否存在
        const videoPlayer = adskipUtils.findVideoPlayer();
        const progressBar = adskipUtils.findProgressBar();

        if (videoPlayer && progressBar) {
            // 检查是否需要更新标记
            const markerContainer = document.querySelector('.adskip-marker-container');
            const needUpdate = !markerContainer || markerContainer.getAttribute('data-updated') !== adskipUtils.timestampsToString(currentAdTimestamps);

            if (needUpdate) {
                adskipUtils.logDebug('广告时间戳变化或进度条更新，重新标记进度条');
                markAdPositionsOnProgressBar();

                // 标记容器已更新
                const updatedContainer = document.querySelector('.adskip-marker-container');
                if (updatedContainer) {
                    updatedContainer.setAttribute('data-updated', adskipUtils.timestampsToString(currentAdTimestamps));
                }
            }
        }
    }, 2000);

    // 视频加载事件，确保获取准确的视频时长
    function setupVideoEvents() {
        const videoPlayer = adskipUtils.findVideoPlayer();

        if (videoPlayer) {
            videoPlayer.removeEventListener('loadedmetadata', markAdPositionsOnProgressBar);
            videoPlayer.addEventListener('loadedmetadata', markAdPositionsOnProgressBar);

            videoPlayer.removeEventListener('durationchange', markAdPositionsOnProgressBar);
            videoPlayer.addEventListener('durationchange', markAdPositionsOnProgressBar);
        } else {
            // 如果找不到视频播放器，稍后再试
            setTimeout(setupVideoEvents, 1000);
        }
    }

    setupVideoEvents();
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
        const adskipKeys = allKeys.filter(key => key.startsWith('adskip_') && key !== 'adskip_debug_mode');
        let matchFound = false;

        // 检查当前URL中的时间戳是否与任何已保存的时间戳匹配
        if (currentUrlAdTimestamps.length > 0) {
            const currentTimeString = adskipUtils.timestampsToString(currentUrlAdTimestamps);

            // 遍历所有保存的视频数据，检查是否有匹配的时间戳
            for (const key of adskipKeys) {
                try {
                    const data = items[key];
                    const timestamps = JSON.parse(data);
                    const savedTimeString = adskipUtils.timestampsToString(timestamps);

                    if (currentTimeString === savedTimeString) {
                        matchFound = true;
                        adskipUtils.logDebug(`找到匹配的时间戳记录: ${key}, 时间戳: ${savedTimeString}`);
                        break;
                    }
                } catch (e) {
                    console.error(`--==--LOG: 解析存储数据失败: ${key}`, e);
                }
            }

            if (matchFound) {
                // 如果找到匹配，则设置为空值（可能是异常的URL传递）
                adskipUtils.logDebug('URL adskip 参数与已保存记录匹配，设置为空值');
                currentAdTimestamps = [];
                urlAdTimestamps = [];

                // 清除现有的监控
                if (window.adSkipCheckInterval) {
                    clearInterval(window.adSkipCheckInterval);
                    window.adSkipCheckInterval = null;
                }
            } else {
                // 没有找到匹配，使用URL中的参数
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

// 导出模块函数
window.adskipVideoMonitor = {
    setupAdSkipMonitor,
    checkAndSkip,
    markAdPositionsOnProgressBar,
    setupAdMarkerMonitor,
    setupUrlChangeMonitor,
    checkForVideoChange,
    reinitialize
};