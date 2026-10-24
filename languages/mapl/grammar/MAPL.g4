grammar MAPL;

mapUnit
    : mapDecl* EOF
    ;

mapDecl
    : 'map' nameRef 'from' nameRef 'to' nameRef ';' mapDirective* mapBody 'end' ';'
    ;

nameRef
    : IDENT
    | STRING
    ;

// Header metadata used by the Data Mapper designer, e.g. @sourceSchema 'schemas/pacs.008.xsd';
mapDirective
    : '@' IDENT directiveValue ';'
    ;

directiveValue
    : STRING
    | NUMBER
    | 'true'
    | 'false'
    ;

mapBody
    : mapStmt*
    ;

mapStmt
    : assignStmt
    | assignDefaultStmt
    | functionAssignStmt
    | ifStmt
    | forStmt
    | validateStmt
    ;

fieldPath
    : IDENT ('.' pathSegment)*
    ;

// Quoted segments carry field names that are not identifiers or are keywords, e.g. source.block4.'31C'
pathSegment
    : IDENT
    | STRING
    ;

assignStmt
    : fieldPath ':=' fieldPath ('using' STRING)? ';'
    ;

assignDefaultStmt
    : fieldPath ':=' fieldPath 'default' expr ';'
    ;

functionAssignStmt
    : fieldPath ':=' functionCall ';'
    ;

functionCall
    : IDENT '(' exprList? ')'
    ;

ifStmt
    : 'if' expr 'then' mapBody ('else' mapBody)? 'end' ';'
    ;

forStmt
    : 'for' 'each' fieldPath 'as' IDENT mapBody 'end' ';'
    ;

validateStmt
    : 'validate' expr ';'
    ;

exprList
    : expr (',' expr)*
    ;

expr
    : logicalOrExpr
    ;

logicalOrExpr
    : logicalAndExpr ('or' logicalAndExpr)*
    ;

logicalAndExpr
    : equalityExpr ('and' equalityExpr)*
    ;

equalityExpr
    : relationalExpr (('=' | '<>') relationalExpr)*
    ;

relationalExpr
    : additiveExpr (('<' | '<=' | '>' | '>=') additiveExpr)*
    ;

additiveExpr
    : multiplicativeExpr (('+' | '-') multiplicativeExpr)*
    ;

multiplicativeExpr
    : unaryExpr (('*' | '/' | 'mod') unaryExpr)*
    ;

unaryExpr
    : ('not' | '-') unaryExpr
    | primaryExpr
    ;

primaryExpr
    : NUMBER
    | STRING
    | 'true'
    | 'false'
    | functionCall
    | fieldPath
    | '(' expr ')'
    ;

IDENT
    : [a-zA-Z_] [a-zA-Z_0-9]*
    ;

NUMBER
    : [0-9]+ ('.' [0-9]+)?
    ;

STRING
    : '"' (~["\\] | '\\' .)* '"'
    | '\'' (~['\\] | '\\' .)* '\''
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;

BLOCK_COMMENT
    : '/*' .*? '*/' -> skip
    ;

WS
    : [ \t\r\n\f]+ -> skip
    ;
