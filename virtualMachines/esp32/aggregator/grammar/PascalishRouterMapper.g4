grammar PascalishRouterMapper;

options { caseInsensitive = true; }

program
  : statement* EOF
  ;

statement
  : serviceDecl
  | runtimeDecl
  | roleDecl
  | varDecl
  | libraryDecl
  | useDecl
  | interopDecl
  | routerDecl
  | mapperDecl
  | blockStmt
  ;

roleDecl
  : ROLE roleName SEMICOLON
  ;

roleName
  : CODE_LIBRARIAN
  | IDENT
  ;

runtimeDecl
  : programDecl
  | daemonDecl
  ;

blockStmt
  : BEGIN pl0Element* END (SEMICOLON | DOT)?
  ;

varDecl
  : VAR IDENT COLON typeRef varSource? SEMICOLON
  ;

varSource
  : FROM LIBRARIAN
  | FROM stringOrIdent
  ;

serviceDecl
  : SERVICE stringOrIdent SEMICOLON serviceBody (DOT | SEMICOLON)?
  ;

serviceBody
  : BEGIN serviceStmt* END
  ;

serviceStmt
  : serviceCaseStmt
  | serviceReturnStmt SEMICOLON
  ;

serviceCaseStmt
  : CASE serviceExpr OF serviceCaseArm+ (ELSE serviceReturnStmt SEMICOLON)? END SEMICOLON?
  ;

serviceCaseArm
  : serviceExpr COLON serviceReturnStmt SEMICOLON
  ;

serviceReturnStmt
  : RETURN serviceExpr
  ;

serviceExpr
  : qualifiedIdent
  | stringValue
  | NUMBER
  | TRUE
  | FALSE
  ;

qualifiedIdent
  : IDENT (DOT IDENT)*
  ;

programDecl
  : PROGRAM stringOrIdent SEMICOLON
  ;

daemonDecl
  : DAEMON stringOrIdent daemonRefresh? SEMICOLON
  ;

daemonRefresh
  : REFRESH NUMBER daemonRefreshUnit?
  ;

daemonRefreshUnit
  : MS
  | S
  | M
  ;

libraryDecl
  : LIBRARY stringOrIdent FROM librarySource SEMICOLON
  ;

librarySource
  : LIBRARIAN
  | stringOrIdent
  ;

useDecl
  : USE stringOrIdent (AS IDENT)? SEMICOLON
  ;

interopDecl
  : INTEROP interopKind stringOrIdent (AS IDENT)? SEMICOLON
  ;

interopKind
  : WFL
  | WORKFLOW
  | COBOLISH
  | PASCALISH
  ;

routerDecl
  : ROUTER stringOrIdent INPUT stringValue routerHeaderProp* BEGIN outputDecl* END SEMICOLON
  ;

routerHeaderProp
  : DESCRIPTION stringValue
  | ENABLED booleanValue
  | SERVICE stringValue
  | METHODS verbList
  ;

verbList
  : stringOrIdent
  | LPAREN stringOrIdent (COMMA stringOrIdent)* RPAREN
  ;

outputDecl
  : OUTPUT stringValue outputTypeMeta? WHEN pl0Snippet TRANSFORM pl0Snippet SEMICOLON
  ;

outputTypeMeta
  : TYPE typeRef
  | TYPES typeRefList
  ;

mapperDecl
  : MAPPER stringOrIdent SOURCE typeRef TARGET typeRef mapperHeaderProp* BEGIN mapDecl* END SEMICOLON
  ;

mapperHeaderProp
  : DESCRIPTION stringValue
  | ENABLED booleanValue
  ;

mapDecl
  : MAP stringValue TO stringValue (USING pl0Snippet)? SEMICOLON
  ;

stringList
  : stringValue
  | LPAREN stringValue (COMMA stringValue)* RPAREN
  ;

typeRefList
  : typeRef
  | LPAREN typeRef (COMMA typeRef)* RPAREN
  ;

typeRef
  : stringOrIdent genericTypeArgs?
  ;

genericTypeArgs
  : LT typeRef (COMMA typeRef)* GT
  ;

stringOrIdent
  : stringValue
  | IDENT
  ;

stringValue
  : STRING
  ;

booleanValue
  : TRUE
  | FALSE
  ;

