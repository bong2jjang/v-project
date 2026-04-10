@echo off
REM VMS Chat Ops Docs - Production Build Test Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Chat Ops Docs - Production Build
echo ================================================
echo.

echo Building production Docker image...
echo.

REM Build production image
docker build -t vms-chat-ops-docs:latest -f Dockerfile .

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ✓ Build completed successfully!
echo.
echo Image: vms-chat-ops-docs:latest
echo.
echo To test the production build:
echo   docker run -d -p 8080:80 --name vms-docs-prod vms-chat-ops-docs:latest
echo   # Visit: http://localhost:8080
echo   docker stop vms-docs-prod ^&^& docker rm vms-docs-prod
echo.
