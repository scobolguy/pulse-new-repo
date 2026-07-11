export function registerIdentityRoutes(app, deps = {}) {
  const {
    normalizeUserIdentifier,
    getUserById,
    verifyPasswordRecord,
    createAuthSession,
    getSessionFromToken,
    resolveActor,
    AUTH_SESSION_TTL_MS,
    getBearerTokenFromRequest,
    clearSessionFromToken,
    getProfilesById,
    USER_ORGANIZATION_NAME,
    requirePermission,
    buildUserRoleContext,
    userManagementStore,
    groupProvider,
    refreshGroupPrivilegeCache,
    sanitizePermissions,
    saveUserManagement,
    sanitizeProfileIds,
    sanitizeUserForApi,
    monitorClassProvider,
    isAcceptedUserIdentifier,
    resolveDirectoryProfile,
    isValidEmailIdentifier,
    sanitizeGroupIds,
    createPasswordRecord,
    DEFAULT_ACTOR_USER_ID
  } = deps;

  app.post('/api/auth/login', (req, res) => {
    const body = req.body || {};
    const requestedId = normalizeUserIdentifier(body.userId || body.email);
    const password = String(body.password || '');
    if (!requestedId || !password) {
      return res.status(400).json({ error: 'userId and password are required' });
    }

    const user = getUserById(requestedId);
    if (!user || user.enabled === false || !verifyPasswordRecord(password, user.auth)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createAuthSession(user.userId);
    const session = getSessionFromToken(token);
    const actor = resolveActor({
      ...req,
      get: (headerName) => {
        const normalized = String(headerName || '').toLowerCase();
        if (normalized === 'authorization') return `Bearer ${token}`;
        if (typeof req.get === 'function') return req.get(headerName);
        return '';
      },
      query: {}
    });

    return res.json({
      ok: true,
      token,
      expiresAt: new Date(Number(session?.expiresAt || Date.now() + AUTH_SESSION_TTL_MS)).toISOString(),
      actor: {
        userId: actor.userId || user.userId,
        displayName: actor.user?.displayName || user.displayName || user.userId,
        enabled: actor.user?.enabled !== false,
        profileIds: actor.profileIds || user.profileIds || [],
        groupIds: actor.groupIds || []
      },
      permissions: actor.permissions || []
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getBearerTokenFromRequest(req);
    if (token) clearSessionFromToken(token);
    res.json({ ok: true, status: 'logged-out' });
  });

  app.get('/api/auth/session', (req, res) => {
    const token = getBearerTokenFromRequest(req);
    const session = getSessionFromToken(token);
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Session not found' });
    }
    const actor = resolveActor(req);
    return res.json({
      ok: true,
      actor: {
        userId: actor.userId,
        displayName: actor.user?.displayName || actor.userId,
        enabled: actor.user?.enabled === true,
        profileIds: actor.profileIds || [],
        groupIds: actor.groupIds || []
      },
      permissions: actor.permissions || [],
      expiresAt: new Date(Number(session.expiresAt || Date.now() + AUTH_SESSION_TTL_MS)).toISOString()
    });
  });

  app.get('/api/authz/me', (req, res) => {
    const actor = resolveActor(req);
    const profileMap = getProfilesById();
    const profiles = (actor.profileIds || [])
      .map(profileId => profileMap.get(profileId))
      .filter(Boolean);

    res.json({
      actor: {
        userId: actor.userId,
        displayName: actor.user?.displayName || null,
        enabled: actor.user?.enabled === true,
        profileIds: actor.profileIds || [],
        groupIds: actor.groupIds || [],
        employer: actor.user?.employer || USER_ORGANIZATION_NAME,
        department: actor.user?.department || null,
        jobTitle: actor.user?.jobTitle || null,
        officeLocation: actor.user?.officeLocation || null,
        country: actor.user?.country || null,
        managerEmail: actor.user?.managerEmail || null
      },
      profiles,
      permissions: actor.permissions
    });
  });

  app.get('/api/events/mermaid', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let phase = 0;
    const send = () => {
      phase = (phase + 1) % 1024;
      res.write(`event: mermaid\n`);
      res.write(`data: ${JSON.stringify({ phase, at: Date.now() })}\n\n`);
    };

    send();
    const timer = setInterval(send, 1000);

    const close = () => {
      clearInterval(timer);
      try {
        res.end();
      } catch {
        // ignore close errors on disconnected clients
      }
    };

    req.on('close', close);
    req.on('aborted', close);
  });

  app.get('/api/authz/context', requirePermission('lifecycle.read'), (req, res) => {
    const actor = req.actor || resolveActor(req);
    const context = buildUserRoleContext(actor.userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({ context });
  });

  app.get('/api/users/:userId/context', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({ context });
  });

  app.get('/api/users/:userId/employer', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({
      userId: context.userId,
      employer: context.employment?.employer || USER_ORGANIZATION_NAME,
      department: context.employment?.department || null,
      country: context.employment?.country || null,
      officeLocation: context.employment?.officeLocation || null
    });
  });

  app.get('/api/users/:userId/roles', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({
      userId: context.userId,
      roles: context.roles,
      permissions: context.permissions,
      persona: context.persona
    });
  });

  app.get('/api/users/profiles', requirePermission('users.read'), (req, res) => {
    res.json({ profiles: userManagementStore.profiles });
  });

  app.get('/api/users/groups', requirePermission('users.read'), async (req, res) => {
    try {
      const includeDeletedValue = String(req.query.includeDeleted || '').trim().toLowerCase();
      const includeDeleted = includeDeletedValue === '1' || includeDeletedValue === 'true' || includeDeletedValue === 'yes';
      const groups = await groupProvider.listGroups({ includeDeleted });
      res.json({ groups });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/users/groups', requirePermission('users.manage'), async (req, res) => {
    try {
      const { groupId, label, description, privileges } = req.body || {};
      const id = String(groupId || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const group = await groupProvider.createGroup({
        groupId: id,
        label: String(label || id).trim(),
        description: String(description || '').trim(),
        privileges: Array.isArray(privileges) ? privileges : []
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'created', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('already exists')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/users/groups/:groupId', requirePermission('users.manage'), async (req, res) => {
    try {
      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const updates = req.body || {};
      const group = await groupProvider.updateGroup(groupId, {
        label: updates.label,
        description: updates.description,
        privileges: updates.privileges
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'updated', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.toLowerCase().includes('soft-deleted')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/users/groups/:groupId', requirePermission('users.manage'), async (req, res) => {
    try {
      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const actor = resolveActor(req);
      const group = await groupProvider.softDeleteGroup(groupId, {
        deletedBy: actor?.userId || 'system-admin'
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'soft-deleted', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/users/profiles', requirePermission('users.manage'), (req, res) => {
    const { profileId, label, description, permissions } = req.body || {};
    const id = String(profileId || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'profileId is required' });
    }
    if (userManagementStore.profiles.some(profile => profile.profileId === id)) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    const profile = {
      profileId: id,
      label: String(label || id).trim(),
      description: String(description || '').trim(),
      permissions: sanitizePermissions(permissions)
    };

    userManagementStore.profiles.push(profile);
    saveUserManagement();
    res.json({ status: 'created', profile });
  });

  app.patch('/api/users/profiles/:profileId', requirePermission('users.manage'), (req, res) => {
    const profileId = String(req.params.profileId || '').trim();
    const profile = userManagementStore.profiles.find(item => item.profileId === profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      profile.label = String(updates.label || profile.profileId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      profile.description = String(updates.description || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'permissions')) {
      profile.permissions = sanitizePermissions(updates.permissions);
    }

    saveUserManagement();
    res.json({ status: 'updated', profile });
  });

  app.delete('/api/users/profiles/:profileId', requirePermission('users.manage'), (req, res) => {
    const profileId = String(req.params.profileId || '').trim();
    if (profileId === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin profile' });
    }

    const beforeCount = userManagementStore.profiles.length;
    userManagementStore.profiles = userManagementStore.profiles.filter(profile => profile.profileId !== profileId);
    if (userManagementStore.profiles.length === beforeCount) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    for (const user of userManagementStore.users) {
      user.profileIds = sanitizeProfileIds((user.profileIds || []).filter(id => id !== profileId));
    }

    saveUserManagement();
    res.json({ status: 'deleted', profileId });
  });

  app.get('/api/users', requirePermission('users.read'), (req, res) => {
    res.json({ users: userManagementStore.users.map((user) => sanitizeUserForApi(user)).filter(Boolean) });
  });

  app.get('/api/operations/monitor/classes', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const includeDisabledValue = String(req.query.includeDisabled || '').trim().toLowerCase();
      const includeDeletedValue = String(req.query.includeDeleted || '').trim().toLowerCase();
      const includeDisabled = includeDisabledValue === '1' || includeDisabledValue === 'true' || includeDisabledValue === 'yes';
      const includeDeleted = includeDeletedValue === '1' || includeDeletedValue === 'true' || includeDeletedValue === 'yes';
      const classes = await monitorClassProvider.listClasses({ includeDisabled, includeDeleted });
      res.json({ classes });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/operations/monitor/classes', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const { classId, label, description, enabled, sortOrder } = req.body || {};
      const created = await monitorClassProvider.createClass({
        classId,
        label,
        description,
        enabled,
        sortOrder
      });
      res.json({ status: 'created', class: created });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('exists')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/operations/monitor/classes/:classId', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const classId = String(req.params.classId || '').trim();
      if (!classId) {
        return res.status(400).json({ error: 'classId is required' });
      }
      const updates = req.body || {};
      const updated = await monitorClassProvider.updateClass(classId, updates);
      res.json({ status: 'updated', class: updated });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.toLowerCase().includes('deleted')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/operations/monitor/classes/:classId', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const classId = String(req.params.classId || '').trim();
      if (!classId) {
        return res.status(400).json({ error: 'classId is required' });
      }
      const actor = resolveActor(req);
      const deleted = await monitorClassProvider.softDeleteClass(classId, {
        deletedBy: actor?.userId || 'system-admin'
      });
      res.json({ status: 'soft-deleted', class: deleted });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/users', requirePermission('users.manage'), async (req, res) => {
    const { userId, email, displayName, enabled, profileIds, groupIds, password } = req.body || {};
    const id = normalizeUserIdentifier(email || userId);
    if (!id) {
      return res.status(400).json({ error: 'userId or email is required' });
    }
    if (!isAcceptedUserIdentifier(id)) {
      return res.status(400).json({ error: 'User identifier must be a valid email address or supported user ID' });
    }
    if (userManagementStore.users.some(user => user.userId === id)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const knownProfiles = new Set(userManagementStore.profiles.map(profile => profile.profileId));
    const normalizedProfileIds = sanitizeProfileIds(profileIds).filter(profileId => knownProfiles.has(profileId));
    const directoryProfile = await resolveDirectoryProfile(id);

    const user = {
      userId: id,
      email: isValidEmailIdentifier(email || userId) ? normalizeUserIdentifier(email || userId) : null,
      displayName: String(displayName || directoryProfile.displayName || id).trim(),
      enabled: enabled !== false,
      employer: USER_ORGANIZATION_NAME,
      department: String(directoryProfile.department || 'Operations').trim() || 'Operations',
      jobTitle: String(directoryProfile.jobTitle || 'Operations Analyst').trim() || 'Operations Analyst',
      officeLocation: String(directoryProfile.officeLocation || 'HQ').trim() || 'HQ',
      country: null,
      managerEmail: directoryProfile.managerEmail,
      profileIds: normalizedProfileIds,
      groupIds: sanitizeGroupIds(groupIds),
      auth: String(password || '').trim() ? createPasswordRecord(String(password)) : null
    };

    userManagementStore.users.push(user);
    saveUserManagement();
    res.json({ status: 'created', user: sanitizeUserForApi(user) });
  });

  app.patch('/api/users/:userId', requirePermission('users.manage'), async (req, res) => {
    const userId = normalizeUserIdentifier(req.params.userId);
    const user = userManagementStore.users.find(item => item.userId === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
      user.displayName = String(updates.displayName || user.userId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
      const nextEmail = normalizeUserIdentifier(updates.email);
      if (!isValidEmailIdentifier(nextEmail)) {
        return res.status(400).json({ error: 'email must be a valid email address' });
      }
      if (nextEmail !== user.userId && userManagementStore.users.some(item => item.userId === nextEmail)) {
        return res.status(409).json({ error: 'User already exists' });
      }
      user.email = nextEmail;
      if (user.userId !== DEFAULT_ACTOR_USER_ID) {
        user.userId = nextEmail;
      }
    } else {
      user.email = isValidEmailIdentifier(user.userId) ? user.userId : (user.email || null);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
      user.enabled = updates.enabled === true;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
      user.department = String(updates.department || '').trim() || 'Operations';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'employer')) {
      user.employer = String(updates.employer || USER_ORGANIZATION_NAME).trim() || USER_ORGANIZATION_NAME;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'jobTitle')) {
      user.jobTitle = String(updates.jobTitle || '').trim() || 'Operations Analyst';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'officeLocation')) {
      user.officeLocation = String(updates.officeLocation || '').trim() || 'HQ';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'managerEmail')) {
      const managerEmail = String(updates.managerEmail || '').trim().toLowerCase();
      user.managerEmail = managerEmail && isValidEmailIdentifier(managerEmail) ? managerEmail : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'country')) {
      const country = String(updates.country || '').trim();
      user.country = country || null;
    }
    if (updates.refreshDirectory === true) {
      const lookupEmail = normalizeUserIdentifier(
        updates.email || user.email || (isValidEmailIdentifier(user.userId) ? user.userId : '')
      );
      if (!isValidEmailIdentifier(lookupEmail)) {
        return res.status(400).json({ error: 'Cannot refresh directory data without a valid email address' });
      }
      const directoryProfile = await resolveDirectoryProfile(lookupEmail);
      user.email = lookupEmail;
      if (user.userId !== DEFAULT_ACTOR_USER_ID) {
        user.userId = lookupEmail;
      }
      user.displayName = String(directoryProfile.displayName || user.displayName || lookupEmail).trim();
      user.department = String(directoryProfile.department || 'Operations').trim() || 'Operations';
      user.jobTitle = String(directoryProfile.jobTitle || 'Operations Analyst').trim() || 'Operations Analyst';
      user.officeLocation = String(directoryProfile.officeLocation || 'HQ').trim() || 'HQ';
      user.managerEmail = directoryProfile.managerEmail || null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'profileIds')) {
      const knownProfiles = new Set(userManagementStore.profiles.map(profile => profile.profileId));
      user.profileIds = sanitizeProfileIds(updates.profileIds).filter(profileId => knownProfiles.has(profileId));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'groupIds')) {
      user.groupIds = sanitizeGroupIds(updates.groupIds);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'password')) {
      const nextPassword = String(updates.password || '');
      user.auth = nextPassword.trim() ? createPasswordRecord(nextPassword) : null;
    }

    saveUserManagement();
    res.json({ status: 'updated', user: sanitizeUserForApi(user) });
  });

  app.delete('/api/users/:userId', requirePermission('users.manage'), (req, res) => {
    const userId = normalizeUserIdentifier(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (userId === DEFAULT_ACTOR_USER_ID) {
      return res.status(400).json({ error: 'Cannot delete system admin user' });
    }

    const beforeCount = userManagementStore.users.length;
    userManagementStore.users = userManagementStore.users.filter(user => user.userId !== userId);
    if (userManagementStore.users.length === beforeCount) {
      return res.status(404).json({ error: 'User not found' });
    }

    saveUserManagement();
    res.json({ status: 'deleted', userId });
  });
}
