import { extractNpmpurlsFromCycloneDX, queryOsvByPurls } from "../scanners/osv";

const tinySbom = {
    components: [
        { type: "library", name: "next", version: "15.4.6", purl: "pkg:npm/next@15.4.6" },
        { type: "library", name: "react", version: "19.1.0", purl: "pkg:npm/react@19.1.0" },
    ],
};

(async () => {
    const purls = extractNpmpurlsFromCycloneDX(tinySbom);
    console.log("Paketler:", purls);

    const vulns = await queryOsvByPurls(purls);
    // Özet bir çıktı verelim
    const out = vulns.map(v => ({
        purl: v.purl,
        id: v.vuln.id,
        summary: (v.vuln.summary || "").slice(0, 120) // kısa özet
    }));
    console.log("OSV sonuçları:", out);
})();
