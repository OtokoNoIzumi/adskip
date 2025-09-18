# BiliCredential - B站认证数据获取工具

一个极简的Chrome扩展，用于获取和同步B站认证数据。

## 功能

- 自动检测B站页面访问
- 获取SESSDATA、bili_jct、ac_time_value、DedeUserID等认证数据
- 数据变化时自动缓存到本地
- 支持设置API端点，自动同步数据到服务端
- 最多3次重试机制

## 安装方法

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `bili_credential` 文件夹

## 使用方法

1. 访问任意B站页面（如 https://www.bilibili.com）
2. 插件会自动检测并获取认证数据
3. 点击扩展图标查看当前数据
4. 在弹窗中设置API端点（可选）
5. 点击"立即同步"手动同步数据

## 数据结构

```json
{
  "sessdata": "e3574325%2C1773EC",
  "bili_jct": "fcfad95a6f58cd1cf2d8",
  "ac_time_value": "9e7d8a10739d857479b91",
  "dedeuserid": "82205",
  "timestamp": 1695123456789
}
```

## 文件说明

- `manifest.json` - 扩展配置文件
- `background.js` - 后台服务，处理cookies获取和API同步
- `popup.html/js` - 弹窗界面，显示数据和设置
- `content.js` - 内容脚本，获取localStorage数据
- `icon*.png` - 扩展图标

## 注意事项

- 需要B站登录状态才能获取有效数据
- API端点需要支持POST请求接收JSON数据
- 数据会自动缓存，避免重复同步
