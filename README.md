# RepoGuardian

Security hygiene dashboard for GitHub repositories with automated scanning and dependency management.

## Stage 5 Quickstart

For local development, use the provided scripts:

**Windows (PowerShell):**
```powershell
./scripts/dev.ps1
```

**Linux/macOS:**
```bash
./scripts/dev.sh
```

These scripts will:
1. Start Postgres and Redis with Docker Compose
2. Install web dependencies
3. Create environment files from samples
4. Start the Next.js development server

Visit [http://localhost:3000/api/health](http://localhost:3000/api/health) to verify the setup.

## Project Structure

- `web/` - Next.js frontend application
- `worker/` - Background job processor
- `scripts/` - Development and deployment scripts
- `docs/` - Project documentation and stage plans
