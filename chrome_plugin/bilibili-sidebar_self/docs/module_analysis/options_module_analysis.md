# options.js模块分析报告

## 1. 模块概述

options.js是B站广告跳过插件的选项页面模块，负责创建和管理插件的设置页面。文件大小约为8KB，共约180行代码，相对较小但功能完整。该模块处理用户偏好设置，包括功能开关、广告跳过百分比、调试模式和白名单管理的用户界面，在Chrome插件的选项页面中展示。

## 2. 模块结构分析

options.js模块结构相对简单，主要由几个核心函数组成：

### 2.1 主要功能组

1. **页面初始化** (10-40行)
   - `document.addEventListener('DOMContentLoaded', init)`: 页面加载完成后初始化
   - `init()`: 初始化选项页面

2. **基本设置管理** (45-100行)
   - `initGeneralSettings()`: 初始化一般设置
   - `loadSettings()`: 加载保存的设置
   - `saveSettings()`: 保存设置更改

3. **白名单管理** (105-150行)
   - `initWhitelistManager()`: 初始化白名单管理界面
   - `loadWhitelist()`: 加载白名单数据
   - `handleWhitelistOperations()`: 处理白名单操作

4. **辅助功能** (155-180行)
   - `showMessage()`: 显示操作反馈消息
   - `formatTimestamp()`: 格式化时间戳

## 3. 白名单管理功能分析

options.js模块中关于白名单管理的部分是本次分析的重点：

### 3.1 白名单管理界面初始化

```javascript
/**
 * 初始化白名单管理界面
 */
function initWhitelistManager() {
    const whitelistContainer = document.getElementById('whitelist-container');
    if (!whitelistContainer) return;

    // 创建白名单管理界面
    whitelistContainer.innerHTML = `
        <div class="whitelist-header">
            <h3>UP主白名单管理</h3>
            <p class="description">在白名单中的UP主视频不会自动跳过广告</p>
        </div>
        <div class="whitelist-controls">
            <input type="text" id="new-uploader" placeholder="输入UP主名称">
            <button id="add-uploader">添加</button>
            <button id="refresh-whitelist">刷新</button>
        </div>
        <div class="whitelist-status">
            <span id="whitelist-count">0</span> 个UP主在白名单中
        </div>
        <div class="whitelist-list">
            <ul id="whitelist-items"></ul>
        </div>
    `;

    // 获取元素引用
    const addButton = document.getElementById('add-uploader');
    const refreshButton = document.getElementById('refresh-whitelist');
    const uploaderInput = document.getElementById('new-uploader');

    // 设置事件处理
    addButton.addEventListener('click', () => {
        const uploaderName = uploaderInput.value.trim();
        if (uploaderName) {
            addUploaderToWhitelist(uploaderName);
            uploaderInput.value = '';
        } else {
            showMessage('请输入UP主名称', 'error');
        }
    });

    refreshButton.addEventListener('click', () => {
        loadWhitelist();
    });

    // 初始加载白名单
    loadWhitelist();
}
```

**分析**：

1. **界面结构**：函数创建了白名单管理的基本界面，包括标题、描述、添加控件和列表区域。界面简洁但功能完整。

2. **事件处理**：设置了两个主要事件 - 添加UP主和刷新白名单，分别调用对应的处理函数。

3. **初始化加载**：在初始化完成后立即加载白名单数据，确保页面打开时显示最新数据。

4. **用户反馈**：在添加UP主时进行基本的输入验证，提供错误提示。

### 3.2 白名单数据加载

