import antlr4 from 'antlr4';
import WorkflowDslLexer from '../grammar/generated-modern/WorkflowDslLexer.js';
import WorkflowDslParser from '../grammar/generated-modern/WorkflowDslParser.js';
import WorkflowDslVisitor from '../grammar/generated-modern/WorkflowDslVisitor.js';

function parseQuoted(value) {
  const s = String(value || '').trim();
  if (s.length < 2) return null;
  const q = s[0];
  if ((q !== '"' && q !== '\'') || s[s.length - 1] !== q) return null;
  return s.slice(1, -1);
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

class WorkflowAstBuilder extends WorkflowDslVisitor {
  constructor(tokens) {
    super();
    this.tokens = tokens;
  }

  visitProgram(ctx) {
    const symbols = { queues: [], files: [], apis: [] };
    const workflows = [];

    for (const item of ctx.item() || []) {
      const value = this.visit(item);
      if (!value) continue;
      if (value.type === 'queue') symbols.queues.push(value.payload);
      if (value.type === 'file') symbols.files.push(value.payload);
      if (value.type === 'api') symbols.apis.push(value.payload);
      if (value.type === 'workflow') workflows.push(value.payload);
    }

    return { symbols, workflows };
  }

  visitItem(ctx) {
    if (ctx.queueDecl()) return this.visit(ctx.queueDecl());
    if (ctx.fileDecl()) return this.visit(ctx.fileDecl());
    if (ctx.apiDecl()) return this.visit(ctx.apiDecl());
    if (ctx.workflowDecl()) return this.visit(ctx.workflowDecl());
    return null;
  }

  visitQueueDecl(ctx) {
    const symbol = parseQuoted(ctx.quotedString(0).getText());
    const queueName = parseQuoted(ctx.quotedString(1).getText());
    let dataTypeIds = [];

    if (ctx.TYPE()) {
      dataTypeIds = [parseQuoted(ctx.quotedString(2).getText())];
    } else if (ctx.TYPES()) {
      dataTypeIds = this.visit(ctx.quotedList());
    }

    return {
      type: 'queue',
      payload: {
        symbol,
        queueName,
        dataTypeIds,
        dataTypeId: dataTypeIds[0] || null
      }
    };
  }

  visitQuotedList(ctx) {
    return (ctx.quotedString() || []).map(q => parseQuoted(q.getText())).filter(Boolean);
  }

  visitFileDecl(ctx) {
    return {
      type: 'file',
      payload: {
        symbol: parseQuoted(ctx.quotedString(0).getText()),
        path: parseQuoted(ctx.quotedString(1).getText())
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
  return builder.visit(tree);
}

export function compileWorkflowDSLWithAntlr(sourceText) {
  const parsed = parseWorkflowDslWithAntlr(sourceText);
  return {
    version: 4,
    compiledAt: new Date().toISOString(),
    symbols: parsed.symbols,
    workflows: parsed.workflows
  };
}
