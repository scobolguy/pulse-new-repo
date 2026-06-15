grammar Pascalish;

// ============================================================================
// PARSER RULES
// ============================================================================

// Program structure
program
    : PROGRAM identifier SEMICOLON block DOT EOF
    ;

block
    : declarations compoundStatement
    ;

declarations
    : (constDecl | typeDecl | varDecl | procDecl | libraryDecl | interopDecl)*
    ;

// Constant declarations
constDecl
    : CONST identifier EQUALS expression SEMICOLON
    ;

// Type declarations
typeDecl
    : TYPE identifier EQUALS type SEMICOLON
    ;

type
    : simpleType
    | structuredType
    | objectType
    ;

simpleType
    : INTEGER
    | REAL
    | BOOLEAN
    | STRING
    | identifier
    ;

structuredType
    : arrayType
    | recordType
    ;

arrayType
    : ARRAY LBRACKET expression DOTDOT expression RBRACKET OF type
    ;

recordType
    : RECORD fieldDeclList END
    ;

fieldDeclList
    : (fieldDecl)*
    ;

fieldDecl
    : identifierList COLON type SEMICOLON
    ;

objectType
    : OBJECT (LPAREN identifier RPAREN)? objectBody
    ;

objectBody
    : (fieldDecl | methodDecl)* END
    ;

methodDecl
    : METHOD identifier LPAREN paramList RPAREN (COLON type)? SEMICOLON block SEMICOLON
    ;

// Variable declarations
varDecl
    : VAR identifierList COLON type SEMICOLON
    ;

// Procedure declarations
procDecl
    : PROCEDURE identifier LPAREN paramList RPAREN (COLON type)? SEMICOLON block SEMICOLON
    ;

paramList
    : (param (SEMICOLON param)*)?
    ;

param
    : VAR? identifierList COLON type
    ;

// Library declarations
libraryDecl
    : LIBRARY stringLiteral FROM identifier SEMICOLON
    ;

// Interop declarations
interopDecl
    : INTEROP languageId stringLiteral AS identifier SEMICOLON
    ;

languageId
    : WFL
    | COBOLISH
    | PASCALISH
    ;

// Statements
compoundStatement
    : BEGIN statementList END
    ;

statementList
    : statement (SEMICOLON statement)*
    ;

statement
    : assignment
    | ifStatement
    | whileStatement
    | forStatement
    | repeatStatement
    | caseStatement
    | procedureCall
    | compoundStatement
    | queueStatement
    | gatewayCall
    | cobeginStatement
    | semaphoreStatement
    | // empty statement
    ;

assignment
    : variable ASSIGN expression
    ;

ifStatement
    : IF expression THEN statement (ELSE statement)?
    ;

whileStatement
    : WHILE expression DO statement
    ;

forStatement
    : FOR identifier ASSIGN expression (TO | DOWNTO) expression DO statement
    ;

repeatStatement
    : REPEAT statementList UNTIL expression
    ;

caseStatement
    : CASE expression OF caseList (ELSE statementList)? END
    ;

caseList
    : caseItem (SEMICOLON caseItem)*
    ;

caseItem
    : constantList COLON statement
    ;

constantList
    : constant (COMMA constant)*
    ;

procedureCall
    : identifier (LPAREN expressionList RPAREN)?
    ;

queueStatement
    : QUEUE identifier LPAREN expressionList? RPAREN
    ;

gatewayCall
    : GATEWAY identifier DOT identifier LPAREN expressionList? RPAREN
    ;

cobeginStatement
    : COBEGIN statementList COEND
    ;

semaphoreStatement
    : semWait
    | semSignal
    ;

semWait
    : WAIT LPAREN identifier RPAREN
    ;

semSignal
    : SIGNAL LPAREN identifier RPAREN
    ;

// Expressions
expressionList
    : expression (COMMA expression)*
    ;

expression
    : simpleExpression (relop simpleExpression)?
    ;

simpleExpression
    : sign? term (addop term)*
    ;

term
    : factor (mulop factor)*
    ;

factor
    : identifier
    | number
    | stringLiteral
    | LPAREN expression RPAREN
    | NOT factor
    | functionCall
    | fieldAccess
    | arrayAccess
    ;

functionCall
    : identifier LPAREN expressionList? RPAREN
    ;

fieldAccess
    : identifier DOT identifier
    ;

arrayAccess
    : identifier LBRACKET expression RBRACKET
    ;

variable
    : identifier (DOT identifier | LBRACKET expression RBRACKET)?
    ;

