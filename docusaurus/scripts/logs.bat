@echo off
REM VMS Channel Bridge Docs - View Logs Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Channel Bridge Docs - Live Logs
echo ================================================
echo.
echo Showing live logs ^(Ctrl+C to exit^)...
echo.

docker compose logs -f --tail=100
