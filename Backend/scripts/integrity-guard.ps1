param(
  [ValidateSet('verify', 'dev', 'watch')]
  [string]$Mode = 'verify'
)

$ErrorActionPreference = 'Stop'
$PackageRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $PackageRoot
$RepoSecurityScript = Join-Path $RepoRoot 'scripts\repo-security-guard.ps1'
$VerifyTargets = @('package.json', 'package-lock.json', 'server.js', 'src', 'scripts')
$StartupTargets = @('package.json', 'package-lock.json', 'scripts/integrity-guard.ps1')
$RuntimeProtectedFiles = @('package.json', 'package-lock.json', 'server.js', 'scripts/integrity-guard.ps1')

function Invoke-RepoSecurityPreflight {
  & $RepoSecurityScript -Mode preflight -Scope Backend
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Get-DirtyEntries {
  param([string[]]$Targets)

  Push-Location $PackageRoot
  try {
    $output = git status --porcelain -- @Targets
    if (-not $output) {
      return @()
    }

    return @($output | Where-Object { $_ -and $_.Trim() })
  } finally {
    Pop-Location
  }
}

function Assert-Clean {
  param(
    [string[]]$Targets,
    [string]$Label
  )

  $dirtyEntries = Get-DirtyEntries -Targets $Targets
  if ($dirtyEntries.Count -gt 0) {
    Write-Host ""
    Write-Host "[Integrity Guard] Refusing to continue because tracked $Label files are already modified:" -ForegroundColor Red
    $dirtyEntries | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Review the diff before continuing." -ForegroundColor Red
    exit 1
  }
}

function Get-FileMap {
  param([string[]]$Targets)

  $map = @{}

  foreach ($target in $Targets) {
    $absoluteTarget = Join-Path $PackageRoot $target

    if (Test-Path $absoluteTarget -PathType Leaf) {
      $item = Get-Item $absoluteTarget
      $map[$item.FullName.ToLowerInvariant()] = $item.FullName
      continue
    }

    if (Test-Path $absoluteTarget -PathType Container) {
      Get-ChildItem $absoluteTarget -File -Recurse | ForEach-Object {
        $map[$_.FullName.ToLowerInvariant()] = $_.FullName
      }
    }
  }

  return $map
}

function Get-HashSnapshot {
  param([hashtable]$FileMap)

  $snapshot = @{}
  foreach ($file in $FileMap.Values) {
    if (Test-Path $file -PathType Leaf) {
      $snapshot[$file.ToLowerInvariant()] = (Get-FileHash $file -Algorithm SHA256).Hash
    }
  }

  return $snapshot
}

function Start-IntegrityWatcher {
  param(
    [string[]]$Targets,
    [scriptblock]$OnDrift
  )

  $fileMap = Get-FileMap -Targets $Targets
  $snapshot = Get-HashSnapshot -FileMap $fileMap

  $watcher = New-Object System.IO.FileSystemWatcher
  $watcher.Path = $PackageRoot
  $watcher.IncludeSubdirectories = $true
  $watcher.EnableRaisingEvents = $true

  $action = {
    $changedPath = $Event.SourceEventArgs.FullPath
    $key = $changedPath.ToLowerInvariant()

    if (-not $snapshot.ContainsKey($key)) {
      return
    }

    if (-not (Test-Path $changedPath -PathType Leaf)) {
      & $OnDrift $changedPath
      return
    }

    $currentHash = (Get-FileHash $changedPath -Algorithm SHA256).Hash
    if ($snapshot[$key] -ne $currentHash) {
      & $OnDrift $changedPath
    }
  }

  $registrations = @(
    Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action,
    Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action,
    Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $action,
    Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action
  )

  return @{
    Watcher = $watcher
    Registrations = $registrations
  }
}

function Stop-IntegrityWatcher {
  param($State)

  if (-not $State) {
    return
  }

  foreach ($registration in $State.Registrations) {
    Unregister-Event -SourceIdentifier $registration.Name -ErrorAction SilentlyContinue
    Remove-Job -Id $registration.Id -Force -ErrorAction SilentlyContinue
  }

  $State.Watcher.Dispose()
}

function Start-GuardedProcess {
  param(
    [string]$Executable,
    [string[]]$Arguments,
    [string[]]$ProtectedTargets,
    [string]$DisplayName
  )

  Invoke-RepoSecurityPreflight
  Assert-Clean -Targets $StartupTargets -Label 'backend startup-critical'

  $driftDetected = $false
  $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $PackageRoot -NoNewWindow -PassThru
  $watchState = Start-IntegrityWatcher -Targets $ProtectedTargets -OnDrift {
    param($Path)
    if ($driftDetected) {
      return
    }

    $driftDetected = $true
    Write-Host ""
    Write-Host "[Integrity Guard] Protected file changed while $DisplayName was running: $Path" -ForegroundColor Red
    Write-Host "[Integrity Guard] Stopping the process so the change can be reviewed." -ForegroundColor Red
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
    }
  }

  try {
    while (-not $process.HasExited) {
      Start-Sleep -Milliseconds 300
    }
  } finally {
    Stop-IntegrityWatcher -State $watchState
  }

  if ($driftDetected) {
    exit 1
  }

  exit $process.ExitCode
}

switch ($Mode) {
  'verify' {
    Invoke-RepoSecurityPreflight
    Assert-Clean -Targets $VerifyTargets -Label 'backend'
    Write-Host '[Integrity Guard] Backend tracked files match Git.' -ForegroundColor Green
  }
  'dev' {
    Start-GuardedProcess -Executable 'node' -Arguments @('.\node_modules\nodemon\bin\nodemon.js', '--config', 'nodemon.json', 'server.js') -ProtectedTargets $RuntimeProtectedFiles -DisplayName 'nodemon'
  }
  'watch' {
    Assert-Clean -Targets $VerifyTargets -Label 'backend'
    $watchState = Start-IntegrityWatcher -Targets $VerifyTargets -OnDrift {
      param($Path)
      Write-Host ""
      Write-Host "[Integrity Guard] Tracked backend file drift detected: $Path" -ForegroundColor Red
    }

    Write-Host '[Integrity Guard] Watching tracked backend files. Press Ctrl+C to stop.' -ForegroundColor Green
    try {
      while ($true) {
        Start-Sleep -Seconds 1
      }
    } finally {
      Stop-IntegrityWatcher -State $watchState
    }
  }
}
