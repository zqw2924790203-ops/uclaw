@echo off
chcp 65001 >nul 2>&1
title UClaW Setup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo   ================================
echo    UClaW v1.0.0 Setup
echo   ================================
echo.

rem === Check if already set up ===
if exist "%ROOT%\bin\node\node.exe" (
    if exist "%ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js" (
        echo  Already set up! Run Launch.bat to start.
        pause
        exit /b 0
    )
)

rem === Step 1: Download Node.js ===
if exist "%ROOT%\bin\node\node.exe" (
    echo  [1/2] Node.js already present, skipping.
    goto :install_openclaw
)

echo  [1/2] Downloading Node.js v24.14.1...
echo         This may take a few minutes.
mkdir "%ROOT%\bin\node" 2>nul

rem Download Node.js zip
curl -L -o "%ROOT%\bin\node.zip" "https://nodejs.org/dist/v24.14.1/node-v24.14.1-win-x64.zip" 2>nul
if errorlevel 1 (
    echo  [ERROR] Failed to download Node.js.
    echo          Please download manually from https://nodejs.org/
    echo          Extract to bin\node\
    pause
    exit /b 1
)

echo  Extracting Node.js...
powershell -Command "Expand-Archive -Path '%ROOT%\bin\node.zip' -DestinationPath '%ROOT%\bin\node_tmp' -Force" 2>nul
rem Move contents up one level (zip has node-v24.14.1-win-x64\ inside)
for /d %%d in ("%ROOT%\bin\node_tmp\node-*") do xcopy "%%d\*" "%ROOT%\bin\node\" /E /I /H /Y /Q >nul
rmdir /s /q "%ROOT%\bin\node_tmp" 2>nul
del "%ROOT%\bin\node.zip" 2>nul

rem Verify
"%ROOT%\bin\node\node.exe" --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js extraction failed.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('"%ROOT%\bin\node\node.exe" --version') do echo  Node.js %%v installed.

:install_openclaw
rem === Step 2: Install OpenClaw ===
if exist "%ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js" (
    echo  [2/2] OpenClaw already present, skipping.
    goto :done
)

echo  [2/2] Installing OpenClaw v2026.6.1...
echo         This may take a few minutes.
mkdir "%ROOT%\bin\openclaw" 2>nul
cd /d "%ROOT%\bin\openclaw"
"%ROOT%\bin\node\npm.cmd" install openclaw@2026.6.1 --prefix . 2>nul
if errorlevel 1 (
    echo  [ERROR] Failed to install OpenClaw.
    echo          Check your internet connection.
    pause
    exit /b 1
)

rem Verify
"%ROOT%\bin\node\node.exe" "%ROOT%\bin\openclaw\node_modules\openclaw\dist\index.js" --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] OpenClaw installation verification failed.
    pause
    exit /b 1
)

:done
echo.
echo  ================================
echo   Setup complete!
echo.
echo   Run Launch.bat to start the gateway.
echo   Run Launch-ModelSwitcher.bat for the control panel.
echo  ================================
pause
