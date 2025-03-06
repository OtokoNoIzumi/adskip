@echo off
CALL %USERPROFILE%\anaconda3\Scripts\activate.bat solara-develop
solara run app.py  --host=0.0.0.0 --port=7354
pause