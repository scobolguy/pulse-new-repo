// Pulse0 ANTLR4 grammar (Pascal-like)
grammar Pulse;

program: 'program' identifier ';' (declaration)* 'begin' statement* 'end' '.' ;

declaration: varDecl | procDecl ;

varDecl: 'var' varList ';' ;
varList: identifier (',' identifier)* ':' type ;

type: 'integer' | 'boolean' | 'real' | arrayType | recordType ;
arrayType: 'array' '[' intLit '..' intLit ']' 'of' type ;
recordType: 'record' varList (';' varList)* 'end' ;

procDecl: 'procedure' identifier ('(' paramList ')')? ';' declaration* 'begin' statement* 'end' ';' ;
paramList: param (';' param)* ;
param: identifier (',' identifier)* ':' type ;

statement: assignStmt
         | ifStmt
         | whileStmt
         | forStmt
         | procCall
         | spawnStmt
         | sendStmt
         | recvStmt
         | ';' ;

assignStmt: identifier ':=' expr ';' ;
ifStmt: 'if' expr 'then' statement ('else' statement)? ;
whileStmt: 'while' expr 'do' statement ;
forStmt: 'for' identifier ':=' expr 'to' expr 'do' statement ;
procCall: identifier ('(' (expr (',' expr)*)? ')')? ';' ;
spawnStmt: 'spawn' identifier ('(' (expr (',' expr)*)? ')')? ';' ;
sendStmt: 'send' '(' identifier (',' expr)* ')' ';' ;
recvStmt: 'receive' '(' identifier (',' identifier)* ')' ';' ;

expr: simpleExpr (relop simpleExpr)? ;
simpleExpr: term (addop term)* ;
term: factor (mulop factor)* ;
factor: identifier | intLit | boolLit | '(' expr ')' ;
relop: '=' | '<>' | '<' | '<=' | '>' | '>=' ;
addop: '+' | '-' | 'or' ;
mulop: '*' | '/' | 'and' ;

identifier: IDENT ;
intLit: INT ;
boolLit: 'true' | 'false' ;

IDENT: [a-zA-Z_][a-zA-Z_0-9]* ;
INT: [0-9]+ ;
WS: [ \t\r\n]+ -> skip ;
COMMENT: '//' ~[\r\n]* -> skip ;
