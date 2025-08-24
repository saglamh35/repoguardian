"use client";
import { useState } from "react";

type Repo = {
    id: number; // GitHub numeric id
    full_name: string;
    private: boolean;
    default_branch?: string;
    html_url?: string;
};

export default function RepoList({ initialRepos }: { initialRepos: Repo[] }) {
    const [repos] = useState(initialRepos);
    const [busy, setBusy] = useState<string | null>(null);

    async function queue(type: 'ping' | 'scan:secrets' | 'scan:sbom' | 'scan:vulns', r?: Repo) {
        const key = `${type}:${r?.id ?? 'na'}`;
        setBusy(key);
        const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                repoGithubId: r?.id, // ping'te undefined kalır
            }),
        });
        setBusy(null);
        if (res.ok) {
            const j = await res.json();
            alert(`Queued ${type}: job ${j.id}`);
        } else {
            const t = await res.text().catch(() => '');
            alert(`Failed (${res.status}): ${t}`);
        }
    }

    return (
        <div className='grid grid-cols-1 gap-3'>
            {repos.map((r) => (
                <div key={r.id} className='border rounded p-3 flex items-center justify-between bg-white'>
                    <div className='min-w-0'>
                        <div className='font-medium text-gray-900 truncate'>{r.full_name}</div>
                        <div className='text-xs text-gray-600'>
                            {r.private ? 'private' : 'public'} · {r.default_branch}
                        </div>
                    </div>
                    <div className='flex gap-2'>
                        <button className='px-3 py-1 rounded border' onClick={() => queue('ping')} disabled={busy !== null}>
                            Ping
                        </button>
                        <button className='px-3 py-1 rounded border' onClick={() => queue('scan:secrets', r)} disabled={busy !== null}>
                            Secrets
                        </button>
                        <button className='px-3 py-1 rounded border' onClick={() => queue('scan:sbom', r)} disabled={busy !== null}>
                            SBOM
                        </button>
                        <button className='px-3 py-1 rounded border' onClick={() => queue('scan:vulns', r)} disabled={busy !== null}>
                            Vulns
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}


