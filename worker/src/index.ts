// @ts-nocheck
import express from "express";
import { Queue, Worker, QueueEvents, JobsOptions, Job } from "bullmq";
import IORedis from "ioredis";
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from "prom-client";
import { gitleaksScan } from "./scanners/gitleaks";
import { osvScan, osvScanPackages } from "./scanners/osv";
import { cloneRepo } from "./lib/git";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const WORKER_PORT = Number(process.env.WORKER_PORT ?? 4000);
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ---- metrics (Stage 7 spec)
collectDefaultMetrics({ register, prefix: "repoguardian_" });
const scanTotal = new Counter({ name: "repoguardian_scan_total", help: "Total scans", labelNames: ["type", "status"] });
const scanDuration = new Histogram({ name: "repoguardian_scan_duration_seconds", help: "Scan duration seconds", labelNames: ["type"], buckets: [0.05, 0.1, 0.3, 1, 3, 10] });
const queueDepth = new Gauge({ name: "repoguardian_queue_depth", help: "Queue depth (waiting+delayed)", labelNames: ["queue"] });

// ---- dummy (stage6)
const queueName = "dummy";
const attempts = 5;
const backoff: JobsOptions["backoff"] = { type: "exponential", delay: 2000 };
const dummyQueue = new Queue(queueName, { connection, defaultJobOptions: { attempts, backoff } });
const events = new QueueEvents(queueName, { connection });
const dummyWorker = new Worker(queueName, async (job: Job) => {
  const start = process.hrtime.bigint();
  if (Math.random() < 0.10) throw new Error("random-failure");
  await new Promise(r => setTimeout(r, 300));
  const durSec = Number(process.hrtime.bigint() - start) / 1e9;
  scanDuration.labels("dummy").observe(durSec);
  return { ok: true, payload: job.data?.payload ?? null };
}, { connection });
events.on("completed", () => scanTotal.labels("dummy", "completed").inc());
events.on("failed", () => scanTotal.labels("dummy", "failed").inc());
async function refreshQueueGauges() {
  const c = await dummyQueue.getJobCounts("active", "waiting", "failed");
  // Stage-7: queue depth = waiting + delayed (approx; we don't include delayed here as Queue.getJobCounts on dummy)
  queueDepth.labels(queueName).set((c.waiting ?? 0));
}
setInterval(refreshQueueGauges, 1000).unref();

// ---- scan (stage7)
const scanQueue = new Queue("scan", { connection, defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: true } });
const scanEvents = new QueueEvents("scan", { connection });
const scanWorker = new Worker("scan", async (job: Job) => {
  const { repoPath, repo, ref, packages } = job.data || {};

  // Determine scan path
  let dir: string | null = null;
  let cleanup: (() => Promise<void>) | null = null;

  if (repoPath) {
    dir = String(repoPath);
  } else if (repo) {
    const cloned = await cloneRepo(String(repo), ref ? String(ref) : undefined);
    dir = cloned.dir;
    cleanup = cloned.cleanup;
  }

  try {
    if (job.name === "secret") {
      const result = dir ? await gitleaksScan(dir) : { tool: "gitleaks", findings: [], summary: { count: 0 }, skipped: true };
      scanTotal.labels("secret", result.skipped ? "skipped" : "completed").inc();
      return result;
    }
    if (job.name === "osv") {
      let result;
      if (packages && Array.isArray(packages)) {
        // Direct OSV API call with packages array
        result = await osvScanPackages(packages);
      } else if (dir) {
        // Scan directory for package.json
        result = await osvScan(dir);
      } else {
        result = { tool: "osv", findings: [], summary: { count: 0, critical: 0, high: 0, medium: 0, low: 0 } };
      }
      scanTotal.labels("osv", "completed").inc();
      return result;
    }
    throw new Error("unknown scan type");
  } finally { if (cleanup) await cleanup().catch(() => { }); }
}, { connection });

