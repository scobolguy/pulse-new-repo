import fs from 'fs';
import path from 'path';

export function registerUserProvisioningRoutes(app, deps = {}) {
  const {
    requirePermission,
    resolveActor,
    normalizeUserIdentifier,
    isValidEmailIdentifier,
    sanitizeProfileIds,
    userManagementStore,
    USER_ORGANIZATION_NAME,
    saveUserManagement,
    sanitizeUserForApi
  } = deps;

  const dataRoot = String(deps.dataRoot || '').trim();
  if (!dataRoot) {
    throw new Error('registerUserProvisioningRoutes requires dataRoot');
  }

  const USER_REQUESTS_PATH = path.join(dataRoot, 'user-requests.json');
  const USER_AUDIT_PATH = path.join(dataRoot, 'user-audit.json');

  let userRequestStore = { requests: [], nextId: 1 };
  let userAuditStore = { audits: [] };

  function loadUserRequests() {
    try {
      if (fs.existsSync(USER_REQUESTS_PATH)) {
        const raw = fs.readFileSync(USER_REQUESTS_PATH, 'utf-8');
        userRequestStore = JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[USER-REQUESTS] Failed to load: ${e.message}`);
    }
  }

  function saveUserRequests() {
    try {
      fs.writeFileSync(USER_REQUESTS_PATH, JSON.stringify(userRequestStore, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[USER-REQUESTS] Failed to save: ${e.message}`);
    }
  }

  function loadUserAudits() {
    try {
      if (fs.existsSync(USER_AUDIT_PATH)) {
        const raw = fs.readFileSync(USER_AUDIT_PATH, 'utf-8');
        userAuditStore = JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[USER-AUDIT] Failed to load: ${e.message}`);
    }
  }

  function saveUserAudits() {
    try {
      fs.writeFileSync(USER_AUDIT_PATH, JSON.stringify(userAuditStore, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[USER-AUDIT] Failed to save: ${e.message}`);
    }
  }

  function addAuditEntry(userId, action, actor, details = {}) {
    const entry = {
      userId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      details
    };
    userAuditStore.audits.push(entry);
    saveUserAudits();
    return entry;
  }

  function notifyExternalSystem(requestId, status, reason = null) {
    console.log(`[EXTERNAL-NOTIFY] Request ${requestId} status: ${status}${reason ? ` - ${reason}` : ''}`);
  }

  loadUserRequests();
  loadUserAudits();

  app.get('/api/users/requests', requirePermission('users.read'), (req, res) => {
    const status = req.query.status;
    let requests = userRequestStore.requests;

    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    res.json({ requests });
  });

  app.post('/api/users/requests', requirePermission('users.provision'), (req, res) => {
    const actor = resolveActor(req);
    const { userId, email, displayName, department, jobTitle, officeLocation, profileIds } = req.body || {};

    const id = normalizeUserIdentifier(email || userId);
    if (!id) {
      return res.status(400).json({ error: 'userId or email is required' });
    }

    const request = {
      id: `REQ-${userRequestStore.nextId++}`,
      userId: id,
      email: isValidEmailIdentifier(email || userId) ? normalizeUserIdentifier(email || userId) : null,
      displayName: String(displayName || id).trim(),
      department: String(department || 'Operations').trim(),
      jobTitle: String(jobTitle || 'Operations Analyst').trim(),
      officeLocation: String(officeLocation || 'HQ').trim(),
      profileIds: sanitizeProfileIds(profileIds),
      status: 'draft',
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    userRequestStore.requests.push(request);
    saveUserRequests();

    addAuditEntry(id, 'request_created', actor.userId, { requestId: request.id });

    res.json({ status: 'created', request });
  });

  app.get('/api/users/requests/:id', requirePermission('users.read'), (req, res) => {
    const request = userRequestStore.requests.find(r => r.id === req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json({ request });
  });

  app.patch('/api/users/requests/:id', requirePermission('users.provision'), (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft requests' });
    }

    const updates = req.body || {};
    if (updates.displayName) request.displayName = String(updates.displayName).trim();
    if (updates.department) request.department = String(updates.department).trim();
    if (updates.jobTitle) request.jobTitle = String(updates.jobTitle).trim();
    if (updates.officeLocation) request.officeLocation = String(updates.officeLocation).trim();
    if (updates.profileIds) request.profileIds = sanitizeProfileIds(updates.profileIds);

    request.updatedAt = new Date().toISOString();
    saveUserRequests();

    addAuditEntry(request.userId, 'request_updated', actor.userId, { requestId: request.id });

    res.json({ status: 'updated', request });
  });

  app.delete('/api/users/requests/:id', requirePermission('users.provision'), (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft requests' });
    }

    userRequestStore.requests = userRequestStore.requests.filter(r => r.id !== req.params.id);
    saveUserRequests();

    addAuditEntry(request.userId, 'request_deleted', actor.userId, { requestId: request.id });

    res.json({ status: 'deleted', requestId: request.id });
  });

  app.post('/api/users/requests/:id/submit', requirePermission('users.provision'), (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Request already submitted' });
    }

    request.status = 'pending-verification';
    request.submittedBy = actor.userId;
    request.submittedAt = new Date().toISOString();
    request.updatedAt = new Date().toISOString();
    saveUserRequests();

    addAuditEntry(request.userId, 'request_submitted', actor.userId, { requestId: request.id });
    notifyExternalSystem(request.id, 'submitted');

    res.json({ status: 'submitted', request });
  });

  app.post('/api/users/requests/:id/approve', requirePermission('users.verify'), async (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending-verification') {
      return res.status(400).json({ error: 'Request not pending verification' });
    }

    if (request.createdBy === actor.userId || request.submittedBy === actor.userId) {
      return res.status(403).json({ error: 'Cannot approve own request (separation of duties)' });
    }

    const knownProfiles = new Set(userManagementStore.profiles.map(profile => profile.profileId));
    const normalizedProfileIds = request.profileIds.filter(profileId => knownProfiles.has(profileId));

    const user = {
      userId: request.userId,
      email: request.email,
      displayName: request.displayName,
      enabled: true,
      employer: USER_ORGANIZATION_NAME,
      department: request.department,
      jobTitle: request.jobTitle,
      officeLocation: request.officeLocation,
      country: null,
      managerEmail: null,
      profileIds: normalizedProfileIds,
      groupIds: [],
      auth: null
    };

    userManagementStore.users.push(user);
    saveUserManagement();

    request.status = 'approved';
    request.approvedBy = actor.userId;
    request.approvedAt = new Date().toISOString();
    request.updatedAt = new Date().toISOString();
    saveUserRequests();

    addAuditEntry(request.userId, 'request_approved', actor.userId, { requestId: request.id });
    addAuditEntry(request.userId, 'user_created', actor.userId, { source: 'provisioning_workflow' });
    notifyExternalSystem(request.id, 'approved');

    res.json({ status: 'approved', request, user: sanitizeUserForApi(user) });
  });

  app.post('/api/users/requests/:id/reject', requirePermission('users.verify'), (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending-verification') {
      return res.status(400).json({ error: 'Request not pending verification' });
    }

    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    request.status = 'rejected';
    request.rejectedBy = actor.userId;
    request.rejectedAt = new Date().toISOString();
    request.rejectionReason = String(reason).trim();
    request.updatedAt = new Date().toISOString();
    saveUserRequests();

    addAuditEntry(request.userId, 'request_rejected', actor.userId, { requestId: request.id, reason });
    notifyExternalSystem(request.id, 'rejected', reason);

    res.json({ status: 'rejected', request });
  });

  app.post('/api/users/requests/:id/breakout', requirePermission('users.verify'), (req, res) => {
    const actor = resolveActor(req);
    const request = userRequestStore.requests.find(r => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending-verification') {
      return res.status(400).json({ error: 'Request not pending verification' });
    }

    const { reason } = req.body || {};

    request.status = 'terminated';
    request.terminatedBy = actor.userId;
    request.terminatedAt = new Date().toISOString();
    request.terminationReason = String(reason || 'Breakout executed').trim();
    request.updatedAt = new Date().toISOString();
    saveUserRequests();

    addAuditEntry(request.userId, 'request_terminated', actor.userId, { requestId: request.id, reason });
    notifyExternalSystem(request.id, 'terminated', reason);

    res.json({ status: 'terminated', request });
  });

  app.get('/api/users/:userId/audit', requirePermission('users.read'), (req, res) => {
    const userId = normalizeUserIdentifier(req.params.userId);
    const audits = userAuditStore.audits.filter(a => a.userId === userId);
    res.json({ userId, audits });
  });
}
