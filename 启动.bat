@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 您的电脑尚未安装 Node.js，请先安装后再运行本脚本。
    echo 下载地址:https://npmmirror.com/mirrors/node/v18.16.0/win-x64/node.exe
    pause
    exit /b
)

:: 如果 node_modules 不存在，自动用淘宝镜像安装依赖
if not exist "node_modules\" (
    echo 📦 正在安装依赖...
    npm install --registry=https://registry.npmmirror.com
)

:: 启动项目
echo 🚀 正在启动格式转换工具...
node serve.cjs