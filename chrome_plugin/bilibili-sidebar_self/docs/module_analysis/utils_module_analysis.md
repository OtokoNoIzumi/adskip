# utils.js模块分析报告

## 1. 模块概述

utils.js是B站广告跳过插件的工具函数模块，提供了各种辅助功能以支持插件的其他模块。文件大小约为10KB，包含多个通用工具函数，涵盖日志记录、DOM操作、视频信息提取、时间处理等功能。该模块不直接实现业务逻辑，而是为其他模块提供基础功能支持。

## 2. 模块功能结构

utils.js模块可以分为以下几个主要功能组：

1. **日志与调试工具**：提供调试日志记录功能
2. **DOM操作工具**：封装DOM元素查询、操作和事件处理
3. **视频信息工具**：提取视频ID、播放器状态等信息
4. **时间处理工具**：时间戳格式化、转换和比较
5. **字符串处理工具**：文本格式化、解析和验证
6. **数组和对象处理工具**：数据结构操作辅助函数

模块采用了模块化设计，通过导出特定函数使其可供其他模块使用。

## 3. 与白名单相关的功能分析

虽然utils.js主要是通用工具函数集合，但其中一些函数在白名单功能实现中起到重要作用：

### 3.1 视频作者信息提取

```javascript
/**
 * 获取当前视频的UP主名称和头像URL
 * @returns {Promise<{uploader: string, avatarUrl: string}>} 包含UP主名称和头像URL的对象
 */
function getVideoUploader() {
    return new Promise((resolve) => {
        try {
            // 尝试查找UP主信息元素
            const uploaderElement = document.querySelector('.up-name') ||
                                   document.querySelector('.username');

            // 尝试查找头像元素
            const avatarElement = document.querySelector('.up-info-image img') ||
                                 document.querySelector('.up-info .face img');

            if (uploaderElement) {
                const uploader = uploaderElement.textContent.trim();
                const avatarUrl = avatarElement ? avatarElement.src : '';

                resolve({
                    uploader: uploader,
                    avatarUrl: avatarUrl
                });
            } else {
                // 未找到UP主信息，返回默认值
                resolve({
                    uploader: '未知UP主',
                    avatarUrl: ''
                });
            }
        } catch (error) {
            console.error('获取UP主信息时出错:', error);
            resolve({
                uploader: '未知UP主',
                avatarUrl: ''
            });
        }
    });
}
```

**分析**：

1. **功能作用**：该函数负责从B站页面DOM中提取当前视频的UP主名称和头像，这是白名单功能的基础，因为白名单检查需要知道当前视频的UP主。

2. **DOM依赖问题**：函数通过硬编码的CSS选择器查找页面元素，如果B站页面结构变化，可能导致提取失败。

3. **错误处理**：使用try-catch和默认值处理可能的错误，确保即使提取失败也不会导致Promise拒绝。

4. **冗余CSS选择器**：使用了多个备选CSS选择器以适应不同页面结构，显示出对页面结构不稳定的担忧。

### 3.2 视频ID获取

```javascript
/**
 * 获取当前视频的ID
 * @returns {string} 视频ID或空字符串
 */
function getCurrentVideoId() {
    try {
        const url = window.location.href;

        // 匹配B站视频URL中的视频ID
        const match = url.match(/\/video\/(BV[\w]+)/) ||
                      url.match(/\/bangumi\/play\/ep(\d+)/) ||
                      url.match(/\/bangumi\/play\/ss(\d+)/);

        if (match && match[1]) {
            return match[1];
        }

        return '';
    } catch (error) {
        console.error('获取视频ID时出错:', error);
        return '';
    }
}
```

**分析**：

1. **功能作用**：该函数提取当前页面URL中的视频ID，用于识别视频并关联存储的广告时间戳和白名单信息。

2. **多格式支持**：支持多种B站URL格式，包括普通视频和番剧页面，提高了兼容性。

3. **错误处理**：使用try-catch处理可能的错误，确保函数始终返回有效值（即使是空字符串）。

### 3.3 日志记录功能

```javascript
/**
 * 输出调试日志
 * @param {string} message 日志消息
 */
function logDebug(message) {
    if (isDebugMode) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        console.log(`[${timestamp}] ${message}`);
    }
}
```

**分析**：

1. **功能作用**：提供调试日志功能，对追踪白名单相关操作和问题排查非常有用。

2. **条件输出**：仅在调试模式下输出日志，避免正常使用时产生大量控制台输出。

3. **时间戳格式化**：为每条日志添加时间戳，有助于分析操作序列和性能问题。

## 4. 关键问题和优化机会

### 4.2 缺少性能优化机制

**问题**：工具函数没有实现缓存机制，导致重复调用时重复执行相同操作，特别是DOM查询操作。

**优化建议**：
- 实现函数调用结果缓存系统，特别是对于频繁调用但结果变化不大的函数
- 添加防抖和节流机制，限制高频调用
- 优化DOM查询方法，减少页面重排和重绘

