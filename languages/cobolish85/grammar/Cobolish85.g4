grammar Cobolish85;

options { caseInsensitive = true; }

compilationUnit
  : programUnit additionalProgram* EOF
  ;

// A sequence of separately compiled programs in one source (manual ch. 2).
additionalProgram
  : programUnit
  ;

programUnit
  : identificationDivision cobolishRuntimeClause? preProcedureContent* procedureDivision cobolishMetaClause* nestedProgram* endProgramClause?
  ;

nestedProgram
  : programUnit
  ;

preProcedureContent
  : cobolishMetaClause
  | environmentDivision
  | dataDivision
  ;

identificationDivision
  : IDENTIFICATION DIVISION DOT programIdClause? (dateCompiledEntry | cobolishMetaClause)*
  ;

programIdClause
  : PROGRAM_ID DOT programName programAttributes? DOT?
  ;

dateCompiledEntry
  : DATE_COMPILED DOT?
  ;

programAttributes
  : IS? (COMMON INITIAL? | INITIAL COMMON?) PROGRAM?
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
  : SOURCE_COMPUTER DOT IDENTIFIER (WITH DEBUGGING MODE)? DOT
  | OBJECT_COMPUTER DOT IDENTIFIER objectComputerClause* DOT
  | SPECIAL_NAMES DOT? specialNamesEntry+ DOT?
  ;

objectComputerClause
  : SEGMENT_LIMIT IS? segmentLimitNumber
  | collatingSequenceClause
  ;

collatingSequenceClause
  : PROGRAM? COLLATING? SEQUENCE IS? IDENTIFIER
  ;

segmentLimitNumber
  : cobolNumber
  ;

specialNamesEntry
  : cobolishNameClause
  | switchNameClause
  | alphabetClause
  | classClause
  | symbolicClause
  | currencyClause
  | decimalPointClause
  ;

cobolishNameClause
  : IDENTIFIER IS? IDENTIFIER
  ;

switchNameClause
  : IDENTIFIER (IS? IDENTIFIER)? switchStatusPhrase+
  ;

switchStatusPhrase
  : (ON | OFF) STATUS? IS? IDENTIFIER
  ;

alphabetClause
  : ALPHABET IDENTIFIER IS? (IDENTIFIER | alphabetEntry+)
  ;

alphabetEntry
  : literal ((THROUGH | THRU) literal | (ALSO literal)+)?
  ;

classClause
  : CLASS IDENTIFIER IS? classEntry+
  ;

classEntry
  : literal ((THROUGH | THRU) literal)?
  ;

symbolicClause
  : SYMBOLIC CHARACTERS? (IDENTIFIER+ (IS | ARE)? cobolNumber+)+ (IN IDENTIFIER)?
  ;

currencyClause
  : CURRENCY SIGN? IS? literal
  ;

// The manual spells the operand COMMA; it is a word here, not the ',' separator.
decimalPointClause
  : DECIMAL_POINT IS? IDENTIFIER
  ;

inputOutputSection
  : INPUT_OUTPUT SECTION DOT FILE_CONTROL? DOT? fileControlClause* ioControlParagraph?
  ;

ioControlParagraph
  : I_O_CONTROL DOT (ioControlEntry DOT?)*
  ;

ioControlEntry
  : SAME (RECORD | SORT | SORT_MERGE)? AREA? FOR? IDENTIFIER+
  | MULTIPLE FILE TAPE CONTAINS? multipleFileTapeItem+
  ;

multipleFileTapeItem
  : IDENTIFIER POSITION cobolNumber
  ;

fileControlClause
  : SELECT optionalFileClause? IDENTIFIER ASSIGN TO? fileSource selectClause* DOT?
  ;

optionalFileClause
  : OPTIONAL
  ;

selectClause
  : fileOrgClause
  | accessModeClause
  | recordKeyClause
  | fileStatusClause
  | relativeKeyClause
  | alternateKeyClause
  | reserveClause
  ;

relativeKeyClause
  : RELATIVE KEY? IS? IDENTIFIER
  ;

alternateKeyClause
  : ALTERNATE RECORD? KEY IS? IDENTIFIER (WITH? DUPLICATES)?
  ;

reserveClause
  : RESERVE cobolNumber (AREA | AREAS)?
  ;

fileSource
  : IDENTIFIER
  | STRING_LITERAL
  ;

fileOrgClause
  : ORGANIZATION IS? (SEQUENTIAL | RELATIVE | INDEXED | LINE SEQUENTIAL)
  ;

accessModeClause
  : ACCESS MODE IS? (SEQUENTIAL | DYNAMIC | RANDOM)
  ;

recordKeyClause
  : RECORD KEY IS? IDENTIFIER
  ;

fileStatusClause
  : (FILE_STATUS | FILE STATUS) IS? IDENTIFIER
  ;

dataDivision
  : DATA DIVISION DOT fileSection? workingStorageSection? communicationSection? mappingSection? linkageSection? localStorageSection? reportSection? screenSection?
  ;

fileSection
  : FILE SECTION DOT fileDescriptionEntry*
  ;

workingStorageSection
  : WORKING_STORAGE SECTION DOT dataDescriptionEntry*
  ;

// Inline mapper definitions. A MAPPING SECTION holds one or more named mappers,
// each with a set of field-level MAP-RULE entries. Paths may be quoted strings
// or bare dotted identifiers (DOTTED_PATH). The USING rule may be a quoted
// string or a BEGIN...END block; both compile to native mapping opcodes.
mappingSection
  : MAPPING SECTION DOT mapperEntry*
  ;

