$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $repo 'apps\backend')
try {
    uv run pytest
} finally {
    Pop-Location
}

Push-Location (Join-Path $repo 'apps\web')
try {
    npm run build
} finally {
    Pop-Location
}

