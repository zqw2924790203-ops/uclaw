@echo off
chcp 65001 >nul 2>&1
title UClaW - Control Panel

rem === Resolve script directory ===
set "UCRAW_ROOT=%~dp0"
set "UCRAW_ROOT=%UCRAW_ROOT:~0,-1%"
set "OPENCLAW_STATE_DIR=%UCRAW_ROOT%\data"
set "HOME=%UCRAW_ROOT%\data"
set "TMPDIR=%UCRAW_ROOT%\data\tmp"
set "OPENCLAW_GATEWAY_PORT=18789"
set "UCLAW_CONFIG_PORT=18790"
set "PATH=%UCRAW_ROOT%\bin\node;%PATH%"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

echo.
echo   ================================
echo    UClaW Control Panel v1.2.0
echo   ================================
echo.

rem === Check Node.js ===
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Run setup.bat first.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  Node.js %%v OK

rem === Check OpenClaw ===
set "OPENCLAW_ENTRY=%UCRAW_ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js"
if not exist "%OPENCLAW_ENTRY%" (
    echo  [ERROR] OpenClaw not found. Run setup.bat first.
    pause
    exit /b 1
)
echo  OpenClaw OK

rem === Start Config Server (it manages the Gateway) ===
echo.
echo  Starting Control Panel...
echo  Panel:   http://localhost:%UCLAW_CONFIG_PORT%
echo  Gateway: http://localhost:%OPENCLAW_GATEWAY_PORT% (auto-start)
echo.
echo  The browser will open automatically.
echo  Press Ctrl+C to stop all services.
echo  ========================================
echo.

rem === Start config server in background, open browser ===
start "UClaW Panel" /min node "%UCRAW_ROOT%\bin\config-server.js"

rem === Wait for panel to be ready ===
set "RETRY=0"
:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 15 goto :open_browser
node -e "fetch('http://localhost:%UCLAW_CONFIG_PORT%/').then(r=>process.exit(0)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 goto :wait_loop

:open_browser
start "" "http://localhost:%UCLAW_CONFIG_PORT%/"

rem === Keep window open, wait for Ctrl+C ===
:keep_alive
timeout /t 5 /nobreak >nul
goto :keep_alive
