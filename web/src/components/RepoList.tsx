"use client";
import { useState } from "react";

type AnyRepo = any;

type UiRepo = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

function normalize(r: AnyRepo): UiRepo {
  const fullName =
    r.fullName ??
    r.full_name ??
    (r.owner?.login && r.name ? r.owner.login + "/" + r.name : "");
  const defaultBranch = r.defaultBranch ?? r.default_branch ?? "main";
  return {
    id: Number(r.id),
    fullName: String(fullName || "(unknown)"),
    private: !!r.private,
    defaultBranch,
  };
}

async function queueJob(type: string, repoGithubId: number) {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, repoGithubId }),
  });

  let data: any = {};
  try { data = await res.json(); } catch {}

  if (res.ok) {
    alert("Queued " + type + ": job " + (data.id ?? ""));
  } else {
    alert("Failed (" + res.status + "): " + JSON.stringify(data));
  }
}

export default function RepoList({ initialRepos }: { initialRepos: AnyRepo[] }) {
  const [repos] = useState<UiRepo[]>(() => (initialRepos || []).map(normalize));

  return (
    <div className="space-y-6">
      {repos.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between rounded border p-4"
        >
          <div className="text-lg">
            <div className="font-medium">{r.fullName}</div>
            <div className="text-sm text-gray-500">
              {r.private ? "private" : "public"} · {r.defaultBranch}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => queueJob("ping", r.id)}
              className="px-4 py-2 rounded border"
            >
              Ping
            </button>
            <button
              onClick={() => queueJob("scan:secrets", r.id)}
              className="px-4 py-2 rounded border"
            >
              Secrets
            </button>
            <button
              onClick={() => queueJob("scan:sbom", r.id)}
              className="px-4 py-2 rounded border"
            >
              SBOM
            </button>
            <button
              onClick={() => queueJob("scan:vulns", r.id)}
              className="px-4 py-2 rounded border"
            >
              Vulns
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
