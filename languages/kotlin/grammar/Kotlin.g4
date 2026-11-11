grammar Kotlin;

kotlinFile
    : separators* packageHeader? separators* (importHeader separators*)*
      (topLevelDeclaration separators*)* EOF
    ;

separators
    : (SEMI | NEWLINE)+
    ;

packageHeader
    : PACKAGE qualifiedIdentifier SEMI?
    ;

importHeader
    : IMPORT qualifiedIdentifier (DOT MUL)? (AS identifier)? SEMI?
    ;

topLevelDeclaration
    : declarationModifier*
      (classDeclaration
      | enumClassDeclaration
      | objectDeclaration
      | functionDeclaration
      | propertyDeclaration
      | typeAliasDeclaration)
    ;

declarationModifier
    : visibilityModifier
    | modalityModifier
    | DATA
    | ANNOTATION
    | SEALED
    | INNER
    | VALUE
    | CONST
    | LATEINIT
    | OVERRIDE
    | ABSTRACT
    | FINAL
    | OPEN
    | EXTERNAL
    | INLINE
    | INFIX
    | OPERATOR
    | SUSPEND
    | TAILREC
    | EXPECT
    | ACTUAL
    | annotation NEWLINE*
    ;

visibilityModifier
    : PUBLIC
    | PRIVATE
    | INTERNAL
    | PROTECTED
    ;

modalityModifier
    : ABSTRACT
    | FINAL
    | OPEN
    | SEALED
    ;

annotation
    : AT (identifier COLON)? qualifiedIdentifier typeArguments? valueArguments?
    ;

classDeclaration
    : (CLASS | FUN? INTERFACE) identifier typeParameters? primaryConstructor?
      typeConstraints? delegationSpecifiers? classBody?
    ;

enumClassDeclaration
    : ENUM CLASS identifier typeParameters? primaryConstructor?
      typeConstraints? delegationSpecifiers? enumClassBody
    ;

objectDeclaration
    : OBJECT identifier? delegationSpecifiers? classBody?
    ;

companionObject
    : COMPANION OBJECT identifier? delegationSpecifiers? classBody?
    ;

primaryConstructor
    : visibilityModifier? CONSTRUCTOR? valueParameters
    ;

secondaryConstructor
    : visibilityModifier? CONSTRUCTOR valueParameters
      (COLON constructorInvocation (COMMA constructorInvocation)*)? block
    ;

constructorInvocation
    : (THIS | SUPER) valueArguments
    ;

classBody
    : LBRACE separators* (classMember separators*)* RBRACE
    ;

enumClassBody
    : LBRACE separators* enumEntries? (classMember separators*)* RBRACE
    ;

enumEntries
    : enumEntry (COMMA NEWLINE* enumEntry)* COMMA? NEWLINE* SEMI? NEWLINE*
    ;

enumEntry
    : identifier valueArguments? classBody?
    ;

classMember
    : SEMI
    | declarationModifier*
      (classDeclaration
      | enumClassDeclaration
      | objectDeclaration
      | companionObject
      | functionDeclaration
      | propertyDeclaration
      | secondaryConstructor
      | initializer
      | typeAliasDeclaration)
    ;

initializer
    : INIT block
    ;

delegationSpecifiers
    : COLON delegationSpecifier (COMMA delegationSpecifier)*
    ;

delegationSpecifier
    : typeReference (valueArguments | BY expression)?
    ;

functionDeclaration
    : FUN typeParameters? (functionReceiver DOT)? identifier valueParameters
      (COLON typeReference)? typeConstraints? functionBody?
    ;

functionReceiver
    : userType QUESTION?
    | LPAREN typeReference RPAREN
    ;

functionBody
    : block
    | ASSIGN NEWLINE* expression
    ;

propertyDeclaration
    : (VAL | VAR) identifier (COLON typeReference)?
      (ASSIGN expression)? (NEWLINE* propertyAccessor)*
    ;

propertyAccessor
    : declarationModifier* GET LPAREN RPAREN (COLON typeReference)? functionBody?
    | declarationModifier* SET LPAREN (identifier (COLON typeReference)?)? RPAREN functionBody?
    ;