```javascript
/**
 * 加载白名单数据
 */
async function loadWhitelist() {
    const whitelistItems = document.getElementById('whitelist-items');
    const whitelistCount = document.getElementById('whitelist-count');

    try {
        // 显示加载状态
        whitelistItems.innerHTML = '<li class="loading">加载中...</li>';

        // 从存储中加载白名单
        const whitelist = await chrome.storage.local.get('uploaderWhitelist');
        let uploaderList = whitelist.uploaderWhitelist || [];

        // 更新计数
        whitelistCount.textContent = uploaderList.length;

        // 如果白名单为空
        if (uploaderList.length === 0) {
            whitelistItems.innerHTML = '<li class="empty-list">白名单为空</li>';
            return;
        }

        // 清空列表
        whitelistItems.innerHTML = '';

        // 添加白名单项
        uploaderList.forEach(uploader => {
            const item = document.createElement('li');

            // 处理不同的数据格式
            if (typeof uploader === 'string') {
                item.innerHTML = `
                    <span class="uploader-name">${uploader}</span>
                    <div class="item-actions">
                        <button class="remove-btn" data-name="${uploader}">删除</button>
                    </div>
                `;
            } else {
                item.innerHTML = `
                    <span class="uploader-name ${uploader.enabled === false ? 'disabled' : ''}">${uploader.name}</span>
                    <div class="item-actions">
                        <button class="toggle-btn" data-name="${uploader.name}" data-enabled="${uploader.enabled !== false}">
                            ${uploader.enabled !== false ? '禁用' : '启用'}
                        </button>
                        <button class="remove-btn" data-name="${uploader.name}">删除</button>
                    </div>
                `;
            }

            whitelistItems.appendChild(item);
        });

        // 设置删除和切换按钮的事件处理
        setupWhitelistItemEvents();

    } catch (error) {
        console.error('加载白名单失败:', error);
        whitelistItems.innerHTML = '<li class="error">加载白名单失败</li>';
    }
}
```

**分析**：

1. **加载状态**：提供加载中的提示，增强用户体验。

2. **数据格式处理**：处理两种不同的白名单数据格式 - 字符串数组和对象数组，这显示了数据格式的不一致问题。

3. **空数据处理**：当白名单为空时，显示明确的提示信息而不是空白界面。

4. **界面更新**：根据加载的数据更新白名单计数和列表内容。

5. **错误处理**：使用try-catch捕获可能的错误，并在界面上显示错误消息。

### 3.3 白名单操作处理

```javascript
/**
 * 设置白名单项的事件处理
 */
function setupWhitelistItemEvents() {
    // 获取所有删除按钮
    const removeButtons = document.querySelectorAll('.remove-btn');

    // 设置删除事件
    removeButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const uploaderName = button.dataset.name;

            // 确认删除
            if (confirm(`确定要从白名单中删除"${uploaderName}"吗？`)) {
                await removeUploaderFromWhitelist(uploaderName);
            }
        });
    });

    // 获取所有切换按钮
    const toggleButtons = document.querySelectorAll('.toggle-btn');

    // 设置切换事件
    toggleButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const uploaderName = button.dataset.name;
            const isEnabled = button.dataset.enabled === 'true';

            if (isEnabled) {
                // 当前启用，切换为禁用
                await disableUploaderInWhitelist(uploaderName);
            } else {
                // 当前禁用，切换为启用
                await enableUploaderInWhitelist(uploaderName);
            }
        });
    });
}

/**
 * 添加UP主到白名单
 * @param {string} uploaderName UP主名称
 */
async function addUploaderToWhitelist(uploaderName) {
    try {
        // 获取当前白名单
        const data = await chrome.storage.local.get('uploaderWhitelist');
        let whitelist = data.uploaderWhitelist || [];

        // 检查是否已存在
        const existingIndex = whitelist.findIndex(item =>
            (typeof item === 'string' && item === uploaderName) ||
            (item.name === uploaderName)
        );

        if (existingIndex !== -1) {
            // 已存在，检查是否需要启用
            if (typeof whitelist[existingIndex] !== 'string' && whitelist[existingIndex].enabled === false) {
                whitelist[existingIndex].enabled = true;
                showMessage(`已启用白名单中的UP主: ${uploaderName}`, 'success');
            } else {
                showMessage(`UP主 ${uploaderName} 已在白名单中`, 'info');
                return;
            }
        } else {
            // 不存在，添加新项
            // 使用对象格式添加
            whitelist.push({
                name: uploaderName,
                enabled: true,
                addedAt: new Date().toISOString()
            });
            showMessage(`已添加UP主到白名单: ${uploaderName}`, 'success');
        }

        // 保存更新后的白名单
        await chrome.storage.local.set({ 'uploaderWhitelist': whitelist });

        // 重新加载白名单
        loadWhitelist();
    } catch (error) {
        console.error('添加UP主到白名单失败:', error);
        showMessage('添加UP主失败，请重试', 'error');
    }
}

/**
 * 从白名单中删除UP主
 * @param {string} uploaderName UP主名称
 */
async function removeUploaderFromWhitelist(uploaderName) {
    try {
        // 获取当前白名单
        const data = await chrome.storage.local.get('uploaderWhitelist');
        let whitelist = data.uploaderWhitelist || [];

        // 过滤掉要删除的UP主
        whitelist = whitelist.filter(item =>
            (typeof item === 'string' && item !== uploaderName) &&
            (typeof item !== 'string' && item.name !== uploaderName)
        );

        // 保存更新后的白名单
        await chrome.storage.local.set({ 'uploaderWhitelist': whitelist });

        showMessage(`已从白名单中删除UP主: ${uploaderName}`, 'success');

        // 重新加载白名单
        loadWhitelist();
    } catch (error) {
        console.error('从白名单删除UP主失败:', error);
        showMessage('删除UP主失败，请重试', 'error');
    }
}

/**
 * 禁用白名单中的UP主
 * @param {string} uploaderName UP主名称
 */
async function disableUploaderInWhitelist(uploaderName) {
    try {
        // 获取当前白名单
        const data = await chrome.storage.local.get('uploaderWhitelist');
        let whitelist = data.uploaderWhitelist || [];

        // 查找UP主
        const existingIndex = whitelist.findIndex(item =>
            (typeof item === 'string' && item === uploaderName) ||
            (item.name === uploaderName)
        );

        if (existingIndex !== -1) {
            // 将字符串格式转换为对象格式
            if (typeof whitelist[existingIndex] === 'string') {
                whitelist[existingIndex] = {
                    name: whitelist[existingIndex],
                    enabled: false,
                    addedAt: new Date().toISOString()
                };
            } else {
                whitelist[existingIndex].enabled = false;
            }

            // 保存更新后的白名单
            await chrome.storage.local.set({ 'uploaderWhitelist': whitelist });

            showMessage(`已禁用白名单中的UP主: ${uploaderName}`, 'success');

            // 重新加载白名单
            loadWhitelist();
        }
    } catch (error) {
        console.error('禁用白名单UP主失败:', error);
        showMessage('禁用UP主失败，请重试', 'error');
    }
}
```

