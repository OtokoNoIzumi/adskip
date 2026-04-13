# B站视频广告自动检测功能开发计划

## 功能概述

开发一个基于现有插件架构的广告识别和跳过功能，主要流程：

1. 视频播放界面加载后等待10秒
2. 获取adminPanel中的keyParams中的字幕信息
3. 向远端服务器发送字幕数据请求识别广告
4. 根据返回结果处理广告信息或将视频加入白名单
5. 根据不同状态更新"广告跳过"悬浮按钮的样式和交互功能

## 接口协同约定（前后端）

### 重新分析（强制模式）

- 前端在点击“重新分析”时，会先触发听译转录，再调用 `/api/detect`。
- 此场景会在请求体中明确传递 `forceReanalyze: true`，语义为**强制重新分析，不允许命中缓存结果**。
- `NO_SUB` 的普通听译流程不强制带该字段，可继续按后端缓存策略处理。

### 转录字幕优先级

- 当前视频若存在 `transcribed_subtitles`（强制听译结果），前端会优先使用该字幕作为识别输入。
- 该优先策略会覆盖页面原生字幕读取结果，直到转录缓存被清理或替换。

## 视频状态定义

为了区分不同的处理状态，定义以下5种状态：

1. **NO_SUBTITLE**: 当前视频没字幕信息，无法识别广告
2. **NO_ADS**: 当前视频有字幕信息，且服务器有记录，没有广告信息
3. **HAS_ADS**: 当前视频有字幕信息，且服务器有记录，有广告区间
4. **UNDETECTED**: 当前视频有字幕信息，且服务器没有记录
5. **DETECTING**: 当前视频有字幕信息，且在请求服务器处理识别广告区间中

## 模块划分与开发步骤

每个模块可独立开发和验证，按照从基础到复杂的顺序排列。

### 模块1: 字幕信息获取模块 [已完成]

**目标**: 封装获取视频字幕信息的功能

**文件**: `adDetection.js` (新建)

**主要函数**:
```javascript
async function getVideoSubtitleData() {
  /*
   * 整合来自adskipSubtitleService的视频信息和字幕数据
   * 返回完整的keyParams对象，包含视频元数据和字幕内容
   */
}
```

**实现状态**: ✅ 已完成并验证通过

**验证结果**:
- getVideoSubtitleData函数已实现并能正确获取视频元数据和字幕内容
- 测试按钮功能正常，显示获取结果信息
- AdminPanel模块已成功集成此功能

### 模块2: 按钮状态与样式模块 [已完成]

**目标**: 实现不同状态下按钮的样式和交互

**文件**:
- `adDetection.js` (扩展)
- `adDetection.css` (新建)

**具体实现内容**:

1. **创建CSS文件**:
   - 在插件根目录创建`adDetection.css`文件
   - 确保在manifest.json中引入此CSS文件
   - 实现各状态的样式定义

2. **扩展状态更新函数**:
```javascript
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
    adskipButton.innerHTML = '点击检测';

    // 定位在视频播放器右上角
    adskipButton.style.position = 'absolute';
    adskipButton.style.top = '10px';
    adskipButton.style.right = '10px';
    adskipButton.style.zIndex = '9999';

    // 添加到播放器容器
    const playerContainer = document.querySelector('.bpx-player-container') || document.body;
    playerContainer.appendChild(adskipButton);

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
            button.innerHTML = '无字幕内容';
            break;

        case VIDEO_STATUS.NO_ADS:
            button.classList.add('no-ads');
            button.innerHTML = '无广告内容';
            break;

        case VIDEO_STATUS.HAS_ADS:
            button.classList.add('has-ads');
            button.innerHTML = '广告跳过';
            // 保存广告时间戳数据
            if (data.adTimestamps) {
                button.dataset.adTimestamps = JSON.stringify(data.adTimestamps);
            }
            break;

        case VIDEO_STATUS.UNDETECTED:
            button.classList.add('undetected');
            button.innerHTML = '点击检测';
            break;

        case VIDEO_STATUS.DETECTING:
            button.classList.add('detecting');
            button.innerHTML = '检测中...';
            break;

        default:
            button.classList.add('undetected');
            button.innerHTML = '点击检测';
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

    // 样式
    testButton.style.cssText = `
        position: fixed;
        top: 200px;
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
    });

    testButton.addEventListener('mouseleave', () => {
        testButton.style.backgroundColor = 'rgba(38, 50, 56, 0.7)';
    });

    // 点击事件
    testButton.addEventListener('click', cycleButtonStatus);

    // 添加到页面
    document.body.appendChild(testButton);
}
```

3. **更新导出对象**:
```javascript
// 导出函数到全局对象
window.adskipAdDetection = {
    getVideoSubtitleData,
    createTestButton,
    VIDEO_STATUS,
    updateVideoStatus,
    createAdSkipButton,
    createTestStatusButton
};
```

**CSS样式内容** (`adDetection.css`):
```css
/* 广告跳过按钮基础样式 */
.adskip-button {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 14px;
  color: #fff;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  user-select: none;
}

