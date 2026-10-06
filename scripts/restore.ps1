param(
    [Parameter(Mandatory=$true)][string]$Checkpoint,
    [string]$Destination,
    [switch]$Package,
    [switch]$Replace
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath $Checkpoint -PathType Leaf)) { throw "Backup package or checkpoint not found: $Checkpoint" }
$Checkpoint = (Resolve-Path -LiteralPath $Checkpoint).Path
if ($Replace) {
    if (-not $Package) { throw '-Replace 只支持 .notebuddy.zip 完整包，请同时指定 -Package。' }
    if ($Destination) { throw '-Replace 不接受 -Destination；它会切换当前 data 目录。' }
    $dataDir = Join-Path $repo 'data'
    foreach ($port in @(8000, 5173)) {
        if (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).Count -gt 0) {
            throw "端口 $port 仍在监听，请先停止 NoteBuddy 服务后再恢复。"
        }
    }
    Push-Location (Join-Path $repo 'apps\backend')
    try {
        uv run python -m app.services.restore replace $Checkpoint --data-dir $dataDir
        if ($LASTEXITCODE -ne 0) { throw 'Atomic data replacement failed.' }
    } finally { Pop-Location }
    exit 0
}
if (-not $Destination) { throw '普通恢复需要 -Destination；若要替换当前数据请使用 -Package -Replace。' }
if ((Test-Path -LiteralPath $Destination) -and @(Get-ChildItem -LiteralPath $Destination -Force).Count -gt 0) {
    throw 'Destination must be an empty directory. This command never replaces live data.'
}
Push-Location (Join-Path $repo 'apps\backend')
try {
    if ($Package) {
        uv run python -m app.services.backup restore $Checkpoint --destination $Destination
    } else {
        uv run python -m app.db.checkpoint restore $Checkpoint --destination $Destination
    }
    if ($LASTEXITCODE -ne 0) { throw 'Checkpoint restore failed.' }
} finally { Pop-Location }
