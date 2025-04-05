@echo off
chcp 65001
cd /d %~dp0
call %USERPROFILE%\anaconda3\Scripts\activate.bat solara-develop
echo 正在启动广告检测API服务，请保持此窗口打开...
python api_server.py
pause