typeAliasDeclaration
    : TYPEALIAS identifier typeParameters? ASSIGN typeReference
    ;

typeParameters
    : LT typeParameter (COMMA typeParameter)* COMMA? GT
    ;

typeParameter
    : (REIFIED | IN | OUT)* identifier (COLON typeReference)?
    ;

typeConstraints
    : WHERE typeConstraint (COMMA typeConstraint)*
    ;

typeConstraint
    : identifier COLON typeReference
    ;

valueParameters
    : LPAREN NEWLINE* (valueParameter (COMMA NEWLINE* valueParameter)* COMMA? NEWLINE*)? RPAREN
    ;

valueParameter
    : parameterModifier* (VAL | VAR)? identifier COLON typeReference
      (ASSIGN expression)?
    ;

parameterModifier
    : annotation
    | VARARG
    | NOINLINE
    | CROSSINLINE
    | OVERRIDE
    | visibilityModifier
    ;

typeReference
    : SUSPEND? functionType QUESTION?
    | userType QUESTION?
    | LPAREN typeReference RPAREN QUESTION?
    ;

functionType
    : (userType DOT)? LPAREN (typeReference (COMMA typeReference)*)? RPAREN
      ARROW typeReference
    ;

userType
    : simpleUserType (DOT simpleUserType)*
    ;

simpleUserType
    : identifier typeArguments?
    ;

typeArguments
    : LT typeProjection (COMMA typeProjection)* COMMA? GT
    ;

typeProjection
    : (IN | OUT)? typeReference
    | MUL
    ;

block
    : LBRACE separators* (statement separators*)* RBRACE
    ;

statement
    : declarationModifier*
      (propertyDeclaration
      | functionDeclaration
      | classDeclaration
      | objectDeclaration
      | typeAliasDeclaration)
      SEMI?
    | loopStatement
    | ifStatement
    | (annotation NEWLINE*)* expression SEMI?
    ;

ifStatement
    : IF LPAREN expression RPAREN NEWLINE* controlStructureBody (NEWLINE* ELSE NEWLINE* controlStructureBody)?
    ;

loopStatement
    : WHILE LPAREN expression RPAREN NEWLINE* controlStructureBody
    | DO NEWLINE* controlStructureBody NEWLINE* WHILE LPAREN expression RPAREN SEMI?
    | FOR LPAREN identifier IN expression RPAREN NEWLINE* controlStructureBody
    ;

controlStructureBody
    : block
    | statement
    ;

expression
    : assignmentExpression
    ;

assignmentExpression
    : elvisExpression (assignmentOperator assignmentExpression)?
    ;

assignmentOperator
    : ASSIGN
    | ADD_ASSIGN
    | SUB_ASSIGN
    | MUL_ASSIGN
    | DIV_ASSIGN
    | MOD_ASSIGN
    ;

elvisExpression
    : disjunctionExpression (ELVIS disjunctionExpression)*
    ;

disjunctionExpression
    : conjunctionExpression (OROR conjunctionExpression)*
    ;

conjunctionExpression
    : equalityExpression (ANDAND equalityExpression)*
    ;

equalityExpression
    : comparisonExpression ((EQEQ | EXCLEQ | EQEQEQ | EXCLEQEQ) comparisonExpression)*
    ;

comparisonExpression
    : infixExpression
      ((LT | LE | GT | GE | IN | NOT_IN | IS | NOT_IS) infixExpression)*
    ;

infixExpression
    : rangeExpression (identifier rangeExpression)*
    ;

rangeExpression
    : additiveExpression ((RANGE | RANGE_UNTIL) additiveExpression)*
    ;

additiveExpression
    : multiplicativeExpression ((ADD | SUB) multiplicativeExpression)*
    ;

multiplicativeExpression
    : castExpression ((MUL | DIV | MOD) castExpression)*
    ;

castExpression
    : prefixUnaryExpression ((AS | AS_SAFE) typeReference)*
    ;

prefixUnaryExpression
    : prefixUnaryOperator* postfixUnaryExpression
    ;

prefixUnaryOperator
    : ADD
    | SUB
    | EXCL
    | INCR
    | DECR
    ;

