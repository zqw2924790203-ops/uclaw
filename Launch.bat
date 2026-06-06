@echo off
chcp 65001 >nul 2>&1
title UClaW Gateway

set "UCRAW_ROOT=%~dp0"
set "UCRAW_ROOT=%UCRAW_ROOT:~0,-1%"
set "OPENCLAW_STATE_DIR=%UCRAW_ROOT%\data"
set "HOME=%UCRAW_ROOT%\data"
set "TMPDIR=%UCRAW_ROOT%\data\tmp"
set "PATH=%UCRAW_ROOT%\bin\node;%PATH%"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

echo.
echo   ================================
echo    UClaW Gateway v1.0.0
echo   ================================
echo.

node --version >nul 2>&1
if errorlevel 1 (echo  [ERROR] Node.js not found & pause & exit /b 1)

set "OPENCLAW_ENTRY=%UCRAW_ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js"
if not exist "%OPENCLAW_ENTRY%" (echo  [ERROR] OpenClaw not found & pause & exit /b 1)

echo  Starting Gateway on port 18789...
echo  URL: http://localhost:18789
echo  Press Ctrl+C to stop.
echo  ================================
echo.

node "%OPENCLAW_ENTRY%" gateway --port 18789
echo.
echo  Gateway stopped.
pause
