@echo off
rem Starts the Happy Bakers demo on http://localhost:8347 without a sign-in, for use on this computer.
rem Keep this window open while you use the demo; close it (or press Ctrl+C) to stop the demo.

cd /d "%~dp0"
title Happy Bakers - Neo ERP demo (port 8347)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this computer.
  echo Install it from https://nodejs.org (version 20 or later^) and run start.bat again.
  pause
  exit /b 1
)

rem Already running? Then just open it.
netstat -ano | findstr /r /c:":8347 .*LISTENING" >nul
if not errorlevel 1 (
  echo The demo is already running. Opening http://localhost:8347/
  start "" "http://localhost:8347/"
  exit /b 0
)

set LOGIN=off
echo Starting the Happy Bakers demo on http://localhost:8347/
echo The browser opens in a moment. Close this window to stop the demo.
echo.

rem Open the browser about two seconds after the server starts (ping is the delay; timeout needs a free console).
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:8347/"
node tools\serve.js 8347

echo.
echo The demo has stopped.
pause
