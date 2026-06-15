import React, { useEffect, useMemo, useRef, useState } from 'react';
import SharedBlockWorkspace from './SharedBlockWorkspace';

const STORAGE_KEY = 'pulse-project-planner-visual-graph';
const GRID_SIZE = 32;
const BLOCK_WIDTH = 224;
const BLOCK_HEIGHT = 92;

const PROJECT_BLOCKS = [
  { kind: 'project', label: 'Project Plan', tone: '#22c55e' },
  { kind: 'milestone', label: 'Milestone', tone: '#38bdf8' },
  { kind: 'task', label: 'Task', tone: '#f59e0b' },
  { kind: 'subtask', label: 'Subtask', tone: '#fb923c' },
  { kind: 'resource', label: 'Resource', tone: '#c084fc' },
  { kind: 'deliverable', label: 'Deliverable', tone: '#14b8a6' },
  { kind: 'artifact', label: 'Artifact', tone: '#06b6d4' },
  { kind: 'synchpoint', label: 'Synchpoint', tone: '#fb7185' }
];

const TASK_STATUS = ['not-started', 'in-progress', 'completed'];

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function inferPercentFromStatus(status, currentPercent = 0) {
  if (status === 'completed') return 100;
  if (status === 'not-started') return 0;
  return clampPercent(currentPercent || 0);
}

function buildNodeDefaults(kind) {
  if (kind === 'project') {
    return { description: 'Cross-team delivery plan aligned to PMBOK process groups', projectState: 'projectId', planState: 'projectPlanId' };
  }
  if (kind === 'milestone') {
    return { description: 'Lock architecture and interfaces', dueDate: '2026-07-15', stateKey: 'milestone_design_freeze', status: 'not-started', percentComplete: 0 };
  }
  if (kind === 'task') {
    return { description: 'Primary project task', assignee: 'project-manager', stateKey: 'task_primary', status: 'not-started', percentComplete: 0 };
  }
  if (kind === 'subtask') {
    return { description: 'Detailed execution step', assignee: 'team-member', stateKey: 'subtask_detail', parentTaskState: '', status: 'not-started', percentComplete: 0 };
  }
  if (kind === 'resource') {
    return { description: 'Allocated team/capacity', resourceType: 'team', stateKey: 'resource_team' };
  }
  if (kind === 'deliverable') {
    return { description: 'Outcome delivered to stakeholders', stateKey: 'deliverable_item', status: 'not-started', percentComplete: 0 };
  }
  if (kind === 'artifact') {
    return { description: 'Published repository artifact', artifactType: 'document', repositoryPath: '/documents', publishStep: 'commit-and-publish', stateKey: 'artifact_item', status: 'not-started', percentComplete: 0 };
  }
  return { description: 'Coordination checkpoint', stateKey: 'synchpoint_weekly_steering' };
}

function snapToGrid(value) {
  return Math.max(GRID_SIZE, Math.round(value / GRID_SIZE) * GRID_SIZE);
}