mapperEntry
  : MAPPER_ENTRY mappingName SOURCE_TYPE mappingName TARGET_TYPE mappingName DOT? mapRule*
  ;

mapRule
  : MAP_RULE mappingPath TO mappingPath USING mapRuleBody DOT?
  ;

mappingName
  : IDENTIFIER
  | STRING_LITERAL
  ;

mappingPath
  : DOTTED_PATH
  | IDENTIFIER
  | STRING_LITERAL
  ;

mapRuleBody
  : STRING_LITERAL
  | BEGIN_KW mapRuleExpr END
  ;

mapRuleExpr
  : (IDENTIFIER | DOTTED_PATH | OUTPUT | INPUT | LPAREN | RPAREN | EQ | COMMA | STRING_LITERAL | NUMBER)+
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

communicationSection
  : COMMUNICATION SECTION DOT communicationDescriptionEntry*
  ;

screenSection
  : SCREEN SECTION DOT screenDescriptionEntry*
  ;

fileDescriptionEntry
  : (FD | SD) IDENTIFIER fileDescClause* DOT dataDescriptionEntry*
  | fileLevelNumber IDENTIFIER fileDescClause* DOT?
  ;

reportDescriptionEntry
  : RD IDENTIFIER reportDescriptionClause* DOT reportGroupDescriptionEntry*
  ;

reportDescriptionClause
  : (CONTROL IS? | CONTROLS ARE?) (FINAL | IDENTIFIER) (COMMA? (FINAL | IDENTIFIER))*
  | PAGE (LIMIT | LIMITS) (IS | ARE)? cobolNumber LINES?
      (HEADING cobolNumber)? (FIRST DETAIL cobolNumber)? (LAST DETAIL cobolNumber)?
      (FOOTING cobolNumber)?
  ;

reportGroupDescriptionEntry
  : fileLevelNumber IDENTIFIER? reportGroupClause* DOT?
  ;

reportGroupClause
  : TYPE IS? (REPORT (HEADING | FOOTING) | PAGE (HEADING | FOOTING) | CONTROL (HEADING | FOOTING) (FINAL | IDENTIFIER)?
      | DETAIL | IDENTIFIER (FINAL | IDENTIFIER)?)
  | LINE IDENTIFIER? IS? (PLUS_WORD? cobolNumber | NEXT PAGE)
  | NEXT GROUP IS? (PLUS_WORD? cobolNumber | NEXT PAGE)
  | SUM dataReference (COMMA? dataReference)* (UPON IDENTIFIER (COMMA? IDENTIFIER)*)? (RESET ON? (FINAL | IDENTIFIER))?
  | GROUP INDICATE?
  | (USAGE IS?)? DISPLAY
  | JUSTIFIED RIGHT?
  | BLANK WHEN? ZERO
  | COLUMN (IDENTIFIER IS?)? cobolNumber
  | pictureClause
  | VALUE IS? literal
  | SOURCE IS? dataReference
  ;

communicationDescriptionEntry
  : IDENTIFIER IDENTIFIER communicationClause* DOT dataDescriptionEntry*
  ;

communicationClause
  : FOR (INPUT | OUTPUT | INITIAL INPUT)
  | SYMBOLIC (QUEUE | SOURCE | DESTINATION | IDENTIFIER) IS? IDENTIFIER
  | MESSAGE IDENTIFIER IS? IDENTIFIER
  | TEXT IDENTIFIER IS? IDENTIFIER
  | (END | STATUS | ERROR | DESTINATION | MESSAGE) KEY IS? IDENTIFIER
  | (MESSAGE | DESTINATION) COUNT IS? IDENTIFIER
  | DESTINATION TABLE OCCURS cobolNumber TIMES? (INDEXED BY identifierList)?
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
  : pictureClause
  | VALUE IS? literal
  | OCCURS cobolNumber (TO cobolNumber)? TIMES? (DEPENDING ON? IDENTIFIER)?
  | REDEFINES IDENTIFIER
  | renamesClause
  | USAGE IS? usageClause
  | SYNCHRONIZED
  | JUSTIFIED RIGHT?
  | BLANK WHEN? ZERO
  | SIGN IS? (LEADING | TRAILING) (SEPARATE CHARACTER?)?
  | INDEXED BY identifierList
  | BINARY
  | COMP
  | COMP_1
  | COMP_2
  | COMP_3
  | COMP_4
  | COMP_5
  | computationalUsage
  | occursKeyClause
  | conditionValueClause
  | externalClause
  | globalClause
  ;

renamesClause
  : RENAMES IDENTIFIER ((THROUGH | THRU) IDENTIFIER)?
  ;

computationalUsage
  : COMPUTATIONAL
  | COMPUTATIONAL_1
  | COMPUTATIONAL_2
  | COMPUTATIONAL_3
  | COMPUTATIONAL_4
  | COMPUTATIONAL_5
  | PACKED_DECIMAL
  ;

occursKeyClause
  : (ASCENDING | DESCENDING) KEY? IS? IDENTIFIER+
  ;

// Level-88 values: a list and/or THRU ranges (manual ch. 7, condition-name entry).
conditionValueClause
  : (VALUE IS? | VALUES ARE?) conditionValue+
  ;

conditionValue
  : literal ((THROUGH | THRU) literal)?
  ;

externalClause
  : IS? EXTERNAL
  ;

globalClause
  : IS? GLOBAL
  ;

