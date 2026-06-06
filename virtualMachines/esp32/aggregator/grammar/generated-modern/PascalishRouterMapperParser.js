// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/PascalishRouterMapper.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishRouterMapperVisitor from './PascalishRouterMapperVisitor.js';

const serializedATN = [4,1,83,369,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,1,0,5,0,72,8,0,10,0,12,0,75,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
1,1,1,3,1,88,8,1,1,2,1,2,1,2,1,2,1,3,1,3,1,4,1,4,1,4,3,4,99,8,4,1,5,1,5,
5,5,103,8,5,10,5,12,5,106,9,5,1,5,1,5,3,5,110,8,5,1,6,1,6,1,6,1,6,1,6,3,
6,117,8,6,1,6,1,6,1,7,1,7,1,7,1,7,3,7,125,8,7,1,8,1,8,1,8,1,8,1,9,1,9,1,
9,1,9,1,10,1,10,1,10,3,10,138,8,10,1,10,1,10,1,11,1,11,1,11,3,11,145,8,11,
1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,1,14,1,14,3,14,157,8,14,1,15,1,15,
1,15,1,15,3,15,163,8,15,1,15,1,15,1,16,1,16,1,16,1,16,1,16,3,16,172,8,16,
1,16,1,16,1,17,1,17,1,18,1,18,1,18,1,18,1,18,5,18,183,8,18,10,18,12,18,186,
9,18,1,18,1,18,5,18,190,8,18,10,18,12,18,193,9,18,1,18,1,18,1,18,1,19,1,
19,1,19,1,19,1,19,1,19,3,19,204,8,19,1,20,1,20,1,20,3,20,209,8,20,1,20,1,
20,1,20,1,20,1,20,1,20,1,21,1,21,1,21,1,21,3,21,221,8,21,1,22,1,22,1,22,
1,22,1,22,1,22,1,22,5,22,230,8,22,10,22,12,22,233,9,22,1,22,1,22,5,22,237,
8,22,10,22,12,22,240,9,22,1,22,1,22,1,22,1,23,1,23,1,23,1,23,3,23,249,8,
23,1,24,1,24,1,24,1,24,1,24,1,24,3,24,257,8,24,1,24,1,24,1,25,1,25,1,25,
1,25,1,25,5,25,266,8,25,10,25,12,25,269,9,25,1,25,1,25,3,25,273,8,25,1,26,
1,26,1,26,1,26,1,26,5,26,280,8,26,10,26,12,26,283,9,26,1,26,1,26,3,26,287,
8,26,1,27,1,27,3,27,291,8,27,1,28,1,28,1,28,1,28,5,28,297,8,28,10,28,12,
28,300,9,28,1,28,1,28,1,29,1,29,3,29,306,8,29,1,30,1,30,1,31,1,31,1,32,1,
32,3,32,314,8,32,1,33,1,33,5,33,318,8,33,10,33,12,33,321,9,33,1,33,1,33,
1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,
34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,
1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,3,34,367,
8,34,1,34,0,0,35,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,
40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,0,5,2,0,13,13,78,78,1,0,70,
71,1,0,5,7,1,0,14,17,1,0,35,36,413,0,73,1,0,0,0,2,87,1,0,0,0,4,89,1,0,0,
0,6,93,1,0,0,0,8,98,1,0,0,0,10,100,1,0,0,0,12,111,1,0,0,0,14,124,1,0,0,0,
16,126,1,0,0,0,18,130,1,0,0,0,20,134,1,0,0,0,22,141,1,0,0,0,24,146,1,0,0,
0,26,148,1,0,0,0,28,156,1,0,0,0,30,158,1,0,0,0,32,166,1,0,0,0,34,175,1,0,
0,0,36,177,1,0,0,0,38,203,1,0,0,0,40,205,1,0,0,0,42,220,1,0,0,0,44,222,1,
0,0,0,46,248,1,0,0,0,48,250,1,0,0,0,50,272,1,0,0,0,52,286,1,0,0,0,54,288,
1,0,0,0,56,292,1,0,0,0,58,305,1,0,0,0,60,307,1,0,0,0,62,309,1,0,0,0,64,313,
1,0,0,0,66,315,1,0,0,0,68,366,1,0,0,0,70,72,3,2,1,0,71,70,1,0,0,0,72,75,
1,0,0,0,73,71,1,0,0,0,73,74,1,0,0,0,74,76,1,0,0,0,75,73,1,0,0,0,76,77,5,
0,0,1,77,1,1,0,0,0,78,88,3,8,4,0,79,88,3,4,2,0,80,88,3,12,6,0,81,88,3,26,
13,0,82,88,3,30,15,0,83,88,3,32,16,0,84,88,3,36,18,0,85,88,3,44,22,0,86,
88,3,10,5,0,87,78,1,0,0,0,87,79,1,0,0,0,87,80,1,0,0,0,87,81,1,0,0,0,87,82,
1,0,0,0,87,83,1,0,0,0,87,84,1,0,0,0,87,85,1,0,0,0,87,86,1,0,0,0,88,3,1,0,
0,0,89,90,5,12,0,0,90,91,3,6,3,0,91,92,5,70,0,0,92,5,1,0,0,0,93,94,7,0,0,
0,94,7,1,0,0,0,95,99,3,16,8,0,96,99,3,18,9,0,97,99,3,20,10,0,98,95,1,0,0,
0,98,96,1,0,0,0,98,97,1,0,0,0,99,9,1,0,0,0,100,104,5,25,0,0,101,103,3,68,
34,0,102,101,1,0,0,0,103,106,1,0,0,0,104,102,1,0,0,0,104,105,1,0,0,0,105,
107,1,0,0,0,106,104,1,0,0,0,107,109,5,26,0,0,108,110,7,1,0,0,109,108,1,0,
0,0,109,110,1,0,0,0,110,11,1,0,0,0,111,112,5,57,0,0,112,113,5,78,0,0,113,
114,5,73,0,0,114,116,3,54,27,0,115,117,3,14,7,0,116,115,1,0,0,0,116,117,
1,0,0,0,117,118,1,0,0,0,118,119,5,70,0,0,119,13,1,0,0,0,120,121,5,58,0,0,
121,125,5,59,0,0,122,123,5,58,0,0,123,125,3,58,29,0,124,120,1,0,0,0,124,
122,1,0,0,0,125,15,1,0,0,0,126,127,5,1,0,0,127,128,3,58,29,0,128,129,5,70,
0,0,129,17,1,0,0,0,130,131,5,2,0,0,131,132,3,58,29,0,132,133,5,70,0,0,133,
19,1,0,0,0,134,135,5,3,0,0,135,137,3,58,29,0,136,138,3,22,11,0,137,136,1,
0,0,0,137,138,1,0,0,0,138,139,1,0,0,0,139,140,5,70,0,0,140,21,1,0,0,0,141,
142,5,4,0,0,142,144,5,79,0,0,143,145,3,24,12,0,144,143,1,0,0,0,144,145,1,
0,0,0,145,23,1,0,0,0,146,147,7,2,0,0,147,25,1,0,0,0,148,149,5,8,0,0,149,
150,3,58,29,0,150,151,5,58,0,0,151,152,3,28,14,0,152,153,5,70,0,0,153,27,
1,0,0,0,154,157,5,59,0,0,155,157,3,58,29,0,156,154,1,0,0,0,156,155,1,0,0,
0,157,29,1,0,0,0,158,159,5,9,0,0,159,162,3,58,29,0,160,161,5,10,0,0,161,
163,5,78,0,0,162,160,1,0,0,0,162,163,1,0,0,0,163,164,1,0,0,0,164,165,5,70,
0,0,165,31,1,0,0,0,166,167,5,11,0,0,167,168,3,34,17,0,168,171,3,58,29,0,
169,170,5,10,0,0,170,172,5,78,0,0,171,169,1,0,0,0,171,172,1,0,0,0,172,173,
1,0,0,0,173,174,5,70,0,0,174,33,1,0,0,0,175,176,7,3,0,0,176,35,1,0,0,0,177,
178,5,18,0,0,178,179,3,58,29,0,179,180,5,20,0,0,180,184,3,60,30,0,181,183,
3,38,19,0,182,181,1,0,0,0,183,186,1,0,0,0,184,182,1,0,0,0,184,185,1,0,0,
0,185,187,1,0,0,0,186,184,1,0,0,0,187,191,5,25,0,0,188,190,3,40,20,0,189,
188,1,0,0,0,190,193,1,0,0,0,191,189,1,0,0,0,191,192,1,0,0,0,192,194,1,0,
0,0,193,191,1,0,0,0,194,195,5,26,0,0,195,196,5,70,0,0,196,37,1,0,0,0,197,
198,5,23,0,0,198,204,3,60,30,0,199,200,5,24,0,0,200,204,3,62,31,0,201,202,
5,1,0,0,202,204,3,60,30,0,203,197,1,0,0,0,203,199,1,0,0,0,203,201,1,0,0,
0,204,39,1,0,0,0,205,206,5,27,0,0,206,208,3,60,30,0,207,209,3,42,21,0,208,
207,1,0,0,0,208,209,1,0,0,0,209,210,1,0,0,0,210,211,5,30,0,0,211,212,3,64,
32,0,212,213,5,31,0,0,213,214,3,64,32,0,214,215,5,70,0,0,215,41,1,0,0,0,
216,217,5,28,0,0,217,221,3,54,27,0,218,219,5,29,0,0,219,221,3,52,26,0,220,
216,1,0,0,0,220,218,1,0,0,0,221,43,1,0,0,0,222,223,5,19,0,0,223,224,3,58,
29,0,224,225,5,21,0,0,225,226,3,54,27,0,226,227,5,22,0,0,227,231,3,54,27,
0,228,230,3,46,23,0,229,228,1,0,0,0,230,233,1,0,0,0,231,229,1,0,0,0,231,
232,1,0,0,0,232,234,1,0,0,0,233,231,1,0,0,0,234,238,5,25,0,0,235,237,3,48,
24,0,236,235,1,0,0,0,237,240,1,0,0,0,238,236,1,0,0,0,238,239,1,0,0,0,239,
241,1,0,0,0,240,238,1,0,0,0,241,242,5,26,0,0,242,243,5,70,0,0,243,45,1,0,
0,0,244,245,5,23,0,0,245,249,3,60,30,0,246,247,5,24,0,0,247,249,3,62,31,
0,248,244,1,0,0,0,248,246,1,0,0,0,249,47,1,0,0,0,250,251,5,32,0,0,251,252,
3,60,30,0,252,253,5,33,0,0,253,256,3,60,30,0,254,255,5,34,0,0,255,257,3,
64,32,0,256,254,1,0,0,0,256,257,1,0,0,0,257,258,1,0,0,0,258,259,5,70,0,0,
259,49,1,0,0,0,260,273,3,60,30,0,261,262,5,60,0,0,262,267,3,60,30,0,263,
264,5,69,0,0,264,266,3,60,30,0,265,263,1,0,0,0,266,269,1,0,0,0,267,265,1,
0,0,0,267,268,1,0,0,0,268,270,1,0,0,0,269,267,1,0,0,0,270,271,5,61,0,0,271,
273,1,0,0,0,272,260,1,0,0,0,272,261,1,0,0,0,273,51,1,0,0,0,274,287,3,54,
27,0,275,276,5,60,0,0,276,281,3,54,27,0,277,278,5,69,0,0,278,280,3,54,27,
0,279,277,1,0,0,0,280,283,1,0,0,0,281,279,1,0,0,0,281,282,1,0,0,0,282,284,
1,0,0,0,283,281,1,0,0,0,284,285,5,61,0,0,285,287,1,0,0,0,286,274,1,0,0,0,
286,275,1,0,0,0,287,53,1,0,0,0,288,290,3,58,29,0,289,291,3,56,28,0,290,289,
1,0,0,0,290,291,1,0,0,0,291,55,1,0,0,0,292,293,5,67,0,0,293,298,3,54,27,
0,294,295,5,69,0,0,295,297,3,54,27,0,296,294,1,0,0,0,297,300,1,0,0,0,298,
296,1,0,0,0,298,299,1,0,0,0,299,301,1,0,0,0,300,298,1,0,0,0,301,302,5,68,
0,0,302,57,1,0,0,0,303,306,3,60,30,0,304,306,5,78,0,0,305,303,1,0,0,0,305,
304,1,0,0,0,306,59,1,0,0,0,307,308,5,80,0,0,308,61,1,0,0,0,309,310,7,4,0,
0,310,63,1,0,0,0,311,314,5,80,0,0,312,314,3,66,33,0,313,311,1,0,0,0,313,
312,1,0,0,0,314,65,1,0,0,0,315,319,5,25,0,0,316,318,3,68,34,0,317,316,1,
0,0,0,318,321,1,0,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,322,1,0,0,0,321,
319,1,0,0,0,322,323,5,26,0,0,323,67,1,0,0,0,324,367,3,66,33,0,325,367,5,
60,0,0,326,367,5,61,0,0,327,367,5,62,0,0,328,367,5,63,0,0,329,367,5,64,0,
0,330,367,5,65,0,0,331,367,5,66,0,0,332,367,5,67,0,0,333,367,5,68,0,0,334,
367,5,75,0,0,335,367,5,76,0,0,336,367,5,77,0,0,337,367,5,69,0,0,338,367,
5,70,0,0,339,367,5,72,0,0,340,367,5,74,0,0,341,367,5,37,0,0,342,367,5,38,
0,0,343,367,5,39,0,0,344,367,5,40,0,0,345,367,5,41,0,0,346,367,5,42,0,0,
347,367,5,43,0,0,348,367,5,44,0,0,349,367,5,45,0,0,350,367,5,46,0,0,351,
367,5,47,0,0,352,367,5,48,0,0,353,367,5,49,0,0,354,367,5,50,0,0,355,367,
5,51,0,0,356,367,5,52,0,0,357,367,5,53,0,0,358,367,5,54,0,0,359,367,5,55,
0,0,360,367,5,56,0,0,361,367,5,35,0,0,362,367,5,36,0,0,363,367,5,79,0,0,
364,367,5,80,0,0,365,367,5,78,0,0,366,324,1,0,0,0,366,325,1,0,0,0,366,326,
1,0,0,0,366,327,1,0,0,0,366,328,1,0,0,0,366,329,1,0,0,0,366,330,1,0,0,0,
366,331,1,0,0,0,366,332,1,0,0,0,366,333,1,0,0,0,366,334,1,0,0,0,366,335,
1,0,0,0,366,336,1,0,0,0,366,337,1,0,0,0,366,338,1,0,0,0,366,339,1,0,0,0,
366,340,1,0,0,0,366,341,1,0,0,0,366,342,1,0,0,0,366,343,1,0,0,0,366,344,
1,0,0,0,366,345,1,0,0,0,366,346,1,0,0,0,366,347,1,0,0,0,366,348,1,0,0,0,
366,349,1,0,0,0,366,350,1,0,0,0,366,351,1,0,0,0,366,352,1,0,0,0,366,353,
1,0,0,0,366,354,1,0,0,0,366,355,1,0,0,0,366,356,1,0,0,0,366,357,1,0,0,0,
366,358,1,0,0,0,366,359,1,0,0,0,366,360,1,0,0,0,366,361,1,0,0,0,366,362,
1,0,0,0,366,363,1,0,0,0,366,364,1,0,0,0,366,365,1,0,0,0,367,69,1,0,0,0,31,
73,87,98,104,109,116,124,137,144,156,162,171,184,191,203,208,220,231,238,
248,256,267,272,281,286,290,298,305,313,319,366];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class PascalishRouterMapperParser extends antlr4.Parser {

    static grammarFileName = "PascalishRouterMapper.g4";
    static literalNames = [ null, "'SERVICE'", "'PROGRAM'", "'DAEMON'", 
                            "'REFRESH'", "'MS'", "'S'", "'M'", "'LIBRARY'", 
                            "'USE'", "'AS'", "'INTEROP'", "'ROLE'", "'CODE_LIBRARIAN'", 
                            "'WFL'", "'WORKFLOW'", "'COBOLISH'", "'PASCALISH'", 
                            "'ROUTER'", "'MAPPER'", "'INPUT'", "'SOURCE'", 
                            "'TARGET'", "'DESCRIPTION'", "'ENABLED'", "'BEGIN'", 
                            "'END'", "'OUTPUT'", "'TYPE'", "'TYPES'", "'WHEN'", 
                            "'TRANSFORM'", "'MAP'", "'TO'", "'USING'", "'TRUE'", 
                            "'FALSE'", "'IF'", "'THEN'", "'ELSE'", "'WHILE'", 
                            "'DO'", "'FOR'", "'CALL'", "'NOT'", "'COBEGIN'", 
                            "'COEND'", "'SUBFLOW'", "'SYNC'", "'ASYNC'", 
                            "'WAIT'", "'ON'", "'ERROR'", "'BACKOUT'", "'TRY'", 
                            "'CATCH'", "'ENDTRY'", "'VAR'", "'FROM'", "'LIBRARIAN'", 
                            "'('", "')'", "'+'", "'-'", "'*'", "'/'", "'='", 
                            "'<'", "'>'", "','", "';'", "'.'", "':='", "':'", 
                            "'||'", "'<='", "'>='", "'<>'" ];
    static symbolicNames = [ null, "SERVICE", "PROGRAM", "DAEMON", "REFRESH", 
                             "MS", "S", "M", "LIBRARY", "USE", "AS", "INTEROP", 
                             "ROLE", "CODE_LIBRARIAN", "WFL", "WORKFLOW", 
                             "COBOLISH", "PASCALISH", "ROUTER", "MAPPER", 
                             "INPUT", "SOURCE", "TARGET", "DESCRIPTION", 
                             "ENABLED", "BEGIN", "END", "OUTPUT", "TYPE", 
                             "TYPES", "WHEN", "TRANSFORM", "MAP", "TO", 
                             "USING", "TRUE", "FALSE", "IF", "THEN", "ELSE", 
                             "WHILE", "DO", "FOR", "CALL", "NOT", "COBEGIN", 
                             "COEND", "SUBFLOW", "SYNC", "ASYNC", "WAIT", 
                             "ON", "ERROR", "BACKOUT", "TRY", "CATCH", "ENDTRY", 
                             "VAR", "FROM", "LIBRARIAN", "LPAREN", "RPAREN", 
                             "PLUS", "MINUS", "MUL", "DIV", "EQ", "LT", 
                             "GT", "COMMA", "SEMICOLON", "DOT", "ASSIGN", 
                             "COLON", "CONCAT", "LE", "GE", "NEQ", "IDENT", 
                             "NUMBER", "STRING", "BRACE_COMMENT", "PAREN_COMMENT", 
                             "WS" ];
    static ruleNames = [ "program", "statement", "roleDecl", "roleName", 
                         "runtimeDecl", "blockStmt", "varDecl", "varSource", 
                         "serviceDecl", "programDecl", "daemonDecl", "daemonRefresh", 
                         "daemonRefreshUnit", "libraryDecl", "librarySource", 
                         "useDecl", "interopDecl", "interopKind", "routerDecl", 
                         "routerHeaderProp", "outputDecl", "outputTypeMeta", 
                         "mapperDecl", "mapperHeaderProp", "mapDecl", "stringList", 
                         "typeRefList", "typeRef", "genericTypeArgs", "stringOrIdent", 
                         "stringValue", "booleanValue", "pl0Snippet", "pl0Block", 
                         "pl0Element" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = PascalishRouterMapperParser.ruleNames;
        this.literalNames = PascalishRouterMapperParser.literalNames;
        this.symbolicNames = PascalishRouterMapperParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, PascalishRouterMapperParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 73;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 34347790) !== 0) || _la===57) {
	            this.state = 70;
	            this.statement();
	            this.state = 75;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 76;
	        this.match(PascalishRouterMapperParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	statement() {
	    let localctx = new StatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, PascalishRouterMapperParser.RULE_statement);
	    try {
	        this.state = 87;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	        case 2:
	        case 3:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 78;
	            this.runtimeDecl();
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 79;
	            this.roleDecl();
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 80;
	            this.varDecl();
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 81;
	            this.libraryDecl();
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 82;
	            this.useDecl();
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 83;
	            this.interopDecl();
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 84;
	            this.routerDecl();
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 85;
	            this.mapperDecl();
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 86;
	            this.blockStmt();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	roleDecl() {
	    let localctx = new RoleDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, PascalishRouterMapperParser.RULE_roleDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 89;
	        this.match(PascalishRouterMapperParser.ROLE);
	        this.state = 90;
	        this.roleName();
	        this.state = 91;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	roleName() {
	    let localctx = new RoleNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, PascalishRouterMapperParser.RULE_roleName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 93;
	        _la = this._input.LA(1);
	        if(!(_la===13 || _la===78)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	runtimeDecl() {
	    let localctx = new RuntimeDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, PascalishRouterMapperParser.RULE_runtimeDecl);
	    try {
	        this.state = 98;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 95;
	            this.serviceDecl();
	            break;
	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 96;
	            this.programDecl();
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 97;
	            this.daemonDecl();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	blockStmt() {
	    let localctx = new BlockStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, PascalishRouterMapperParser.RULE_blockStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 100;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 104;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 25)) & ~0x1f) === 0 && ((1 << (_la - 25)) & 4294966273) !== 0) || ((((_la - 60)) & ~0x1f) === 0 && ((1 << (_la - 60)) & 2086911) !== 0)) {
	            this.state = 101;
	            this.pl0Element();
	            this.state = 106;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 107;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 109;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===70 || _la===71) {
	            this.state = 108;
	            _la = this._input.LA(1);
	            if(!(_la===70 || _la===71)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	varDecl() {
	    let localctx = new VarDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, PascalishRouterMapperParser.RULE_varDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 111;
	        this.match(PascalishRouterMapperParser.VAR);
	        this.state = 112;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 113;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 114;
	        this.typeRef();
	        this.state = 116;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===58) {
	            this.state = 115;
	            this.varSource();
	        }

	        this.state = 118;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	varSource() {
	    let localctx = new VarSourceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, PascalishRouterMapperParser.RULE_varSource);
	    try {
	        this.state = 124;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,6,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 120;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 121;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 122;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 123;
	            this.stringOrIdent();
	            break;

	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	serviceDecl() {
	    let localctx = new ServiceDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, PascalishRouterMapperParser.RULE_serviceDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 126;
	        this.match(PascalishRouterMapperParser.SERVICE);
	        this.state = 127;
	        this.stringOrIdent();
	        this.state = 128;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	programDecl() {
	    let localctx = new ProgramDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, PascalishRouterMapperParser.RULE_programDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 130;
	        this.match(PascalishRouterMapperParser.PROGRAM);
	        this.state = 131;
	        this.stringOrIdent();
	        this.state = 132;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	daemonDecl() {
	    let localctx = new DaemonDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, PascalishRouterMapperParser.RULE_daemonDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 134;
	        this.match(PascalishRouterMapperParser.DAEMON);
	        this.state = 135;
	        this.stringOrIdent();
	        this.state = 137;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===4) {
	            this.state = 136;
	            this.daemonRefresh();
	        }

	        this.state = 139;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	daemonRefresh() {
	    let localctx = new DaemonRefreshContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, PascalishRouterMapperParser.RULE_daemonRefresh);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 141;
	        this.match(PascalishRouterMapperParser.REFRESH);
	        this.state = 142;
	        this.match(PascalishRouterMapperParser.NUMBER);
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 224) !== 0)) {
	            this.state = 143;
	            this.daemonRefreshUnit();
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	daemonRefreshUnit() {
	    let localctx = new DaemonRefreshUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, PascalishRouterMapperParser.RULE_daemonRefreshUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 146;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 224) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	libraryDecl() {
	    let localctx = new LibraryDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishRouterMapperParser.RULE_libraryDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 148;
	        this.match(PascalishRouterMapperParser.LIBRARY);
	        this.state = 149;
	        this.stringOrIdent();
	        this.state = 150;
	        this.match(PascalishRouterMapperParser.FROM);
	        this.state = 151;
	        this.librarySource();
	        this.state = 152;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	librarySource() {
	    let localctx = new LibrarySourceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, PascalishRouterMapperParser.RULE_librarySource);
	    try {
	        this.state = 156;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 59:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 154;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;
	        case 78:
	        case 80:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 155;
	            this.stringOrIdent();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	useDecl() {
	    let localctx = new UseDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, PascalishRouterMapperParser.RULE_useDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 158;
	        this.match(PascalishRouterMapperParser.USE);
	        this.state = 159;
	        this.stringOrIdent();
	        this.state = 162;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===10) {
	            this.state = 160;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 161;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 164;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	interopDecl() {
	    let localctx = new InteropDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, PascalishRouterMapperParser.RULE_interopDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 166;
	        this.match(PascalishRouterMapperParser.INTEROP);
	        this.state = 167;
	        this.interopKind();
	        this.state = 168;
	        this.stringOrIdent();
	        this.state = 171;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===10) {
	            this.state = 169;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 170;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 173;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	interopKind() {
	    let localctx = new InteropKindContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, PascalishRouterMapperParser.RULE_interopKind);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 175;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 245760) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	routerDecl() {
	    let localctx = new RouterDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, PascalishRouterMapperParser.RULE_routerDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 177;
	        this.match(PascalishRouterMapperParser.ROUTER);
	        this.state = 178;
	        this.stringOrIdent();
	        this.state = 179;
	        this.match(PascalishRouterMapperParser.INPUT);
	        this.state = 180;
	        this.stringValue();
	        this.state = 184;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 25165826) !== 0)) {
	            this.state = 181;
	            this.routerHeaderProp();
	            this.state = 186;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 187;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 191;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===27) {
	            this.state = 188;
	            this.outputDecl();
	            this.state = 193;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 194;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 195;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	routerHeaderProp() {
	    let localctx = new RouterHeaderPropContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, PascalishRouterMapperParser.RULE_routerHeaderProp);
	    try {
	        this.state = 203;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 23:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 197;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 198;
	            this.stringValue();
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 199;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 200;
	            this.booleanValue();
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 201;
	            this.match(PascalishRouterMapperParser.SERVICE);
	            this.state = 202;
	            this.stringValue();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	outputDecl() {
	    let localctx = new OutputDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, PascalishRouterMapperParser.RULE_outputDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 205;
	        this.match(PascalishRouterMapperParser.OUTPUT);
	        this.state = 206;
	        this.stringValue();
	        this.state = 208;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===28 || _la===29) {
	            this.state = 207;
	            this.outputTypeMeta();
	        }

	        this.state = 210;
	        this.match(PascalishRouterMapperParser.WHEN);
	        this.state = 211;
	        this.pl0Snippet();
	        this.state = 212;
	        this.match(PascalishRouterMapperParser.TRANSFORM);
	        this.state = 213;
	        this.pl0Snippet();
	        this.state = 214;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	outputTypeMeta() {
	    let localctx = new OutputTypeMetaContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, PascalishRouterMapperParser.RULE_outputTypeMeta);
	    try {
	        this.state = 220;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 28:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 216;
	            this.match(PascalishRouterMapperParser.TYPE);
	            this.state = 217;
	            this.typeRef();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 218;
	            this.match(PascalishRouterMapperParser.TYPES);
	            this.state = 219;
	            this.typeRefList();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mapperDecl() {
	    let localctx = new MapperDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, PascalishRouterMapperParser.RULE_mapperDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 222;
	        this.match(PascalishRouterMapperParser.MAPPER);
	        this.state = 223;
	        this.stringOrIdent();
	        this.state = 224;
	        this.match(PascalishRouterMapperParser.SOURCE);
	        this.state = 225;
	        this.typeRef();
	        this.state = 226;
	        this.match(PascalishRouterMapperParser.TARGET);
	        this.state = 227;
	        this.typeRef();
	        this.state = 231;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===23 || _la===24) {
	            this.state = 228;
	            this.mapperHeaderProp();
	            this.state = 233;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 234;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 238;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===32) {
	            this.state = 235;
	            this.mapDecl();
	            this.state = 240;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 241;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 242;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mapperHeaderProp() {
	    let localctx = new MapperHeaderPropContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, PascalishRouterMapperParser.RULE_mapperHeaderProp);
	    try {
	        this.state = 248;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 23:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 244;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 245;
	            this.stringValue();
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 246;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 247;
	            this.booleanValue();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mapDecl() {
	    let localctx = new MapDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, PascalishRouterMapperParser.RULE_mapDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 250;
	        this.match(PascalishRouterMapperParser.MAP);
	        this.state = 251;
	        this.stringValue();
	        this.state = 252;
	        this.match(PascalishRouterMapperParser.TO);
	        this.state = 253;
	        this.stringValue();
	        this.state = 256;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===34) {
	            this.state = 254;
	            this.match(PascalishRouterMapperParser.USING);
	            this.state = 255;
	            this.pl0Snippet();
	        }

	        this.state = 258;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	stringList() {
	    let localctx = new StringListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, PascalishRouterMapperParser.RULE_stringList);
	    var _la = 0;
	    try {
	        this.state = 272;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 80:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 260;
	            this.stringValue();
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 261;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 262;
	            this.stringValue();
	            this.state = 267;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===69) {
	                this.state = 263;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 264;
	                this.stringValue();
	                this.state = 269;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 270;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	typeRefList() {
	    let localctx = new TypeRefListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 52, PascalishRouterMapperParser.RULE_typeRefList);
	    var _la = 0;
	    try {
	        this.state = 286;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 78:
	        case 80:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 274;
	            this.typeRef();
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 275;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 276;
	            this.typeRef();
	            this.state = 281;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===69) {
	                this.state = 277;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 278;
	                this.typeRef();
	                this.state = 283;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 284;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	typeRef() {
	    let localctx = new TypeRefContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, PascalishRouterMapperParser.RULE_typeRef);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 288;
	        this.stringOrIdent();
	        this.state = 290;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===67) {
	            this.state = 289;
	            this.genericTypeArgs();
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	genericTypeArgs() {
	    let localctx = new GenericTypeArgsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, PascalishRouterMapperParser.RULE_genericTypeArgs);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 292;
	        this.match(PascalishRouterMapperParser.LT);
	        this.state = 293;
	        this.typeRef();
	        this.state = 298;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===69) {
	            this.state = 294;
	            this.match(PascalishRouterMapperParser.COMMA);
	            this.state = 295;
	            this.typeRef();
	            this.state = 300;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 301;
	        this.match(PascalishRouterMapperParser.GT);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	stringOrIdent() {
	    let localctx = new StringOrIdentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 58, PascalishRouterMapperParser.RULE_stringOrIdent);
	    try {
	        this.state = 305;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 80:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 303;
	            this.stringValue();
	            break;
	        case 78:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 304;
	            this.match(PascalishRouterMapperParser.IDENT);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	stringValue() {
	    let localctx = new StringValueContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, PascalishRouterMapperParser.RULE_stringValue);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 307;
	        this.match(PascalishRouterMapperParser.STRING);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	booleanValue() {
	    let localctx = new BooleanValueContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, PascalishRouterMapperParser.RULE_booleanValue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 309;
	        _la = this._input.LA(1);
	        if(!(_la===35 || _la===36)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	pl0Snippet() {
	    let localctx = new Pl0SnippetContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, PascalishRouterMapperParser.RULE_pl0Snippet);
	    try {
	        this.state = 313;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 80:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 311;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 312;
	            this.pl0Block();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	pl0Block() {
	    let localctx = new Pl0BlockContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, PascalishRouterMapperParser.RULE_pl0Block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 315;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 319;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 25)) & ~0x1f) === 0 && ((1 << (_la - 25)) & 4294966273) !== 0) || ((((_la - 60)) & ~0x1f) === 0 && ((1 << (_la - 60)) & 2086911) !== 0)) {
	            this.state = 316;
	            this.pl0Element();
	            this.state = 321;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 322;
	        this.match(PascalishRouterMapperParser.END);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	pl0Element() {
	    let localctx = new Pl0ElementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, PascalishRouterMapperParser.RULE_pl0Element);
	    try {
	        this.state = 366;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 25:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 324;
	            this.pl0Block();
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 325;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 326;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        case 62:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 327;
	            this.match(PascalishRouterMapperParser.PLUS);
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 328;
	            this.match(PascalishRouterMapperParser.MINUS);
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 329;
	            this.match(PascalishRouterMapperParser.MUL);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 330;
	            this.match(PascalishRouterMapperParser.DIV);
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 331;
	            this.match(PascalishRouterMapperParser.EQ);
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 332;
	            this.match(PascalishRouterMapperParser.LT);
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 333;
	            this.match(PascalishRouterMapperParser.GT);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 334;
	            this.match(PascalishRouterMapperParser.LE);
	            break;
	        case 76:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 335;
	            this.match(PascalishRouterMapperParser.GE);
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 336;
	            this.match(PascalishRouterMapperParser.NEQ);
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 337;
	            this.match(PascalishRouterMapperParser.COMMA);
	            break;
	        case 70:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 338;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 339;
	            this.match(PascalishRouterMapperParser.ASSIGN);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 340;
	            this.match(PascalishRouterMapperParser.CONCAT);
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 341;
	            this.match(PascalishRouterMapperParser.IF);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 342;
	            this.match(PascalishRouterMapperParser.THEN);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 343;
	            this.match(PascalishRouterMapperParser.ELSE);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 344;
	            this.match(PascalishRouterMapperParser.WHILE);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 345;
	            this.match(PascalishRouterMapperParser.DO);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 346;
	            this.match(PascalishRouterMapperParser.FOR);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 347;
	            this.match(PascalishRouterMapperParser.CALL);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 348;
	            this.match(PascalishRouterMapperParser.NOT);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 349;
	            this.match(PascalishRouterMapperParser.COBEGIN);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 350;
	            this.match(PascalishRouterMapperParser.COEND);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 351;
	            this.match(PascalishRouterMapperParser.SUBFLOW);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 352;
	            this.match(PascalishRouterMapperParser.SYNC);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 353;
	            this.match(PascalishRouterMapperParser.ASYNC);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 354;
	            this.match(PascalishRouterMapperParser.WAIT);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 355;
	            this.match(PascalishRouterMapperParser.ON);
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 356;
	            this.match(PascalishRouterMapperParser.ERROR);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 357;
	            this.match(PascalishRouterMapperParser.BACKOUT);
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 358;
	            this.match(PascalishRouterMapperParser.TRY);
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 359;
	            this.match(PascalishRouterMapperParser.CATCH);
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 360;
	            this.match(PascalishRouterMapperParser.ENDTRY);
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 361;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 36:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 362;
	            this.match(PascalishRouterMapperParser.FALSE);
	            break;
	        case 79:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 363;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 80:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 364;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 78:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 365;
	            this.match(PascalishRouterMapperParser.IDENT);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}


}

PascalishRouterMapperParser.EOF = antlr4.Token.EOF;
PascalishRouterMapperParser.SERVICE = 1;
PascalishRouterMapperParser.PROGRAM = 2;
PascalishRouterMapperParser.DAEMON = 3;
PascalishRouterMapperParser.REFRESH = 4;
PascalishRouterMapperParser.MS = 5;
PascalishRouterMapperParser.S = 6;
PascalishRouterMapperParser.M = 7;
PascalishRouterMapperParser.LIBRARY = 8;
PascalishRouterMapperParser.USE = 9;
PascalishRouterMapperParser.AS = 10;
PascalishRouterMapperParser.INTEROP = 11;
PascalishRouterMapperParser.ROLE = 12;
PascalishRouterMapperParser.CODE_LIBRARIAN = 13;
PascalishRouterMapperParser.WFL = 14;
PascalishRouterMapperParser.WORKFLOW = 15;
PascalishRouterMapperParser.COBOLISH = 16;
PascalishRouterMapperParser.PASCALISH = 17;
PascalishRouterMapperParser.ROUTER = 18;
PascalishRouterMapperParser.MAPPER = 19;
PascalishRouterMapperParser.INPUT = 20;
PascalishRouterMapperParser.SOURCE = 21;
PascalishRouterMapperParser.TARGET = 22;
PascalishRouterMapperParser.DESCRIPTION = 23;
PascalishRouterMapperParser.ENABLED = 24;
PascalishRouterMapperParser.BEGIN = 25;
PascalishRouterMapperParser.END = 26;
PascalishRouterMapperParser.OUTPUT = 27;
PascalishRouterMapperParser.TYPE = 28;
PascalishRouterMapperParser.TYPES = 29;
PascalishRouterMapperParser.WHEN = 30;
PascalishRouterMapperParser.TRANSFORM = 31;
PascalishRouterMapperParser.MAP = 32;
PascalishRouterMapperParser.TO = 33;
PascalishRouterMapperParser.USING = 34;
PascalishRouterMapperParser.TRUE = 35;
PascalishRouterMapperParser.FALSE = 36;
PascalishRouterMapperParser.IF = 37;
PascalishRouterMapperParser.THEN = 38;
PascalishRouterMapperParser.ELSE = 39;
PascalishRouterMapperParser.WHILE = 40;
PascalishRouterMapperParser.DO = 41;
PascalishRouterMapperParser.FOR = 42;
PascalishRouterMapperParser.CALL = 43;
PascalishRouterMapperParser.NOT = 44;
PascalishRouterMapperParser.COBEGIN = 45;
PascalishRouterMapperParser.COEND = 46;
PascalishRouterMapperParser.SUBFLOW = 47;
PascalishRouterMapperParser.SYNC = 48;
PascalishRouterMapperParser.ASYNC = 49;
PascalishRouterMapperParser.WAIT = 50;
PascalishRouterMapperParser.ON = 51;
PascalishRouterMapperParser.ERROR = 52;
PascalishRouterMapperParser.BACKOUT = 53;
PascalishRouterMapperParser.TRY = 54;
PascalishRouterMapperParser.CATCH = 55;
PascalishRouterMapperParser.ENDTRY = 56;
PascalishRouterMapperParser.VAR = 57;
PascalishRouterMapperParser.FROM = 58;
PascalishRouterMapperParser.LIBRARIAN = 59;
PascalishRouterMapperParser.LPAREN = 60;
PascalishRouterMapperParser.RPAREN = 61;
PascalishRouterMapperParser.PLUS = 62;
PascalishRouterMapperParser.MINUS = 63;
PascalishRouterMapperParser.MUL = 64;
PascalishRouterMapperParser.DIV = 65;
PascalishRouterMapperParser.EQ = 66;
PascalishRouterMapperParser.LT = 67;
PascalishRouterMapperParser.GT = 68;
PascalishRouterMapperParser.COMMA = 69;
PascalishRouterMapperParser.SEMICOLON = 70;
PascalishRouterMapperParser.DOT = 71;
PascalishRouterMapperParser.ASSIGN = 72;
PascalishRouterMapperParser.COLON = 73;
PascalishRouterMapperParser.CONCAT = 74;
PascalishRouterMapperParser.LE = 75;
PascalishRouterMapperParser.GE = 76;
PascalishRouterMapperParser.NEQ = 77;
PascalishRouterMapperParser.IDENT = 78;
PascalishRouterMapperParser.NUMBER = 79;
PascalishRouterMapperParser.STRING = 80;
PascalishRouterMapperParser.BRACE_COMMENT = 81;
PascalishRouterMapperParser.PAREN_COMMENT = 82;
PascalishRouterMapperParser.WS = 83;

PascalishRouterMapperParser.RULE_program = 0;
PascalishRouterMapperParser.RULE_statement = 1;
PascalishRouterMapperParser.RULE_roleDecl = 2;
PascalishRouterMapperParser.RULE_roleName = 3;
PascalishRouterMapperParser.RULE_runtimeDecl = 4;
PascalishRouterMapperParser.RULE_blockStmt = 5;
PascalishRouterMapperParser.RULE_varDecl = 6;
PascalishRouterMapperParser.RULE_varSource = 7;
PascalishRouterMapperParser.RULE_serviceDecl = 8;
PascalishRouterMapperParser.RULE_programDecl = 9;
PascalishRouterMapperParser.RULE_daemonDecl = 10;
PascalishRouterMapperParser.RULE_daemonRefresh = 11;
PascalishRouterMapperParser.RULE_daemonRefreshUnit = 12;
PascalishRouterMapperParser.RULE_libraryDecl = 13;
PascalishRouterMapperParser.RULE_librarySource = 14;
PascalishRouterMapperParser.RULE_useDecl = 15;
PascalishRouterMapperParser.RULE_interopDecl = 16;
PascalishRouterMapperParser.RULE_interopKind = 17;
PascalishRouterMapperParser.RULE_routerDecl = 18;
PascalishRouterMapperParser.RULE_routerHeaderProp = 19;
PascalishRouterMapperParser.RULE_outputDecl = 20;
PascalishRouterMapperParser.RULE_outputTypeMeta = 21;
PascalishRouterMapperParser.RULE_mapperDecl = 22;
PascalishRouterMapperParser.RULE_mapperHeaderProp = 23;
PascalishRouterMapperParser.RULE_mapDecl = 24;
PascalishRouterMapperParser.RULE_stringList = 25;
PascalishRouterMapperParser.RULE_typeRefList = 26;
PascalishRouterMapperParser.RULE_typeRef = 27;
PascalishRouterMapperParser.RULE_genericTypeArgs = 28;
PascalishRouterMapperParser.RULE_stringOrIdent = 29;
PascalishRouterMapperParser.RULE_stringValue = 30;
PascalishRouterMapperParser.RULE_booleanValue = 31;
PascalishRouterMapperParser.RULE_pl0Snippet = 32;
PascalishRouterMapperParser.RULE_pl0Block = 33;
PascalishRouterMapperParser.RULE_pl0Element = 34;

class ProgramContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_program;
    }

	EOF() {
	    return this.getToken(PascalishRouterMapperParser.EOF, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitProgram(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_statement;
    }

	runtimeDecl() {
	    return this.getTypedRuleContext(RuntimeDeclContext,0);
	};

	roleDecl() {
	    return this.getTypedRuleContext(RoleDeclContext,0);
	};

	varDecl() {
	    return this.getTypedRuleContext(VarDeclContext,0);
	};

	libraryDecl() {
	    return this.getTypedRuleContext(LibraryDeclContext,0);
	};

	useDecl() {
	    return this.getTypedRuleContext(UseDeclContext,0);
	};

	interopDecl() {
	    return this.getTypedRuleContext(InteropDeclContext,0);
	};

	routerDecl() {
	    return this.getTypedRuleContext(RouterDeclContext,0);
	};

	mapperDecl() {
	    return this.getTypedRuleContext(MapperDeclContext,0);
	};

	blockStmt() {
	    return this.getTypedRuleContext(BlockStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RoleDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_roleDecl;
    }

	ROLE() {
	    return this.getToken(PascalishRouterMapperParser.ROLE, 0);
	};

	roleName() {
	    return this.getTypedRuleContext(RoleNameContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRoleDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RoleNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_roleName;
    }

	CODE_LIBRARIAN() {
	    return this.getToken(PascalishRouterMapperParser.CODE_LIBRARIAN, 0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRoleName(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RuntimeDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_runtimeDecl;
    }

	serviceDecl() {
	    return this.getTypedRuleContext(ServiceDeclContext,0);
	};

	programDecl() {
	    return this.getTypedRuleContext(ProgramDeclContext,0);
	};

	daemonDecl() {
	    return this.getTypedRuleContext(DaemonDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRuntimeDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BlockStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_blockStmt;
    }

	BEGIN() {
	    return this.getToken(PascalishRouterMapperParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	pl0Element = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Pl0ElementContext);
	    } else {
	        return this.getTypedRuleContext(Pl0ElementContext,i);
	    }
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	DOT() {
	    return this.getToken(PascalishRouterMapperParser.DOT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitBlockStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VarDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_varDecl;
    }

	VAR() {
	    return this.getToken(PascalishRouterMapperParser.VAR, 0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	COLON() {
	    return this.getToken(PascalishRouterMapperParser.COLON, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	varSource() {
	    return this.getTypedRuleContext(VarSourceContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitVarDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VarSourceContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_varSource;
    }

	FROM() {
	    return this.getToken(PascalishRouterMapperParser.FROM, 0);
	};

	LIBRARIAN() {
	    return this.getToken(PascalishRouterMapperParser.LIBRARIAN, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitVarSource(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceDecl;
    }

	SERVICE() {
	    return this.getToken(PascalishRouterMapperParser.SERVICE, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ProgramDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_programDecl;
    }

	PROGRAM() {
	    return this.getToken(PascalishRouterMapperParser.PROGRAM, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitProgramDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DaemonDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_daemonDecl;
    }

	DAEMON() {
	    return this.getToken(PascalishRouterMapperParser.DAEMON, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	daemonRefresh() {
	    return this.getTypedRuleContext(DaemonRefreshContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitDaemonDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DaemonRefreshContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_daemonRefresh;
    }

	REFRESH() {
	    return this.getToken(PascalishRouterMapperParser.REFRESH, 0);
	};

	NUMBER() {
	    return this.getToken(PascalishRouterMapperParser.NUMBER, 0);
	};

	daemonRefreshUnit() {
	    return this.getTypedRuleContext(DaemonRefreshUnitContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitDaemonRefresh(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DaemonRefreshUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_daemonRefreshUnit;
    }

	MS() {
	    return this.getToken(PascalishRouterMapperParser.MS, 0);
	};

	S() {
	    return this.getToken(PascalishRouterMapperParser.S, 0);
	};

	M() {
	    return this.getToken(PascalishRouterMapperParser.M, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitDaemonRefreshUnit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LibraryDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_libraryDecl;
    }

	LIBRARY() {
	    return this.getToken(PascalishRouterMapperParser.LIBRARY, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	FROM() {
	    return this.getToken(PascalishRouterMapperParser.FROM, 0);
	};

	librarySource() {
	    return this.getTypedRuleContext(LibrarySourceContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitLibraryDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LibrarySourceContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_librarySource;
    }

	LIBRARIAN() {
	    return this.getToken(PascalishRouterMapperParser.LIBRARIAN, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitLibrarySource(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UseDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_useDecl;
    }

	USE() {
	    return this.getToken(PascalishRouterMapperParser.USE, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	AS() {
	    return this.getToken(PascalishRouterMapperParser.AS, 0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitUseDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class InteropDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_interopDecl;
    }

	INTEROP() {
	    return this.getToken(PascalishRouterMapperParser.INTEROP, 0);
	};

	interopKind() {
	    return this.getTypedRuleContext(InteropKindContext,0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	AS() {
	    return this.getToken(PascalishRouterMapperParser.AS, 0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitInteropDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class InteropKindContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_interopKind;
    }

	WFL() {
	    return this.getToken(PascalishRouterMapperParser.WFL, 0);
	};

	WORKFLOW() {
	    return this.getToken(PascalishRouterMapperParser.WORKFLOW, 0);
	};

	COBOLISH() {
	    return this.getToken(PascalishRouterMapperParser.COBOLISH, 0);
	};

	PASCALISH() {
	    return this.getToken(PascalishRouterMapperParser.PASCALISH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitInteropKind(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RouterDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_routerDecl;
    }

	ROUTER() {
	    return this.getToken(PascalishRouterMapperParser.ROUTER, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	INPUT() {
	    return this.getToken(PascalishRouterMapperParser.INPUT, 0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	BEGIN() {
	    return this.getToken(PascalishRouterMapperParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	routerHeaderProp = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RouterHeaderPropContext);
	    } else {
	        return this.getTypedRuleContext(RouterHeaderPropContext,i);
	    }
	};

	outputDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(OutputDeclContext);
	    } else {
	        return this.getTypedRuleContext(OutputDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRouterDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RouterHeaderPropContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_routerHeaderProp;
    }

	DESCRIPTION() {
	    return this.getToken(PascalishRouterMapperParser.DESCRIPTION, 0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	ENABLED() {
	    return this.getToken(PascalishRouterMapperParser.ENABLED, 0);
	};

	booleanValue() {
	    return this.getTypedRuleContext(BooleanValueContext,0);
	};

	SERVICE() {
	    return this.getToken(PascalishRouterMapperParser.SERVICE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRouterHeaderProp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class OutputDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_outputDecl;
    }

	OUTPUT() {
	    return this.getToken(PascalishRouterMapperParser.OUTPUT, 0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	WHEN() {
	    return this.getToken(PascalishRouterMapperParser.WHEN, 0);
	};

	pl0Snippet = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Pl0SnippetContext);
	    } else {
	        return this.getTypedRuleContext(Pl0SnippetContext,i);
	    }
	};

	TRANSFORM() {
	    return this.getToken(PascalishRouterMapperParser.TRANSFORM, 0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	outputTypeMeta() {
	    return this.getTypedRuleContext(OutputTypeMetaContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitOutputDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class OutputTypeMetaContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_outputTypeMeta;
    }

	TYPE() {
	    return this.getToken(PascalishRouterMapperParser.TYPE, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	TYPES() {
	    return this.getToken(PascalishRouterMapperParser.TYPES, 0);
	};

	typeRefList() {
	    return this.getTypedRuleContext(TypeRefListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitOutputTypeMeta(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapperDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_mapperDecl;
    }

	MAPPER() {
	    return this.getToken(PascalishRouterMapperParser.MAPPER, 0);
	};

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	SOURCE() {
	    return this.getToken(PascalishRouterMapperParser.SOURCE, 0);
	};

	typeRef = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeRefContext);
	    } else {
	        return this.getTypedRuleContext(TypeRefContext,i);
	    }
	};

	TARGET() {
	    return this.getToken(PascalishRouterMapperParser.TARGET, 0);
	};

	BEGIN() {
	    return this.getToken(PascalishRouterMapperParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	mapperHeaderProp = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MapperHeaderPropContext);
	    } else {
	        return this.getTypedRuleContext(MapperHeaderPropContext,i);
	    }
	};

	mapDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MapDeclContext);
	    } else {
	        return this.getTypedRuleContext(MapDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitMapperDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapperHeaderPropContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_mapperHeaderProp;
    }

	DESCRIPTION() {
	    return this.getToken(PascalishRouterMapperParser.DESCRIPTION, 0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	ENABLED() {
	    return this.getToken(PascalishRouterMapperParser.ENABLED, 0);
	};

	booleanValue() {
	    return this.getTypedRuleContext(BooleanValueContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitMapperHeaderProp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_mapDecl;
    }

	MAP() {
	    return this.getToken(PascalishRouterMapperParser.MAP, 0);
	};

	stringValue = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StringValueContext);
	    } else {
	        return this.getTypedRuleContext(StringValueContext,i);
	    }
	};

	TO() {
	    return this.getToken(PascalishRouterMapperParser.TO, 0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	USING() {
	    return this.getToken(PascalishRouterMapperParser.USING, 0);
	};

	pl0Snippet() {
	    return this.getTypedRuleContext(Pl0SnippetContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitMapDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StringListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_stringList;
    }

	stringValue = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StringValueContext);
	    } else {
	        return this.getTypedRuleContext(StringValueContext,i);
	    }
	};

	LPAREN() {
	    return this.getToken(PascalishRouterMapperParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(PascalishRouterMapperParser.RPAREN, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.COMMA);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitStringList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeRefListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_typeRefList;
    }

	typeRef = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeRefContext);
	    } else {
	        return this.getTypedRuleContext(TypeRefContext,i);
	    }
	};

	LPAREN() {
	    return this.getToken(PascalishRouterMapperParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(PascalishRouterMapperParser.RPAREN, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.COMMA);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitTypeRefList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeRefContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_typeRef;
    }

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
	};

	genericTypeArgs() {
	    return this.getTypedRuleContext(GenericTypeArgsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitTypeRef(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class GenericTypeArgsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_genericTypeArgs;
    }

	LT() {
	    return this.getToken(PascalishRouterMapperParser.LT, 0);
	};

	typeRef = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeRefContext);
	    } else {
	        return this.getTypedRuleContext(TypeRefContext,i);
	    }
	};

	GT() {
	    return this.getToken(PascalishRouterMapperParser.GT, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.COMMA);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitGenericTypeArgs(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StringOrIdentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_stringOrIdent;
    }

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitStringOrIdent(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StringValueContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_stringValue;
    }

	STRING() {
	    return this.getToken(PascalishRouterMapperParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitStringValue(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BooleanValueContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_booleanValue;
    }

	TRUE() {
	    return this.getToken(PascalishRouterMapperParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(PascalishRouterMapperParser.FALSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitBooleanValue(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class Pl0SnippetContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_pl0Snippet;
    }

	STRING() {
	    return this.getToken(PascalishRouterMapperParser.STRING, 0);
	};

	pl0Block() {
	    return this.getTypedRuleContext(Pl0BlockContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitPl0Snippet(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class Pl0BlockContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_pl0Block;
    }

	BEGIN() {
	    return this.getToken(PascalishRouterMapperParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	pl0Element = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Pl0ElementContext);
	    } else {
	        return this.getTypedRuleContext(Pl0ElementContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitPl0Block(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class Pl0ElementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_pl0Element;
    }

	pl0Block() {
	    return this.getTypedRuleContext(Pl0BlockContext,0);
	};

	LPAREN() {
	    return this.getToken(PascalishRouterMapperParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(PascalishRouterMapperParser.RPAREN, 0);
	};

	PLUS() {
	    return this.getToken(PascalishRouterMapperParser.PLUS, 0);
	};

	MINUS() {
	    return this.getToken(PascalishRouterMapperParser.MINUS, 0);
	};

	MUL() {
	    return this.getToken(PascalishRouterMapperParser.MUL, 0);
	};

	DIV() {
	    return this.getToken(PascalishRouterMapperParser.DIV, 0);
	};

	EQ() {
	    return this.getToken(PascalishRouterMapperParser.EQ, 0);
	};

	LT() {
	    return this.getToken(PascalishRouterMapperParser.LT, 0);
	};

	GT() {
	    return this.getToken(PascalishRouterMapperParser.GT, 0);
	};

	LE() {
	    return this.getToken(PascalishRouterMapperParser.LE, 0);
	};

	GE() {
	    return this.getToken(PascalishRouterMapperParser.GE, 0);
	};

	NEQ() {
	    return this.getToken(PascalishRouterMapperParser.NEQ, 0);
	};

	COMMA() {
	    return this.getToken(PascalishRouterMapperParser.COMMA, 0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	ASSIGN() {
	    return this.getToken(PascalishRouterMapperParser.ASSIGN, 0);
	};

	CONCAT() {
	    return this.getToken(PascalishRouterMapperParser.CONCAT, 0);
	};

	IF() {
	    return this.getToken(PascalishRouterMapperParser.IF, 0);
	};

	THEN() {
	    return this.getToken(PascalishRouterMapperParser.THEN, 0);
	};

	ELSE() {
	    return this.getToken(PascalishRouterMapperParser.ELSE, 0);
	};

	WHILE() {
	    return this.getToken(PascalishRouterMapperParser.WHILE, 0);
	};

	DO() {
	    return this.getToken(PascalishRouterMapperParser.DO, 0);
	};

	FOR() {
	    return this.getToken(PascalishRouterMapperParser.FOR, 0);
	};

	CALL() {
	    return this.getToken(PascalishRouterMapperParser.CALL, 0);
	};

	NOT() {
	    return this.getToken(PascalishRouterMapperParser.NOT, 0);
	};

	COBEGIN() {
	    return this.getToken(PascalishRouterMapperParser.COBEGIN, 0);
	};

	COEND() {
	    return this.getToken(PascalishRouterMapperParser.COEND, 0);
	};

	SUBFLOW() {
	    return this.getToken(PascalishRouterMapperParser.SUBFLOW, 0);
	};

	SYNC() {
	    return this.getToken(PascalishRouterMapperParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(PascalishRouterMapperParser.ASYNC, 0);
	};

	WAIT() {
	    return this.getToken(PascalishRouterMapperParser.WAIT, 0);
	};

	ON() {
	    return this.getToken(PascalishRouterMapperParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(PascalishRouterMapperParser.ERROR, 0);
	};

	BACKOUT() {
	    return this.getToken(PascalishRouterMapperParser.BACKOUT, 0);
	};

	TRY() {
	    return this.getToken(PascalishRouterMapperParser.TRY, 0);
	};

	CATCH() {
	    return this.getToken(PascalishRouterMapperParser.CATCH, 0);
	};

	ENDTRY() {
	    return this.getToken(PascalishRouterMapperParser.ENDTRY, 0);
	};

	TRUE() {
	    return this.getToken(PascalishRouterMapperParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(PascalishRouterMapperParser.FALSE, 0);
	};

	NUMBER() {
	    return this.getToken(PascalishRouterMapperParser.NUMBER, 0);
	};

	STRING() {
	    return this.getToken(PascalishRouterMapperParser.STRING, 0);
	};

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitPl0Element(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




PascalishRouterMapperParser.ProgramContext = ProgramContext; 
PascalishRouterMapperParser.StatementContext = StatementContext; 
PascalishRouterMapperParser.RoleDeclContext = RoleDeclContext; 
PascalishRouterMapperParser.RoleNameContext = RoleNameContext; 
PascalishRouterMapperParser.RuntimeDeclContext = RuntimeDeclContext; 
PascalishRouterMapperParser.BlockStmtContext = BlockStmtContext; 
PascalishRouterMapperParser.VarDeclContext = VarDeclContext; 
PascalishRouterMapperParser.VarSourceContext = VarSourceContext; 
PascalishRouterMapperParser.ServiceDeclContext = ServiceDeclContext; 
PascalishRouterMapperParser.ProgramDeclContext = ProgramDeclContext; 
PascalishRouterMapperParser.DaemonDeclContext = DaemonDeclContext; 
PascalishRouterMapperParser.DaemonRefreshContext = DaemonRefreshContext; 
PascalishRouterMapperParser.DaemonRefreshUnitContext = DaemonRefreshUnitContext; 
PascalishRouterMapperParser.LibraryDeclContext = LibraryDeclContext; 
PascalishRouterMapperParser.LibrarySourceContext = LibrarySourceContext; 
PascalishRouterMapperParser.UseDeclContext = UseDeclContext; 
PascalishRouterMapperParser.InteropDeclContext = InteropDeclContext; 
PascalishRouterMapperParser.InteropKindContext = InteropKindContext; 
PascalishRouterMapperParser.RouterDeclContext = RouterDeclContext; 
PascalishRouterMapperParser.RouterHeaderPropContext = RouterHeaderPropContext; 
PascalishRouterMapperParser.OutputDeclContext = OutputDeclContext; 
PascalishRouterMapperParser.OutputTypeMetaContext = OutputTypeMetaContext; 
PascalishRouterMapperParser.MapperDeclContext = MapperDeclContext; 
PascalishRouterMapperParser.MapperHeaderPropContext = MapperHeaderPropContext; 
PascalishRouterMapperParser.MapDeclContext = MapDeclContext; 
PascalishRouterMapperParser.StringListContext = StringListContext; 
PascalishRouterMapperParser.TypeRefListContext = TypeRefListContext; 
PascalishRouterMapperParser.TypeRefContext = TypeRefContext; 
PascalishRouterMapperParser.GenericTypeArgsContext = GenericTypeArgsContext; 
PascalishRouterMapperParser.StringOrIdentContext = StringOrIdentContext; 
PascalishRouterMapperParser.StringValueContext = StringValueContext; 
PascalishRouterMapperParser.BooleanValueContext = BooleanValueContext; 
PascalishRouterMapperParser.Pl0SnippetContext = Pl0SnippetContext; 
PascalishRouterMapperParser.Pl0BlockContext = Pl0BlockContext; 
PascalishRouterMapperParser.Pl0ElementContext = Pl0ElementContext; 
