import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type RepoLite = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
};

export async function GET() {
  try {
    const session = await auth();

    const token =
      (session as any)?.accessToken ||
      process.env.GITHUB_TOKEN ||
      "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "repoguardian",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("/api/repos github error", res.status, txt);
      return NextResponse.json({ error: "GitHub error" }, { status: 502 });
    }

    const data = await res.json() as any[];
    const repos: RepoLite[] = data.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      private: !!r.private,
      default_branch: r.default_branch ?? "main",
      html_url: r.html_url,
    }));

    return NextResponse.json({ repos }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("/api/repos failed", err);
    return NextResponse.json({ error: "Failed to load repositories" }, { status: 500 });
  }
}
