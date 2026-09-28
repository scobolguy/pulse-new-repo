import antlr4 from 'antlr4';
import { dslDebug, dslError } from './dsl-debug.mjs';
import WorkflowDslLexer from '../grammar/generated-modern/WorkflowDslLexer.js';
import WorkflowDslParser from '../grammar/generated-modern/WorkflowDslParser.js';
import WorkflowDslVisitor from '../grammar/generated-modern/WorkflowDslVisitor.js';
import { listServiceKeys, resolveEnvironmentName } from '../src/backend/modules/serviceRegistry.mjs';
import { buildDeploymentBindingManifest } from '../src/backend/deploymentBindingManifest.mjs';
import { buildGenericSystem } from '../src/backend/genericSystem.mjs';

function parseQuoted(value) {
  const s = String(value || '').trim();
  if (s.length < 2) return null;
  const q = s[0];
  if ((q !== '"' && q !== '\'') || s[s.length - 1] !== q) return null;
  return s.slice(1, -1)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\(["'\\])/g, '$1');
}

function validateSystemConformance(systems) {
  const abstractTypes = new Map(
    systems.filter(system => system.abstract).map(system => [system.name, system])
  );

  const concreteSystems = systems.filter(item => !item.abstract && item.typeName);

  for (const system of concreteSystems) {
    const contract = abstractTypes.get(system.typeName);
    if (!contract) {
      throw new Error(`System '${system.systemId}' references unknown SYSTEM TYPE '${system.typeName}'`);
    }

    for (const required of contract.members) {
      const actual = system.members.find(member => member.kind === required.kind && member.symbol === required.symbol);
      if (!actual) {
        throw new Error(`System '${system.systemId}' is missing required member '${required.symbol}' from SYSTEM TYPE '${system.typeName}'`);
      }
      const requiredInterface = required.kind === 'queue' ? required.dataTypeId : required.serviceId;
      const actualInterface = actual.kind === 'queue' ? actual.dataTypeId : actual.serviceId;
      if (requiredInterface !== actualInterface) {
        throw new Error(`System '${system.systemId}' member '${required.symbol}' does not match SYSTEM TYPE '${system.typeName}'`);
      }
    }
  }
}

function quoteDouble(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function parseStepCallApi(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+CALL\s+API\s+("[^"]+"|'[^']+')\s+(GET|POST|PUT|PATCH|DELETE)\s+("[^"]+"|'[^']+')\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'call_api',
    apiSymbol: parseQuoted(stepMatch[2]),
    method: stepMatch[3].toUpperCase(),
    route: parseQuoted(stepMatch[4])
  };
}

function parseStepCallService(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+CALL\s+SERVICE\s+("[^"]+"|'[^']+')\s+("[^"]+"|'[^']+')(?:\s+(ASYNC))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'call_service',
    serviceId: parseQuoted(stepMatch[2]),
    message: parseQuoted(stepMatch[3]),
    asynchronous: Boolean(stepMatch[4])
  };
}

function parseStepRouteQueue(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+ROUTE\s+QUEUE\s+("[^"]+"|'[^']+')\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'route_queue',
    queueRef: parseQuoted(stepMatch[2])
  };
}

function parseStepSetState(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+SET\s+STATE\s+("[^"]+"|'[^']+')\s*=\s*("[^"]+"|'[^']+')\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'set_state',
    key: parseQuoted(stepMatch[2]),
    value: parseQuoted(stepMatch[3])
  };
}

function parseStepWait(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+WAIT\s+(\d+)\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'wait',
    durationMs: Number(stepMatch[2])
  };
}

function parseStepCheckApi(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+CHECK\s+API\s+("[^"]+"|'[^']+')\s+(GET|POST|PUT|PATCH|DELETE)\s+("[^"]+"|'[^']+')\s+EXPECT\s+(\d+)\s+RETRIES\s+(\d+)\s+EVERY\s+(\d+)\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'check_api',
    apiSymbol: parseQuoted(stepMatch[2]),
    method: String(stepMatch[3] || 'GET').toUpperCase(),
    route: parseQuoted(stepMatch[4]),
    expectedStatus: Number(stepMatch[5]),
    retries: Math.max(1, Number(stepMatch[6])),
    everyMs: Math.max(1, Number(stepMatch[7]))
  };
}

function parseStepIssueCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+ISSUE\s+CREATE\s+TITLE\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')\s+PRIORITY\s+("[^"]+"|'[^']+')(?:(\s+ASSIGN\s+USER\s+("[^"]+"|'[^']+')))?(?:(\s+REPORTER\s+TYPE\s+("[^"]+"|'[^']+')))?(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'issue_create',
    title: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    priority: parseQuoted(stepMatch[4]),
    assigneeUserId: stepMatch[6] ? parseQuoted(stepMatch[6]) : null,
    reporterType: stepMatch[8] ? parseQuoted(stepMatch[8]) : null,
    outputStateKey: stepMatch[10] ? parseQuoted(stepMatch[10]) : null
  };
}

function parseStepTestCaseCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+TESTCASE\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+TEST\s+TYPE\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'testcase_create',
    name: parseQuoted(stepMatch[2]),
    testType: parseQuoted(stepMatch[3]),
    description: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepTestPlanCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+TESTPLAN\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+PLAN\s+TYPE\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'testplan_create',
    name: parseQuoted(stepMatch[2]),
    planType: parseQuoted(stepMatch[3]),
    description: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepIssueLink(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+ISSUE\s+LINK\s+ISSUE\s+STATE\s+("[^"]+"|'[^']+')\s+TO\s+TESTCASE\s+STATE\s+("[^"]+"|'[^']+')\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'issue_link_testcase',
    issueStateKey: parseQuoted(stepMatch[2]),
    testCaseStateKey: parseQuoted(stepMatch[3])
  };
}

function parseStepTestPlanAddCase(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+TESTPLAN\s+ADD\s+TESTCASE\s+STATE\s+("[^"]+"|'[^']+')\s+TO\s+PLAN\s+STATE\s+("[^"]+"|'[^']+')\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'testplan_add_testcase',
    testCaseStateKey: parseQuoted(stepMatch[2]),
    planStateKey: parseQuoted(stepMatch[3])
  };
}

function parseStepProjectCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+PROJECT\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'project_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    outputStateKey: stepMatch[5] ? parseQuoted(stepMatch[5]) : null
  };
}

function parseStepReleaseCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+RELEASE\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')\s+FOR\s+PROJECT\s+STATE\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'release_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    projectStateKey: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepDeploymentArtifactCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+DEPLOYMENT\s+ARTIFACT\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+ARTIFACT\s+TYPE\s+("[^"]+"|'[^']+')\s+LOCATION\s+("[^"]+"|'[^']+')\s+FOR\s+RELEASE\s+STATE\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'deployment_artifact_create',
    name: parseQuoted(stepMatch[2]),
    artifactType: parseQuoted(stepMatch[3]),
    location: parseQuoted(stepMatch[4]),
    releaseStateKey: parseQuoted(stepMatch[5]),
    outputStateKey: stepMatch[7] ? parseQuoted(stepMatch[7]) : null
  };
}

function parseStepProjectPlanCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+PROJECTPLAN\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')\s+FOR\s+PROJECT\s+STATE\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'projectplan_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    projectStateKey: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepMilestoneCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+MILESTONE\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')\s+DUE\s+DATE\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'milestone_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    dueDate: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepTaskCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+TASK\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+ASSIGN\s+USER\s+("[^"]+"|'[^']+')))?(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'task_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    assigneeUserId: stepMatch[5] ? parseQuoted(stepMatch[5]) : null,
    outputStateKey: stepMatch[7] ? parseQuoted(stepMatch[7]) : null
  };
}

function parseStepSynchpointCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+SYNCHPOINT\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'synchpoint_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    outputStateKey: stepMatch[5] ? parseQuoted(stepMatch[5]) : null
  };
}

function parseStepDeliverableCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+DELIVERABLE\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'deliverable_create',
    name: parseQuoted(stepMatch[2]),
    description: parseQuoted(stepMatch[3]),
    outputStateKey: stepMatch[5] ? parseQuoted(stepMatch[5]) : null
  };
}

