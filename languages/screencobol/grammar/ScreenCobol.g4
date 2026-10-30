grammar ScreenCobol;
options { caseInsensitive = true; }

program
  : 'IDENTIFICATION' 'DIVISION' '.' 'PROGRAM-ID' '.' name '.'
    'DATA' 'DIVISION' '.' 'WORKING-STORAGE' 'SECTION' '.' item+
    'SCREEN' 'SECTION' '.' screen+
    'PROCEDURE' 'DIVISION' '.' (statement '.')+ EOF
  ;
item : level name 'PIC' 'X' ('(' integer ')')? ('VALUE' string)? '.';
screen : '01' name ('SIZE' integer ',' integer)? '.' field+;
field : '05' name 'AT' integer ',' integer
        ('VALUE' string | 'PIC' 'X' ('(' integer ')')? direction name) '.';
direction : 'USING' | 'FROM' | 'TO';
statement
  : 'DISPLAY' 'BASE'? name                                    # displayStatement
  | 'ACCEPT' name                                             # acceptStatement
  | 'MOVE' string 'TO' name                                   # moveStatement
  | 'SEND' name 'TO' string 'REPLY' 'CODE' integer 'YIELDS' name # sendStatement
  | 'STOP' 'RUN'                                              # stopStatement
  ;
level : '01' | '77';
name : IDENTIFIER | 'FILLER';
integer : NUMBER | '01' | '05' | '77';
string : STRING;
STRING : '"' ('""' | ~["\r\n])* '"' | '\'' ('\'\'' | ~['\r\n])* '\'';
IDENTIFIER : [A-Z] [A-Z0-9-]*;
NUMBER : [0-9]+;
COMMENT : '*>' ~[\r\n]* -> skip;
WS : [ \t\r\n]+ -> skip;
