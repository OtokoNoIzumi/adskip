#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海报SVG构建脚本
自动将公共元素（base64图片和二维码）合并到所有post*.svg文件中
并输出PNG文件
"""

import os
import re
import glob
from pathlib import Path

# 尝试导入cairosvg，如果没有安装则提供安装提示
try:
    import cairosvg
    CAIROSVG_AVAILABLE = True
except ImportError:
    CAIROSVG_AVAILABLE = False

def read_file(filepath):
    """读取文件内容"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    """写入文件内容"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def get_common_elements():
    """获取公共元素内容"""
    try:
        common_content = read_file('common_elements.svg')
        # 提取 g 标签内的内容
        match = re.search(r'<g id="common-elements">(.*?)</g>', common_content, re.DOTALL)
        if match:
            return match.group(1).strip()
        else:
            print("警告：未找到公共元素内容")
            return ""
    except FileNotFoundError:
        print("警告：common_elements.svg 文件不存在")
        return ""

def inject_common_elements(svg_content, common_elements):
    """将公共元素注入到SVG中"""
    if not common_elements:
        return svg_content

    # 在 </svg> 前插入公共元素
    injection_point = svg_content.rfind('</svg>')
    if injection_point != -1:
        # 添加公共元素
        new_content = (
            svg_content[:injection_point] +
            f"\n  <!-- 公共元素：自动注入 -->\n" +
            f"  <g id=\"common-elements\">\n" +
            f"    {common_elements}\n" +
            f"  </g>\n" +
            svg_content[injection_point:]
        )
        return new_content
    else:
        print("警告：未找到 </svg> 标签")
        return svg_content

def remove_existing_common_elements(svg_content):
    """移除已存在的公共元素"""
    # 移除已存在的公共元素注释和内容
    pattern = r'\s*<!-- 公共元素：自动注入 -->\s*<g id="common-elements">.*?</g>\s*'
    return re.sub(pattern, '', svg_content, flags=re.DOTALL)

def svg_to_png(svg_filepath, png_filepath, width=800, height=1200):
    """将SVG文件转换为PNG文件"""
    if not CAIROSVG_AVAILABLE:
        print("⚠️  警告：cairosvg未安装，跳过PNG转换")
        print("    可运行：pip install cairosvg")
        return False

    try:
        cairosvg.svg2png(
            url=svg_filepath,
            write_to=png_filepath,
            output_width=width,
            output_height=height
        )
        return True
    except Exception as e:
        print(f"✗ PNG转换失败 {svg_filepath}: {e}")
        return False

def process_poster_files():
    """处理所有post*.svg文件"""
    common_elements = get_common_elements()

    # 查找所有post*.svg文件
    poster_files = glob.glob('post*.svg')

    if not poster_files:
        print("未找到任何post*.svg文件")
        return

    print(f"找到 {len(poster_files)} 个海报文件")

    # 创建输出目录
    output_dir = "output_png"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"创建输出目录: {output_dir}")

    for filepath in poster_files:
        print(f"处理文件: {filepath}")

        try:
            # 读取原始内容
            original_content = read_file(filepath)

            # 移除已存在的公共元素
            clean_content = remove_existing_common_elements(original_content)

            # 注入新的公共元素
            new_content = inject_common_elements(clean_content, common_elements)

            # 写入文件
            write_file(filepath, new_content)
            print(f"✓ 已更新: {filepath}")

            # 转换为PNG
            if CAIROSVG_AVAILABLE:
                png_filename = os.path.splitext(filepath)[0] + ".png"
                png_filepath = os.path.join(output_dir, png_filename)
                if svg_to_png(filepath, png_filepath):
                    print(f"✓ 已生成PNG: {png_filepath}")
                else:
                    print(f"✗ PNG生成失败: {png_filename}")

        except Exception as e:
            print(f"✗ 处理 {filepath} 时出错: {e}")

def create_build_batch():
    """创建Windows批处理文件"""
    batch_content = '''@echo off
echo 构建海报SVG文件并生成PNG...
echo.
echo 检查依赖...
python -c "import cairosvg" 2>nul
if %errorlevel% neq 0 (
    echo 需要安装cairosvg依赖，正在自动安装...
    pip install cairosvg
    echo.
)
echo 开始构建...
python build_posters.py
echo 完成！
pause
'''
    write_file('build_posters.bat', batch_content)
    print("已创建 build_posters.bat 批处理文件")

if __name__ == "__main__":
    print("=== 海报SVG构建工具 ===")

    # 检查是否存在公共元素文件
    if not os.path.exists('common_elements.svg'):
        print("错误：请先创建 common_elements.svg 文件")
        exit(1)

    # 处理文件
    process_poster_files()

    # 创建批处理文件
    create_build_batch()

    print("\n=== 构建完成 ===")
    print("下次需要更新时，可以直接运行 build_posters.bat")