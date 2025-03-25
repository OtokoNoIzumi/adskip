# Bilibili广告跳过工具 - 项目架构与优化路线图

## 1. 项目概述

Bilibili广告跳过工具是一个Chrome扩展，用于自动跳过B站视频中的广告内容。核心功能包括自动检测广告时间段、标记广告区域、自动跳过广告、UP主白名单管理等。该项目采用模块化设计，已完成从单文件结构向多模块架构的重构，提高了代码可维护性。

## 2. 当前架构分析

### 2.1 模块划分

项目目前分为以下核心模块：

1. **核心模块 (core.js)**
   - 扩展入口点
   - 全局变量和状态管理
   - 初始化逻辑和主流程控制

2. **工具模块 (utils.js)**
   - 通用工具函数
   - 日志系统（带节流控制）
   - DOM元素查找与缓存
   - 时间戳格式化

3. **存储模块 (storage.js)**
   - 广告时间戳保存/加载
   - UP主白名单管理
   - 配置项持久化
   - 管理员身份验证

4. **视频监控模块 (videoMonitor.js)**
   - 广告跳过核心逻辑
   - 进度条广告标记
   - 视频ID变化监听
   - 播放时间检查

5. **用户界面模块 (ui.js)**
   - 控制面板创建和管理
   - 用户交互处理
   - 状态可视化展示

6. **管理面板模块 (adminPanel.js)**
   - 管理员特权功能
   - 数据管理和清理
   - 调试设置

7. **选项页面 (options.js)**
   - 全局设置
   - 白名单批量管理
   - 数据导入/导出

8. **弹出页面 (popup.js)**
   - 快速信息展示
   - 设置页面入口

### 2.2 数据流与状态管理

当前项目状态管理通过以下机制实现：

1. **存储机制**
   - 使用`chrome.storage.local`存储所有设置和数据
   - 广告时间戳、白名单、配置项等均使用本地存储

2. **状态同步**
   - 使用`chrome.storage.onChanged`监听器在不同页面间同步状态
   - 主要同步的状态包括：功能开关、调试模式、广告跳过百分比、UP主白名单

3. **事件传递**
   - 监听DOM事件和存储变化事件
   - 通过事件驱动界面更新和功能触发

## 3. 代码优化方向

通过详细分析，我们确定了以下几个主要优化方向：

### 3.1 状态管理改进

**当前问题**:
- 状态分散在多个模块和变量中，缺乏统一管理
- 状态变更处理逻辑重复
- 跨页面状态同步机制不够高效

**优化方案**:
```javascript
// 创建简化版的集中式状态管理
const StateManager = {
  _state: {},
  _listeners: {},

  // 初始化状态
  init(initialState) {
    this._state = {...initialState};
    return this;
  },

  // 获取状态
  get(key) {
    return this._state[key];
  },

  // 设置状态并触发通知
  set(key, value) {
    if (this._state[key] !== value) {
      this._state[key] = value;
      this._notify(key, value);
    }
    return this;
  },

  // 订阅状态变更
  subscribe(key, callback) {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(callback);
    return this;
  },

  // 通知订阅者
  _notify(key, value) {
    if (this._listeners[key]) {
      this._listeners[key].forEach(cb => cb(value));
    }
  }
};
```

### 3.2 UI组件化重构

**当前问题**:
- UI逻辑与业务逻辑混合
- 缺乏可复用的UI组件
- 界面更新逻辑分散

**优化方案**:
```javascript
// 创建UI组件基类
class UIComponent {
  constructor(config = {}) {
    this.template = config.template || (() => '');
    this.events = config.events || {};
    this.state = config.initialState || {};
    this.element = null;
  }

  // 渲染组件
  render(container) {
    if (!container) return null;

    // 创建元素
    this.element = document.createElement('div');
    this.element.innerHTML = this.template(this.state);

    // 绑定事件
    this._bindEvents();

    // 添加到容器
    container.appendChild(this.element);
    return this.element;
  }

  // 更新状态并重新渲染
  setState(newState) {
    this.state = {...this.state, ...newState};
    this._updateDOM();
  }

  // 更新DOM而不是完全重建
  _updateDOM() {
    if (!this.element) return;

    // 实现智能DOM更新逻辑
    // ...
  }

  // 绑定事件处理器
  _bindEvents() {
    Object.entries(this.events).forEach(([selector, handlers]) => {
      const elements = this.element.querySelectorAll(selector);
      elements.forEach(el => {
        Object.entries(handlers).forEach(([event, handler]) => {
          el.addEventListener(event, e => handler.call(this, e, el));
        });
      });
    });
  }
}
```

