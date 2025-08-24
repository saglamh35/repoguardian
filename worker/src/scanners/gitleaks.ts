import { execa } from "execa";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import * as fs from "node:fs";

export type GitleaksFinding = {
    Description?: string;
    StartLine?: number;
    EndLine?: number;
    StartColumn?: number;
    EndColumn?: number;
    Match?: string;
    Secret?: string;
    File?: string;
    RuleID?: string;
    Commit?: string;
    Author?: string;
    Email?: string;
    Date?: string;
    Tags?: string[];
    Severity?: string;
};

export async function runGitleaksOnDir(dir: string): Promise<GitleaksFinding[]> {
    const outBase = mkdtempSync(join(tmpdir(), "rg-gitleaks-"));
    const outFile = join(outBase, "gitleaks.json");

    // Windows için forward-slash normalize
    const mountRepo = dir.replace(/\\/g, "/");
    const mountOut = outBase.replace(/\\/g, "/");

    // leaks bulunduğunda exit=1 dönmesini engelle
    // not: --redact üretim için iyi (secret’ları maskele)
    await execa(
        "docker",
        [
            "run", "--rm",
            "-v", `${mountRepo}:/repo`,
            "-v", `${mountOut}:/out`,
            "zricethezav/gitleaks:v8.18.4",
            "detect",
            "-s", "/repo",
            "-f", "json",
            "-r", "/out/gitleaks.json",
            "--exit-code", "0",
            "--no-color",
            "--redact",
        ],
        { stdio: "inherit" }
    );

    if (!fs.existsSync(outFile)) return [];
    const text = fs.readFileSync(outFile, "utf8").trim();
    if (!text) return [];

    const parsed = JSON.parse(text);
    // gitleaks bazen {Leaks: []} döndürür
    return Array.isArray(parsed) ? parsed : (parsed.Leaks ?? []);
}