**分析**：

1. **事件委托不足**：为每个按钮单独添加事件监听器，而不是使用事件委托，可能导致大量白名单项时的性能问题。

2. **数据格式转换**：代码需要处理字符串和对象两种格式，在禁用操作时将字符串格式转换为对象格式，增加了复杂性。

3. **直接操作存储**：直接使用`chrome.storage.local`操作存储，而不是通过统一的存储接口，可能导致代码重复和一致性问题。

4. **用户反馈**：提供了操作结果的反馈消息，增强了用户体验。

5. **刷新机制**：每次操作后重新加载整个白名单，简单但在大量数据时可能效率较低。

## 4. 与其他模块的交互关系

options.js模块与其他模块的交互相对较少，主要体现在：

### 4.1 与storage API的交互

不同于其他模块使用封装的storage.js，options.js直接使用Chrome的storage API：

```javascript
// 直接使用Chrome存储API的示例
async function loadSettings() {
    const data = await chrome.storage.local.get([
        'adskipEnabled',
        'adSkipPercentage',
        'debugMode'
    ]);

    // 设置控件值
    enableToggle.checked = data.adskipEnabled !== false;
    percentageSlider.value = data.adSkipPercentage || 5;
    percentageValue.textContent = percentageSlider.value + '%';
    debugModeToggle.checked = data.debugMode === true;
}
```

这种直接使用存储API的方式与其他模块使用统一的storage.js接口不同，可能导致存储键名和数据格式的不一致问题。

### 4.2 缺少模块化设计

options.js没有显式地与其他模块（如storage.js、utils.js）交互，这使得代码出现了重复实现：

1. **白名单操作重复**：重新实现了白名单的加载、添加、删除和禁用功能，而不是复用storage.js中的实现。
2. **工具函数重复**：实现了自己的消息显示和格式化函数，而不是使用utils.js中的功能。

## 5. 关键问题与优化机会

### 5.1 白名单数据格式不一致

**问题**：代码需要处理两种不同的白名单数据格式，增加了复杂性和出错可能。

**优化建议**：
- 统一白名单数据格式，全部使用对象数组格式。
- 实现数据迁移功能，将旧格式转换为新格式。
- 使用统一的存储接口，确保数据格式一致。

```javascript
// 优化后的白名单加载函数
async function loadNormalizedWhitelist() {
    const data = await chrome.storage.local.get('uploaderWhitelist');
    let uploaderList = data.uploaderWhitelist || [];

    // 规范化数据格式
    return uploaderList.map(item => {
        if (typeof item === 'string') {
            return {
                name: item,
                enabled: true,
                addedAt: new Date().toISOString()
            };
        }
        return item;
    });
}
```

