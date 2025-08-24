import { Octokit } from "@octokit/rest";
import { prisma } from "./prisma";

export async function getGithubTokenForUser(userId: string) {
    const acc = await prisma.account.findFirst({
        where: { userId, provider: "github" },
        select: { access_token: true },
    });
    if (!acc?.access_token) throw new Error("GitHub token not found for user");
    return acc.access_token as string;
}

export async function getRepoFullNameByGithubId(userId: string, repoGithubId: number) {
    const token = await getGithubTokenForUser(userId);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.request("GET /repositories/{id}", {
        id: repoGithubId,
    });
    return data.full_name as string; // "owner/name"
}
