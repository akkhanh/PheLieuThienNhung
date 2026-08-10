[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$OutputDirectory = "./backups",

  [Parameter(Mandatory = $false)]
  [switch]$RunBackup,

  [Parameter(Mandatory = $false)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"

function Resolve-SafeDirectory {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
  return $fullPath
}

function Get-DatabaseUrl {
  param([string]$ExplicitUrl)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitUrl)) {
    return $ExplicitUrl
  }

  $envUrl = $env:DATABASE_URL
  if (-not [string]::IsNullOrWhiteSpace($envUrl)) {
    return $envUrl
  }

  return "postgresql://postgres:postgres@localhost:5432/phe_lieu"
}

function Get-PgDumpCommand {
  $command = Get-Command pg_dump -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  $commonPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
  )

  foreach ($candidate in $commonPaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "pg_dump was not found. Install PostgreSQL client tools or add pg_dump to PATH."
}

$resolvedOutput = Resolve-SafeDirectory -Path $OutputDirectory
$resolvedDatabaseUrl = Get-DatabaseUrl -ExplicitUrl $DatabaseUrl
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $resolvedOutput "phe_lieu_$timestamp.dump"

Write-Host "Output directory: $resolvedOutput"
Write-Host "Backup file:      $backupFile"
Write-Host "Database source:   $resolvedDatabaseUrl"
Write-Host ""

if (-not $RunBackup.IsPresent) {
  Write-Host "Dry run only. No backup was created."
  Write-Host "Run again with -RunBackup to execute pg_dump."
  Write-Host "Example:"
  Write-Host "  .\backend\backup-postgres.ps1 -RunBackup"
  Write-Host "  .\backend\backup-postgres.ps1 -RunBackup -OutputDirectory .\backups"
  Write-Host "  .\backend\backup-postgres.ps1 -RunBackup -DatabaseUrl 'postgresql://...'"
  return
}

$pgDump = Get-PgDumpCommand
$arguments = @(
  "--format=custom"
  "--no-owner"
  "--file=$backupFile"
  $resolvedDatabaseUrl
)

& $pgDump @arguments
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Host "Backup created successfully: $backupFile"
