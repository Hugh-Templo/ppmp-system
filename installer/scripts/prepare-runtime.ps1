<#
.SYNOPSIS
  Stage installer payload: embedded Python + deps, rclone, WinSW, app sources, Electron UI.

.DESCRIPTION
  Run on the build machine before compiling installer/ppmp-setup.iss.

  Output layout:
    installer/payload/
      runtime/python/   embeddable CPython + site-packages
      tools/rclone/
      tools/winsw/PPMP-API.exe
      app/ ... project files
      ui/               Electron win-unpacked (if electron:build ran)
      templates/        WinSW XML template copy
#>
[CmdletBinding()]
param(
  [string]$PythonVersion = "3.12.8",
  [string]$RcloneVersion = "1.69.1",
  [string]$WinSwVersion = "2.12.0",
  [switch]$SkipElectron,
  [switch]$SkipDownloads
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Payload = Join-Path $RepoRoot "installer\payload"
$Vendor = Join-Path $RepoRoot "installer\vendor"
$Cache = Join-Path $Vendor "cache"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

Ensure-Dir $Payload
Ensure-Dir $Cache
Ensure-Dir (Join-Path $Payload "runtime")
Ensure-Dir (Join-Path $Payload "tools\rclone")
Ensure-Dir (Join-Path $Payload "tools\winsw")
Ensure-Dir (Join-Path $Payload "logs")
Ensure-Dir (Join-Path $Payload "IT_ppmps\CSE")
Ensure-Dir (Join-Path $Payload "IT_ppmps\nonCSE")
Ensure-Dir (Join-Path $Payload "data\app_outputs")
Ensure-Dir (Join-Path $Payload "data\inputs")
Ensure-Dir (Join-Path $Payload "credentials")

# --- Embedded Python ---
Write-Step "Embedded Python $PythonVersion"
$PyZipName = "python-$PythonVersion-embed-amd64.zip"
$PyZip = Join-Path $Cache $PyZipName
$PyUrl = "https://www.python.org/ftp/python/$PythonVersion/$PyZipName"
$PythonRoot = Join-Path $Payload "runtime\python"

if (-not $SkipDownloads) {
  if (-not (Test-Path $PyZip)) {
    Write-Host "Downloading $PyUrl"
    Invoke-WebRequest -Uri $PyUrl -OutFile $PyZip -UseBasicParsing
  }
}

if (Test-Path $PythonRoot) { Remove-Item $PythonRoot -Recurse -Force }
Ensure-Dir $PythonRoot
Expand-Archive -Path $PyZip -DestinationPath $PythonRoot -Force

# Enable site-packages in embeddable build
$Pth = Get-ChildItem -Path $PythonRoot -Filter "python*._pth" | Select-Object -First 1
if (-not $Pth) { throw "python*._pth not found in embeddable package" }
$PthText = Get-Content $Pth.FullName -Raw
if ($PthText -notmatch "(?m)^import site") {
  $PthText = $PthText -replace "(?m)^#import site", "import site"
  if ($PthText -notmatch "(?m)^import site") {
    $PthText = $PthText.TrimEnd() + "`r`nimport site`r`n"
  }
  Set-Content -Path $Pth.FullName -Value $PthText -NoNewline
}

$GetPip = Join-Path $Cache "get-pip.py"
if (-not $SkipDownloads) {
  if (-not (Test-Path $GetPip)) {
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPip -UseBasicParsing
  }
}

$PythonExe = Join-Path $PythonRoot "python.exe"
Write-Host "Installing pip..."
& $PythonExe $GetPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip failed" }

$Req = Join-Path $RepoRoot "requirements.txt"
Write-Host "Installing requirements from $Req"
& $PythonExe -m pip install --no-warn-script-location -r $Req
if ($LASTEXITCODE -ne 0) { throw "pip install requirements failed" }

# --- rclone ---
Write-Step "rclone $RcloneVersion"
$RcloneZipName = "rclone-v$RcloneVersion-windows-amd64.zip"
$RcloneZip = Join-Path $Cache $RcloneZipName
$RcloneUrl = "https://downloads.rclone.org/v$RcloneVersion/$RcloneZipName"
if (-not $SkipDownloads) {
  if (-not (Test-Path $RcloneZip)) {
    Write-Host "Downloading $RcloneUrl"
    Invoke-WebRequest -Uri $RcloneUrl -OutFile $RcloneZip -UseBasicParsing
  }
}
$RcloneExtract = Join-Path $Cache "rclone-extract"
if (Test-Path $RcloneExtract) { Remove-Item $RcloneExtract -Recurse -Force }
Expand-Archive -Path $RcloneZip -DestinationPath $RcloneExtract -Force
$RcloneSrc = Get-ChildItem -Path $RcloneExtract -Recurse -Filter "rclone.exe" | Select-Object -First 1
if (-not $RcloneSrc) { throw "rclone.exe not found in archive" }
Copy-Item $RcloneSrc.FullName (Join-Path $Payload "tools\rclone\rclone.exe") -Force

# --- WinSW ---
Write-Step "WinSW $WinSwVersion"
$WinSwName = "WinSW-x64.exe"
$WinSwOut = Join-Path $Payload "tools\winsw\PPMP-API.exe"
$WinSwUrl = "https://github.com/winsw/winsw/releases/download/v$WinSwVersion/$WinSwName"
$WinSwCache = Join-Path $Cache $WinSwName
if (-not $SkipDownloads) {
  if (-not (Test-Path $WinSwCache)) {
    Write-Host "Downloading $WinSwUrl"
    Invoke-WebRequest -Uri $WinSwUrl -OutFile $WinSwCache -UseBasicParsing
  }
}
Copy-Item $WinSwCache $WinSwOut -Force
Copy-Item (Join-Path $RepoRoot "installer\templates\PPMP-API.xml.template") `
  (Join-Path $Payload "tools\winsw\PPMP-API.xml.template") -Force

# --- App sources ---
Write-Step "Copy app sources"
$AppDest = Join-Path $Payload "app"
if (Test-Path $AppDest) { Remove-Item $AppDest -Recurse -Force }
Copy-Item (Join-Path $RepoRoot "app") $AppDest -Recurse -Force

# Templates (APP Excel exports)
$TplSrc = Join-Path $RepoRoot "templates"
if (Test-Path $TplSrc) {
  $TplDest = Join-Path $Payload "templates"
  if (Test-Path $TplDest) { Remove-Item $TplDest -Recurse -Force }
  Copy-Item $TplSrc $TplDest -Recurse -Force
}

Copy-Item (Join-Path $RepoRoot "requirements.txt") (Join-Path $Payload "requirements.txt") -Force
Copy-Item (Join-Path $RepoRoot ".env.example") (Join-Path $Payload ".env.example") -Force
Copy-Item (Join-Path $RepoRoot "installer\scripts\Configure-Install.ps1") `
  (Join-Path $Payload "Configure-Install.ps1") -Force
Copy-Item (Join-Path $RepoRoot "installer\scripts\Uninstall-Service.ps1") `
  (Join-Path $Payload "Uninstall-Service.ps1") -Force

# Placeholder keep files
Set-Content (Join-Path $Payload "IT_ppmps\CSE\.gitkeep") ""
Set-Content (Join-Path $Payload "IT_ppmps\nonCSE\.gitkeep") ""
Set-Content (Join-Path $Payload "credentials\.gitkeep") ""

# --- Electron UI ---
if (-not $SkipElectron) {
  Write-Step "Electron UI (electron:build)"
  Push-Location (Join-Path $RepoRoot "frontend")
  try {
    if (-not (Test-Path "node_modules")) {
      npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    npm run electron:build
    if ($LASTEXITCODE -ne 0) { throw "electron:build failed" }
  } finally {
    Pop-Location
  }

  $Unpacked = Join-Path $RepoRoot "frontend\dist-electron\win-unpacked"
  if (-not (Test-Path $Unpacked)) {
    throw "Missing $Unpacked - electron:build did not produce win-unpacked"
  }
  $UiDest = Join-Path $Payload "ui"
  if (Test-Path $UiDest) { Remove-Item $UiDest -Recurse -Force }
  Copy-Item $Unpacked $UiDest -Recurse -Force
} else {
  Write-Host "Skipping Electron build (-SkipElectron). Place win-unpacked under installer\payload\ui before compiling Inno."
}

Write-Step "Payload ready"
Write-Host "Payload: $Payload"
Write-Host "Next: compile installer\ppmp-setup.iss with Inno Setup (ISCC)."
