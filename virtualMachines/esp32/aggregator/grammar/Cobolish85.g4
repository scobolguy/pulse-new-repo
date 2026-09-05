grammar Cobolish85;

options { caseInsensitive = true; }

compilationUnit
  : programUnit EOF
  ;

programUnit
  : identificationDivision cobolishRuntimeClause? environmentDivision? dataDivision? procedureDivision cobolishMetaClause* endProgramClause?
  ;

identificationDivision
  : IDENTIFICATION DIVISION DOT programIdClause? cobolishMetaClause* 
  ;

programIdClause
  : PROGRAM_ID DOT programName DOT?
  ;

programName
  : IDENTIFIER
  | STRING_LITERAL
  ;

environmentDivision
  : ENVIRONMENT DIVISION DOT configurationSection? inputOutputSection?
  ;

configurationSection
  : CONFIGURATION SECTION DOT configClause*
  ;

configClause
  : SOURCE_COMPUTER DOT? IDENTIFIER
  | OBJECT_COMPUTER DOT? IDENTIFIER
  | SPECIAL_NAMES DOT? cobolishNameClause+
  ;

cobolishNameClause
  : IDENTIFIER IS? IDENTIFIER
  ;

inputOutputSection
  : INPUT_OUTPUT SECTION DOT fileControlClause*
  ;

fileControlClause
  : SELECT IDENTIFIER ASSIGN TO fileSource fileOrgClause? accessModeClause? recordKeyClause? fileStatusClause?
  ;

fileSource
  : IDENTIFIER
  | STRING_LITERAL
  ;

fileOrgClause
  : ORGANIZATION IS? (SEQUENTIAL | RELATIVE | INDEXED)
  ;

accessModeClause
  : ACCESS MODE IS? (SEQUENTIAL | DYNAMIC | RANDOM)
  ;

recordKeyClause
  : RECORD KEY IS? IDENTIFIER
  ;

fileStatusClause
  : FILE_STATUS IS? IDENTIFIER
  ;

dataDivision
  : DATA DIVISION DOT fileSection? workingStorageSection? linkageSection? localStorageSection? reportSection? screenSection?
  ;

fileSection
  : FILE SECTION DOT fileDescriptionEntry*
  ;

workingStorageSection
  : WORKING_STORAGE SECTION DOT dataDescriptionEntry*
  ;

linkageSection
  : LINKAGE SECTION DOT dataDescriptionEntry*
  ;

localStorageSection
  : LOCAL_STORAGE SECTION DOT dataDescriptionEntry*
  ;

reportSection
  : REPORT SECTION DOT reportDescriptionEntry*
  ;

screenSection
  : SCREEN SECTION DOT screenDescriptionEntry*
  ;

fileDescriptionEntry
  : fileLevelNumber IDENTIFIER fileDescClause* DOT?
  ;

reportDescriptionEntry
  : fileLevelNumber IDENTIFIER reportClause* DOT?
  ;

screenDescriptionEntry
  : fileLevelNumber IDENTIFIER screenClause* DOT?
  ;

dataDescriptionEntry
  : fileLevelNumber IDENTIFIER dataClause* DOT?
  ;

fileLevelNumber
  : LEVEL_NUMBER
  | LEVEL_77
  ;

dataClause
  : PIC pictureClause
  | PICTURE pictureClause
  | VALUE literal
  | OCCURS cobolNumber (TO cobolNumber)? TIMES? DEPENDING ON? IDENTIFIER?
  | REDEFINES IDENTIFIER
  | RENAMES IDENTIFIER (THROUGH | THRU) IDENTIFIER
  | USAGE IS? usageClause
  | SYNCHRONIZED
  | JUSTIFIED RIGHT?
  | BLANK WHEN ZERO
  | SIGN IS? (LEADING | TRAILING) SEPARATE CHARACTER?
  | INDEXED BY identifierList
  | BINARY
  | COMP
  | COMP_1
  | COMP_2
  | COMP_3
  | COMP_4
  | COMP_5
  ;

