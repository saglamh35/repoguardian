// worker/src/scanners/osv.ts
// Node 18+ global fetch kullanımı (node-fetch YOK)

type FetchResponse = {
    ok: boolean
    status: number
    statusText?: string
    json(): Promise<any>
    text(): Promise<string>
}

type OsvBatchReq = { queries: { package: { purl: string } }[] }
type OsvBatchResp = { results: { vulnerabilities?: any[] }[] }

// Güvenli şekilde global fetch'i al
function getFetch(): (input: any, init?: any) => Promise<FetchResponse> {
    const fn = (globalThis as any).fetch as
        | ((input: any, init?: any) => Promise<FetchResponse>)
        | undefined
    if (!fn) {
        throw new Error(
            'Global fetch yok. Node 18+ kullanın ya da fetch polyfill ekleyin.'
        )
    }
    return fn
}

// CycloneDX SBOM içinden npm purl'larını çıkar
export function extractNpmpurlsFromCycloneDX(sbom: any): string[] {
    const comps = Array.isArray(sbom?.components) ? sbom.components : []
    const purls = comps
        .map((c: any) => c?.purl)
        .filter((p: any) => typeof p === 'string' && p.startsWith('pkg:npm/'))
    // tekilleştir
    return Array.from(new Set(purls))
}

// OSV batch sorgusu (basit timeout + 1 kez retry)
export async function queryOsvByPurls(purls: string[], batchSize = 100) {
    if (!Array.isArray(purls) || purls.length === 0) return []

    const fetch = getFetch()
    const all: { purl: string; vuln: any }[] = []

    for (let i = 0; i < purls.length; i += batchSize) {
        const slice = purls.slice(i, i + batchSize)
        const body: OsvBatchReq = {
            queries: slice.map((purl) => ({ package: { purl } })),
        }

        // 20 sn timeout
        const AC = (globalThis as any).AbortController
        const ac = typeof AC === 'function' ? new AC() : undefined
        const t = ac ? setTimeout(() => ac.abort(), 20_000) : undefined

        try {
            const doCall = () =>
                fetch('https://api.osv.dev/v1/querybatch', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ac?.signal,
                })

            let resp = await doCall()
            // 429 veya 5xx ise 1 kez retry
            if (!resp.ok && (resp.status === 429 || (resp.status >= 500 && resp.status < 600))) {
                await new Promise((r) => setTimeout(r, 1000))
                resp = await doCall()
            }

            if (!resp.ok) {
                const txt = await resp.text().catch(() => '')
                throw new Error(`OSV querybatch failed: ${resp.status} ${resp.statusText ?? ''} ${txt}`)
            }

            const data = (await resp.json()) as OsvBatchResp
            data.results.forEach((res, idx) => {
                const p = slice[idx]
                    ; (res.vulnerabilities ?? []).forEach((v) => all.push({ purl: p, vuln: v }))
            })
        } finally {
            if (t) clearTimeout(t)
        }
    }

    return all
}
