const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const git = (args) => execFileSync('git', args, { encoding: 'utf8', timeout: 60000 });

async function cleanupRelease({ event, repository, api, runGit = git, log = console.log }) {
  const pr = event.pull_request;
  if (
    event.action !== 'closed' ||
    !pr?.merged ||
    pr.base?.ref !== 'develop' ||
    pr.base?.repo?.full_name !== repository ||
    pr.head?.repo?.full_name !== repository ||
    !pr.head?.ref?.startsWith('release/')
  ) {
    return 'not a merged release PR into develop';
  }
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !/^[a-f0-9]{40}$/.test(pr.head.sha) ||
    !Number.isSafeInteger(pr.number) ||
    pr.number <= 0
  ) {
    throw new Error('Invalid repository, PR number or release commit');
  }

  const branch = pr.head.ref;
  const ref = `refs/heads/${branch}`;
  runGit(['check-ref-format', ref]);
  const repoPath = `/repos/${repository}`;
  const branchPath = `${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`;
  const headFilter = encodeURIComponent(`${repository.split('/')[0]}:${branch}`);

  async function currentTip() {
    const result = await api(branchPath, { allowMissing: true });
    if (result === null) return null;
    if (result.ref !== ref || result.object?.type !== 'commit') {
      throw new Error('Unexpected release ref response');
    }
    return result.object.sha;
  }

  async function allPulls(query) {
    const result = [];
    for (let page = 1; ; page += 1) {
      const pulls = await api(`${repoPath}/pulls?${query}&per_page=100&page=${page}`);
      if (!Array.isArray(pulls)) throw new Error('Unexpected pull request response');
      result.push(...pulls);
      if (pulls.length < 100) return result;
    }
  }

  async function hasOpenPull() {
    const pulls = await allPulls('state=open');
    return pulls.some(
      (pull) =>
        pull.base?.ref === branch ||
        (pull.head?.repo?.full_name === repository && pull.head?.ref === branch),
    );
  }

  const sha = await currentTip();
  if (sha === null) return 'release branch already absent';
  if (sha !== pr.head.sha) return 'release branch changed after this PR';

  const mergedPr = await api(`${repoPath}/pulls/${pr.number}`);
  if (
    !mergedPr.merged ||
    mergedPr.base?.ref !== 'develop' ||
    mergedPr.base?.repo?.full_name !== repository ||
    mergedPr.head?.repo?.full_name !== repository ||
    mergedPr.head?.ref !== branch ||
    mergedPr.head?.sha !== sha ||
    !Number.isFinite(Date.parse(mergedPr.merged_at))
  ) {
    return 'develop merge not confirmed';
  }

  const mainPulls = await allPulls(`state=closed&base=main&head=${headFilter}`);
  const mainMerged = mainPulls.some(
    (pull) =>
      pull.merged_at &&
      Date.parse(pull.merged_at) <= Date.parse(mergedPr.merged_at) &&
      pull.base?.ref === 'main' &&
      pull.base?.repo?.full_name === repository &&
      pull.head?.repo?.full_name === repository &&
      pull.head?.ref === branch,
  );
  if (!mainMerged) return 'main merge before develop not confirmed';

  for (const target of ['main', 'develop']) {
    const comparison = await api(`${repoPath}/compare/${sha}...${target}`);
    if (
      !['ahead', 'identical'].includes(comparison.status) ||
      comparison.behind_by !== 0 ||
      comparison.merge_base_commit?.sha !== sha
    ) {
      return `release commit not contained in ${target}`;
    }
  }
  if (await hasOpenPull()) return 'release branch is used by an open PR';
  if ((await currentTip()) !== sha) return 'release branch changed during validation';

  // The lease rejects a push made after validation; the API delete endpoint has no SHA guard.
  log(`Deleting ${ref} at ${sha}; PR #${pr.number} and both target histories verified.`);
  log(
    runGit([
      'push',
      '--porcelain',
      '--no-progress',
      `--force-with-lease=${ref}:${sha}`,
      'origin',
      `:${ref}`,
    ]),
  );
  if ((await currentTip()) !== null) {
    throw new Error('Release branch still exists or was recreated after deletion; no retry');
  }
  return 'release branch deleted';
}

function githubApi(token) {
  return async (path, { allowMissing = false } = {}) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
    return response.json();
  };
}

if (require.main === module) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_EVENT_PATH || !process.env.GITHUB_REPOSITORY) {
    throw new Error('Missing GitHub Actions environment');
  }
  cleanupRelease({
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    repository: process.env.GITHUB_REPOSITORY,
    api: githubApi(process.env.GITHUB_TOKEN),
  })
    .then((result) => console.log(result))
    .catch((error) => {
      if (error.stdout) console.error(error.stdout);
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { cleanupRelease, githubApi };
