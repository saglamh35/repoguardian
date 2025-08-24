import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const hasEnv = !!process.env.DATABASE_URL;
if (!hasEnv) {
    // Son bir defa fallback verelim (lokal)
    process.env.DATABASE_URL =
        process.env.DATABASE_URL ??
        "postgresql://repoguard:repoguard@localhost:5432/repoguard?schema=public";
    console.warn("[worker] DATABASE_URL env’i bulunamadı, lokal fallback kullanılıyor.");
}

export const prisma =
    // @ts-ignore
    globalThis.__prisma ??
    new PrismaClient({
        log: ["warn", "error"],
        datasources: { db: { url: process.env.DATABASE_URL! } },
    });

// @ts-ignore
if (!globalThis.__prisma) globalThis.__prisma = prisma;