function parseStepResourceCreate(stepLine) {
  const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+RESOURCE\s+CREATE\s+NAME\s+("[^"]+"|'[^']+')\s+RESOURCE\s+TYPE\s+("[^"]+"|'[^']+')\s+DESCRIPTION\s+("[^"]+"|'[^']+')(?:(\s+INTO\s+STATE\s+("[^"]+"|'[^']+')))?\s*;$/i);
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: 'resource_create',
    name: parseQuoted(stepMatch[2]),
    resourceType: parseQuoted(stepMatch[3]),
    description: parseQuoted(stepMatch[4]),
    outputStateKey: stepMatch[6] ? parseQuoted(stepMatch[6]) : null
  };
}

function parseStepProjectPlanAdd(stepLine, objectType, actionName) {
  const stepMatch = stepLine.match(new RegExp(`^STEP\\s+("[^"]+"|'[^']+')\\s+PROJECTPLAN\\s+ADD\\s+${objectType}\\s+STATE\\s+("[^"]+"|'[^']+')\\s+TO\\s+PLAN\\s+STATE\\s+("[^"]+"|'[^']+')\\s*;$`, 'i'));
  if (!stepMatch) return null;
  return {
    id: parseQuoted(stepMatch[1]),
    action: actionName,
    itemStateKey: parseQuoted(stepMatch[2]),
    planStateKey: parseQuoted(stepMatch[3])
  };
}

function parseStepFromLine(stepLine) {
  const parsers = [
    parseStepCallService,
    parseStepCallApi,
    parseStepRouteQueue,
    parseStepSetState,
    parseStepWait,
    parseStepCheckApi,
    parseStepIssueCreate,
    parseStepTestCaseCreate,
    parseStepTestPlanCreate,
    parseStepIssueLink,
    parseStepTestPlanAddCase,
    parseStepProjectCreate,
    parseStepReleaseCreate,
    parseStepDeploymentArtifactCreate,
    parseStepProjectPlanCreate,
    parseStepMilestoneCreate,
    parseStepTaskCreate,
    parseStepSynchpointCreate,
    parseStepDeliverableCreate,
    parseStepResourceCreate,
    line => parseStepProjectPlanAdd(line, 'MILESTONE', 'projectplan_add_milestone'),
    line => parseStepProjectPlanAdd(line, 'TASK', 'projectplan_add_task'),
    line => parseStepProjectPlanAdd(line, 'SYNCHPOINT', 'projectplan_add_synchpoint'),
    line => parseStepProjectPlanAdd(line, 'DELIVERABLE', 'projectplan_add_deliverable'),
    line => parseStepProjectPlanAdd(line, 'RESOURCE', 'projectplan_add_resource')
  ];

  for (const parser of parsers) {
    const parsed = parser(stepLine);
    if (parsed) return parsed;
  }

  throw new Error(`Invalid workflow step: ${stepLine}`);
}

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg) {
    this.errors.push(`line ${line}:${column} ${msg}`);
  }
}

function flattenSystemMembers(system) {
  const members = [];
  for (const member of system.members || []) {
    if (member.kind === 'system') {
      members.push(...flattenSystemMembers(member));
    } else {
      members.push(member);
    }
  }
  return members;
}

class WorkflowAstBuilder extends WorkflowDslVisitor {
  constructor(tokens) {
    super();
    this.tokens = tokens;
  }

  visitProgram(ctx) {
    const symbols = { queues: [], databases: [], services: [], systems: [], files: [], apis: [] };
    const workflows = [];
    const deployments = [];
    const clusters = [];
    const artifactDeployments = [];
    const genericSystems = [];

    for (const item of ctx.item() || []) {
      const value = this.visit(item);
      if (!value) continue;
      if (value.type === 'queue') symbols.queues.push(value.payload);
      if (value.type === 'database') symbols.databases.push(value.payload);
      if (value.type === 'service') symbols.services.push(value.payload);
      if (value.type === 'system') {
        symbols.systems.push(value.payload);
        if (!value.payload.abstract) {
          for (const member of flattenSystemMembers(value.payload)) {
            if (member.kind === 'queue') symbols.queues.push(member);
            if (member.kind === 'service') symbols.services.push(member);
          }
        }
      }
      if (value.type === 'file') symbols.files.push(value.payload);
      if (value.type === 'api') symbols.apis.push(value.payload);
      if (value.type === 'workflow') workflows.push(value.payload);
      if (value.type === 'deployment') deployments.push(value.payload);
      if (value.type === 'cluster') clusters.push(value.payload);
      if (value.type === 'artifactDeployment') artifactDeployments.push(value.payload);
      if (value.type === 'genericSystem') genericSystems.push(value.payload);
    }

    return { symbols, workflows, deployments, clusters, artifactDeployments, genericSystems };
  }

  

