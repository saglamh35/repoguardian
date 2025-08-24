import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getUserOctokit() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "github" },
        select: { access_token: true },
    });
    if (!account?.access_token) throw new Error("GitHub account not linked");
    return new Octokit({ auth: account.access_token });
}


