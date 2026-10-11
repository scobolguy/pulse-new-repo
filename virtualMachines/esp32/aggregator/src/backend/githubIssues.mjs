export const ISSUE_REPOSITORY = 'scobolguy/pulse-new-repo';
export const ISSUE_STATUSES = Object.freeze(['backlog', 'in-progress', 'blocked', 'done']);
const statusLabel = status => `status:${status}`;

export class IssueError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toBoardIssue(issue) {
  if (!issue || !Number.isSafeInteger(issue.number) || issue.number < 1 || typeof issue.title !== 'string'
    || !Array.isArray(issue.labels) || !['open', 'closed'].includes(issue.state) || typeof issue.updated_at !== 'string'
    || issue.labels.some(label => typeof label !== 'string' && typeof label?.name !== 'string')
    || (issue.assignees !== undefined && (!Array.isArray(issue.assignees) || issue.assignees.some(user => typeof user?.login !== 'string')))) {
    throw new IssueError(502, 'GITHUB_INVALID_RESPONSE', 'GitHub returned an invalid issue.');
  }
  const labels = issue.labels.map(label => typeof label === 'string' ? label : label.name);
  const statuses = labels.filter(label => ISSUE_STATUSES.some(status => statusLabel(status) === label));
  const conflict = statuses.length > 1
    || (issue.state === 'open' && statuses.includes('status:done'))
    || (issue.state === 'closed' && statuses.some(label => label !== 'status:done'));
  return {
    number: issue.number,
    title: issue.title,
    url: `https://github.com/${ISSUE_REPOSITORY}/issues/${issue.number}`,
    labels,
    assignees: (issue.assignees || []).map(user => user.login),
    status: issue.state === 'closed' ? 'done' : (statuses[0]?.slice(7) || 'backlog'),
    conflict,
    version: JSON.stringify([issue.updated_at, issue.state, labels.slice().sort()]),
  };
}

export function createGitHubIssuesClient({ token = process.env.PULSE_GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  const moves = new Set();
  async function request(path, { method = 'GET', body, allowNotFound = false } = {}) {
    if (!token) throw new IssueError(503, 'GITHUB_NOT_CONFIGURED', 'The backend GitHub token is not configured.');
    let response;
    try {
      response = await fetchImpl(`https://api.github.com/repos/${ISSUE_REPOSITORY}${path}`, {
        method,
        redirect: 'error',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new IssueError(502, 'GITHUB_UNAVAILABLE', 'GitHub could not be reached. Refresh before retrying a write.');
    }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      if (response.status === 429 || (response.status === 403 && (response.headers.get('retry-after') || response.headers.get('x-ratelimit-remaining') === '0'))) {
        throw new IssueError(429, 'GITHUB_RATE_LIMIT', 'GitHub rate limit reached. Wait before refreshing or retrying.');
      }
      if (response.status === 401) throw new IssueError(503, 'GITHUB_AUTH_FAILED', 'The backend GitHub credential was rejected.');
      if (response.status === 403) throw new IssueError(403, 'GITHUB_ACCESS_DENIED', 'The backend GitHub credential lacks access for this action.');
      if (response.status === 404) throw new IssueError(404, 'GITHUB_NOT_FOUND', 'The issue or repository is unavailable to this credential.');
      throw new IssueError(502, 'GITHUB_REQUEST_FAILED', 'GitHub rejected the request. Refresh before retrying a write.');
    }
    try {
      return await response.json();
    } catch {
      throw new IssueError(502, 'GITHUB_INVALID_RESPONSE', 'GitHub returned an invalid response.');
    }
  }

  async function ensureStatusLabel(status) {
    const name = statusLabel(status);
    if (await request(`/labels/${encodeURIComponent(name)}`, { allowNotFound: true })) return;
    await request('/labels', {
      method: 'POST',
      body: { name, color: { backlog: 'd4c5f9', 'in-progress': '0075ca', blocked: 'd73a4a', done: '0e8a16' }[status] },
    });
  }

  return {
    async list() {
      const issues = [];
      for (let page = 1; ; page += 1) {
        const batch = await request(`/issues?state=all&sort=updated&direction=desc&per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new IssueError(502, 'GITHUB_INVALID_RESPONSE', 'GitHub returned an invalid issue list.');
        issues.push(...batch.filter(issue => !issue.pull_request).map(toBoardIssue));
        if (batch.length < 100) break;
      }
      return [...new Map(issues.map(issue => [issue.number, issue])).values()];
    },
    async create({ title, body }) {
      await ensureStatusLabel('backlog');
      const issue = await request('/issues', { method: 'POST', body: { title, body, labels: [statusLabel('backlog')] } });
      return toBoardIssue(issue);
    },
    async move(number, status, version) {
      if (moves.has(number)) throw new IssueError(409, 'ISSUE_BUSY', 'This issue is already being moved. Refresh before retrying.');
      moves.add(number);
      try {
        const issue = await request(`/issues/${number}`);
        if (issue.pull_request) throw new IssueError(400, 'NOT_AN_ISSUE', 'Pull requests cannot be moved on this board.');
        const current = toBoardIssue(issue);
        if (current.version !== version) throw new IssueError(409, 'STALE_ISSUE', 'This issue changed on GitHub. Refresh before moving it.');
        await ensureStatusLabel(status);
        const labels = current.labels.filter(label => !ISSUE_STATUSES.some(item => statusLabel(item) === label));
        // GitHub accepts state and labels together; only finalize the card after this request succeeds.
        return toBoardIssue(await request(`/issues/${number}`, {
          method: 'PATCH',
          body: { state: status === 'done' ? 'closed' : 'open', labels: [...labels, statusLabel(status)] },
        }));
      } finally {
        moves.delete(number);
      }
    },
  };
}
