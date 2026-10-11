grammar WorkflowDsl;

options { caseInsensitive = true; }

program
  : item* EOF
  ;

item
  : queueDecl
  | databaseDecl
  | systemTypeDecl
  | systemDecl
  | fileDecl
  | apiDecl
  | workflowDecl
  | deploymentDecl
  | clusterCreateDecl
  | artifactDeployDecl
  | genericSystemDecl
  | flowDecl
  | letDecl
  | defaultEnvironmentDecl
  | configIfDecl
  ;

// Compile-time configuration. Items are evaluated top to bottom, so a LET or
// DEFAULT ENVIRONMENT only affects the items that follow it.
letDecl
  : LET IDENT ASSIGN_EQ stringExpr SEMICOLON
  ;

defaultEnvironmentDecl
  : DEFAULT ENVIRONMENT stringExpr SEMICOLON
  ;

configIfDecl
  : IF condition THEN item* (ELSIF condition THEN item*)* (ELSE item*)? ENDIF SEMICOLON
  ;

condition
  : andCondition (OR andCondition)*
  ;

andCondition
  : notCondition (AND notCondition)*
  ;

notCondition
  : NOT notCondition
  | primaryCondition
  ;

primaryCondition
  : LPAREN condition RPAREN
  | booleanLiteral
  | stringExpr compareOp stringExpr
  | stringExpr NOT? IN LPAREN stringExpr (COMMA stringExpr)* RPAREN
  | stringExpr NOT? (CONTAINS | LIKE | MATCHES) stringExpr
  | stringExpr (STARTS | ENDS) WITH stringExpr
  ;

compareOp
  : ASSIGN_EQ
  | EQUALS
  | NEQ
  | LT
  | LE
  | GT
  | GE
  ;

stringExpr
  : stringAtom (AMP stringAtom)*
  ;

stringAtom
  : quotedString
  | NUMBER
  | IDENT
  | ENVIRONMENT
  | ENV LPAREN stringExpr (COMMA stringExpr)? RPAREN
  | (LOWER | UPPER) LPAREN stringExpr RPAREN
  ;

// Visual flow: the designer-editable graph of nodes and typed links.
flowDecl
  : FLOW quotedString BEGIN flowMember* END SEMICOLON
  ;

flowMember
  : flowDirective
  | flowSeedDecl
  | flowNodeDecl
  | flowLinkDecl
  ;

flowDirective
  : AT_SIGN directiveKey directiveValue SEMICOLON
  ;

directiveKey
  : IDENT
  | DESCRIPTION
  | TYPE
  | LABEL
  | MODE
  | TARGET
  | SOURCE
  | KIND
  ;

directiveValue
  : quotedString
  | signedNumber
  | booleanLiteral
  ;

flowSeedDecl
  : SEED quotedString SEMICOLON
  ;

flowNodeDecl
  : NODE quotedString flowNodeClause* SEMICOLON
  ;

flowNodeClause
  : KIND quotedString
  | TYPE quotedString
  | LABEL quotedString
  | CATALOG quotedString
  | SOURCE quotedString
  | AT signedNumber COMMA signedNumber
  | TARGET quotedString
  | IP quotedString
  | SERVICES LPAREN (quotedString (COMMA quotedString)*)? RPAREN
  | VIA quotedString
  ;

flowLinkDecl
  : LINK quotedString TO quotedString VIA quotedString (LABEL quotedString)? SEMICOLON
  ;

signedNumber
  : MINUS? NUMBER
  ;

genericSystemDecl
  : GENERIC_SYSTEM quotedString BEGIN genericSystemMember* END SEMICOLON
  ;

genericSystemMember
  : genericSystemDecl
  | genericSystemPortDecl
  | genericSystemConnectionDecl
  ;

genericSystemPortDecl
  : PORT quotedString (INPUT | OUTPUT) TYPE quotedString SEMICOLON
  ;

genericSystemConnectionDecl
  : CONNECT QUEUE quotedString FROM quotedString TO quotedString TYPE quotedString SEMICOLON
  ;

clusterCreateDecl
  : CREATE CLUSTER quotedString (LABEL quotedString)? NODES quotedList SEMICOLON
  ;

artifactDeployDecl
  : DEPLOY ARTIFACT quotedString FILE quotedString TO CLUSTER quotedString SEMICOLON
  ;

deploymentDecl
  : DEPLOYMENT quotedString PROJECT quotedString TARGETS quotedList BEGIN deploymentItem* END SEMICOLON
  ;

deploymentItem
  : (SERVICE | PROGRAM | DAEMON) quotedString FILE quotedString QUEUE quotedString ARROW quotedString TARGETS quotedList STARTUP booleanLiteral serviceLifecycleClause? SEMICOLON
  | FLOW quotedString FILE quotedString TARGETS quotedList STARTUP booleanLiteral SEMICOLON
  | REMOVE SERVICE quotedString FROM TARGETS quotedList SEMICOLON
  ;