postfixUnaryExpression
    : primaryExpression postfixUnarySuffix*
    ;

postfixUnarySuffix
    : callSuffix
    | indexingSuffix
    | navigationSuffix
    | INCR
    | DECR
    | EXCLEXCL
    ;

callSuffix
    : typeArguments? valueArguments lambdaLiteral?
    | typeArguments? lambdaLiteral
    ;

valueArguments
    : LPAREN NEWLINE* (valueArgument (COMMA NEWLINE* valueArgument)* COMMA? NEWLINE*)? RPAREN
    ;

valueArgument
    : (identifier ASSIGN)? MUL? expression
    ;

indexingSuffix
    : LBRACK expressionList RBRACK
    ;

navigationSuffix
    : (DOT | SAFE_ACCESS) identifier typeArguments? valueArguments?
    ;

expressionList
    : expression (COMMA expression)*
    ;

primaryExpression
    : literalConstant
    | identifier
    | THIS (AT identifier)?
    | SUPER (LT typeReference GT)? (AT identifier)?
    | LPAREN expression RPAREN
    | ifExpression
    | whenExpression
    | tryExpression
    | lambdaLiteral
    | objectLiteral
    | callableReference
    | jumpExpression
    ;

ifExpression
    : IF LPAREN expression RPAREN NEWLINE* controlStructureBody (NEWLINE* ELSE NEWLINE* controlStructureBody)?
    ;

whenExpression
    : WHEN (LPAREN expression? RPAREN)? LBRACE separators* (whenEntry separators*)* RBRACE
    ;

whenEntry
    : (whenCondition (COMMA whenCondition)* | ELSE) ARROW controlStructureBody SEMI?
    ;

whenCondition
    : IN expression
    | NOT_IN expression
    | IS typeReference
    | NOT_IS typeReference
    | expression
    ;

tryExpression
    : TRY block NEWLINE* catchBlock* NEWLINE* finallyBlock?
    ;

catchBlock
    : CATCH LPAREN identifier COLON typeReference RPAREN block
    ;

finallyBlock
    : FINALLY block
    ;

objectLiteral
    : OBJECT delegationSpecifiers? classBody
    ;

lambdaLiteral
    : LBRACE separators* (lambdaParameters ARROW separators*)? (statement separators*)* RBRACE
    ;

lambdaParameters
    : lambdaParameter (COMMA lambdaParameter)* COMMA?
    ;

lambdaParameter
    : identifier (COLON typeReference)?
    ;

callableReference
    : (userType | THIS)? DOUBLE_COLON (identifier | CLASS)
    ;

jumpExpression
    : THROW expression
    | RETURN (AT identifier)? expression?
    | (BREAK | CONTINUE) (AT identifier)?
    ;

literalConstant
    : IntegerLiteral
    | RealLiteral
    | CharacterLiteral
    | StringLiteral
    | MultiLineStringLiteral
    | TRUE
    | FALSE
    | NULL
    ;

qualifiedIdentifier
    : identifier (DOT identifier)*
    ;

identifier
    : Identifier
    | BacktickIdentifier
    | softKeyword
    ;

softKeyword
    : DATA
    | ENUM
    | ANNOTATION
    | SEALED
    | INNER
    | VALUE
    | CONST
    | LATEINIT
    | OVERRIDE
    | ABSTRACT
    | FINAL
    | OPEN
    | EXTERNAL
    | INLINE
    | INFIX
    | OPERATOR
    | SUSPEND
    | TAILREC
    | EXPECT
    | ACTUAL
    | REIFIED
    | OUT
    | VARARG
    | NOINLINE
    | CROSSINLINE
    | BY
    | WHERE
    | COMPANION
    | GET
    | SET
    | INIT
    | CONSTRUCTOR
    ;

