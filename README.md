<div align="center">

# 🎯 Bilibili 广告跳过工具

*切片广告之友 - Chrome扩展*

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/dicbndgaokkkafcehlfmkllbipeekfhi?label=Chrome%20商店版本&color=blue)](https://chromewebstore.google.com/detail/dicbndgaokkkafcehlfmkllbipeekfhi?utm_source=github-adskip)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/dicbndgaokkkafcehlfmkllbipeekfhi?label=活跃用户&color=green)](https://chromewebstore.google.com/detail/dicbndgaokkkafcehlfmkllbipeekfhi?utm_source=github-adskip)
[![GitHub stars](https://img.shields.io/github/stars/OtokoNoIzumi/adskip?color=yellow&label=GitHub%20Stars)](https://github.com/OtokoNoIzumi/adskip/stargazers)
[![GitHub license](https://img.shields.io/github/license/OtokoNoIzumi/adskip?color=blue)](https://github.com/OtokoNoIzumi/adskip/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/OtokoNoIzumi/adskip)](https://github.com/OtokoNoIzumi/adskip/commits)

**一个智能的Chrome扩展，用于自动检测和跳过哔哩哔哩(Bilibili)视频中的广告内容**

[🏪 Chrome商店安装](https://chromewebstore.google.com/detail/dicbndgaokkkafcehlfmkllbipeekfhi?utm_source=github-adskip) · [📋 使用说明](#使用说明) · [🛠️ 本地安装](#本地安装) · [❓ 问题反馈](https://github.com/OtokoNoIzumi/adskip/issues)

</div>

---

## ✨ 功能特点

- 🎯 **智能检测** - AI自动识别视频中的广告片段
- 📊 **可视化标记** - 进度条上红色区域显示广告位置
- ⚙️ **个性化设置** - 支持为每个视频单独配置广告时间段
- 💾 **智能缓存** - 自动保存设置，重复观看无需重新配置
- 🔗 **便捷分享** - 通过URL参数分享广告时间段给其他用户
- 👤 **白名单功能** - 支持特定UP主视频的手动跳过模式
- 🔄 **全局控制** - 一键启用/禁用功能，灵活控制
- 📏 **精准调节** - 可调整广告跳过的触发范围（1%-100%）
- 🛠️ **管理员模式** - 高级设置和数据管理功能

## 🚀 快速开始

### Chrome商店安装（推荐）

点击下方按钮直接从Chrome商店安装：

[Chrome商店安装地址](https://chromewebstore.google.com/detail/dicbndgaokkkafcehlfmkllbipeekfhi?utm_source=github-adskip)

### 本地安装

> **⚠️ 注意：** 本地安装可能因为插件ID差异而无法访问服务端，仅可以查看客户端的业务功能。

1. **下载项目**
   ```bash
   git clone https://github.com/OtokoNoIzumi/adskip.git
   # 或下载ZIP文件并解压
   ```

2. **加载扩展**
   - 打开Chrome浏览器，访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `chrome_plugin/bilibili-sidebar_self` 目录

3. **开始使用**
   - 访问任意B站视频页面
   - 在右上角会出现扩展的悬浮按钮

## 📖 使用说明

### 基础操作

1. **🎬 观看体验**
   - 在B站视频页面，右上角会显示悬浮控制按钮
   - 对于30秒以上的视频，扩展会自动进行AI识别
   - 识别后的广告区间会以红色在进度条上标记

2. **🎛️ 手动调节**
   - 如果AI识别有误，可以拖拽进度条手动跳回
   - 在悬浮菜单中临时切换为手动跳过模式
   - 手动编辑广告区间并重新应用设置

3. **💡 智能缓存**
   - 重复观看同一视频不会消耗AI识别次数
   - 识别结果自动保存在本地浏览器中

### 高级功能

#### 📊 可视化标记系统
- **红色区域**: 完整的广告时间段
- **粉红色区域**: 实际触发跳过的区间（基于百分比设置）
- **交互操作**:
  - 鼠标悬停显示详细信息
  - 点击标记可手动跳过广告

#### 🎛️ 全局控制面板
- **功能开关**: 临时启用/禁用广告跳过
- **百分比控制**: 调整广告跳过的触发范围
  - `1%`: 仅在广告开始时触发
  - `50%`: 在广告前半段触发
  - `100%`: 整个广告区间都触发

#### 👤 UP主白名单
1. 在视频页面点击右上角按钮打开控制面板
2. 使用"白名单"开关管理当前UP主
3. 白名单中的UP主视频不会自动跳过，但可手动跳过
4. 在扩展选项页面批量管理白名单

#### 🔗 分享功能
1. 设置广告时间段后，点击"创建分享链接"
2. 复制生成的链接分享给其他用户
3. 他人点击链接后自动应用相同的跳过设置

## 🗺️ 开发计划

### 前端优化 🎨
- [ ] **代码清理**: 清理测试期遗留的废弃代码
- [ ] **白名单管理**: 设置数据量上限和自动清除机制
- [ ] **初始化优化**: 优化BV ID提取逻辑，减少重复调用
- [ ] **检测时机**: 提前视频时长检测，优化字幕检查流程
- [ ] **问题反馈**: 一键反馈功能，快速标记问题识别
- [ ] **快捷键支持**: 为手动模式增加键盘快捷键
- [ ] **合作模式**: 解决合作视频下UP主信息获取问题
- [x] **清理数据问题**: 清理数据时只清理了广告数据，没清理状态数据，导致无法更新数据——管理员模式清除所有数据是有效的
- [x] **多P问题**: 目前假设广告只在1P这没问题，但似乎多P的同时间也被设置了广告区间——虽然没有外显，但会跳过
- [ ] **BaseURL更新问题**: 解决服务器地址更换需要修改本地硬编码的网址的问题
- [ ] **更直接的社交联系**: 一定情况的自动信件，邀请反馈和分享；关注可以增加次数
- [ ] **排查为什么没日志**: 我自己的点开菜单没日志

### 后端优化 ⚙️
- [ ] **数据库重构**: 迁移到ORM方法
- [ ] **AI检测优化**: 处理检测时长比例过长的特殊情况
- [ ] **领域知识**: 为特定板块添加专业知识支持

## 🧪 核心测试用例

> 以下为插件开发和维护过程中重点关注的核心测试场景，确保主要功能的稳定性和一致性：

1. **URL参数解析**：测试通过URL参数分享广告区间的正确性与兼容性
2. **用户数据更新**：验证广告区间、白名单等本地数据的增删改查
3. **视频解析**：确保不同类型B站视频（单P/多P/合作/特殊格式）均能正确识别
4. **带参数跳转**：测试通过分享链接跳转后广告区间的自动应用
5. **白名单/手动模式跳转**：切换白名单和手动跳过模式的正确性
6. **设置清除跳过广告**：测试清除本地广告数据和状态数据的完整性
7. **百分比、开关调试模式、跳过功能设置同步**：确保UI与选项页的设置同步
8. **本地数据清除**：测试一键清除所有本地数据的效果

## 📁 项目结构

```
adskip/
├── chrome_plugin/
│   └── bilibili-sidebar_self/        # 核心扩展代码
│       ├── manifest.json             # 扩展配置文件
│       ├── *.js                      # 主要功能模块 (core.js, videoMonitor.js, adDetection.js 等)
│       ├── *.html & *.css            # 用户界面文件
│       ├── services/                 # 服务模块
│       └── icons/                    # 扩展图标
├── docs/                             # 技术文档
│   └── module_analysis/              # 模块分析文档
└── README.md                         # 项目说明
```

> **📍 重要提示：** 核心扩展代码位于 `./chrome_plugin/bilibili-sidebar_self` 目录内。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT License 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目和开发者的启发与帮助：

- [bilibili-api](https://github.com/Nemo2011/bilibili-api) - 提供了丰富的Bilibili API接口参考
- [吕立青.JimmyLv](https://blog.jimmylv.info/) - 他的 BibiGPT 项目为本项目提供了宝贵的启发和激励，感谢他在AI应用领域的无私分享和开源精神

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=OtokoNoIzumi/adskip&type=Date)](https://star-history.com/#OtokoNoIzumi/adskip&Date)