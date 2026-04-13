@echo off
REM VMS Channel Bridge Docs - Production Build Test Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Channel Bridge Docs - Production Build
echo ================================================
echo.

echo Building production Docker image...
echo.

REM Build production image
docker build -t vms-channel-bridge-docs:latest -f Dockerfile .

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ✓ Build completed successfully!
echo.
echo Image: vms-channel-bridge-docs:latest
echo.
echo To test the production build:
echo   docker run -d -p 8080:80 --name vms-docs-prod vms-channel-bridge-docs:latest
echo   # Visit: http://localhost:8080
echo   docker stop vms-docs-prod ^&^& docker rm vms-docs-prod
echo.