fileDescClause
  : RECORD CONTAINS? cobolNumber (TO cobolNumber)? CHARACTERS?
  | LABEL (RECORD | RECORDS) (IS | ARE)? (STANDARD | OMITTED)
  | DATA (RECORD | RECORDS) (IS | ARE)? identifierList
  | BLOCK CONTAINS? cobolNumber (TO cobolNumber)? (RECORDS | CHARACTERS)?
  | FILE_STATUS IS? IDENTIFIER
  | recordVaryingClause
  | linageClause
  | valueOfClause
  | reportFileClause
  | codeSetClause
  | externalClause
  | globalClause
  ;

recordVaryingClause
  : RECORD IS? VARYING IN? SIZE? (FROM? cobolNumber)? (TO cobolNumber)? CHARACTERS? (DEPENDING ON? IDENTIFIER)?
  ;

linageClause
  : LINAGE IS? linageValue LINES? (WITH? FOOTING AT? linageValue)? (LINES? AT? TOP linageValue)? (LINES? AT? BOTTOM linageValue)?
  ;

linageValue
  : cobolNumber
  | IDENTIFIER
  ;

valueOfClause
  : VALUE OF ((IDENTIFICATION | IDENTIFIER) IS? (literal | IDENTIFIER))+
  ;

reportFileClause
  : REPORT IS? IDENTIFIER
  ;

codeSetClause
  : CODE_SET IS? IDENTIFIER
  ;

reportClause
  : HEADING
  | FOOTING
  | CONTROL IDENTIFIER
  ;

screenClause
  : VALUE literal
  | pictureClause
  | USING IDENTIFIER
  | LINE cobolNumber?
  | COLUMN cobolNumber?
  ;

// The whole character-string is one lexical token so edited pictures such as
// $$,$$9.99 or -ZZ9 lex the way the manual defines them (see PIC_SPEC).
pictureClause
  : PIC_SPEC
  ;

cobolNumber
  : NUMBER
  | LEVEL_NUMBER
  | LEVEL_77
  ;

usageClause
  : DISPLAY
  | INDEX
  | BINARY
  | COMP
  | COMP_1
  | COMP_2
  | COMP_3
  | COMP_4
  | COMP_5
  | computationalUsage
  ;

procedureDivision
  : PROCEDURE DIVISION procedureUsingClause? procedureGivingClause? (DOT declaratives)? (procedureSection | paragraph | sentence | DOT)*
  ;

declaratives
  : DECLARATIVES DOT declarativeSection+ END DECLARATIVES DOT
  ;

declarativeSection
  : IDENTIFIER SECTION segmentNumber? DOT useStatement DOT (sentence | DOT)* paragraph*
  ;

useStatement
  : USE GLOBAL? AFTER STANDARD? (EXCEPTION | ERROR) PROCEDURE ON? (identifierList | INPUT | OUTPUT | I_O | EXTEND)
  | USE FOR? DEBUGGING ON? debugTarget+
  | USE GLOBAL? BEFORE REPORTING IDENTIFIER
  ;

debugTarget
  : ALL PROCEDURES
  | ALL REFERENCES? OF? dataReference
  | paragraphName
  ;

procedureSection
  : IDENTIFIER SECTION segmentNumber? DOT (sentence | DOT)* paragraph*
  ;

segmentNumber
  : cobolNumber
  ;

procedureUsingClause
  : USING procedureParameterList
  ;

procedureGivingClause
  : GIVING IDENTIFIER
  ;

procedureParameterList
  : procedureParameter (COMMA? procedureParameter)*
  ;

procedureParameter
  : IDENTIFIER
  | STRING_LITERAL
  ;

paragraph
  : paragraphName DOT (sentence | DOT)*
  ;

paragraphName
  : IDENTIFIER
  | NUMBER
  | LEVEL_NUMBER
  | LEVEL_77
  | SECTION
  | IDENTIFIER IDENTIFIER
  ;

// A period ends every statement nested inside it, so nested statement lists
// (IF bodies, SIZE ERROR phrases, ...) never contain a separator period.
sentence
  : statement
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
  | rewriteStatement
  | startStatement
  | deleteStatement
  | computeStatement
  | addStatement
  | subtractStatement
  | multiplyStatement
  | divideStatement
  | stringStatement
  | unstringStatement
  | gobackStatement
  | stopRunStatement
  | interopStatement
  | sendServiceStatement
  | enableStatement
  | disableStatement
  | sendStatement
  | receiveStatement
  | purgeStatement
  | reportStatement
  | suppressStatement
  | copyStatement
  | execStatement
  | continueStatement
  | moveCorrespondingStatement
  | goToStatement
  | alterStatement
  | exitStatement
  | nextSentenceStatement
  | stopLiteralStatement
  | cancelStatement
  | inspectStatement
  | initializeStatement
  | searchStatement
  | sortStatement
  | mergeStatement
  | releaseStatement
  | returnStatement
  ;

moveStatement
  : MOVE moveSource TO receivingList
  ;

moveSource
  : literal
  | dataReference
  | intrinsicFunction
  ;

setStatement
  : SET dataReference (COMMA? dataReference)* TO setSource
  | SET dataReference (COMMA? dataReference)* (UP | DOWN) BY setSource
  ;

setSource
  : literal
  | dataReference
  | ON
  | OFF
  ;

performStatement
  : PERFORM (inlinePerform | performTarget performClause*)
  ;

performTarget
  : paragraphName
  ;

inlinePerform
  : performTest? UNTIL condition sentence* END_PERFORM
  | performTest? VARYING IDENTIFIER FROM expression BY expression UNTIL condition performAfter* sentence* END_PERFORM
  | performCount TIMES sentence* END_PERFORM
  | sentence* END_PERFORM
  ;