pl0Snippet
  : STRING
  | pl0Block
  ;

pl0Block
  : BEGIN pl0Element* END
  ;

pl0Element
  : pl0Block
  | LPAREN
  | RPAREN
  | PLUS
  | MINUS
  | MUL
  | DIV
  | EQ
  | LT
  | GT
  | LE
  | GE
  | NEQ
  | COMMA
  | SEMICOLON
  | DOT
  | ASSIGN
  | CONCAT
  | IF
  | THEN
  | ELSE
  | WHILE
  | DO
  | FOR
  | CALL
  | RETURN
  | NOT
  | COBEGIN
  | COEND
  | SUBFLOW
  | SYNC
  | ASYNC
  | WAIT
  | ALL
  | WITH
  | TIMEOUT
  | INTO
  | MS
  | S
  | M
  | ON
  | ERROR
  | FAIL
  | TRANSACTION
  | SUCCESS
  | BACKOUT
  | TRY
  | CATCH
  | ENDTRY
  | TRUE
  | FALSE
  | NUMBER
  | STRING
  | IDENT
  ;

SERVICE: 'SERVICE';
CASE: 'CASE';
OF: 'OF';
RETURN: 'RETURN';
METHODS: 'METHODS';
PROGRAM: 'PROGRAM';
DAEMON: 'DAEMON';
REFRESH: 'REFRESH';
MS: 'MS';
S: 'S';
M: 'M';
LIBRARY: 'LIBRARY';
USE: 'USE';
AS: 'AS';
INTEROP: 'INTEROP';
ROLE: 'ROLE';
CODE_LIBRARIAN: 'CODE_LIBRARIAN';
WFL: 'WFL';
WORKFLOW: 'WORKFLOW';
COBOLISH: 'COBOLISH';
PASCALISH: 'PASCALISH';
ROUTER: 'ROUTER';
MAPPER: 'MAPPER';
INPUT: 'INPUT';
SOURCE: 'SOURCE';
TARGET: 'TARGET';
DESCRIPTION: 'DESCRIPTION';
ENABLED: 'ENABLED';
BEGIN: 'BEGIN';
END: 'END';
OUTPUT: 'OUTPUT';
TYPE: 'TYPE';
TYPES: 'TYPES';
WHEN: 'WHEN';
TRANSFORM: 'TRANSFORM';
MAP: 'MAP';
TO: 'TO';
USING: 'USING';
TRUE: 'TRUE';
FALSE: 'FALSE';
IF: 'IF';
THEN: 'THEN';
ELSE: 'ELSE';
WHILE: 'WHILE';
DO: 'DO';
FOR: 'FOR';
CALL: 'CALL';
NOT: 'NOT';
COBEGIN: 'COBEGIN';
COEND: 'COEND';
SUBFLOW: 'SUBFLOW';
SYNC: 'SYNC';
ASYNC: 'ASYNC';
WAIT: 'WAIT';
ALL: 'ALL';
WITH: 'WITH';
TIMEOUT: 'TIMEOUT';
INTO: 'INTO';
ON: 'ON';
ERROR: 'ERROR';
FAIL: 'FAIL';
TRANSACTION: 'TRANSACTION';
SUCCESS: 'SUCCESS';
BACKOUT: 'BACKOUT';
TRY: 'TRY';
CATCH: 'CATCH';
ENDTRY: 'ENDTRY';
VAR: 'VAR';
FROM: 'FROM';
LIBRARIAN: 'LIBRARIAN';

LPAREN: '(';
RPAREN: ')';
PLUS: '+';
MINUS: '-';
MUL: '*';
DIV: '/';
EQ: '=';
LT: '<';
GT: '>';
COMMA: ',';
SEMICOLON: ';';
DOT: '.';
ASSIGN: ':=';
COLON: ':';
CONCAT: '||';
LE: '<=';
GE: '>=';
NEQ: '<>';

IDENT: [a-z_][a-z0-9_-]*;
NUMBER: [0-9]+;
STRING: '"' (~["\\\r\n] | '\\' .)* '"' | '\'' (~['\\\r\n] | '\\' .)* '\'';

BRACE_COMMENT: '{' .*? '}' -> skip;
PAREN_COMMENT: '(*' .*? '*)' -> skip;
WS: [ \t\r\n]+ -> skip;
