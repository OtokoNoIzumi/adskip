@echo off
chcp 65001
CALL %USERPROFILE%\anaconda3\Scripts\activate.bat workspace
python api_fastapi.py
pause