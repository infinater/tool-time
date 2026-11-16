param(
  [string]$ExePath = "",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $ExePath) {
  $candidates = @(
    (Join-Path $Root "src-tauri\target\release\tool-time.exe"),
    (Join-Path $Root "src-tauri\target\debug\tool-time.exe")
  )
  $ExePath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
  Write-Host "找不到 tool-time.exe，请先跑一次打包：" -ForegroundColor Yellow
  Write-Host '  powershell -File .\scripts\start.ps1 -Mode build'
  exit 1
}

$exe = (Resolve-Path $ExePath).Path
$name = "番茄日历"

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) $name

$targets = @(
  (Join-Path $desktop "$name.lnk"),
  (Join-Path $startMenu "$name.lnk")
)

$shell = New-Object -ComObject WScript.Shell

if ($Uninstall) {
  foreach ($t in $targets) { if (Test-Path $t) { Remove-Item $t -Force } }
  if (Test-Path $startMenu) { Remove-Item $startMenu -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Host "已删除桌面与开始菜单快捷方式" -ForegroundColor Green
  exit 0
}

foreach ($t in $targets) {
  $dir = Split-Path -Parent $t
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $link = $shell.CreateShortcut($t)
  $link.TargetPath = $exe
  $link.WorkingDirectory = Split-Path -Parent $exe
  $link.IconLocation = "$exe,0"
  $link.Description = "番茄日历：专注、心情、日记"
  $link.Save()
  Write-Host "创建：$t" -ForegroundColor Green
}

Write-Host ""
Write-Host "完成。桌面上双击「$name」即可启动。" -ForegroundColor Cyan
Write-Host "注意：如果这是 debug 版，需要先跑 dev server；release 版可独立运行。" -ForegroundColor DarkGray
