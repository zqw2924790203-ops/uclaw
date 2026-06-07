@echo off
chcp 65001 >nul 2>&1

set "UCRAW_ROOT=%~dp0"
set "UCRAW_ROOT=%UCRAW_ROOT:~0,-1%"
set "OPENCLAW_STATE_DIR=%UCRAW_ROOT%\data"
set "HOME=%UCRAW_ROOT%\data"
set "TMPDIR=%UCRAW_ROOT%\data\tmp"
set "PATH=%UCRAW_ROOT%\bin\node;%PATH%"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

node --version >nul 2>&1
if errorlevel 1 exit /b 1
set "OPENCLAW_ENTRY=%UCRAW_ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js"
if not exist "%OPENCLAW_ENTRY%" exit /b 1

rem === Start Gateway completely hidden ===
powershell -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath '%UCRAW_ROOT%\bin\node\node.exe' -ArgumentList '%OPENCLAW_ENTRY% gateway --port 18789'"

rem === Wait for ready ===
set "RETRY=0"
:wait_loop
timeout /t 1 /nobreak >nul >nul 2>&1
set /a RETRY+=1
if %RETRY% gtr 25 goto :open
node -e "fetch('http://localhost:18789/health').then(()=>process.exit(0)).catch(()=>process.exit(1))" >nul 2>&1
if errorlevel 1 goto :wait_loop

:open
start "" "http://localhost:18789/"
exit /b 0
