<#
.SYNOPSIS
  Compile Inno Setup installer after prepare-runtime.ps1 has staged installer\payload.
#>
[CmdletBinding()]
param(
  [string]$IsccPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Iss = Join-Path $RepoRoot "installer\ppmp-setup.iss"
$Payload = Join-Path $RepoRoot "installer\payload"

if (-not (Test-Path (Join-Path $Payload "runtime\python\python.exe"))) {
  throw "Payload incomplete. Run installer\scripts\prepare-runtime.ps1 first."
}
if (-not (Test-Path (Join-Path $Payload "ui"))) {
  Write-Warning "installer\payload\ui missing - Electron UI will not be in the Setup. Re-run prepare-runtime without -SkipElectron."
}

$candidates = @(
  $IsccPath,
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  "ISCC.exe"
) | Where-Object { $_ -and $_.Trim() -ne "" }

$iscc = $null
foreach ($c in $candidates) {
  if ($c -eq "ISCC.exe") {
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source; break }
  } elseif (Test-Path $c) {
    $iscc = $c
    break
  }
}

if (-not $iscc) {
  throw "Inno Setup ISCC.exe not found. Install Inno Setup 6 or pass -IsccPath."
}

Write-Host "Compiling with $iscc"
& $iscc $Iss
if ($LASTEXITCODE -ne 0) { throw "ISCC failed with exit $LASTEXITCODE" }

$Out = Join-Path $RepoRoot "dist-installer\PPMP-System-Setup.exe"
if (Test-Path $Out) {
  Write-Host "Built: $Out"
} else {
  Write-Warning "Compile finished but $Out not found."
}
