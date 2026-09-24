const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, dirname, join, resolve } = require('node:path');
const { test } = require('node:test');
const { cleanupRelease, githubApi } = require('./cleanup-release.cjs');

const repository = 'example/app';
const branch = 'release/1.0.0';
const originalSha = 'a'.repeat(40);
const nextSha = 'b'.repeat(40);

function fixture(sha = originalSha) {
  const repo = { full_name: repository };
  const pr = {
    number: 2,
    merged: true,
    merged_at: '2026-09-23T02:00:00Z',
    base: { ref: 'develop', repo },
    head: { ref: branch, sha, repo },
  };
  const state = {
    event: { action: 'closed', pull_request: structuredClone(pr) },
    mergedPr: structuredClone(pr),
    mainPulls: [{ ...structuredClone(pr), base: { ref: 'main', repo }, merged_at: '2026-09-23T01:00:00Z' }],
    openPulls: [],
    tip: sha,
    comparison: { status: 'ahead', behind_by: 0, merge_base_commit: { sha } },
    commands: [],
    requests: [],
    tipReads: 0,
    deleted: false,
  };
  state.api = async (path) => {
    state.requests.push(path);
    const url = new URL(`https://api.github.com${path}`);
    if (url.pathname.includes('/git/ref/')) {
      state.tipReads += 1;
      if (state.deleted || state.tip === null) return null;
      return { ref: `refs/heads/${branch}`, object: { type: 'commit', sha: state.tip } };
    }
    if (url.pathname.endsWith('/pulls/2')) return state.mergedPr;
    if (url.pathname.includes('/compare/')) return state.comparison;
    if (url.pathname.endsWith('/pulls')) {
      const pulls = url.searchParams.get('state') === 'closed' ? state.mainPulls : state.openPulls;
      const start = (Number(url.searchParams.get('page')) - 1) * 100;
      return pulls.slice(start, start + 100);
    }
    throw new Error(`Unexpected test request: ${path}`);
  };
  state.runGit = (args) => {
    state.commands.push(args);
    if (args[0] === 'push') state.deleted = true;
    return '';
  };
  state.run = () => cleanupRelease({
    event: state.event,
    repository,
    api: state.api,
    runGit: state.runGit,
    log: () => {},
  });
  return state;
}

test('deletes only after main then develop merge and both histories contain the exact tip', async () => {
  const state = fixture();
  assert.equal(await state.run(), 'release branch deleted');
  assert.deepEqual(state.commands.at(-1), [
    'push', '--porcelain', '--no-progress',
    `--force-with-lease=refs/heads/${branch}:${originalSha}`,
    'origin', `:refs/heads/${branch}`,
  ]);
  assert.equal(state.tipReads, 3);
});

for (const [name, modify] of [
  ['main merge alone', (s) => { s.event.pull_request.base.ref = 'main'; }],
  ['unmerged closure', (s) => { s.event.pull_request.merged = false; }],
  ['unrelated event', (s) => { s.event.action = 'opened'; }],
  ['fork branch', (s) => { s.event.pull_request.head.repo.full_name = 'fork/app'; }],
  ['main branch', (s) => { s.event.pull_request.head.ref = 'main'; }],
  ['develop branch', (s) => { s.event.pull_request.head.ref = 'develop'; }],
  ['feature branch', (s) => { s.event.pull_request.head.ref = 'feat/123-work'; }],
]) {
  test(`does not inspect or delete ${name}`, async () => {
    const state = fixture();
    modify(state);
    await state.run();
    assert.equal(state.requests.length, 0);
    assert.equal(state.commands.length, 0);
  });
}

for (const [name, modify, expected] of [
  ['already deleted', (s) => { s.tip = null; }, 'release branch already absent'],
  ['new commit after merge', (s) => { s.tip = nextSha; }, 'release branch changed after this PR'],
  ['unconfirmed develop merge', (s) => { s.mergedPr.merged = false; }, 'develop merge not confirmed'],
  ['missing main merge', (s) => { s.mainPulls = []; }, 'main merge before develop not confirmed'],
  ['closed but unmerged main PR', (s) => { s.mainPulls[0].merged_at = null; }, 'main merge before develop not confirmed'],
  ['main merged too late', (s) => { s.mainPulls[0].merged_at = '2026-09-23T03:00:00Z'; }, 'main merge before develop not confirmed'],
  ['squashed history', (s) => { s.comparison = { status: 'diverged', behind_by: 1 }; }, 'release commit not contained in main'],
  ['wrong merge base', (s) => { s.comparison.merge_base_commit.sha = nextSha; }, 'release commit not contained in main'],
  ['open release PR', (s) => { s.openPulls = [s.mergedPr]; }, 'release branch is used by an open PR'],
  ['PR targeting release', (s) => { s.openPulls = [{ base: { ref: branch } }]; }, 'release branch is used by an open PR'],
]) {
  test(`preserves release when ${name}`, async () => {
    const state = fixture();
    modify(state);
    assert.equal(await state.run(), expected);
    assert.equal(state.deleted, false);
  });
}

