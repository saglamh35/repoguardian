import "dotenv/config";
import IORedis from "ioredis";
import { Worker, Job } from "bullmq";
import { rmSync } from "fs";
import { dirname } from "path";
import { cloneRepoToTemp } from "./git-clone";
import { runGitleaksOnDir } from "./scanners/gitleaks";
import { runSyftCycloneDX } from "./scanners/syft";
import { prisma } from "./prisma";
import { saveGitleaksFindings, saveSyftSbom } from "./persist";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueName = process.env.QUEUE_NAME ?? "repoguard-jobs";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

console.log(`[worker] booting queue=${queueName} redis=${redisUrl}`);

const processor = async (job: Job) => {
  // --- Heartbeat: 5 sn’de bir nabız gönder ---
  const ping = setInterval(() => {
    // sadece küçük bir ilerleme bilgisi; BullMQ işi aktif görsün
    job.updateProgress({ heartbeat: Date.now() });
  }, 5000);

  try {
    switch (job.name) {
      case "ping": {
        console.log("[worker] pong", new Date().toISOString());
        return { ok: true };
      }

      case "scan:secrets": {
        const { userId, repoId, repoGithubId } = job.data as {
          userId: string;
          repoId: string;
          repoGithubId: number;
        };
        console.log(`[worker] scanning secrets for repo ${repoGithubId}`);

        await job.updateProgress({ phase: "clone" });
        const dir = await cloneRepoToTemp(userId, repoGithubId);

        try {
          await job.updateProgress({ phase: "scan/gitleaks" });
          const findings = await runGitleaksOnDir(dir);
          const res = await saveGitleaksFindings(repoId, findings);
          console.log(`[worker] secrets scan completed: ${res.created} findings`);
          return { count: res.created };
        } finally {
          // dir = <tmpBase>/repo  → base'i sil
          const base = dirname(dir);
          rmSync(base, { recursive: true, force: true });
        }
      }

      case "scan:sbom": {
        const { userId, repoId, repoGithubId } = job.data as {
          userId: string;
          repoId: string;
          repoGithubId: number;
        };
        console.log(`[worker] generating SBOM for repo ${repoGithubId}`);

        await job.updateProgress({ phase: "clone" });
        const dir = await cloneRepoToTemp(userId, repoGithubId);

        try {
          await job.updateProgress({ phase: "scan/syft" });
          const sbom = await runSyftCycloneDX(dir);
          const rec = await saveSyftSbom(repoId, sbom);
          console.log(`[worker] SBOM generation completed: ${rec.id}`);
          return { sbomId: rec.id };
        } finally {
          // dir = <tmpBase>/repo  → base'i sil
          const base = dirname(dir);
          rmSync(base, { recursive: true, force: true });
        }
      }

      case "scan:vulns": {
        console.log(`[worker] vuln scan placeholder for repo ${job.data?.repoGithubId}`);
        return { todo: true };
      }

      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  } finally {
    clearInterval(ping);
  }
};

const worker = new Worker(queueName, processor, {
  connection,
  concurrency: 1,                 // stabil olsun
  lockDuration: 10 * 60 * 1000,   // 10 dk kilit süresi (uzun işler)
  stalledInterval: 60 * 1000,     // 60 sn'de bir kontrol
  maxStalledCount: 5,             // 5 kere tolere et
});

worker.on("active", (job) => console.log(`[worker] active ${job.name} ${job.id}`));
worker.on("completed", (job) => console.log(`[worker] completed ${job.name} ${job.id}`));
worker.on("failed", (job, err) => console.error(`[worker] failed ${job?.name} ${job?.id}`, err));
worker.on("error", (err) => console.error("[worker] error", err));

// beklenmeyen hataları da sessizce düşürmeyelim
process.on("unhandledRejection", (e) => {
  console.error("[worker] unhandledRejection", e);
});
process.on("uncaughtException", (e) => {
  console.error("[worker] uncaughtException", e);
});

// Çıkışta Prisma'yı kapat
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
