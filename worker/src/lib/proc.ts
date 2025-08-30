import { execa } from "execa";

export async function run(cmd: string, args: string[], opts?: { timeoutMs?: number, cwd?: string }) {
  const timeout = opts?.timeoutMs ?? 120_000;
  const { stdout, stderr, exitCode } = await execa(cmd, args, { timeout, cwd: opts?.cwd });
  if (exitCode !== 0) {
    throw new Error(`proc failed: ${cmd} ${args.join(" ")} :: ${stderr}`);
  }
  return { stdout, stderr };
}
