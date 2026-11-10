param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$previewUrl = 'http://127.0.0.1:5180/'

function Test-OutpostPreview {
  try {
    $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match 'old-web-outpost'
  } catch { return $false }
}

if (-not (Test-OutpostPreview)) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { $null }
  if (-not $nodeExecutable) {
    $candidates = @(
      'C:\Program Files\nodejs\node.exe',
      'C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1104-2876-0_26.1104.2876.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe'
    )
    $nodeExecutable = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
  if (-not $nodeExecutable) { throw 'Node.js was not found. Install Node.js 22.12+ and run this launcher again.' }
  $viteEntry = Join-Path $projectDir 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path -LiteralPath $viteEntry)) { throw 'Dependencies are missing. Run npm install in this folder first.' }
  $stdoutPath = Join-Path $projectDir 'preview-output.log'
  $stderrPath = Join-Path $projectDir 'preview-error.log'
  $process = Start-Process -FilePath $nodeExecutable -ArgumentList @(('"' + $viteEntry + '"'), '--host', '127.0.0.1', '--port', '5180', '--strictPort') -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
  $process.Id | Set-Content -LiteralPath (Join-Path $projectDir '.server-pid')
  $running = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    if (Test-OutpostPreview) { $running = $true; break }
    if ($process.HasExited) { break }
  }
  if (-not $running) {
    if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Tail 12 }
    throw 'Preview did not start. Check preview-error.log; port 5180 may already be in use.'
  }
}
Write-Host "Old Web Outpost is ready: $previewUrl"
if (-not $NoBrowser) { Start-Process $previewUrl }
