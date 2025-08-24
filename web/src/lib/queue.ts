import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
});

export const queueName = 'repoguard-jobs';
export const jobsQueue = new Queue(queueName, { connection });

export type JobType = 'ping' | 'scan:secrets' | 'scan:sbom' | 'scan:vulns';

export async function enqueueJob(type: JobType, payload: unknown) {
    return jobsQueue.add(type, payload, {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    });
}
