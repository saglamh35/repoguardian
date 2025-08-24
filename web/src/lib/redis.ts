import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
});
