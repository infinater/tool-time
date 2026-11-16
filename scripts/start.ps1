param(
  [ValidateSet("dev", "desktop", "build")]
  [string]$Mode
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor DarkGray }

# ---------- 1. Rust（只给桌面版/打包用） ----------
function Ensure-Rust {
  $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
  if (Test-Path $cargoBin) { $env:Path = "$cargoBin;$env:Path" }
  if (Get-Command cargo -ErrorAction SilentlyContinue) { return }

  Write-Step "没检测到 Rust，正在安装（走 rsproxy 国内镜像，约 3-5 分钟）"
  $env:RUSTUP_DIST_SERVER = "https://rsproxy.cn"
  $env:RUSTUP_UPDATE_ROOT = "https://rsproxy.cn/rustup"
  $tmp = Join-Path $env:TEMP "rustup-init.exe"
  Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $tmp -UseBasicParsing
  & $tmp -y --default-toolchain stable-x86_64-pc-windows-msvc --profile minimal
  $env:Path = "$cargoBin;$env:Path"
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Rust 安装失败。手动装一次：https://rustup.rs/"
  }
  & rustc -V
}

# ---------- 2. pnpm ----------
function Get-PnpmArgs {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { return @("pnpm") }
  if (Get-Command corepack -ErrorAction SilentlyContinue) { return @("corepack", "pnpm") }
  $bundled = Join-Path $env:USERPROFILE ".dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
  if (Test-Path $bundled) { return @("node", $bundled) }
  throw "找不到 pnpm。请先执行：npm i -g pnpm"
}

function Invoke-Pnpm {
  $p = Get-PnpmArgs
  $exe = $p[0]
  $pre = @()
  if ($p.Length -gt 1) { $pre = $p[1..($p.Length - 1)] }
  & $exe @pre @args
  if ($LASTEXITCODE -ne 0) { throw "命令失败：$exe $($pre -join ' ') $($args -join ' ')" }
}

# ---------- 3. 依赖 ----------
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Step "首次安装前端依赖"
  Invoke-Pnpm install
}

# ---------- 4. 选择模式 ----------
if (-not $Mode) {
  Write-Host ""
  Write-Host "  番茄日历 · 启动器" -ForegroundColor White
  Write-Host "  ------------------------------------" -ForegroundColor DarkGray
  Write-Host "  1) 浏览器版（秒开，不需要 Rust）"
  Write-Host "  2) 桌面窗口版（首次要编译 Rust，约 3-8 分钟）"
  Write-Host "  3) 打包 Windows 安装程序（NSIS）"
  Write-Host "  ------------------------------------" -ForegroundColor DarkGray
  $choice = Read-Host "  输入 1 / 2 / 3，回车确认"
  $Mode = switch ($choice.Trim()) { "1" { "dev" } "2" { "desktop" } "3" { "build" } default { "dev" } }
}

switch ($Mode) {
  "dev" {
    Write-Step "启动浏览器版：http://localhost:5183 （Ctrl+C 退出）"
    Write-Ok "如果 5183 被占用，先关掉旧的 dev 窗口"
    Invoke-Pnpm dev
  }
  "desktop" {
    Ensure-Rust
    Write-Step "启动桌面版（首次编译 Rust 依赖，耐心等 3-8 分钟）"
    Write-Ok "编译完成后会弹出「番茄日历」窗口"
    Invoke-Pnpm tauri dev
  }
  "build" {
    Ensure-Rust
    Write-Step "打包安装程序（首次同样要编译 Rust，时间更久）"
    Invoke-Pnpm tauri build
    Write-Ok "产物：src-tauri\target\release\bundle\nsis\*.exe"
  }
}
