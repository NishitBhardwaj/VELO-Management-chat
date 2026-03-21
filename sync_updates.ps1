$ErrorActionPreference = "Continue"

Write-Host "📥 Pulling latest changes from the repository..."
git pull origin main

Write-Host "📦 Installing any new dependencies..."
# Using the install_all script we made earlier
powershell -ExecutionPolicy Bypass -File .\install_all.ps1

Write-Host "🔄 Restarting the local services..."
# We first need to kill any existing Node processes running the services
# Note: This will kill all node processes. If you have other node apps running, 
# you might want to stop them manually instead.
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

powershell -ExecutionPolicy Bypass -File .\start_all.ps1

Write-Host "✅ System synced, updated, and restarted!"
