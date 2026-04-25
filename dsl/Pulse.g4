grammar Pulse;

// Entry point
program: line* EOF;

line
    : instruction (COMMENT)? NEWLINE
    | NEWLINE
    ;

instruction
    : mnemonic operandList?
    ;

operandList
    : operand (',' operand)*
    ;

operand
    : INT
    | HEX
    | STRING
    | IDENTIFIER
    ;

mnemonic
    : 'LIT'
    | 'ADD'
    | 'SUB'
    | 'MUL'
    | 'DIV'
    | 'CALL'
    | 'RET'
    | 'JMP'
    | 'JPC'
    | 'DUP'
    | 'POP'
    | 'SWAP'
    | 'OVER'
    | 'PICK'
    | 'DROP'
    | 'ROT'
    | 'NIP'
    | 'TUCK'
    | 'SWAPN'
    | 'ROLL'
    | 'DEPTH'
    | 'CLEAR'
    | 'LITS'
    | 'WRITE'
    | 'PRINT'
    | 'SYS'
    | 'HALT'
    | 'LOAD'
    | 'STORE'
    | 'LOADL'
    | 'STOREL'
    | 'LOADH'
    | 'STOREH'
    // Add all other mnemonics as needed
    ;

IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*;
INT: [0-9]+;
HEX: '0x' [0-9a-fA-F]+;
STRING: '"' (~["\r\n])* '"';
COMMENT: ';' ~[\r\n]*;
NEWLINE: [\r\n]+;
WS: [ \t]+ -> skip;
