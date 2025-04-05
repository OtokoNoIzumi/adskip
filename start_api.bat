@echo off
chcp 65001
call %USERPROFILE%\anaconda3\Scripts\activate.bat solara-develop
echo 正在启动广告检测API服务，请保持此窗口打开...
python api_server.py --ssl-keyfile=izumihostpab.life.key --ssl-certfile=izumihostpab.life.pem
pause