  visitItem(ctx) {
    if (ctx.queueDecl()) return this.visit(ctx.queueDecl());
    if (ctx.databaseDecl()) return this.visit(ctx.databaseDecl());
    if (ctx.systemTypeDecl()) return this.visit(ctx.systemTypeDecl());
    if (ctx.systemDecl()) return this.visit(ctx.systemDecl());
    if (ctx.fileDecl()) return this.visit(ctx.fileDecl());
    if (ctx.apiDecl()) return this.visit(ctx.apiDecl());
    if (ctx.workflowDecl()) return this.visit(ctx.workflowDecl());
    if (ctx.deploymentDecl()) return this.visit(ctx.deploymentDecl());
    if (ctx.clusterCreateDecl()) return this.visit(ctx.clusterCreateDecl());
    if (ctx.artifactDeployDecl()) return this.visit(ctx.artifactDeployDecl());
    if (ctx.genericSystemDecl()) return this.visit(ctx.genericSystemDecl());
    return null;
  }

  visitGenericSystemDecl(ctx) {
    const raw = {
      systemId: parseQuoted(ctx.quotedString().getText()),
      ports: [],
      systems: [],
      connections: []
    };
    for (const member of ctx.genericSystemMember() || []) {
      if (member.genericSystemDecl()) {
        raw.systems.push(this.visitGenericSystemDecl(member.genericSystemDecl()).payload);
      } else if (member.genericSystemPortDecl()) {
        const port = member.genericSystemPortDecl();
        raw.ports.push({
          symbol: parseQuoted(port.quotedString(0).getText()),
          direction: port.INPUT() ? 'input' : 'output',
          dataTypeId: parseQuoted(port.quotedString(1).getText())
        });
      } else if (member.genericSystemConnectionDecl()) {
        const connection = member.genericSystemConnectionDecl();
        raw.connections.push({
          symbol: parseQuoted(connection.quotedString(0).getText()),
          source: parseQuoted(connection.quotedString(1).getText()),
          target: parseQuoted(connection.quotedString(2).getText()),
          dataTypeId: parseQuoted(connection.quotedString(3).getText())
        });
      }
    }
    return { type: 'genericSystem', payload: buildGenericSystem(raw) };
  }

  visitClusterCreateDecl(ctx) {
    const strings = ctx.quotedString() || [];
    const clusterId = parseQuoted(strings[0].getText());
    return {
      type: 'cluster',
      payload: {
        clusterId,
        label: ctx.LABEL() ? parseQuoted(strings[1].getText()) : clusterId,
        nodes: this.visit(ctx.quotedList())
      }
    };
  }

  visitArtifactDeployDecl(ctx) {
    const strings = ctx.quotedString() || [];
    return {
      type: 'artifactDeployment',
      payload: {
        artifactId: parseQuoted(strings[0].getText()),
        fileName: parseQuoted(strings[1].getText()),
        clusterId: parseQuoted(strings[2].getText())
      }
    };
  }

  visitDeploymentDecl(ctx) {
    return {
      type: 'deployment',
      payload: {
        id: parseQuoted(ctx.quotedString(0).getText()),
        projectId: parseQuoted(ctx.quotedString(1).getText()),
        targets: this.visit(ctx.quotedList(0)),
        resources: (ctx.deploymentItem() || []).map((item) => this.visit(item))
      }
    };
  }

