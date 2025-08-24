import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function GET() {
    let db: 'up' | 'down' = 'down';
    let cache: 'up' | 'down' = 'down';

    try {
        await prisma.$queryRaw`SELECT 1`;
        db = 'up';
    } catch { }

    try {
        const pong = await redis.ping();
        if (pong) cache = 'up';
    } catch { }

    return Response.json({
        db,
        redis: cache,
        timestamp: new Date().toISOString(),
    });
}