fileDescClause
  : RECORD CONTAINS cobolNumber CHARACTERS?
  | LABEL RECORD IS? (STANDARD | OMITTED)
  | DATA RECORD IS? identifierList
  | BLOCK CONTAINS cobolNumber RECORDS?
  | FILE_STATUS IS? IDENTIFIER
  ;

reportClause
  : HEADING
  | FOOTING
  | CONTROL IDENTIFIER
  ;

screenClause
  : VALUE literal
  | PIC pictureClause
  | USING IDENTIFIER
  | LINE cobolNumber?
  | COLUMN cobolNumber?
  ;

pictureClause
  : pictureAtom (LPAREN cobolNumber RPAREN)?
  ;

pictureAtom
  : IDENTIFIER
  | cobolNumber
  ;

cobolNumber
  : NUMBER
  | LEVEL_NUMBER
  | LEVEL_77
  ;

usageClause
  : DISPLAY
  | INDEX
  | COMP_1
  | COMP_2
  | COMP_3
  | COMP_4
  | COMP_5
  | PACKED_DECIMAL
  ;

procedureDivision
  : PROCEDURE DIVISION procedureUsingClause? procedureGivingClause? DOT? (paragraph | sentence)*
  ;

procedureUsingClause
  : USING procedureParameterList
  ;

procedureGivingClause
  : GIVING IDENTIFIER
  ;

procedureParameterList
  : procedureParameter (COMMA procedureParameter)*
  ;

procedureParameter
  : IDENTIFIER
  | STRING_LITERAL
  ;

paragraph
  : paragraphName DOT sentence*
  ;

paragraphName
  : IDENTIFIER
  | SECTION
  | IDENTIFIER IDENTIFIER
  ;

sentence
  : statement DOT?
  ;

statement
  : moveStatement
  | setStatement
  | performStatement
  | callStatement
  | ifStatement
  | evaluateStatement
  | displayStatement
  | acceptStatement
  | openStatement
  | closeStatement
  | readStatement
  | writeStatement
  | startStatement
  | deleteStatement
  | computeStatement
  | addStatement
  | subtractStatement
  | multiplyStatement
  | divideStatement
  | stringStatement
  | gobackStatement
  | stopRunStatement
  | interopStatement
  | copyStatement
  | execStatement
  | continueStatement
  ;

moveStatement
  : MOVE moveSource TO identifierList
  ;

moveSource
  : literal
  | IDENTIFIER
  | identifierList
  ;

setStatement
  : SET IDENTIFIER TO (TRUE | FALSE | NUMBER | IDENTIFIER)
  ;

performStatement
  : PERFORM performTarget performClause*
  ;

performTarget
  : paragraphName
  | inlinePerform
  ;

inlinePerform
  : UNTIL condition sentence* END_PERFORM
  ;

performClause
  : UNTIL condition
  | VARYING IDENTIFIER FROM? literal BY literal
  | THRU paragraphName
  | THROUGH paragraphName
  ;

callStatement
  : CALL callTarget callUsingClause? callGivingClause? callOnExceptionClause? END_CALL?
  ;

callTarget
  : IDENTIFIER
  | STRING_LITERAL
  ;

callUsingClause
  : USING callUsingItem+
  ;

callUsingItem
  : (BY callPassingMode)? callParameter
  ;

callPassingMode
  : REFERENCE
  | CONTENT
  | VALUE
  ;

callGivingClause
  : (GIVING | RETURNING) IDENTIFIER
  ;

callOnExceptionClause
  : ON EXCEPTION sentence*
  ;

callParameter
  : IDENTIFIER
  | literal
  ;

ifStatement
  : IF condition THEN sentence* elseClause? END_IF?
  ;

elseClause
  : ELSE sentence*
  ;

evaluateStatement
  : EVALUATE evaluateSubject (ALSO evaluateSubject)* whenClause+ endEvaluateClause?
  ;

evaluateSubject
  : expression
  | condition
  ;

whenClause
  : WHEN whenCondition (ALSO whenCondition)* sentence*
  | WHEN OTHER sentence*
  ;

