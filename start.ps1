# Compila o app e inicia o servidor unico (app + API na porta 5173) e abre o navegador.
# Use este script se quiser (re)compilar apos mudancas no codigo.
$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot

Write-Host "Encerrando servidores antigos..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Compilando o app (frontend)..."
Push-Location "$root\frontend"
npm run build
Pop-Location

Write-Host "Iniciando o servidor (http://localhost:5173)..."
Start-Process -WindowStyle Hidden "C:\Program Files\nodejs\node.exe" -ArgumentList "server.js" -WorkingDirectory "$root\backend"

Start-Sleep -Seconds 4
$url = "http://localhost:5173"
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { Start-Process $chrome $url } else { Start-Process $url }
Write-Host "Pronto! App aberto em $url"
