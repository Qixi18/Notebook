$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

Write-Host 'Starting NoteBuddy backend on http://127.0.0.1:8000 ...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$repo\apps\backend'; uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

Write-Host 'Starting NoteBuddy frontend on http://127.0.0.1:5173 ...'
Set-Location (Join-Path $repo 'apps\web')
npm run dev

