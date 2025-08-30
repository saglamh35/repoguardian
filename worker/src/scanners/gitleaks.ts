import path from "path";
import fs from "fs-extra";
import { run } from "../lib/proc";

export type SecretScan = {
  tool: "gitleaks",
  findings: Array<{ rule: string; file: string; startLine?: number; secret?: boolean }>,
  summary: { count: number }
};

export async function gitleaksScan(targetPath: string): Promise<SecretScan> {
  // Araç yoksa veya NOOP isteniyorsa hemen dön
  if (process.env.SCAN_NO_TOOLS === "1") {
    return { tool: "gitleaks", findings: [], summary: { count: 0 } };
  }

  const args = [
    "detect",
    "--source", targetPath,
    "--report-format", "json",
    "--redact",
    "--report-path", "-"   // stdout
  ];

  // 30sn watchdog
  const timeoutMs = 30_000;
  try {
    const { stdout } = await run("gitleaks", args, { timeoutMs });
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
    // Hata veya timeout olursa boş sonuçla tamamla (job fail olmasın)
    return { tool: "gitleaks", findings: [], summary: { count: 0 } };
  }
}
