@echo off
REM VMS Chat Ops Docs - Cleanup Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Chat Ops Docs - Cleanup
echo ================================================
echo.
echo This will remove:
echo   - Docker containers and volumes
echo   - node_modules directory
echo   - .docusaurus cache
echo   - Build artifacts
echo.
set /p confirm="Are you sure? (y/N): "

if /i not "%confirm%"=="y" (
    echo Cleanup cancelled.
    exit /b 0
)

echo.
echo Cleaning up...
echo.

REM Stop and remove containers and volumes
docker ps -a --format "{{.Names}}" | findstr /x "vms-docs" >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing Docker containers and volumes...
    docker compose down -v
)

REM Remove node_modules
if exist "node_modules" (
    echo Removing node_modules...
    rmdir /s /q node_modules
)

REM Remove .docusaurus cache
if exist ".docusaurus" (
    echo Removing .docusaurus cache...
    rmdir /s /q .docusaurus
)

REM Remove build directory
if exist "build" (
    echo Removing build artifacts...
    rmdir /s /q build
)

echo.
echo ✓ Cleanup completed!
echo.
echo To start fresh:
echo   scripts\dev.bat
echo.