// Operators
relop
    : EQUALS
    | NOTEQUALS
    | LT
    | LE
    | GT
    | GE
    ;

addop
    : PLUS
    | MINUS
    | OR
    ;

mulop
    : STAR
    | SLASH
    | DIV
    | MOD
    | AND
    ;

sign
    : PLUS
    | MINUS
    ;

// Basic elements
identifierList
    : identifier (COMMA identifier)*
    ;

identifier
    : IDENTIFIER
    ;

number
    : INTEGER_LITERAL
    | REAL_LITERAL
    ;

stringLiteral
    : STRING_LITERAL
    ;

constant
    : number
    | stringLiteral
    | identifier
    ;

// ============================================================================
// LEXER RULES
// ============================================================================

// Keywords (case-insensitive)
PROGRAM     : P R O G R A M ;
BEGIN       : B E G I N ;
END         : E N D ;
CONST       : C O N S T ;
TYPE        : T Y P E ;
VAR         : V A R ;
PROCEDURE   : P R O C E D U R E ;
FUNCTION    : F U N C T I O N ;
IF          : I F ;
THEN        : T H E N ;
ELSE        : E L S E ;
WHILE       : W H I L E ;
DO          : D O ;
FOR         : F O R ;
TO          : T O ;
DOWNTO      : D O W N T O ;
REPEAT      : R E P E A T ;
UNTIL       : U N T I L ;
CASE        : C A S E ;
OF          : O F ;
ARRAY       : A R R A Y ;
RECORD      : R E C O R D ;
OBJECT      : O B J E C T ;
METHOD      : M E T H O D ;
LIBRARY     : L I B R A R Y ;
FROM        : F R O M ;
INTEROP     : I N T E R O P ;
AS          : A S ;
QUEUE       : Q U E U E ;
GATEWAY     : G A T E W A Y ;
COBEGIN     : C O B E G I N ;
COEND       : C O E N D ;
WAIT        : W A I T ;
SIGNAL      : S I G N A L ;
NOT         : N O T ;
OR          : O R ;
AND         : A N D ;
DIV         : D I V ;
MOD         : M O D ;

// Type keywords
INTEGER     : I N T E G E R ;
REAL        : R E A L ;
BOOLEAN     : B O O L E A N ;
STRING      : S T R I N G ;

// Language identifiers for interop
WFL         : W F L ;
COBOLISH    : C O B O L I S H ;
PASCALISH   : P A S C A L I S H ;

// Operators and punctuation
PLUS        : '+' ;
MINUS       : '-' ;
STAR        : '*' ;
SLASH       : '/' ;
EQUALS      : '=' ;
NOTEQUALS   : '<>' ;
LT          : '<' ;
LE          : '<=' ;
GT          : '>' ;
GE          : '>=' ;
ASSIGN      : ':=' ;
LPAREN      : '(' ;
RPAREN      : ')' ;
LBRACKET    : '[' ;
RBRACKET    : ']' ;
DOT         : '.' ;
DOTDOT      : '..' ;
COMMA       : ',' ;
SEMICOLON   : ';' ;
COLON       : ':' ;

// Identifiers
IDENTIFIER
    : [a-zA-Z_][a-zA-Z0-9_]*
    ;

// Literals
INTEGER_LITERAL
    : [0-9]+
    ;

REAL_LITERAL
    : [0-9]+ '.' [0-9]+ (E [+-]? [0-9]+)?
    ;

STRING_LITERAL
    : '"' (~["\r\n] | '""')* '"'
    ;

// Comments
COMMENT
    : '{' .*? '}' -> skip
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;

BLOCK_COMMENT
    : '(*' .*? '*)' -> skip
    ;

// Whitespace
WS
    : [ \t\r\n]+ -> skip
    ;

// Case-insensitive fragments
fragment A : [aA] ;
fragment B : [bB] ;
fragment C : [cC] ;
fragment D : [dD] ;
fragment E : [eE] ;
fragment F : [fF] ;
fragment G : [gG] ;
fragment H : [hH] ;
fragment I : [iI] ;
fragment J : [jJ] ;
fragment K : [kK] ;
fragment L : [lL] ;
fragment M : [mM] ;
fragment N : [nN] ;
fragment O : [oO] ;
fragment P : [pP] ;
fragment Q : [qQ] ;
fragment R : [rR] ;
fragment S : [sS] ;
fragment T : [tT] ;
fragment U : [uU] ;
fragment V : [vV] ;
fragment W : [wW] ;
fragment X : [xX] ;
fragment Y : [yY] ;
fragment Z : [zZ] ;