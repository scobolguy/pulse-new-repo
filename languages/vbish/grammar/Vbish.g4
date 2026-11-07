grammar Vbish;

options { caseInsensitive = true; }

compilationUnit
  : optionExplicit? runtimeDecl? (interopDecl | roleDecl | libraryDecl | useDecl | importDecl | routeDecl | systemDecl | databaseDecl | endpointDecl | topLevelDecl)* EOF
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

roleDecl
  : ROLE roleName
  ;

roleName
  : CODE_LIBRARIAN
  | IDENTIFIER
  ;

libraryDecl
  : LIBRARY stringOrIdentifier (FROM librarySource)?
  ;

librarySource
  : LIBRARIAN
  | MAPPER
  | stringOrIdentifier
  ;

useDecl
  : USE stringOrIdentifier (AS IDENTIFIER)?
  ;

importDecl
  : IMPORT MAPPER stringOrIdentifier FROM librarySource
  ;

routeDecl
  : ROUTE stringOrIdentifier TO stringOrIdentifier USING MAPPER stringOrIdentifier
  ;

systemDecl
  : SYSTEM (TYPE stringOrIdentifier | stringOrIdentifier (OF TYPE stringOrIdentifier)?) systemVisibilityClause? BEGIN_KW systemMember* END
  ;

databaseDecl
  : DATABASE stringOrIdentifier TYPE typeName
  ;

endpointDecl
  : ENDPOINT stringOrIdentifier stringOrIdentifier (HANDLER stringOrIdentifier)?
  ;

systemMember
  : systemQueueDecl
  | systemServiceDecl
  | systemDecl
  ;

systemQueueDecl
  : QUEUE stringOrIdentifier (ARROW stringOrIdentifier)? TYPE stringOrIdentifier systemVisibilityClause?
  ;

systemServiceDecl
  : SERVICE stringOrIdentifier (ARROW stringOrIdentifier)? systemVisibilityClause?
  ;

systemVisibilityClause
  : VISIBILITY (INTERNAL | EXPOSED)
  ;

variableDecl
  : DIM IDENTIFIER (AS typeName)? ((FROM (LIBRARIAN | MAPPER)) | (ASSIGN expression) | (FROM (LIBRARIAN | MAPPER) ASSIGN expression) | (ASSIGN expression FROM (LIBRARIAN | MAPPER)))?
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
  : relational ((ASSIGN | NE) relational)*
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
  : (ASSIGN | NE | LT | GT | LTE | GTE) primary
  ;

typeName
  : STRING | INTEGER | DOUBLE | BOOLEAN | IDENTIFIER
  ;

stringOrIdentifier
  : STRING_LITERAL | IDENTIFIER
  ;

// The VB11 profile retains separators and uses the same generated lexer/parser.
vbCompilationUnit
  : vbEol* (vbOption vbEol)* (vbImport vbEol)* (vbModule | vbProcedure vbEol*)+ EOF
  ;

vbOption : OPTION (EXPLICIT | STRICT | INFER) (ON | OFF);
vbImport : IMPORTS vbQualifiedName;
vbModule
  : (PUBLIC | FRIEND)? MODULE vbIdentifier vbEol
    (vbEol | vbProcedure vbEol)*
    END MODULE vbEol*
  ;
vbProcedure
  : (PUBLIC | PRIVATE | FRIEND)? SHARED?
    (SUB vbIdentifier vbTypeParameters? vbParameters vbEol vbBlock END SUB
    | FUNCTION vbIdentifier vbTypeParameters? vbParameters AS vbType vbEol vbBlock END FUNCTION)
  ;