### 5.2 缺少模块化和代码复用

**问题**：options.js直接使用Chrome API并重新实现了白名单操作，而不是复用已有的storage.js模块。

**优化建议**：
- 引入并使用storage.js模块提供的API，减少代码重复。
- 实现模块化设计，将UI与数据操作分离。
- 使用统一的工具函数和常量定义。

```javascript
// 使用storage.js模块的示例
// 选项页面的HTML中引入storage.js
// <script src="../storage.js"></script>

async function loadWhitelist() {
    try {
        // 显示加载状态
        whitelistItems.innerHTML = '<li class="loading">加载中...</li>';

        // 使用storage.js提供的API
        const uploaderList = await adskipStorage.loadUploaderWhitelist();

        // 更新计数和列表
        // ...
    } catch (error) {
        console.error('加载白名单失败:', error);
        whitelistItems.innerHTML = '<li class="error">加载白名单失败</li>';
    }
}

async function addUploaderToWhitelist(uploaderName) {
    try {
        // 使用storage.js提供的API
        await adskipStorage.addUploaderToWhitelist(uploaderName);
        showMessage(`已添加UP主到白名单: ${uploaderName}`, 'success');
        loadWhitelist();
    } catch (error) {
        console.error('添加UP主到白名单失败:', error);
        showMessage('添加UP主失败，请重试', 'error');
    }
}
```

### 5.3 用户界面交互不够流畅

**问题**：当前界面缺少分页、搜索和批量操作功能，对于大量白名单项的管理效率较低。

**优化建议**：
- 添加分页功能，每页显示固定数量的项目。
- 实现搜索和筛选功能，便于快速查找特定UP主。
- 添加批量操作功能，如批量删除和批量启用/禁用。
- 优化加载和操作反馈，提供更流畅的用户体验。

```javascript
// 分页功能示例
const paginationState = {
    page: 1,
    itemsPerPage: 10,
    totalPages: 1,
    totalItems: 0
};

function renderPagination() {
    const paginationControls = document.getElementById('pagination-controls');

    // 计算总页数
    paginationState.totalPages = Math.ceil(paginationState.totalItems / paginationState.itemsPerPage);

    // 更新分页控件HTML
    paginationControls.innerHTML = `
        <button id="prev-page" ${paginationState.page <= 1 ? 'disabled' : ''}>上一页</button>
        <span>第 ${paginationState.page} 页 / 共 ${paginationState.totalPages} 页</span>
        <button id="next-page" ${paginationState.page >= paginationState.totalPages ? 'disabled' : ''}>下一页</button>
    `;

    // 设置按钮事件
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    prevButton.addEventListener('click', () => {
        if (paginationState.page > 1) {
            paginationState.page--;
            loadWhitelistPage();
        }
    });

    nextButton.addEventListener('click', () => {
        if (paginationState.page < paginationState.totalPages) {
            paginationState.page++;
            loadWhitelistPage();
        }
    });
}
```

### 5.4 错误处理和数据验证不足

**问题**：缺少对输入数据的严格验证和全面的错误处理机制。

**优化建议**：
- 添加输入验证，确保UP主名称符合要求。
- 实现更细致的错误处理，提供具体的错误信息。
- 添加恢复机制，防止数据丢失。
- 实现操作日志，记录重要操作。

```javascript
// 输入验证示例
function validateUploaderName(name) {
    if (!name) {
        throw new Error('UP主名称不能为空');
    }

    if (name.length < 2 || name.length > 40) {
        throw new Error('UP主名称长度必须在2-40个字符之间');
    }

    // 验证字符是否合法
    if (!/^[\w\u4e00-\u9fa5\s\-_.]+$/u.test(name)) {
        throw new Error('UP主名称包含无效字符');
    }

    return true;
}
```

## 6. 改进建议

### 6.1 重构白名单管理界面

