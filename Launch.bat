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
echo.

rem === Start gateway in background ===
start "UClaW Gateway" /min node "%OPENCLAW_ENTRY%" gateway --port 18789

echo  Waiting for Gateway to start...
set "RETRY=0"
:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 15 goto :open_browser
node -e "fetch('http://localhost:18789/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 goto :wait_loop

:open_browser
echo  Gateway is ready! Opening Web UI...
start "" "http://localhost:18789/"
echo.
echo  ========================================
echo   Gateway running. Web UI opened.
echo   Press any key to STOP the Gateway.
echo  ========================================
pause >nul

echo  Stopping...
taskkill /FI "WINDOWTITLE eq UClaW Gateway" /F >nul 2>&1
echo  Gateway stopped.
pause
