// web/src/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@lib/auth";
import { enqueueJob } from "@lib/queue";
import { prisma } from "@lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["ping", "scan:secrets", "scan:sbom", "scan:vulns"]),
  repoGithubId: z.coerce.number().optional(), // form-body için coerce
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hem JSON hem form-data destekle
  let raw: any = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      raw = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      raw = Object.fromEntries(form.entries());
    } else {
      raw = await req.json().catch(() => ({}));
    }
  } catch {
    raw = {};
  }

  const body = Body.parse(raw);

  let repoId: string | null = null;

  if (body.type !== "ping") {
    if (!body.repoGithubId) {
      return NextResponse.json({ error: "repoGithubId required" }, { status: 400 });
    }

    // 1) DB'de var mı?
    const existing = await prisma.repo.findFirst({
      where: { userId: session.user.id, githubId: BigInt(body.repoGithubId) },
      select: { id: true },
    });

    if (existing) {
      repoId = existing.id;
    } else {
      // 2) Yoksa GitHub'tan çekip DB'ye yaz (private için token şart)
      const token =
        (session as any).accessToken ||
        (session as any).user?.accessToken ||
        (session as any).githubAccessToken ||
        process.env.GITHUB_TOKEN ||
        undefined;

      if (!token) {
        return NextResponse.json(
          { error: "Repo not found (or token missing for private repo)" },
          { status: 404 }
        );
      }

      const gh = await fetch(`https://api.github.com/repositories/${body.repoGithubId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "repoguardian",
        },
      });

      if (!gh.ok) {
        const text = await gh.text();
        console.error("[api/jobs] repo lookup failed", gh.status, text);
        return NextResponse.json({ error: "Repo not found" }, { status: 404 });
      }

      const r = (await gh.json()) as any;
      const created = await prisma.repo.create({
        data: {
          userId: session.user.id,
          githubId: BigInt(r.id),
          fullName: r.full_name ?? `${r.owner?.login}/${r.name}`,
          private: !!r.private,
          defaultBranch: r.default_branch ?? "main",
        },
        select: { id: true },
      });
      repoId = created.id;
    }
  }

  const job = await enqueueJob(body.type, {
    userId: session.user.id,
    repoId,
    repoGithubId: body.repoGithubId ?? null,
    ts: Date.now(),
  });

  return NextResponse.json({ id: job.id, name: job.name }, { status: 201 });
}
