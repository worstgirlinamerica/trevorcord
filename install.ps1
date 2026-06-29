$ErrorActionPreference = "Stop"

$Repo = "worstgirlinamerica/trevorcord"
$Branch = if ($env:TREVORCORD_BRANCH) { $env:TREVORCORD_BRANCH } else { "main" }
$InstallDir = if ($env:TREVORCORD_HOME) { $env:TREVORCORD_HOME } else { Join-Path $env:USERPROFILE ".trevorcord" }

function Require-Command($Name, $InstallMessage) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error $InstallMessage
    }
}

Require-Command "node" "TrevorCord needs Node.js. Install it from https://nodejs.org, then run this command again."
Require-Command "npm" "TrevorCord needs npm. npm is normally included with Node.js from https://nodejs.org."

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("trevorcord-" + [System.Guid]::NewGuid())
$ZipPath = Join-Path $TempDir "trevorcord.zip"
$ExtractDir = Join-Path $TempDir "extract"
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"

New-Item -ItemType Directory -Force -Path $TempDir, $ExtractDir, $InstallDir | Out-Null

try {
    Write-Host "Downloading TrevorCord from $ArchiveUrl"
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ZipPath
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    $SourceDir = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
    if (-not $SourceDir) {
        throw "Could not find extracted TrevorCord folder."
    }

    Get-ChildItem -Path $InstallDir -Force | Remove-Item -Recurse -Force
    Copy-Item -Path (Join-Path $SourceDir.FullName "*") -Destination $InstallDir -Recurse -Force

    Write-Host "Installing TrevorCord into Discord..."
    node (Join-Path $InstallDir "bin\trevorcord.js") install

    Write-Host ""
    Write-Host "Done."
    Write-Host "Fully quit Discord and reopen it."
    Write-Host ""
    Write-Host "TrevorCord was installed at:"
    Write-Host "  $InstallDir"
    Write-Host ""
    Write-Host "Useful commands:"
    Write-Host "  node `"$InstallDir\bin\trevorcord.js`" status"
    Write-Host "  node `"$InstallDir\bin\trevorcord.js`" restore"
}
finally {
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}
