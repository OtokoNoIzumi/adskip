# videoMonitor模块详细文档

## 一、模块支持的用户功能

| 用户功能 | 功能描述 | 关键实现函数 | 必要性评级 |
|---------|---------|------------|----------|
| **自动广告跳过** | 检测并跳过广告内容 | checkAndSkip | 核心 |
| **广告进度条标记** | 在进度条上显示广告位置 | markAdPositionsOnProgressBar | 核心 |
| **手动广告跳过** | 点击标记手动跳过广告 | 标记点击事件处理 | 高 |
| **UP主白名单支持** | 为白名单UP主跳过自动跳过 | checkAndSkip中的白名单检查 | 中 |
| **视频切换检测** | 检测视频ID变化并重新初始化 | setupUrlChangeMonitor | 高 |

### 1. 自动广告跳过

**用户体验**：用户无需手动操作，视频播放至广告区域时自动跳到广告结束处。

**实现方式**：
- `checkAndSkip`函数每500ms检查一次播放进度
- 通过比较当前播放时间与广告时间戳判断是否在广告区域
- 如果在广告区域，设置`scriptInitiatedSeek = true`并跳转到广告结束位置

**剪枝评估**：核心功能，必须保留，但检查频率和异步操作可优化。

### 2. 广告进度条标记

**用户体验**：用户可直观看到视频中广告的位置，悬停时显示详细信息。

**实现方式**：
- `markAdPositionsOnProgressBar`函数创建和定位标记元素
- 根据广告时间戳计算位置和宽度
- 为每个标记添加悬停、点击等交互事件

**剪枝评估**：核心用户界面功能，必须保留，但标记更新触发机制可优化。

### 3. 手动广告跳过

**用户体验**：用户点击进度条上的广告标记可手动跳过该广告。

**实现方式**：
- 广告标记的点击事件处理函数
- 使用`getCurrentRealPlaybackTime`获取当前播放位置
- 根据点击位置和当前播放进度决定是否跳转

**剪枝评估**：重要功能，尤其对白名单UP主的视频必要，应保留。

## 二、模块职责

`videoMonitor.js` 负责视频监控和广告跳过功能的核心实现，包括：
- 监控视频播放进度，检测是否进入广告区域
- 在适当时机跳过广告
- 在进度条上标记广告位置
- 处理视频切换/URL变化
- 管理UP主白名单相关跳过逻辑

## 三、模块组件与剪枝评估

### 1. 核心函数评估

| 函数名 | 功能描述 | 支持的用户功能 | 剪枝评估 | 优化建议 |
|-------|---------|--------------|---------|---------|
| checkAndSkip | 检查当前播放进度是否在广告区域并执行跳过 | 自动广告跳过 | 必要保留 | 白名单检查可优化为缓存机制 |
| markAdPositionsOnProgressBar | 在进度条上标记广告位置 | 广告标记、手动跳过 | 必要保留 | DOM操作可优化 |
| setupAdSkipMonitor | 设置广告跳过监控系统 | 自动跳过、广告标记 | 必要保留 | 保留核心逻辑 |
| setupAdMarkerMonitor | 设置广告标记监控 | 广告标记 | 已优化为事件监听 | 继续保留事件驱动方式 |
| setupUrlChangeMonitor | 监控URL变化，检测视频ID变化 | 视频切换检测 | 必要保留 | 无需更改 |
| setupPlaybackTimeMonitor | 更新播放时间缓存 | 手动广告跳过 | 需替换实现 | 使用timeupdate事件替代轮询 |
| getCurrentRealPlaybackTime | 获取当前播放时间 | 手动广告跳过 | 必要保留 | 调用方式可优化 |

### 2. 问题模块详细评估

#### setupPlaybackTimeMonitor (急需优化)

**当前实现**：
```javascript
function setupPlaybackTimeMonitor() {
    if (window.playbackTimeMonitorInterval) {
        clearInterval(window.playbackTimeMonitorInterval);
    }

    window.playbackTimeMonitorInterval = setInterval(function() {
        adskipUtils.logDebug('PlaybackMonitor: 刷新播放器引用，来自 setupPlaybackTimeMonitor');
        const videoPlayer = adskipUtils.findVideoPlayer();
        if (videoPlayer && !videoPlayer.paused && !videoPlayer.ended) {
            lastKnownPlaybackTime = videoPlayer.currentTime;
            lastPlaybackTimeUpdate = Date.now();
        }
    }, 100);

    window.addEventListener('unload', function() {
        if (window.playbackTimeMonitorInterval) {
            clearInterval(window.playbackTimeMonitorInterval);
        }
    });
}
```

**问题**：
- 每100ms调用一次findVideoPlayer，产生大量日志
- 高频轮询消耗资源
- 实际只在用户点击广告标记时使用缓存的播放时间

