@echo off
setlocal
cd /d "%~dp0"
title Wymiar ZERQONA - Discord Bot
where node >nul 2>nul
if errorlevel 1 (
  echo Zainstaluj Node.js 24, minimum 24.17.0, i uruchom ten plik ponownie.
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<24||(v[0]===24&&v[1]<17))process.exit(1)"
if errorlevel 1 (
  echo Wymagana wersja Node.js: minimum 24.17.0.
  pause
  exit /b 1
)
if not exist .env if not defined DISCORD_TOKEN (
  copy .env.example .env >nul
  echo Wpisz DISCORD_TOKEN i GUILD_ID w pliku .env, zapisz i uruchom ponownie.
  notepad .env
  exit /b 0
)
if not exist node_modules\discord.js (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Instalacja zaleznosci nie powiodla sie. Sprawdz komunikat powyzej.
    pause
    exit /b 1
  )
)
call npm start
pause