performClause
  : UNTIL condition
  | THRU paragraphName
  | THROUGH paragraphName
  | performCount TIMES
  | performTest
  | VARYING IDENTIFIER FROM expression BY expression UNTIL condition performAfter*
  ;

performCount
  : cobolNumber
  | dataReference
  ;

performTest
  : WITH? TEST (BEFORE | AFTER)
  ;

performAfter
  : AFTER IDENTIFIER FROM expression BY expression UNTIL condition
  ;

callStatement
  : CALL callTarget callUsingClause? callGivingClause? (callOnExceptionClause | callOverflowClause)? callNotOnExceptionClause? END_CALL?
  ;

sendServiceStatement
  : SEND SERVICE callTarget USING callParameter
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
  : ON? EXCEPTION sentence*
  ;

callOverflowClause
  : ON? OVERFLOW sentence*
  ;

callNotOnExceptionClause
  : NOT ON? EXCEPTION sentence*
  ;

callParameter
  : IDENTIFIER
  | literal
  ;

ifStatement
  : IF condition THEN? sentence* elseClause? END_IF?
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
  | whenRange
  | condition
  ;

whenRange
  : NOT? expression ((THROUGH | THRU) expression)?
  ;

endEvaluateClause
  : END_EVALUATE
  ;

displayStatement
  : DISPLAY displayItem+ displayUponClause? displayNoAdvancingClause?
  ;

displayUponClause
  : UPON IDENTIFIER
  ;

displayNoAdvancingClause
  : WITH? NO ADVANCING
  ;

acceptStatement
  : ACCEPT receivingList (FROM IDENTIFIER)?
  | ACCEPT IDENTIFIER MESSAGE COUNT
  ;

enableStatement
  : ENABLE (INPUT | OUTPUT) TERMINAL? IDENTIFIER WITH KEY IDENTIFIER
  ;

disableStatement
  : DISABLE (INPUT | OUTPUT) TERMINAL? IDENTIFIER WITH KEY IDENTIFIER
  ;

sendStatement
  : SEND IDENTIFIER (FROM dataReference)? (WITH? (EMI | ESI | EGI | CINT | dataReference))?
      (REPLACING LINE)?
  ;

receiveStatement
  : RECEIVE IDENTIFIER (MESSAGE | SEGMENT) (INTO dataReference)?
      (NO DATA sentence* | WITH DATA sentence*)* END_RECEIVE?
  ;

purgeStatement
  : PURGE IDENTIFIER
  ;

suppressStatement
  : SUPPRESS PRINTING?
  ;

reportStatement
  : INITIATE IDENTIFIER+
  | GENERATE IDENTIFIER
  | TERMINATE IDENTIFIER+
  ;

openStatement
  : OPEN openMode? openFileItem (COMMA? openFileItem)* (openMode openFileItem (COMMA? openFileItem)*)*
  ;

openMode
  : INPUT
  | OUTPUT
  | I_O
  | EXTEND
  ;

closeStatement
  : CLOSE closeFileItem (COMMA? closeFileItem)*
  ;

openFileItem
  : IDENTIFIER (REVERSED | WITH? NO REWIND)?
  ;

closeFileItem
  : IDENTIFIER ((REEL | UNIT) (FOR? REMOVAL | WITH? NO REWIND)? | WITH? (NO REWIND | LOCK))?
  ;

readStatement
  : READ IDENTIFIER readClause* END_READ?
  ;

readClause
  : INTO IDENTIFIER
  | KEY IS? IDENTIFIER
  | NEXT RECORD?
  | RECORD
  | AT END sentence*
  | NOT AT END sentence*
  | invalidKeyClause
  | notInvalidKeyClause
  ;

invalidKeyClause
  : INVALID KEY? sentence*
  ;

notInvalidKeyClause
  : NOT INVALID KEY? sentence*
  ;

writeStatement
  : WRITE IDENTIFIER writeClause* END_WRITE?
  ;

writeClause
  : FROM IDENTIFIER
  | AFTER ADVANCING (cobolNumber LINES? | PAGE)
  | INVALID KEY sentence*
  | NOT INVALID KEY sentence*
  | writeAdvancingClause
  | endOfPageClause
  ;

writeAdvancingClause
  : (BEFORE | AFTER) ADVANCING? ((dataReference | cobolNumber) (LINE | LINES)? | PAGE)
  ;

endOfPageClause
  : NOT? AT? (END_OF_PAGE | EOP) sentence*
  ;

rewriteStatement
  : REWRITE IDENTIFIER (FROM IDENTIFIER)? invalidKeyClause? notInvalidKeyClause? END_REWRITE?
  ;

startStatement
  : START IDENTIFIER startClause* invalidKeyClause? notInvalidKeyClause? END_START?
  ;

startClause
  : KEY IS? comparator? (IDENTIFIER | literal)
  ;

deleteStatement
  : DELETE IDENTIFIER RECORD? invalidKeyClause? notInvalidKeyClause? END_DELETE?
  ;

computeStatement
  : COMPUTE arithmeticReceivers (ASSIGN | EQ | EQUAL) expression sizeErrorPhrases? END_COMPUTE?
  ;

sizeErrorClause
  : ON? SIZE ERROR sentence*
  ;

notSizeErrorClause
  : NOT ON? SIZE ERROR sentence*
  ;

sizeErrorPhrases
  : sizeErrorClause notSizeErrorClause?
  | notSizeErrorClause
  ;

arithmeticReceivers
  : arithmeticReceiver (COMMA? arithmeticReceiver)*
  ;

