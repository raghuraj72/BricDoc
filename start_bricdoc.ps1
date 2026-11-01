# BricDoc Runner Script for Windows PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         Launching BricDoc Production Platform          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = "c:\Users\RAGHURAJ P SINGH\OneDrive\Desktop\BricDoc"
Set-Location $root

Write-Host "`n[1/2] Starting Backend API on http://127.0.0.1:8005 ..." -ForegroundColor Yellow
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$root`" && python backend\run_backend.py" -WorkingDirectory $root

Write-Host "[2/2] Starting Frontend Web App on http://localhost:3005 ..." -ForegroundColor Yellow
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$root\frontend`" && npm run start" -WorkingDirectory "$root\frontend"

Write-Host "`nWaiting for services to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

Write-Host "Opening BricDoc in your default browser..." -ForegroundColor Green
Start-Process "http://localhost:3005/"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  BricDoc is live and running!" -ForegroundColor Green
Write-Host "    - Web Platform:  http://localhost:3005/"
Write-Host "    - Word to PDF:   http://localhost:3005/tools/docx-to-pdf"
Write-Host "    - API Docs:      http://127.0.0.1:8005/api/v1/docs"
Write-Host "========================================================`n" -ForegroundColor Cyan
