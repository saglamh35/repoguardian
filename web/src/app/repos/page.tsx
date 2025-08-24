import { auth } from "@/lib/auth";
import { getUserOctokit } from "@/lib/octokit";
import RepoList from "@/components/RepoList";

export default async function ReposPage() {
  const session = await auth();
  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Repositories</h1>
          <p className="text-gray-600">Please sign in to view your repositories.</p>
        </div>
      </div>
    );
  }

  try {
    const octokit = await getUserOctokit();
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100, sort: "updated", direction: "desc",
    });

    const repos = data.map(r => ({
      id: r.id,
      fullName: r.full_name ?? `${r.owner?.login}/${r.name}`,
      private: !!r.private,
      defaultBranch: r.default_branch ?? "main",
      htmlUrl: r.html_url ?? "",
    }));

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Your Repositories</h1>
        <RepoList initialRepos={repos} />
      </div>
    );
  } catch {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Repositories</h1>
          <p className="text-red-600">Failed to load repositories. Please try again.</p>
        </div>
      </div>
    );
  }
}
