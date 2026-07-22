grammar StandardPascal;

options { caseInsensitive = true; }

program
  : PROGRAM IDENT SEMICOLON block DOT EOF
  ;

block
  : varSection? procedureDecl* compoundStmt
  ;

varSection
  : VAR varDecl+
  ;

varDecl
  : identList COLON INTEGER SEMICOLON
  ;

identList
  : IDENT (COMMA IDENT)*
  ;

procedureDecl
  : PROCEDURE IDENT LPAREN paramList? RPAREN SEMICOLON varSection? compoundStmt SEMICOLON
  ;

paramList
  : paramDecl (SEMICOLON paramDecl)*
  ;

paramDecl
  : identList COLON INTEGER
  ;

compoundStmt
  : BEGIN statementList? END
  ;

statementList
  : statement (SEMICOLON statement)* SEMICOLON?
  ;

statement
  : assignment
  | procedureCall
  | ifStmt
  | writelnStmt
  | compoundStmt
  ;

assignment
  : IDENT ASSIGN expr
  ;

procedureCall
  : IDENT LPAREN argList? RPAREN
  ;

ifStmt
  : IF expr THEN statement (ELSE statement)?
  ;

writelnStmt
  : WRITELN LPAREN writeArgList? RPAREN
  ;

writeArgList
  : writeArg (COMMA writeArg)*
  ;

writeArg
  : expr
  | STRING
  ;

argList
  : expr (COMMA expr)*
  ;

expr
  : logicalOrExpr
  ;

logicalOrExpr
  : logicalAndExpr (OR logicalAndExpr)*
  ;

logicalAndExpr
  : comparisonExpr (AND comparisonExpr)*
  ;

comparisonExpr
  : additiveExpr ((EQ | NEQ | LT | LE | GT | GE) additiveExpr)?
  ;

additiveExpr
  : multiplicativeExpr ((PLUS | MINUS) multiplicativeExpr)*
  ;

multiplicativeExpr
  : unaryExpr ((MUL | DIV) unaryExpr)*
  ;

unaryExpr
  : MINUS unaryExpr
  | NOT unaryExpr
  | primary
  ;

primary
  : NUMBER
  | IDENT
  | STRING
  | LPAREN expr RPAREN
  ;

PROGRAM: 'PROGRAM';
VAR: 'VAR';
PROCEDURE: 'PROCEDURE';
BEGIN: 'BEGIN';
END: 'END';
INTEGER: 'INTEGER';
IF: 'IF';
THEN: 'THEN';
ELSE: 'ELSE';
WRITELN: 'WRITELN';
OR: 'OR';
AND: 'AND';
NOT: 'NOT';

ASSIGN: ':=';
COLON: ':';
SEMICOLON: ';';
COMMA: ',';
DOT: '.';
LPAREN: '(';
RPAREN: ')';
PLUS: '+';
MINUS: '-';
MUL: '*';
DIV: '/';
EQ: '=';
NEQ: '<>';
LT: '<';
LE: '<=';
GT: '>';
GE: '>=';

IDENT: [a-z_][a-z0-9_]*;
NUMBER: [0-9]+;
STRING: '"' (~["\\\r\n] | '\\' .)* '"' | '\'' (~['\\\r\n] | '\\' .)* '\'';

BRACE_COMMENT: '{' .*? '}' -> skip;
PAREN_COMMENT: '(*' .*? '*)' -> skip;
LINE_COMMENT: '//' ~[\r\n]* -> skip;
WS: [ \t\r\n]+ -> skip;
