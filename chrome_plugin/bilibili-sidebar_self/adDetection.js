/**
 * adDetection.js - 广告检测模块
 * 实现基于字幕的广告检测和处理功能
 */

'use strict';

// 视频状态定义
const VIDEO_STATUS = {
    NO_SUBTITLE: 0,      // 当前视频没字幕信息，无法识别广告
    NO_ADS: 1,           // 当前视频有字幕信息，且服务器有记录，没有广告信息
    HAS_ADS: 2,          // 当前视频有字幕信息，且服务器有记录，有广告区间
    UNDETECTED: 3,        // 当前视频有字幕信息，且服务器没有记录
    DETECTING: 4,         // 当前视频有字幕信息，且在请求服务器处理识别广告区间中
    PREPARE: 5           // 准备状态，等待自动检测或用户操作
};

// 全局变量
window.adskipAdDetection = window.adskipAdDetection || {};
let autoDetectTimerId = null; // 用于存储自动检测的setTimeout ID

/**
 * 获取视频字幕数据
 * 整合来自adskipSubtitleService的视频信息和字幕数据
 * @param {boolean} forceRefresh 是否强制刷新缓存
 * @returns {Promise<Object>} 完整的keyParams对象，包含视频元数据和字幕内容
 */
async function getVideoSubtitleData(forceRefresh = false) {
    try {
        adskipUtils.logDebug('[AdSkip广告检测] 开始获取视频字幕数据...');


        // 获取当前视频信息
        const videoData = await adskipSubtitleService.getVideoData(forceRefresh);
        if (!videoData || !videoData.bvid) {
            throw new Error('无法获取视频信息');
        }

        // 获取字幕信息
        const subtitleInfo = await adskipSubtitleService.getVideoSubtitles();
        const subtitlePreview = await adskipSubtitleService.getSubtitlePreview();

        // 准备重要参数信息对象 - 使用与adminPanel兼容的字段名
        const keyParams = {
            bvid: videoData.bvid || '',
            title: videoData.title || '',
            owner: videoData.owner || { name: '', mid: '' },
            mid: videoData.owner?.mid || '',
            desc: videoData.desc || '',
            dynamic: videoData.dynamic || '',
            duration: videoData.duration || 0,
            pages: videoData.pages || [],
            pubdate: videoData.pubdate || 0,
            dimension: videoData.dimension,
            subtitle: videoData.subtitle || {},
            hasSubtitle: subtitleInfo.hasSubtitleFeature && subtitleInfo.subtitles.length > 0
        };

        // 添加字幕完整内容（如果有）
        if (keyParams.hasSubtitle) {
            try {
                // 找到默认字幕或第一个字幕
                const firstSubtitle = subtitleInfo.subtitles.find(sub => sub.isDefault) || subtitleInfo.subtitles[0];
                if (firstSubtitle) {
                    // 使用已经处理过的字幕数据
                    let subtitles = null;

                    // 检查是否已经有预处理好的字幕内容
                    if (subtitlePreview.rawSubtitleOriginal && Array.isArray(subtitlePreview.rawSubtitleOriginal)) {
                        adskipUtils.logDebug('[AdSkip广告检测] 使用已有的处理后字幕内容');
                        subtitles = subtitlePreview.rawSubtitleOriginal;
                    }
                    // 如果有完整的字幕处理结果
                    else if (subtitlePreview.rawFullSubtitle && subtitlePreview.rawFullSubtitle.subtitles) {
                        adskipUtils.logDebug('[AdSkip广告检测] 使用完整字幕处理结果');
                        subtitles = subtitlePreview.rawFullSubtitle.subtitles;
                    }
                    // 如果需要重新获取字幕（极少情况）
                    else if (!subtitles && firstSubtitle.url) {
                        adskipUtils.logDebug('[AdSkip广告检测] 需要重新获取字幕内容:', firstSubtitle.url);
                        const processedSubtitle = await adskipSubtitleService.downloadSubtitleFile(firstSubtitle.url);
                        if (processedSubtitle && processedSubtitle.subtitles) {
                            subtitles = processedSubtitle.subtitles;
                        }
                    }

                    // 保存字幕内容到keyParams，使用与adminPanel兼容的字段名
                    if (subtitles && subtitles.length > 0) {
                        keyParams.subtitle_contents = [subtitles];
                        adskipUtils.logDebug(`[AdSkip广告检测] 成功获取${subtitles.length}条字幕内容`);
                    } else {
                        keyParams.hasSubtitle = false;
                        adskipUtils.logDebug('[AdSkip广告检测] 未获取到字幕内容');
                    }
                }
            } catch (e) {
                keyParams.hasSubtitle = false;
                adskipUtils.logDebug('[AdSkip广告检测] 获取字幕内容失败:', e);
            }
        }

        adskipUtils.logDebug('[AdSkip广告检测] 字幕数据获取完成:', {
            bvid: keyParams.bvid,
            title: keyParams.title,
            hasSubtitle: keyParams.hasSubtitle,
            subtitlesCount: keyParams.subtitle_contents ? keyParams.subtitle_contents[0].length : 0
        });

        return keyParams;
    } catch (error) {
        adskipUtils.logDebug('[AdSkip广告检测] 获取视频字幕数据失败:', error);
        return {
            hasSubtitle: false,
            error: error.message
        };
    }
}

