import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const Body = z.object({
    id: z.number(), // GitHub numeric id
    full_name: z.string(),
    private: z.boolean(),
    default_branch: z.string().optional(),
    html_url: z.string().url().optional(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const json = await req.json();
    const data = Body.parse(json);

    const saved = await prisma.repo.upsert({
        where: {
            userId_githubId: {
                userId: session.user.id,
                githubId: BigInt(data.id),
            },
        },
        update: {
            fullName: data.full_name,
            private: data.private,
            defaultBranch: data.default_branch,
            htmlUrl: data.html_url,
        },
        create: {
            userId: session.user.id,
            githubId: BigInt(data.id),
            fullName: data.full_name,
            private: data.private,
            defaultBranch: data.default_branch,
            htmlUrl: data.html_url,
        },
        select: { id: true, fullName: true },
    });

    return NextResponse.json(saved, { status: 201 });
}


