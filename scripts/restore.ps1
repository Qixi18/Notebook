param(
    [Parameter(Mandatory=$true)][string]$Checkpoint,
    [Parameter(Mandatory=$true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ((Test-Path -LiteralPath $Destination) -and @(Get-ChildItem -LiteralPath $Destination -Force).Count -gt 0) {
    throw 'Destination must be an empty directory. This command never replaces live data.'
}
Push-Location (Join-Path $repo 'apps\backend')
try {
    uv run python -m app.db.checkpoint restore $Checkpoint --destination $Destination
    if ($LASTEXITCODE -ne 0) { throw 'Checkpoint restore failed.' }
} finally { Pop-Location }
