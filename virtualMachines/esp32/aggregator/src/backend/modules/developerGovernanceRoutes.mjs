export function registerDeveloperGovernanceRoutes(app, deps = {}) {
  const {
    requirePermission,
    enumerateApiCatalog,
    processGovernanceStore,
    getProcessPolicyById,
    saveProcessGovernance,
    pendingApprovalRequests,
    appendAuditEvent
  } = deps;

  let mockVmState = {
    pc: 0,
    sp: 0,
    stack: [],
    variables: {},
    running: false,
    lastInstruction: null
  };

  app.get('/api/develop/vm/state', requirePermission('develop.read'), (req, res) => {
    res.json({ state: mockVmState });
  });

  app.post('/api/develop/vm/step', requirePermission('develop.execute'), (req, res) => {
    mockVmState.pc += 1;
    mockVmState.lastInstruction = `INSTR_${mockVmState.pc}`;
    res.json({ status: 'stepped', state: mockVmState });
  });

  app.post('/api/develop/vm/reset', requirePermission('develop.execute'), (req, res) => {
    mockVmState = {
      pc: 0,
      sp: 0,
      stack: [],
      variables: {},
      running: false,
      lastInstruction: null
    };
    res.json({ status: 'reset', state: mockVmState });
  });

  app.post('/api/develop/vm/run', requirePermission('develop.execute'), (req, res) => {
    mockVmState.running = true;
    mockVmState.pc = 100;
    mockVmState.running = false;
    res.json({ status: 'completed', state: mockVmState });
  });

  let mockTestResults = {
    timestamp: new Date().toISOString(),
    tests: [
      { id: 'test-1', name: 'Basic Operations', status: 'passed', duration: 45 },
      { id: 'test-2', name: 'Stack Operations', status: 'passed', duration: 32 },
      { id: 'test-3', name: 'Variable Assignment', status: 'passed', duration: 28 }
    ],
    summary: { total: 3, passed: 3, failed: 0, duration: 105 }
  };

  app.get('/api/develop/tests/results', requirePermission('develop.read'), (req, res) => {
    res.json(mockTestResults);
  });

  app.post('/api/develop/tests/run', requirePermission('develop.execute'), (req, res) => {
    mockTestResults.timestamp = new Date().toISOString();
    res.json({ status: 'running', results: mockTestResults });
  });

  app.post('/api/develop/tests/run/:testId', requirePermission('develop.execute'), (req, res) => {
    const testId = req.params.testId;
    const test = mockTestResults.tests.find(t => t.id === testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    return res.json({ status: 'running', test });
  });

  const developmentLogs = [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Development server started' },
    { timestamp: new Date().toISOString(), level: 'info', message: 'VM initialized' }
  ];

  app.get('/api/develop/logs', requirePermission('develop.read'), (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 100;
    const level = req.query.level;

    let logs = developmentLogs;
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    res.json({ logs: logs.slice(-limit) });
  });

  app.get('/api/develop/api-catalog', requirePermission('develop.read'), (req, res) => {
    const catalog = enumerateApiCatalog();
    res.json({ endpoints: catalog });
  });

  app.get('/api/governance/processes', requirePermission('governance.read'), (req, res) => {
    res.json({
      processes: processGovernanceStore.processes,
      updatedAt: processGovernanceStore.updatedAt,
      version: processGovernanceStore.version
    });
  });

  app.patch('/api/governance/processes/:processId', requirePermission('governance.manage'), (req, res) => {
    const processId = String(req.params.processId || '').trim();
    const process = getProcessPolicyById(processId);
    if (!process) {
      return res.status(404).json({ error: 'Process policy not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      process.label = String(updates.label || process.processId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'requiresTwoPersonRule')) {
      process.requiresTwoPersonRule = updates.requiresTwoPersonRule === true;
    }

    saveProcessGovernance();
    res.json({ status: 'updated', process });
  });

  app.get('/api/governance/approvals', requirePermission('governance.read'), (req, res) => {
    const now = Date.now();
    const approvals = Array.from(pendingApprovalRequests.values())
      .filter(item => Number(item.expiresAt || 0) > now)
      .map(item => ({
        approvalId: item.approvalId,
        processId: item.processId,
        requestedByUserId: item.requestedByUserId,
        requestedAt: item.requestedAt,
        expiresAt: new Date(Number(item.expiresAt)).toISOString(),
        method: item.method,
        path: item.path,
        body: item.body
      }))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    res.json({ approvals, count: approvals.length });
  });

  app.delete('/api/governance/approvals/:approvalId', requirePermission('governance.manage'), (req, res) => {
    const approvalId = String(req.params.approvalId || '').trim();
    if (!pendingApprovalRequests.has(approvalId)) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    pendingApprovalRequests.delete(approvalId);
    appendAuditEvent({
      eventType: 'approval-cancelled',
      requestId: req.requestId || null,
      approvalId,
      cancelledByUserId: req.actor?.userId || null
    });
    res.json({ status: 'cancelled', approvalId });
  });
}
