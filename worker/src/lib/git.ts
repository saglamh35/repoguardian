import { execa } from "execa";
import fs from "fs-extra";
import os from "os";
import path from "path";

export async function cloneRepo(repoUrl: string, ref?: string) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "rg-"));
  const dest = path.join(base, "repo");
  await execa("git", ["clone", "--depth=1", repoUrl, dest]);
  if (ref) await execa("git", ["-C", dest, "checkout", ref]);
  async function cleanup() { await fs.remove(base); }
  return { dir: dest, cleanup };
}
