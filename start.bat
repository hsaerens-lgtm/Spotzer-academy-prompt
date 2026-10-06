@echo off
setlocal
title Athena Prompt Academy
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js est introuvable.
  echo  Installe Node 24 LTS depuis https://nodejs.org puis relance start.bat
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  Premiere utilisation : installation des dependances, patiente une minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  L'installation a echoue. Lis le message ci-dessus, puis relance start.bat
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  Athena Prompt Academy demarre et s'ouvre dans ton navigateur.
echo  Adresse : http://localhost:5173  (si le port est pris, Vite en choisit un autre et ouvre le bon)
echo  Pour arreter : ferme cette fenetre ou fais Ctrl+C.
echo.
call npm run dev -- --open

echo.
echo  Le serveur s'est arrete.
pause
