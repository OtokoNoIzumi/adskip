# 图标文件说明

## SVG图标文件

这个目录包含了三个SVG格式的图标文件：
- `icon16.svg` - 16x16像素图标
- `icon48.svg` - 48x48像素图标
- `icon128.svg` - 128x128像素图标

## 转换为PNG文件

Chrome扩展需要PNG格式的图标文件。在使用此扩展之前，请将SVG图标转换为PNG格式：

### 转换方法1：使用在线工具

1. 访问一个SVG到PNG转换工具，例如 [SVGPNG.com](https://svgpng.com/)
2. 上传SVG文件
3. 下载转换后的PNG文件
4. 重命名为：
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### 转换方法2：使用图像编辑软件

1. 使用Photoshop、GIMP或Inkscape等软件打开SVG文件
2. 导出为PNG格式，确保保持尺寸不变
3. 将文件保存在此目录中

## 确认清单

确保你有以下文件：
- [x] icon16.svg (已提供)
- [x] icon48.svg (已提供)
- [x] icon128.svg (已提供)
- [ ] icon16.png (需要转换)
- [ ] icon48.png (需要转换)
- [ ] icon128.png (需要转换)

只有当所有PNG文件都就绪后，扩展才能正常显示图标。