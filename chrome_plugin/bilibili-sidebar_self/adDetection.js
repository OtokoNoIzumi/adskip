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

// 导出函数到全局对象
window.adskipAdDetection = {
    getVideoSubtitleData,
    createTestButton,
    VIDEO_STATUS,
    updateVideoStatus,
    createAdSkipButton,
    createTestStatusButton,
    cycleButtonStatus,
    updateButtonStatusBasedOnSubtitle
};

// 初始化测试按钮的代码已移除