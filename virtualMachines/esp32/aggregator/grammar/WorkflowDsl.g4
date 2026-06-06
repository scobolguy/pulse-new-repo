grammar WorkflowDsl;

options { caseInsensitive = true; }

program
  : item* EOF
  ;

item
  : queueDecl
  | fileDecl
  | apiDecl
  | workflowDecl
  ;

queueDecl
  : QUEUE quotedString ARROW quotedString (TYPE quotedString | TYPES quotedList)? SEMICOLON
  ;

fileDecl
  : FILE quotedString ARROW quotedString SEMICOLON
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
ARTIFACT: 'ARTIFACT';
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

ARROW: '->';
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