vbTypeParameters : LPAREN OF vbIdentifier (COMMA vbIdentifier)* RPAREN;
vbTypeArguments : LPAREN OF vbType (COMMA vbType)* RPAREN;
vbParameters : LPAREN (vbParameter (COMMA vbParameter)*)? RPAREN;
vbParameter : (BYVAL | BYREF)? vbIdentifier AS vbType;
vbType : INTEGER | SBYTE | BYTE | SHORT | USHORT | BOOLEAN | STRING | DOUBLE | LONG | OBJECT | vbIdentifier;
vbBlock : (vbEol | vbStatement vbEol)*;
vbStatement
  : DIM vbVariable (COMMA vbVariable)*
  | vbIdentifier (ASSIGN | PLUS_ASSIGN | MINUS_ASSIGN | MUL_ASSIGN | CONCAT_ASSIGN) vbExpression
  | vbIf
  | vbFor
  | vbWhile
  | vbDo
  | RETURN vbExpression?
  | EXIT (FOR | WHILE | DO | SUB | FUNCTION)
  | CONTINUE (FOR | WHILE | DO)
  | (PRINT | DISPLAY) (vbExpression (COMMA vbExpression)*)?
  | CALL? vbQualifiedName vbTypeArguments? vbArguments
  ;
vbVariable : vbIdentifier (AS vbType)? (ASSIGN vbExpression)?;
vbIf
  : IF vbExpression THEN vbEol vbBlock
    (ELSEIF vbExpression THEN vbEol vbBlock)*
    (ELSE vbEol vbBlock)? END IF
  ;
vbFor
  : FOR vbIdentifier (AS vbType)? ASSIGN vbExpression TO vbExpression (STEP vbExpression)?
    vbEol vbBlock NEXT vbIdentifier?
  ;
vbWhile : WHILE vbExpression vbEol vbBlock END WHILE;
vbDo : DO ((WHILE | UNTIL) vbExpression)? vbEol vbBlock LOOP ((WHILE | UNTIL) vbExpression)?;
vbExpression : vbOr;
vbOr : vbXor ((OR | ORELSE) vbXor)*;
vbXor : vbAnd (XOR vbAnd)*;
vbAnd : vbNot ((AND | ANDALSO) vbNot)*;
vbNot : NOT vbNot | vbComparison;
vbComparison : vbConcat ((ASSIGN | NE | LT | GT | LTE | GTE) vbConcat)*;
vbConcat : vbAdd (AMPERSAND vbAdd)*;
vbAdd : vbMod ((PLUS | MINUS) vbMod)*;
vbMod : vbIntegerDivision (MOD vbIntegerDivision)*;
vbIntegerDivision : vbMultiply (INTEGER_DIV vbMultiply)*;
vbMultiply : vbUnary ((MUL | DIV) vbUnary)*;
vbUnary : (PLUS | MINUS) vbUnary | vbPrimary;
vbPrimary
  : STRING_LITERAL | NUMBER | TRUE | FALSE | NOTHING
  | (CINT | CSBYTE | CBYTE | CSHORT | CUSHORT | CBOOL | CSTR) LPAREN vbExpression RPAREN
  | vbQualifiedName (vbTypeArguments? vbArguments)?
  | LPAREN vbExpression RPAREN
  ;
vbArguments : LPAREN (vbExpression (COMMA vbExpression)*)? RPAREN;
vbQualifiedName : vbIdentifier (DOT vbIdentifier)*;
vbIdentifier
  : IDENTIFIER | SYSTEM | M | S | MS | SECOND | SECONDS | LOCAL | PARENT
  | CHILD | SIBLING | ALTERNATE | SERVICE | DAEMON | PROGRAM | ROLE | LIBRARY
  | LIBRARIAN | MAPPER | ROUTE | QUEUE | VISIBILITY | EXPOSED | INTERNAL
  | PULSE | VBISH | PASCALISH | COBOLISH | WFL | WORKFLOW | CODE_LIBRARIAN
  ;
vbEol : (NEWLINE | COLON)+;

