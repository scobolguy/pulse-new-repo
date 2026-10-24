// FORTRAN 77 format specification grammar (ANSI X3.9-1978 section 13.2).
// Used for FORMAT statements and for character-constant format identifiers.
grammar F77Format;

options { caseInsensitive = true; }

formatSpecification : LPAREN formatList? RPAREN EOF ;
formatList : formatItem (COMMA? formatItem)* ;
formatItem
  : ICON? LPAREN formatList RPAREN   # groupItem
  | ICON? dataEdit                   # dataItem
  | ICON? X                          # skipItem
  | (T | TL | TR) ICON               # tabItem
  | (PLUS | MINUS)? ICON P           # scaleItem
  | (S | SP | SS)                    # signItem
  | (BN | BZ)                        # blankItem
  | SLASH                            # slashItem
  | COLON                            # colonItem
  | SCON                             # literalItem
  ;
dataEdit
  : I ICON (DOT ICON)?               # integerEdit
  | F ICON DOT ICON                  # fixedEdit
  | (E | D | G) ICON DOT ICON (E ICON)? # exponentEdit
  | L ICON                           # logicalEdit
  | A ICON?                          # characterEdit
  ;

TL : 'TL' ;
TR : 'TR' ;
SP : 'SP' ;
SS : 'SS' ;
BN : 'BN' ;
BZ : 'BZ' ;
I : 'I' ;
F : 'F' ;
E : 'E' ;
D : 'D' ;
G : 'G' ;
L : 'L' ;
A : 'A' ;
X : 'X' ;
T : 'T' ;
P : 'P' ;
S : 'S' ;
ICON : [0-9]+ ;
SCON : '\'' (~['] | '\'\'')* '\'' ;
LPAREN : '(' ;
RPAREN : ')' ;
COMMA : ',' ;
DOT : '.' ;
SLASH : '/' ;
COLON : ':' ;
PLUS : '+' ;
MINUS : '-' ;
WS : [ ]+ -> skip ;