function slugify(value, fallback = 'item') {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function createProjectNode(kind, index, x, y) {
  const id = `pm_${Date.now()}_${Math.floor(Math.random() * 100000)}_${index}`;
  const defaults = {
    project: { title: 'Migration Execution Plan', data: { description: 'Cross-team delivery plan', projectState: 'projectId', planState: 'projectPlanId' } },
    milestone: { title: 'Design Freeze', data: { description: 'Lock architecture and interfaces', dueDate: '2026-07-15', stateKey: 'milestone_design_freeze' } },
    task: { title: 'Routing Editor', data: { description: 'Implement route and transform planner views', assignee: 'project-manager', stateKey: 'task_routing_editor' } },
    subtask: { title: 'Draft Stakeholder Matrix', data: { description: 'Capture influence, ownership, and communication cadence', assignee: 'business-analyst', stateKey: 'subtask_stakeholder_matrix', parentTaskState: 'task_identify_stakeholders', status: 'not-started', percentComplete: 0 } },
    resource: { title: 'QA Automation Team', data: { description: 'Regression and acceptance coverage', resourceType: 'team', stateKey: 'resource_qa_team' } },
    deliverable: { title: 'Operational Runbook', data: { description: 'Approved deployment and rollback runbook', stateKey: 'deliverable_runbook' } },
    artifact: { title: 'Stakeholder Register', data: { description: 'Versioned stakeholder list for project governance', artifactType: 'document', repositoryPath: '/documents/pmbok/stakeholder-register.md', publishStep: 'publish-stakeholder-register', stateKey: 'artifact_stakeholder_register', status: 'not-started', percentComplete: 0 } },
    synchpoint: { title: 'Weekly Steering', data: { description: 'Cross-team risk review', stateKey: 'synchpoint_weekly_steering' } }
  };
  const col = index % 3;
  const row = Math.floor(index / 3);
  const config = defaults[kind] || defaults.project;
  const data = { ...buildNodeDefaults(kind), ...(config.data || {}) };
  if (typeof data.status === 'string') {
    data.percentComplete = inferPercentFromStatus(data.status, data.percentComplete);
  }
  return {
    id,
    kind,
    title: config.title,
    x: snapToGrid(x ?? (96 + (col * 320))),
    y: snapToGrid(y ?? (96 + (row * 184))),
    data
  };
}

function createDefaultGraph() {
  return createPmbokTemplateGraph();
}

function createPmbokTemplateGraph() {
  const project = createProjectNode('project', 0, 96, 96);
  project.title = 'PMBOK Project Template';
  project.data.description = 'Integrated project management plan following PMBOK process groups.';
  project.data.planState = 'pmbokPlanState';

  const milestoneInitiate = createProjectNode('milestone', 1, 448, 64);
  milestoneInitiate.title = 'Initiation Complete';
  milestoneInitiate.data.dueDate = '2026-07-01';
  milestoneInitiate.data.stateKey = 'milestone_initiation_complete';
  milestoneInitiate.data.description = 'Charter approved, sponsor aligned, governance initiated.';

  const milestonePlan = createProjectNode('milestone', 2, 448, 224);
  milestonePlan.title = 'Planning Baseline Approved';
  milestonePlan.data.dueDate = '2026-07-21';
  milestonePlan.data.stateKey = 'milestone_planning_baseline';
  milestonePlan.data.description = 'Scope, schedule, quality, risk, and communications baselined.';

  const taskStakeholders = createProjectNode('task', 3, 800, 64);
  taskStakeholders.title = 'Identify Stakeholders';
  taskStakeholders.data.stateKey = 'task_identify_stakeholders';
  taskStakeholders.data.assignee = 'project-manager';
  taskStakeholders.data.description = 'Identify and classify stakeholders, interests, and engagement approach.';

  const subtaskMapInfluence = createProjectNode('subtask', 4, 1160, 24);
  subtaskMapInfluence.title = 'Map Influence and Interest';
  subtaskMapInfluence.data.parentTaskState = 'task_identify_stakeholders';
  subtaskMapInfluence.data.stateKey = 'subtask_map_influence_interest';
  subtaskMapInfluence.data.assignee = 'business-analyst';
  subtaskMapInfluence.data.description = 'Build interest/influence matrix for each stakeholder group.';

  const subtaskCommsPlan = createProjectNode('subtask', 5, 1160, 184);
  subtaskCommsPlan.title = 'Define Communication Cadence';
  subtaskCommsPlan.data.parentTaskState = 'task_identify_stakeholders';
  subtaskCommsPlan.data.stateKey = 'subtask_define_communications';
  subtaskCommsPlan.data.assignee = 'project-manager';
  subtaskCommsPlan.data.description = 'Set communications channels, frequency, and decision forums.';

  const artifactRegister = createProjectNode('artifact', 6, 1520, 24);
  artifactRegister.title = 'Stakeholder Register Artifact';
  artifactRegister.data.stateKey = 'artifact_stakeholder_register';
  artifactRegister.data.repositoryPath = '/documents/project/stakeholder-register.md';
  artifactRegister.data.publishStep = 'publish-stakeholder-register';
  artifactRegister.data.description = 'Publish stakeholder register artifact to project repository.';

  const artifactComms = createProjectNode('artifact', 7, 1520, 184);
  artifactComms.title = 'Stakeholder Communication Plan';
  artifactComms.data.stateKey = 'artifact_stakeholder_comms_plan';
  artifactComms.data.repositoryPath = '/documents/project/stakeholder-communications-plan.md';
  artifactComms.data.publishStep = 'publish-communications-plan';
  artifactComms.data.description = 'Publish communications plan artifact to project repository.';

  const resource = createProjectNode('resource', 8, 800, 320);
  resource.title = 'PMO + BA Team';
  resource.data.stateKey = 'resource_pmo_ba_team';
  resource.data.resourceType = 'team';

  const deliverable = createProjectNode('deliverable', 9, 1160, 340);
  deliverable.title = 'Stakeholder Alignment Package';
  deliverable.data.stateKey = 'deliverable_stakeholder_alignment';
  deliverable.data.description = 'Combined register and communication plan approved by sponsor.';

  const synchpoint = createProjectNode('synchpoint', 10, 1520, 340);
  synchpoint.title = 'Steering Committee Review';
  synchpoint.data.stateKey = 'synchpoint_steering_review';
  synchpoint.data.description = 'Review and approve stakeholder artifacts for execution readiness.';

  const nodes = [
    project,
    milestoneInitiate,
    milestonePlan,
    taskStakeholders,
    subtaskMapInfluence,
    subtaskCommsPlan,
    artifactRegister,
    artifactComms,
    resource,
    deliverable,
    synchpoint
  ];

  const edges = [
    { id: `e_${project.id}_${milestoneInitiate.id}`, from: project.id, to: milestoneInitiate.id, label: 'phase gate' },
    { id: `e_${project.id}_${milestonePlan.id}`, from: project.id, to: milestonePlan.id, label: 'phase gate' },
    { id: `e_${milestoneInitiate.id}_${taskStakeholders.id}`, from: milestoneInitiate.id, to: taskStakeholders.id, label: 'enables' },
    { id: `e_${taskStakeholders.id}_${subtaskMapInfluence.id}`, from: taskStakeholders.id, to: subtaskMapInfluence.id, label: 'decompose' },
    { id: `e_${taskStakeholders.id}_${subtaskCommsPlan.id}`, from: taskStakeholders.id, to: subtaskCommsPlan.id, label: 'decompose' },
    { id: `e_${subtaskMapInfluence.id}_${artifactRegister.id}`, from: subtaskMapInfluence.id, to: artifactRegister.id, label: 'produces' },
    { id: `e_${subtaskCommsPlan.id}_${artifactComms.id}`, from: subtaskCommsPlan.id, to: artifactComms.id, label: 'produces' },
    { id: `e_${project.id}_${resource.id}`, from: project.id, to: resource.id, label: 'staffs' },
    { id: `e_${artifactRegister.id}_${deliverable.id}`, from: artifactRegister.id, to: deliverable.id, label: 'contributes' },
    { id: `e_${artifactComms.id}_${deliverable.id}`, from: artifactComms.id, to: deliverable.id, label: 'contributes' },
    { id: `e_${deliverable.id}_${synchpoint.id}`, from: deliverable.id, to: synchpoint.id, label: 'review' }
  ];

  return { nodes, edges };
}

function normalizeNode(rawNode, index = 0) {
  const kind = rawNode?.kind || 'task';
  const base = buildNodeDefaults(kind);
  const data = { ...base, ...(rawNode?.data || {}) };
  if (typeof data.percentComplete !== 'undefined') {
    data.percentComplete = clampPercent(data.percentComplete);
  }
  if (typeof data.status === 'string') {
    data.percentComplete = inferPercentFromStatus(data.status, data.percentComplete);
  }
  return {
    id: rawNode?.id || `pm_import_${Date.now()}_${index}`,
    kind,
    title: rawNode?.title || 'Untitled',
    x: snapToGrid(rawNode?.x ?? (96 + ((index % 3) * 320))),
    y: snapToGrid(rawNode?.y ?? (96 + (Math.floor(index / 3) * 184))),
    data
  };
}

function normalizeGraph(rawGraph) {
  if (!rawGraph || !Array.isArray(rawGraph.nodes) || !Array.isArray(rawGraph.edges)) return null;
  const nodes = rawGraph.nodes.map((node, index) => normalizeNode(node, index));
  const idSet = new Set(nodes.map((node) => node.id));
  const edges = rawGraph.edges
    .filter((edge) => idSet.has(edge?.from) && idSet.has(edge?.to))
    .map((edge, index) => ({
      id: edge?.id || `e_import_${Date.now()}_${index}`,
      from: edge.from,
      to: edge.to,
      label: typeof edge?.label === 'string' ? edge.label : ''
    }));
  return { nodes, edges };
}

function deriveNodeStatus(node) {
  const status = node?.data?.status;
  if (status === 'completed' || status === 'in-progress' || status === 'not-started') return status;
  const pct = clampPercent(node?.data?.percentComplete || 0);
  if (pct >= 100) return 'completed';
  if (pct > 0) return 'in-progress';
  return 'not-started';
}

function nodeCompletionPercent(node) {
  const status = deriveNodeStatus(node);
  if (status === 'completed') return 100;
  if (status === 'not-started') return 0;
  return clampPercent(node?.data?.percentComplete || 0);
}

function computePlanMetrics(nodes) {
  const executionNodes = nodes.filter((node) => node.kind === 'task' || node.kind === 'subtask' || node.kind === 'deliverable' || node.kind === 'artifact');
  const taskNodes = nodes.filter((node) => node.kind === 'task' || node.kind === 'subtask');
  const totalUnits = executionNodes.length;
  const completedUnits = executionNodes.filter((node) => nodeCompletionPercent(node) >= 100).length;
  const totalTasks = taskNodes.length;
  const completedTasks = taskNodes.filter((node) => nodeCompletionPercent(node) >= 100).length;
  const taskCompletionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const weightedPercent = totalUnits === 0 ? 0 : Math.round(executionNodes.reduce((sum, node) => sum + nodeCompletionPercent(node), 0) / totalUnits);
  return {
    totalUnits,
    completedUnits,
    totalTasks,
    completedTasks,
    taskCompletionPercent,
    weightedPercent,
    completedTaskItems: taskNodes
      .filter((node) => nodeCompletionPercent(node) >= 100)
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        status: deriveNodeStatus(node),
        percentComplete: nodeCompletionPercent(node),
        stateKey: node?.data?.stateKey || ''
      })),
    completedItems: executionNodes
      .filter((node) => nodeCompletionPercent(node) >= 100)
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        status: deriveNodeStatus(node),
        percentComplete: nodeCompletionPercent(node),
        stateKey: node?.data?.stateKey || ''
      }))
  };
}