```javascript
// 改进的白名单管理界面
function initWhitelistManager() {
    const whitelistContainer = document.getElementById('whitelist-container');
    if (!whitelistContainer) return;

    // 使用更现代、功能更完善的HTML结构
    whitelistContainer.innerHTML = `
        <div class="section-header">
            <h3>UP主白名单管理</h3>
            <p class="description">在白名单中的UP主视频不会自动跳过广告</p>
        </div>

        <div class="whitelist-controls">
            <div class="input-group">
                <input type="text" id="new-uploader" placeholder="输入UP主名称" maxlength="40">
                <button id="add-uploader" class="primary-btn">添加</button>
            </div>

            <div class="filter-group">
                <select id="status-filter">
                    <option value="all">所有状态</option>
                    <option value="enabled">已启用</option>
                    <option value="disabled">已禁用</option>
                </select>
                <input type="text" id="search-input" placeholder="搜索UP主...">
                <button id="clear-search" class="icon-btn">✕</button>
            </div>

            <button id="refresh-whitelist" class="secondary-btn">刷新</button>
        </div>

        <div class="whitelist-status">
            <div class="status-text">
                <span id="whitelist-count">0</span> 个UP主
                <span id="filtered-count"></span>
            </div>
            <div id="loading-indicator" class="spinner hidden"></div>
        </div>

        <div class="whitelist-list">
            <div class="batch-controls">
                <label class="checkbox-label">
                    <input type="checkbox" id="select-all">
                    <span class="checkbox-text">全选</span>
                </label>

                <div class="batch-actions">
                    <button id="batch-enable" disabled>批量启用</button>
                    <button id="batch-disable" disabled>批量禁用</button>
                    <button id="batch-delete" disabled>批量删除</button>
                </div>
            </div>

            <ul id="whitelist-items" class="item-list"></ul>

            <div id="empty-message" class="message-box hidden">
                <p>白名单为空</p>
            </div>

            <div id="error-message" class="message-box error hidden">
                <p>加载白名单失败</p>
                <button id="retry-load">重试</button>
            </div>
        </div>

        <div id="pagination-controls" class="pagination"></div>
    `;

    // 初始化控件和事件
    initWhitelistControls();

    // 加载白名单
    loadWhitelistWithFiltering();
}
```

### 6.2 使用统一的存储接口

```javascript
// 使用统一的存储接口
// 首先在options.html中引入storage.js
// <script src="../storage.js"></script>

// 然后在options.js中使用统一的API
async function loadSettings() {
    try {
        // 使用storage.js的API加载设置
        const isEnabled = await adskipStorage.getEnabled();
        const percentage = await adskipStorage.loadAdSkipPercentage();
        const debugMode = await adskipStorage.isDebugMode();

        // 更新UI控件
        enableToggle.checked = isEnabled;
        percentageSlider.value = percentage;
        percentageValue.textContent = percentage + '%';
        debugModeToggle.checked = debugMode;
    } catch (error) {
        console.error('加载设置失败:', error);
        showMessage('加载设置失败，使用默认值', 'error');

        // 使用默认值
        enableToggle.checked = true;
        percentageSlider.value = 5;
        percentageValue.textContent = '5%';
        debugModeToggle.checked = false;
    }
}

async function saveSettings() {
    try {
        // 使用storage.js的API保存设置
        await adskipStorage.setEnabled(enableToggle.checked);
        await adskipStorage.saveAdSkipPercentage(parseInt(percentageSlider.value));
        await adskipStorage.setDebugMode(debugModeToggle.checked);

        showMessage('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showMessage('保存设置失败，请重试', 'error');
    }
}
```

### 6.3 实现高级白名单管理功能