  visitDeploymentItem(ctx) {
    const kind = ctx.SERVICE() ? 'service' : (ctx.PROGRAM() ? 'program' : 'daemon');
    const strings = ctx.quotedString() || [];
    const lifecycle = ctx.serviceLifecycleClause ? ctx.serviceLifecycleClause() : null;
    return {
      kind,
      id: parseQuoted(strings[0].getText()),
      fileName: parseQuoted(strings[1].getText()),
      inputQueue: parseQuoted(strings[2].getText()),
      outputQueue: parseQuoted(strings[3].getText()),
      targets: this.visit(ctx.quotedList()),
      startup: Boolean(ctx.booleanLiteral()?.TRUE()),
      lifecycle: lifecycle ? {
        persistent: Boolean(lifecycle.booleanLiteral()?.TRUE()),
        minInstances: Number(lifecycle.NUMBER(0)?.getText() || 0),
        maxInstances: Number(lifecycle.NUMBER(1)?.getText() || 0),
        idleTimeout: Number(lifecycle.NUMBER(2)?.getText() || 0),
        idleTimeoutUnit: lifecycle.TIME_UNIT()?.getText()?.toLowerCase() || 's'
      } : null
    };
  }

  visitQueueDecl(ctx) {
    const strings = ctx.quotedString() || [];
    const symbol = parseQuoted(strings[0].getText());
    const queueName = parseQuoted(strings[1].getText());
    const managerId = ctx.MANAGER() ? parseQuoted(strings[2].getText()) : null;
    let dataTypeIds = [];

    if (ctx.TYPE()) {
      dataTypeIds = [parseQuoted(strings[managerId ? 3 : 2].getText())];
    } else if (ctx.TYPES()) {
      dataTypeIds = this.visit(ctx.quotedList());
    }

    return {
      type: 'queue',
      payload: {
        symbol,
        queueName,
        managerId,
        dataTypeIds,
        dataTypeId: dataTypeIds[0] || null,
        deliveryMode: ctx.MODE() ? (ctx.SYNC() ? 'sync' : 'async') : 'async'
      }
    };
  }

  visitDatabaseDecl(ctx) {
    const strings = ctx.quotedString() || [];
    let index = 2;
    const typeName = ctx.TYPE() ? parseQuoted(strings[index++].getText()) : null;
    const managerId = ctx.MANAGER() ? parseQuoted(strings[index++].getText()) : null;
    const connectionRef = ctx.CONNECTION() ? parseQuoted(strings[index++].getText()) : null;
    return {
      type: 'database',
      payload: {
        symbol: parseQuoted(strings[0].getText()),
        databaseName: parseQuoted(strings[1].getText()),
        typeName,
        managerId,
        connectionRef
      }
    };
  }

  visitSystemTypeDecl(ctx) {
    const systemName = parseQuoted(ctx.quotedString().getText());
    return {
      type: 'system',
      payload: {
        kind: 'system',
        name: systemName,
        systemId: systemName,
        abstract: true,
        typeName: null,
        visibility: 'internal',
        members: (ctx.systemMember() || []).map(member => this.visitSystemMember(member, {
          abstract: true
        }))
      }
    };
  }

  visitSystemDecl(ctx) {
    return this.buildSystemDecl(ctx, {});
  }

  buildSystemDecl(ctx, parentContext = {}) {
    const strings = ctx.quotedString() || [];
    const systemId = parseQuoted(strings[0].getText());
    const typeName = strings[1] ? parseQuoted(strings[1].getText()) : null;
    const environmentName = resolveEnvironmentName();
    const systemPath = [...(parentContext.systemPath || []), systemId];
    return {
      type: 'system',
      payload: {
        kind: 'system',
        name: systemId,
        systemId,
        abstract: false,
        typeName,
        visibility: this.visitVisibility(ctx.visibilityClause()),
        runtimeName: `${environmentName}.${systemPath.join('.')}`,
        systemPath,
        members: (ctx.systemMember() || []).map(member => this.visitSystemMember(member, {
          environmentName,
          systemId,
          systemPath
        }))
      }
    };
  }

  visitSystemMember(ctx, context = {}) {
    if (ctx.systemQueueDecl()) return this.visitSystemQueueDecl(ctx.systemQueueDecl(), context);
    if (ctx.serviceDecl()) return this.visitServiceDecl(ctx.serviceDecl(), context);
    if (ctx.systemDecl()) return this.buildSystemDecl(ctx.systemDecl(), context).payload;
    return null;
  }

