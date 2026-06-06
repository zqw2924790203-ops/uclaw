@echo off
chcp 65001 >nul 2>&1
title UClaW - 控制面板 + Gateway

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
echo    UClaW 控制面板 + Gateway
echo    v2026.6.1
echo   ================================
echo.

rem === Check Node.js ===
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo       %%v OK

rem === Check OpenClaw ===
echo [2/4] Checking OpenClaw...
set "OPENCLAW_ENTRY=%UCRAW_ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js"
if not exist "%OPENCLAW_ENTRY%" (
    echo [ERROR] OpenClaw not found
    pause
    exit /b 1
)
echo       OpenClaw 2026.6.1 OK

rem === Start Gateway in background ===
echo [3/4] Starting Gateway on port %OPENCLAW_GATEWAY_PORT%...
start "UClaW Gateway" /min node "%OPENCLAW_ENTRY%" gateway --port %OPENCLAW_GATEWAY_PORT%

rem === Start Config Server in background ===
echo [4/4] Starting Config Panel on port %UCLAW_CONFIG_PORT%...
start "UClaW Config" /min node "%UCRAW_ROOT%\bin\config-server.js"

rem === Wait for config server to be ready ===
echo.
echo  Waiting for services to start...
set "RETRY=0"
:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 15 (
    echo  [WARN] Services taking too long. Opening browser anyway...
    goto :open_browser
)
node -e "fetch('http://localhost:%UCLAW_CONFIG_PORT%/').then(r=>process.exit(0)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 goto :wait_loop

:open_browser
echo.
echo  ========================================
echo   Config Panel:  http://localhost:%UCLAW_CONFIG_PORT%
echo   Gateway:       http://localhost:%OPENCLAW_GATEWAY_PORT%
echo   Data Dir:      %OPENCLAW_STATE_DIR%
echo  ========================================
echo.
echo  Opening control panel in browser...
start "" "http://localhost:%UCLAW_CONFIG_PORT%/"
echo.
echo  Press any key to STOP all services.
echo  ========================================
pause >nul

rem === Stop all services ===
echo.
echo  Stopping services...
taskkill /FI "WINDOWTITLE eq UClaW Gateway" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq UClaW Config" /F >nul 2>&1
echo  All services stopped.
pause
