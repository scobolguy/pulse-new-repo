grammar Pascalish;

// Case-insensitive so programs can use lowercase, UPPERCASE or Mixed keywords.
options { caseInsensitive = true; }

// ============================================================
//  Top-level compilation unit
//  Accepts any mix of declarations in any order.
// ============================================================

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
    | roleDecl
    | libraryDecl
    | useDecl
    | interopDecl
    | routerDecl
    | mapperDecl
    | blockStmt
    ;

// ============================================================
//  Runtime unit declarations
// ============================================================

placement
    : 'on' ('local' | 'parent' | 'child' | 'sibling' | 'alternate')
    ;

programDecl
    : 'program' stringOrIdent placement? ';' block '.'
    ;

serviceDecl
    : 'service' stringOrIdent placement? ';'? (serviceBody | serviceEndpoint* 'end') ('.' | ';')?
    ;

daemonDecl
    : 'daemon' stringOrIdent placement? daemonSchedule ';'? block '.'
    ;

daemonSchedule
    : 'refresh' expr ('ms' | 's' | 'm' | 'second' | 'seconds')
    | 'every' expr ('ms' | 'second' | 'seconds')
    ;

// ============================================================
//  Type, class, variable, queue and file declarations
// ============================================================

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
    : 'var' IDENT ':' typeRef placement? varSource? ';'
    ;

varSource
    : 'from' 'librarian'
    | 'from' 'mapper'
    | 'from' (IDENT | STRING)
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

// ============================================================
//  Integration DSL: role, library, use, interop
// ============================================================

roleDecl
    : 'role' roleName ';'
    ;

roleName
    : 'code_librarian'
    | IDENT
    ;

libraryDecl
    : 'library' stringOrIdent 'from' librarySource ';'
    ;

librarySource
    : 'librarian'
    | stringOrIdent
    ;

useDecl
    : 'use' stringOrIdent ('as' IDENT)? ';'
    ;

interopDecl
    : 'interop' interopKind stringOrIdent ('as' IDENT)? ';'
    ;

interopKind
    : 'wfl'
    | 'workflow'
    | 'cobolish'
    | 'pascalish'
    ;

// ============================================================
//  Router declaration
// ============================================================

routerDecl
    : 'router' stringOrIdent 'input' stringValue routerHeaderProp* 'begin' outputDecl* 'end' ';'
    ;

routerHeaderProp
    : 'description' stringValue
    | 'enabled' booleanValue
    | 'service' stringValue
    | 'methods' verbList
    ;

verbList
    : stringOrIdent
    | '(' stringOrIdent (',' stringOrIdent)* ')'
    ;

outputDecl
    : 'output' stringValue outputTypeMeta? 'when' pl0Snippet 'transform' pl0Snippet ';'
    ;

outputTypeMeta
    : 'type' typeRef
    | 'types' typeRefList
    ;

typeRefList
    : typeRef
    | '(' typeRef (',' typeRef)* ')'
    ;

// ============================================================
//  Mapper declaration
// ============================================================

mapperDecl
    : 'mapper' stringOrIdent 'source' typeRef 'target' typeRef mapperHeaderProp* 'begin' mapDecl* 'end' ';'
    ;

mapperHeaderProp
    : 'description' stringValue
    | 'enabled' booleanValue
    ;

mapDecl
    : 'map' stringValue 'to' stringValue ('using' pl0Snippet)? ';'
    ;

// ============================================================
//  Service body and HTTP endpoints
// ============================================================

serviceBody
    : 'begin' serviceStmt* 'end'
    ;

serviceEndpoint
    : httpVerb stringValue endpointAccepts? endpointReturns? ';' blockStmt
    ;

httpVerb
    : 'get' | 'post' | 'put' | 'delete' | 'patch'
    ;

endpointAccepts
    : 'accepts' typeRef
    ;

endpointReturns
    : 'returns' typeRef
    ;

serviceStmt
    : serviceCaseStmt
    | serviceReturnStmt ';'
    ;

serviceCaseStmt
    : 'case' serviceExpr 'of' serviceCaseArm+ ('else' serviceReturnStmt ';')? 'end' ';'?
    ;

serviceCaseArm
    : serviceExpr ':' serviceReturnStmt ';'
    ;

serviceReturnStmt
    : 'return' serviceExpr
    ;

serviceExpr
    : qualifiedName
    | STRING
    | NUMBER
    | 'true'
    | 'false'
    ;

// ============================================================
//  PL/0 snippet (inline rule body, map transform, when clause)
// ============================================================

pl0Snippet
    : STRING
    | pl0Block
    ;

pl0Block
    : 'begin' pl0Element* 'end'
    ;

pl0Element
    : pl0Block
    | '(' | ')' | '+' | '-' | '*' | '/'
    | '=' | '<' | '>'
    | '<=' | '>=' | '<>'
    | ',' | ';' | '.' | ':=' | ':' | '||'
    | 'if' | 'then' | 'else'
    | 'while' | 'do' | 'for' | 'to'
    | 'call' | 'return' | 'not'
    | 'cobegin' | 'coend'
    | 'subflow' | 'sync' | 'async' | 'wait' | 'all'
    | 'with' | 'timeout' | 'into'
    | 'ms' | 's' | 'm'
    | 'on' | 'error' | 'fail' | 'transaction' | 'success'
    | 'backout' | 'try' | 'catch' | 'endtry'
    | 'true' | 'false' | 'map'
    | NUMBER | STRING | IDENT
    ;

// ============================================================
//  Block and statements (imperative / program body)
// ============================================================

block
    : 'begin' statement* 'end'
    ;

blockStmt
    : 'begin' pl0Element* 'end' (';' | '.')?
    ;

statement
    : assignStmt
    | callStmt
    | ifStmt
    | whileStmt
    | forStmt
    | repeatStmt
    | withStmt
    | block
    | enqueueStmt
    | dequeueStmt
    | peekStmt
    | pushStmt
    | popStmt
    | concurrentStmt
    | fileStmt
    ;

withStmt
    : 'with' expr 'do' statement* 'end' ';'
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

// ============================================================
//  Expressions
// ============================================================

lvalue
    : IDENT ('.' IDENT)*
    ;

qualifiedName
    : IDENT ('.' IDENT)*
    ;

stringOrIdent
    : STRING
    | IDENT
    ;

stringValue
    : STRING
    ;

booleanValue
    : 'true'
    | 'false'
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

// ============================================================
//  Lexer rules
// ============================================================

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

BRACE_COMMENT
    : '{' .*? '}' -> skip
    ;

PAREN_COMMENT
    : '(*' .*? '*)' -> skip
    ;

WS
    : [ \t\r\n\f]+ -> skip
    ;
