grammar Vbish;

options { caseInsensitive = true; }

compilationUnit
  : optionExplicit? runtimeDecl? interopDecl* topLevelDecl* EOF
  ;

optionExplicit
  : OPTION EXPLICIT
  ;

runtimeDecl
  : PULSE? (SERVICE | DAEMON | PROGRAM) stringOrIdentifier (ON placement)? (EVERY NUMBER intervalUnit)?
  ;

placement
  : LOCAL | PARENT | CHILD | SIBLING | ALTERNATE
  ;

intervalUnit
  : MS | S | M | SECOND | SECONDS
  ;

interopDecl
  : INTEROP interopKind STRING_LITERAL (AS IDENTIFIER)?
  ;

interopKind
  : PASCALISH | COBOLISH | VBISH | WFL | WORKFLOW
  ;

topLevelDecl
  : variableDecl
  | subDecl
  | functionDecl
  ;

variableDecl
  : DIM IDENTIFIER (AS typeName) ? (ASSIGN expression)?
  ;

subDecl
  : SUB IDENTIFIER parameterList? statement* END SUB
  ;

functionDecl
  : FUNCTION IDENTIFIER parameterList? (AS typeName)? statement* END FUNCTION
  ;

parameterList
  : LPAREN (parameter (COMMA parameter)*)? RPAREN
  ;

parameter
  : expression (AS typeName)?
  ;

statement
  : variableDecl
  | ifStatement
  | forStatement
  | whileStatement
  | printStatement
  | assignment
  | callStatement
  | returnStatement
  ;

ifStatement
  : IF expression THEN statement* (ELSE statement*)? END IF
  ;

forStatement
  : FOR IDENTIFIER ASSIGN expression TO expression (STEP expression)? statement* (END FOR | NEXT IDENTIFIER?)
  ;

whileStatement
  : WHILE expression statement* END WHILE
  ;

printStatement
  : (PRINT | DISPLAY) (expression (COMMA expression)*)?
  ;

assignment
  : IDENTIFIER ASSIGN expression
  ;

callStatement
  : IDENTIFIER parameterList?
  ;

returnStatement
  : RETURN expression?
  ;

expression
  : logicalOr
  ;

logicalOr
  : logicalAnd ((OR | ORELSE) logicalAnd)*
  ;

logicalAnd
  : equality ((AND | ANDALSO) equality)*
  ;

equality
  : relational ((EQ | NE) relational)*
  ;

relational
  : additive ((LT | GT | LTE | GTE) additive)*
  ;

additive
  : multiplicative ((PLUS | MINUS) multiplicative)*
  | multiplicative (AMPERSAND multiplicative)*
  ;

multiplicative
  : primary ((MUL | DIV) primary)*
  ;

primary
  : STRING_LITERAL
  | NUMBER
  | TRUE
  | FALSE
  | IDENTIFIER (parameterList)?
  | LPAREN expression RPAREN
  ;

concatenation
  : AMPERSAND primary
  ;

addOp
  : (PLUS | MINUS) primary
  ;

mulOp
  : (MUL | DIV) primary
  ;

relOp
  : (EQ | NE | LT | GT | LTE | GTE) primary
  ;

typeName
  : STRING | INTEGER | DOUBLE | BOOLEAN | IDENTIFIER
  ;

stringOrIdentifier
  : STRING_LITERAL | IDENTIFIER
  ;

PULSE: 'PULSE';
SERVICE: 'SERVICE';
DAEMON: 'DAEMON';
PROGRAM: 'PROGRAM';
ON: 'ON';
EVERY: 'EVERY';
LOCAL: 'LOCAL';
PARENT: 'PARENT';
CHILD: 'CHILD';
SIBLING: 'SIBLING';
ALTERNATE: 'ALTERNATE';
MS: 'MS';
S: 'S';
M: 'M';
SECOND: 'SECOND';
SECONDS: 'SECONDS';
INTEROP: 'INTEROP';
PASCALISH: 'PASCALISH';
COBOLISH: 'COBOLISH';
VBISH: 'VBISH';
WFL: 'WFL';
WORKFLOW: 'WORKFLOW';
AS: 'AS';
OPTION: 'OPTION';
EXPLICIT: 'EXPLICIT';
DIM: 'DIM';
SUB: 'SUB';
FUNCTION: 'FUNCTION';
END: 'END';
RETURN: 'RETURN';
IF: 'IF';
THEN: 'THEN';
ELSE: 'ELSE';
FOR: 'FOR';
TO: 'TO';
STEP: 'STEP';
NEXT: 'NEXT';
WHILE: 'WHILE';
PRINT: 'PRINT';
DISPLAY: 'DISPLAY';
AND: 'AND';
OR: 'OR';
ANDALSO: 'ANDALSO';
ORELSE: 'ORELSE';
NOT: 'NOT';
STRING: 'STRING';
INTEGER: 'INTEGER';
DOUBLE: 'DOUBLE';
BOOLEAN: 'BOOLEAN';
TRUE: 'TRUE';
FALSE: 'FALSE';
ASSIGN: '=';
LPAREN: '(';
RPAREN: ')';
COMMA: ',';
AMPERSAND: '&';
PLUS: '+';
MINUS: '-';
MUL: '*';
DIV: '/';
EQ: '=';
NE: '<>';
LT: '<';
GT: '>';
LTE: '<=';
GTE: '>=';
NUMBER: [0-9]+ ('.' [0-9]+)?;
STRING_LITERAL: '"' (~["\\\r\n] | '\\' .)* '"';
IDENTIFIER: [A-Z_] [A-Z0-9_-]*;
COMMENT: '\'' ~[\r\n]* -> skip;
WS: [ \t\r\n]+ -> skip;