/**
 * 创建广告跳过按钮
 * @returns {HTMLElement} 创建的按钮元素
 */
function createAdSkipButton() {
    // 检查是否已存在
    let adskipButton = document.getElementById('adskip-button');
    if (adskipButton) {
        return adskipButton;
    }

    // 创建按钮
    adskipButton = document.createElement('div');
    adskipButton.id = 'adskip-button';
    adskipButton.className = 'adskip-button undetected';
    adskipButton.innerHTML = '点击检测广告';

    // 添加到播放器容器 (这部分可能仍需外部协调，暂时保留)
    // 建议: 按钮的创建和添加到DOM应该分离，或者提供一个父元素参数
    const playerContainer = document.querySelector('.bpx-player-container') || document.body;
    playerContainer.appendChild(adskipButton);

    // 设置点击事件监听器
    setupManualDetectionTrigger(adskipButton);

    adskipUtils.logDebug('[AdSkip广告检测] 创建广告跳过按钮完成');
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

    adskipUtils.logDebug(`[AdSkip广告检测] 更新按钮状态 -> ${Object.keys(VIDEO_STATUS).find(key => VIDEO_STATUS[key] === status)}(${status}), 原因: ${reason}, 数据:`, data);


    // 移除所有状态类
    button.classList.remove('no-subtitle', 'no-ads', 'has-ads', 'undetected', 'detecting', 'prepare');

    // 清除可能的动画类
    button.style.animation = '';

    // 设置新状态
    switch(status) {
        case VIDEO_STATUS.NO_SUBTITLE:
            button.classList.add('no-subtitle');
            button.innerHTML = '无字幕';
            break;

        case VIDEO_STATUS.NO_ADS:
            button.classList.add('no-ads');
            button.innerHTML = '没有广告';
            break;

        case VIDEO_STATUS.HAS_ADS:
            button.classList.add('has-ads');
            button.innerHTML = '已处理广告';
            // 保存广告时间戳数据
            if (data.adTimestamps) {
                button.dataset.adTimestamps = JSON.stringify(data.adTimestamps);
            } else {
                delete button.dataset.adTimestamps; // 清除旧数据
            }
            break;

        case VIDEO_STATUS.UNDETECTED:
            button.classList.add('undetected');
            button.innerHTML = '点击检测广告';
            delete button.dataset.adTimestamps; // 清除旧数据
            break;

        case VIDEO_STATUS.DETECTING:
            button.classList.add('detecting');
            button.innerHTML = '在检测啦！';
            // 应用动画
            button.style.animation = 'adskip-pulse 1.5s infinite';
            delete button.dataset.adTimestamps; // 清除旧数据
            break;

        case VIDEO_STATUS.PREPARE:
            button.classList.add('prepare');
            button.innerHTML = '少女准备中...';
            delete button.dataset.adTimestamps; // 清除旧数据
            break;

        default:
            adskipUtils.logDebug('[AdSkip广告检测] 未知状态，默认设为UNDETECTED:', status);
            button.classList.add('undetected');
            button.innerHTML = '点击检测广告';
            delete button.dataset.adTimestamps; // 清除旧数据
    }

    // 存储当前状态
    button.dataset.status = status;

    return button;
}

