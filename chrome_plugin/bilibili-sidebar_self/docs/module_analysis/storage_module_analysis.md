# storage.js模块分析报告

## 1. 模块概述

storage.js是B站广告跳过插件的核心存储模块，主要负责与Chrome存储API交互，存储和管理各类数据，包括视频广告时间戳、UP主白名单、配置设置等。文件大小为43KB，共1283行代码，是项目中最大的模块，显示出存储逻辑的复杂性。

## 2. 模块结构分析

### 2.1 常量和全局变量

```javascript
// 存储键名常量定义
const STORAGE_KEYS = {
    PREFIX: 'adskip_',
    DEBUG_MODE: 'adskip_debug_mode',
    ENABLED: 'adskip_enabled',
    PERCENTAGE: 'adskip_percentage',
    ADMIN_AUTH: 'adskip_admin_authorized',
    UPLOADER_WHITELIST: 'adskip_uploader_whitelist',
    VIDEO_PREFIX: 'adskip_',
    VIDEO_WHITELIST: 'adskip_video_whitelist',
    // 存储键分组，用于不同操作
    CONFIG_KEYS: [...],
    WHITELIST_KEYS: [...],
    RESERVED_KEYS: function() {...}
};

// 模块私有变量
let debugMode = false; // 私有变量，只在本模块内使用
let lastWhitelistHash = ''; // 白名单缓存哈希
```

模块使用统一的存储键前缀`adskip_`，并将键分为配置键、白名单键和保留键。然而，尽管定义了这些常量分组，后续实现了多个重复功能的辅助函数来获取这些键组，如`getAdminResetKeys()`、`getVideoDataKeys()`、`getConfigKeys()`等，增加了不必要的复杂性。

### 2.2 功能分组

模块可分为以下主要功能组：

1. **存储键管理** (44-114行)：多个获取特定类型键名的辅助函数。
2. **视频数据管理** (122-365行)：处理广告时间戳的加载、验证和保存。
3. **配置管理** (370-590行)：处理功能开关、百分比设置、管理员权限等。
4. **UP主白名单管理** (609-893行)：管理UP主白名单的各种操作。
5. **视频信息获取** (950-981行)：从页面中提取视频标题和UP主信息。
6. **视频白名单管理** (1015-1185行)：管理视频ID白名单。
7. **公共API导出** (1187-1283行)：将内部函数导出为全局对象。

## 3. 白名单相关功能分析

### 3.1 数据结构和格式

UP主白名单管理功能存在一个关键问题：**数据结构不统一**。白名单同时支持两种格式：

1. 字符串数组格式：`['UP主1', 'UP主2', ...]`
2. 对象数组格式：`[{name: 'UP主1', addedAt: timestamp, enabled: true}, ...]`

这种双重格式导致每次白名单操作都需要进行大量格式检查和转换，显著增加了代码复杂性。例如：

```javascript
// saveUploaderWhitelist函数中的格式转换
const formattedWhitelist = whitelist.map(item => {
    if (typeof item === 'string') {
        return {
            name: item,
            addedAt: item.addedAt || Date.now(),
            enabled: item.enabled !== undefined ? item.enabled : true
        };
    }
    return {
        ...item,
        addedAt: item.addedAt || Date.now(),
        enabled: item.enabled !== undefined ? item.enabled : true
    };
});
```

```javascript
// checkUploaderInWhitelist函数中的格式检查
const match = whitelist.find(item =>
    (typeof item === 'string' && item === uploaderName) ||
    (item.name === uploaderName && item.enabled !== false)
);
```

### 3.2 白名单核心函数分析

#### 3.2.1 loadUploaderWhitelist()

```javascript
function loadUploaderWhitelist() {
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEYS.UPLOADER_WHITELIST, (result) => {
            if (result[STORAGE_KEYS.UPLOADER_WHITELIST]) {
                try {
                    const whitelist = JSON.parse(result[STORAGE_KEYS.UPLOADER_WHITELIST]);

                    // 计算当前白名单的哈希值
                    const simpleHash = `${whitelist.length}_${whitelist.length > 0 ? (typeof whitelist[0] === 'string' ? whitelist[0] : whitelist[0]?.name || '') : ''}`;

                    // 只有当白名单内容变化时才输出日志
                    if (simpleHash !== lastWhitelistHash) {
                        adskipUtils.logDebug('已加载UP主白名单', { data: whitelist, throttle: 5000 });
                        lastWhitelistHash = simpleHash;
                    }

                    resolve(whitelist);
                } catch (e) {
                    console.error('解析UP主白名单失败', e);
                    resolve([]);
                }
            } else {
                // 节流输出"未找到白名单"
                if (lastWhitelistHash !== 'empty') {
                    adskipUtils.logDebug('未找到UP主白名单，返回空列表', { throttle: 5000 });
                    lastWhitelistHash = 'empty';
                }
                resolve([]);
            }
        });
    });
}
```

**分析**：
- 函数实现了一个简单的白名单缓存机制，但仅限于日志输出控制，不是真正的数据缓存。
- 每次调用仍会从存储中读取完整白名单，并进行JSON解析。
- 虽然使用了`lastWhitelistHash`变量跟踪白名单变化，但它只用于控制日志输出，不影响实际数据获取。
- 缺少有效的内存缓存机制，导致每次检查白名单状态都必须重新加载和解析所有白名单数据。

#### 3.2.2 checkUploaderInWhitelist()

```javascript
async function checkUploaderInWhitelist(uploaderName) {
    if (!uploaderName) return false;

    const whitelist = await loadUploaderWhitelist();
    const match = whitelist.find(item =>
        (typeof item === 'string' && item === uploaderName) ||
        (item.name === uploaderName && item.enabled !== false)
    );

    return !!match;
}
```