  visitVisibility(ctx) {
    if (!ctx) return 'internal';
    return ctx.EXPOSED() ? 'exposed' : 'internal';
  }

  visitSystemQueueDecl(ctx, context = {}) {
    const strings = ctx.quotedString() || [];
    const symbol = parseQuoted(strings[0].getText());
    const hasRuntimeName = Boolean(ctx.ARROW());
    const declaredName = hasRuntimeName ? parseQuoted(strings[1].getText()) : symbol;
    const typeStrings = ctx.quotedString() || [];
    const typeStart = hasRuntimeName ? 2 : 1;
    const managerId = ctx.MANAGER()
      ? parseQuoted(typeStrings[hasRuntimeName ? 2 : 1].getText())
      : null;
    const typeOffset = hasRuntimeName ? (managerId ? 3 : 2) : (managerId ? 2 : 1);
    const dataTypeIds = (ctx.TYPE() || ctx.TYPES())
      ? typeStrings.slice(typeOffset).map(item => parseQuoted(item.getText())).filter(Boolean)
      : [];
    const systemId = context.systemPath?.join('.') || context.systemId || null;
    return {
      kind: 'queue',
      symbol,
      declaredName,
      queueName: systemId ? `${context.environmentName}.${systemId}.${declaredName}` : declaredName,
      managerId,
      dataTypeIds,
      dataTypeId: dataTypeIds[0] || null,
      systemId,
      visibility: this.visitVisibility(ctx.visibilityClause()),
      abstract: Boolean(context.abstract) || !strings[1]
    };
  }

  visitServiceDecl(ctx, context = {}) {
    const strings = ctx.quotedString() || [];
    const serviceId = parseQuoted(strings[1].getText());
    if (!listServiceKeys().includes(serviceId)) {
      throw new Error(`Unknown service '${serviceId}' in service registry`);
    }
    return {
      kind: 'service',
      symbol: parseQuoted(strings[0].getText()),
      serviceId,
      systemId: context.systemPath?.join('.') || context.systemId || null,
      visibility: this.visitVisibility(ctx.visibilityClause())
    };
  }

  visitQuotedList(ctx) {
    return (ctx.quotedString() || []).map(q => parseQuoted(q.getText())).filter(Boolean);
  }

  visitFileDecl(ctx) {
    const strings = ctx.quotedString() || [];
    return {
      type: 'file',
      payload: {
        symbol: parseQuoted(strings[0].getText()),
        path: parseQuoted(strings[1].getText()),
        managerId: ctx.MANAGER() ? parseQuoted(strings[2].getText()) : null
      }
    };
  }

  visitApiDecl(ctx) {
    return {
      type: 'api',
      payload: {
        symbol: parseQuoted(ctx.quotedString(0).getText()),
        baseUrl: parseQuoted(ctx.quotedString(1).getText())
      }
    };
  }

  visitWorkflowDecl(ctx) {
    const id = parseQuoted(ctx.quotedString().getText());
    const steps = [];
    for (const stmt of ctx.workflowStmt() || []) {
      steps.push(this.visit(stmt));
    }
    return {
      type: 'workflow',
      payload: { id, steps }
    };
  }

