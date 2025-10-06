# Stage 7 — Scanners

## Endpoints
- POST `/enqueue/scan/secret` body: `{ "repo": "https://github.com/owner/repo", "ref": "main" }`
- POST `/enqueue/scan/osv`    body: `{ "repo": "https://github.com/owner/repo", "ref": "main" }`
- GET  `/job/:id`              → `{ id, state, returnvalue }`
- GET  `/health`
- GET  `/metrics`

## Notes
- `gitleaks` CLI yoksa secret taraması `skipped` olarak işaretlenir ve `repoguardian_scan_total{type='secret',status='skipped'}` artar.
- OSV/secret job'ları BullMQ ile kuyruğa alınır; metrikler Prometheus formatında yayınlanır:
  - `repoguardian_scan_total{type, status}`
  - `repoguardian_scan_duration_seconds{type}`
  - `repoguardian_queue_depth{queue}`
- Dual-mode API: Secret için `repoPath` (lokal) veya `repo` (URL) kullanabilirsiniz.
- OSV için `packages` array'i (direkt API) veya `repo`/`repoPath` (package.json'dan çıkar) kullanabilirsiniz.

## Quickstart (local)
1. Redis'i çalıştırın: `docker compose up -d redis`
2. Worker'ı başlatın:
   - `pnpm -C worker install`
   - `REDIS_URL=redis://localhost:6379 WORKER_PORT=4000 pnpm -C worker dev`
3. Health: `curl -s http://localhost:4000/health`
4. Secret enqueue (lokal yol):
   - `curl -s -X POST http://localhost:4000/enqueue/scan/secret -H 'content-type: application/json' -d '{"repoPath":"."}'`
5. Secret enqueue (URL):
   - `curl -s -X POST http://localhost:4000/enqueue/scan/secret -H 'content-type: application/json' -d '{"repo":"https://github.com/git/git"}'`
6. OSV enqueue (packages):
   - `curl -s -X POST http://localhost:4000/enqueue/scan/osv -H 'content-type: application/json' -d '{"packages":[{"package":{"ecosystem":"npm","name":"next"},"version":"14.2.10"}]}'`
7. OSV enqueue (URL → package.json'dan çıkar):
   - `curl -s -X POST http://localhost:4000/enqueue/scan/osv -H 'content-type: application/json' -d '{"repo":"https://github.com/vercel/next.js"}'`
8. Job takibi:
   - `curl -s http://localhost:4000/job/<ID>`
9. Metrikler: `curl -s http://localhost:4000/metrics`


