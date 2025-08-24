import { prisma } from "./prisma";
import type { GitleaksFinding } from "./scanners/gitleaks";

// ---- Secrets (Gitleaks) ----
export async function saveGitleaksFindings(repoId: string, findings: GitleaksFinding[]) {
    if (!findings.length) return { created: 0 };

    // createMany -> daha hızlı; unique constraint varsa skipDuplicates kullan
    // Field adlarını şemana uyarla:
    // - Finding: id, repoId, kind (veya type), severity, ruleId, title/message, description/raw, path/location, line
    const rows = findings.map(f => ({
        repoId,
        kind: "SECRET",                         // eğer şemanda 'type' ise: type: "secret"
        severity: (f.Severity ?? "INFO").toUpperCase(), // INFO/WARN/HIGH gibi
        ruleId: f.RuleID ?? null,
        title: f.Description ?? f.RuleID ?? "Secret detected",
        description: f.Match ?? null,
        path: f.File ?? null,
        createdAt: new Date(),
    }));

    const res = await prisma.finding.createMany({
        data: rows as any,
        skipDuplicates: true, // (unique index tanımladıysan)
    });

    return { created: res.count ?? rows.length };
}

// ---- SBOM (Syft) ----
export async function saveSyftSbom(repoId: string, sbom: any) {
    // Tercihen JSON'u doğrudan sakla:
    // şemanda 'content JSON' varsa:
    try {
        return await prisma.sbom.create({
            data: {
                repoId,
                format: "cyclonedx-json",
                content: sbom as any,          // <--- JSON'u kaydet
                createdAt: new Date(),
            } as any,
        });
    } catch {
        // content yoksa 'raw' veya 'storageKey' gibi alanlara düş
        return prisma.sbom.create({
            data: {
                repoId,
                format: "cyclonedx-json",
                raw: sbom as any,              // şemanda 'raw' JSON varsa
                // storageKey: `sbom-${Date.now()}.json` // dosya sistemi/S3 kullanacaksan
                createdAt: new Date(),
            } as any,
        });
    }
}