/* 无字幕状态 - 灰色 */
.adskip-button.no-subtitle {
  background-color: #aaaaaa;
}
.adskip-button.no-subtitle::before {
  content: "🚫";
  margin-right: 4px;
}

/* 无广告状态 - 绿色 */
.adskip-button.no-ads {
  background-color: #6ac30d;
}
.adskip-button.no-ads::before {
  content: "✓";
  margin-right: 4px;
}

/* 有广告状态 - B站粉色 */
.adskip-button.has-ads {
  background-color: #FB7299;
}
.adskip-button.has-ads::before {
  content: "⏩";
  margin-right: 4px;
}

/* 未检测状态 - B站蓝色 */
.adskip-button.undetected {
  background-color: #23ADE5;
}
.adskip-button.undetected::before {
  content: "❓";
  margin-right: 4px;
}

/* 检测中状态 - 紫色过渡色 */
.adskip-button.detecting {
  background-color: #A578F2;
  animation: adskip-pulse 1.5s infinite;
}
.adskip-button.detecting::before {
  content: "⌛";
  margin-right: 4px;
}

/* 鼠标悬停效果 */
.adskip-button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
}

/* 脉冲动画 */
@keyframes adskip-pulse {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}
```

**验证方法**:
- 创建adDetection.css文件并配置manifest.json引入
- 实现上述函数并调用createTestStatusButton()
- 点击"切换状态"按钮循环切换所有状态
- 验证每种状态下按钮的样式和文本正确显示
- 检查按钮位置是否正确显示在视频播放器右上角

**注意事项**:
- 确保按钮的z-index足够高，能在视频播放器上方正常显示
- 测试不同尺寸的视频播放器下按钮的显示位置
- 确保按钮在全屏模式下仍然可见并可交互

### 模块3: 本地存储扩展模块 [已完成]

**目标**: 扩展现有存储功能，支持视频白名单和检测状态

**文件**: `storage.js` (修改现有文件)

**主要函数**:
```javascript
// 添加视频到无广告白名单
async function addVideoToNoAdsWhitelist(videoId) {
  /*
   * 将视频ID添加到无广告白名单中
   */
}

// 检查视频是否在无广告白名单中
async function checkVideoInNoAdsWhitelist(videoId) {
  /*
   * 检查视频是否已经被标记为无广告
   */
}

// 保存视频状态
async function saveVideoStatus(videoId, status) {
  /*
   * 保存视频的处理状态
   */
}
```

**实现状态**: ✅ 已完成并验证通过

**集成方案**:
- 已创建`processVideoAdStatus`集中处理函数，整合了视频广告状态相关逻辑
- 函数按优先级依次检查：URL参数 > 本地存储 > 白名单
- 应用DRY原则，消除了冗余代码，提高了代码可维护性
- 清晰区分了"视频状态"（UI表现）和"数据处理流程"（是否调用API）

**验证结果**:
- 添加视频到白名单功能正常工作
- 状态存储和读取功能正常
- 验证测试按钮能正确显示白名单和状态信息
- 白名单状态正确影响UI显示和处理流程

**关键优化**:
- 白名单检查不再中断URL监听和初始化流程
- 白名单视频可以根据实际情况显示不同状态（HAS_ADS或NO_ADS）
- 共享逻辑减少了代码冗余，提高了一致性
- 处理流程更加清晰，易于维护

### 模块4: Python服务端通信模块 [已完成]

**目标**: 实现与Python服务端的通信

**文件**: `adDetection.js` (扩展)

**主要函数**:
```javascript
async function sendDetectionRequest(subtitleData) {
  /*
   * 发送字幕数据到服务端进行广告检测
   * 处理响应和错误情况
   */
}
```

**Python服务端示例**:
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

# 模拟数据库
detection_results = {}

@app.route('/api/detect', methods=['POST'])
def detect_ads():
    data = request.json
    video_id = data.get('videoId')
    subtitles = data.get('subtitles', [])

    print(f"收到检测请求: {video_id}")
    print(f"字幕数量: {len(subtitles)}")

    # 简单的模拟逻辑
    has_ads = False
    ad_timestamps = []

    if subtitles:
        # 检查字幕中是否包含广告关键词
        for subtitle in subtitles:
            content = subtitle.get('content', '')
            if '广告' in content or '赞助' in content or '支持' in content:
                # 找到广告开始位置
                start_time = subtitle.get('from', 0)

                # 假设广告持续15秒
                end_time = start_time + 15

                ad_timestamps.append({
                    'start': start_time,
                    'end': end_time
                })

                has_ads = True

    # 保存检测结果
    detection_results[video_id] = {
        'hasAds': has_ads,
        'adTimestamps': ad_timestamps,
        'detectedAt': time.strftime('%Y-%m-%d %H:%M:%S')
    }

    # 模拟处理延迟
    time.sleep(2)

    return jsonify({
        'success': True,
        'hasAds': has_ads,
        'adTimestamps': ad_timestamps,
        'message': '检测到广告' if has_ads else '未检测到广告',
        'confidence': 0.95
    })

@app.route('/api/result/<video_id>', methods=['GET'])
def get_result(video_id):
    if video_id in detection_results:
        return jsonify({
            'success': True,
            **detection_results[video_id]
        })
    else:
        return jsonify({
            'success': False,
            'message': '未找到该视频的检测结果'
        })

if __name__ == '__main__':
    app.run(debug=True, port=3000)
```

