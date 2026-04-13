@echo off
REM VMS Channel Bridge Docs - Development Server Start Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Channel Bridge Docs - Development Mode
echo ================================================
echo.

REM Check if container is already running
docker ps --format "{{.Names}}" | findstr /x "vms-docs" >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Container 'vms-docs' is already running.
    echo.
    echo Choose an option:
    echo   1^) Restart the container
    echo   2^) View logs
    echo   3^) Exit
    set /p choice="Enter choice [1-3]: "

    if "!choice!"=="1" (
        echo.
        echo Restarting container...
        docker compose restart
    ) else if "!choice!"=="2" (
        echo.
        echo Showing logs ^(Ctrl+C to exit^)...
        docker compose logs -f
        exit /b 0
    ) else (
        echo Exiting...
        exit /b 0
    )
) else (
    echo Starting Docusaurus development server...
    echo.
    docker compose up -d
)

echo.
echo ✓ Development server started!
echo.
echo Docs available at: http://localhost:3000
echo.
echo Useful commands:
echo   View logs:     scripts\logs.bat
echo   Stop server:   scripts\stop.bat
echo   Clean up:      scripts\clean.bat
echo.
echo Showing live logs ^(Ctrl+C to exit^)...
echo ================================================
echo.

docker compose logs -f
