# videoMonitor 模块技术文档

## 一、模块概述

`videoMonitor.js` 是B站广告跳过插件的核心模块，负责视频监控和广告跳过功能的实现。主要功能包括检测视频播放进度、在适当时机跳过广告、在进度条上标记广告位置，并提供相应的用户交互功能。

## 二、模块依赖

### 外部依赖

- **chrome.storage API**: 用于读取和保存插件配置
- **DOM API**: 用于查找和操作页面元素（播放器、进度条等）
- **HTML5 Video API**: 用于获取和控制视频播放（currentTime、duration等）
- **MutationObserver API**: 用于监听DOM变化

### 内部依赖

- **adskipUtils**: 提供各种工具函数，如日志、DOM元素查找、时间格式化
- **adskipStorage**: 提供数据存储和读取功能
- **adskipUI**: 提供界面相关功能

## 三、全局变量

| 变量名 | 类型 | 用途 | 更新时机 |
|-------|------|-----|---------|
| `lastKnownPlaybackTime` | Number | 缓存的最新播放时间 | 由播放时间监控器更新 |
| `lastPlaybackTimeUpdate` | Number | 上次更新播放时间的时间戳 | 由播放时间监控器更新 |
| `currentAdTimestamps` | Array | 当前视频的广告时间段 | 由`setupAdSkipMonitor`设置 |
| `scriptInitiatedSeek` | Boolean | 标记跳转是否由脚本发起 | 执行广告跳过前设置 |
| `_lastUploaderName` | String | 缓存的UP主名称 | 检查白名单时更新 |
| `_lastWhitelistStatus` | Boolean | 缓存的白名单状态 | 检查白名单时更新 |
| `_lastGlobalSkipStatus` | Boolean | 缓存的全局跳过开关状态 | 检查配置时更新 |

## 四、核心函数

### 1. 播放时间相关

#### getCurrentRealPlaybackTime()
- **功能**: 获取当前播放时间，优先使用缓存
- **返回值**: Number - 当前播放时间（秒）
- **调用时机**: 需要准确播放时间时（如点击广告标记时）
- **数据流**: `findVideoPlayer` → 更新缓存 → 返回时间

#### setupPlaybackTimeMonitor()
- **功能**: 设置定时器，定期更新播放时间缓存
- **定时器**: 每100ms执行一次
- **调用时机**: `setupAdSkipMonitor`中调用
- **数据流**: 定时器 → `findVideoPlayer` → 更新全局缓存

### 2. 广告跳过相关

#### setupAdSkipMonitor(adTimestamps)
- **功能**: 设置广告跳过监控
- **参数**: `adTimestamps` - 广告时间戳数组
- **调用时机**:
  - 初始化时（`core.js`中的`init`）
  - 视频ID变化时
  - 设置变化时
- **数据流**:
  - 更新`currentAdTimestamps`
  - 保存到存储
  - 设置`adSkipCheckInterval`定时器（每500ms）
  - 调用`setupPlaybackTimeMonitor`
  - 调用`markAdPositionsOnProgressBar`

#### checkAndSkip()
- **功能**: 检查当前播放进度是否进入广告区域，若是则跳过
- **调用时机**: 由`adSkipCheckInterval`定时器触发（每500ms）
- **数据流**:
  - 检查扩展上下文
  - 检查广告跳过功能是否启用
  - 检查UP主是否在白名单
  - 获取播放时间并检测是否在广告区域
  - 如果在广告区域，设置`scriptInitiatedSeek = true`并跳转

### 3. 广告标记相关

#### markAdPositionsOnProgressBar()
- **功能**: 在视频进度条上标记广告位置
- **调用时机**:
  - `setupAdSkipMonitor`中调用
  - 视频元数据加载时
  - 视频时长变化时
  - 全屏状态变化时
  - 播放器样式变化时
- **数据流**:
  - 检查是否有广告时间戳
  - 查找视频播放器和进度条
  - 计算每个广告的位置和宽度
  - 创建和定位DOM元素
  - 添加事件监听（鼠标交互、点击跳过）