```javascript
// 白名单状态管理
const whitelistState = {
    items: [],          // 所有白名单项
    filteredItems: [],  // 筛选后的项
    selectedItems: new Set(), // 已选择的项
    filter: 'all',      // 当前筛选条件
    searchTerm: '',     // 搜索关键词
    page: 1,            // 当前页码
    itemsPerPage: 10,   // 每页显示数量
};

// 加载并筛选白名单
async function loadWhitelistWithFiltering() {
    showLoading(true);

    try {
        // 使用storage.js加载白名单
        const whitelist = await adskipStorage.loadUploaderWhitelist();

        // 更新状态
        whitelistState.items = whitelist.map(normalizeWhitelistItem);

        // 应用筛选和搜索
        applyFiltersAndSearch();

        // 更新界面
        updateWhitelistUI();
    } catch (error) {
        console.error('加载白名单失败:', error);
        showError(true, '加载白名单失败');
    } finally {
        showLoading(false);
    }
}

// 规范化白名单项格式
function normalizeWhitelistItem(item) {
    if (typeof item === 'string') {
        return {
            name: item,
            enabled: true,
            addedAt: new Date().toISOString()
        };
    }
    return item;
}

// 应用筛选和搜索
function applyFiltersAndSearch() {
    const { items, filter, searchTerm } = whitelistState;

    // 应用状态筛选
    let filtered = items;
    if (filter === 'enabled') {
        filtered = items.filter(item => item.enabled !== false);
    } else if (filter === 'disabled') {
        filtered = items.filter(item => item.enabled === false);
    }

    // 应用搜索筛选
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(term)
        );
    }

    // 更新筛选结果
    whitelistState.filteredItems = filtered;

    // 重置页码
    whitelistState.page = 1;

    // 更新状态显示
    updateFilterStatus();
}

// 渲染当前页的白名单项
function renderCurrentPage() {
    const { filteredItems, page, itemsPerPage } = whitelistState;
    const whitelistItems = document.getElementById('whitelist-items');
    const emptyMessage = document.getElementById('empty-message');

    // 清空列表
    whitelistItems.innerHTML = '';

    // 如果没有项目
    if (filteredItems.length === 0) {
        emptyMessage.classList.remove('hidden');
        return;
    }

    emptyMessage.classList.add('hidden');

    // 计算当前页的项目
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
    const pageItems = filteredItems.slice(startIndex, endIndex);

    // 渲染当前页项目
    pageItems.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'whitelist-item';

        if (item.enabled === false) {
            listItem.classList.add('disabled');
        }

        listItem.innerHTML = `
            <div class="item-select">
                <input type="checkbox" class="item-checkbox" data-name="${item.name}">
            </div>
            <div class="item-info">
                <span class="uploader-name">${item.name}</span>
                <span class="uploader-date">添加于: ${formatDate(item.addedAt)}</span>
            </div>
            <div class="item-actions">
                <button class="toggle-btn" data-name="${item.name}">
                    ${item.enabled !== false ? '禁用' : '启用'}
                </button>
                <button class="remove-btn" data-name="${item.name}">删除</button>
            </div>
        `;

        whitelistItems.appendChild(listItem);
    });

    // 更新分页控件
    updatePagination();

    // 设置事件处理
    setupItemEvents();
}
```

### 6.4 优化用户体验和性能

```javascript
// 事件委托示例
function setupItemEvents() {
    const whitelistItems = document.getElementById('whitelist-items');

    // 使用事件委托而不是为每个按钮添加事件
    whitelistItems.addEventListener('click', async (event) => {
        const target = event.target;

        // 处理复选框点击
        if (target.classList.contains('item-checkbox')) {
            handleCheckboxClick(target);
            return;
        }

        // 处理启用/禁用按钮
        if (target.classList.contains('toggle-btn')) {
            const uploaderName = target.dataset.name;
            await handleToggleStatus(uploaderName);
            return;
        }

        // 处理删除按钮
        if (target.classList.contains('remove-btn')) {
            const uploaderName = target.dataset.name;
            await handleRemoveUploader(uploaderName);
            return;
        }
    });
}

// 优化的复选框处理
function handleCheckboxClick(checkbox) {
    const uploaderName = checkbox.dataset.name;

    if (checkbox.checked) {
        whitelistState.selectedItems.add(uploaderName);
    } else {
        whitelistState.selectedItems.delete(uploaderName);
    }

    // 更新全选状态
    updateSelectAllStatus();

    // 更新批量操作按钮状态
    updateBatchButtons();
}

// 异步操作的加载状态管理
function showLoading(show) {
    const loadingIndicator = document.getElementById('loading-indicator');

    if (show) {
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

// 吐司消息系统
function showToast(message, type = 'info') {
    // 删除现有吐司
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建新吐司
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // 添加到页面
    document.body.appendChild(toast);

    // 设置动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 自动消失
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
```

## 7. 结论

options.js模块作为B站广告跳过插件的选项页面，提供了包括白名单管理在内的用户设置界面。虽然功能基本完整，但存在数据格式不一致、缺少模块化设计、用户界面交互不够流畅等问题。

主要优化方向包括：

1. **统一白名单数据格式**：使用一致的对象数组格式，避免格式转换的复杂性。
2. **使用统一的存储接口**：引入并使用storage.js模块，避免代码重复和数据不一致。
3. **改进用户界面**：添加分页、搜索、筛选和批量操作功能，提升大量白名单项的管理效率。
4. **优化性能和用户体验**：使用事件委托、异步加载状态和友好的反馈机制，提供更流畅的交互体验。
5. **增强数据验证和错误处理**：实现严格的输入验证和详细的错误信息，提高功能可靠性。

通过这些优化，options.js模块可以提供更高效、更可靠的白名单管理体验，与其他模块一起形成统一的功能体系，为用户提供更好的插件使用体验。