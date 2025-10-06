export type OsvRequest = { package: { name: string; ecosystem: "npm"|"Go"|"PyPI"|"Maven"|"RubyGems" }, version: string };

export async function osvScanPackages(reqs: OsvRequest[]) {
  return reqs.map(r => ({ package: r.package.name, version: r.version, vulnerabilities: [] as Array<{ id: string; summary?: string }> }));
}

export async function osvScan(input: { packages?: OsvRequest[]; repo?: string; repoPath?: string }) {
  if (input?.packages?.length) return osvScanPackages(input.packages);
  return [];
}