**实现状态**: ✅ 已完成并验证通过

**验证结果**:
- 服务端通信成功实现，可以发送和接收数据
- 测试按钮功能正常，能发送请求并正确显示检测结果
- 处理结果后能正确更新视频状态和存储

### 模块5: 自动检测流程模块

**目标**: 实现视频加载10秒后自动检测的功能

**文件**: `adDetection.js` (扩展)

**主要函数**:
```javascript
function startDetectionProcess() {
  /*
   * 更新按钮状态为"检测中"
   * 10秒后开始检测过程
   */
}

function processDetectionResult(result) {
  /*
   * 处理检测结果
   * 更新视频状态和按钮
   */
}
```

**验证方法**:
- 在视频页面打开后观察按钮状态
- 确认10秒后能自动开始检测
- 验证不同结果下的状态转换

### 模块6: 手动触发检测模块

**目标**: 实现在UNDETECTED状态下点击按钮触发检测

**文件**: `adDetection.js` (扩展)

**主要函数**:
```javascript
function setupManualDetectionTrigger() {
  /*
   * 为按钮添加点击事件
   * 仅在UNDETECTED状态下触发检测
   * 其他状态下保持原有行为
   */
}
```

**验证方法**:
- 将视频状态手动设置为UNDETECTED
- 点击按钮，确认能正确触发检测
- 验证其他状态下的点击行为正确

### 模块7: 付费用户功能模块

**目标**: 为付费用户实现自动识别功能

**文件**: `adDetection.js` (扩展)

**主要函数**:
```javascript
async function checkPremiumStatus() {
  /*
   * 检查当前用户是否为付费用户
   */
}

function addPremiumFeatures(requestData) {
  /*
   * 为付费用户添加自动识别标记
   */
}
```

**验证方法**:
- 模拟付费用户身份
- 确认发送的请求中包含自动识别标记

## 完整集成

**目标**: 将所有模块整合到核心流程中

**文件**: `core.js` (修改)

**主要修改**:
```javascript
// 在初始化函数中添加广告检测功能
async function init() {
  // 现有初始化代码...

  // 初始化广告检测功能
  initAdDetection();
}
```

**验证方法**:
- 完整测试所有功能
- 验证各种边缘情况和错误处理

## 服务端通信格式

### 请求格式:
```json
{
  "videoId": "BV1xxxxx",
  "title": "视频标题",
  "uploader": "UP主名称",
  "duration": 600,
  "subtitles": [
    {"from": 10.5, "content": "字幕内容1"},
    {"from": 15.2, "content": "字幕内容2"}
  ],
  "autoDetect": false, // 付费用户设为true
  "clientVersion": "1.0.0"
}
```

### 响应格式:
```json
{
  "success": true,
  "hasAds": true,
  "adTimestamps": [
    {"start": 30, "end": 45},
    {"start": 120, "end": 135}
  ],
  "message": "检测成功",
  "confidence": 0.95
}
```

## 开发顺序建议

1. 首先实现字幕信息获取模块，确保能获取正确数据
2. 实现按钮状态与样式模块，建立UI基础
3. 扩展本地存储功能，确保数据持久化
4. 搭建Python测试服务端
5. 实现服务端通信模块
6. 开发自动检测流程
7. 添加手动触发功能
8. 整合付费用户功能
9. 最后将所有模块集成到核心流程

每个模块完成后应进行独立测试，确认正常工作后再进行下一步开发。