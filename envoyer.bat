@echo off
chcp 65001 >nul
setlocal
title Magic Moments - Envoi vers GitHub
cd /d "%~dp0"

echo ==============================================
echo   Magic Moments - Envoi des modifications
echo ==============================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :nogit

rem --- Vérification du code avant envoi (si Node.js est installé) ---
where node >nul 2>nul
if errorlevel 1 goto :skipcheck
node --check server.js
if errorlevel 1 goto :badcode
node --check public\app.js
if errorlevel 1 goto :badcode
echo Vérification du code : OK
echo.
:skipcheck

rem --- Premier envoi : création du dépôt local ---
if exist ".git" goto :hasrepo
echo Ce dossier n'est pas encore relié à GitHub.
set /p REMOTE=Collez l'adresse du dépôt GitHub (ex. https://github.com/compte/magic-moments.git) : 
if "%REMOTE%"=="" goto :cancel
git init
git branch -M main
git remote add origin "%REMOTE%"
echo.
:hasrepo

git remote get-url origin >nul 2>nul
if errorlevel 1 goto :noremote

rem --- Reprendre l'historique déjà présent sur GitHub (fichiers envoyés depuis le site, etc.) ---
echo Récupération de l'état actuel de GitHub...
git fetch origin
if errorlevel 1 goto :fetchfail
set "REMOTEBR="
git rev-parse --verify --quiet origin/main >nul && set "REMOTEBR=main"
if not defined REMOTEBR git rev-parse --verify --quiet origin/master >nul && set "REMOTEBR=master"
if not defined REMOTEBR goto :historyok
git rev-parse --verify --quiet HEAD >nul
if errorlevel 1 goto :adopt
git merge-base HEAD origin/%REMOTEBR% >nul 2>nul
if not errorlevel 1 goto :historyok
:adopt
rem Les fichiers de ce dossier sont conservés tels quels ; seul l'historique GitHub est repris.
git reset --soft origin/%REMOTEBR%
git branch -M %REMOTEBR%
echo Historique GitHub repris (branche %REMOTEBR%).
:historyok
echo.

rem --- Sécurité : ne jamais envoyer les données clients ni les secrets ---
git rm -r --cached --quiet --ignore-unmatch data .env >nul 2>nul

set "MSG="
set /p MSG=Message de mise à jour (Entrée = message automatique) : 
if "%MSG%"=="" set "MSG=Mise à jour Magic Moments %date% %time:~0,5%"
set "MSG=%MSG:"='%"

git add -A
git diff --cached --quiet
if not errorlevel 1 goto :nochange

echo.
echo Fichiers envoyés :
git diff --cached --name-status
echo.
git commit -m "%MSG%"
if errorlevel 1 goto :fail

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
git push -u origin %BRANCH%
if errorlevel 1 goto :pushfail

echo.
echo ==============================================
echo   Envoi réussi sur la branche %BRANCH%.
echo   Render redéploie automatiquement si
echo   "Auto-Deploy" est activé. Suivez l'avancement
echo   dans l'onglet Events du service Render.
echo ==============================================
goto :end

:nochange
echo.
echo Aucun changement à envoyer : GitHub est déjà à jour.
goto :end

:nogit
echo Git n'est pas installé. Téléchargez-le sur https://git-scm.com/download/win
echo puis relancez envoyer.bat.
goto :end

:badcode
echo.
echo ERREUR : le code contient une erreur de syntaxe. Rien n'a été envoyé.
goto :end

:noremote
echo Aucun dépôt GitHub n'est configuré (remote "origin").
echo Commande pour l'ajouter : git remote add origin https://github.com/compte/depot.git
goto :end

:pushfail
echo.
echo ERREUR lors de l'envoi. Causes fréquentes :
echo  - connexion Internet interrompue ;
echo  - identifiants GitHub à saisir ou expirés ;
echo  - GitHub contient des changements absents d'ici : lancez "git pull" puis relancez.
echo Le commit est conservé localement ; relancez envoyer.bat pour réessayer.
goto :end

:fetchfail
echo.
echo ERREUR : impossible de lire le dépôt GitHub. Vérifiez l'adresse et la connexion Internet.
echo Pour corriger l'adresse : git remote set-url origin https://github.com/compte/depot.git
goto :end

:fail
echo.
echo ERREUR lors de l'enregistrement local. Si Git demande votre nom et courriel :
echo   git config --global user.name "Votre nom"
echo   git config --global user.email "vous@exemple.com"
goto :end

:cancel
echo Envoi annulé.

:end
echo.
pause
endlocal