/**
 * 循环切换按钮状态 - 仅用于测试
 */
function cycleButtonStatus() {
    const button = document.getElementById('adskip-button');
    if (!button) return;

    const currentStatus = parseInt(button.dataset.status || '3');
    const nextStatus = (currentStatus + 1) % 5;

    // 测试数据
    const testData = {
        adTimestamps: [
            {start: 30, end: 45},
            {start: 120, end: 135}
        ]
    };

    updateVideoStatus(nextStatus, nextStatus === VIDEO_STATUS.HAS_ADS ? testData : {});

    adskipUtils.logDebug(`[AdSkip广告检测] 测试切换状态: ${currentStatus} -> ${nextStatus}`);
}

/**
 * 根据字幕数据更新按钮状态
 * 集中处理字幕检查和状态设置逻辑
 * @param {Array} adTimestamps 广告时间戳数组
 * @param {string} context 调用上下文，用于区分日志
 * @returns {Promise} 返回字幕数据处理的Promise
 */
function updateButtonStatusBasedOnSubtitle(adTimestamps = [], context = "初始化") {
    return getVideoSubtitleData().then(keyParams => {
        // 检查是否有字幕数据
        if (!keyParams.hasSubtitle) {
            // 没有字幕数据，设置为NO_SUBTITLE状态
            updateVideoStatus(VIDEO_STATUS.NO_SUBTITLE);
            adskipUtils.logDebug(`[AdSkip广告检测] ${context}后设置状态为NO_SUBTITLE（无字幕）`);
        } else {
            // 有字幕数据，根据是否有广告时间戳决定状态
            if (adTimestamps && adTimestamps.length > 0) {
                // 有广告时间戳，设置为HAS_ADS状态
                updateVideoStatus(VIDEO_STATUS.HAS_ADS, {
                    adTimestamps: adTimestamps
                });
                adskipUtils.logDebug(`[AdSkip广告检测] ${context}后设置状态为HAS_ADS`);
            } else {
                // 无广告时间戳，设置为UNDETECTED状态
                updateVideoStatus(VIDEO_STATUS.UNDETECTED);
                adskipUtils.logDebug(`[AdSkip广告检测] ${context}后设置状态为UNDETECTED`);
            }
        }
        return keyParams; // 返回字幕数据以便其他地方可能需要使用
    }).catch(error => {
        // 获取字幕数据出错，设置为NO_SUBTITLE状态
        adskipUtils.logDebug(`[AdSkip广告检测] ${context}后获取字幕数据出错，设置状态为NO_SUBTITLE`, error);
        updateVideoStatus(VIDEO_STATUS.NO_SUBTITLE);
        throw error; // 继续抛出错误便于调用方捕获
    });
}

/**
 * 验证存储模块功能——待删除
 * 创建临时按钮用于测试视频白名单和状态存储功能
 */
