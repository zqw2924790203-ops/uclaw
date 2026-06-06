@echo off
chcp 65001 >nul 2>&1
title UClaW - Deploy to USB

echo.
echo  ========================================
echo   UClaW Deploy - 部署到 U 盘
echo  ========================================
echo.

rem === Source directory ===
set "SRC=D:\claw-u"

rem === Check if custom target drive is specified ===
if not "%~1"=="" (
    set "DST=%~1"
    goto :check_dst
)

rem === Auto-detect UClaW on removable drives ===
echo  正在搜索 U 盘上的 UClaW 目录...
set "DST="
for %%d in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%d:\UClaW\Launch.bat" (
        set "DST=%%d:\UClaW"
        echo  找到: %%d:\UClaW\
        goto :check_dst
    )
)

rem === Ask user for target ===
echo.
echo  未自动检测到 U 盘。
echo  请输入目标路径（如 U:\UClaW）:
set /p "DST=  目标: "

:check_dst
if "%DST%"=="" (
    echo  [ERROR] 未指定目标路径
    pause
    exit /b 1
)

echo.
echo  源目录:  %SRC%
echo  目标:    %DST%
echo.
echo  将使用 robocopy 增量同步（仅复制更新的文件）。
echo  按任意键开始部署，Ctrl+C 取消。
pause >nul

echo.
echo  [1/4] 同步启动脚本和配置...
robocopy "%SRC%" "%DST%" *.bat *.html *.txt *.json /NFL /NDL /NJH /NJS /nc /ns
echo  启动脚本: OK

echo  [2/4] 同步 Node.js 运行时...
robocopy "%SRC%\bin\node" "%DST%\bin\node" /E /NFL /NDL /NJH /NJS /nc /ns
echo  Node.js: OK

echo  [3/4] 同步 OpenClaw 包...
robocopy "%SRC%\bin\openclaw" "%DST%\bin\openclaw" /E /NFL /NDL /NJH /NJS /nc /ns
echo  OpenClaw: OK

echo  [4/4] 同步用户数据...
robocopy "%SRC%\data" "%DST%\data" /E /NFL /NDL /NJH /NJS /nc /ns /XD tmp
echo  用户数据: OK

echo.
echo  [额外] 同步模型预设...
robocopy "%SRC%\models" "%DST%\models" /E /NFL /NDL /NJH /NJS /nc /ns
echo  模型预设: OK

echo.
echo  ========================================
echo   部署完成！
echo  ========================================
echo.
echo  目标: %DST%
echo  启动: 运行 %DST%\Launch.bat
echo.
pause