const app = express();
app.use(express.json());
app.get("/", (_req, res) => res.send("worker ok (stage6+7)"));
app.get("/health", async (_req, res) => {
  try { await connection.ping(); res.json({ ok: true, redis: "ok", queues: { [queueName]: "ready", scan: "ready" } }); }
  catch (e: any) { res.status(500).json({ ok: false, error: String(e?.message ?? e) }); }
});
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.post("/enqueue/dummy", async (req, res) => {
  const job = await dummyQueue.add("run", { payload: req.body?.payload ?? null });
  res.json({ id: job.id });
});
app.post("/enqueue/scan/secret", async (req, res) => {
  const { repoPath, repo, ref } = req.body ?? {};
  const job = await scanQueue.add("secret", { repoPath, repo, ref });
  res.json({ id: job.id });
});
app.post("/enqueue/scan/osv", async (req, res) => {
  const { packages, repoPath, repo, ref } = req.body ?? {};
  const job = await scanQueue.add("osv", { packages, repoPath, repo, ref });
  res.json({ id: job.id });
});
app.get("/job/:id", async (req, res) => {
  const id = req.params.id;
  const scanJob = await scanQueue.getJob(id);
  const dummyJob = scanJob ? null : await dummyQueue.getJob(id);
  const job = scanJob ?? dummyJob;
  if (!job) return res.status(404).json({ error: "not found" });
  const state = await job.getState();
  const value = await job.returnvalue;
  if (state === "completed") {
    const t = job.name === "secret" || job.name === "osv" ? job.name : "dummy";
    scanTotal.labels(t, "completed").inc();
  } else if (state === "failed") {
    const t = job.name === "secret" || job.name === "osv" ? job.name : "dummy";
    scanTotal.labels(t, "failed").inc();
  }
  res.json({ id, state, returnvalue: value ?? undefined });
});
app.listen(WORKER_PORT, () => console.log(`[worker] up on :${WORKER_PORT}`));

app.get("/job/scan/:id", async (req, res) => {
  const job = await scanQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json({ status: await job.getState(), type: job.name, result: await job.returnvalue });
});
app.get("/job/dummy/:id", async (req, res) => {
  const job = await dummyQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json({ status: await job.getState(), type: "dummy", result: await job.returnvalue });
});




















// ===== Diagnostic: search job across prefixes & queues =====
app.get("/job-any/:id", async (req, res) => {
  const id = String(req.params.id);
  const conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const prefixes = ["bull","rg","repoguardian"];
  const names = ["scan","osv","secret","dummy","default"];
  try {
    for (const prefix of prefixes) {
      for (const name of names) {
        const q = new Queue(name, { connection: conn, prefix });
        const j = await q.getJob(id);
        if (j) {
          const state = await j.getState();
          const rv = (j).returnvalue;
          await conn.quit();
          return res.json({ id: j.id, queue: name, prefix, state, returnvalue: rv });
        }
      }
    }
    await conn.quit();
    return res.status(404).json({ error: "not found" });
  } catch (e) {
    await conn.quit();
    return res.status(500).json({ error: "internal", detail: (e && e.message) || String(e) });
  }
});

// ===== Find job by scanning Redis keys =====
app.get("/job-find/:id", async (req, res) => {
  const id = String(req.params.id);
  const conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  try {
    // scan all keys matching *:<id>
    let cursor = "0";
    const candidates: string[] = [];
    do {
      const scanRes = await conn.scan(cursor, "MATCH", `*:${id}`, "COUNT", 200);
      cursor = scanRes[0];
      candidates.push(...scanRes[1]);
    } while (cursor !== "0");

    for (const key of candidates) {
      const parts = key.split(":");
      if (parts.length >= 3) {
        const prefix = parts[0];
        const queue = parts.slice(1, parts.length - 1).join(":");
        try {
          const q = new Queue(queue, { connection: conn, prefix });
          const j = await q.getJob(id);
          if (j) {
            const state = await j.getState();
            const rv = (j as any).returnvalue;
            await conn.quit();
            return res.json({ id: j.id, queue, prefix, key, state, returnvalue: rv });
          }
        } catch { /* ignore and continue */ }
      }
    }
    await conn.quit();
    return res.status(404).json({ error: "not found", scanned: candidates.slice(0,50) });
  } catch (e) {
    await conn.quit();
    return res.status(500).json({ error: "internal", detail: (e as any).message });
  }
});

// ===== Stable job status endpoint (proxies to /job-find) =====
app.get("/job/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const port = Number(process.env.WORKER_PORT || 4000);
    const resp = await fetch(`http://127.0.0.1:${port}/job-find/${id}`);
    const json = await resp.json();
    return res.status(resp.status).json(json);
  } catch (e) {
    return res.status(500).json({ error: "internal", detail: (e && e.message) || String(e) });
  }
});

// ===== Metrics: repoguard-jobs queue depth =====
(async () => {
  const conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const q = new Queue("repoguard-jobs", { connection: conn, prefix: "bull" });
  setInterval(async () => {
    try {
      const waiting = await q.getWaitingCount();
      const delayed = await q.getDelayedCount();
      const depth = waiting + delayed;
      repoguardianQueueDepthGauge.set({ queue: "repoguard-jobs" }, depth);
    } catch {}
  }, 2000);
})();