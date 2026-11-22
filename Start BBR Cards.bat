@echo off
title BBR Viewer Cards
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed yet.
  echo  Opening the download page. Install the "LTS" version, then double-click this file again.
  echo.
  start https://nodejs.org/en/download
  pause
  exit /b
)
for /f "tokens=1 delims=." %%a in ('node -v') do set NODEV=%%a
set NODEV=%NODEV:v=%
if %NODEV% LSS 22 (
  echo.
  echo  Your Node.js is too old. Please install the latest "LTS" version from nodejs.org
  echo.
  start https://nodejs.org/en/download
  pause
  exit /b
)
node server.js
pause