arithmeticReceiver
  : dataReference ROUNDED?
  ;

correspondingPhrase
  : CORRESPONDING
  | CORR
  ;

givingPhrase
  : GIVING arithmeticReceivers (REMAINDER dataReference)?
  ;

addStatement
  : ADD correspondingPhrase? expression (COMMA? expression)* (TO arithmeticReceivers | TO? expression givingPhrase | givingPhrase) sizeErrorPhrases? END_ADD?
  ;

subtractStatement
  : SUBTRACT correspondingPhrase? expression (COMMA? expression)* FROM (arithmeticReceivers | expression givingPhrase) sizeErrorPhrases? END_SUBTRACT?
  ;

multiplyStatement
  : MULTIPLY expression BY (arithmeticReceivers | expression givingPhrase) sizeErrorPhrases? END_MULTIPLY?
  ;

// DIVIDE x BY y without GIVING is a Cobolish extension meaning y := y / x.
divideStatement
  : DIVIDE expression (INTO | BY) (arithmeticReceivers | expression givingPhrase) sizeErrorPhrases? END_DIVIDE?
  ;

stringStatement
  : STRING stringGroup+ INTO dataReference (WITH? POINTER dataReference)? overflowClause? END_STRING?
  ;

stringGroup
  : stringItem+ DELIMITED BY (SIZE | stringItem)
  ;

stringItem
  : dataReference
  | literal
  ;

unstringStatement
  : UNSTRING stringItem (DELIMITED BY? unstringDelimiter (OR unstringDelimiter)*)? INTO unstringReceiver (COMMA? unstringReceiver)* (WITH? POINTER dataReference)? (TALLYING IN? dataReference)? overflowClause? END_UNSTRING?
  ;

unstringDelimiter
  : ALL? stringItem
  ;

unstringReceiver
  : dataReference (DELIMITER IN? dataReference)? (COUNT IN? dataReference)?
  ;

overflowClause
  : ON? OVERFLOW sentence* (NOT ON? OVERFLOW sentence*)?
  | NOT ON? OVERFLOW sentence*
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

// ---- Additional COBOL 85 statements (manual 522555-006, Section 9) ----

moveCorrespondingStatement
  : MOVE correspondingPhrase dataReference TO receivingList
  ;

procedureRange
  : paragraphName ((THRU | THROUGH) paragraphName)?
  ;

goToStatement
  : GO TO? (paragraphName+ (DEPENDING ON? dataReference)?)?
  ;

alterStatement
  : ALTER (paragraphName TO (PROCEED TO)? paragraphName)+
  ;

exitStatement
  : EXIT PROGRAM?
  ;

nextSentenceStatement
  : NEXT SENTENCE
  ;

stopLiteralStatement
  : STOP literal
  ;

cancelStatement
  : CANCEL (IDENTIFIER | STRING_LITERAL)+
  ;

inspectStatement
  : INSPECT dataReference (inspectTallying inspectReplacing? | inspectReplacing | inspectConverting)
  ;

inspectTallying
  : TALLYING (dataReference FOR inspectTallyFor+)+
  ;

inspectTallyFor
  : CHARACTERS inspectBeforeAfter*
  | (ALL | LEADING) (inspectValue inspectBeforeAfter*)+
  ;

inspectReplacing
  : REPLACING inspectReplaceItem+
  ;

inspectReplaceItem
  : CHARACTERS BY inspectValue inspectBeforeAfter*
  | (ALL | LEADING | FIRST) (inspectValue BY inspectValue inspectBeforeAfter*)+
  ;

inspectConverting
  : CONVERTING inspectValue TO inspectValue inspectBeforeAfter*
  ;

inspectBeforeAfter
  : (BEFORE | AFTER) INITIAL? inspectValue
  ;

inspectValue
  : literal
  | dataReference
  ;

initializeStatement
  : INITIALIZE dataReference+ (REPLACING (initializeCategory DATA? BY inspectValue)+)?
  ;

initializeCategory
  : ALPHABETIC
  | ALPHANUMERIC
  | NUMERIC
  | ALPHANUMERIC_EDITED
  | NUMERIC_EDITED
  ;

searchStatement
  : SEARCH ALL? dataReference (VARYING dataReference)? (AT? END sentence*)? searchWhen+ END_SEARCH?
  ;

searchWhen
  : WHEN condition sentence*
  ;

sortStatement
  : SORT IDENTIFIER sortKeyClause+ sortDuplicatesClause? collatingSequencePhrase? sortInput sortOutput
  ;

sortKeyClause
  : ON? (ASCENDING | DESCENDING) KEY? IS? dataReference+
  ;

sortDuplicatesClause
  : WITH? DUPLICATES IN? ORDER?
  ;

collatingSequencePhrase
  : COLLATING? SEQUENCE IS? IDENTIFIER
  ;

sortInput
  : INPUT PROCEDURE IS? procedureRange
  | USING IDENTIFIER+
  ;

sortOutput
  : OUTPUT PROCEDURE IS? procedureRange
  | GIVING IDENTIFIER+
  ;

mergeStatement
  : MERGE IDENTIFIER sortKeyClause+ collatingSequencePhrase? USING IDENTIFIER IDENTIFIER+ sortOutput
  ;

releaseStatement
  : RELEASE IDENTIFIER (FROM dataReference)?
  ;

returnStatement
  : RETURN IDENTIFIER RECORD? (INTO dataReference)?
      (AT? END sentence*)? (NOT AT? END sentence*)? END_RETURN?
  ;