  visitWorkflowStmt(ctx) {
    if (ctx.stepStmt()) return this.visit(ctx.stepStmt());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.cobeginStmt()) return this.visit(ctx.cobeginStmt());
    if (ctx.tryStmt()) return this.visit(ctx.tryStmt());
    return null;
  }

  visitCobeginStmt(ctx) {
    const modeCtx = ctx.cobeginMode();
    const mode = modeCtx && modeCtx.SYNC() ? 'sync' : 'async';
    const timeoutMs = mode === 'async' && modeCtx && modeCtx.NUMBER()
      ? Math.max(1, Number(modeCtx.NUMBER().getText()))
      : null;
    const backoutOnError = Boolean(ctx.BACKOUT && ctx.BACKOUT());
    const subflows = (ctx.subflowDecl() || []).map(subflowCtx => this.visit(subflowCtx));

    return {
      id: `cobegin-${ctx.start.tokenIndex}`,
      action: 'cobegin',
      mode,
      timeoutMs,
      backoutOnError,
      subflows
    };
  }

  visitSubflowDecl(ctx) {
    const id = parseQuoted(ctx.quotedString().getText());
    const steps = [];
    for (const stmt of ctx.workflowStmt() || []) {
      steps.push(this.visit(stmt));
    }
    return { id, steps };
  }

  visitTryStmt(ctx) {
    const catchNode = typeof ctx.CATCH === 'function' ? ctx.CATCH() : null;
    const hasCatch = Boolean(catchNode);
    const statements = ctx.workflowStmt ? ctx.workflowStmt() : [];

    let split = statements.length;
    if (hasCatch) {
      const catchToken = catchNode.symbol;
      split = statements.findIndex(stmt => stmt.start && stmt.start.tokenIndex > catchToken.tokenIndex);
      if (split < 0) split = statements.length;
    }

    const body = statements.slice(0, split).map(stmt => this.visit(stmt));
    const onError = hasCatch ? statements.slice(split).map(stmt => this.visit(stmt)) : [];

    return {
      id: `try-${ctx.start.tokenIndex}`,
      action: 'try',
      body,
      onError
    };
  }

  visitStepStmt(ctx) {
    const id = parseQuoted(ctx.quotedString().getText());
    const bodyCtx = ctx.stepBody();
    const start = bodyCtx.start.tokenIndex;
    const stop = bodyCtx.stop.tokenIndex;
    const rawTokens = this.tokens.tokens.slice(start, stop + 1).map(t => t.text);
    let body = rawTokens.join(' ').replace(/\s+/g, ' ').trim();
    body = body.replace(/\s+([(),])/g, '$1').replace(/([()])\s+/g, '$1');
    const line = `STEP ${quoteDouble(id)} ${body};`;
    return parseStepFromLine(line);
  }

  visitIfStmt(ctx) {
    const condition = {
      field: parseQuoted(ctx.quotedString(0).getText()),
      operator: ctx.EQUALS() ? 'equals' : 'contains',
      value: parseQuoted(ctx.quotedString(1).getText())
    };

    const thenBranch = this.visit(ctx.branch(0));
    const elseBranch = ctx.branch(1) ? this.visit(ctx.branch(1)) : [];

    return {
      id: `if-${ctx.start.tokenIndex}`,
      action: 'if',
      condition,
      then: thenBranch,
      else: elseBranch
    };
  }

  visitBranch(ctx) {
    if (ctx.stepStmt()) {
      return [this.visit(ctx.stepStmt())];
    }
    const out = [];
    for (const stmt of ctx.workflowStmt() || []) {
      out.push(this.visit(stmt));
    }
    return out;
  }
}

export function parseWorkflowDslWithAntlr(sourceText) {
  const input = new antlr4.InputStream(sourceText);
  const lexer = new WorkflowDslLexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new WorkflowDslParser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);

  parser.buildParseTrees = true;
  const tree = parser.program();

  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[WORKFLOW-ANTLR] Parse failed:\n${errors.join('\n')}`);
  }

  const builder = new WorkflowAstBuilder(tokens);
  const parsed = builder.visit(tree);
  validateSystemConformance(parsed.symbols.systems);
  return parsed;
}

export function compileWorkflowDSLWithAntlr(sourceText) {
  const text = String(sourceText || '');
  dslDebug('wfl', 'compile:start', { chars: text.length });
  try {
    const parsed = parseWorkflowDslWithAntlr(text);
    const result = {
      version: 4,
      compiledAt: new Date().toISOString(),
      symbols: parsed.symbols,
      bindings: buildDeploymentBindingManifest(parsed.symbols),
      workflows: parsed.workflows,
      deployments: parsed.deployments,
      clusters: parsed.clusters,
      artifactDeployments: parsed.artifactDeployments,
      genericSystems: parsed.genericSystems
    };
    dslDebug('wfl', 'compile:complete', { workflows: result.workflows.length, deployments: result.deployments.length });
    return result;
  } catch (error) {
    throw dslError('wfl', 'compile', error, { chars: text.length });
  }
}
