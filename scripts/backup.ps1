param([string]$Destination, [switch]$Package)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDir = Join-Path $repo 'data'
if (-not $Destination) {
    $Destination = if ($Package) {
        Join-Path $dataDir ('backups\manual-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.notebuddy.zip')
    } else {
        Join-Path $dataDir ('backups\manual-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    }
}
Push-Location (Join-Path $repo 'apps\backend')
try {
    if ($Package) {
        uv run python -m app.services.backup create $Destination --data-dir $dataDir
    } else {
        uv run python -m app.db.checkpoint create $Destination --data-dir $dataDir
    }
    if ($LASTEXITCODE -ne 0) { throw 'Checkpoint creation failed.' }
} finally { Pop-Location }