#### setupAdMarkerMonitor()
- **功能**: 设置广告标记监控，监听视频状态变化以更新标记
- **调用时机**: 初始化时（`core.js`中的`init`）
- **数据流**:
  - 设置视频事件监听（loadedmetadata、durationchange等）
  - 设置全屏变化监听
  - 设置窗口大小变化监听
  - 设置播放器样式变化监听（MutationObserver）

### 4. URL和视频ID监控

#### setupUrlChangeMonitor()
- **功能**: 监控URL变化，检测视频ID变化
- **调用时机**: 初始化时（`core.js`中的`init`）
- **数据流**:
  - 设置MutationObserver监听DOM变化
  - 设置popstate和hashchange事件监听
  - 检测URL变化并调用`checkForVideoChange`

#### checkForVideoChange()
- **功能**: 检查当前视频ID是否变化
- **调用时机**: URL变化时
- **数据流**:
  - 获取新的视频ID
  - 如有变化，更新`currentVideoId`和`lastVideoId`
  - 调用`reinitialize`重新初始化

#### reinitialize()
- **功能**: 重新初始化插件状态
- **调用时机**: 视频ID变化时
- **数据流**:
  - 重新解析URL参数
  - 加载并验证时间戳
  - 更新全局变量
  - 设置或清除监控
  - 更新面板信息

## 五、事件和定时器

### 定时器

| 名称 | 间隔 | 功能 | 设置位置 | 清除位置 |
|-----|-----|-----|---------|---------|
| `playbackTimeMonitorInterval` | 100ms | 更新播放时间缓存 | `setupPlaybackTimeMonitor` | unload事件、自身函数开始 |
| `adSkipCheckInterval` | 500ms | 检查和跳过广告 | `setupAdSkipMonitor` | unload事件、`setupAdSkipMonitor`开始 |

### 事件监听

| 目标 | 事件 | 功能 | 添加位置 |
|-----|-----|-----|---------|
| videoPlayer | loadedmetadata | 更新广告标记 | `setupVideoEvents` |
| videoPlayer | durationchange | 更新广告标记 | `setupVideoEvents` |
| videoPlayer | seeking | 处理跳转事件 | `checkAndSkip` |
| document | fullscreenchange | 更新广告标记 | `setupVideoEvents` |
| window | resize | 更新广告标记 | `setupVideoEvents` |
| window | unload | 清理资源 | 多个函数中 |
| playerContainer | MutationObserver | 监听播放器样式变化 | `setupVideoEvents` |
| document | MutationObserver | 监听DOM变化 | `setupUrlChangeMonitor` |
| window | popstate | 检查URL变化 | `setupUrlChangeMonitor` |
| window | hashchange | 检查URL变化 | `setupUrlChangeMonitor` |
| chrome.storage | onChanged | 监听设置变化 | 模块底部 |

## 六、性能和优化考虑

1. **播放器和进度条元素查找**:
   - 通过`adskipUtils.findVideoPlayer`和`adskipUtils.findProgressBar`查找
   - 这些函数内部有5秒缓存机制减少DOM查询

2. **状态缓存**:
   - 使用`_lastUploaderName`、`_lastWhitelistStatus`等缓存状态，减少状态检查频率

3. **事件监听优化**:
   - 使用`_adskipMetadataHandler`等命名函数防止重复添加监听器
   - 使用定时器延迟处理频繁触发的事件

4. **日志节流**:
   - 大部分日志调用使用`{ throttle: xxx }`参数控制输出频率

## 七、潜在优化点

1. **播放时间监控**:
   - 当前每100ms轮询，可考虑使用`timeupdate`事件替代

2. **广告检测频率**:
   - 当前每500ms检查一次，可适当降低频率或结合事件实现

3. **DOM元素缓存**:
   - 可以在模块级别缓存DOM元素引用，减少重复查找