condition
  : relation
  | classCondition
  | signCondition
  | NOT condition
  | condition abbreviatedRelation
  | condition AND condition
  | condition OR condition
  | LPAREN condition RPAREN
  ;

classCondition
  : expression IS? NOT? classKind
  | expression (IS NOT? | NOT) IDENTIFIER
  ;

classKind
  : NUMERIC
  | ALPHABETIC
  | ALPHABETIC_LOWER
  | ALPHABETIC_UPPER
  ;

signCondition
  : expression IS? NOT? (POSITIVE | NEGATIVE | ZERO)
  ;

abbreviatedRelation
  : (AND | OR) NOT? comparator expression
  ;

relation
  : expression comparator expression
  | expression
  ;

comparator
  : IS? NOT? relationalOperator
  ;

relationalOperator
  : EQ
  | NEQ
  | LT
  | LE
  | GT
  | GE
  | NOT_EQ
  | EQUAL TO?
  | GREATER THAN? (OR EQUAL TO?)?
  | LESS THAN? (OR EQUAL TO?)?
  ;

expression
  : term ((PLUS | MINUS) term)*
  ;

term
  : factor ((MUL | DIV) factor)*
  ;

factor
  : literal
  | dataReference
  | LPAREN expression RPAREN
  | functionCall
  | intrinsicFunction
  | (PLUS | MINUS) factor
  | factor POW factor
  ;

intrinsicFunction
  : FUNCTION functionName (LPAREN argumentList? RPAREN)? referenceModifier?
  ;

functionName
  : IDENTIFIER
  | SUM
  | RANDOM
  ;

functionCall
  : IDENTIFIER LPAREN argumentList? RPAREN
  ;

argumentList
  : expression (COMMA? expression)*
  ;

identifierList
  : IDENTIFIER (COMMA? IDENTIFIER)*
  ;

receivingList
  : dataReference (COMMA? dataReference)*
  ;

dataReference
  : IDENTIFIER qualifier* (LPAREN expression (COLON expression? | (COMMA? expression)*) RPAREN)? referenceModifier?
  | IDENTIFIER qualifier* LPAREN ALL RPAREN
  ;

qualifier
  : (OF | IN) IDENTIFIER
  ;

referenceModifier
  : LPAREN expression COLON expression? RPAREN
  ;

displayItem
  : literal
  | dataReference
  | intrinsicFunction
  ;

literal
  : stringLiteral
  | numericLiteral
  | booleanLiteral
  | SPACE
  | SPACES
  | ZERO
  | ZEROS
  | ZEROES
  | QUOTES
  | figurativeConstant
  | allLiteral
  ;

figurativeConstant
  : HIGH_VALUE
  | HIGH_VALUES
  | LOW_VALUE
  | LOW_VALUES
  | QUOTE
  ;

allLiteral
  : ALL literal
  ;

stringLiteral
  : STRING_LITERAL
  ;

numericLiteral
  : NUMBER
  | LEVEL_NUMBER
  | LEVEL_77
  | signedNumber
  ;

signedNumber
  : (PLUS | MINUS) (NUMBER | LEVEL_NUMBER | LEVEL_77)
  ;

booleanLiteral
  : TRUE
  | FALSE
  ;

cobolishMetaClause
  : INTEROP interopKind stringLiteral (AS IDENTIFIER)? DOT?
  | ROLE roleName DOT?
  | LIBRARY stringLiteral FROM librarySource DOT?
  | USE stringLiteral (AS IDENTIFIER)? DOT?
  | IMPORT mapperImportDecl DOT?
  | ROUTE mappingPath TO mappingPath USING MAPPER mappingName DOT?
  | DATABASE (stringLiteral | IDENTIFIER) TYPE (stringLiteral | IDENTIFIER) DOT?
  | systemMetaClause
  ;

systemMetaClause
  : 'SYSTEM' ('TYPE' stringLiteral | stringLiteral ('OF' 'TYPE' stringLiteral)?) systemVisibilityClause? BEGIN_KW systemMember* END DOT?
  ;

systemMember
  : systemQueueMember
  | systemServiceMember
  ;

systemQueueMember
  : 'QUEUE' stringLiteral (ARROW stringLiteral)? 'TYPE' stringLiteral systemVisibilityClause? DOT?
  ;

systemServiceMember
  : SERVICE stringLiteral ARROW? stringLiteral? systemVisibilityClause? DOT?
  ;

systemVisibilityClause
  : 'VISIBILITY' ('INTERNAL' | 'EXPOSED')
  ;

roleName
  : CODE_LIBRARIAN
  | IDENTIFIER
  ;

mapperImportDecl
  : MAPPER stringLiteral FROM librarySource
  | MAPPER IDENTIFIER FROM librarySource
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
  : IDENTIFIER
  | SECOND
  | SECONDS
  ;

endProgramClause
  : END PROGRAM programName? DOT?
  ;

librarySource
  : LIBRARIAN
  | MAPPER
  | IDENTIFIER
  | stringLiteral
  ;

