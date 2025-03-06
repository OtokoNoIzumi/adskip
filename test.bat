@echo off
chcp 65001
CALL %USERPROFILE%\anaconda3\Scripts\activate.bat solara-develop
solara run app_temp.py  --host=0.0.0.0 --port=55555  --log-level=debug
pause