PACKAGE: 'package';
IMPORT: 'import';
CLASS: 'class';
INTERFACE: 'interface';
OBJECT: 'object';
COMPANION: 'companion';
FUN: 'fun';
VAL: 'val';
VAR: 'var';
TYPEALIAS: 'typealias';
CONSTRUCTOR: 'constructor';
INIT: 'init';
GET: 'get';
SET: 'set';
IF: 'if';
ELSE: 'else';
WHEN: 'when';
TRY: 'try';
CATCH: 'catch';
FINALLY: 'finally';
THROW: 'throw';
RETURN: 'return';
BREAK: 'break';
CONTINUE: 'continue';
WHILE: 'while';
DO: 'do';
FOR: 'for';
IN: 'in';
OUT: 'out';
IS: 'is';
AS: 'as';
THIS: 'this';
SUPER: 'super';
TRUE: 'true';
FALSE: 'false';
NULL: 'null';
PUBLIC: 'public';
PRIVATE: 'private';
INTERNAL: 'internal';
PROTECTED: 'protected';
DATA: 'data';
ENUM: 'enum';
ANNOTATION: 'annotation';
SEALED: 'sealed';
INNER: 'inner';
VALUE: 'value';
CONST: 'const';
LATEINIT: 'lateinit';
OVERRIDE: 'override';
ABSTRACT: 'abstract';
FINAL: 'final';
OPEN: 'open';
EXTERNAL: 'external';
INLINE: 'inline';
INFIX: 'infix';
OPERATOR: 'operator';
SUSPEND: 'suspend';
TAILREC: 'tailrec';
EXPECT: 'expect';
ACTUAL: 'actual';
REIFIED: 'reified';
VARARG: 'vararg';
NOINLINE: 'noinline';
CROSSINLINE: 'crossinline';
BY: 'by';
WHERE: 'where';

RANGE_UNTIL: '..<';
EXCLEQEQ: '!==';
EQEQEQ: '===';
SAFE_ACCESS: '?.';
ELVIS: '?:';
NOT_IN: '!in';
NOT_IS: '!is';
AS_SAFE: 'as?';
ADD_ASSIGN: '+=';
SUB_ASSIGN: '-=';
MUL_ASSIGN: '*=';
DIV_ASSIGN: '/=';
MOD_ASSIGN: '%=';
EQEQ: '==';
EXCLEQ: '!=';
LE: '<=';
GE: '>=';
ANDAND: '&&';
OROR: '||';
INCR: '++';
DECR: '--';
EXCLEXCL: '!!';
RANGE: '..';
DOUBLE_COLON: '::';
ARROW: '->';
ASSIGN: '=';
LT: '<';
GT: '>';
ADD: '+';
SUB: '-';
MUL: '*';
DIV: '/';
MOD: '%';
EXCL: '!';
QUESTION: '?';
AT: '@';
COLON: ':';
SEMI: ';';
COMMA: ',';
DOT: '.';
LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LBRACK: '[';
RBRACK: ']';

MultiLineStringLiteral
    : '"""' .*? '"""'
    ;

StringLiteral
    : '"' ('\\' . | StringInterpolation | ~["\\\r\n])* '"'
    ;

fragment StringInterpolation
    : '${' InterpolationContent '}'
    ;

fragment InterpolationContent
    : (StringLiteral | CharacterLiteral | BlockComment | LineComment
      | '{' InterpolationContent '}' | '\\' . | ~[{}"'\\])*
    ;

CharacterLiteral
    : '\'' ('\\' . | ~['\\\r\n]) '\''
    ;

RealLiteral
    : [0-9] [0-9_]* '.' [0-9_]+ ([eE] [+-]? [0-9] [0-9_]*)? [fF]?
    | [0-9] [0-9_]* [eE] [+-]? [0-9] [0-9_]* [fF]?
    | [0-9] [0-9_]* [fF]
    ;

IntegerLiteral
    : '0' [xX] [0-9a-fA-F] [0-9a-fA-F_]*
    | '0' [bB] [01] [01_]*
    | [0-9] [0-9_]* [uU]? [lL]?
    ;

BacktickIdentifier
    : '`' ~[`\r\n]+ '`'
    ;

Identifier
    : [a-zA-Z_] [a-zA-Z_0-9]*
    ;

LineComment
    : '//' ~[\r\n]* -> skip
    ;

BlockComment
    : '/*' .*? '*/' -> skip
    ;

Whitespace
    : [ \t\f]+ -> skip
    ;

NEWLINE
    : '\r'? '\n'
    | '\r'
    ;
