@echo off
chcp 65001 >nul
title エッグスシミュ 自動公開
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1"
