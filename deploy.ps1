# ============================================================
# 🌙 NYX MESSENGER — DEPLOY SCRIPT
# ============================================================
# Использование: .\deploy.ps1 "Описание изменений"
# ============================================================

param(
    [string]$Message = "feat: update nyx messenger"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host ""
Write-Host "  🌙 NYX DEPLOY" -ForegroundColor Magenta
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── 1. Build client ──────────────────────────────────────────
Write-Host "  📦 Building client..." -ForegroundColor Cyan
Set-Location "$ProjectDir\client"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Client build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Client built" -ForegroundColor Green

# ── 2. Build server ──────────────────────────────────────────
Write-Host "  📦 Building server..." -ForegroundColor Cyan
Set-Location "$ProjectDir\server"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Server build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Server built" -ForegroundColor Green

# ── 3. Git commit & push ──────────────────────────────────────
Set-Location $ProjectDir
Write-Host "  🚀 Deploying to Railway..." -ForegroundColor Cyan

git add -A
git commit -m "$Message"
git push

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Push failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  ✨ DEPLOYED! Railway will build in ~2 min" -ForegroundColor Green
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