whenCondition
  : expression comparator expression
  | booleanLiteral
  | literal
  | IDENTIFIER
  | ANY
  ;

endEvaluateClause
  : END_EVALUATE
  ;

displayStatement
  : DISPLAY displayItem+
  ;

acceptStatement
  : ACCEPT identifierList
  ;

openStatement
  : OPEN openMode? identifierList
  ;

openMode
  : INPUT
  | OUTPUT
  | I_O
  | EXTEND
  ;

closeStatement
  : CLOSE identifierList
  ;

readStatement
  : READ IDENTIFIER readClause*
  ;

readClause
  : INTO IDENTIFIER
  | AT END sentence*
  | NOT AT END sentence*
  ;

writeStatement
  : WRITE IDENTIFIER writeClause*
  ;

writeClause
  : FROM IDENTIFIER
  | AFTER ADVANCING (cobolNumber LINES? | PAGE)
  ;

startStatement
  : START IDENTIFIER startClause*
  ;

startClause
  : KEY? condition
  ;

deleteStatement
  : DELETE IDENTIFIER
  ;

computeStatement
  : COMPUTE IDENTIFIER ASSIGN expression
  ;

addStatement
  : ADD expression TO identifierList
  ;

subtractStatement
  : SUBTRACT expression FROM identifierList
  ;

multiplyStatement
  : MULTIPLY expression BY identifierList
  ;

divideStatement
  : DIVIDE expression BY identifierList
  ;

stringStatement
  : STRING stringItem+ DELIMITED? BY? identifierList
  ;

stringItem
  : IDENTIFIER
  | literal
  ;

gobackStatement
  : GOBACK
  ;

stopRunStatement
  : STOP RUN
  ;

interopStatement
  : INTEROP interopKind stringLiteral (AS IDENTIFIER)?
  ;

interopKind
  : WFL
  | PASCALISH
  | COBOLISH
  ;

copyStatement
  : COPY IDENTIFIER copyClause*
  ;

copyClause
  : REPLACING literal BY literal
  ;

execStatement
  : EXEC IDENTIFIER* END_EXEC
  ;

continueStatement
  : CONTINUE
  ;

condition
  : relation
  | NOT condition
  | condition AND condition
  | condition OR condition
  | LPAREN condition RPAREN
  ;

relation
  : expression comparator expression
  | expression
  ;

comparator
  : EQ
  | NEQ
  | LT
  | LE
  | GT
  | GE
  | NOT_EQ
  ;

expression
  : term ((PLUS | MINUS | OR) term)*
  ;

term
  : factor ((MUL | DIV | AND) factor)*
  ;

factor
  : literal
  | IDENTIFIER
  | LPAREN expression RPAREN
  | functionCall
  ;

functionCall
  : IDENTIFIER LPAREN argumentList? RPAREN
  ;

argumentList
  : expression (COMMA expression)*
  ;

identifierList
  : IDENTIFIER (COMMA IDENTIFIER)*
  ;

displayItem
  : literal
  | IDENTIFIER
  ;

literal
  : stringLiteral
  | numericLiteral
  | booleanLiteral
  | SPACE
  | SPACES
  | ZERO
  | ZEROS
  | QUOTES
  ;

stringLiteral
  : STRING_LITERAL
  ;

numericLiteral
  : NUMBER
  | signedNumber
  ;

signedNumber
  : PLUS? NUMBER
  | MINUS NUMBER
  ;

booleanLiteral
  : TRUE
  | FALSE
  ;

cobolishMetaClause
  : INTEROP interopKind stringLiteral (AS IDENTIFIER)?
  | LIBRARY stringLiteral FROM librarySource
  | USE stringLiteral (AS IDENTIFIER)?
  ;

// Pulse extensions preserve COBOL-85 divisions while declaring a deployable
// PMachine unit. They are deliberately explicit, never inferred from comments.
cobolishRuntimeClause
  : PULSE (SERVICE | DAEMON | PROGRAM) programName (ON runtimePlacement)? (EVERY NUMBER runtimeIntervalUnit)? DOT?
  ;

