@echo off
setlocal
title ArtFlix Studio
set "RUNDIR=%TEMP%\ArtFlixStudio\run"
if not exist "%RUNDIR%" mkdir "%RUNDIR%"
echo Copiando a versao atual do ArtFlix para execucao local...
robocopy "%~dp0" "%RUNDIR%" /E /NFL /NDL /NJH /NJS /NP /XD "%~dp0node_modules" "%~dp0dist" "%~dp0.git" "%~dp0.codex" "%~dp0.agents" >nul
if errorlevel 8 (
  echo Nao foi possivel copiar o projeto para a pasta local.
  pause
  exit /b 1
)
cd /d "%RUNDIR%"
echo Conferindo dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo Nao foi possivel instalar as dependencias.
  pause
  exit /b 1
)
start "ArtFlix Server" cmd /k "npm run dev -- --host 127.0.0.1 --strictPort"
timeout /t 3 >nul
start "" "http://127.0.0.1:5173/"
