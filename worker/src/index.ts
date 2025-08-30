import express from "express";
import { Queue, Worker, QueueEvents, JobsOptions, Job } from "bullmq";
import IORedis from "ioredis";
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from "prom-client";
import { gitleaksScan } from "./scanners/gitleaks";
import { osvScan } from "./scanners/osv";
import { cloneRepo } from "./lib/git";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const WORKER_PORT = Number(process.env.WORKER_PORT ?? 9100);
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ---- metrics
collectDefaultMetrics({ register });
const jobsTotal = new Counter({ name: "jobs_total", help: "Jobs total", labelNames: ["queue","status"] });
const jobDuration = new Histogram({ name: "job_duration_seconds", help: "Job duration", labelNames: ["queue"], buckets:[0.05,0.1,0.3,1,3,10] });
const qActive = new Gauge({ name: "queue_active", help: "Active jobs", labelNames: ["queue"] });
const qWaiting = new Gauge({ name: "queue_waiting", help: "Waiting jobs", labelNames: ["queue"] });
const qFailed = new Gauge({ name: "queue_failed", help: "Failed jobs", labelNames: ["queue"] });
const scanJobsTotal = new Counter({ name: "scan_jobs_total", help: "Scan jobs total", labelNames: ["type","status"] });
const scanFindingsTotal = new Counter({ name: "scan_findings_total", help: "Scan findings total", labelNames: ["type","severity"] });

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
  jobDuration.labels(queueName).observe(durSec);
  return { ok: true, payload: job.data?.payload ?? null };
}, { connection });
events.on("completed", () => jobsTotal.labels(queueName,"completed").inc());
events.on("failed",    () => jobsTotal.labels(queueName,"failed").inc());
async function refreshQueueGauges() {
  const c = await dummyQueue.getJobCounts("active","waiting","failed");
  qActive.labels(queueName).set(c.active ?? 0);
  qWaiting.labels(queueName).set(c.waiting ?? 0);
  qFailed.labels(queueName).set(c.failed ?? 0);
}
setInterval(refreshQueueGauges, 1000).unref();

// ---- scan (stage7)
const scanQueue = new Queue("scan", { connection, defaultJobOptions: { attempts, backoff } });
const scanEvents = new QueueEvents("scan", { connection });
const scanWorker = new Worker("scan", async (job: Job) => {
  const { repo, ref } = job.data || {};
  if (!repo) throw new Error("repo is required");
  const { dir, cleanup } = await cloneRepo(String(repo), ref ? String(ref) : undefined);
  try {
    if (job.name === "secret") {
      const result = await gitleaksScan(dir);
      for (const _ of result.findings) scanFindingsTotal.labels("secret","INFO").inc(1);
      return result;
    }
    if (job.name === "osv") {
      const result = await osvScan(dir);
      for (const f of result.findings) scanFindingsTotal.labels("osv",(f.severity || "UNKNOWN").toUpperCase()).inc(1);
      return result;
    }
    throw new Error("unknown scan type");
  } finally { await cleanup().catch(() => {}); }
}, { connection });

const app = express();
app.use(express.json());
app.get("/", (_req, res) => res.send("worker ok (stage6+7)"));
app.get("/health", async (_req, res) => {
  try { await connection.ping(); res.json({ ok: true, redis: "ok", queues: { [queueName]: "ready", scan: "ready" } }); }
  catch (e:any) { res.status(500).json({ ok: false, error: String(e?.message ?? e) }); }
});
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.post("/enqueue/dummy", async (req, res) => {
  const job = await dummyQueue.add("run", { payload: req.body?.payload ?? null });
  res.json({ jobId: job.id });
});
app.post("/enqueue/scan/secret", async (req, res) => {
  const job = await scanQueue.add("secret", { repo: req.body?.repo, ref: req.body?.ref });
  res.json({ jobId: job.id });
});
app.post("/enqueue/scan/osv", async (req, res) => {
  const job = await scanQueue.add("osv", { repo: req.body?.repo, ref: req.body?.ref });
  res.json({ jobId: job.id });
});
app.get("/job/:id", async (req, res) => {
  const id = req.params.id;
  const job = await dummyQueue.getJob(id) || await scanQueue.getJob(id);
  if (!job) return res.status(404).json({ error: "not found" });
  const state = await job.getState();
  const value = await job.returnvalue;
  if (state === "completed") {
    const t = job.name === "secret" || job.name === "osv" ? job.name : "dummy";
    if (t === "secret" || t === "osv") scanJobsTotal.labels(t, "completed").inc();
    else jobsTotal.labels(queueName,"completed").inc();
  } else if (state === "failed") {
    const t = job.name === "secret" || job.name === "osv" ? job.name : "dummy";
    if (t === "secret" || t === "osv") scanJobsTotal.labels(t, "failed").inc();
    else jobsTotal.labels(queueName,"failed").inc();
  }
  res.json({ status: state, result: value ?? undefined });
});
app.listen(WORKER_PORT, () => console.log(`[worker] up on :${WORKER_PORT}`));
