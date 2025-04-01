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

        // 检查服务模块是否存在
        if (typeof adskipSubtitleService === 'undefined') {
            throw new Error('字幕服务模块未加载，请刷新页面后重试');
        }

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

// 导出函数到全局对象
window.adskipAdDetection = {
    getVideoSubtitleData,
    createTestButton,
    VIDEO_STATUS
};

// 初始化测试按钮（只在开发阶段使用）
document.addEventListener('DOMContentLoaded', function() {
    // 延迟加载，确保其他模块已加载
    setTimeout(() => {
        createTestButton();
    }, 2000);
});