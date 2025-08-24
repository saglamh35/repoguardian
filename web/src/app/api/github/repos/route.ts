import { NextResponse } from "next/server";
import { getUserOctokit } from "@/lib/octokit";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const octokit = await getUserOctokit();
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: "updated",
        direction: "desc",
        // affiliation includes owner, collaborator, org member by default in this endpoint
    });

    // return only what UI needs
    const repos = data.map(r => ({
        id: r.id,
        full_name: r.full_name,
        private: r.private,
        default_branch: r.default_branch,
        html_url: r.html_url,
    }));
    return NextResponse.json(repos);
}


