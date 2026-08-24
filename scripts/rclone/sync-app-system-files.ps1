# Sync extracted APP SYSTEM FILES package to Google Drive via rclone (personal Gmail OK).
#
# Prerequisites:
#   1. Install rclone: https://rclone.org/downloads/
#   2. rclone config  → remote name "gdrive" → Google Drive → sign in as folder owner
#   3. BAC Admin → Download for rclone → extract ZIP
#
# Usage:
#   .\sync-app-system-files.ps1 -Source "C:\path\to\extracted\2027"
#   .\sync-app-system-files.ps1 -Source "C:\path\to\extracted\2027" -FiscalYear 2027 -Remote gdrive

param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [string]$FiscalYear = "",

    [string]$Remote = "gdrive",

    [string]$DriveRoot = "APP SYSTEM FILES"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    throw "rclone not found in PATH. Install from https://rclone.org/downloads/"
}

$src = (Resolve-Path -LiteralPath $Source).Path
if (-not (Test-Path -LiteralPath $src -PathType Container)) {
    throw "Source folder not found: $src"
}

if ([string]::IsNullOrWhiteSpace($FiscalYear)) {
    $FiscalYear = Split-Path -Leaf $src
}

$dest = "${Remote}:${DriveRoot}/${FiscalYear}"

Write-Host "Syncing:"
Write-Host "  FROM: $src"
Write-Host "  TO:   $dest"
Write-Host ""

& rclone sync $src $dest --progress --create-empty-src-dirs
if ($LASTEXITCODE -ne 0) {
    throw "rclone sync failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "Done. Check Drive: $DriveRoot / $FiscalYear / PPMP / {office}"
