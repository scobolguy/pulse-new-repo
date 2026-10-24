// FORTRAN 77 (ANSI X3.9-1978) grammar for the MNF compiler.
//
// The fixed-form reader (src/fixed-form.mjs) applies the column rules of section 3
// and hands this grammar one logical statement per line: an optional statement
// label followed by the statement text and a newline. Keywords must be separated
// from adjacent names by blanks (the single-word forms GOTO, ELSEIF, ENDIF,
// BLOCKDATA and DOUBLEPRECISION are also accepted).
grammar Fortran77;

options { caseInsensitive = true; }

@lexer::members {
  this.dottedOperatorFollows = () => {
    let text = '';
    for (let i = 1; i <= 6; i += 1) {
      const c = this._input.LA(i);
      if (c === 46) return /^(EQ|NE|LT|LE|GT|GE|AND|OR|NOT|EQV|NEQV|TRUE|FALSE)$/i.test(text);
      if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
      text += String.fromCharCode(c);
    }
    return false;
  };
}

// ---------------------------------------------------------------- program units (sections 2.4, 14-16)

executableProgram : EOL* programUnit+ EOF ;

programUnit
  : functionSubprogram
  | subroutineSubprogram
  | blockDataSubprogram
  | mainProgram
  ;

mainProgram : (PROGRAM name EOL)? body endLine ;
functionSubprogram : typeSpec? FUNCTION name LPAREN dummyArgList? RPAREN EOL body endLine ;
subroutineSubprogram : SUBROUTINE name (LPAREN dummyArgList? RPAREN)? EOL body endLine ;
blockDataSubprogram : (BLOCK DATA | BLOCKDATA) name? EOL body endLine ;
endLine : label? END EOL ;

dummyArgList : dummyArg (COMMA dummyArg)* ;
dummyArg : name | STAR ;

body : (statementLine | ifConstruct)* ;

// ---------------------------------------------------------------- block IF (section 11.6-11.9)

ifConstruct : ifThenLine body elseIfPart* elsePart? endIfLine ;
ifThenLine : label? IF LPAREN expression RPAREN THEN EOL ;
elseIfPart : label? (ELSEIF | ELSE IF) LPAREN expression RPAREN THEN EOL body ;
elsePart : label? ELSE EOL body ;
endIfLine : label? (ENDIF | END IF) EOL ;

statementLine : label? statement EOL ;
label : ICON ;

statement
  : typeStatement
  | implicitStatement
  | parameterStatement
  | dimensionStatement
  | commonStatement
  | equivalenceStatement
  | externalStatement
  | intrinsicStatement
  | saveStatement
  | dataStatement
  | formatStatement
  | entryStatement
  | actionStatement
  ;

actionStatement
  : assignmentStatement
  | assignStatement
  | gotoStatement
  | computedGotoStatement
  | assignedGotoStatement
  | arithmeticIfStatement
  | logicalIfStatement
  | doStatement
  | continueStatement
  | stopStatement
  | pauseStatement
  | callStatement
  | returnStatement
  | printStatement
  | writeStatement
  | readStatement
  | auxiliaryIoStatement
  ;

// ---------------------------------------------------------------- specification statements (section 8)

typeStatement : typeSpec COMMA? entityDecl (COMMA entityDecl)* ;
typeSpec
  : INTEGER (STAR ICON)?
  | REAL (STAR ICON)?
  | DOUBLE PRECISION
  | DOUBLEPRECISION
  | LOGICAL (STAR ICON)?
  | COMPLEX (STAR ICON)?
  | CHARACTER lengthSpec?
  ;
lengthSpec : STAR (ICON | LPAREN (STAR | expression) RPAREN) ;
entityDecl : name (LPAREN arrayDims RPAREN)? lengthSpec? ;
arrayDims : dimDecl (COMMA dimDecl)* ;
dimDecl : (expression COLON)? (expression | STAR) ;

implicitStatement : IMPLICIT (NONE | implicitSpec (COMMA implicitSpec)*) ;
implicitSpec : typeSpec LPAREN letterRange (COMMA letterRange)* RPAREN ;
letterRange : name (MINUS name)? ;

parameterStatement : PARAMETER LPAREN namedConstantDef (COMMA namedConstantDef)* RPAREN ;
namedConstantDef : name EQUALS expression ;

dimensionStatement : DIMENSION arrayDeclarator (COMMA arrayDeclarator)* ;
arrayDeclarator : name LPAREN arrayDims RPAREN ;

commonStatement : COMMON commonBlockName? commonList (COMMA? commonBlockName commonList)* ;
commonBlockName : SLASH name? SLASH | CONCAT ;
commonList : commonItem (COMMA commonItem)* ;
commonItem : name (LPAREN arrayDims RPAREN)? ;