### 3.3 事件系统优化

**当前问题**:
- 多处使用匿名函数添加事件监听器，导致潜在内存泄漏
- 缺乏统一的事件管理机制
- 事件监听器重复添加

**优化方案**:
```javascript
// 创建统一的事件管理器
const EventManager = {
  _handlers: new Map(),

  // 添加事件监听器
  on(element, eventType, selector, handler) {
    if (!element) return;

    // 创建命名处理函数
    const delegateHandler = (e) => {
      if (selector) {
        // 事件委托逻辑
        if (e.target.matches(selector)) {
          handler(e, e.target);
        }
      } else {
        handler(e, element);
      }
    };

    // 存储处理器引用
    const key = `${eventType}|${selector||''}`;
    if (!this._handlers.has(element)) {
      this._handlers.set(element, new Map());
    }
    this._handlers.get(element).set(key, delegateHandler);

    // 添加监听器
    element.addEventListener(eventType, delegateHandler);
  },

  // 移除事件监听器
  off(element, eventType, selector) {
    if (!element || !this._handlers.has(element)) return;

    const elementHandlers = this._handlers.get(element);
    const key = `${eventType}|${selector||''}`;

    if (elementHandlers.has(key)) {
      element.removeEventListener(eventType, elementHandlers.get(key));
      elementHandlers.delete(key);
    }

    // 如果元素没有处理器了，清除映射
    if (elementHandlers.size === 0) {
      this._handlers.delete(element);
    }
  },

  // 清理所有事件监听器
  cleanup() {
    this._handlers.forEach((handlers, element) => {
      handlers.forEach((handler, key) => {
        const [eventType] = key.split('|');
        element.removeEventListener(eventType, handler);
      });
      handlers.clear();
    });
    this._handlers.clear();
  }
};
```

### 3.4 白名单管理优化

**当前问题**:
- 白名单相关逻辑分散在多个模块
- 数据处理和UI逻辑混合
- 缺乏统一接口

**优化方案**:
```javascript
// 创建专门的白名单管理器
class WhitelistManager {
  constructor() {
    this._whitelist = new Map();
    this._listeners = [];
  }

  // 加载白名单
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get('adskip_uploader_whitelist', (result) => {
        try {
          const data = result.adskip_uploader_whitelist ?
                      JSON.parse(result.adskip_uploader_whitelist) : [];

          // 使用Map提高查询效率
          this._whitelist.clear();
          data.forEach(item => {
            const uploaderName = typeof item === 'string' ? item : item.name;
            const enabled = typeof item === 'string' ? true : item.enabled !== false;
            const addedAt = typeof item === 'string' ? Date.now() : item.addedAt || Date.now();

            this._whitelist.set(uploaderName, { enabled, addedAt });
          });

          resolve(this._getAsList());
        } catch (e) {
          console.error('解析白名单失败', e);
          this._whitelist.clear();
          resolve([]);
        }
      });
    });
  }

  // 保存白名单
  async save() {
    const list = this._getAsList();
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        'adskip_uploader_whitelist': JSON.stringify(list)
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          this._notifyListeners(list);
          resolve(list);
        }
      });
    });
  }

  // 获取列表形式的白名单
  _getAsList() {
    return Array.from(this._whitelist.entries()).map(([name, data]) => ({
      name,
      addedAt: data.addedAt,
      enabled: data.enabled
    }));
  }

  // 添加UP主
  async add(uploaderName) {
    if (!uploaderName) return false;

    this._whitelist.set(uploaderName, {
      enabled: true,
      addedAt: Date.now()
    });

    await this.save();
    return true;
  }

  // 检查UP主是否在白名单且启用
  isEnabled(uploaderName) {
    return this._whitelist.has(uploaderName) &&
           this._whitelist.get(uploaderName).enabled;
  }

  // 其他白名单操作方法...

  // 添加变更监听器
  addListener(callback) {
    this._listeners.push(callback);
  }

  // 通知监听器
  _notifyListeners(data) {
    this._listeners.forEach(callback => callback(data));
  }
}
```

