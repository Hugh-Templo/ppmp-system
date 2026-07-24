<#
.SYNOPSIS
  Stop and remove the PPMP-API Windows service (used by Inno uninstall).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Continue"
$InstallDir = $InstallDir.TrimEnd('\')
$WinSwDir = Join-Path $InstallDir "tools\winsw"
$WinSwExe = Join-Path $WinSwDir "PPMP-API.exe"

if (Test-Path $WinSwExe) {
  Push-Location $WinSwDir
  try {
    Write-Host "Stopping PPMP-API service..."
    & .\PPMP-API.exe stop
    Write-Host "Uninstalling PPMP-API service..."
    & .\PPMP-API.exe uninstall
  } finally {
    Pop-Location
  }
} else {
  Write-Host "WinSW not found at $WinSwExe - nothing to uninstall."
}

$ProgData = Join-Path $env:ProgramData "PPMP System"
if (Test-Path $ProgData) {
  Remove-Item $ProgData -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "PPMP-API service cleanup done."
