# 强制使用 Node 20 运行项目
# 该脚本通过临时修改当前会话的环境变量 Path，将 Node 20 的路径置于最前
# 从而确保 npm run dev 使用 Node 20 运行，而不影响全局 Node 版本

$nvmPath = "$env:LOCALAPPDATA\nvm"
$targetVersion = "v20.19.5"
$nodePath = Join-Path $nvmPath $targetVersion

if (Test-Path $nodePath) {
    Write-Host "Found Node $targetVersion at $nodePath" -ForegroundColor Green
    
    # 将 Node 20 路径添加到 Path 环境变量的最前面
    $env:Path = "$nodePath;" + $env:Path
    
    Write-Host "Current Node version:" -ForegroundColor Cyan
    node -v
    
    Write-Host "Starting development server..." -ForegroundColor Cyan
    npm run dev
} else {
    Write-Error "Node $targetVersion path not found at $nodePath."
    Write-Warning "Please ensure Node 20 is installed via nvm (nvm install 20) or update the path in this script."
}
