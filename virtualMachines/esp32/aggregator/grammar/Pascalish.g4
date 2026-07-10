grammar Pascalish;

compilationUnit
    : decl* EOF
    ;

decl
    : programDecl
    | serviceDecl
    | daemonDecl
    | typeDecl
    | classDecl
    | varDecl
    | queueDecl
    | fileDecl
    ;

placement
    : 'on' ('local' | 'parent' | 'child' | 'sibling' | 'alternate')
    ;

programDecl
    : 'program' IDENT placement? ';' block '.'
    ;

serviceDecl
    : 'service' IDENT placement? ';'? block '.'
    ;

serviceBody
    : statement*
    ;

daemonDecl
    : 'daemon' IDENT placement? daemonSchedule ';'? block '.'
    ;

daemonSchedule
    : 'refresh' expr 'ms'
    | 'every' expr ('ms' | 'second' | 'seconds')
    ;

typeDecl
    : 'type' IDENT genericTypeParams? '=' typeRef ';'
    ;

classDecl
    : 'class' IDENT genericTypeParams? classInheritance? ';' classMember* 'end' ';'
    ;

classInheritance
    : 'extends' typeRef
    ;

classMember
    : classFieldDecl
    | classMethodDecl
    ;

classFieldDecl
    : IDENT ':' typeRef ';'
    ;

classMethodDecl
    : ('procedure' | 'function') IDENT genericTypeParams? '(' methodParamList? ')' (':' typeRef)? ';' block ';'
    ;

methodParamList
    : methodParamDecl (';' methodParamDecl)*
    ;

methodParamDecl
    : identList ':' typeRef
    ;

varDecl
    : 'var' IDENT ':' typeRef placement? ';'
    ;

identList
    : IDENT (',' IDENT)*
    ;

fileDecl
    : 'file' IDENT 'of' typeRef placement? ';'
    ;

queueDecl
    : 'queue' IDENT queueType placement? ';'
    ;

queueType
    : 'queue' '[' expr '..' expr ']' 'of' typeRef
    | 'queue' '<' typeRef '>'
    ;

stackType
    : 'stack' '[' expr '..' expr ']' 'of' typeRef
    | 'stack' '<' typeRef '>'
    ;

priorityQueueType
    : 'priorityqueue' '[' expr '..' expr ']' 'of' typeRef
    | 'priorityqueue' '<' typeRef '>'
    ;

recordType
    : 'record' recordField* 'end'
    ;

recordField
    : IDENT ':' typeRef ';'
    ;

typeRef
    : simpleType
    | recordType
    | queueType
    | stackType
    | priorityQueueType
    | fixedArrayType
    | dynamicArrayType
    | userType
    ;

genericTypeParams
    : '<' IDENT (',' IDENT)* '>'
    ;

simpleType
    : 'integer'
    | 'real'
    | 'boolean'
    | 'string'
    ;

userType
    : IDENT genericTypeArgs?
    ;

genericTypeArgs
    : '<' typeRef (',' typeRef)* '>'
    ;

fixedArrayType
    : 'array' '[' expr '..' expr ']' 'of' typeRef
    ;

dynamicArrayType
    : 'array' '<' typeRef '>' 'of' typeRef
    ;

block
    : 'begin' statement* 'end'
    ;

statement
    : assignStmt
    | callStmt
    | ifStmt
    | whileStmt
    | forStmt
    | repeatStmt
    | block
    | enqueueStmt
    | dequeueStmt
    | peekStmt
    | pushStmt
    | popStmt
    | concurrentStmt
    | fileStmt
    ;

assignStmt
    : lvalue ':=' expr ';'
    ;

callStmt
    : 'call' qualifiedName '(' exprList? ')' ';'
    ;

ifStmt
    : 'if' expr 'then' statement* ('else' statement*)? 'end' ';'
    ;

whileStmt
    : 'while' expr 'do' statement
    ;

forStmt
    : 'for' IDENT ':=' expr 'to' expr 'do' statement
    ;

repeatStmt
    : 'repeat' statement* 'until' expr ';'
    ;

enqueueStmt
    : 'enqueue' IDENT 'with' expr ';'
    ;

dequeueStmt
    : 'dequeue' IDENT 'into' IDENT ';'
    ;

peekStmt
    : 'peek' IDENT 'into' IDENT ';'
    ;

pushStmt
    : 'push' IDENT 'with' expr ';'
    ;

popStmt
    : 'pop' IDENT 'into' IDENT ';'
    ;

concurrentStmt
    : cobeginStmt
    | asyncStmt
    | waitStmt
    | syncStmt
    | subflowStmt
    ;

cobeginStmt
    : 'cobegin' statement* 'coend' ';'
    ;

asyncStmt
    : 'async' statement
    ;

waitStmt
    : 'wait' 'all' ';'
    | 'wait' IDENT ';'
    ;

syncStmt
    : 'sync' IDENT ';'
    ;

subflowStmt
    : 'subflow' STRING ('with' exprList)? ';'
    ;

fileStmt
    : 'open' IDENT 'for' ('read' | 'write') ';'
    | 'read' IDENT 'into' IDENT ';'
    | 'write' IDENT 'with' expr ';'
    | 'close' IDENT ';'
    ;

lvalue
    : IDENT ('.' IDENT)*
    ;

qualifiedName
    : IDENT ('.' IDENT)*
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
    | qualifiedName '(' exprList? ')'
    | lvalue
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
