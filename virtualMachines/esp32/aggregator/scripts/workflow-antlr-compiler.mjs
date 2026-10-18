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
  return s.slice(1, -1).replace(/\\(["'\\nrt])/g, (_, character) => ({ n: '\n', r: '\r', t: '\t' }[character] ?? character));
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

const FLOW_DIRECTIVE_TARGETS = {
  name: ['metadata', 'name'],
  description: ['metadata', 'description'],
  createdby: ['metadata', 'createdBy'],
  animation: ['animation', 'mode'],
  animationtarget: ['animation', 'target'],
  mermaidpreview: ['animation', 'useMermaidPreview']
};

function createFlowModel(flowId) {
  return {
    id: flowId,
    schemaVersion: 1,
    kind: 'visual-flow-language',
    metadata: { name: flowId },
    catalog: { seedObjects: [] },
    animation: { mode: 'none', target: 'workflow', useMermaidPreview: true },
    nodes: [],
    edges: []
  };
}

function applyFlowDirective(flow, key, value) {
  const [section, field] = FLOW_DIRECTIVE_TARGETS[key.toLowerCase()] || ['metadata', key];
  flow[section][field] = value;
}

function globToRegExp(pattern) {
  const source = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${source}$`, 's');
}

const STRING_COMPARATORS = {
  '=': (left, right) => left === right,
  EQUALS: (left, right) => left === right,
  '<>': (left, right) => left !== right,
  '!=': (left, right) => left !== right,
  '<': (left, right) => left < right,
  '<=': (left, right) => left <= right,
  '>': (left, right) => left > right,
  '>=': (left, right) => left >= right
};
const SERVICE_ID_ALIASES = new Set(['filesystem', 'librarian', 'mapper']);

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
  constructor(tokens, options = {}) {
    super();
    this.tokens = tokens;
    this.externalEnvironment = String(options.environment || process.env.PULSE_ENVIRONMENT || '').trim() || null;
    this.externalEnvironmentSource = String(options.environment || '').trim() ? 'option' : 'PULSE_ENVIRONMENT';
    this.fileDefaultEnvironment = null;
    this.environmentRead = false;
    this.variables = new Map(Object.entries(options.variables || {}).map(([name, value]) => [name, String(value)]));
    this.externalVariables = new Set(this.variables.keys());
    this.processEnv = options.env || process.env;
  }

  get environment() {
    this.environmentRead = true;
    return this.externalEnvironment || this.fileDefaultEnvironment || resolveEnvironmentName();
  }

  get environmentSource() {
    if (this.externalEnvironment) return this.externalEnvironmentSource;
    return this.fileDefaultEnvironment ? 'file-default' : 'built-in-default';
  }

  str(raw) {
    const value = parseQuoted(raw);
    return value === null ? null : this.interpolate(value);
  }

  interpolate(value) {
    return String(value).replace(/\$\$\{|\$\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\}/g, (match, name) => {
      if (match === '$${') return '${';
      return this.lookupVariable(name);
    });
  }

  lookupVariable(name) {
    if (name === 'ENVIRONMENT') return this.environment;
    if (!this.variables.has(name)) {
      throw new Error(`Unknown WFL variable '${name}'. Declare it with LET ${name} = "...";`);
    }
    return this.variables.get(name);
  }

  collectItems(items, sink) {
    for (const item of items || []) {
      if (item.letDecl()) {
        const decl = item.letDecl();
        const name = decl.IDENT().getText();
        const value = this.evalStringExpr(decl.stringExpr());
        if (!this.externalVariables.has(name)) this.variables.set(name, value);
        continue;
      }
      if (item.defaultEnvironmentDecl()) {
        if (this.fileDefaultEnvironment !== null) throw new Error('DEFAULT ENVIRONMENT is declared more than once');
        if (this.environmentRead) throw new Error('DEFAULT ENVIRONMENT must appear before ENVIRONMENT is used');
        this.fileDefaultEnvironment = this.evalStringExpr(item.defaultEnvironmentDecl().stringExpr()).trim() || null;
        continue;
      }
      if (item.configIfDecl()) {
        this.collectItems(this.selectConfigBranch(item.configIfDecl()), sink);
        continue;
      }
      sink(this.visit(item));
    }
  }

  // Returns the item contexts of the first branch whose condition holds.
  selectConfigBranch(ctx) {
    const conditions = ctx.condition();
    const branches = conditions.map(() => []);
    const elseItems = [];
    const markers = [...conditions.map(condition => condition.stop.tokenIndex)];
    const elseToken = ctx.ELSE() ? ctx.ELSE().symbol.tokenIndex : Infinity;
    for (const item of ctx.item() || []) {
      const index = item.start.tokenIndex;
      if (index > elseToken) {
        elseItems.push(item);
        continue;
      }
      let branch = 0;
      while (branch + 1 < markers.length && index > markers[branch + 1]) branch += 1;
      branches[branch].push(item);
    }
    for (let index = 0; index < conditions.length; index += 1) {
      if (this.evalCondition(conditions[index])) return branches[index];
    }
    return elseItems;
  }

  evalCondition(ctx) {
    return ctx.andCondition().some(andCtx => andCtx.notCondition().every(notCtx => this.evalNotCondition(notCtx)));
  }

  evalNotCondition(ctx) {
    if (ctx.NOT()) return !this.evalNotCondition(ctx.notCondition());
    return this.evalPrimaryCondition(ctx.primaryCondition());
  }

  evalPrimaryCondition(ctx) {
    if (ctx.condition()) return this.evalCondition(ctx.condition());
    if (ctx.booleanLiteral()) return Boolean(ctx.booleanLiteral().TRUE());
    const operands = ctx.stringExpr().map(expr => this.evalStringExpr(expr));
    const [left, ...rest] = operands;
    const negate = Boolean(ctx.NOT());
    let result;
    if (ctx.compareOp()) {
      result = STRING_COMPARATORS[ctx.compareOp().getText()](left, rest[0]);
    } else if (ctx.IN()) {
      result = rest.includes(left);
    } else if (ctx.CONTAINS()) {
      result = left.includes(rest[0]);
    } else if (ctx.LIKE()) {
      result = globToRegExp(rest[0]).test(left);
    } else if (ctx.MATCHES()) {
      let pattern;
      try {
        pattern = new RegExp(rest[0]);
      } catch (error) {
        throw new Error(`Invalid MATCHES pattern '${rest[0]}': ${error.message}`);
      }
      result = pattern.test(left);
    } else if (ctx.STARTS()) {
      result = left.startsWith(rest[0]);
    } else {
      result = left.endsWith(rest[0]);
    }
    return negate ? !result : result;
  }

  evalStringExpr(ctx) {
    return ctx.stringAtom().map(atom => this.evalStringAtom(atom)).join('');
  }

  evalStringAtom(ctx) {
    if (ctx.quotedString()) return this.str(ctx.quotedString().getText());
    if (ctx.NUMBER()) return ctx.NUMBER().getText();
    if (ctx.IDENT()) return this.lookupVariable(ctx.IDENT().getText());
    if (ctx.ENVIRONMENT()) return this.environment;
    const args = ctx.stringExpr().map(expr => this.evalStringExpr(expr));
    if (ctx.LOWER()) return args[0].toLowerCase();
    if (ctx.UPPER()) return args[0].toUpperCase();
    const value = this.processEnv[args[0]];
    if (value !== undefined) return String(value);
    if (args.length > 1) return args[1];
    throw new Error(`Environment variable '${args[0]}' is not set. Use ENV("${args[0]}", "fallback") to make it optional.`);
  }

  visitProgram(ctx) {
    const symbols = { queues: [], databases: [], services: [], systems: [], files: [], apis: [] };
    const workflows = [];
    const deployments = [];
    const clusters = [];
    const artifactDeployments = [];
    const genericSystems = [];
    const flows = [];

    this.collectItems(ctx.item(), (value) => {
      if (!value) return;
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
      if (value.type === 'flow') {
        if (flows.some(flow => flow.id === value.payload.id)) {
          throw new Error(`Duplicate FLOW '${value.payload.id}'`);
        }
        flows.push(value.payload);
      }
    });

    return {
      symbols,
      workflows,
      deployments,
      clusters,
      artifactDeployments,
      genericSystems,
      flows,
      configuration: {
        environment: this.environment,
        environmentSource: this.environmentSource,
        variables: Object.fromEntries(this.variables)
      }
    };
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
    if (ctx.flowDecl()) return this.visit(ctx.flowDecl());
    return null;
  }

  visitFlowDecl(ctx) {
    const flow = createFlowModel(this.str(ctx.quotedString().getText()));
    const edgeKeys = new Set();
    for (const member of ctx.flowMember() || []) {
      if (member.flowDirective()) {
        const directive = member.flowDirective();
        applyFlowDirective(flow, directive.directiveKey().getText(), this.visitDirectiveValue(directive.directiveValue()));
      } else if (member.flowSeedDecl()) {
        const seed = this.str(member.flowSeedDecl().quotedString().getText());
        if (!flow.catalog.seedObjects.includes(seed)) flow.catalog.seedObjects.push(seed);
      } else if (member.flowNodeDecl()) {
        const node = this.visitFlowNodeDecl(member.flowNodeDecl());
        if (flow.nodes.some(existing => existing.id === node.id)) {
          throw new Error(`FLOW '${flow.id}' declares NODE '${node.id}' more than once`);
        }
        flow.nodes.push(node);
      } else if (member.flowLinkDecl()) {
        const link = member.flowLinkDecl();
        const strings = link.quotedString().map(item => this.str(item.getText()));
        const edge = { id: `${strings[0]}->${strings[1]}:${strings[2]}`, from: strings[0], to: strings[1], type: strings[2], label: link.LABEL() ? strings[3] : strings[2] };
        if (edgeKeys.has(edge.id)) {
          throw new Error(`FLOW '${flow.id}' declares LINK '${edge.from}' TO '${edge.to}' VIA '${edge.type}' more than once`);
        }
        edgeKeys.add(edge.id);
        flow.edges.push(edge);
      }
    }
    const nodeIds = new Set(flow.nodes.map(node => node.id));
    for (const edge of flow.edges) {
      for (const endpoint of [edge.from, edge.to]) {
        if (!nodeIds.has(endpoint)) {
          throw new Error(`FLOW '${flow.id}' LINK references unknown NODE '${endpoint}'`);
        }
      }
    }
    return { type: 'flow', payload: flow };
  }

  visitDirectiveValue(ctx) {
    if (ctx.quotedString()) return this.str(ctx.quotedString().getText());
    if (ctx.signedNumber()) return this.visitSignedNumber(ctx.signedNumber());
    return Boolean(ctx.booleanLiteral().TRUE());
  }

  visitSignedNumber(ctx) {
    const magnitude = Number(ctx.NUMBER().getText());
    return ctx.MINUS() ? -magnitude : magnitude;
  }

  visitFlowNodeDecl(ctx) {
    const node = { id: this.str(ctx.quotedString().getText()) };
    let transport = null;
    for (const clause of ctx.flowNodeClause() || []) {
      const strings = (clause.quotedString() || []).map(item => this.str(item.getText()));
      if (clause.KIND()) node.kind = strings[0];
      else if (clause.TYPE()) node.type = strings[0];
      else if (clause.LABEL()) node.label = strings[0];
      else if (clause.CATALOG()) node.sourceCatalogId = strings[0];
      else if (clause.SOURCE()) node.paletteSource = strings[0];
      else if (clause.AT()) {
        node.x = this.visitSignedNumber(clause.signedNumber(0));
        node.y = this.visitSignedNumber(clause.signedNumber(1));
      } else if (clause.TARGET()) node.target = { ...(node.target || {}), nodeId: strings[0] };
      else if (clause.IP()) node.target = { ...(node.target || {}), ip: strings[0] };
      else if (clause.SERVICES()) node.target = { ...(node.target || {}), services: strings };
      else if (clause.VIA()) transport = strings[0];
    }
    if (node.target) {
      node.target = { nodeId: node.target.nodeId || '', ip: node.target.ip || '', services: node.target.services || [] };
      if (transport) {
        node.targetBinding = {
          bindingType: 'topology-target',
          preferredTransport: transport,
          targetRef: node.target.nodeId,
          serviceCandidates: node.target.services
        };
      }
    } else if (transport) {
      throw new Error(`NODE '${node.id}' uses VIA without a TARGET`);
    }
    return node;
  }

  visitGenericSystemDecl(ctx) {
    const raw = {
      systemId: this.str(ctx.quotedString().getText()),
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
          symbol: this.str(port.quotedString(0).getText()),
          direction: port.INPUT() ? 'input' : 'output',
          dataTypeId: this.str(port.quotedString(1).getText())
        });
      } else if (member.genericSystemConnectionDecl()) {
        const connection = member.genericSystemConnectionDecl();
        raw.connections.push({
          symbol: this.str(connection.quotedString(0).getText()),
          source: this.str(connection.quotedString(1).getText()),
          target: this.str(connection.quotedString(2).getText()),
          dataTypeId: this.str(connection.quotedString(3).getText())
        });
      }
    }
    return { type: 'genericSystem', payload: buildGenericSystem(raw) };
  }

  visitClusterCreateDecl(ctx) {
    const strings = ctx.quotedString() || [];
    const clusterId = this.str(strings[0].getText());
    return {
      type: 'cluster',
      payload: {
        clusterId,
        label: ctx.LABEL() ? this.str(strings[1].getText()) : clusterId,
        nodes: this.visit(ctx.quotedList())
      }
    };
  }

  visitArtifactDeployDecl(ctx) {
    const strings = ctx.quotedString() || [];
    return {
      type: 'artifactDeployment',
      payload: {
        artifactId: this.str(strings[0].getText()),
        fileName: this.str(strings[1].getText()),
        clusterId: this.str(strings[2].getText())
      }
    };
  }

  visitDeploymentDecl(ctx) {
    return {
      type: 'deployment',
      payload: {
        id: this.str(ctx.quotedString(0).getText()),
        projectId: this.str(ctx.quotedString(1).getText()),
        targets: this.visit(ctx.quotedList(0)),
        resources: (ctx.deploymentItem() || []).map((item) => this.visit(item))
      }
    };
  }

  visitDeploymentItem(ctx) {
    if (ctx.hostedServiceDeploymentItem()) {
      return this.visitHostedServiceDeploymentItem(ctx.hostedServiceDeploymentItem());
    }
    if (ctx.FLOW()) {
      return {
        kind: 'flow',
        id: this.str(ctx.quotedString(0).getText()),
        fileName: this.str(ctx.quotedString(1).getText()),
        targets: this.visit(ctx.quotedList()),
        startup: Boolean(ctx.booleanLiteral()?.TRUE())
      };
    }
    if (ctx.REMOVE()) {
      const strings = ctx.quotedString() || [];
      return {
        action: 'remove',
        kind: 'service',
        id: this.str(strings[0].getText()),
        targets: this.visit(ctx.quotedList())
      };
    }
    const kind = ctx.SERVICE() ? 'service' : (ctx.PROGRAM() ? 'program' : 'daemon');
    const strings = ctx.quotedString() || [];
    const lifecycle = ctx.serviceLifecycleClause ? ctx.serviceLifecycleClause() : null;
    return {
      kind,
      id: this.str(strings[0].getText()),
      fileName: this.str(strings[1].getText()),
      inputQueue: this.str(strings[2].getText()),
      outputQueue: this.str(strings[3].getText()),
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

  visitHostedServiceDeploymentItem(ctx) {
    const strings = ctx.quotedString() || [];
    const lists = ctx.quotedList() || [];
    const id = this.str(strings[0].getText());
    const ownerAggregatorId = this.str(strings[2].getText());
    const reportTarget = this.str(strings[3].getText());
    const requires = lists.length > 1 ? this.visit(lists[1]) : [];
    const bindings = {};
    const requiredIds = new Set();

    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || SERVICE_ID_ALIASES.has(id)) {
      throw new Error(`HOSTED SERVICE has invalid canonical service id '${id}'`);
    }
    if (!this.str(strings[1].getText()).trim()) {
      throw new Error(`HOSTED SERVICE '${id}' requires a non-empty file name`);
    }
    if (!ownerAggregatorId.trim() || ownerAggregatorId !== ownerAggregatorId.trim()) {
      throw new Error(`HOSTED SERVICE '${id}' requires a non-empty OWNER aggregator id`);
    }
    if (!reportTarget) {
      throw new Error(`HOSTED SERVICE '${id}' requires a non-empty REPORT target`);
    }
    let reportUrl;
    try { reportUrl = reportTarget === reportTarget.trim() ? new URL(reportTarget) : null; } catch { reportUrl = null; }
    if (!reportUrl || !['http:', 'https:'].includes(reportUrl.protocol) || !reportUrl.hostname) {
      throw new Error(`HOSTED SERVICE '${id}' needs an explicit absolute HTTP(S) REPORT target`);
    }

    for (const requiredServiceId of requires) {
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(requiredServiceId)
        || SERVICE_ID_ALIASES.has(requiredServiceId)) {
        throw new Error(`HOSTED SERVICE '${id}' has invalid required service id '${requiredServiceId}'`);
      }
      if (requiredServiceId === id) {
        throw new Error(`HOSTED SERVICE '${id}' cannot require itself`);
      }
      if (requiredIds.has(requiredServiceId)) {
        throw new Error(`HOSTED SERVICE '${id}' requires '${requiredServiceId}' more than once`);
      }
      requiredIds.add(requiredServiceId);
    }

    for (const binding of ctx.requirementBinding() || []) {
      const bindingStrings = binding.quotedString() || [];
      const [serviceId, instanceId, endpoint, readinessUrl] = bindingStrings.map(item => this.str(item.getText()));
      if (!serviceId || !instanceId || !endpoint || !readinessUrl) {
        throw new Error(`HOSTED SERVICE '${id}' has an incomplete requirement binding`);
      }
      if (instanceId !== instanceId.trim()) {
        throw new Error(`HOSTED SERVICE '${id}' requirement '${serviceId}' needs a non-empty instance id`);
      }
      if (!requires.includes(serviceId)) {
        throw new Error(`HOSTED SERVICE '${id}' binds undeclared requirement '${serviceId}'`);
      }
      if (Object.hasOwn(bindings, serviceId)) {
        throw new Error(`HOSTED SERVICE '${id}' binds requirement '${serviceId}' more than once`);
      }
      for (const [name, value] of [['endpoint', endpoint], ['readiness URL', readinessUrl]]) {
        let url;
        try { url = value === value.trim() ? new URL(value) : null; } catch { url = null; }
        if (!url || !['http:', 'https:'].includes(url.protocol) || !url.hostname) {
          throw new Error(`HOSTED SERVICE '${id}' requirement '${serviceId}' needs an explicit absolute HTTP(S) ${name}`);
        }
      }
      bindings[serviceId] = { instanceId, endpoint, readinessUrl };
    }

    const missingBindings = requires.filter(requiredServiceId => !Object.hasOwn(bindings, requiredServiceId));
    if (missingBindings.length) {
      throw new Error(`HOSTED SERVICE '${id}' is missing explicit bindings for ${missingBindings.join(', ')}`);
    }

    return {
      kind: 'hosted-service',
      id,
      fileName: this.str(strings[1].getText()),
      targets: this.visit(lists[0]),
      startup: Boolean(ctx.booleanLiteral()?.TRUE()),
      ownerAggregatorId,
      reportTarget: { endpoint: reportTarget },
      serviceLifecycle: { version: 1, requires, bindings }
    };
  }

  visitQueueDecl(ctx) {
    const strings = ctx.quotedString() || [];
    const symbol = this.str(strings[0].getText());
    const queueName = this.str(strings[1].getText());
    const managerId = ctx.MANAGER() ? this.str(strings[2].getText()) : null;
    let dataTypeIds = [];

    if (ctx.TYPE()) {
      dataTypeIds = [this.str(strings[managerId ? 3 : 2].getText())];
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
    const typeName = ctx.TYPE() ? this.str(strings[index++].getText()) : null;
    const managerId = ctx.MANAGER() ? this.str(strings[index++].getText()) : null;
    const connectionRef = ctx.CONNECTION() ? this.str(strings[index++].getText()) : null;
    return {
      type: 'database',
      payload: {
        symbol: this.str(strings[0].getText()),
        databaseName: this.str(strings[1].getText()),
        typeName,
        managerId,
        connectionRef
      }
    };
  }

  visitSystemTypeDecl(ctx) {
    const systemName = this.str(ctx.quotedString().getText());
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
    const systemId = this.str(strings[0].getText());
    const typeName = strings[1] ? this.str(strings[1].getText()) : null;
    const environmentName = this.environment;
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
    const symbol = this.str(strings[0].getText());
    const hasRuntimeName = Boolean(ctx.ARROW());
    const declaredName = hasRuntimeName ? this.str(strings[1].getText()) : symbol;
    const typeStrings = ctx.quotedString() || [];
    const typeStart = hasRuntimeName ? 2 : 1;
    const managerId = ctx.MANAGER()
      ? this.str(typeStrings[hasRuntimeName ? 2 : 1].getText())
      : null;
    const typeOffset = hasRuntimeName ? (managerId ? 3 : 2) : (managerId ? 2 : 1);
    const dataTypeIds = (ctx.TYPE() || ctx.TYPES())
      ? typeStrings.slice(typeOffset).map(item => this.str(item.getText())).filter(Boolean)
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
    const serviceId = this.str(strings[1].getText());
    if (!listServiceKeys().includes(serviceId)) {
      throw new Error(`Unknown service '${serviceId}' in service registry`);
    }
    return {
      kind: 'service',
      symbol: this.str(strings[0].getText()),
      serviceId,
      systemId: context.systemPath?.join('.') || context.systemId || null,
      visibility: this.visitVisibility(ctx.visibilityClause())
    };
  }

  visitQuotedList(ctx) {
    return (ctx.quotedString() || []).map(q => this.str(q.getText())).filter(Boolean);
  }

  visitFileDecl(ctx) {
    const strings = ctx.quotedString() || [];
    return {
      type: 'file',
      payload: {
        symbol: this.str(strings[0].getText()),
        path: this.str(strings[1].getText()),
        managerId: ctx.MANAGER() ? this.str(strings[2].getText()) : null
      }
    };
  }

  visitApiDecl(ctx) {
    return {
      type: 'api',
      payload: {
        symbol: this.str(ctx.quotedString(0).getText()),
        baseUrl: this.str(ctx.quotedString(1).getText())
      }
    };
  }

  visitWorkflowDecl(ctx) {
    const id = this.str(ctx.quotedString().getText());
    const steps = [];
    for (const stmt of ctx.workflowStmt() || []) {
      steps.push(this.visit(stmt));
    }
    return {
      type: 'workflow',
      payload: { id, steps, sourceLine: ctx.start.line, endLine: ctx.stop?.line || ctx.start.line }
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
      sourceLine: ctx.start.line,
      mode,
      timeoutMs,
      backoutOnError,
      subflows
    };
  }

  visitSubflowDecl(ctx) {
    const id = this.str(ctx.quotedString().getText());
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
      sourceLine: ctx.start.line,
      body,
      onError
    };
  }

  visitStepStmt(ctx) {
    const id = this.str(ctx.quotedString().getText());
    const bodyCtx = ctx.stepBody();
    const start = bodyCtx.start.tokenIndex;
    const stop = bodyCtx.stop.tokenIndex;
    const rawTokens = this.tokens.tokens.slice(start, stop + 1)
      .map(t => (t.type === WorkflowDslLexer.STRING && t.text.includes('${')
        ? `"${this.str(t.text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        : t.text));
    let body = rawTokens.join(' ').replace(/\s+/g, ' ').trim();
    body = body.replace(/\s+([(),])/g, '$1').replace(/([()])\s+/g, '$1');
    const line = `STEP ${quoteDouble(id)} ${body};`;
    return { ...parseStepFromLine(line), sourceLine: ctx.start.line };
  }

  visitIfStmt(ctx) {
    const condition = {
      field: this.str(ctx.quotedString(0).getText()),
      operator: ctx.EQUALS() ? 'equals' : 'contains',
      value: this.str(ctx.quotedString(1).getText())
    };

    const thenBranch = this.visit(ctx.branch(0));
    const elseBranch = ctx.branch(1) ? this.visit(ctx.branch(1)) : [];

    return {
      id: `if-${ctx.start.tokenIndex}`,
      action: 'if',
      sourceLine: ctx.start.line,
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

export function parseWorkflowDslWithAntlr(sourceText, options = {}) {
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

  const builder = new WorkflowAstBuilder(tokens, options);
  const parsed = builder.visit(tree);
  validateSystemConformance(parsed.symbols.systems);
  return parsed;
}

/**
 * @param {string} sourceText
 * @param {{ environment?: string, variables?: Record<string, string>, env?: Record<string, string|undefined> }} [options]
 *   environment overrides PULSE_ENVIRONMENT and DEFAULT ENVIRONMENT; variables pre-seed LET values;
 *   env replaces process.env for ENV("NAME").
 */
export function compileWorkflowDSLWithAntlr(sourceText, options = {}) {
  const text = String(sourceText || '');
  dslDebug('wfl', 'compile:start', { chars: text.length });
  try {
    const parsed = parseWorkflowDslWithAntlr(text, options);
    const result = {
      version: 4,
      compiledAt: new Date().toISOString(),
      symbols: parsed.symbols,
      bindings: buildDeploymentBindingManifest(parsed.symbols),
      workflows: parsed.workflows,
      deployments: parsed.deployments,
      clusters: parsed.clusters,
      artifactDeployments: parsed.artifactDeployments,
      genericSystems: parsed.genericSystems,
      flows: parsed.flows,
      configuration: parsed.configuration
    };
    dslDebug('wfl', 'compile:complete', { workflows: result.workflows.length, deployments: result.deployments.length });
    return result;
  } catch (error) {
    throw dslError('wfl', 'compile', error, { chars: text.length });
  }
}
