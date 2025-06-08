# videoMonitor.js模块分析报告

## 1. 模块概述

videoMonitor.js是B站广告跳过插件的核心监控模块，负责视频播放监控、广告检测与跳过、广告标记显示等核心功能。文件大小为28KB，共685行代码，是项目中第三大的模块。它实现了插件的主要业务逻辑，与存储模块和工具模块紧密协作。

## 2. 模块结构分析

### 2.1 全局变量

```javascript
// 缓存当前播放时间
let lastKnownPlaybackTime = 0;
let lastPlaybackTimeUpdate = 0;

// 缓存白名单状态
let _lastUploaderName = '';
let _lastWhitelistStatus = false;
let _lastGlobalSkipStatus = true;
```

模块定义了多个全局变量来缓存播放状态和白名单状态，但缓存机制实现不完整，某些缓存（如白名单状态）仅用于控制日志输出，不能有效减少实际操作次数。

### 2.2 功能分组

模块可分为以下主要功能组：

1. **播放时间监控** (15-57行)：监控和缓存视频播放时间。
2. **广告跳过监控** (60-98行)：设置周期性检查和跳过广告的定时器。
3. **广告检测与跳过** (120-248行)：核心逻辑，检测广告并执行跳过。
4. **广告标记渲染** (251-399行)：在进度条上标记广告位置和添加交互。
5. **URL变化监控** (428-534行)：监测URL和视频ID变化并重新初始化。
6. **状态同步与重初始化** (536-626行)：处理插件状态变化和重置逻辑。

## 3. 白名单相关功能分析

videoMonitor.js模块通过与storage.js模块交互来实现对白名单的检查和使用。其中，最关键的是`checkAndSkip()`函数，它在每个广告检测周期中执行。

### 3.1 checkAndSkip函数分析

```javascript
function checkAndSkip() {
    // 检查扩展上下文是否有效
    if (!isExtensionContextValid()) {
        // ... 上下文检查逻辑 ...
        return;
    }

    // 检查是否启用广告跳过功能
    chrome.storage.local.get('adskip_enabled', async function(result) {
        if (result.adskip_enabled === false) {
            // ... 功能禁用处理 ...
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
            // 白名单生效，不执行跳过
            if (statusChanged) {
                adskipUtils.logDebug(`UP主"${uploader}"在白名单中且启用状态，不执行自动跳过 (手动模式：${!globalSkipEnabled ? '是' : '否'})`);
            }
            return;
        }

        // ... 下面是广告检测和跳过逻辑 ...
    });
}
```

**分析**：

1. **高频异步操作**：此函数每500ms被调用一次，且每次调用都执行两个异步操作：
   - `getCurrentVideoUploader()`：执行DOM查询获取UP主信息
   - `checkUploaderInWhitelist()`：加载并检查白名单状态

2. **有限的缓存机制**：虽然使用`_lastUploaderName`和`_lastWhitelistStatus`变量跟踪状态变化，但这些缓存变量仅用于控制日志输出，不能阻止每次检查都执行完整的异步操作流程。

3. **嵌套回调结构**：函数使用嵌套的回调和Promise结构，增加了代码复杂性和可能的错误处理问题。

### 3.2 广告标记点击处理中的白名单检查

在`markAdPositionsOnProgressBar()`函数中，也实现了对白名单的检查，用于决定是否允许手动跳过广告：

```javascript
marker.addEventListener('click', async function(e) {
    // ... 事件处理前置逻辑 ...

    // 检查全局是否关闭了广告跳过
    chrome.storage.local.get('adskip_enabled', async function(result) {
        const globalSkipEnabled = result.adskip_enabled !== false;

        // 获取当前UP主信息
        const { uploader } = await adskipStorage.getCurrentVideoUploader();

        // 检查UP主是否在白名单中
        const isUploaderWhitelisted = await adskipStorage.checkUploaderInWhitelist(uploader);

        // ... 详细的调试日志 ...

        // 满足条件时执行跳过：
        // 1. 全局跳过关闭或UP主在白名单中，且
        // 2. 当前播放位置在广告范围内，且
        // 3. 点击位置在当前播放进度之后
        if (((!globalSkipEnabled) || (globalSkipEnabled && isUploaderWhitelisted))
            && isInAdRange && isClickAheadOfPlayback) {
            // ... 执行跳过逻辑 ...
        } else if (globalSkipEnabled && !isUploaderWhitelisted) {
            // ... 提示用户无需手动跳过 ...
        } else if (!isInAdRange) {
            // ... 不在广告范围内提示 ...
        } else if (!isClickAheadOfPlayback) {
            // ... 点击位置在当前播放进度之前提示 ...
        }
    });
});
```

**分析**：

1. **重复的异步操作**：每次用户点击广告标记，都会重新执行相同的白名单检查流程，包括DOM查询和存储操作。

2. **复杂的条件判断**：使用多重条件组合判断是否执行跳过，逻辑复杂且难以维护。

3. **重复代码**：广告标记点击处理中的白名单检查逻辑与`checkAndSkip()`函数中的逻辑高度相似，但代码重复实现，没有提取为共享函数。

### 3.3 白名单状态变化监听

模块通过监听storage变化来处理白名单状态更新：

```javascript
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
            // ... UI更新逻辑 ...
        }
    })();
}
```

**分析**：

1. **使用存储事件监听**：通过监听Chrome存储变化来检测白名单更新，这是一个有效的事件驱动方法。

