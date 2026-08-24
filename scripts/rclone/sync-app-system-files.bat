@echo off
setlocal EnableExtensions
REM Sync extracted APP SYSTEM FILES package to Google Drive via rclone (personal Gmail OK).
REM
REM Prerequisites:
REM   1. Install rclone: https://rclone.org/downloads/
REM   2. Run: rclone config
REM      - New remote name: gdrive  (or set RCLONE_REMOTE below)
REM      - Storage: Google Drive
REM      - Sign in with the personal account that owns APP SYSTEM FILES
REM   3. BAC Admin → Download for rclone → extract the ZIP somewhere
REM
REM Usage:
REM   sync-app-system-files.bat "C:\path\to\extracted\2027"
REM   sync-app-system-files.bat "C:\path\to\extracted\2027" 2027
REM
REM The folder you pass should CONTAIN PPMP\ (and optionally CSE-APP\, nonCSE-APP\).
REM Example ZIP layout after extract:
REM   C:\Downloads\APP-SYSTEM-FILES-FY2027-rclone\2027\PPMP\OCHO\...
REM   → pass: C:\Downloads\APP-SYSTEM-FILES-FY2027-rclone\2027

set "RCLONE_REMOTE=gdrive"
set "DRIVE_ROOT=APP SYSTEM FILES"

if "%~1"=="" (
  echo Usage: %~nx0 "C:\path\to\FY_FOLDER" [fiscal_year]
  echo Example: %~nx0 "C:\Users\You\Downloads\APP-SYSTEM-FILES-FY2027-rclone\2027"
  exit /b 1
)

set "SRC=%~f1"
if not exist "%SRC%\" (
  echo Source folder not found: %SRC%
  exit /b 1
)

set "FY=%~2"
if "%FY%"=="" (
  for %%I in ("%SRC%") do set "FY=%%~nxI"
)

where rclone >nul 2>&1
if errorlevel 1 (
  echo rclone not found in PATH. Install from https://rclone.org/downloads/
  exit /b 1
)

echo Syncing:
echo   FROM: %SRC%
echo   TO:   %RCLONE_REMOTE%:"%DRIVE_ROOT%/%FY%"
echo.

rclone sync "%SRC%" "%RCLONE_REMOTE%:%DRIVE_ROOT%/%FY%" --progress --create-empty-src-dirs
if errorlevel 1 (
  echo rclone sync failed.
  exit /b 1
)

echo.
echo Done. Check Drive: %DRIVE_ROOT% / %FY% / PPMP / {office}
endlocal