END_CALL: 'END-CALL';
END_IF: 'END-IF';
END_READ: 'END-READ';
END_WRITE: 'END-WRITE';
END_REWRITE: 'END-REWRITE';
END_START: 'END-START';
END_DELETE: 'END-DELETE';
END_COMPUTE: 'END-COMPUTE';
END_EVALUATE: 'END-EVALUATE';
END_PERFORM: 'END-PERFORM';
END_EXEC: 'END-EXEC';
END: 'END';
ROUNDED: 'ROUNDED';
SIZE: 'SIZE';
ERROR: 'ERROR';
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
FILE_CONTROL: 'FILE-CONTROL';
DATA: 'DATA';
PROCEDURE: 'PROCEDURE';
DIVISION: 'DIVISION';
SECTION: 'SECTION';
WORKING_STORAGE: 'WORKING-STORAGE';
FILE: 'FILE';
FD: 'FD';
SD: 'SD';
LINKAGE: 'LINKAGE';
LOCAL_STORAGE: 'LOCAL-STORAGE';
REPORT: 'REPORT';
RD: 'RD';
SCREEN: 'SCREEN';
COMMUNICATION: 'COMMUNICATION';
SPECIAL_NAMES: 'SPECIAL-NAMES';
SOURCE_COMPUTER: 'SOURCE-COMPUTER';
OBJECT_COMPUTER: 'OBJECT-COMPUTER';
DEBUGGING: 'DEBUGGING';
SEGMENT_LIMIT: 'SEGMENT-LIMIT';
LIBRARIAN: 'LIBRARIAN';
PULSE: 'PULSE';
SERVICE: 'SERVICE';
SEND: 'SEND';
DAEMON: 'DAEMON';
PROGRAM: 'PROGRAM';
EVERY: 'EVERY';
LOCAL: 'LOCAL';
PARENT: 'PARENT';
CHILD: 'CHILD';
SIBLING: 'SIBLING';
ALTERNATE: 'ALTERNATE';
SELECT: 'SELECT';
ASSIGN: 'ASSIGN';
TO: 'TO';
ORGANIZATION: 'ORGANIZATION';
ACCESS: 'ACCESS';
MODE: 'MODE';
NEXT: 'NEXT';
SEQUENTIAL: 'SEQUENTIAL';
RELATIVE: 'RELATIVE';
DYNAMIC: 'DYNAMIC';
RANDOM: 'RANDOM';
RECORD: 'RECORD';
KEY: 'KEY';
FILE_STATUS: 'FILE-STATUS';
STATUS: 'STATUS';
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
ZEROES: 'ZEROES';
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
REWRITE: 'REWRITE';
ACCEPT: 'ACCEPT';
START: 'START';
DELETE: 'DELETE';
COMPUTE: 'COMPUTE';
ADD: 'ADD';
SUBTRACT: 'SUBTRACT';
MULTIPLY: 'MULTIPLY';
DIVIDE: 'DIVIDE';
STRING: 'STRING';
UNSTRING: 'UNSTRING';
END_STRING: 'END-STRING';
END_UNSTRING: 'END-UNSTRING';
WITH: 'WITH';
POINTER: 'POINTER';
OVERFLOW: 'OVERFLOW';
GOBACK: 'GOBACK';
STOP: 'STOP';
RUN: 'RUN';
INTEROP: 'INTEROP';
WFL: 'WFL';
PASCALISH: 'PASCALISH';
COBOLISH: 'COBOLISH';
ROLE: 'ROLE';
CODE_LIBRARIAN: 'CODE_LIBRARIAN';
LIBRARY: 'LIBRARY';
USE: 'USE';
IMPORT: 'IMPORT';
MAPPER: 'MAPPER';
MAPPER_ENTRY: 'MAPPER-ENTRY';
MAP_RULE: 'MAP-RULE';
MAPPING: 'MAPPING';
SOURCE_TYPE: 'SOURCE-TYPE';
TARGET_TYPE: 'TARGET-TYPE';
ARROW: '->';
ROUTE: 'ROUTE';
USING: 'USING';
BEGIN_KW: 'BEGIN';
AS: 'AS';
REPLACING: 'REPLACING';
COPY: 'COPY';
EXEC: 'EXEC';
CONTINUE: 'CONTINUE';
REFERENCE: 'REFERENCE';
CONTENT: 'CONTENT';
RETURNING: 'RETURNING';
EXCEPTION: 'EXCEPTION';
INVALID: 'INVALID';
DUPLICATES: 'DUPLICATES';
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
CONTROLS: 'CONTROLS';
FINAL: 'FINAL';
SUM: 'SUM';
GROUP: 'GROUP';
INDICATE: 'INDICATE';
RESET: 'RESET';
SUPPRESS: 'SUPPRESS';
PRINTING: 'PRINTING';
REPORTING: 'REPORTING';
INITIATE: 'INITIATE';
GENERATE: 'GENERATE';
TERMINATE: 'TERMINATE';
LIMIT: 'LIMIT';
LIMITS: 'LIMITS';
DETAIL: 'DETAIL';
LAST: 'LAST';
MESSAGE: 'MESSAGE';
DESTINATION: 'DESTINATION';
QUEUE: 'QUEUE';
TABLE: 'TABLE';
TEXT: 'TEXT';
SOURCE: 'SOURCE';
ENABLE: 'ENABLE';
DISABLE: 'DISABLE';
TERMINAL: 'TERMINAL';
RECEIVE: 'RECEIVE';
SEGMENT: 'SEGMENT';
END_RECEIVE: 'END-RECEIVE';
PURGE: 'PURGE';
EMI: 'EMI';
ESI: 'ESI';
EGI: 'EGI';
CINT: 'CINT';
POSITION: 'POSITION';
MULTIPLE: 'MULTIPLE';
TAPE: 'TAPE';
PLUS_WORD: 'PLUS';
DATE_COMPILED: 'DATE-COMPILED';
TRUE: 'TRUE';
FALSE: 'FALSE';
SPACE: 'SPACE';
SPACES: 'SPACES';
QUOTES: 'QUOTES';
NOT: 'NOT';
EQUAL: 'EQUAL';
GREATER: 'GREATER';
LESS: 'LESS';
THAN: 'THAN';
// COBOL 85 reserved words added for the full statement/clause syntax.
GO: 'GO';
ALTER: 'ALTER';
PROCEED: 'PROCEED';
EXIT: 'EXIT';
SENTENCE: 'SENTENCE';
CANCEL: 'CANCEL';
INSPECT: 'INSPECT';
TALLYING: 'TALLYING';
CONVERTING: 'CONVERTING';
INITIALIZE: 'INITIALIZE';
SEARCH: 'SEARCH';
END_SEARCH: 'END-SEARCH';
FIRST: 'FIRST';
COUNT: 'COUNT';
DELIMITER: 'DELIMITER';
UP: 'UP';
DOWN: 'DOWN';
CORRESPONDING: 'CORRESPONDING';
CORR: 'CORR';
REMAINDER: 'REMAINDER';
END_ADD: 'END-ADD';
END_SUBTRACT: 'END-SUBTRACT';
END_MULTIPLY: 'END-MULTIPLY';
END_DIVIDE: 'END-DIVIDE';
NUMERIC_EDITED: 'NUMERIC-EDITED';
NUMERIC: 'NUMERIC';
ALPHABETIC_LOWER: 'ALPHABETIC-LOWER';
ALPHABETIC_UPPER: 'ALPHABETIC-UPPER';
ALPHABETIC: 'ALPHABETIC';
ALPHANUMERIC_EDITED: 'ALPHANUMERIC-EDITED';
ALPHANUMERIC: 'ALPHANUMERIC';
POSITIVE: 'POSITIVE';
NEGATIVE: 'NEGATIVE';
HIGH_VALUES: 'HIGH-VALUES';
HIGH_VALUE: 'HIGH-VALUE';
LOW_VALUES: 'LOW-VALUES';
LOW_VALUE: 'LOW-VALUE';
QUOTE: 'QUOTE';
ALL: 'ALL';
FUNCTION: 'FUNCTION';
OPTIONAL: 'OPTIONAL';
LOCK: 'LOCK';
REEL: 'REEL';
UNIT: 'UNIT';
REMOVAL: 'REMOVAL';
REWIND: 'REWIND';
REVERSED: 'REVERSED';
END_OF_PAGE: 'END-OF-PAGE';
EOP: 'EOP';
CODE_SET: 'CODE-SET';
LINAGE: 'LINAGE';
TOP: 'TOP';
BOTTOM: 'BOTTOM';
RESERVE: 'RESERVE';
AREAS: 'AREAS';
AREA: 'AREA';
SAME: 'SAME';
I_O_CONTROL: 'I-O-CONTROL';
SORT_MERGE: 'SORT-MERGE';
SORT: 'SORT';
MERGE: 'MERGE';
ASCENDING: 'ASCENDING';
DESCENDING: 'DESCENDING';
RELEASE: 'RELEASE';
RETURN: 'RETURN';
END_RETURN: 'END-RETURN';
ORDER: 'ORDER';
COLLATING: 'COLLATING';
SEQUENCE: 'SEQUENCE';
DECLARATIVES: 'DECLARATIVES';
BEFORE: 'BEFORE';
PROCEDURES: 'PROCEDURES';
REFERENCES: 'REFERENCES';
EXTERNAL: 'EXTERNAL';
GLOBAL: 'GLOBAL';
COMMON: 'COMMON';
INITIAL: 'INITIAL';
VALUES: 'VALUES';
ARE: 'ARE';
COMPUTATIONAL_1: 'COMPUTATIONAL-1';
COMPUTATIONAL_2: 'COMPUTATIONAL-2';
COMPUTATIONAL_3: 'COMPUTATIONAL-3';
COMPUTATIONAL_4: 'COMPUTATIONAL-4';
COMPUTATIONAL_5: 'COMPUTATIONAL-5';
COMPUTATIONAL: 'COMPUTATIONAL';
ALPHABET: 'ALPHABET';
CLASS: 'CLASS';
SYMBOLIC: 'SYMBOLIC';
CURRENCY: 'CURRENCY';
DECIMAL_POINT: 'DECIMAL-POINT';
UPON: 'UPON';
NO: 'NO';
OFF: 'OFF';
TEST: 'TEST';
IN: 'IN';
OF: 'OF';
FOR: 'FOR';
POW: '**';
// A PICTURE character-string is lexed as one token so that symbols such as
// '.', ',', '/', '+', '-', '$' and '*' are never split by the expression lexer.
PIC_SPEC: ('PIC' | 'PICTURE') (PICWS+ 'IS')? PICWS+ PICCHAR+ ('.' PICCHAR+)*;
fragment PICWS: [ \t\r\n];
fragment PICCHAR: ~[ \t\r\n.;];
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
COLON: ':';
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
NUMBER: [0-9]+ ('.' [0-9]+)? | '.' [0-9]+;
STRING_LITERAL: '"' ( '""' | ~["\r\n] )* '"'
  | '\'' ( '\'\'' | ~['\r\n] )* '\''
  ;
DOTTED_PATH: [A-Z][A-Z0-9_-]* ('.' [A-Z0-9@#_-]+)+;
DATABASE: 'DATABASE';
TYPE: 'TYPE';
IDENTIFIER: [A-Z][A-Z0-9_-]*;
SEPARATOR: [;,] [ \t\r\n]+ -> channel(HIDDEN);
WS: [ \t\r\n]+ -> skip;
COMMENT: '*>'.*? '\n' -> skip;
