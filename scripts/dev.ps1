param([switch]$Rebuild)
Write-Host ">> Bringing up infra (Postgres/Redis) with Docker Compose..."
if ($Rebuild) { docker compose up -d --build } else { docker compose up -d }
Write-Host ">> Installing web dependencies..."
pnpm -C web install
Write-Host ">> Ensuring web/.env.local exists..."
if (-not (Test-Path "web/.env.local")) {
  Copy-Item "web/.env.local.sample" "web/.env.local"
  Write-Host "   Created web/.env.local from sample."
}
Write-Host ">> Starting Next.js dev server..."
pnpm -C web dev
