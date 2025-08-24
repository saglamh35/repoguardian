# RepoGuardian Worker - Stage 4 Implementation Runbook

## Overview
This runbook covers the implementation of secret scanning (gitleaks) and SBOM generation (syft) for the RepoGuardian worker service.

## Prerequisites
- Docker Desktop running
- PostgreSQL running (via docker-compose)
- Redis running (via docker-compose)
- Git installed and accessible from command line
- Node.js 18+ and pnpm installed

## Environment Setup

### 1. Start Infrastructure Services
```bash
# From project root
docker-compose up -d postgres redis
```

### 2. Verify Services
```bash
# Check if services are running
docker ps
# Should show:
# - rg-postgres (port 5432)
# - rg-redis (port 6379)
```

### 3. Worker Environment
The worker `.env` file is already configured with:
```
REDIS_URL=redis://localhost:6379
QUEUE_NAME=repoguard-jobs
DATABASE_URL=postgresql://repoguard:repoguard@localhost:5432/repoguard?schema=public
```

## Implementation Components

### Core Modules
- `src/prisma.ts` - Prisma client singleton
- `src/github.ts` - GitHub token and repo info helpers
- `src/git-clone.ts` - Repository cloning to temp directories
- `src/scanners/gitleaks.ts` - Secret scanning via Docker
- `src/scanners/syft.ts` - SBOM generation via Docker
- `src/persist.ts` - Database persistence for findings and SBOMs
- `src/index.ts` - Main worker with job handlers

### Scanner Details

#### Gitleaks (Secrets)
- **Docker Image**: `zricethezav/gitleaks:latest`
- **Command**: `docker run --rm -v <repo>:/repo -v <tmp>:/out zricethezav/gitleaks:latest detect -s /repo -f json -r /out/gitleaks.json`
- **Output**: JSON findings with rule IDs, descriptions, file paths, line numbers
- **DB Storage**: `Finding` table with `kind: "SECRET"`

#### Syft (SBOM)
- **Docker Image**: `anchore/syft:latest`
- **Command**: `docker run --rm -v <repo>:/src -v <tmp>:/out anchore/syft:latest dir:/src -o cyclonedx-json=/out/sbom.json`
- **Output**: CycloneDX JSON format
- **DB Storage**: `Sbom` table with `format: "cyclonedx-json"`

## Testing Workflow

### 1. Start Worker
```bash
cd worker
pnpm dev
```

Expected output:
```
[worker] booting queue=repoguard-jobs redis=redis://localhost:6379
```

### 2. Test from Web UI
1. Open web app: `http://localhost:3000`
2. Sign in with GitHub
3. Navigate to `/repos` page
4. Click **Secrets** button on any repository
5. Click **SBOM** button on any repository

### 3. Monitor Worker Logs
Expected log sequence for secrets scan:
```
[worker] active scan:secrets <job-id>
[worker] scanning secrets for repo <github-id>
[worker] secrets scan completed: <count> findings
[worker] completed scan:secrets <job-id>
```

Expected log sequence for SBOM scan:
```
[worker] active scan:sbom <job-id>
[worker] generating SBOM for repo <github-id>
[worker] SBOM generation completed: <sbom-id>
[worker] completed scan:sbom <job-id>
```

## Verification

### Database Verification
Use Prisma Studio to verify data:
```bash
cd web
pnpm prisma studio
```

Check:
- `Finding` table for secret scan results
- `Sbom` table for SBOM records
- `ScanJob` table for job status tracking

### Docker Verification
Check if Docker containers are created and cleaned up:
```bash
docker ps -a
# Should show no long-running containers (--rm flag ensures cleanup)
```

## Troubleshooting

### Common Issues

#### 1. Git Clone Failures
- **Symptom**: Worker fails with git clone errors
- **Cause**: GitHub token expired or insufficient permissions
- **Solution**: Re-authenticate in web app, ensure `repo` scope

#### 2. Docker Volume Mount Issues
- **Symptom**: Scanner containers fail to access mounted volumes
- **Cause**: Windows path formatting issues
- **Solution**: Ensure absolute paths in volume mounts, use forward slashes

#### 3. Prisma Connection Issues
- **Symptom**: Database connection errors
- **Cause**: PostgreSQL not running or wrong connection string
- **Solution**: Verify docker-compose services, check DATABASE_URL

#### 4. Redis Connection Issues
- **Symptom**: Queue connection failures
- **Cause**: Redis not running or wrong URL
- **Solution**: Verify Redis container status, check REDIS_URL

### Debug Commands
```bash
# Check Docker containers
docker ps -a

# Check Redis connection
docker exec -it rg-redis redis-cli ping

# Check PostgreSQL connection
docker exec -it rg-postgres psql -U repoguard -d repoguard -c "SELECT 1"

# View worker logs
cd worker && pnpm dev
```

## Performance Notes
- **Concurrency**: Worker runs with concurrency: 2 to avoid overwhelming Docker
- **Temp Cleanup**: Temporary directories are automatically cleaned up
- **Docker Images**: First run will download gitleaks and syft images (~200MB total)

## Next Steps (Stage 5)
- Implement vulnerability scanning using OSV database
- Add scan result caching
- Implement scan scheduling and webhooks
- Add scan result visualization in web UI
