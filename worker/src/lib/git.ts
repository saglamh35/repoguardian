import { tmpdir } from "os";
import { mkdtempSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { rm } from "fs/promises";

export async function cloneRepo(url: string, ref?: string): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), "rg-"));
  let res = spawnSync("git", ["clone", "--depth", "1", url, dir], { stdio: "ignore" });
  if (res.status !== 0) throw new Error("git clone failed");
  if (ref) {
    res = spawnSync("git", ["-C", dir, "checkout", ref], { stdio: "ignore" });
    if (res.status !== 0) throw new Error("git checkout failed");
  }
  return { dir, cleanup: async () => { await rm(dir, { recursive: true, force: true }); } };
}
export const cloneShallow = cloneRepo as any;