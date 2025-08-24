import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { getGithubTokenForUser, getRepoFullNameByGithubId } from "./github";

export async function cloneRepoToTemp(userId: string, repoGithubId: number) {
    const token = await getGithubTokenForUser(userId);
    const fullName = await getRepoFullNameByGithubId(userId, repoGithubId);

    const base = mkdtempSync(join(tmpdir(), "repoguard-"));
    const dst = join(base, "repo");

    // HTTPS token'li klon (GitHub)
    const url = `https://x-access-token:${token}@github.com/${fullName}.git`;
    await execa("git", ["clone", "--depth", "1", url, dst], { stdio: "inherit" });
    return dst;
}