equivalenceStatement : EQUIVALENCE equivalenceSet (COMMA equivalenceSet)* ;
equivalenceSet : LPAREN designator (COMMA designator)+ RPAREN ;

externalStatement : EXTERNAL name (COMMA name)* ;
intrinsicStatement : INTRINSIC name (COMMA name)* ;
saveStatement : SAVE (saveItem (COMMA saveItem)*)? ;
saveItem : name | SLASH name SLASH ;

// ---------------------------------------------------------------- DATA (section 9)

dataStatement : DATA dataSet (COMMA? dataSet)* ;
dataSet : dataObject (COMMA dataObject)* SLASH dataValue (COMMA dataValue)* SLASH ;
dataObject : designator | dataImpliedDo ;
dataImpliedDo : LPAREN dataObject (COMMA dataObject)* COMMA name EQUALS expression COMMA expression (COMMA expression)? RPAREN ;
dataValue : (dataRepeat STAR)? dataConstant ;
dataRepeat : ICON | name ;
dataConstant
  : (PLUS | MINUS)? (ICON | RCON | DCON | name)
  | LPAREN complexPart COMMA complexPart RPAREN
  | SCON
  | TRUE
  | FALSE
  ;

complexPart : (PLUS | MINUS)? (ICON | RCON | name) ;

formatStatement : FORMAT_STMT ;
entryStatement : ENTRY name (LPAREN dummyArgList? RPAREN)? ;

// ---------------------------------------------------------------- executable statements (sections 10-15)

assignmentStatement : designator EQUALS expression ;
assignStatement : ASSIGN labelRef TO name ;
gotoStatement : goKeyword labelRef ;
computedGotoStatement : goKeyword LPAREN labelRef (COMMA labelRef)* RPAREN COMMA? expression ;
assignedGotoStatement : goKeyword name (COMMA? LPAREN labelRef (COMMA labelRef)* RPAREN)? ;
goKeyword : GO TO | GOTO ;
labelRef : ICON ;
arithmeticIfStatement : IF LPAREN expression RPAREN labelRef COMMA labelRef COMMA labelRef ;
logicalIfStatement : IF LPAREN expression RPAREN actionStatement ;
doStatement : DO labelRef COMMA? name EQUALS expression COMMA expression (COMMA expression)? ;
continueStatement : CONTINUE ;
stopStatement : STOP stopCode? ;
pauseStatement : PAUSE stopCode? ;
stopCode : ICON | SCON ;
callStatement : CALL name (LPAREN (actualArg (COMMA actualArg)*)? RPAREN)? ;
actualArg : expression | STAR labelRef ;
returnStatement : RETURN expression? ;

// ---------------------------------------------------------------- input/output (section 12)

printStatement
  : PRINT formatIdentifier (COMMA ioList)?
  | PRINT COMMA ioList
  ;
formatIdentifier : STAR | expression ;
writeStatement : WRITE LPAREN controlInfo RPAREN ioList? ;
readStatement
  : READ LPAREN controlInfo RPAREN ioList?
  | READ formatIdentifier (COMMA ioList)?
  ;
controlInfo : controlItem (COMMA controlItem)* ;
controlItem
  : (name | END) EQUALS (expression | STAR)
  | expression
  | STAR
  ;
auxiliaryIoStatement
  : (OPEN | CLOSE | INQUIRE) LPAREN controlInfo RPAREN
  | (BACKSPACE | ENDFILE | REWIND) (LPAREN controlInfo RPAREN | expression)
  ;
ioList : ioItem (COMMA ioItem)* ;
ioItem : expression | ioImpliedDo ;
ioImpliedDo : LPAREN ioList COMMA name EQUALS expression COMMA expression (COMMA expression)? RPAREN ;

// ---------------------------------------------------------------- expressions (section 6)

designator : name (LPAREN sectionList? RPAREN)? (LPAREN substringRange RPAREN)? ;
sectionList : section (COMMA section)* ;
section : expression? COLON expression? | expression ;
substringRange : expression? COLON expression? ;

expression : equivOperand ((EQV | NEQV) equivOperand)* ;
equivOperand : orOperand (OR orOperand)* ;
orOperand : andOperand (AND andOperand)* ;
andOperand : NOT andOperand | relationalExpr ;
relationalExpr : concatExpr (relOp concatExpr)? ;
relOp : EQ | NE | LT | LE | GT | GE ;
concatExpr : arithExpr (CONCAT arithExpr)* ;
arithExpr : (PLUS | MINUS)? term ((PLUS | MINUS) term)* ;
term : factor ((STAR | SLASH) factor)* ;
factor : primary (POWER factor)? ;
primary
  : constant
  | designator
  | LPAREN expression COMMA expression RPAREN  // complex constant (4.4.4)
  | LPAREN expression RPAREN
  ;
