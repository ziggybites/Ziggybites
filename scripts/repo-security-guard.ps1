param(
  [ValidateSet('preflight', 'scan', 'process-audit', 'process-block')]
  [string]$Mode = 'preflight',

  [ValidateSet('Repo', 'Frontend', 'Backend')]
  [string]$Scope = 'Repo'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ScopePath = switch ($Scope) {
  'Frontend' { Join-Path $RepoRoot 'Frontend' }
  'Backend' { Join-Path $RepoRoot 'Backend' }
  default { $RepoRoot }
}

$InterpreterNames = @(
  'node.exe', 'node',
  'npm.exe', 'npm', 'npm.cmd',
  'npx.exe', 'npx', 'npx.cmd',
  'powershell.exe', 'pwsh.exe',
  'cmd.exe', 'wscript.exe', 'cscript.exe',
  'bash.exe', 'sh.exe'
)

$HighRiskPatterns = @(
  'modernize(\_v\d+)?\.js',
  'replace(_delivery)?_colors\.js',
  'refactor\.cjs',
  'trim_data\.(js|cjs)',
  'postinstall',
  'preinstall',
  'prepare',
  'invoke-expression',
  'downloadstring',
  'frombase64string',
  'encodedcommand',
  'executionpolicy\s+bypass'
)

$AllowPatterns = @(
  'node_modules\\vite\\bin\\vite\.js',
  'node_modules\\nodemon\\bin\\nodemon\.js',
  'server\.js',
  'src\\queues\\workers\\',
  'scripts\\integrity-guard\.ps1',
  'scripts\\repo-security-guard\.ps1',
  'npm(\.cmd)?\s+run\s+(dev|dev:unsafe|integrity:check|integrity:watch|security:scan|security:audit|security:block|start|test)',
  'git(\.exe)?\s+',
  'package\.json'
)

function Test-DefenderAvailable {
  return [bool](Get-Command Start-MpScan -ErrorAction SilentlyContinue)
}

function Get-DefenderStatusSummary {
  if (-not (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue)) {
    return $null
  }

  try {
    return Get-MpComputerStatus
  } catch {
    return $null
  }
}

function Get-ExcludedProcessIds {
  $excluded = New-Object System.Collections.Generic.HashSet[int]
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction SilentlyContinue

  while ($current) {
    [void]$excluded.Add([int]$current.ProcessId)
    if (-not $current.ParentProcessId -or $current.ParentProcessId -le 0) {
      break
    }
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($current.ParentProcessId)" -ErrorAction SilentlyContinue
  }

  return $excluded
}

function Test-IsRepoProcess {
  param($Process)

  if (-not $Process.CommandLine) {
    return $false
  }

  return $Process.CommandLine.ToLowerInvariant().Contains($ScopePath.ToLowerInvariant())
}

function Test-IsInterpreterHost {
  param($Process)

  return $InterpreterNames -contains $Process.Name.ToLowerInvariant()
}

function Test-MatchesAnyPattern {
  param(
    [string]$Value,
    [string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    if ($Value -match $pattern) {
      return $true
    }
  }

  return $false
}

function Get-SuspiciousRepoProcesses {
  $excluded = Get-ExcludedProcessIds
  $candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -and
    -not $excluded.Contains([int]$_.ProcessId) -and
    (Test-IsRepoProcess $_) -and
    (Test-IsInterpreterHost $_)
  }

  $suspicious = foreach ($process in $candidates) {
    $commandLine = $process.CommandLine
    $isHighRisk = Test-MatchesAnyPattern -Value $commandLine -Patterns $HighRiskPatterns
    $isAllowed = Test-MatchesAnyPattern -Value $commandLine -Patterns $AllowPatterns

    if ($isHighRisk -or -not $isAllowed) {
      [pscustomobject]@{
        ProcessId = [int]$process.ProcessId
        ParentProcessId = [int]$process.ParentProcessId
        Name = $process.Name
        ExecutablePath = $process.ExecutablePath
        CommandLine = $commandLine
        Reason = if ($isHighRisk) { 'Matched high-risk script or behavior pattern' } else { 'Repo-related interpreter process is not allowlisted' }
      }
    }
  }

  return @($suspicious | Sort-Object ProcessId -Unique)
}

function Show-SuspiciousProcesses {
  param([object[]]$Processes)

  if (-not $Processes -or $Processes.Count -eq 0) {
    Write-Host "[Security Guard] No suspicious repo-related interpreter processes found for $Scope." -ForegroundColor Green
    return
  }

    Write-Host "[Security Guard] Suspicious repo-related processes found for ${Scope}:" -ForegroundColor Red
  foreach ($process in $Processes) {
    Write-Host ""
    Write-Host "PID: $($process.ProcessId)  Name: $($process.Name)" -ForegroundColor Yellow
    Write-Host "Reason: $($process.Reason)"
    Write-Host "Command: $($process.CommandLine)"
  }
}

function Invoke-ProcessAudit {
  $suspicious = Get-SuspiciousRepoProcesses
  Show-SuspiciousProcesses -Processes $suspicious
  if ($suspicious.Count -gt 0) {
    exit 1
  }
}

function Invoke-ProcessBlock {
  $suspicious = Get-SuspiciousRepoProcesses
  Show-SuspiciousProcesses -Processes $suspicious

  if ($suspicious.Count -eq 0) {
    return
  }

  foreach ($process in $suspicious) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      Write-Host "[Security Guard] Stopped PID $($process.ProcessId) ($($process.Name))." -ForegroundColor Green
    } catch {
      Write-Host "[Security Guard] Failed to stop PID $($process.ProcessId): $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

function Invoke-DefenderScan {
  if (-not (Test-DefenderAvailable)) {
    Write-Host '[Security Guard] Windows Defender scan command is not available on this system.' -ForegroundColor Red
    exit 1
  }

  $status = Get-DefenderStatusSummary
  if ($status -and -not $status.AntivirusEnabled) {
    Write-Host '[Security Guard] Windows Defender Antivirus is disabled. Scan could not be trusted.' -ForegroundColor Red
    exit 1
  }

  Write-Host "[Security Guard] Starting Windows Defender custom scan for $ScopePath" -ForegroundColor Yellow
  Start-MpScan -ScanType CustomScan -ScanPath $ScopePath
  Write-Host '[Security Guard] Defender scan command submitted.' -ForegroundColor Green
}

function Invoke-Preflight {
  $status = Get-DefenderStatusSummary
  if ($status -and -not $status.AntivirusEnabled) {
    Write-Host '[Security Guard] Warning: Windows Defender Antivirus appears to be disabled.' -ForegroundColor Yellow
  }

  $suspicious = Get-SuspiciousRepoProcesses
  Show-SuspiciousProcesses -Processes $suspicious
  if ($suspicious.Count -gt 0) {
    Write-Host ''
    Write-Host "[Security Guard] Dev startup blocked. Review or run the process blocker before continuing." -ForegroundColor Red
    exit 1
  }
}

switch ($Mode) {
  'preflight' { Invoke-Preflight }
  'scan' { Invoke-DefenderScan }
  'process-audit' { Invoke-ProcessAudit }
  'process-block' { Invoke-ProcessBlock }
}
