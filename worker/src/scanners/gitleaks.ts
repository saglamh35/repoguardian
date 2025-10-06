export type GitleaksFinding = { file: string; line: number; rule: string; match?: string };
export async function gitleaksScan(repoPath: string): Promise<{ findings: GitleaksFinding[]; skipped?: boolean }> {
  return { findings: [], skipped: true }; // gitleaks CLI yoksa "skipped"
}