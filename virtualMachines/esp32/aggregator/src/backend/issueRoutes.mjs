import { createGitHubIssuesClient, ISSUE_REPOSITORY, ISSUE_STATUSES, IssueError } from './githubIssues.mjs';

export function registerIssueRoutes(app, {
  getSessionUserIdFromRequest,
  resolveEffectiveAccessForUser,
  hasPermission,
  client = createGitHubIssuesClient(),
  logError = console.error,
}) {
  const authorize = permission => (req, res, next) => {
    const userId = getSessionUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Sign in to Pulse to access GitHub issues.' });
    const access = resolveEffectiveAccessForUser(userId);
    if (!access.user || access.user.enabled === false || access.toxicRoleViolations?.length || !hasPermission(access.permissions, permission)) {
      return res.status(403).json({ code: 'ISSUES_ACCESS_DENIED', error: 'Your Pulse account does not have permission for this action.' });
    }
    next();
  };
  const handle = action => async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      const known = error instanceof IssueError;
      logError('[ISSUES]', known ? error.code : 'INTERNAL_ERROR');
      res.status(known ? error.status : 500).json({
        code: known ? error.code : 'INTERNAL_ERROR',
        error: known ? error.message : 'Issue tracking failed. Refresh before retrying.',
      });
    }
  };
  app.get('/api/issues', authorize('governance.read'), handle(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ repository: ISSUE_REPOSITORY, issues: await client.list() });
  }));
  app.post('/api/issues', authorize('governance.manage'), handle(async (req, res) => {
    const { title, body = '' } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 256 || typeof body !== 'string' || body.length > 65536) {
      throw new IssueError(400, 'INVALID_ISSUE', 'A title of 1-256 characters and a body of at most 65536 characters are required.');
    }
    res.status(201).json({ issue: await client.create({ title: title.trim(), body }) });
  }));
  app.patch('/api/issues/:number/status', authorize('governance.manage'), handle(async (req, res) => {
    const number = Number(req.params.number);
    const { status, version } = req.body || {};
    if (!/^[1-9]\d*$/.test(req.params.number) || !Number.isSafeInteger(number) || !ISSUE_STATUSES.includes(status)
      || typeof version !== 'string' || !version || version.length > 16384) {
      throw new IssueError(400, 'INVALID_STATUS', 'A valid issue number, board status, and current version are required.');
    }
    res.json({ issue: await client.move(number, status, version) });
  }));
}
