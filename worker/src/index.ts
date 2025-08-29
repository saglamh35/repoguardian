import express from "express";
import { Queue, Worker, QueueEvents, JobsOptions, QueueScheduler, Job } from "bullmq";
import IORedis from "ioredis";
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from "prom-client";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const WORKER_PORT = Number(process.env.WORKER_PORT ?? 9100);

const connection = new IORedis(REDIS_URL);

// Metrics
collectDefaultMetrics({ register });
const jobsTotal = new Counter({ name: "jobs_total", help: "Jobs total", labelNames: ["queue","status"] });
const jobDuration = new Histogram({ name: "job_duration_seconds", help: "Job duration", labelNames: ["queue"], buckets:[0.05,0.1,0.3,1,3,10] });
const qActive = new Gauge({ name: "queue_active", help: "Active jobs", labelNames: ["queue"] });
const qWaiting = new Gauge({ name: "queue_waiting", help: "Waiting jobs", labelNames: ["queue"] });
const qFailed = new Gauge({ name: "queue_failed", help: "Failed jobs", labelNames: ["queue"] });

const queueName = "dummy";
const dummyQueue = new Queue(queueName, { connection });
const scheduler = new QueueScheduler(queueName, { connection });
const events = new QueueEvents(queueName, { connection });

const attempts = 5;
const backoff: JobsOptions["backoff"] = { type: "exponential", delay: 2000 };

const worker = new Worker(queueName, async (job: Job) => {
  const start = process.hrtime.bigint();
  // simulate 10% random failure
  if (Math.random() < 0.10) {
    throw new Error("random-failure");
  }
  // pretend to work
  await new Promise(r => setTimeout(r, 300));
  const end = process.hrtime.bigint();
  const durSec = Number(end - start) / 1e9;
  jobDuration.labels(queueName).observe(durSec);
  return { ok: true, payload: job.data?.payload ?? null };
}, { connection, attempts, backoff });

events.on("completed", async () => jobsTotal.labels(queueName,"completed").inc());
events.on("failed", async () => jobsTotal.labels(queueName,"failed").inc());

async function refreshQueueGauges() {
  const counts = await dummyQueue.getJobCounts("active","waiting","failed");
  qActive.labels(queueName).set(counts.active ?? 0);
  qWaiting.labels(queueName).set(counts.waiting ?? 0);
  qFailed.labels(queueName).set(counts.failed ?? 0);
}
setInterval(refreshQueueGauges, 1000).unref();

const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await connection.ping();
    res.json({ ok: true, redis: "ok", queues: { [queueName]: "ready" } });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.post("/enqueue/dummy", async (req, res) => {
  const job = await dummyQueue.add("run", { payload: req.body?.payload ?? null }, { attempts, backoff });
  res.json({ jobId: job.id });
});

app.get("/job/:id", async (req, res) => {
  const job = await dummyQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  const state = await job.getState();
  res.json({ status: state });
});

app.listen(WORKER_PORT, () => {
  console.log(`[worker] up on :${WORKER_PORT}`);
});