runtimePlacement
  : LOCAL
  | PARENT
  | CHILD
  | SIBLING
  | ALTERNATE
  ;

runtimeIntervalUnit
  : MS
  | S
  | M
  | SECOND
  | SECONDS
  ;

endProgramClause
  : END_PROGRAM programName? DOT?
  ;

librarySource
  : LIBRARIAN
  | IDENTIFIER
  | stringLiteral
  ;

END_PROGRAM: 'END PROGRAM';
END_CALL: 'END-CALL';
END_IF: 'END-IF';
END_EVALUATE: 'END-EVALUATE';
END_PERFORM: 'END-PERFORM';
END_EXEC: 'END-EXEC';
END: 'END';
AT: 'AT';
BY: 'BY';
DELIMITED: 'DELIMITED';
INTO: 'INTO';
INPUT: 'INPUT';
OUTPUT: 'OUTPUT';
AFTER: 'AFTER';
ADVANCING: 'ADVANCING';
ALSO: 'ALSO';
ANY: 'ANY';
PROGRAM_ID: 'PROGRAM-ID';
IDENTIFICATION: 'IDENTIFICATION';
ENVIRONMENT: 'ENVIRONMENT';
CONFIGURATION: 'CONFIGURATION';
INPUT_OUTPUT: 'INPUT-OUTPUT';
DATA: 'DATA';
PROCEDURE: 'PROCEDURE';
DIVISION: 'DIVISION';
SECTION: 'SECTION';
WORKING_STORAGE: 'WORKING-STORAGE';
FILE: 'FILE';
LINKAGE: 'LINKAGE';
LOCAL_STORAGE: 'LOCAL-STORAGE';
REPORT: 'REPORT';
SCREEN: 'SCREEN';
SPECIAL_NAMES: 'SPECIAL-NAMES';
SOURCE_COMPUTER: 'SOURCE-COMPUTER';
OBJECT_COMPUTER: 'OBJECT-COMPUTER';
LIBRARIAN: 'LIBRARIAN';
PULSE: 'PULSE';
SERVICE: 'SERVICE';
DAEMON: 'DAEMON';
PROGRAM: 'PROGRAM';
EVERY: 'EVERY';
LOCAL: 'LOCAL';
PARENT: 'PARENT';
CHILD: 'CHILD';
SIBLING: 'SIBLING';
ALTERNATE: 'ALTERNATE';
MS: 'MS';
S: 'S';
M: 'M';
SELECT: 'SELECT';
ASSIGN: 'ASSIGN';
TO: 'TO';
ORGANIZATION: 'ORGANIZATION';
ACCESS: 'ACCESS';
MODE: 'MODE';
SEQUENTIAL: 'SEQUENTIAL';
RELATIVE: 'RELATIVE';
DYNAMIC: 'DYNAMIC';
RANDOM: 'RANDOM';
RECORD: 'RECORD';
KEY: 'KEY';
FILE_STATUS: 'FILE-STATUS';
BLOCK: 'BLOCK';
CONTAINS: 'CONTAINS';
CHARACTERS: 'CHARACTERS';
RECORDS: 'RECORDS';
LABEL: 'LABEL';
OMITTED: 'OMITTED';
STANDARD: 'STANDARD';
PIC: 'PIC';
PICTURE: 'PICTURE';
VALUE: 'VALUE';
OCCURS: 'OCCURS';
TIMES: 'TIMES';
DEPENDING: 'DEPENDING';
ON: 'ON';
REDEFINES: 'REDEFINES';
RENAMES: 'RENAMES';
THROUGH: 'THROUGH';
THRU: 'THRU';
USAGE: 'USAGE';
IS: 'IS';
SYNCHRONIZED: 'SYNCHRONIZED';
JUSTIFIED: 'JUSTIFIED';
RIGHT: 'RIGHT';
BLANK: 'BLANK';
WHEN: 'WHEN';
ZERO: 'ZERO';
ZEROS: 'ZEROS';
SIGN: 'SIGN';
LEADING: 'LEADING';
TRAILING: 'TRAILING';
SEPARATE: 'SEPARATE';
CHARACTER: 'CHARACTER';
INDEXED: 'INDEXED';
BINARY: 'BINARY';
COMP: 'COMP';
COMP_1: 'COMP-1';
COMP_2: 'COMP-2';
COMP_3: 'COMP-3';
COMP_4: 'COMP-4';
COMP_5: 'COMP-5';
DISPLAY: 'DISPLAY';
INDEX: 'INDEX';
PACKED_DECIMAL: 'PACKED-DECIMAL';
FROM: 'FROM';
GIVING: 'GIVING';
PERFORM: 'PERFORM';
VARYING: 'VARYING';
UNTIL: 'UNTIL';
CALL: 'CALL';
IF: 'IF';
THEN: 'THEN';
ELSE: 'ELSE';
EVALUATE: 'EVALUATE';
OTHER: 'OTHER';
MOVE: 'MOVE';
SET: 'SET';
OPEN: 'OPEN';
CLOSE: 'CLOSE';
READ: 'READ';
WRITE: 'WRITE';
ACCEPT: 'ACCEPT';
START: 'START';
DELETE: 'DELETE';
COMPUTE: 'COMPUTE';
ADD: 'ADD';
SUBTRACT: 'SUBTRACT';
MULTIPLY: 'MULTIPLY';
DIVIDE: 'DIVIDE';
STRING: 'STRING';
GOBACK: 'GOBACK';
STOP: 'STOP';
RUN: 'RUN';
INTEROP: 'INTEROP';
WFL: 'WFL';
PASCALISH: 'PASCALISH';
COBOLISH: 'COBOLISH';
LIBRARY: 'LIBRARY';
USE: 'USE';
AS: 'AS';
REPLACING: 'REPLACING';
COPY: 'COPY';
EXEC: 'EXEC';
CONTINUE: 'CONTINUE';
USING: 'USING';
REFERENCE: 'REFERENCE';
CONTENT: 'CONTENT';
RETURNING: 'RETURNING';
EXCEPTION: 'EXCEPTION';
AND: 'AND';
OR: 'OR';
I_O: 'I-O';
EXTEND: 'EXTEND';
LINES: 'LINES';
LINE: 'LINE';
COLUMN: 'COLUMN';
PAGE: 'PAGE';
HEADING: 'HEADING';
FOOTING: 'FOOTING';
CONTROL: 'CONTROL';
TRUE: 'TRUE';
FALSE: 'FALSE';
SPACE: 'SPACE';
SPACES: 'SPACES';
QUOTES: 'QUOTES';
NOT: 'NOT';
SECOND: 'SECOND';
SECONDS: 'SECONDS';
LEVEL_77: '77';
LEVEL_NUMBER: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10'
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'
  | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '30'
  | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38' | '39' | '40'
  | '41' | '42' | '43' | '44' | '45' | '46' | '47' | '48' | '49' | '50'
  | '51' | '52' | '53' | '54' | '55' | '56' | '57' | '58' | '59' | '60'
  | '61' | '62' | '63' | '64' | '65' | '66' | '67' | '68' | '69' | '70'
  | '71' | '72' | '73' | '74' | '75' | '76' | '78' | '79' | '80'
  | '81' | '82' | '83' | '84' | '85' | '86' | '87' | '88';

DOT: '.';
COMMA: ',';
LPAREN: '(';
RPAREN: ')';
PLUS: '+';
MINUS: '-';
MUL: '*';
DIV: '/';
EQ: '=';
LT: '<';
GT: '>';
LE: '<=';
GE: '>=';
NEQ: '<>';
NOT_EQ: '!=';
NUMBER: [0-9]+ ('.' [0-9]+)?;
STRING_LITERAL: '"' ( ~['"\\\r\n] | '\\' . )* '"'
  | '\'' ( ~['"\\\r\n] | '\\' . )* '\''
  ;
IDENTIFIER: [A-Z][A-Z0-9_-]*;
WS: [ \t\r\n]+ -> skip;
COMMENT: '*>'.*? '\n' -> skip;
LINE_COMMENT: '*' ~[\r\n]* -> skip;
