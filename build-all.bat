@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

where dotnet >nul 2>&1
if errorlevel 1 (
  echo ERROR: .NET 8 SDK was not found. Install it from https://dotnet.microsoft.com/download
  goto :failed
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js and npm were not found. Install Node.js LTS from https://nodejs.org/
  goto :failed
)

echo.
echo ========================================
echo 1/3 - Building backend
echo ========================================
pushd "%PROJECT_ROOT%\backend"
dotnet restore
if errorlevel 1 goto :failed
dotnet publish -c Release -r win-x64 --self-contained true -o "%PROJECT_ROOT%\publish\backend"
if errorlevel 1 goto :failed
popd

echo.
echo ========================================
echo 2/3 - Building frontend
echo ========================================
pushd "%PROJECT_ROOT%\frontend"
call npm.cmd install
if errorlevel 1 goto :failed
call npm.cmd run build
if errorlevel 1 goto :failed
popd

echo.
echo ========================================
echo 3/3 - Creating Windows installer
echo ========================================
pushd "%PROJECT_ROOT%"
call npm.cmd install
if errorlevel 1 goto :failed
call npm.cmd run build-app
if errorlevel 1 goto :failed
popd

echo.
echo BUILD COMPLETED.
echo Installer files are in: %PROJECT_ROOT%\release
pause
exit /b 0

:failed
echo.
echo BUILD FAILED. Review the error above.
pause
exit /b 1
