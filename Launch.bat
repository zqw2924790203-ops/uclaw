@echo off
chcp 65001 >nul 2>&1
title UClaW - Portable OpenClaw Gateway

echo.
echo   ================================
echo    UClaW - Portable OpenClaw
echo    v2026.6.1
echo   ================================
echo.

rem === Resolve script directory (works from any drive letter) ===
set "UCRAW_ROOT=%~dp0"
set "UCRAW_ROOT=%UCRAW_ROOT:~0,-1%"

rem === Set portable environment ===
set "OPENCLAW_STATE_DIR=%UCRAW_ROOT%\data"
set "HOME=%UCRAW_ROOT%\data"
set "TMPDIR=%UCRAW_ROOT%\data\tmp"
set "OPENCLAW_GATEWAY_PORT=18789"

rem === Add portable Node.js to PATH ===
set "PATH=%UCRAW_ROOT%\bin\node;%PATH%"

rem === Ensure tmp directory exists ===
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

rem === Check Node.js ===
echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found at bin\node\node.exe
    echo         Please ensure the portable Node.js is installed.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo       Node.js %%v OK

rem === Check OpenClaw ===
echo [2/3] Checking OpenClaw...
set "OPENCLAW_ENTRY=%UCRAW_ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js"
if not exist "%OPENCLAW_ENTRY%" (
    echo [ERROR] OpenClaw not found at bin\openclaw\
    echo         Please ensure OpenClaw is installed.
    pause
    exit /b 1
)
echo       OpenClaw 2026.6.1 OK

rem === Start Gateway in background ===
echo [3/3] Starting Gateway on port %OPENCLAW_GATEWAY_PORT%...
echo.
echo  Gateway URL:  http://localhost:%OPENCLAW_GATEWAY_PORT%
echo  Control UI:   http://localhost:%OPENCLAW_GATEWAY_PORT%/
echo  Data Dir:     %OPENCLAW_STATE_DIR%
echo.
echo  ========================================
echo.

rem === Launch gateway in background ===
start "UClaW Gateway" /min node "%OPENCLAW_ENTRY%" gateway --port %OPENCLAW_GATEWAY_PORT%

rem === Wait for gateway to be ready ===
echo  Waiting for gateway to start...
set "RETRY=0"
:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 15 (
    echo  [WARN] Gateway taking too long to start. Opening browser anyway...
    goto :open_browser
)
node -e "fetch('http://localhost:%OPENCLAW_GATEWAY_PORT%/').then(r=>process.exit(0)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 goto :wait_loop

:open_browser
echo  Gateway is ready!
echo  Opening Web UI...
start "" "http://localhost:%OPENCLAW_GATEWAY_PORT%/"
echo.
echo  ========================================
echo   Gateway is running in background.
echo   Web UI opened in your browser.
echo.
echo   Press any key to STOP the gateway.
echo  ========================================
echo.

rem === Wait for user to press a key to stop ===
pause >nul

rem === Kill the gateway process ===
echo.
echo  Stopping gateway...
taskkill /FI "WINDOWTITLE eq UClaW Gateway" /F >nul 2>&1
node -e "fetch('http://localhost:%OPENCLAW_GATEWAY_PORT%/',{method:'DELETE'}).catch(()=>{})" >nul 2>&1
echo  Gateway stopped.
pause
