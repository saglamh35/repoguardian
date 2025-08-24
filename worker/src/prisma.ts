// worker/src/prisma.ts
import 'dotenv/config';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// .env (worker) -> yoksa web/.env dene
if (!process.env.DATABASE_URL) {
    const workerEnv = path.resolve(process.cwd(), '.env');
    const webEnv = path.resolve(process.cwd(), '..', 'web', '.env');
    if (fs.existsSync(workerEnv)) dotenv.config({ path: workerEnv });
    if (!process.env.DATABASE_URL && fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
}

if (!process.env.DATABASE_URL) {
    console.error('[worker] DATABASE_URL hâlâ yok. worker/.env içine ekleyin.');
}

export const prisma = new PrismaClient();
