# Bilibili广告跳过工具 - 项目架构与优化路线图

## 1. 项目概述

Bilibili广告跳过工具是一个Chrome扩展，用于自动跳过B站视频中的广告内容。核心功能包括自动检测广告时间段、标记广告区域、自动跳过广告、UP主白名单管理等。该项目采用模块化设计，已完成从单文件结构向多模块架构的重构，提高了代码可维护性。

## 2. 当前架构分析

### 2.1 模块划分

项目目前分为以下核心模块：

1. **核心模块 (core.js)** ⏳
   - 扩展入口点
   - 全局变量和状态管理
   - 初始化逻辑和主流程控制
   - **【部分优化】** 已移除extensionAvailable相关检查，但仍需整合通信模块

2. **工具模块 (utils.js)** ⏳
   - 通用工具函数
   - 日志系统（带节流控制）
   - DOM元素查找与缓存
   - 时间戳格式化
   - **【部分优化】** 已移除extensionAvailable相关检查，但需进一步精简逻辑

3. **存储模块 (storage.js)** ⏳
   - 广告时间戳保存/加载
   - UP主白名单管理
   - 配置项持久化
   - 管理员身份验证
   - **【部分优化】** 已移除extensionAvailable相关检查，但需进一步优化存储操作

4. **视频监控模块 (videoMonitor.js)** ⏳
   - 广告跳过核心逻辑
   - 进度条广告标记
   - 视频ID变化监听
   - 播放时间检查
   - **【部分优化】** 已移除extensionAvailable相关检查，但需整合网络通信模块

5. **用户界面模块 (ui.js)**
   - 控制面板创建和管理
   - 用户交互处理
   - 状态可视化展示

6. **服务模块 (services/serviceIndex.js)** ✅
   - B站API服务
   - 用户认证服务
   - 字幕服务
   - 用户数据服务
   - **【已优化】** 通过日志跟踪清理了冗余代码和未经验证的分支逻辑
   - **【已优化】** 重构网络请求逻辑，使用后台服务工作者通信

7. **管理面板模块 (adminPanel.js)** ✅
   - 管理员特权功能
   - 数据管理和清理
   - 调试设置
   - **【已优化】** 精简了信息展示和功能布局

8. **选项页面 (options.js)**
   - 全局设置
   - 白名单批量管理
   - 数据导入/导出

9. **弹出页面 (popup.js)**
   - 快速信息展示
   - 设置页面入口

10. **后台服务模块 (background.js)** ✅
    - 处理插件后台任务
    - 管理跨页面消息通信
    - 执行网络请求
    - **【已优化】** 完全遵循Manifest V3标准实现

11. **通信模块 (communication.js)** ✅
    - 内容脚本与后台服务工作者通信
    - 消息传递与响应处理
    - 插件状态管理
    - **【已优化】** 符合Manifest V3标准的通信机制

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

## 3. 已完成的优化工作

### 3.1 Manifest V3 迁移 - 核心通信架构 ✅

**已解决问题**:
- 移除了传统的背景页 (background page)，改为使用服务工作者 (Service Worker)
- 创建了内容脚本与后台服务工作者之间的标准化通信模块
- 遵循"单一路径原则"，移除所有兼容性和妥协代码

**主要优化内容**:
1. **后台服务工作者 (background.js)**
   - 符合Manifest V3标准
   - 实现全局状态管理
   - 处理网络请求
   - 响应来自内容脚本的消息

2. **通信接口 (communication.js)**
   - 提供标准化的通信API
   - 封装消息发送与响应处理
   - 错误处理机制
   - 支持异步通信

3. **清理兼容性代码**
   - 移除所有extensionAvailable检查
   - 删除冗余错误处理
   - 简化消息通信流程
   - 确保每个功能只有一条执行路径

### 3.2 网络请求模块改造 ✅

**已解决问题**:
- 将内容脚本中的直接网络请求迁移到后台服务工作者
- 重构serviceIndex.js中的API请求逻辑
- 添加标准化的请求-响应流程

**主要优化内容**:
1. **API服务模块改造**
   - 使用communication.js与后台服务工作者通信
   - 将网络请求委托给后台服务
   - 标准化错误处理

2. **请求处理函数**
   - 实现fetchViaBackground方法
   - 统一处理请求配置和参数
   - 处理响应和错误

### 3.3 服务模块优化 ✅

**已解决问题**:
- 服务模块中的冗余方法和重复逻辑已被识别和清理
- 移除了"尝试多种方法实现同一目标"的模式，采用最可靠的单一实现路径
- 添加了详细的日志记录以便追踪和验证各种实现路径的有效性

**主要优化内容**:
1. **凭证服务优化**
   - 移除了重复的API调用
   - 简化了登录状态检查逻辑
   - 统一使用`adskipCommunication`进行API请求

2. **视频数据服务优化**
   - 重构了复杂的`getVideoData`函数
   - 添加了详细日志用于追踪执行路径
   - 明确区分了番剧页面和普通视频页面的处理逻辑

3. **字幕服务优化**
   - 简化了字幕预览和下载功能
   - 增强了字幕格式处理的稳定性
   - 添加日志以跟踪字幕格式和处理流程

4. **用户数据服务优化**
   - 重构了`getVideoUploader`函数
   - 清晰分离了DOM查询和API请求路径
   - 添加日志以确认数据获取成功率