function validateStorageModule() {
    // 检查是否已存在
    if (document.getElementById('adskip-validate-storage-button')) {
        return;
    }

    // 创建临时测试按钮
    const validateButton = document.createElement('div');
    validateButton.id = 'adskip-validate-storage-button';
    validateButton.innerHTML = '测试白名单';

    // 样式
    validateButton.style.cssText = `
        position: fixed;
        top: 250px;
        right: 20px;
        background-color: rgba(56, 142, 60, 0.7);
        color: #f5f5f5;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        z-index: 9999;
        font-size: 13px;
        font-weight: 400;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(4px);
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // 悬停效果
    validateButton.addEventListener('mouseenter', () => {
        validateButton.style.backgroundColor = 'rgba(56, 142, 60, 0.85)';
    });

    validateButton.addEventListener('mouseleave', () => {
        validateButton.style.backgroundColor = 'rgba(56, 142, 60, 0.7)';
    });

    // 点击事件 - 测试存储模块功能
    validateButton.addEventListener('click', async () => {
        try {
            const videoId = adskipUtils.getCurrentVideoId().id;
            if (!videoId) {
                alert('未找到当前视频ID');
                return;
            }

            // 检查视频是否在无广告白名单中
            const isInWhitelist = await adskipStorage.checkVideoInNoAdsWhitelist(videoId);
            adskipUtils.logDebug(`[AdSkip验证] 视频 ${videoId} 在无广告白名单中: ${isInWhitelist}`);

            // 添加视频到无广告白名单
            await adskipStorage.addVideoToNoAdsWhitelist(videoId);

            // 再次检查以验证添加成功
            const isNowInWhitelist = await adskipStorage.checkVideoInNoAdsWhitelist(videoId);
            adskipUtils.logDebug(`[AdSkip验证] 添加后，视频 ${videoId} 在无广告白名单中: ${isNowInWhitelist}`);

            // 保存视频状态
            await adskipStorage.saveVideoStatus(videoId, VIDEO_STATUS.NO_ADS);

            // 获取视频状态以验证保存成功
            const storedStatus = await adskipStorage.getVideoStatus(videoId);
            adskipUtils.logDebug(`[AdSkip验证] 保存的视频状态: ${storedStatus}`);

            // 更新按钮状态为NO_ADS
            updateVideoStatus(VIDEO_STATUS.NO_ADS);

            // 显示验证结果
            alert(`验证结果:\n视频ID: ${videoId}\n白名单状态: ${isNowInWhitelist ? '在白名单中' : '不在白名单中'}\n保存的状态: ${storedStatus === VIDEO_STATUS.NO_ADS ? 'NO_ADS' : storedStatus}`);
        } catch (error) {
            adskipUtils.logDebug(`[AdSkip验证] 测试存储模块时出错: ${error.message}`);
            alert(`测试失败: ${error.message}`);
        }
    });

    // 添加到页面
    document.body.appendChild(validateButton);
}

/**
 * 处理视频的广告状态（核心逻辑）- 重构版
 * 优先级: URL > Storage > Whitelist > Prepare/Detect
 * @param {string} videoId - 当前视频ID
 * @param {Array} urlParamsTimestamps - 从URL参数解析的时间戳
 * @param {boolean} isInitialLoad - 是否为页面首次加载或视频切换后的首次处理
 * @returns {Promise<Object>} 处理结果，包含状态来源、最终状态等
 */
async function processVideoAdStatus(videoId, urlParamsTimestamps = [], isInitialLoad = false) {
    adskipUtils.logDebug(`[AdSkip广告检测] 开始处理视频状态. VideoID: ${videoId}, isInitialLoad: ${isInitialLoad}, URL Params Count: ${urlParamsTimestamps.length}`);

    // 1. 清理工作：清除上一个视频的自动检测定时器
    if (autoDetectTimerId) {
        clearTimeout(autoDetectTimerId);
        autoDetectTimerId = null;
        adskipUtils.logDebug('[AdSkip广告检测] 清除了上一个视频的自动检测定时器');
    }

    // 初始化结果对象
    let statusResult = {
        source: 'error',
        status: VIDEO_STATUS.UNDETECTED, // 默认错误或回退状态
        skipDataProcessing: true,         // 默认跳过后续处理，除非明确需要
        currentAdTimestamps: [],
        urlAdTimestamps: urlParamsTimestamps,
        statusData: {},
        hasSubtitle: false,
        duration: 0
    };

    try {
        // 2. 获取关键数据：视频和字幕信息
        const subtitleData = await getVideoSubtitleData(!isInitialLoad);
        if (!subtitleData || !subtitleData.bvid || subtitleData.bvid !== videoId) {
            adskipUtils.logDebug(`[AdSkip广告检测] 获取字幕数据失败或视频已切换 (${subtitleData?.bvid} vs ${videoId}). 中止处理.`);
            // 视频已切换或数据错误，显示中性状态，避免误导
            updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "视频已切换或数据错误");
            return statusResult; // 返回默认错误结果
        }

        // 更新结果对象中的基本信息
        statusResult.hasSubtitle = subtitleData.hasSubtitle;
        statusResult.duration = subtitleData.duration;

        // 3. 处理无字幕情况 (最高优先级的基础条件)
        if (!statusResult.hasSubtitle) {
            adskipUtils.logDebug('[AdSkip广告检测] 视频无字幕信息.');
            statusResult.status = VIDEO_STATUS.NO_SUBTITLE;
            statusResult.source = 'no_subtitle';
            // skipDataProcessing 保持 true
            updateVideoStatus(statusResult.status, {}, "无字幕");
            return statusResult;
        }

        // --- 按优先级确定状态 ---

        // 4. 检查URL参数 (优先级 1)
        if (urlParamsTimestamps && urlParamsTimestamps.length > 0) {
            adskipUtils.logDebug('[AdSkip广告检测] 使用URL参数中的时间戳.');
            statusResult.status = VIDEO_STATUS.HAS_ADS;
            statusResult.source = 'url';
            statusResult.currentAdTimestamps = urlParamsTimestamps;
            statusResult.statusData.adTimestamps = urlParamsTimestamps;
            // skipDataProcessing 保持 true
            updateVideoStatus(statusResult.status, statusResult.statusData, `Source: ${statusResult.source}`);
            return statusResult;
        }

        // 5. 检查本地存储状态 (优先级 2)
        const storedStatus = await adskipStorage.getVideoStatus(videoId);
        if (storedStatus !== null && storedStatus !== undefined) {
            const statusKey = Object.keys(VIDEO_STATUS).find(key => VIDEO_STATUS[key] === storedStatus) || 'Unknown';
            adskipUtils.logDebug(`[AdSkip广告检测] 使用本地存储的状态: ${statusKey}(${storedStatus})`);
            statusResult.status = storedStatus;
            statusResult.source = 'storage';
            // skipDataProcessing 保持 true
            if (storedStatus === VIDEO_STATUS.HAS_ADS) {
                try {
                    const storedTimestamps = await adskipStorage.loadAdTimestampsForVideo(videoId);
                    if (storedTimestamps?.length > 0) {
                        statusResult.currentAdTimestamps = storedTimestamps;
                        statusResult.statusData.adTimestamps = storedTimestamps;
                        adskipUtils.logDebug('[AdSkip广告检测] 从本地存储加载了广告时间戳.');
                    } else {
                        adskipUtils.logDebug('[AdSkip广告检测] 本地存储状态为HAS_ADS，但未找到时间戳数据.');
                    }
                } catch (e) {
                    adskipUtils.logDebug('[AdSkip广告检测] 从存储加载时间戳时出错:', e);
                    // 保持 HAS_ADS 状态，但时间戳为空
                }
            }
            updateVideoStatus(statusResult.status, statusResult.statusData, `Source: ${statusResult.source}`);
            return statusResult;
        }

        // 6. 检查无广告白名单 (优先级 3)
        const isInWhitelist = await adskipStorage.checkVideoInNoAdsWhitelist(videoId);
        if (isInWhitelist) {
            adskipUtils.logDebug('[AdSkip广告检测] 视频在无广告白名单中.');
            statusResult.status = VIDEO_STATUS.NO_ADS;
            statusResult.source = 'whitelist';
            // skipDataProcessing 保持 true
            updateVideoStatus(statusResult.status, statusResult.statusData, `Source: ${statusResult.source}`);
            return statusResult;
        }

        // --- 到达此处: 视频有字幕，但无URL参数、无存储记录、不在白名单中 ---
        // 7. 进入准备/自动检测阶段 (优先级 4)
        adskipUtils.logDebug('[AdSkip广告检测] 进入准备状态 (PREPARE).');
        updateVideoStatus(VIDEO_STATUS.PREPARE, {}, "进入准备状态");
        statusResult.status = VIDEO_STATUS.PREPARE;
        statusResult.source = 'prepare';
        statusResult.skipDataProcessing = false; // 需要后续判断是否调度检测

        // 首先检查权限
        const hasAutoDetectPermission = true; // TODO: 替换为实际的权限检查逻辑

        if (!hasAutoDetectPermission) {
            // 没有权限，只能手动检测
            adskipUtils.logDebug('[AdSkip广告检测] 用户无自动检测权限，切换到手动检测模式.');
            statusResult.status = VIDEO_STATUS.UNDETECTED;
            statusResult.source = 'no_permission';
            statusResult.skipDataProcessing = true; // 不再进行后续处理
            updateVideoStatus(statusResult.status, {}, "无权限，请手动检测");
            return statusResult;
        }

        // 检查是否满足自动检测条件
        const meetsDurationCriteria = subtitleData.duration && subtitleData.duration >= 30;

        // 条件满足：保持 PREPARE 状态，并计划自动检测
        adskipUtils.logDebug(`[AdSkip广告检测] 视频时长 (${subtitleData.duration}s) 满足条件，准备自动检测.`);
        statusResult.source = 'prepare_scheduled'; // 更新来源

        autoDetectTimerId = setTimeout(async () => {
            if (meetsDurationCriteria) {
                adskipUtils.logDebug('[AdSkip广告检测] 自动检测计时器触发，开始执行检测...');
                autoDetectTimerId = null; // 清除 ID
                try {
                    const currentVideoCheck = adskipUtils.getCurrentVideoId().id;
                    // 再次确认视频未切换
                    if (currentVideoCheck === videoId) {
                        // 获取最新数据以防万一
                        const latestSubtitleData = await getVideoSubtitleData();
                        if (latestSubtitleData.hasSubtitle && latestSubtitleData.bvid === videoId) {
                            // 发送检测请求（内部会处理状态更新：DETECTING -> HAS_ADS/NO_ADS/UNDETECTED）
                            await sendDetectionRequest(latestSubtitleData);
                            adskipUtils.logDebug('[AdSkip广告检测] 自动检测请求已发送 (或尝试发送).');
                        } else {
                            adskipUtils.logDebug('[AdSkip广告检测] 自动检测取消：执行前字幕信息丢失.');
                            if (currentVideoCheck === videoId) { // 避免干扰新视频
                                updateVideoStatus(VIDEO_STATUS.NO_SUBTITLE, {}, "Subtitle lost before auto-detect");
                            }
                        }
                    } else {
                        adskipUtils.logDebug('[AdSkip广告检测] 自动检测取消：执行前视频已切换.');
                    }
                } catch (error) {
                    adskipUtils.logDebug('[AdSkip广告检测] 自动检测执行失败:', error);
                    const currentVideoCheck = adskipUtils.getCurrentVideoId().id;
                        // 如果视频没变，恢复为可手动检测状态
                    if (currentVideoCheck === videoId) {
                        updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "自动检测失败");
                    }
                }

            } else {
                // 时长不满足：立即从 PREPARE 切换到 UNDETECTED
                adskipUtils.logDebug(`[AdSkip广告检测] 视频时长 (${subtitleData.duration}s) 不满足自动检测条件 (< 30s). 切换到手动检测模式.`);

                // 立即更新按钮状态为 UNDETECTED
                updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, `时长不足，请手动检测`);

                // 更新结果对象
                statusResult.status = VIDEO_STATUS.UNDETECTED;
                statusResult.source = 'prepare_short_duration';
                statusResult.skipDataProcessing = true; // 不再需要自动处理
            }
        }, 10000); // 10秒延迟

        adskipUtils.logDebug(`[AdSkip广告检测] 已设置自动检测定时器 (ID: ${autoDetectTimerId}). 状态保持 PREPARE.`);
        // 此时 statusResult.status 保持 PREPARE


        // 最终日志，反映函数返回前的状态
        const finalStatusKey = Object.keys(VIDEO_STATUS).find(key => VIDEO_STATUS[key] === statusResult.status) || 'Unknown';
        adskipUtils.logDebug(`[AdSkip广告检测] 处理完成. 最终状态: ${finalStatusKey}(${statusResult.status}), 来源: ${statusResult.source}`);
        return statusResult;

    } catch (error) {
        adskipUtils.logDebug('[AdSkip广告检测] 处理视频状态时发生严重错误:', error);
        // 发生严重错误时，尝试将按钮重置为中性状态
        try {
            updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, "Processing error");
        } catch (updateError) {
            adskipUtils.logDebug('[AdSkip广告检测] 发生严重错误后更新状态失败:', updateError);
        }
        // 返回默认错误结果
        statusResult.status = VIDEO_STATUS.UNDETECTED;
        statusResult.source = 'error';
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
        clientVersion: data.clientVersion
    };

    // 准备要签名的字符串
    // 使用与Python的json.dumps(obj, sort_keys=True)完全一致的格式
    const sortedData = {};
    Object.keys(signatureData).sort().forEach(key => {
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
    adskipUtils.logDebug(`[AdSkip广告检测] - 开始发送检测请求 for VideoID: ${videoId}`);

    // 清除可能存在的自动检测定时器（如果手动触发时自动的还没执行）
    if (autoDetectTimerId) {
        clearTimeout(autoDetectTimerId);
        autoDetectTimerId = null;
        adskipUtils.logDebug('[AdSkip广告检测] - 清除了待执行的自动检测定时器');
    }

    // 更新按钮状态为检测中
    updateVideoStatus(VIDEO_STATUS.DETECTING, {}, "发送检测请求");

    try {
        // 获取用户信息
        let userInfo = null;
        if (typeof adskipCredentialService !== 'undefined') {
            userInfo = await adskipCredentialService.getBilibiliLoginStatus()
                .catch(error => {
                    adskipUtils.logDebug('[AdSkip广告检测] 获取用户信息失败:', error);
                    return null;
                });
        }

        // 准备请求数据
        const requestData = {
            videoId: videoId,
            title: subtitleData.title || '',
            uploader: subtitleData.owner?.name || '',
            mid: subtitleData.mid || '',
            duration: subtitleData.duration || 0,
            // subtitles: subtitleData.subtitle_contents[0] || [],
            autoDetect: true, // 非付费用户
            clientVersion: '1.0.0', // 客户端版本
            videoData: subtitleData, // 保留完整原始数据，对服务器端处理很重要
            user: userInfo ? {
                username: userInfo.username || '',
                uid: userInfo.uid || '',
                level: userInfo.level || 0
            } : null
        };

        const signedData = signRequest(requestData);

        const apiUrl = 'https://izumihostpab.life:3000/api/detect';

        adskipUtils.logDebug('[AdSkip广告检测] - 发送请求，签名：', signedData);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signedData)
        });

        // 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`服务器响应错误 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        adskipUtils.logDebug('[AdSkip广告检测] - 收到服务器响应JSON:', result);

        if (!result || typeof result.success !== 'boolean') {
            throw new Error('服务器返回了无效的响应格式');
        }

        if (!result.success) {
            // 服务端明确告知失败，但不是网络或格式错误
             adskipUtils.logDebug('[AdSkip广告检测] - 服务器返回失败消息:', result.message);
             // 根据服务器返回决定是否需要关闭免费体验 (未来实现)
             // if (result.disableTrial) { ... }

             // 更新状态为 UNDETECTED
             updateVideoStatus(VIDEO_STATUS.UNDETECTED, {}, `检测失败: ${result.message || '未知原因'}`);
             // 返回一个表示失败的结构，避免后续处理出错
             return { success: false, hasAds: false, adTimestamps: [], message: result.message || '检测失败' };
        }

        // --- 检测成功 ---
        const newStatus = result.hasAds ? VIDEO_STATUS.HAS_ADS : VIDEO_STATUS.NO_ADS;
        const adTimestamps = result.adTimestamps || [];

        // 更新按钮状态和数据
        updateVideoStatus(newStatus, { adTimestamps: adTimestamps }, "检测成功");

        // 保存状态和时间戳到本地存储
        await adskipStorage.saveVideoStatus(videoId, newStatus);
        if (newStatus === VIDEO_STATUS.HAS_ADS) {
            await adskipStorage.saveAdTimestampsForVideo(videoId, adTimestamps);
             adskipUtils.logDebug('[AdSkip广告检测] - 已保存 HAS_ADS 状态和时间戳');
        } else {
            // 如果检测结果是无广告，加入白名单
            await adskipStorage.addVideoToNoAdsWhitelist(videoId);
            adskipUtils.logDebug('[AdSkip广告检测] - 已保存 NO_ADS 状态并加入白名单');
        }

        // 如果检测到广告，调用核心应用函数处理
        if (newStatus === VIDEO_STATUS.HAS_ADS && typeof adskipCore !== 'undefined' && adskipCore.applyNewAdTimestamps) {
            const convertedTimestamps = adTimestamps.map(ts => ({
                start_time: ts.start,
                end_time: ts.end,
                ...ts // 保留其他可能的字段
            }));
            adskipUtils.logDebug('[AdSkip广告检测] - 检测到广告，调用核心应用函数处理', convertedTimestamps);
            adskipCore.applyNewAdTimestamps(convertedTimestamps);
        }

        return result; // 返回原始成功结果

    } catch (error) {
        adskipUtils.logDebug('[AdSkip广告检测] - 检测请求失败:', error);
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

/**
 * 为按钮设置手动触发检测的点击事件
 * @param {HTMLElement} button - 广告跳过按钮元素
 */
function setupManualDetectionTrigger(button) {
    if (!button) return;

    button.addEventListener('click', async function() {
        const videoId = adskipUtils.getCurrentVideoId().id;
        adskipUtils.logDebug(`[AdSkip广告检测] - 按钮被点击 for VideoID: ${videoId}`);

        // 获取当前按钮状态
        const currentStatus = parseInt(button.dataset.status || VIDEO_STATUS.UNDETECTED);
        adskipUtils.logDebug('[AdSkip广告检测] - 当前按钮状态:', Object.keys(VIDEO_STATUS).find(key => VIDEO_STATUS[key] === currentStatus), `(${currentStatus})`);


        // 只有 UNDETECTED 状态下才触发手动检测
        if (currentStatus === VIDEO_STATUS.UNDETECTED) {
            adskipUtils.logDebug('[AdSkip广告检测] - 状态为 UNDETECTED，尝试手动检测');

            // 清除可能存在的自动检测定时器
            if (autoDetectTimerId) {
                clearTimeout(autoDetectTimerId);
                autoDetectTimerId = null;
                adskipUtils.logDebug('[AdSkip广告检测] - 清除了待执行的自动检测定时器');
            }

            try {
                // 获取字幕数据
                 adskipUtils.logDebug('[AdSkip广告检测] - 获取字幕数据...');
                 const subtitleData = await getVideoSubtitleData();

                 // 再次检查视频ID是否匹配
                 if (!subtitleData || subtitleData.bvid !== videoId) {
                    adskipUtils.logDebug('[AdSkip广告检测] - 获取字幕数据失败或视频已切换，取消手动检测');
                    return;
                 }

                 if (!subtitleData.hasSubtitle) {
                    adskipUtils.logDebug('[AdSkip广告检测] - 无法检测：该视频没有字幕');
                    updateVideoStatus(VIDEO_STATUS.NO_SUBTITLE, {}, "手动检测前发现无字幕");
                    return;
                 }

                 adskipUtils.logDebug('[AdSkip广告检测] - 字幕数据获取成功，发送检测请求...');
                 // 直接调用发送请求函数 (内部会更新状态为DETECTING)
                 await sendDetectionRequest(subtitleData);

            } catch (error) {
                // sendDetectionRequest 内部已经处理了错误和状态恢复
                adskipUtils.logDebug('[AdSkip广告检测] - 手动检测过程中发生错误 (已被sendDetectionRequest处理):', error.message);
            }

        } else {
             adskipUtils.logDebug(`[AdSkip广告检测] - 当前状态 (${currentStatus}) 非 UNDETECTED，不执行特殊操作`);
             // 其他状态 (NO_SUBTITLE, NO_ADS, DETECTING) 点击无特殊效果
        }
    });
    adskipUtils.logDebug('[AdSkip广告检测] - 手动触发检测监听器已设置');
}


// 导出函数到全局对象
window.adskipAdDetection = {
    getVideoSubtitleData,
    VIDEO_STATUS,
    updateVideoStatus,
    createAdSkipButton,
    cycleButtonStatus, // 保留测试函数
    updateButtonStatusBasedOnSubtitle, // 保留辅助函数
    processVideoAdStatus, // 核心状态处理函数
    sendDetectionRequest, // API请求函数
    signRequest, // 签名函数
    setupManualDetectionTrigger // 手动触发设置函数 (虽然内部调用，但导出可能便于测试)
    // 移除了 checkAutoDetectionEligibility, startAutoDetectionProcess, initAutoDetection, onVideoUrlChange
};

// 初始化测试按钮的代码已移除