2. **缺少缓存更新**：虽然检测到变化后重新检查了白名单状态，但没有更新模块级缓存或清除过期缓存。

3. **重复的异步操作**：每次白名单变化都重新执行完整的异步操作流程，而不是直接使用更新后的数据。

## 4. 广告检测与跳过定时器

`setupAdSkipMonitor()`函数设置了广告检测的核心定时器：

```javascript
window.adSkipCheckInterval = setInterval(function() {
    checkAndSkip();
}, 500);
```

这个500ms的定时器间隔直接影响了白名单检查的频率。每500ms执行一次`checkAndSkip()`，意味着同样频率地执行白名单相关的异步操作。

## 5. 关键问题与优化机会

### 5.1 高频异步操作

**问题**：每500ms执行一次完整的白名单检查流程，包括DOM查询和存储操作，造成性能问题。

**解决方案**：
- 降低检查频率到1000-2000ms，广告通常持续较长时间，降低频率不会影响用户体验。
- 实现更有效的白名单状态缓存，缓存有效期可设为5-10秒。
- 将白名单检查结果缓存为模块级变量，而不仅仅用于控制日志。

### 5.2 缺乏有效缓存机制

**问题**：虽然实现了简单的状态跟踪，但没有阻止重复的异步操作。

**解决方案**：
- 实现真正的缓存机制，包括设置缓存有效期。
- 添加缓存版本控制，当检测到白名单变化时才更新缓存。
- 使用带时间戳的缓存，自动过期而不是每次都重新获取。

```javascript
// 示例改进
let uploaderCache = {
    name: '',
    timestamp: 0,
    ttl: 10000 // 10秒缓存
};

let whitelistStatusCache = {
    uploader: '',
    status: false,
    timestamp: 0,
    ttl: 10000 // 10秒缓存
};

async function getUploaderWithCache() {
    const now = Date.now();
    if (uploaderCache.name && now - uploaderCache.timestamp < uploaderCache.ttl) {
        return uploaderCache.name;
    }

    const {uploader} = await adskipStorage.getCurrentVideoUploader();
    uploaderCache = {
        name: uploader,
        timestamp: now,
        ttl: 10000
    };
    return uploader;
}
```

### 5.3 检测定时器频率过高

**问题**：500ms的检测频率过高，造成不必要的资源消耗。

**解决方案**：
- 将定时器间隔从500ms增加到1000-2000ms。
- 实现动态定时器间隔：广告时长越长，检测间隔越大。
- 使用视频的timeupdate事件代替setInterval，减少不必要的检查。

### 5.4 拆分过大的checkAndSkip函数

**问题**：`checkAndSkip()`函数过于庞大，包含多个不同的逻辑分支，难以维护和优化。

**解决方案**：
- 将函数拆分为多个更小的专用函数，如`checkWhitelistStatus()`, `detectAdSegment()`, `performAdSkip()`等。
- 使用更现代的async/await语法重构异步逻辑，避免回调嵌套。
- 提取共用的白名单检查逻辑为单独函数，避免代码重复。

### 5.5 合并重复的白名单检查逻辑

**问题**：在`checkAndSkip()`和广告标记点击处理中重复实现了相似的白名单检查逻辑。

**解决方案**：
- 提取共用逻辑为独立函数，如`shouldAllowSkip(uploader)`。
- 在这个共享函数中实现缓存机制，避免重复操作。
- 使用更清晰的条件判断组织逻辑，提高可读性。

## 6. 性能影响评估

当前实现对性能的影响：

1. **高CPU使用率**：500ms间隔的定时器会导致频繁CPU唤醒和处理。
2. **过多的存储操作**：每500ms一次的白名单加载会增加Chrome存储API负担。
3. **频繁DOM操作**：每500ms一次的UP主信息DOM查询会增加页面渲染负担。
4. **电池消耗**：频繁的检查和异步操作会导致移动设备更快地耗尽电池。

以一个30分钟视频为例：
- 执行3,600次白名单检查（每500ms一次）
- 执行3,600次DOM查询（每500ms一次）
- 产生7,200次异步操作（每次检查有2个异步操作）

## 7. 与其他模块的交互评估

videoMonitor.js与其他模块的交互也存在优化空间：

1. **与storage.js交互**：依赖频繁的异步API调用，缺少中间缓存层。
2. **与utils.js交互**：频繁调用DOM查询函数如`findVideoPlayer()`，增加性能负担。
3. **与UI.js交互**：白名单状态变化时的UI更新逻辑分散在多个模块中。

## 8. 结论与建议

videoMonitor.js模块，特别是其白名单检查相关功能，存在显著的性能问题和优化空间。建议采取以下措施：

1. **降低检测频率**：
   - 将广告检测间隔从500ms增加到1000-2000ms。
   - 考虑使用timeupdate事件代替setInterval。

2. **实现有效缓存**：
   - 为UP主信息和白名单状态实现真正的缓存机制。
   - 设置合理的缓存有效期（5-10秒）。
   - 实现缓存版本控制，在存储变化时更新缓存。

3. **重构检测逻辑**：
   - 将大型函数拆分为多个功能单一的小函数。
   - 提取共用逻辑为独立函数。
   - 使用async/await重写异步逻辑，提高可读性。

4. **优化模块间交互**：
   - 实现更高级的状态共享机制。
   - 减少跨模块的重复操作。
   - 统一白名单状态管理逻辑。

通过这些优化，可以显著提高插件性能，降低资源消耗，同时保持功能完整性。