import path from "path";
import fs from "fs-extra";
import { run } from "../lib/proc";

export type SecretScan = {
  tool: "gitleaks",
  findings: Array<{ rule: string; file: string; startLine?: number; secret?: boolean }>,
  summary: { count: number }
};

export async function gitleaksScan(targetPath: string): Promise<SecretScan> {
  const cfg = path.join(targetPath, "gitleaks.json");
  const args = ["detect", "--source", targetPath, "-f", "json", "-r", "-"];
  if (await fs.pathExists(cfg)) args.splice(2, 0, "-c", cfg);
  try {
    const { stdout } = await run("gitleaks", args, { timeoutMs: 120_000 });
    let data: any; try { data = JSON.parse(stdout); } catch { data = []; }
    const arr: any[] = Array.isArray(data) ? data : (data?.findings ?? []);
    const findings = arr.map((f: any) => ({
      rule: String(f?.RuleID ?? f?.rule ?? "unknown"),
      file: String(f?.File ?? f?.file ?? ""),
      startLine: Number(f?.StartLine ?? f?.StartLineNumber ?? f?.line ?? 0) || undefined,
      secret: Boolean(f?.Secret != null),
    }));
    return { tool: "gitleaks", findings, summary: { count: findings.length } };
  } catch {
    return { tool: "gitleaks", findings: [], summary: { count: 0 } };
  }
}
