import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { enqueueJob } from '@/lib/queue';
import { prisma } from '@/lib/db';

const Body = z.object({
    type: z.enum(['ping', 'scan:secrets', 'scan:sbom', 'scan:vulns']),
    // GitHub'tan gelen numeric id; DB 'Repo' kaydıyla eşleyeceğiz
    repoGithubId: z.number().optional(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = Body.parse(await req.json());

    let repoId: string | null = null;
    if (body.type !== 'ping') {
        if (!body.repoGithubId) return NextResponse.json({ error: 'repoGithubId required' }, { status: 400 });
        const repo = await prisma.repo.findFirst({
            where: { userId: session.user.id, githubId: BigInt(body.repoGithubId) },
            select: { id: true },
        });
        if (!repo) return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
        repoId = repo.id;
    }

    const job = await enqueueJob(body.type, {
        userId: session.user.id,
        repoId,
        repoGithubId: body.repoGithubId ?? null,
        ts: Date.now(),
    });

    return NextResponse.json({ id: job.id, name: job.name }, { status: 201 });
}
