$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $repo 'apps\backend')
try {
    uv run ruff check app tests
    uv run pytest
} finally {
    Pop-Location
}

Push-Location (Join-Path $repo 'apps\desktop')
try {
    npm run build:main
} finally {
    Pop-Location
}

Push-Location (Join-Path $repo 'apps\web')
try {
    npm run build
} finally {
    Pop-Location
}