MODULE: {this.standardMode}? 'MODULE';
CINT: {this.standardMode}? 'CINT';
CSBYTE: {this.standardMode}? 'CSBYTE';
CBYTE: {this.standardMode}? 'CBYTE';
CSHORT: {this.standardMode}? 'CSHORT';
CUSHORT: {this.standardMode}? 'CUSHORT';
SBYTE: {this.standardMode}? 'SBYTE';
BYTE: {this.standardMode}? 'BYTE';
SHORT: {this.standardMode}? 'SHORT';
USHORT: {this.standardMode}? 'USHORT';
CBOOL: {this.standardMode}? 'CBOOL';
CSTR: {this.standardMode}? 'CSTR';
PUBLIC: {this.standardMode}? 'PUBLIC';
PRIVATE: {this.standardMode}? 'PRIVATE';
FRIEND: {this.standardMode}? 'FRIEND';
SHARED: {this.standardMode}? 'SHARED';
IMPORTS: {this.standardMode}? 'IMPORTS';
STRICT: {this.standardMode}? 'STRICT';
INFER: {this.standardMode}? 'INFER';
OFF: {this.standardMode}? 'OFF';
BYVAL: {this.standardMode}? 'BYVAL';
BYREF: {this.standardMode}? 'BYREF';
LONG: {this.standardMode}? 'LONG';
OBJECT: {this.standardMode}? 'OBJECT';
ELSEIF: {this.standardMode}? 'ELSEIF';
DO: {this.standardMode}? 'DO';
LOOP: {this.standardMode}? 'LOOP';
UNTIL: {this.standardMode}? 'UNTIL';
EXIT: {this.standardMode}? 'EXIT';
CONTINUE: {this.standardMode}? 'CONTINUE';
CALL: {this.standardMode}? 'CALL';
NOTHING: {this.standardMode}? 'NOTHING';
MOD: {this.standardMode}? 'MOD';
XOR: {this.standardMode}? 'XOR';
PLUS_ASSIGN: '+=';
MINUS_ASSIGN: '-=';
MUL_ASSIGN: '*=';
CONCAT_ASSIGN: '&=';
INTEGER_DIV: '\\';
DOT: '.';
COLON: ':';

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
ROLE: 'ROLE';
CODE_LIBRARIAN: 'CODE_LIBRARIAN';
LIBRARY: 'LIBRARY';
USE: 'USE';
IMPORT: 'IMPORT';
MAPPER: 'MAPPER';
ROUTE: 'ROUTE';
SYSTEM: 'SYSTEM';
TYPE: 'TYPE';
DATABASE: 'DATABASE';
ENDPOINT: 'ENDPOINT';
HANDLER: 'HANDLER';
OF: 'OF';
QUEUE: 'QUEUE';
VISIBILITY: 'VISIBILITY';
INTERNAL: 'INTERNAL';
EXPOSED: 'EXPOSED';
BEGIN_KW: 'BEGIN';
ARROW: '->';
USING: 'USING';
LIBRARIAN: 'LIBRARIAN';
FROM: 'FROM';
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
NE: '<>';
LT: '<';
GT: '>';
LTE: '<=';
GTE: '>=';
NUMBER: [0-9]+ ('.' [0-9]+)?;
STRING_LITERAL
  : {this.standardMode}? '"' ('""' | ~["\r\n])* '"'
  | {!this.standardMode}? '"' (~["\\\r\n] | '\\' .)* '"'
  ;
IDENTIFIER
  : {this.standardMode}? ([A-Z_] [A-Z0-9_]* | '[' [A-Z_] [A-Z0-9_]* ']')
  | {!this.standardMode}? [A-Z_] [A-Z0-9_-]*
  ;
LINE_CONTINUATION: {this.standardMode}? [ \t]+ '_' [ \t]* '\r'? '\n' -> skip;
COMMENT: '\'' ~[\r\n]* -> skip;
NEWLINE: ('\r\n' | '\r' | '\n') {if (!this.standardMode) this.skip();};
WS: [ \t]+ -> skip;