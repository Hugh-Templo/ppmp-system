<#
.SYNOPSIS
  Post-file-copy configuration: write .env, api-config.json, WinSW XML; install+start PPMP-API.

.DESCRIPTION
  Called by Inno Setup after files are installed, with the port and DATABASE_URL chosen
  on the custom wizard page. Refuses to continue if the port is invalid or Postgres fails.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir,

  [Parameter(Mandatory = $true)]
  [int]$Port,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [switch]$SkipDbTest,
  [switch]$SkipService
)

$ErrorActionPreference = "Stop"

function Test-PortAvailable([int]$p) {
  if ($p -lt 1 -or $p -gt 65535) { return $false }
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $p)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

Write-Host "Configuring PPMP System at $InstallDir (port $Port)"

if ($Port -lt 1 -or $Port -gt 65535) {
  throw "Port must be between 1 and 65535 (got $Port)."
}

if (-not (Test-PortAvailable $Port)) {
  throw "Port $Port is already in use. Choose another port and run setup again."
}

$InstallDir = $InstallDir.TrimEnd('\')
$Python = Join-Path $InstallDir "runtime\python\python.exe"
$Rclone = Join-Path $InstallDir "tools\rclone\rclone.exe"
$WinSwExe = Join-Path $InstallDir "tools\winsw\PPMP-API.exe"
$WinSwTpl = Join-Path $InstallDir "tools\winsw\PPMP-API.xml.template"
$WinSwXml = Join-Path $InstallDir "tools\winsw\PPMP-API.xml"
$Logs = Join-Path $InstallDir "logs"

if (-not (Test-Path $Python)) { throw "Embedded Python missing: $Python" }
if (-not (Test-Path $Rclone)) { throw "rclone missing: $Rclone" }
if (-not (Test-Path $WinSwExe)) { throw "WinSW missing: $WinSwExe" }
if (-not (Test-Path $WinSwTpl)) { throw "WinSW template missing: $WinSwTpl" }

New-Item -ItemType Directory -Path $Logs -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallDir "IT_ppmps\CSE") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallDir "IT_ppmps\nonCSE") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallDir "data\app_outputs") -Force | Out-Null

# --- .env ---
$EnvPath = Join-Path $InstallDir ".env"
$EnvBody = @"
DATABASE_URL=$DatabaseUrl
RCLONE_REMOTE=gdrive
RCLONE_PATH=$Rclone
DRIVE_APP_ROOT_FOLDER_ID=1WwsC0Le5uo71jSzZlYsEnQT5MGWTnjq6
IT_PPMPS_DIR=$InstallDir\IT_ppmps
LOCAL_APP_OUTPUT_FOLDER=$InstallDir\data\app_outputs
LOCAL_INPUT_FOLDER=$InstallDir\data\inputs
"@
Set-Content -Path $EnvPath -Value $EnvBody -Encoding UTF8
Write-Host "Wrote $EnvPath"

# --- api-config.json (Electron reads this) ---
$ApiConfig = @{ apiBaseUrl = "http://127.0.0.1:$Port" } | ConvertTo-Json
$ApiConfigPaths = @(
  (Join-Path $InstallDir "api-config.json"),
  (Join-Path $InstallDir "ui\api-config.json")
)
foreach ($p in $ApiConfigPaths) {
  $parent = Split-Path $p -Parent
  if (Test-Path $parent) {
    Set-Content -Path $p -Value $ApiConfig -Encoding UTF8
    Write-Host "Wrote $p"
  }
}

# ProgramData copy for robustness
$ProgData = Join-Path $env:ProgramData "PPMP System"
New-Item -ItemType Directory -Path $ProgData -Force | Out-Null
Set-Content -Path (Join-Path $ProgData "api-config.json") -Value $ApiConfig -Encoding UTF8

# --- DB smoke test ---
if (-not $SkipDbTest) {
  Write-Host "Testing PostgreSQL connection..."
  $escapedUrl = $DatabaseUrl.Replace("\", "\\").Replace("'", "\'")
  $TestPy = @"
import sys
try:
    import psycopg2
    conn = psycopg2.connect('$escapedUrl')
    conn.close()
    print('OK')
except Exception as e:
    print('FAIL:', e)
    sys.exit(1)
"@
  $TestFile = Join-Path $env:TEMP "ppmp-db-test.py"
  Set-Content -Path $TestFile -Value $TestPy -Encoding UTF8
  & $Python $TestFile
  if ($LASTEXITCODE -ne 0) {
    throw "Cannot connect to PostgreSQL with the given DATABASE_URL. Install/create the database first, then re-run setup."
  }
  Write-Host "Database connection OK."
}

# --- WinSW XML ---
$xml = Get-Content $WinSwTpl -Raw
$xml = $xml.Replace("{{INSTALL_DIR}}", $InstallDir)
$xml = $xml.Replace("{{PORT}}", "$Port")
$xml = $xml.Replace("{{PYTHON}}", $Python)
$xml = $xml.Replace("{{RCLONE}}", $Rclone)
Set-Content -Path $WinSwXml -Value $xml -Encoding UTF8
Write-Host "Wrote $WinSwXml"

if ($SkipService) {
  Write-Host "SkipService set - not installing Windows service."
  exit 0
}

# Stop/uninstall previous service if present
Push-Location (Join-Path $InstallDir "tools\winsw")
try {
  & .\PPMP-API.exe stop 2>$null
  & .\PPMP-API.exe uninstall 2>$null

  Write-Host "Installing PPMP-API Windows service..."
  & .\PPMP-API.exe install
  if ($LASTEXITCODE -ne 0) { throw "WinSW install failed (exit $LASTEXITCODE). Run setup as Administrator." }

  Write-Host "Starting PPMP-API service..."
  & .\PPMP-API.exe start
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Service installed but start returned $LASTEXITCODE. Check logs under $Logs"
  } else {
    Write-Host "PPMP-API service is running on port $Port."
  }
} finally {
  Pop-Location
}

Write-Host "Configuration complete."