constant : ICON | RCON | DCON | SCON | TRUE | FALSE ;

name
  : NAME | PROGRAM | FUNCTION | SUBROUTINE | BLOCK | DATA | BLOCKDATA
  | INTEGER | REAL | DOUBLE | PRECISION | DOUBLEPRECISION | LOGICAL | CHARACTER | COMPLEX
  | IMPLICIT | NONE | PARAMETER | DIMENSION | COMMON | EQUIVALENCE | EXTERNAL | INTRINSIC
  | SAVE | ENTRY | ASSIGN | TO | GO | GOTO | DO | CONTINUE | STOP | PAUSE | CALL | RETURN
  | PRINT | WRITE | READ | OPEN | CLOSE | INQUIRE | BACKSPACE | ENDFILE | REWIND
  ;

// ---------------------------------------------------------------- lexer

FORMAT_STMT : 'FORMAT' ' '* '(' ~[\n]* ;

PROGRAM : 'PROGRAM' ;
FUNCTION : 'FUNCTION' ;
SUBROUTINE : 'SUBROUTINE' ;
BLOCKDATA : 'BLOCKDATA' ;
BLOCK : 'BLOCK' ;
DATA : 'DATA' ;
ENDIF : 'ENDIF' ;
ENDFILE : 'ENDFILE' ;
END : 'END' ;
ELSEIF : 'ELSEIF' ;
ELSE : 'ELSE' ;
IF : 'IF' ;
THEN : 'THEN' ;
INTEGER : 'INTEGER' ;
REAL : 'REAL' ;
DOUBLEPRECISION : 'DOUBLEPRECISION' ;
DOUBLE : 'DOUBLE' ;
PRECISION : 'PRECISION' ;
LOGICAL : 'LOGICAL' ;
CHARACTER : 'CHARACTER' ;
COMPLEX : 'COMPLEX' ;
IMPLICIT : 'IMPLICIT' ;
NONE : 'NONE' ;
PARAMETER : 'PARAMETER' ;
DIMENSION : 'DIMENSION' ;
COMMON : 'COMMON' ;
EQUIVALENCE : 'EQUIVALENCE' ;
EXTERNAL : 'EXTERNAL' ;
INTRINSIC : 'INTRINSIC' ;
SAVE : 'SAVE' ;
ENTRY : 'ENTRY' ;
ASSIGN : 'ASSIGN' ;
TO : 'TO' ;
GOTO : 'GOTO' ;
GO : 'GO' ;
DO : 'DO' ;
CONTINUE : 'CONTINUE' ;
STOP : 'STOP' ;
PAUSE : 'PAUSE' ;
CALL : 'CALL' ;
RETURN : 'RETURN' ;
PRINT : 'PRINT' ;
WRITE : 'WRITE' ;
READ : 'READ' ;
OPEN : 'OPEN' ;
CLOSE : 'CLOSE' ;
INQUIRE : 'INQUIRE' ;
BACKSPACE : 'BACKSPACE' ;
REWIND : 'REWIND' ;

EQ : '.EQ.' ;
NE : '.NE.' ;
LT : '.LT.' ;
LE : '.LE.' ;
GT : '.GT.' ;
GE : '.GE.' ;
NOT : '.NOT.' ;
AND : '.AND.' ;
OR : '.OR.' ;
EQV : '.EQV.' ;
NEQV : '.NEQV.' ;
TRUE : '.TRUE.' ;
FALSE : '.FALSE.' ;

DCON
  : DIGITS '.' {!this.dottedOperatorFollows()}? DIGITS? DEXPONENT
  | '.' DIGITS DEXPONENT
  | DIGITS DEXPONENT
  ;
RCON
  : DIGITS '.' {!this.dottedOperatorFollows()}? DIGITS? EXPONENT?
  | '.' DIGITS EXPONENT?
  | DIGITS EXPONENT
  ;
ICON : DIGITS ;
SCON : '\'' (~['\n] | '\'\'')* '\'' ;
UNTERMINATED_SCON : '\'' (~['\n] | '\'\'')* ;
NAME : [A-Z] [A-Z0-9]* ;

POWER : '**' ;
CONCAT : '//' ;
LPAREN : '(' ;
RPAREN : ')' ;
COMMA : ',' ;
EQUALS : '=' ;
COLON : ':' ;
PLUS : '+' ;
MINUS : '-' ;
STAR : '*' ;
SLASH : '/' ;
EOL : '\n' ;
WS : [ \r]+ -> skip ;

fragment DIGITS : [0-9]+ ;
fragment EXPONENT : 'E' [+-]? DIGITS ;
fragment DEXPONENT : 'D' [+-]? DIGITS ;
