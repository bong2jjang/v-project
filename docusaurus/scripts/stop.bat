@echo off
REM VMS Channel Bridge Docs - Stop Development Server Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Channel Bridge Docs - Stop Server
echo ================================================
echo.

REM Check if container is running
docker ps --format "{{.Names}}" | findstr /x "vms-docs" >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping Docusaurus development server...
    echo.
    docker compose down
    echo.
    echo ✓ Server stopped successfully!
) else (
    echo No running container found.
)

echo.
