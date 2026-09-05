grammar Pascalish;

// Case-insensitive so programs can use lowercase, UPPERCASE or mixed keywords.
options { caseInsensitive = true; }

// ============================================================
// Top-level compilation unit
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
    | importDecl
    | blockStmt
    ;

// ============================================================
// Runtime placement and unit declarations
// ============================================================

placement
    : 'on' ('local' | 'parent' | 'child' | 'sibling' | 'alternate')
    ;

programDecl
    : 'program' stringOrIdent placement? ';' unitDecl* block? unitEnd
    ;

serviceDecl
    : 'service' stringOrIdent placement? ';'? unitDecl* (serviceBody | serviceEndpoint* 'end')? unitEnd
    ;

daemonDecl
    : 'daemon' stringOrIdent placement? daemonSchedule? ';'? unitDecl* block? unitEnd
    ;

// Wirth compilation units terminate with '.'; ';' is still accepted while the
// existing corpus is migrated.
unitEnd
    : '.'
    | ';'
    ;

// Declared inside a unit: private to that unit, never published to the Data
// Librarian or Mapping Librarian.
unitDecl
    : varSection
    | subprogramDecl
    | serviceDecl
    | daemonDecl
    | typeDecl
    | classDecl
    | queueDecl
    | fileDecl
    | roleDecl
    | libraryDecl
    | useDecl
    | interopDecl
    | routerDecl
    | mapperDecl
    | importDecl
    ;

varSection
    : 'var' varLine+
    ;

varLine
    : identList ':' typeRef placement? varSource? ';'
    ;

subprogramDecl
    : ('procedure' | 'function') IDENT '(' paramSection? ')' (':' typeRef)? ';' unitDecl* block ';'
    ;

paramSection
    : paramGroup (';' paramGroup)*
    ;

paramGroup
    : identList ':' typeRef
    ;

daemonSchedule
    : 'refresh' expr ('ms' | 's' | 'm' | 'second' | 'seconds')
    | 'every' expr ('ms' | 'second' | 'seconds')
    ;

// ============================================================
// Types, classes, variables, queues, and files
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
    | STRING
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
    : typeName genericTypeArgs?
    ;

// Librarian type ids may contain hyphens (e.g. swift-mt103). Safe here because
// type position never contains arithmetic.
typeName
    : IDENT ('-' IDENT)*
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
// Integration DSL: role, library, use, interop, import
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

importDecl
    : 'import' importTarget 'from' serviceProvider ';'
    ;

importTarget
    : IDENT
    | STRING
    ;

serviceProvider
    : stringOrIdent
    ;

// ============================================================
// Router declaration
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
// Mapper declaration
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
// Service body and HTTP endpoints
// ============================================================

serviceBody
    : 'begin' serviceBodyElement* 'end'
    ;

serviceBodyElement
    : serviceLocalDecl
    | serviceStmt
    ;

serviceLocalDecl
    : unitDecl
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
    | serviceRouteStmt ';'
    | serviceReturnStmt ';'
    ;

serviceRouteStmt
    : 'route' IDENT? 'from' stringOrIdent 'to' stringOrIdent
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
// PL/0 snippet and inline rule bodies
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
// Block and imperative statements
// ============================================================

block
    : 'begin' statementList? 'end'
    ;

// Wirth: ';' separates statements; a trailing one before END is tolerated.
statementList
    : statement (';' statement)* ';'?
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
    | returnStmt
    ;

withStmt
    : 'with' expr 'do' statement
    ;

assignStmt
    : lvalue ':=' expr
    ;

callStmt
    : 'call'? qualifiedName '(' exprList? ')'
    ;

ifStmt
    : 'if' expr 'then' statement ('else' statement)?
    ;

whileStmt
    : 'while' expr 'do' statement
    ;

forStmt
    : 'for' IDENT ':=' expr 'to' expr 'do' statement
    ;

repeatStmt
    : 'repeat' statementList 'until' expr
    ;

enqueueStmt
    : 'enqueue' IDENT 'with' expr
    ;

dequeueStmt
    : 'dequeue' IDENT 'into' IDENT
    ;

peekStmt
    : 'peek' IDENT 'into' IDENT
    ;

pushStmt
    : 'push' IDENT 'with' expr
    ;

popStmt
    : 'pop' IDENT 'into' IDENT
    ;

concurrentStmt
    : cobeginStmt
    | asyncStmt
    | waitStmt
    | syncStmt
    | subflowStmt
    ;

cobeginStmt
    : 'cobegin' statementList? 'coend'
    ;

asyncStmt
    : 'async' statement
    ;

waitStmt
    : 'wait' 'all' identGroup? ('into' identGroup)? ('timeout' expr timeUnit)? waitErrorClause?
    | 'wait' IDENT
    ;

identGroup
    : '(' IDENT (',' IDENT)* ')'
    | IDENT
    ;

waitErrorClause
    : 'on' 'error' 'fail' 'transaction' stringValue
    ;

timeUnit
    : 'ms'
    | 's'
    | 'm'
    ;

syncStmt
    : 'sync' IDENT
    ;

subflowStmt
    : 'subflow' stringValue subflowOption*
    ;

subflowOption
    : 'on' stringOrIdent
    | 'with' exprList
    | 'timeout' expr timeUnit
    | 'into' IDENT
    ;

returnStmt
    : 'return' 'success'? expr?
    ;

fileStmt
    : 'open' IDENT 'for' ('read' | 'write')
    | 'read' IDENT 'into' IDENT
    | 'write' IDENT 'with' expr
    | 'close' IDENT
    ;

// ============================================================
// Expressions
// ============================================================

lvalue
    : IDENT ('.' IDENT)*
    ;

qualifiedName
    : IDENT ('.' qualifiedPart)*
    ;

// HTTP verbs are keywords, so allow them after a dot (e.g. httpVerb.post).
qualifiedPart
    : IDENT
    | httpVerb
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
// Lexer rules
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

WS
    : [ \t\r\n]+ -> skip
    ;
