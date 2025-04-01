# B站视频广告自动检测功能开发计划

## 功能概述

开发一个基于现有插件架构的广告识别和跳过功能，主要流程：

1. 视频播放界面加载后等待10秒
2. 获取adminPanel中的keyParams中的字幕信息
3. 向远端服务器发送字幕数据请求识别广告
4. 根据返回结果处理广告信息或将视频加入白名单
5. 根据不同状态更新"广告跳过"悬浮按钮的样式和交互功能

## 视频状态定义

为了区分不同的处理状态，定义以下5种状态：

1. **NO_SUBTITLE**: 当前视频没字幕信息，无法识别广告
2. **NO_ADS**: 当前视频有字幕信息，且服务器有记录，没有广告信息
3. **HAS_ADS**: 当前视频有字幕信息，且服务器有记录，有广告区间
4. **UNDETECTED**: 当前视频有字幕信息，且服务器没有记录
5. **DETECTING**: 当前视频有字幕信息，且在请求服务器处理识别广告区间中

## 模块划分与开发步骤

每个模块可独立开发和验证，按照从基础到复杂的顺序排列。

### 模块1: 字幕信息获取模块

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

**验证方法**:
- 创建临时按钮，点击后调用此函数并在控制台输出结果
- 确认能够正确获取视频元数据和字幕内容

### 模块2: 按钮状态与样式模块

**目标**: 实现不同状态下按钮的样式和交互

**文件**: `adDetection.js` (扩展) 和 CSS样式

**内容**:
```javascript
// 状态枚举
const VIDEO_STATUS = {
  NO_SUBTITLE: 0,
  NO_ADS: 1,
  HAS_ADS: 2,
  UNDETECTED: 3,
  DETECTING: 4
};

// 更新按钮状态函数
function updateVideoStatus(status) {
  /*
   * 根据不同状态更新按钮的样式和文本
   */
}
```

**CSS样式与图标设计**:
```css
/* 按钮基础样式 */
.adskip-button {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 14px;
  color: #fff;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 每种状态的样式 */
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
  animation: pulse 1.5s infinite;
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
@keyframes pulse {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}
```

**状态文本与图标对应关系**:

| 状态 | 类名 | 背景色 | 图标 | 文本 |
|------|------|--------|------|------|
| 无字幕 | no-subtitle | 灰色 (#aaaaaa) | 🚫 | 无字幕内容 |
| 无广告 | no-ads | 绿色 (#6ac30d) | ✓ | 无广告内容 |
| 有广告 | has-ads | B站粉色 (#FB7299) | ⏩ | 广告跳过 |
| 未检测 | undetected | B站蓝色 (#23ADE5) | ❓ | 点击检测 |
| 检测中 | detecting | 紫色 (#A578F2) | ⌛ | 检测中... |

**验证方法**:
- 创建临时按钮，通过点击循环切换不同状态
- 确认每种状态的样式和交互效果正确

### 模块3: 本地存储扩展模块

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

**验证方法**:
- 创建临时按钮，点击后添加当前视频到白名单
- 刷新页面，确认能正确读取状态

### 模块4: Python服务端通信模块

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

**验证方法**:
- 启动Python服务端
- 创建临时按钮，点击后发送当前视频的字幕数据
- 确认服务端收到请求并返回正确响应

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