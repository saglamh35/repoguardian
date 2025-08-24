import "dotenv/config";
import IORedis from "ioredis";
import { Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueName = process.env.QUEUE_NAME ?? "repoguard-jobs";

// Bağlantıyı kur ve başlangıçta log bas
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
console.log(`[worker] booting queue=${queueName} redis=${redisUrl}`);

const worker = new Worker(queueName, async (job) => {
  switch (job.name) {
    case "ping":
      console.log("[worker] pong", new Date().toISOString());
      return { ok: true };

    case "scan:secrets":
    case "scan:sbom":
    case "scan:vulns":
      console.log(`[worker] consume ${job.name}`, { id: job.id, data: job.data });
      // ileride gerçek taramalar burada
      return { received: job.data };

    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
}, { connection, concurrency: 5 });

// Daha görünür olaylar
worker.on("active",    (job) => console.log(`[worker] active ${job.name} ${job.id}`));
worker.on("completed", (job) => console.log(`[worker] completed ${job.name} ${job.id}`));
worker.on("failed",    (job, err) => console.error(`[worker] failed ${job?.name} ${job?.id}`, err));
worker.on("error",     (err) => console.error("[worker] error", err));
