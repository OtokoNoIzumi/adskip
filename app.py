"""
项目初始化模板

这个文件用于设置项目的基本配置，包括:
1. 设置项目路径
2. 加载环境变量
3. 读取配置文件

注意: 此文件可以通过notebook导出到app.py，也可以直接在notebook中运行
"""
import os
import sys
import json
from dotenv import load_dotenv

# ===== 初始化项目路径 =====
# 根据运行环境(脚本或notebook)获取项目根目录
if "__file__" in globals():
    # 脚本环境: 使用文件的绝对路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.normpath(os.path.join(current_dir, ".."))
else:
    # Jupyter Notebook环境: 使用当前工作目录
    current_dir = os.getcwd()
    current_dir = os.path.join(current_dir, "..")
    root_dir = os.path.normpath(os.path.join(current_dir))

# 规范化路径并添加到系统路径
current_dir = os.path.normpath(current_dir)
sys.path.append(current_dir)

# 加载.env文件中的环境变量
load_dotenv(dotenv_path=os.path.join(current_dir, ".env"))

# 加载项目配置文件
with open(os.path.join(current_dir, "config.json"), encoding="utf-8") as file:
    config = json.load(file)