```javascript
// 缓存装饰器示例
function withCache(fn, keyFn = null, ttl = 5000) {
    const cache = new Map();

    return function(...args) {
        const key = keyFn ? keyFn(...args) : JSON.stringify(args);
        const now = Date.now();

        if (cache.has(key)) {
            const { value, timestamp } = cache.get(key);
            if (now - timestamp < ttl) {
                return value;
            }
        }

        const result = fn.apply(this, args);

        // 处理Promise结果
        if (result instanceof Promise) {
            return result.then(value => {
                cache.set(key, { value, timestamp: now });
                return value;
            });
        }

        // 处理普通结果
        cache.set(key, { value: result, timestamp: now });
        return result;
    };
}

// 使用示例
const getVideoUploaderCached = withCache(getVideoUploader, null, 30000);
```

### 4.3 错误处理不够完善

**问题**：虽然函数普遍使用try-catch处理异常，但缺乏系统化的错误报告和恢复机制。

**优化建议**：
- 实现统一的错误处理系统，包括日志记录、分类和严重性评估
- 添加重试机制，特别是对于网络和DOM操作
- 提供更详细的错误信息，便于调试和问题排查

```javascript
// 改进的错误处理系统示例
const ErrorHandler = {
    // 错误级别
    levels: {
        INFO: 0,
        WARNING: 1,
        ERROR: 2,
        CRITICAL: 3
    },

    // 记录错误
    log(message, error, level = 'ERROR') {
        const errorLevel = this.levels[level] || this.levels.ERROR;

        // 创建错误记录
        const errorRecord = {
            timestamp: new Date().toISOString(),
            message,
            level,
            details: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause
            } : null,
            context: this.getContext()
        };

        // 控制台输出
        if (isDebugMode || errorLevel >= this.levels.ERROR) {
            console.error(`[${errorRecord.timestamp}] [${level}] ${message}`, error);
        }

        // 存储错误记录
        this.storeError(errorRecord);

        // 关键错误的额外处理
        if (errorLevel >= this.levels.CRITICAL) {
            this.handleCriticalError(errorRecord);
        }

        return errorRecord;
    },

    // 获取上下文信息
    getContext() {
        return {
            url: window.location.href,
            videoId: getCurrentVideoId(),
            userAgent: navigator.userAgent
            // 添加其他上下文信息
        };
    },

    // 存储错误记录
    storeError(errorRecord) {
        // 实现存储逻辑
    },

    // 处理关键错误
    handleCriticalError(errorRecord) {
        // 实现关键错误处理逻辑
    }
};

// 使用示例
function safeExecute(fn, fallbackValue, errorMessage) {
    try {
        return fn();
    } catch (error) {
        ErrorHandler.log(errorMessage, error);
        return fallbackValue;
    }
}
```

## 5. 与其他模块的交互关系

utils.js作为工具函数模块，与其他几个主要模块有密切的交互关系：

### 5.1 与storage.js的交互

storage.js大量使用utils.js提供的日志、时间处理和数据验证功能：

```javascript
// storage.js示例
async function loadUploaderWhitelist() {
    try {
        // 使用utils的日志功能
        adskipUtils.logDebug('加载UP主白名单...');

        // 使用utils的存储读取功能
        const data = await chrome.storage.local.get([KEYS.UPLOADER_WHITELIST]);
        const whitelist = data[KEYS.UPLOADER_WHITELIST] || [];

        // 使用utils的时间格式化功能
        adskipUtils.logDebug(`白名单加载完成，时间: ${adskipUtils.formatTime(new Date())}`);

        return whitelist;
    } catch (error) {
        adskipUtils.logDebug('加载UP主白名单失败: ' + error.message);
        return [];
    }
}
```

### 5.2 与videoMonitor.js的交互

videoMonitor.js依赖utils.js提供的视频信息提取和DOM操作功能：

```javascript
// videoMonitor.js示例
async function checkAndSkip() {
    try {
        // 使用utils获取当前播放时间
        const currentTime = await adskipUtils.getCurrentVideoTime();

        // 使用utils获取视频UP主
        const { uploader } = await adskipUtils.getVideoUploader();

        // 使用utils记录日志
        adskipUtils.logDebug(`检查时间: ${currentTime}, UP主: ${uploader}`);

        // 后续处理...
    } catch (error) {
        adskipUtils.logDebug('检查和跳过过程出错: ' + error.message);
    }
}
```

### 5.3 与ui.js的交互

ui.js使用utils.js提供的DOM操作和事件处理功能：

```javascript
// ui.js示例
function createWhitelistToggle() {
    // 使用utils的DOM创建功能
    const toggleElement = adskipUtils.createElementWithClasses('div', ['whitelist-toggle']);

    // 使用utils的事件绑定功能
    adskipUtils.addClickEvent(toggleElement, async function() {
        // 使用utils获取UP主信息
        const { uploader } = await adskipUtils.getVideoUploader();

        // 后续处理...
    });

    return toggleElement;
}
```

