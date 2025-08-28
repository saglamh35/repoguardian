# Stage 5 — CI Smoke & Dev Bootstrap
## Goals
- Env templates (.env.example, web/.env.local.sample)
- One-liner local dev (scripts/dev.ps1 & dev.sh)
- GitHub Actions smoke: Postgres+Redis, Next build/start, /api/health 200
## Checklist
- [ ] Env templates
- [ ] Dev scripts
- [ ] smoke.yml green on PR
- [ ] README note
## Validation
- Local: ./scripts/dev.ps1 → http://localhost:3000/api/health = 200
- CI: Smoke workflow green on PR