### 3.5 懒加载与按需初始化

**当前问题**:
- 初始化时加载所有模块和功能
- 不必要的前期资源消耗

**优化方案**:
```javascript
// 模块懒加载示例
const ModuleLoader = {
  _modules: {},
  _loading: {},

  // 按需加载模块
  async load(moduleName) {
    // 已加载模块直接返回
    if (this._modules[moduleName]) {
      return this._modules[moduleName];
    }

    // 处理正在加载的模块
    if (this._loading[moduleName]) {
      return this._loading[moduleName];
    }

    // 加载新模块
    try {
      this._loading[moduleName] = new Promise(async (resolve) => {
        // 根据模块名动态导入
        const module = await this._importModule(moduleName);
        this._modules[moduleName] = module;
        delete this._loading[moduleName];
        resolve(module);
      });

      return this._loading[moduleName];
    } catch (e) {
      console.error(`加载模块 ${moduleName} 失败:`, e);
      delete this._loading[moduleName];
      throw e;
    }
  },

  // 导入模块的实际逻辑
  async _importModule(moduleName) {
    // 实际项目中可以使用动态import
    switch(moduleName) {
      case 'admin':
        // 仅当需要时才加载管理员模块
        return { init: () => console.log('管理员模块初始化') };
      // 其他模块...
      default:
        throw new Error(`未知模块: ${moduleName}`);
    }
  }
};
```

## 4. 性能优化方向

### 4.1. DOM操作优化

1. **元素缓存扩展**
   - 扩展缓存机制到所有频繁访问的元素
   - 实现通用的DOM元素缓存系统

2. **DOM更新策略**
   - 使用属性更新替代整体重建
   - 实现虚拟DOM比较或标记系统，只更新变化部分
   - 批量DOM操作，减少重排和重绘

### 4.2. 存储策略优化

1. **批量存储操作**
   - 合并多次存储写入操作
   - 实现写入队列和防抖动机制

2. **分片存储**
   - 大数据集合分片存储
   - 实现数据懒加载和分页加载

### 4.3. 计算优化

1. **函数记忆化**
   - 缓存频繁计算结果
   - 实现LRU缓存淘汰策略

2. **时间敏感操作优化**
   - 使用requestAnimationFrame优化视觉更新
   - 长任务分割，避免阻塞主线程

## 5. 项目路线图

### 第一阶段: 基础架构优化 (短期)

1. **状态管理实现**
   - 实现集中式状态管理
   - 重构现有状态逻辑

2. **事件系统改进**
   - 统一事件注册和管理
   - 消除匿名监听器
   - 实现事件委托模式

3. **DOM缓存扩展**
   - 完善DOM元素缓存机制
   - 优化DOM查询性能

### 第二阶段: 架构升级 (中期)

1. **UI组件化**
   - 实现基础UI组件系统
   - 重构面板和控制元素
   - 支持组件状态本地化

2. **白名单管理器**
   - 实现专用白名单管理类
   - 重构白名单相关逻辑
   - 改进数据结构

3. **模块懒加载**
   - 实现基础模块加载系统
   - 重构非核心功能为按需加载

### 第三阶段: 高级特性 (长期)

1. **存储系统升级**
   - 实现数据分片存储
   - 添加数据版本控制
   - 支持数据导入/导出/同步

2. **性能监控系统**
   - 实现内部性能指标收集
   - 添加性能报告功能

3. **扩展功能**
   - 实现插件扩展系统
   - 支持自定义规则和功能

## 6. 风险与挑战

1. **兼容性维护**
   - 架构改变不应破坏现有功能
   - 需保持向后兼容，平滑过渡

2. **性能平衡**
   - 架构优化不应导致性能下降
   - 需在可维护性和性能间取得平衡

3. **资源限制**
   - 浏览器扩展环境受限
   - 需管理好内存和CPU使用