### 3.4 管理面板优化 ✅

**已解决问题**:
- 简化了用户信息和视频字幕信息的展示
- 移除了不必要的详细信息展示
- 提高了界面友好性和清晰度

**主要优化内容**:
1. **凭证信息展示**
   - 简化了登录用户信息展示
   - 调整了VIP状态展示方式

2. **视频信息展示**
   - 将"当前视频字幕信息"更改为"当前视频信息"
   - 优化了字幕预览和可用语言展示
   - 增强了错误处理和用户提示

## 4. 待完成的Manifest V3迁移工作

### 4.1 存储机制优化

**问题描述**:
- 部分存储操作仍使用直接访问方式，未考虑后台服务工作者的生命周期特性
- 异步存储API的错误处理不够统一
- 模块间数据同步机制存在问题，特别是白名单状态的同步

**当前状态**:
- ✅ 广告跳过范围同步问题已解决：UI.js和options.js可以正确同步百分比设置
- ⏳ 白名单状态同步仍然存在间歇性问题：UI.js中修改白名单时，options.html的白名单列表不总是实时更新

**优化计划**:
1. **统一存储访问模式**
   - 将关键存储操作通过后台服务工作者集中处理
   - 实现本地缓存机制，减少存储API调用频率
   - 添加数据验证和完整性检查

2. **改进错误处理**
   - 统一存储操作的错误处理
   - 添加数据恢复机制
   - 实现本地缓存与远程存储的同步策略

3. **重构数据同步机制**
   - 实现统一的数据变更通知系统
   - 重新设计白名单数据结构，优化查询效率
   - 遵循单一路径原则，确保数据状态一致性

### 4.2 内容脚本优化

**问题描述**:
- 部分内容脚本仍直接操作存储和网络请求
- 初始化逻辑需要考虑服务工作者的间歇性运行特性

**优化计划**:
1. **重构初始化流程**
   - 优化启动序列，确保通信模块最先初始化
   - 实现内容脚本与服务工作者的生命周期同步
   - 添加连接状态检测与恢复机制

2. **隔离核心功能**
   - 将关键业务逻辑与UI分离
   - 使用委托模式处理事件，减少DOM操作
   - 实现功能的按需加载和初始化

### 4.3 权限模型调整

**问题描述**:
- 当前权限声明未完全遵循最小权限原则
- 需要根据实际API调用优化host_permissions

**优化计划**:
1. **权限审计**
   - 检查实际使用的API和网络请求
   - 移除未使用的权限声明
   - 精确定义host_permissions范围

2. **选项页权限管理**
   - 添加权限使用说明
   - 实现可选权限的动态请求
   - 提供权限降级选项

## 5. 待优化方向

### 5.1 状态管理改进

**当前问题**:
- 状态分散在多个模块和变量中，缺乏统一管理
- 状态变更处理逻辑重复
- 跨页面状态同步机制不够高效，导致UI.js和options.js的白名单状态不同步

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

### 5.2 UI组件化重构

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

### 5.3 事件系统优化

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

### 5.4 白名单管理优化

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

### 5.5 懒加载与按需初始化

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

## 6. 性能优化方向

### 6.1. DOM操作优化

1. **元素缓存扩展**
   - 扩展缓存机制到所有频繁访问的元素
   - 实现通用的DOM元素缓存系统

2. **DOM更新策略**
   - 使用属性更新替代整体重建
   - 实现虚拟DOM比较或标记系统，只更新变化部分
   - 批量DOM操作，减少重排和重绘

### 6.2. 存储策略优化

1. **批量存储操作**
   - 合并多次存储写入操作
   - 实现写入队列和防抖动机制

2. **分片存储**
   - 大数据集合分片存储
   - 实现数据懒加载和分页加载

### 6.3. 计算优化

1. **函数记忆化**
   - 缓存频繁计算结果
   - 实现LRU缓存淘汰策略

2. **时间敏感操作优化**
   - 使用requestAnimationFrame优化视觉更新
   - 长任务分割，避免阻塞主线程

## 7. 项目路线图

### 第一阶段: 基础架构优化 (短期)

1. **状态管理实现**
   - 实现集中式状态管理
   - 重构现有状态逻辑
   - 解决白名单同步问题

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

## 8. 风险与挑战

1. **兼容性维护**
   - 架构改变不应破坏现有功能
   - 需保持向后兼容，平滑过渡

2. **性能平衡**
   - 架构优化不应导致性能下降
   - 需在可维护性和性能间取得平衡

3. **资源限制**
   - 浏览器扩展环境受限
   - 需管理好内存和CPU使用

## 9. 新增：API服务设计与实现计划

### 9.1 安全数据传输

**计划内容**:
- 使用更强的加密方式替代简单的Base64编码
- 实现请求签名验证机制
- 添加时间戳和随机数防止重放攻击

### 9.2 服务器资源管理

**计划内容**:
- 设计请求频率限制策略
- 实现用户配额系统
- 监控异常请求行为

### 9.3 数据库设计

**计划内容**:
- 设计视频元数据表结构
- 设计广告时间点表结构
- 优化查询性能和数据存储

### 9.4 用户验证与权限

**计划内容**:
- 实现多级用户权限系统
- 提供API密钥或令牌管理
- 建立用户贡献积分机制
