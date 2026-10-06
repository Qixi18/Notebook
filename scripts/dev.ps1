$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendDir = Join-Path $repo 'apps\backend'
$frontendDir = Join-Path $repo 'apps\web'
$backendUrl = 'http://127.0.0.1:8000'
$frontendUrl = 'http://127.0.0.1:5173'

Get-Command uv -ErrorAction Stop | Out-Null
Get-Command npm -ErrorAction Stop | Out-Null

if (Test-Path (Join-Path $repo '.env')) {
    Write-Host 'Found local .env configuration.'
} else {
    Write-Host 'No .env found. The backend will use safe local defaults; copy .env.example to enable DeepSeek or Embedding.'
}

$backendProcess = $null
$workerProcess = $null
try {
    Write-Host 'Checking database migrations and starting material worker ...'
    Push-Location $backendDir
    try {
        uv run python -c 'from app.db.migrate import migrate_database; migrate_database()'
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; services were not started.' }
    } finally {
        Pop-Location
    }
    $workerProcess = Start-Process `
        -FilePath (Get-Command uv).Source `
        -ArgumentList @('run', 'python', '-m', 'app.workers.runner') `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "Starting NoteBuddy backend on $backendUrl ..."
    $backendProcess = Start-Process `
        -FilePath (Get-Command uv).Source `
        -ArgumentList @('run', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000') `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -PassThru

    $healthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri "$backendUrl/api/v1/health" -TimeoutSec 2
            if ($health.status -eq 'ok') {
                $healthy = $true
                break
            }
        } catch {
            if ($backendProcess.HasExited) {
                throw "Backend process exited before becoming healthy."
            }
        }
    }
    if (-not $healthy) {
        throw "Backend did not become healthy within 15 seconds."
    }

    Write-Host "Backend is healthy: $backendUrl/api/v1/health"
    Write-Host "Starting NoteBuddy frontend on $frontendUrl ..."
    Push-Location $frontendDir
    try {
        npm run dev -- --host 127.0.0.1
    } finally {
        Pop-Location
    }
} finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
        Write-Host 'Backend process stopped.'
    }
    if ($workerProcess -and -not $workerProcess.HasExited) {
        Stop-Process -Id $workerProcess.Id -Force
        Write-Host 'Material worker stopped.'
    }
}
