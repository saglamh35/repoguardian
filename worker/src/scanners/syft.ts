import { execa } from "execa";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import * as fs from "node:fs";

export async function runSyftCycloneDX(dir: string): Promise<any> {
    const outBase = mkdtempSync(join(tmpdir(), "rg-syft-"));
    const outFile = join(outBase, "sbom.json");

    // Windows yollarını Docker için normalize et
    const mountRepo = dir.replace(/\\/g, "/");
    const mountOut = outBase.replace(/\\/g, "/");

    try {
        await execa(
            "docker",
            [
                "run", "--rm",
                "-v", `${mountRepo}:/src`,
                "-v", `${mountOut}:/out`,
                "anchore/syft:v1.17.0",
                "-q",               // sessiz mod
                "dir:/src",
                "-o", "cyclonedx-json=/out/sbom.json",
            ],
            {
                // konsola akmasın
                stdio: ["ignore", "pipe", "pipe"],
            }
        );
    } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Syft çalıştırılırken bir hata oluştu.";
        throw new Error(`[SBOM] Syft hata: ${msg} — Docker Desktop açık mı ve 'docker run' çalışıyor mu?`);
    }

    if (!fs.existsSync(outFile)) {
        throw new Error("[SBOM] Çıktı dosyası bulunamadı (sbom.json).");
    }

    const text = fs.readFileSync(outFile, "utf8");
    const sbom = JSON.parse(text);

    // Ağır alanları log’dan sakla ama kullanılabilir kalsın
    const hideFromLogs = (obj: any, key: string) => {
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
            Object.defineProperty(obj, key, {
                value: obj[key],
                enumerable: false,   // console.log göstermesin
                writable: true,
                configurable: true,
            });
        }
    };

    // components sayısını özet olarak ekle
    const compCount = Array.isArray(sbom.components) ? sbom.components.length : 0;
    Object.defineProperty(sbom, "componentsCount", {
        value: compCount,
        enumerable: true,
        writable: false,
        configurable: true,
    });

    hideFromLogs(sbom, "components");
    hideFromLogs(sbom, "dependencies");
    hideFromLogs(sbom, "vulnerabilities");

    console.log(`[worker] SBOM hazır (paket: ${compCount})`);

    return sbom;
}
