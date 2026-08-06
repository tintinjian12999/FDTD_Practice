@echo off
setlocal

cd /d "%~dp0"

set "UFDTD_ACTIVATE="
if exist "%LOCALAPPDATA%\miniconda3\Scripts\activate.bat" set "UFDTD_ACTIVATE=%LOCALAPPDATA%\miniconda3\Scripts\activate.bat"
if not defined UFDTD_ACTIVATE if exist "%USERPROFILE%\miniconda3\Scripts\activate.bat" set "UFDTD_ACTIVATE=%USERPROFILE%\miniconda3\Scripts\activate.bat"
if not defined UFDTD_ACTIVATE if exist "%USERPROFILE%\anaconda3\Scripts\activate.bat" set "UFDTD_ACTIVATE=%USERPROFILE%\anaconda3\Scripts\activate.bat"

if defined UFDTD_ACTIVATE (
  call "%UFDTD_ACTIVATE%" ufdtd-c
) else (
  where conda.bat >nul 2>nul
  if errorlevel 1 goto :missing_conda
  call conda.bat activate ufdtd-c
)
if errorlevel 1 goto :failed

where npm.cmd >nul 2>nul
if errorlevel 1 goto :missing_npm

cd web

if not exist "node_modules\.package-lock.json" (
  echo [uFDTD] Installing the locked web dependencies...
  call npm ci
  if errorlevel 1 goto :failed
)

echo [uFDTD] Rebuilding the C core as WebAssembly...
call npm run build:wasm
if errorlevel 1 goto :failed

if /i "%~1"=="--check" (
  echo [uFDTD] Environment check passed.
  exit /b 0
)

echo [uFDTD] Starting http://localhost:5173/
echo [uFDTD] Press Ctrl+C to stop the server.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
exit /b %errorlevel%

:missing_conda
echo [uFDTD] Conda was not found. Install Miniconda and create the ufdtd-c environment first.
goto :failed

:missing_npm
echo [uFDTD] npm was not found. Install Node.js or activate the ufdtd-c environment manually.
goto :failed

:failed
echo [uFDTD] Startup failed. Review the error above.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