test('checks develop ancestry independently of main ancestry', async () => {
  const state = fixture();
  const api = state.api;
  state.api = (path) => path.endsWith('...develop')
    ? { status: 'diverged', behind_by: 1 }
    : api(path);
  assert.equal(await state.run(), 'release commit not contained in develop');
  assert.equal(state.deleted, false);
});

test('reads every page before deciding no open PR references the release', async () => {
  const state = fixture();
  state.openPulls = Array.from({ length: 100 }, () => ({ base: { ref: 'develop' } }));
  state.openPulls.push({ base: { ref: branch } });
  assert.equal(await state.run(), 'release branch is used by an open PR');
  assert.ok(state.requests.some((path) => path.includes('state=open&per_page=100&page=2')));
});

test('finds a merged main PR beyond the first page', async () => {
  const state = fixture();
  state.mainPulls = [...Array.from({ length: 100 }, () => ({ merged_at: null })), ...state.mainPulls];
  assert.equal(await state.run(), 'release branch deleted');
});

test('preserves a branch changed during the API checks', async () => {
  const state = fixture();
  const api = state.api;
  state.api = (path) => {
    if (path.includes('/git/ref/') && state.tipReads > 0) state.tip = nextSha;
    return api(path);
  };
  assert.equal(await state.run(), 'release branch changed during validation');
  assert.equal(state.deleted, false);
});

test('an API failure does not delete a branch', async () => {
  const state = fixture();
  const api = state.api;
  state.api = (path) => {
    if (path.includes('/compare/')) throw new Error('GitHub API 403');
    return api(path);
  };
  await assert.rejects(state.run(), /GitHub API 403/);
  assert.equal(state.deleted, false);
});

test('does not retry a failed Git deletion', async () => {
  const state = fixture();
  let pushes = 0;
  state.runGit = (args) => {
    if (args[0] === 'push') { pushes += 1; throw new Error('stale info'); }
    return '';
  };
  await assert.rejects(state.run(), /stale info/);
  assert.equal(pushes, 1);
});

test('GitHub API treats only an allowed 404 as an absent branch', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ status: 404, ok: false }));
  const api = githubApi('test-token');
  assert.equal(await api('/test', { allowMissing: true }), null);
  await assert.rejects(api('/test'), /GitHub API 404/);
  globalThis.fetch.mock.mockImplementation(async () => ({ status: 403, ok: false }));
  await assert.rejects(api('/test', { allowMissing: true }), /GitHub API 403/);
});

function gitRepository(t) {
  const root = mkdtempSync(join(tmpdir(), 'release-cleanup-test-'));
  t.after(() => {
    const absolute = resolve(root);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.ok(basename(absolute).startsWith('release-cleanup-test-'));
    rmSync(absolute, { recursive: true, force: true });
  });
  const local = join(root, 'local');
  const remote = join(root, 'remote.git');
  const run = (args, cwd = local) => execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  run(['init', '--bare', '--initial-branch=main', remote], root);
  run(['init', '--initial-branch=main', local], root);
  run(['config', 'user.name', 'Cleanup Test']);
  run(['config', 'user.email', 'cleanup-test@example.invalid']);
  run(['commit', '--allow-empty', '-m', 'base']);
  run(['remote', 'add', 'origin', remote]);
  run(['push', 'origin', 'main']);
  run(['switch', '-c', branch]);
  run(['commit', '--allow-empty', '-m', 'release']);
  const sha = run(['rev-parse', 'HEAD']);
  run(['push', 'origin', branch]);
  return { run, sha };
}

test('real Git deletes exactly the validated remote release ref', async (t) => {
  const { run, sha } = gitRepository(t);
  const state = fixture(sha);
  state.runGit = (args) => {
    const output = run(args);
    if (args[0] === 'push') state.deleted = true;
    return output;
  };
  assert.equal(await state.run(), 'release branch deleted');
  assert.equal(run(['ls-remote', 'origin', `refs/heads/${branch}`]), '');
  assert.match(run(['ls-remote', 'origin', 'refs/heads/main']), /refs\/heads\/main/);
});

test('real Git lease preserves a commit pushed immediately before deletion', async (t) => {
  const { run, sha } = gitRepository(t);
  const state = fixture(sha);
  let changedSha;
  state.runGit = (args) => {
    if (args[0] === 'push') {
      run(['commit', '--allow-empty', '-m', 'concurrent change']);
      changedSha = run(['rev-parse', 'HEAD']);
      run(['push', 'origin', branch]);
    }
    return run(args);
  };
  await assert.rejects(state.run(), (error) => error.status === 1 && /stale info/.test(error.stdout));
  assert.ok(run(['ls-remote', 'origin', `refs/heads/${branch}`]).startsWith(changedSha));
  assert.notEqual(changedSha, sha);
});