function summarizeNode(node) {
  if (node.kind === 'project') return node.data.description || 'Project plan';
  if (node.kind === 'milestone') return `${node.data.dueDate || 'date'}\n${node.data.description || ''}`.trim();
  if (node.kind === 'task' || node.kind === 'subtask') return `${node.data.assignee || 'owner'}\n${node.data.status || 'not-started'} ${nodeCompletionPercent(node)}%\n${node.data.description || ''}`.trim();
  if (node.kind === 'resource') return `${node.data.resourceType || 'type'}\n${node.data.description || ''}`.trim();
  if (node.kind === 'artifact') return `${node.data.repositoryPath || '/documents'}\n${node.data.status || 'not-started'} ${nodeCompletionPercent(node)}%`.trim();
  if (node.kind === 'deliverable') return `${node.data.status || 'not-started'} ${nodeCompletionPercent(node)}%\n${node.data.description || ''}`.trim();
  return node.data.description || '';
}

function buildMermaid(nodes, edges) {
  const lines = ['flowchart TD'];
  for (const node of nodes) {
    const label = `${node.title}${summarizeNode(node) ? `\\n${summarizeNode(node)}` : ''}`.replace(/"/g, '\\"');
    const shape = node.kind === 'milestone' ? `${node.id}{${label}}` : `${node.id}[${label}]`;
    lines.push(`  ${shape}`);
  }
  for (const edge of edges) {
    if (edge.label) lines.push(`  ${edge.from} -->|${String(edge.label).replace(/"/g, '\\"')}| ${edge.to}`);
    else lines.push(`  ${edge.from} --> ${edge.to}`);
  }
  return lines.join('\n');
}

function MermaidPreview({ source }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!hostRef.current) return;
      try {
        const { default: mermaid } = await import('mermaid');
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
        const { svg } = await mermaid.render(`project-plan-${Date.now()}`, source || 'flowchart TD\nA[Empty]');
        if (!cancelled && hostRef.current) hostRef.current.innerHTML = svg;
      } catch (error) {
        if (!cancelled && hostRef.current) {
          hostRef.current.innerHTML = `<pre style="color:#fecaca;white-space:pre-wrap;">Mermaid render failed: ${String(error?.message || error)}</pre>`;
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <div ref={hostRef} style={{ minHeight: 260 }} />;
}

function sortNodes(nodes) {
  return [...nodes].sort((left, right) => (left.y - right.y) || (left.x - right.x));
}

function buildProjectPlanSource(nodes) {
  const sortedNodes = sortNodes(nodes);
  const project = sortedNodes.find((node) => node.kind === 'project') || sortedNodes[0];
  const projectState = project?.data.projectState || 'projectId';
  const planState = project?.data.planState || 'projectPlanId';
  const lines = ['WORKFLOW "project-planner-board" BEGIN'];

  if (project) {
    lines.push(`  STEP "create-project-plan" PROJECTPLAN CREATE NAME "${project.title}" DESCRIPTION "${project.data.description || 'Project plan'}" FOR PROJECT STATE "${projectState}" INTO STATE "${planState}";`);
  }

  for (const node of sortedNodes) {
    if (node.kind === 'project') continue;
    const stateKey = node.data.stateKey || `${node.kind}_${slugify(node.title, node.kind)}`;
    const stepSlug = slugify(node.title, node.kind);
    const status = deriveNodeStatus(node);
    const percent = nodeCompletionPercent(node);
    const statusSuffix = ` [status:${status};percent:${percent}]`;
    if (node.kind === 'milestone') {
      lines.push(`  STEP "create-${stepSlug}" MILESTONE CREATE NAME "${node.title}" DESCRIPTION "${(node.data.description || '') + statusSuffix}" DUE DATE "${node.data.dueDate || '2026-07-15'}" INTO STATE "${stateKey}";`);
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD MILESTONE STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'task') {
      const assignee = node.data.assignee ? ` ASSIGN USER "${node.data.assignee}"` : '';
      lines.push(`  STEP "create-${stepSlug}" TASK CREATE NAME "${node.title}" DESCRIPTION "${(node.data.description || '') + statusSuffix}"${assignee} INTO STATE "${stateKey}";`);
      const taskArtifacts = String(node.data.artifacts || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      for (const artifactFile of taskArtifacts) {
        lines.push(`  // Task artifact: ${artifactFile}`);
        if (node.data.publishToRepository) {
          lines.push(`  // Publish artifact to repository: ${artifactFile}`);
        }
      }
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD TASK STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'subtask') {
      const assignee = node.data.assignee ? ` ASSIGN USER "${node.data.assignee}"` : '';
      const parentText = node.data.parentTaskState ? ` [parent:${node.data.parentTaskState}]` : '';
      lines.push(`  STEP "create-${stepSlug}" TASK CREATE NAME "${node.title}" DESCRIPTION "${(node.data.description || '') + parentText + statusSuffix}"${assignee} INTO STATE "${stateKey}";`);
      const subtaskArtifacts = String(node.data.artifacts || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      for (const artifactFile of subtaskArtifacts) {
        lines.push(`  // Subtask artifact: ${artifactFile}`);
        if (node.data.publishToRepository) {
          lines.push(`  // Publish artifact to repository: ${artifactFile}`);
        }
      }
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD TASK STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'resource') {
      lines.push(`  STEP "create-${stepSlug}" RESOURCE CREATE NAME "${node.title}" RESOURCE TYPE "${node.data.resourceType || 'team'}" DESCRIPTION "${node.data.description || ''}" INTO STATE "${stateKey}";`);
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD RESOURCE STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'deliverable') {
      lines.push(`  STEP "create-${stepSlug}" DELIVERABLE CREATE NAME "${node.title}" DESCRIPTION "${(node.data.description || '') + statusSuffix}" INTO STATE "${stateKey}";`);
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD DELIVERABLE STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'artifact') {
      const artifactDescription = `${node.data.description || ''} [artifactType:${node.data.artifactType || 'document'};repo:${node.data.repositoryPath || '/documents'};publish:${node.data.publishStep || 'publish-artifact'}]${statusSuffix}`;
      lines.push(`  STEP "create-${stepSlug}" DELIVERABLE CREATE NAME "${node.title}" DESCRIPTION "${artifactDescription}" INTO STATE "${stateKey}";`);
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD DELIVERABLE STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    } else if (node.kind === 'synchpoint') {
      lines.push(`  STEP "create-${stepSlug}" SYNCHPOINT CREATE NAME "${node.title}" DESCRIPTION "${node.data.description || ''}" INTO STATE "${stateKey}";`);
      lines.push(`  STEP "add-${stepSlug}" PROJECTPLAN ADD SYNCHPOINT STATE "${stateKey}" TO PLAN STATE "${planState}";`);
    }
  }

  lines.push('END;');
  return lines.join('\n');
}

export default function ProjectPlannerVisualTool() {
  const canvasRef = useRef(null);
  const importInputRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [connectFrom, setConnectFrom] = useState('');
  const [connectTo, setConnectTo] = useState('');
  const [connectLabel, setConnectLabel] = useState('');
  const [dragState, setDragState] = useState(null);
  const [graphReady, setGraphReady] = useState(false);
  const [importError, setImportError] = useState('');

  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const mermaidSource = useMemo(() => buildMermaid(nodes, edges), [nodes, edges]);
  const generatedSource = useMemo(() => buildProjectPlanSource(nodes), [nodes]);
  const planMetrics = useMemo(() => computePlanMetrics(nodes), [nodes]);
  const summary = useMemo(() => ({
    milestones: nodes.filter((node) => node.kind === 'milestone').length,
    resources: nodes.filter((node) => node.kind === 'resource').length,
    tasks: nodes.filter((node) => node.kind === 'task').length,
    subtasks: nodes.filter((node) => node.kind === 'subtask').length,
    deliverables: nodes.filter((node) => node.kind === 'deliverable').length,
    artifacts: nodes.filter((node) => node.kind === 'artifact').length
  }), [nodes]);

  useEffect(() => {
    setGraphReady(false);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const graph = normalizeGraph(parsed?.graph || parsed);
        if (graph) {
          setNodes(graph.nodes);
          setEdges(graph.edges);
          setSelectedNodeId(graph.nodes[0]?.id || '');
          setConnectFrom(graph.nodes[0]?.id || '');
          setConnectTo(graph.nodes[1]?.id || '');
          setGraphReady(true);
          return;
        }
      }
    } catch {
      // Ignore malformed persisted graph.
    }
    const graph = createDefaultGraph();
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeId(graph.nodes[0]?.id || '');
    setConnectFrom(graph.nodes[0]?.id || '');
    setConnectTo(graph.nodes[1]?.id || '');
    setGraphReady(true);
  }, []);

  useEffect(() => {
    if (!graphReady) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [edges, graphReady, nodes]);

  useEffect(() => {
    function handleMove(event) {
      if (!dragState) return;
      setNodes((current) => current.map((node) => {
        if (node.id !== dragState.nodeId) return node;
        return {
          ...node,
          x: snapToGrid(dragState.originX + (event.clientX - dragState.startX)),
          y: snapToGrid(dragState.originY + (event.clientY - dragState.startY))
        };
      }));
    }

    function handleUp() {
      if (dragState) setDragState(null);
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState]);

  function addNode(kind, x, y) {
    setNodes((current) => [...current, createProjectNode(kind, current.length, x, y)]);
  }

  function addEdge(labelOverride = null) {
    if (!connectFrom || !connectTo || connectFrom === connectTo) return;
    const label = labelOverride === null ? connectLabel : labelOverride;
    setEdges((current) => [...current, { id: `e${Date.now()}_${Math.floor(Math.random() * 1000)}`, from: connectFrom, to: connectTo, label }]);
    if (labelOverride === null) setConnectLabel('');
  }

  function updateSelectedNodeTitle(value) {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, title: value } : node));
  }

  function updateSelectedNodeData(field, value) {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...(node.data || {}), [field]: value } } : node));
  }

  function updateSelectedNodeStatus(status) {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedNode.id) return node;
      const nextPercent = inferPercentFromStatus(status, node?.data?.percentComplete || 0);
      return {
        ...node,
        data: {
          ...(node.data || {}),
          status,
          percentComplete: nextPercent
        }
      };
    }));
  }

  function updateSelectedNodePercent(percentValue) {
    if (!selectedNode) return;
    const nextPercent = clampPercent(percentValue);
    const nextStatus = nextPercent >= 100 ? 'completed' : (nextPercent > 0 ? 'in-progress' : 'not-started');
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedNode.id) return node;
      return {
        ...node,
        data: {
          ...(node.data || {}),
          percentComplete: nextPercent,
          status: nextStatus
        }
      };
    }));
  }

  function loadGraph(graph) {
    if (!graph) return;
    setImportError('');
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeId(graph.nodes[0]?.id || '');
    setConnectFrom(graph.nodes[0]?.id || '');
    setConnectTo(graph.nodes[1]?.id || '');
  }

  function handleLoadPmbokTemplate() {
    loadGraph(createPmbokTemplateGraph());
  }

  function handleImportClick() {
    if (importInputRef.current) {
      importInputRef.current.value = '';
      importInputRef.current.click();
    }
  }

  function handleImportPlanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        const graph = normalizeGraph(payload?.graph || payload);
        if (!graph) {
          setImportError('Import failed: expected JSON with graph.nodes[] and graph.edges[] (or nodes/edges at root).');
          return;
        }
        loadGraph(graph);
      } catch (error) {
        setImportError(`Import failed: ${String(error?.message || error)}`);
      }
    };
    reader.readAsText(file);
  }

  function handleExportPlan() {
    const exportPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      plan: {
        completionPercent: planMetrics.weightedPercent,
        taskCompletionPercent: planMetrics.taskCompletionPercent,
        completedTasks: planMetrics.completedTasks,
        totalTasks: planMetrics.totalTasks,
        completedUnits: planMetrics.completedUnits,
        totalUnits: planMetrics.totalUnits
      },
      completedTaskItems: planMetrics.completedTaskItems,
      completedItems: planMetrics.completedItems,
      graph: {
        nodes,
        edges
      }
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-plan-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const kind = event.dataTransfer.getData('text/pulse-block-kind');
    if (!kind || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid(event.clientX - rect.left + canvasRef.current.scrollLeft - (BLOCK_WIDTH / 2));
    const y = snapToGrid(event.clientY - rect.top + canvasRef.current.scrollTop - (BLOCK_HEIGHT / 2));
    addNode(kind, x, y);
  }

  return (
    <SharedBlockWorkspace
      blockLibrary={PROJECT_BLOCKS}
      nodes={nodes}
      edges={edges}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
      connectFrom={connectFrom}
      connectTo={connectTo}
      connectLabel={connectLabel}
      onConnectFromChange={setConnectFrom}
      onConnectToChange={setConnectTo}
      onConnectLabelChange={setConnectLabel}
      onAddEdge={addEdge}
      onRemoveEdge={(edgeId) => setEdges((current) => current.filter((edge) => edge.id !== edgeId))}
      onAddNode={addNode}
      onNodeDragStart={(event, node) => {
        setDragState({ nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y });
      }}
      onNodeSelect={(nodeId) => {
        setSelectedNodeId(nodeId);
        setConnectFrom(nodeId);
      }}
      onCanvasDrop={handleCanvasDrop}
      onDeleteSelectedNode={() => {
        if (!selectedNode) return;
        setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
        setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id));
        setSelectedNodeId('');
      }}
      summarizeNode={summarizeNode}
      renderSelectionFields={(node) => (
        <>
          <input value={node.title || ''} onChange={(event) => updateSelectedNodeTitle(event.target.value)} placeholder="Block title" />
          <input value={node.data.description || ''} onChange={(event) => updateSelectedNodeData('description', event.target.value)} placeholder="Description" />
          {(node.kind === 'task' || node.kind === 'subtask' || node.kind === 'deliverable' || node.kind === 'artifact' || node.kind === 'milestone') && (
            <>
              <select value={deriveNodeStatus(node)} onChange={(event) => updateSelectedNodeStatus(event.target.value)}>
                {TASK_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input type="number" min={0} max={100} value={nodeCompletionPercent(node)} onChange={(event) => updateSelectedNodePercent(event.target.value)} placeholder="Percent complete" />
            </>
          )}
          {node.kind === 'project' && (
            <>
              <input value={node.data.projectState || ''} onChange={(event) => updateSelectedNodeData('projectState', event.target.value)} placeholder="Project state key" />
              <input value={node.data.planState || ''} onChange={(event) => updateSelectedNodeData('planState', event.target.value)} placeholder="Plan state key" />
            </>
          )}
          {node.kind === 'milestone' && (
            <>
              <input type="date" value={node.data.dueDate || ''} onChange={(event) => updateSelectedNodeData('dueDate', event.target.value)} />
              <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="Milestone state key" />
            </>
          )}
          {node.kind === 'task' && (
            <>
              <input value={node.data.assignee || ''} onChange={(event) => updateSelectedNodeData('assignee', event.target.value)} placeholder="Assigned user" />
              <textarea
                value={node.data.artifacts || ''}
                onChange={(event) => updateSelectedNodeData('artifacts', event.target.value)}
                placeholder="Artifact files (one per line)"
                style={{ minHeight: 72, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(node.data.publishToRepository)}
                  onChange={(event) => updateSelectedNodeData('publishToRepository', event.target.checked)}
                />
                Publish task artifacts to repository
              </label>
              <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="Task state key" />
            </>
          )}
          {node.kind === 'subtask' && (
            <>
              <input value={node.data.assignee || ''} onChange={(event) => updateSelectedNodeData('assignee', event.target.value)} placeholder="Assigned user" />
              <input value={node.data.parentTaskState || ''} onChange={(event) => updateSelectedNodeData('parentTaskState', event.target.value)} placeholder="Parent task state key" />
              <textarea
                value={node.data.artifacts || ''}
                onChange={(event) => updateSelectedNodeData('artifacts', event.target.value)}
                placeholder="Subtask artifacts (one per line)"
                style={{ minHeight: 72, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(node.data.publishToRepository)}
                  onChange={(event) => updateSelectedNodeData('publishToRepository', event.target.checked)}
                />
                Publish subtask artifacts to repository
              </label>
              <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="Subtask state key" />
            </>
          )}
          {node.kind === 'resource' && (
            <>
              <input value={node.data.resourceType || ''} onChange={(event) => updateSelectedNodeData('resourceType', event.target.value)} placeholder="Resource type" />
              <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="Resource state key" />
            </>
          )}
          {node.kind === 'artifact' && (
            <>
              <input value={node.data.artifactType || ''} onChange={(event) => updateSelectedNodeData('artifactType', event.target.value)} placeholder="Artifact type" />
              <input value={node.data.repositoryPath || ''} onChange={(event) => updateSelectedNodeData('repositoryPath', event.target.value)} placeholder="Repository path" />
              <input value={node.data.publishStep || ''} onChange={(event) => updateSelectedNodeData('publishStep', event.target.value)} placeholder="Publish step" />
              <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="Artifact state key" />
            </>
          )}
          {(node.kind === 'deliverable' || node.kind === 'synchpoint') && (
            <input value={node.data.stateKey || ''} onChange={(event) => updateSelectedNodeData('stateKey', event.target.value)} placeholder="State key" />
          )}
        </>
      )}
      renderRightPanel={() => (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Plan IO & Templates</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <button type="button" onClick={handleLoadPmbokTemplate}>PMBOK Template</button>
              <button type="button" onClick={handleImportClick}>Import Plan</button>
              <button type="button" onClick={handleExportPlan}>Export Plan</button>
            </div>
            <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportPlanFile} />
            {importError ? <div style={{ color: '#fecaca', fontSize: 12 }}>{importError}</div> : null}
          </div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Project Plan Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.milestones}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Milestones</div></div>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.resources}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Resources</div></div>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.tasks}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Tasks</div></div>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.subtasks}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Subtasks</div></div>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.deliverables}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Deliverables</div></div>
            <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}><strong>{summary.artifacts}</strong><div style={{ fontSize: 12, opacity: 0.72 }}>Artifacts</div></div>
          </div>
          <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Execution Progress</div>
            <div><strong>{planMetrics.weightedPercent}%</strong> overall complete</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>{planMetrics.completedTasks}/{planMetrics.totalTasks} tasks and subtasks completed</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}><strong>{planMetrics.taskCompletionPercent}%</strong> task completion</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Completed items are included in plan export.</div>
          </div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Mermaid Preview</div>
          <MermaidPreview source={mermaidSource} />
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75 }}>Generated Project WFL</div>
          <textarea value={generatedSource} readOnly style={{ minHeight: 280, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12 }} />
        </>
      )}
      canvasRef={canvasRef}
      leftPanelTitle="Planner Blocks"
    />
  );
}