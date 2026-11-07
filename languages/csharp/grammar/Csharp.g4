grammar Csharp;

compilationUnit
  : usingDirective* (namespaceDeclaration | classDeclaration*) EOF
  ;
usingDirective : USING qualifiedName SEMI;
namespaceDeclaration : NAMESPACE qualifiedName LBRACE classDeclaration* RBRACE;
classDeclaration : classModifier* CLASS identifier LBRACE memberDeclaration* RBRACE;
classModifier : PUBLIC | INTERNAL | STATIC | SEALED;
memberDeclaration
  : constructorDeclaration
  | attributeSection* methodModifier* ASYNC? type identifier typeParameters? LPAREN parameters? RPAREN block
  ;
constructorDeclaration : methodModifier* identifier LPAREN parameters? RPAREN block;
attributeSection : LBRACKET identifier (arguments)? RBRACKET;
methodModifier : PUBLIC | INTERNAL | PRIVATE | STATIC;
typeParameters : LT identifier (COMMA identifier)* GT;
parameters : parameter (COMMA parameter)*;
parameter : type identifier;
type : scalarCastType | VOID | identifier typeArguments?;
identifier : IDENTIFIER;
qualifiedName : identifier (DOT identifier)*;

block : LBRACE statement* RBRACE;
statement
  : block
  | (CHECKED | UNCHECKED) block
  | SEMI
  | IF LPAREN expression RPAREN statement (ELSE statement)?
  | WHILE LPAREN expression RPAREN statement
  | DO statement WHILE LPAREN expression RPAREN SEMI
  | FOR LPAREN forInitializer? SEMI condition=expression? SEMI increment=expressionList? RPAREN statement
  | RETURN expression? SEMI
  | (BREAK | CONTINUE) SEMI
  | declaration SEMI
  | expression SEMI
  ;
forInitializer : declaration | expressionList;
declaration : type variableDeclarator (COMMA variableDeclarator)*;
variableDeclarator : identifier (ASSIGN expression)?;
expressionList : expression (COMMA expression)*;

expression : assignmentExpression;
assignmentExpression
  : conditionalExpression (assignmentOperator assignmentExpression)?
  ;
assignmentOperator : ASSIGN | PLUS_ASSIGN | MINUS_ASSIGN | MUL_ASSIGN | DIV_ASSIGN | MOD_ASSIGN;
conditionalExpression : logicalOr (QUESTION expression COLON expression)?;
logicalOr : logicalAnd (OR_OR logicalAnd)*;
logicalAnd : equality (AND_AND equality)*;
equality : relational ((EQ | NE) relational)*;
relational : additive ((LT | LE | GT | GE) additive)*;
additive : multiplicative ((PLUS | MINUS) multiplicative)*;
multiplicative : unary ((MUL | DIV | MOD) unary)*;
unary
  : (PLUS | MINUS | NOT | INC | DEC) unary
  | LPAREN scalarCastType RPAREN unary
  | primary (INC | DEC)?
  ;
scalarCastType : INT | SBYTE | BYTE | SHORT | USHORT | BOOL | STRING;
primary
  : INTEGER_LITERAL
  | STRING_LITERAL
  | TRUE
  | FALSE
  | (CHECKED | UNCHECKED) LPAREN expression RPAREN
  | LPAREN expression RPAREN
  | qualifiedName (typeArguments? arguments)?
  ;
typeArguments : LT type (COMMA type)* GT;
arguments : LPAREN expressionList? RPAREN;

USING: 'using';
NAMESPACE: 'namespace';
CLASS: 'class';
PUBLIC: 'public';
INTERNAL: 'internal';
PRIVATE: 'private';
STATIC: 'static';
SEALED: 'sealed';
ASYNC: 'async';
INT: 'int';
SBYTE: 'sbyte';
BYTE: 'byte';
SHORT: 'short';
USHORT: 'ushort';
BOOL: 'bool';
STRING: 'string';
VOID: 'void';
IF: 'if';
ELSE: 'else';
WHILE: 'while';
DO: 'do';
FOR: 'for';
RETURN: 'return';
BREAK: 'break';
CONTINUE: 'continue';
TRUE: 'true';
FALSE: 'false';
UNCHECKED: 'unchecked';
CHECKED: 'checked';
UNSUPPORTED_KEYWORD
  : 'abstract' | 'as' | 'base' | 'case' | 'catch' | 'char'
  | 'const' | 'decimal' | 'default' | 'delegate' | 'double' | 'enum' | 'event'
  | 'explicit' | 'extern' | 'finally' | 'fixed' | 'float' | 'foreach' | 'goto'
  | 'implicit' | 'in' | 'interface' | 'is' | 'lock' | 'long' | 'new' | 'null'
  | 'object' | 'operator' | 'out' | 'override' | 'params' | 'protected'
  | 'readonly' | 'ref' | 'sizeof' | 'stackalloc'
  | 'struct' | 'switch' | 'this' | 'throw' | 'try' | 'typeof' | 'uint' | 'ulong'
  | 'unsafe' | 'virtual' | 'volatile'
  ;
PLUS_ASSIGN: '+=';
MINUS_ASSIGN: '-=';
MUL_ASSIGN: '*=';
DIV_ASSIGN: '/=';
MOD_ASSIGN: '%=';
EQ: '==';
NE: '!=';
LE: '<=';
GE: '>=';
AND_AND: '&&';
OR_OR: '||';
INC: '++';
DEC: '--';
ASSIGN: '=';
LT: '<';
GT: '>';
PLUS: '+';
MINUS: '-';
MUL: '*';
DIV: '/';
MOD: '%';
NOT: '!';
QUESTION: '?';
COLON: ':';
SEMI: ';';
COMMA: ',';
DOT: '.';
LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LBRACKET: '[';
RBRACKET: ']';
INTEGER_LITERAL: [0-9]+;
IDENTIFIER: '@'? [a-zA-Z_] [a-zA-Z_0-9]*;
STRING_LITERAL
  : '"' ('\\' ~[\r\n] | ~["\\\r\n])* '"'
  | '@"' ('""' | ~["])* '"'
  ;
UNTERMINATED_STRING
  : '"' ('\\' ~[\r\n] | ~["\\\r\n])* ('\\'? EOF | '\r'? '\n' | '\r')
  | '@"' ('""' | ~["])* EOF
  ;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;
UNTERMINATED_COMMENT: '/*' (~[*] | '*' ~[/])* '*'? EOF;
LINE_COMMENT: '//' ~[\r\n]* -> skip;
WHITESPACE: [ \t\r\n\u000B\u000C\u0085\u2028\u2029]+ -> skip;
INVALID_CHARACTER: .;
