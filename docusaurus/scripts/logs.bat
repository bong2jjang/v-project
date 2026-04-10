@echo off
REM VMS Chat Ops Docs - View Logs Script

cd /d "%~dp0\.."

echo ================================================
echo   VMS Chat Ops Docs - Live Logs
echo ================================================
echo.
echo Showing live logs ^(Ctrl+C to exit^)...
echo.

docker compose logs -f --tail=100
