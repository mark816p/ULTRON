@echo off
:: ============================================================================
:: U.L.T.R.O.N. Universal Windows Client Launcher
:: Single-Click Executable Script for All System Versions
:: ============================================================================
title U.L.T.R.O.N. Universal Client Installer
color 0A
cls
echo ======================================================================
echo           U.L.T.R.O.N. UNIVERSAL NEURAL CLIENT INSTALLER             
echo ======================================================================
echo.
echo Launching U.L.T.R.O.N. Version Manager & Installer...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ULTRON-Installer.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Local script launch fallback. Downloading raw script from GitHub...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/mark816p/ULTRON/main/installer/ULTRON-Installer.ps1')"
)

pause
