$ErrorActionPreference = "Continue"

# Refresh Path to ensure Node/npm is available
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:CI = "true"

# Optionally install pnpm globally if needed, bypassing ExecutionPolicy
cmd.exe /c "npm install -g pnpm"

$apps = Get-ChildItem -Path "apps" -Directory
foreach ($app in $apps) {
    Write-Host "Installing dependencies in $($app.FullName)..."
    Set-Location -Path $app.FullName
    # Use cmd.exe /c to avoid ps1 execution policy errors
    cmd.exe /c "npx -y pnpm install --no-frozen-lockfile"
}

Set-Location -Path "e:\Baba\VELO-Management-chat"
Write-Host "✅ All dependencies installed successfully!"