**优化建议**：
```javascript
function setupPlaybackTimeMonitor() {
    // 清除旧监听器
    if (window.playbackTimeMonitorInterval) {
        clearInterval(window.playbackTimeMonitorInterval);
        window.playbackTimeMonitorInterval = null;
    }

    const videoPlayer = adskipUtils.findVideoPlayer();
    if (videoPlayer) {
        // 使用timeupdate事件代替setInterval
        if (!videoPlayer._adskipTimeUpdateHandler) {
            videoPlayer._adskipTimeUpdateHandler = function() {
                lastKnownPlaybackTime = this.currentTime;
                lastPlaybackTimeUpdate = Date.now();
            };
            videoPlayer.addEventListener('timeupdate', videoPlayer._adskipTimeUpdateHandler);

            // 初始设置一次
            lastKnownPlaybackTime = videoPlayer.currentTime;
            lastPlaybackTimeUpdate = Date.now();
        }
    }

    // 清理资源
    window.addEventListener('unload', function() {
        const player = document.querySelector('video');
        if (player && player._adskipTimeUpdateHandler) {
            player.removeEventListener('timeupdate', player._adskipTimeUpdateHandler);
        }
    });
}
```

**评估**：优化后将大幅减少日志输出和资源消耗，同时保持用户功能完整。

#### checkAndSkip中的白名单检查 (需优化)

**当前实现**：
```javascript
// 白名单检查
const { uploader } = await adskipStorage.getCurrentVideoUploader();
const isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);
```

**问题**：
- 每500ms执行两次异步操作
- 白名单状态短时间内不会变化
- 频繁的异步操作降低性能

**优化建议**：
```javascript
// 在模块顶部定义缓存
let whitelistCache = { uploader: '', status: false, lastCheck: 0 };

// 在checkAndSkip中
let isUploaderWhitelisted = false;
const now = Date.now();

// 仅在缓存过期或UP主变化时查询
if (now - whitelistCache.lastCheck > 5000 || whitelistCache.uploader !== _lastUploaderName) {
    const { uploader } = await adskipStorage.getCurrentVideoUploader();
    isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);
    whitelistCache = { uploader, status: isUploaderWhitelisted, lastCheck: now };
} else {
    isUploaderWhitelisted = whitelistCache.status;
}
```

**评估**：显著减少异步操作次数，提高性能，同时保持白名单功能完整。

## 四、依赖分析与剪枝评估

### 1. 外部依赖

#### chrome.storage API

| 方法/属性 | 调用位置 | 用途 | 剪枝评估 |
|---------|---------|------|---------|
| chrome.storage.local.get | checkAndSkip() | 获取广告跳过功能状态 | 必要，保留 |
| chrome.storage.onChanged | 模块底部 | 监听设置变化 | 必要，保留 |

#### DOM API

| 方法/元素 | 调用位置 | 用途 | 剪枝评估 |
|----------|---------|------|---------|
| document.querySelector/querySelectorAll | 多处 | 查找DOM元素 | 必要，可优化查询频率 |
| element.addEventListener | 多处 | 添加事件监听 | 必要，保留 |
| MutationObserver | setupAdMarkerMonitor等 | 监听DOM变化 | 必要，保留 |

### 2. 内部依赖

#### adskipUtils 模块

| 方法 | 调用位置 | 调用频率 | 剪枝评估 |
|------|---------|---------|---------|
| logDebug | 所有函数 | 非常高 | 保留但优化节流参数 |
| findVideoPlayer | 多处 | 非常高 (每100ms) | 保留但大幅降低调用频率 |
| findProgressBar | markAdPositionsOnProgressBar | 中 | 保留，利用缓存机制减少调用 |
| getCurrentVideoId | checkAndSkip等 | 中 | 保留，集中到URL变化监听处 |

#### adskipStorage 模块

| 方法 | 调用位置 | 调用频率 | 剪枝评估 |
|------|---------|---------|---------|
| getCurrentVideoUploader | checkAndSkip | 高 (每500ms) | 保留但添加缓存机制 |
| checkUploaderInWhitelist | checkAndSkip | 高 (每500ms) | 保留但添加缓存机制 |
| saveAdTimestampsForVideo | setupAdSkipMonitor | 低 | 保留 |
| loadAndValidateTimestamps | reinitialize | 低 | 保留 |

## 五、定时器和事件监听评估

### 1. 定时器

| 名称 | 间隔 | 用途 | 剪枝评估 |
|------|------|------|---------|
| playbackTimeMonitorInterval | 100ms | 更新播放时间缓存 | 替换为timeupdate事件 |
| adSkipCheckInterval | 500ms | 检查和跳过广告 | 保留但考虑降低频率至1000ms |

### 2. 事件监听

| 事件 | 监听位置 | 用途 | 剪枝评估 |
|------|---------|------|---------|
| loadedmetadata, durationchange等 | setupAdMarkerMonitor | 更新广告标记 | 保留(已优化为事件驱动) |
| fullscreenchange | setupAdMarkerMonitor | 更新广告标记 | 保留(已优化为事件驱动) |
| seeking | checkAndSkip | 处理跳转事件 | 保留(防止循环触发) |
| popstate/hashchange | setupUrlChangeMonitor | 检测URL变化 | 保留(页面导航必要) |
| unload | 多处 | 清理资源 | 保留(防止内存泄漏) |

## 六、总体优化建议

1. **播放时间监控**：使用timeupdate事件替代100ms轮询，大幅减少日志和资源消耗

2. **白名单检查**：实现缓存机制，减少异步操作频率

3. **DOM元素查找**：增强现有缓存机制，减少查询频率

4. **广告检测频率**：考虑将adSkipCheckInterval从500ms降低到1000ms

5. **日志优化**：所有日志添加合理的throttle参数，减少输出频率