serviceLifecycleClause
  : PERSISTENT booleanLiteral MIN_INSTANCES NUMBER MAX_INSTANCES NUMBER IDLE_TIMEOUT NUMBER TIME_UNIT
  ;

booleanLiteral
  : TRUE
  | FALSE
  ;

queueDecl
  : QUEUE quotedString ARROW quotedString (MANAGER quotedString)? (TYPE quotedString | TYPES quotedList)? (MODE (SYNC | ASYNC))? SEMICOLON
  ;

databaseDecl
  : DATABASE quotedString ARROW quotedString (TYPE quotedString)? (MANAGER quotedString)? (CONNECTION quotedString)? SEMICOLON
  ;

systemTypeDecl
  : SYSTEM TYPE quotedString BEGIN systemMember* END SEMICOLON
  ;

systemDecl
  : SYSTEM quotedString (OF TYPE quotedString)? visibilityClause? BEGIN systemMember* END SEMICOLON
  ;

systemMember
  : systemQueueDecl
  | serviceDecl
   | systemDecl
  ;

systemQueueDecl
  : QUEUE quotedString (ARROW quotedString)? (MANAGER quotedString)? (TYPE quotedString | TYPES quotedList)? visibilityClause? SEMICOLON
  ;

serviceDecl
  : SERVICE quotedString ARROW quotedString visibilityClause? SEMICOLON
  ;

visibilityClause
  : VISIBILITY (INTERNAL | EXPOSED)
  ;

fileDecl
  : FILE quotedString ARROW quotedString (MANAGER quotedString)? SEMICOLON
  ;

apiDecl
  : API quotedString BASE quotedString SEMICOLON
  ;

workflowDecl
  : WORKFLOW quotedString BEGIN workflowStmt* END SEMICOLON
  ;

workflowStmt
  : stepStmt
  | ifStmt
  | cobeginStmt
  | tryStmt
  ;

cobeginStmt
  : COBEGIN cobeginMode (ON ERROR BACKOUT)? BEGIN subflowDecl+ COEND SEMICOLON
  ;

cobeginMode
  : SYNC
  | ASYNC WAIT NUMBER
  ;

subflowDecl
  : SUBFLOW quotedString BEGIN workflowStmt* END SEMICOLON
  ;

tryStmt
  : TRY BEGIN workflowStmt* END (CATCH BEGIN workflowStmt* END)? ENDTRY SEMICOLON
  ;

stepStmt
  : STEP quotedString stepBody SEMICOLON
  ;

stepBody
  : stepToken+
  ;

stepToken
  : quotedString
  | NUMBER
  | IDENT
  | LPAREN
  | RPAREN
  | COMMA
  | ASSIGN_EQ
  | CALL
  | SERVICE
  | API
  | ROUTE
  | QUEUE
  | SET
  | STATE
  | WAIT
  | CHECK
  | EXPECT
  | RETRIES
  | EVERY
  | ISSUE
  | CREATE
  | TITLE
  | DESCRIPTION
  | PRIORITY
  | ASSIGN
  | USER
  | REPORTER
  | TYPE
  | INTO
  | TESTCASE
  | TESTPLAN
  | PLAN
  | LINK
  | TO
  | ADD
  | PROJECT
  | RELEASE
  | FOR
  | DEPLOYMENT
  | ARTIFACT
  | LOCATION
  | PROJECTPLAN
  | MILESTONE
  | DUE
  | DATE
  | TASK
  | SYNCHPOINT
  | DELIVERABLE
  | RESOURCE
  | COBEGIN
  | COEND
  | SUBFLOW
  | SYNC
  | ASYNC
  | ON
  | ERROR
  | BACKOUT
  | TRY
  | CATCH
  | ENDTRY
  | FLOW
  | SEED
  | NODE
  | KIND
  | CATALOG
  | SOURCE
  | AT
  | TARGET
  | IP
  | SERVICES
  | VIA
  | LET
  | DEFAULT
  | ENVIRONMENT
  | ENV
  | ELSIF
  | AND
  | OR
  | NOT
  | IN
  | LIKE
  | MATCHES
  | STARTS
  | ENDS
  | WITH
  | LOWER
  | UPPER
  ;

ifStmt
  : IF FIELD quotedString (EQUALS | CONTAINS) quotedString THEN branch (ELSE SEMICOLON branch)? ENDIF SEMICOLON
  ;

branch
  : BEGIN workflowStmt* END SEMICOLON
  | stepStmt
  ;

quotedList
  : LPAREN quotedString (COMMA quotedString)* RPAREN
  ;

quotedString
  : STRING
  ;