## 6. 建议优化方案

### 6.1 实现高效的缓存系统

```javascript
// 缓存系统设计
const CacheSystem = {
    // 缓存存储
    storage: new Map(),

    // 配置
    config: {
        defaultTTL: 10000,  // 默认过期时间10秒
        maxSize: 100        // 最大缓存项数量
    },

    // 获取缓存项
    get(key, defaultValue = null) {
        if (!this.storage.has(key)) {
            return defaultValue;
        }

        const item = this.storage.get(key);

        // 检查是否过期
        if (item.expires && Date.now() > item.expires) {
            this.storage.delete(key);
            return defaultValue;
        }

        // 更新最后访问时间
        item.lastAccessed = Date.now();
        return item.value;
    },

    // 设置缓存项
    set(key, value, ttl = this.config.defaultTTL) {
        // 检查缓存大小限制
        if (this.storage.size >= this.config.maxSize) {
            this.evictOldest();
        }

        this.storage.set(key, {
            value,
            created: Date.now(),
            lastAccessed: Date.now(),
            expires: ttl > 0 ? Date.now() + ttl : null
        });

        return value;
    },

    // 驱逐最旧的缓存项
    evictOldest() {
        let oldest = null;
        let oldestKey = null;

        for (const [key, item] of this.storage.entries()) {
            if (!oldest || item.lastAccessed < oldest.lastAccessed) {
                oldest = item;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.storage.delete(oldestKey);
        }
    },

    // 清除过期项
    clearExpired() {
        const now = Date.now();
        for (const [key, item] of this.storage.entries()) {
            if (item.expires && now > item.expires) {
                this.storage.delete(key);
            }
        }
    }
};
```

### 6.2 DOM操作优化

```javascript
// DOM操作优化示例
const DOMUtils = {
    // 元素查询缓存
    queryCache: new Map(),

    // 查询元素并缓存
    querySelector(selector, context = document, ttl = 5000) {
        const cacheKey = `${selector}|${context === document ? 'document' : 'custom'}`;

        // 检查缓存
        const cachedResult = CacheSystem.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // 执行查询
        const element = context.querySelector(selector);

        // 缓存结果
        return CacheSystem.set(cacheKey, element, ttl);
    },

    // 智能查询元素
    smartQuery(options) {
        const {
            selectors,          // 选择器数组
            validation,         // 验证函数
            context = document, // 上下文
            ttl = 5000,         // 缓存时间
            transformResult     // 结果转换函数
        } = options;

        const cacheKey = `smart|${selectors.join('+')}|${context === document ? 'document' : 'custom'}`;

        // 检查缓存
        const cachedResult = CacheSystem.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // 尝试所有选择器
        let element = null;
        for (const selector of selectors) {
            element = context.querySelector(selector);
            if (element && (!validation || validation(element))) {
                break;
            }
        }

        // 转换结果
        const result = element && transformResult ? transformResult(element) : element;

        // 缓存结果
        return CacheSystem.set(cacheKey, result, ttl);
    }
};
```

### 6.3 模块化和可测试性改进

```javascript
// 模块化重构示例
const adskipUtils = (function() {
    // 私有变量和函数
    let isDebugMode = false;

    // 调试日志
    function logDebug(message) {
        if (isDebugMode) {
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            console.log(`[${timestamp}] ${message}`);
        }
    }

    // DOM工具
    const domUtils = {
        // DOM操作方法
    };

    // 时间工具
    const timeUtils = {
        // 时间处理方法
    };

    // 视频信息工具
    const videoUtils = {
        // 视频信息方法
    };

    // 缓存系统
    const cacheSystem = {
        // 缓存方法
    };

    // 公共API
    return {
        // 初始化
        init: function(options = {}) {
            isDebugMode = options.debug || false;
            // 其他初始化
            return this;
        },

        // 暴露的方法
        logDebug,

        // 暴露的子模块
        dom: domUtils,
        time: timeUtils,
        video: videoUtils,
        cache: cacheSystem
    };
})();
```

## 7. 结论

utils.js作为B站广告跳过插件的工具函数模块，提供了多种实用功能，是其他模块的重要基础。虽然该模块不直接实现白名单逻辑，但其提供的视频信息提取、DOM操作和日志记录功能对白名单功能的实现起到了关键支持作用。

主要存在的问题包括DOM查询依赖性高、缺少性能优化机制和错误处理不够完善，这些问题可能会影响白名单功能的性能和稳定性。通过实现高效的缓存系统、优化DOM操作、完善错误处理和改进模块结构，可以显著提高工具函数的效率和可靠性，从而间接提升白名单功能的用户体验。

建议重点优化的方向包括：
1. 实现智能DOM元素查找策略，减少对特定选择器的依赖
2. 设计高效的缓存系统，避免重复操作
3. 增强错误处理机制，提高功能稳定性
4. 改进模块结构，提高代码可维护性和可测试性

这些优化将使utils.js更好地支持白名单等核心功能，提高整个插件的性能和用户体验。