**分析**：
- 每次调用都重新加载整个白名单，缺乏缓存机制。
- 支持两种格式检查增加了复杂性。
- 这个函数在videoMonitor.js模块的`checkAndSkip()`函数中每500ms调用一次，可能造成性能问题。

#### 3.2.3 getCurrentVideoUploader()

```javascript
function getCurrentVideoUploader() {
    return new Promise((resolve) => {
        try {
            // 从页面中提取视频标题
            const titleElement = document.querySelector('.video-title, .tit, h1.title');
            const title = titleElement ? titleElement.textContent.trim() : '未知视频';

            // 从页面中提取UP主名称
            const upElement = document.querySelector('.up-name, .name .username, a.up-name');
            const uploader = upElement ? upElement.textContent.trim() : '未知UP主';

            resolve({ title, uploader });
        } catch (e) {
            adskipUtils.logDebug('提取视频信息失败', e);
            resolve({ title: '未知视频', uploader: '未知UP主' });
        }
    });
}
```

**分析**：
- 每次调用都执行DOM查询，缺乏缓存机制。
- 使用多个选择器以适应B站不同页面结构，但增加了DOM查询复杂度。
- 该函数在videoMonitor.js模块中与`checkUploaderInWhitelist`一起频繁调用，每500ms两次，造成大量不必要的DOM操作。

### 3.3 白名单管理完整功能集

模块实现了UP主白名单的全套CRUD操作：

1. **加载**：`loadUploaderWhitelist()`
2. **保存**：`saveUploaderWhitelist(whitelist)`
3. **检查**：`checkUploaderInWhitelist(uploaderName)`
4. **添加**：`addUploaderToWhitelist(uploader)`
5. **禁用**：`disableUploaderInWhitelist(uploader)`
6. **启用**：`enableUploaderInWhitelist(uploader)`
7. **移除**：`removeUploaderFromWhitelist(uploader)`
8. **导入**：`importUploaderWhitelist(whitelistText)`
9. **导出**：`exportUploaderWhitelist()`
10. **状态切换**：`toggleUploaderWhitelistStatus(uploaderName, enabled)`

虽然功能完整，但每个函数都重复执行白名单加载和格式转换，导致大量冗余代码。

## 4. 关键问题与优化机会

### 4.1 白名单数据结构不统一

**问题**：同时支持字符串数组和对象数组两种格式，导致每个操作都需要进行格式检查和转换。

**解决方案**：
- 统一使用对象数组格式，提供更丰富的元数据（添加时间、状态等）。
- 实现一次性迁移，将现有的字符串格式转换为对象格式。
- 移除所有双重格式检查代码，简化实现。

### 4.2 缺乏有效的白名单缓存机制

**问题**：每次检查白名单状态都重新从存储中加载和解析完整白名单，尤其在高频检查时（每500ms）造成性能问题。

**解决方案**：
- 实现模块级内存缓存，只在白名单实际变化时更新。
- 对特定UP主的检查结果进行缓存，有效期设为较长时间（如5-10秒）。
- 实现事件驱动的缓存更新，当白名单变化时才清除缓存。

### 4.3 getCurrentVideoUploader函数缺乏缓存

**问题**：每次调用都执行DOM查询，在高频调用场景下效率低下。

**解决方案**：
- 实现页面级缓存，只在视频ID变化时才更新UP主信息。
- 使用MutationObserver监听页面标题和UP主信息变化。
- 将缓存的更新与视频ID变化检测机制绑定。

### 4.4 异步操作过度复杂

**问题**：即使是简单操作也使用复杂的Promise链和多层错误处理。

**解决方案**：
- 使用async/await简化异步代码。
- 对非关键操作简化错误处理。
- 集中管理公共的错误处理逻辑。

### 4.5 存储键管理冗余

**问题**：定义了多个功能重复的辅助函数来获取不同类型的键名。

**解决方案**：
- 简化键管理API，减少辅助函数数量。
- 使用更声明式的方法定义键组关系。

## 5. 性能影响评估

白名单相关功能的当前实现对插件性能有以下影响：

1. **频繁存储操作**：每500ms从Chrome存储中读取和解析白名单数据，产生大量I/O操作。
2. **重复DOM查询**：每500ms执行DOM查询获取UP主信息，增加页面负担。
3. **冗余格式转换**：重复执行字符串/对象格式检查和转换，造成CPU开销。
4. **日志过度**：产生大量调试日志，增加控制台负担。

以30分钟的视频播放为例，当前实现会执行：
- 约3,600次白名单加载操作（每500ms一次）
- 约3,600次UP主信息DOM查询（每500ms一次）
- 约7,200次存储和DOM操作的组合（每500ms两次）

## 6. 结论与建议

storage.js模块，特别是白名单相关功能，存在显著的优化空间。建议采取以下措施：

1. **统一数据结构**：仅使用对象数组存储白名单。
2. **实现多级缓存**：
   - 模块级缓存：存储完整白名单，只在实际变化时更新
   - UP主级缓存：缓存特定UP主的检查结果，有效期5-10秒
   - 页面级缓存：缓存当前UP主信息，只在视频ID变化时更新
3. **优化高频操作**：
   - 将白名单检查频率从500ms降低到1-2秒
   - 合并getCurrentVideoUploader和checkUploaderInWhitelist的缓存机制
4. **简化异步操作**：
   - 对非关键操作使用更简单的异步模式
   - 使用async/await替代Promise链
5. **减少日志输出**：
   - 只在调试模式开启时输出详细日志
   - 进一步提高日志节流阈值

通过这些优化，可以显著提高插件性能，降低资源消耗，同时保持功能完整性。