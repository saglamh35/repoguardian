import { run } from "../lib/proc";

export type OsvScan = {
  tool: "osv",
  findings: Array<{ package: string; version?: string; id?: string; severity?: string }>,
  summary: { count: number; critical: number; high: number; medium: number; low: number }
};

function sevOf(vuln: any): string | undefined {
  const sev = vuln?.severity?.[0]?.type || vuln?.database_specific?.severity || vuln?.severity?.[0]?.score;
  return (String(sev || "") || undefined)?.toUpperCase();
}

export async function osvScan(targetPath: string): Promise<OsvScan> {
  try {
    const { stdout } = await run("osv-scanner", ["-r", targetPath, "-o", "-", "--format", "json"], { timeoutMs: 180_000 });
    let json: any = {}; try { json = JSON.parse(stdout); } catch {}
    const findings: OsvScan["findings"] = [];
    const sevCount = { critical: 0, high: 0, medium: 0, low: 0 };
    const results = json?.results ?? json?.vulnerabilities ?? [];
    for (const res of results) {
      const pkgs = res?.packages ?? res?.results ?? res?.affected ?? [];
      for (const p of pkgs) {
        const name = p?.package?.name ?? p?.package?.ecosystem ?? p?.name ?? "unknown";
        const ver  = p?.package?.version ?? p?.version;
        const vulns = p?.vulnerabilities ?? res?.vulns ?? [];
        for (const v of vulns) {
          const id = v?.id ?? v?.aliases?.[0];
          const sev = (sevOf(v) || "").toUpperCase();
          findings.push({ package: String(name), version: ver ? String(ver) : undefined, id: id ? String(id) : undefined, severity: sev || undefined });
          if (sev === "CRITICAL") sevCount.critical++;
          else if (sev === "HIGH") sevCount.high++;
          else if (sev === "MEDIUM") sevCount.medium++;
          else if (sev === "LOW") sevCount.low++;
        }
      }
    }
    return { tool: "osv", findings, summary: { count: findings.length, ...sevCount } };
  } catch {
    return { tool: "osv", findings: [], summary: { count: 0, critical: 0, high: 0, medium: 0, low: 0 } };
  }
}
