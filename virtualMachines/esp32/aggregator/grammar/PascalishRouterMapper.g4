grammar PascalishRouterMapper;

program
  : statement* EOF
  ;

statement
  : serviceDecl
  | varDecl
  | routerDecl
  | mapperDecl
  ;

varDecl
  : VAR IDENT COLON stringOrIdent varSource? SEMICOLON
  ;

varSource
  : FROM LIBRARIAN
  | FROM stringOrIdent
  ;

serviceDecl
  : SERVICE stringValue SEMICOLON
  ;

routerDecl
  : ROUTER stringOrIdent INPUT stringValue routerHeaderProp* BEGIN outputDecl* END SEMICOLON
  ;

routerHeaderProp
  : DESCRIPTION stringValue
  | ENABLED booleanValue
  | SERVICE stringValue
  ;

outputDecl
  : OUTPUT stringValue outputTypeMeta? WHEN pl0Snippet TRANSFORM pl0Snippet SEMICOLON
  ;

outputTypeMeta
  : TYPE stringValue
  | TYPES stringList
  ;

mapperDecl
  : MAPPER stringOrIdent SOURCE stringValue TARGET stringValue mapperHeaderProp* BEGIN mapDecl* END SEMICOLON
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
  | ASSIGN
  | CONCAT
  | IF
  | THEN
  | ELSE
  | WHILE
  | DO
  | FOR
  | CALL
  | NOT
  | TRUE
  | FALSE
  | NUMBER
  | STRING
  | IDENT
  ;

SERVICE: 'SERVICE';
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
ASSIGN: ':=';
COLON: ':';
CONCAT: '||';
LE: '<=';
GE: '>=';
NEQ: '<>';

IDENT: [a-zA-Z_][a-zA-Z0-9_-]*;
NUMBER: [0-9]+;
STRING: '"' (~["\\\r\n] | '\\' .)* '"' | '\'' (~['\\\r\n] | '\\' .)* '\'';

BRACE_COMMENT: '{' .*? '}' -> skip;
PAREN_COMMENT: '(*' .*? '*)' -> skip;
WS: [ \t\r\n]+ -> skip;
