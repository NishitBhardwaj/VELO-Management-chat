$ErrorActionPreference = "Continue"

# Refresh Path to ensure Node/npm is available
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:CI = "true"

Write-Host "Starting backend services..."
$apps = Get-ChildItem -Path "apps" -Directory | Where-Object { $_.Name -ne "web-client" }
foreach ($app in $apps) {
    Write-Host "Starting $($app.Name)..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx -y pnpm start:dev > run.log 2>&1" -WorkingDirectory $app.FullName -WindowStyle Hidden
}

Write-Host "Starting web client..."
$webClientPath = Join-Path -Path (Get-Location).Path -ChildPath "apps\web-client"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx -y pnpm dev > run.log 2>&1" -WorkingDirectory $webClientPath -WindowStyle Hidden

Write-Host "✅ All services started in the background! Check run.log in each app folder for output."
