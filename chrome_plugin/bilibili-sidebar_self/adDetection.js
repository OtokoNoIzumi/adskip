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
    DETECTING: 4          // 当前视频有字幕信息，且在请求服务器处理识别广告区间中
};

// 创建全局对象
window.adskipAdDetection = window.adskipAdDetection || {};

/**
 * 获取视频字幕数据
 * 整合来自adskipSubtitleService的视频信息和字幕数据
 * @returns {Promise<Object>} 完整的keyParams对象
 */
async function getVideoSubtitleData() {
    try {
        adskipUtils.logDebug('[AdSkip广告检测] 开始获取视频字幕数据...');


        // 获取当前视频信息
        const videoData = await adskipSubtitleService.getVideoData();
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
 * 创建测试按钮 - 仅用于开发测试
 * 点击后获取字幕信息并在控制台输出
 */
function createTestButton() {
    // 检查测试按钮是否已存在
    if (document.getElementById('adskip-test-button')) {
        return;
    }

    // 创建测试按钮
    const testButton = document.createElement('div');
    testButton.id = 'adskip-test-button';
    testButton.innerHTML = '测试获取字幕';

    // 使用更符合现代设计的样式
    testButton.style.cssText = `
        position: fixed;
        top: 150px;
        right: 20px;
        background-color: rgba(38, 50, 56, 0.7);
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
    testButton.addEventListener('mouseenter', () => {
        testButton.style.backgroundColor = 'rgba(38, 50, 56, 0.85)';
        testButton.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.2)';
    });

    testButton.addEventListener('mouseleave', () => {
        testButton.style.backgroundColor = 'rgba(38, 50, 56, 0.7)';
        testButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
    });

    // 点击事件
    testButton.addEventListener('click', async function() {
        testButton.innerHTML = '获取中...';
        testButton.style.backgroundColor = 'rgba(121, 134, 203, 0.85)';

        try {
            const subtitleData = await getVideoSubtitleData();
            console.log('字幕数据:', subtitleData);

            // 显示结果
            let resultText = '获取';
            if (subtitleData.hasSubtitle && subtitleData.subtitle_contents) {
                resultText += `成功: ${subtitleData.subtitle_contents[0].length}条字幕`;
                testButton.style.backgroundColor = 'rgba(96, 125, 139, 0.85)';
            } else {
                resultText += '失败: 无字幕';
                testButton.style.backgroundColor = 'rgba(158, 158, 158, 0.85)';
            }
            testButton.innerHTML = resultText;

            // 3秒后恢复
            setTimeout(() => {
                testButton.innerHTML = '测试获取字幕';
                testButton.style.backgroundColor = 'rgba(38, 50, 56, 0.7)';
            }, 3000);
        } catch (error) {
            console.error('获取字幕失败:', error);
            testButton.innerHTML = '获取失败';
            testButton.style.backgroundColor = 'rgba(158, 158, 158, 0.85)';

            // 3秒后恢复
            setTimeout(() => {
                testButton.innerHTML = '测试获取字幕';
                testButton.style.backgroundColor = 'rgba(38, 50, 56, 0.7)';
            }, 3000);
        }
    });

    // 添加到页面
    document.body.appendChild(testButton);
}

/**
 * 创建广告跳过按钮
 * @returns {HTMLElement} 创建的按钮元素
 */
function createAdSkipButton() {
    // 检查是否已存在
    let adskipButton = document.getElementById('adskip-button');
    if (adskipButton) {
        adskipUtils.logDebug('[AdSkip广告检测] 广告跳过按钮已存在，返回现有按钮');
        return adskipButton;
    }

    // 创建按钮
    adskipButton = document.createElement('div');
    adskipButton.id = 'adskip-button';
    adskipButton.className = 'adskip-button undetected';
    adskipButton.innerHTML = '点击检测广告';

    adskipUtils.logDebug('[AdSkip广告检测] 创建广告跳过按钮');

    return adskipButton;
}

/**
 * 更新视频状态和按钮显示
 * @param {number} status - 视频状态，使用VIDEO_STATUS枚举值
 * @param {Object} data - 可选的附加数据，如广告时间戳等
 */
function updateVideoStatus(status, data = {}) {
    const button = createAdSkipButton();

    // 移除所有状态类
    button.classList.remove('no-subtitle', 'no-ads', 'has-ads', 'undetected', 'detecting');

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
            }
            break;

        case VIDEO_STATUS.UNDETECTED:
            button.classList.add('undetected');
            button.innerHTML = '点击检测广告';
            break;

        case VIDEO_STATUS.DETECTING:
            button.classList.add('detecting');
            button.innerHTML = '检测中...';
            break;

        default:
            button.classList.add('has-ads');
            button.innerHTML = '已处理广告';
    }

    // 存储当前状态
    button.dataset.status = status;

    adskipUtils.logDebug(`[AdSkip广告检测] 更新按钮状态为: ${status}`);

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
 * 创建测试循环按钮 - 仅用于开发测试
 */
function createTestStatusButton() {
    // 检查是否已存在
    if (document.getElementById('adskip-test-status-button')) {
        return;
    }

    // 先创建广告跳过按钮
    createAdSkipButton();

    // 创建测试状态按钮
    const testButton = document.createElement('div');
    testButton.id = 'adskip-test-status-button';
    testButton.innerHTML = '切换状态';

    // 点击事件
    testButton.addEventListener('click', cycleButtonStatus);

    // 添加到页面
    document.body.appendChild(testButton);

    adskipUtils.logDebug('[AdSkip广告检测] 创建测试状态切换按钮');
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
 * 验证存储模块功能
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
 * 处理视频广告状态
 * 集中处理视频状态检查逻辑，用于初始化和重新初始化
 *
 * @param {string} videoId 视频ID
 * @param {Array} urlTimestamps URL中解析的时间戳（如果有）
 * @param {boolean} isInitial 是否是初始化调用（区分init和reinitialize的处理）
 * @returns {Promise<Object>} 返回处理结果，包含状态和是否需要跳过数据处理
 */
async function processVideoAdStatus(videoId, urlTimestamps = [], isInitial = true) {
    // 返回对象
    const result = {
        urlAdTimestamps: [],              // URL参数中的时间戳
        currentAdTimestamps: [],          // 当前使用的时间戳
        skipDataProcessing: false,        // 是否跳过数据处理（API解析和服务器请求）
        status: VIDEO_STATUS.UNDETECTED,  // 视频状态
        statusData: {},                   // 状态相关数据
        source: 'none'                    // 数据来源
    };

    // 没有视频ID，直接返回
    if (!videoId) {
        adskipUtils.logDebug('[AdSkip广告检测] 未找到视频ID，无法处理状态');
        return result;
    }

    const modeText = isInitial ? '初始化' : '视频切换';

    // 1. 验证时间戳（URL优先于本地存储）- 外部存储API调用可能失败
    const validationResult = await adskipStorage.loadAndValidateTimestamps(
        videoId,
        urlTimestamps
    ).catch(error => {
        adskipUtils.logDebug(`[AdSkip广告检测] 加载时间戳时出错: ${error.message}`);
        return { timestamps: [], fromUrl: false, isPolluted: false };
    });

    // 2. 检查是否在白名单中（无论状态如何，先检查白名单）- 外部存储API调用可能失败
    const isInWhitelist = await adskipStorage.checkVideoInNoAdsWhitelist(videoId)
        .catch(error => {
            adskipUtils.logDebug(`[AdSkip广告检测] 检查白名单状态出错: ${error.message}`);
            return false;
        });

    // 3. 确定数据来源和时间戳
    if (validationResult.fromUrl) {
        // 来自URL参数
        result.source = 'url';
        result.urlAdTimestamps = [...validationResult.timestamps];
        result.currentAdTimestamps = [...validationResult.timestamps];
        adskipUtils.logDebug(`[AdSkip广告检测] ${modeText}时使用URL中的广告时间段`);
    } else if (validationResult.timestamps.length > 0) {
        // 来自本地存储
        result.source = 'storage';
        result.currentAdTimestamps = [...validationResult.timestamps];
        adskipUtils.logDebug(`[AdSkip广告检测] ${modeText}时使用本地存储的广告时间段`);

        // 输出污染日志
        if (validationResult.isPolluted) {
            adskipUtils.logDebug(`[AdSkip广告检测] URL参数被视频${validationResult.pollutionSource}的数据污染，已清除`);
        }
    } else if (isInWhitelist) {
        // 没有其他数据，但在白名单中
        result.source = 'whitelist';
        adskipUtils.logDebug(`[AdSkip广告检测] 视频 ${videoId} 在白名单中，设置NO_ADS状态`);
    }

    // 4. 根据数据来源确定状态和是否跳过数据处理
    if (result.source === 'url' || result.source === 'storage') {
        // 有URL参数或本地存储 -> HAS_ADS
        result.status = VIDEO_STATUS.HAS_ADS;
        result.statusData = { adTimestamps: result.currentAdTimestamps };

        // 即使有广告数据，如果在白名单中也跳过API请求
        if (isInWhitelist) {
            adskipUtils.logDebug(`[AdSkip广告检测] 视频 ${videoId} 在白名单中，但有${result.source === 'url' ? 'URL参数' : '本地存储'}，保持HAS_ADS状态，跳过API请求`);
            result.skipDataProcessing = true;
        }
    } else if (result.source === 'whitelist') {
        // 仅在白名单中 -> NO_ADS
        result.status = VIDEO_STATUS.NO_ADS;
        result.skipDataProcessing = true;
    } else {
        // 完全没有数据 -> UNDETECTED，需要API检测
        adskipUtils.logDebug(`[AdSkip广告检测] ${modeText}没有找到广告时间段，需要API检测`);
    }

    // 5. 更新按钮状态（如果已有数据来源）
    if (result.source !== 'none') {
        updateVideoStatus(result.status, result.statusData);
    }

    return result;
}

// 导出函数到全局对象
window.adskipAdDetection = {
    getVideoSubtitleData,
    createTestButton,
    VIDEO_STATUS,
    updateVideoStatus,
    createAdSkipButton,
    createTestStatusButton,
    cycleButtonStatus,
    updateButtonStatusBasedOnSubtitle,
    validateStorageModule,
    processVideoAdStatus
};

// 初始化测试按钮的代码已移除