QUEUE: 'QUEUE';
DATABASE: 'DATABASE';
MANAGER: 'MANAGER';
CONNECTION: 'CONNECTION';
MODE: 'MODE';
SYSTEM: 'SYSTEM';
OF: 'OF';
VISIBILITY: 'VISIBILITY';
INTERNAL: 'INTERNAL';
EXPOSED: 'EXPOSED';
FILE: 'FILE';
API: 'API';
BASE: 'BASE';
WORKFLOW: 'WORKFLOW';
BEGIN: 'BEGIN';
END: 'END';
STEP: 'STEP';
CALL: 'CALL';
ROUTE: 'ROUTE';
SET: 'SET';
STATE: 'STATE';
WAIT: 'WAIT';
CHECK: 'CHECK';
EXPECT: 'EXPECT';
RETRIES: 'RETRIES';
EVERY: 'EVERY';
ISSUE: 'ISSUE';
CREATE: 'CREATE';
TITLE: 'TITLE';
DESCRIPTION: 'DESCRIPTION';
PRIORITY: 'PRIORITY';
ASSIGN: 'ASSIGN';
USER: 'USER';
REPORTER: 'REPORTER';
TYPE: 'TYPE';
TYPES: 'TYPES';
INTO: 'INTO';
TESTCASE: 'TESTCASE';
TESTPLAN: 'TESTPLAN';
PLAN: 'PLAN';
LINK: 'LINK';
TO: 'TO';
ADD: 'ADD';
PROJECT: 'PROJECT';
RELEASE: 'RELEASE';
FOR: 'FOR';
DEPLOYMENT: 'DEPLOYMENT';
DEPLOY: 'DEPLOY';
ARTIFACT: 'ARTIFACT';
CLUSTER: 'CLUSTER';
NODES: 'NODES';
LABEL: 'LABEL';
GENERIC_SYSTEM: 'GENERIC_SYSTEM';
PORT: 'PORT';
INPUT: 'INPUT';
OUTPUT: 'OUTPUT';
CONNECT: 'CONNECT';
FROM: 'FROM';
REMOVE: 'REMOVE';
LOCATION: 'LOCATION';
PROJECTPLAN: 'PROJECTPLAN';
MILESTONE: 'MILESTONE';
DUE: 'DUE';
DATE: 'DATE';
TASK: 'TASK';
SYNCHPOINT: 'SYNCHPOINT';
DELIVERABLE: 'DELIVERABLE';
RESOURCE: 'RESOURCE';
COBEGIN: 'COBEGIN';
COEND: 'COEND';
SUBFLOW: 'SUBFLOW';
SYNC: 'SYNC';
ASYNC: 'ASYNC';
ON: 'ON';
ERROR: 'ERROR';
BACKOUT: 'BACKOUT';
TRY: 'TRY';
CATCH: 'CATCH';
ENDTRY: 'ENDTRY';
IF: 'IF';
FIELD: 'FIELD';
EQUALS: 'EQUALS';
CONTAINS: 'CONTAINS';
THEN: 'THEN';
ELSE: 'ELSE';
ENDIF: 'ENDIF';
SERVICE: 'SERVICE';
PROGRAM: 'PROGRAM';
DAEMON: 'DAEMON';
PERSISTENT: 'PERSISTENT';
MIN_INSTANCES: 'MIN_INSTANCES';
MAX_INSTANCES: 'MAX_INSTANCES';
IDLE_TIMEOUT: 'IDLE_TIMEOUT';
TIME_UNIT: 'MS' | 'S' | 'M';
TARGETS: 'TARGETS';
STARTUP: 'STARTUP';
TRUE: 'TRUE';
FALSE: 'FALSE';
FLOW: 'FLOW';
SEED: 'SEED';
NODE: 'NODE';
KIND: 'KIND';
CATALOG: 'CATALOG';
SOURCE: 'SOURCE';
AT: 'AT';
TARGET: 'TARGET';
IP: 'IP';
SERVICES: 'SERVICES';
VIA: 'VIA';
LET: 'LET';
DEFAULT: 'DEFAULT';
ENVIRONMENT: 'ENVIRONMENT';
ENV: 'ENV';
ELSIF: 'ELSIF';
AND: 'AND';
OR: 'OR';
NOT: 'NOT';
IN: 'IN';
LIKE: 'LIKE';
MATCHES: 'MATCHES';
STARTS: 'STARTS';
ENDS: 'ENDS';
WITH: 'WITH';
LOWER: 'LOWER';
UPPER: 'UPPER';

ARROW: '->';
NEQ: '<>' | '!=';
LE: '<=';
GE: '>=';
LT: '<';
GT: '>';
AMP: '&';
AT_SIGN: '@';
MINUS: '-';
ASSIGN_EQ: '=';
LPAREN: '(';
RPAREN: ')';
COMMA: ',';
SEMICOLON: ';';

STRING
  : '"' (~["\\\r\n] | '\\' .)* '"'
  | '\'' (~['\\\r\n] | '\\' .)* '\''
  ;

NUMBER: [0-9]+;
IDENT: [A-Za-z_][A-Za-z0-9_-]*;

HASH_COMMENT: '#' ~[\r\n]* -> skip;
SLASH_COMMENT: '//' ~[\r\n]* -> skip;
DASH_COMMENT: '--' ~[\r\n]* -> skip;
WS: [ \t\r\n]+ -> skip;
