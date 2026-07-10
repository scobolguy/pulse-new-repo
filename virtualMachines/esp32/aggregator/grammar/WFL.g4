grammar WFL;

wflUnit
    : (clusterDecl
    | deployDecl
    | bindQueueDecl
    | bindFileDecl
    | evictDecl
    )* EOF
    ;

clusterDecl
    : 'cluster' IDENT '{' clusterBody* '}'
    ;

clusterBody
    : clusterDecl
    | IDENT ';'
    ;

deployDecl
    : 'deploy' deployTarget 'to' 'cluster' IDENT ';'
    ;

deployTarget
    : 'program' IDENT
    | 'service' IDENT
    | 'daemon' IDENT
    | 'queue' IDENT
    | 'file' IDENT
    ;

bindQueueDecl
    : 'bind' 'queue' IDENT queueBindingBody
    ;

queueBindingBody
    : 'manager' IDENT
      'name' STRING
      'cluster' IDENT
      ('fallback' IDENT)?
      ('mode' IDENT)?
      ';'
    ;

bindFileDecl
    : 'bind' 'file' IDENT fileBindingBody
    ;

fileBindingBody
    : ('path' STRING
     | 'device' STRING
     | 'url' STRING)
      'cluster' IDENT
      ('mode' IDENT)?
      ('rotate' IDENT)?
      ('maxsize' expr)?
      ';'
    ;

evictDecl
    : 'evict' 'service' IDENT
      'after' 'idle' expr timeUnit
      ('warm' 'reload' | 'cold' 'reload')?
      ('fallback' ('parent' | 'alternate'))?
      ';'
    ;

timeUnit
    : 'ms'
    | 'second'
    | 'seconds'
    | 'minute'
    | 'minutes'
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
    | IDENT
    | '(' expr ')'
    ;

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

WS
    : [ \t\r\n\f]+ -> skip
    ;
