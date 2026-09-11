// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Vbish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import VbishVisitor from './VbishVisitor.js';

const serializedATN = [4,1,81,426,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
1,0,3,0,86,8,0,1,0,3,0,89,8,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,98,8,0,10,
0,12,0,101,9,0,1,0,1,0,1,1,1,1,1,1,1,2,3,2,109,8,2,1,2,1,2,1,2,1,2,3,2,115,
8,2,1,2,1,2,1,2,3,2,120,8,2,1,3,1,3,1,4,1,4,1,5,1,5,1,5,1,5,1,5,3,5,131,
8,5,1,6,1,6,1,7,1,7,1,7,3,7,138,8,7,1,8,1,8,1,8,1,9,1,9,1,10,1,10,1,10,1,
10,3,10,149,8,10,1,11,1,11,1,11,3,11,154,8,11,1,12,1,12,1,12,1,12,3,12,160,
8,12,1,13,1,13,1,13,1,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,
14,1,15,1,15,1,15,1,15,3,15,180,8,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,
1,15,1,15,1,15,1,15,1,15,1,15,3,15,195,8,15,1,16,1,16,1,16,3,16,200,8,16,
1,16,5,16,203,8,16,10,16,12,16,206,9,16,1,16,1,16,1,16,1,17,1,17,1,17,3,
17,214,8,17,1,17,1,17,3,17,218,8,17,1,17,5,17,221,8,17,10,17,12,17,224,9,
17,1,17,1,17,1,17,1,18,1,18,1,18,1,18,5,18,233,8,18,10,18,12,18,236,9,18,
3,18,238,8,18,1,18,1,18,1,19,1,19,1,19,3,19,245,8,19,1,20,1,20,1,20,1,20,
1,20,1,20,1,20,1,20,3,20,255,8,20,1,21,1,21,1,21,1,21,5,21,261,8,21,10,21,
12,21,264,9,21,1,21,1,21,5,21,268,8,21,10,21,12,21,271,9,21,3,21,273,8,21,
1,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,3,22,286,8,22,1,22,
5,22,289,8,22,10,22,12,22,292,9,22,1,22,1,22,1,22,1,22,3,22,298,8,22,3,22,
300,8,22,1,23,1,23,1,23,5,23,305,8,23,10,23,12,23,308,9,23,1,23,1,23,1,23,
1,24,1,24,1,24,1,24,5,24,317,8,24,10,24,12,24,320,9,24,3,24,322,8,24,1,25,
1,25,1,25,1,25,1,26,1,26,3,26,330,8,26,1,27,1,27,3,27,334,8,27,1,28,1,28,
1,29,1,29,1,29,5,29,341,8,29,10,29,12,29,344,9,29,1,30,1,30,1,30,5,30,349,
8,30,10,30,12,30,352,9,30,1,31,1,31,1,31,5,31,357,8,31,10,31,12,31,360,9,
31,1,32,1,32,1,32,5,32,365,8,32,10,32,12,32,368,9,32,1,33,1,33,1,33,5,33,
373,8,33,10,33,12,33,376,9,33,1,33,1,33,1,33,5,33,381,8,33,10,33,12,33,384,
9,33,3,33,386,8,33,1,34,1,34,1,34,5,34,391,8,34,10,34,12,34,394,9,34,1,35,
1,35,1,35,1,35,1,35,1,35,3,35,402,8,35,1,35,1,35,1,35,1,35,3,35,408,8,35,
1,36,1,36,1,36,1,37,1,37,1,37,1,38,1,38,1,38,1,39,1,39,1,39,1,40,1,40,1,
41,1,41,1,41,0,0,42,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,
38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,0,16,
1,0,2,4,1,0,7,11,1,0,12,16,1,0,18,22,2,0,24,24,79,79,2,0,28,28,31,31,1,0,
49,50,2,0,52,52,54,54,2,0,51,51,53,53,1,0,71,72,1,0,73,76,1,0,67,68,1,0,
69,70,1,0,71,76,2,0,56,59,79,79,1,0,78,79,448,0,85,1,0,0,0,2,104,1,0,0,0,
4,108,1,0,0,0,6,121,1,0,0,0,8,123,1,0,0,0,10,125,1,0,0,0,12,132,1,0,0,0,
14,137,1,0,0,0,16,139,1,0,0,0,18,142,1,0,0,0,20,144,1,0,0,0,22,153,1,0,0,
0,24,155,1,0,0,0,26,161,1,0,0,0,28,167,1,0,0,0,30,175,1,0,0,0,32,196,1,0,
0,0,34,210,1,0,0,0,36,228,1,0,0,0,38,241,1,0,0,0,40,254,1,0,0,0,42,256,1,
0,0,0,44,277,1,0,0,0,46,301,1,0,0,0,48,312,1,0,0,0,50,323,1,0,0,0,52,327,
1,0,0,0,54,331,1,0,0,0,56,335,1,0,0,0,58,337,1,0,0,0,60,345,1,0,0,0,62,353,
1,0,0,0,64,361,1,0,0,0,66,385,1,0,0,0,68,387,1,0,0,0,70,407,1,0,0,0,72,409,
1,0,0,0,74,412,1,0,0,0,76,415,1,0,0,0,78,418,1,0,0,0,80,421,1,0,0,0,82,423,
1,0,0,0,84,86,3,2,1,0,85,84,1,0,0,0,85,86,1,0,0,0,86,88,1,0,0,0,87,89,3,
4,2,0,88,87,1,0,0,0,88,89,1,0,0,0,89,99,1,0,0,0,90,98,3,10,5,0,91,98,3,16,
8,0,92,98,3,20,10,0,93,98,3,24,12,0,94,98,3,26,13,0,95,98,3,28,14,0,96,98,
3,14,7,0,97,90,1,0,0,0,97,91,1,0,0,0,97,92,1,0,0,0,97,93,1,0,0,0,97,94,1,
0,0,0,97,95,1,0,0,0,97,96,1,0,0,0,98,101,1,0,0,0,99,97,1,0,0,0,99,100,1,
0,0,0,100,102,1,0,0,0,101,99,1,0,0,0,102,103,5,0,0,1,103,1,1,0,0,0,104,105,
5,34,0,0,105,106,5,35,0,0,106,3,1,0,0,0,107,109,5,1,0,0,108,107,1,0,0,0,
108,109,1,0,0,0,109,110,1,0,0,0,110,111,7,0,0,0,111,114,3,82,41,0,112,113,
5,5,0,0,113,115,3,6,3,0,114,112,1,0,0,0,114,115,1,0,0,0,115,119,1,0,0,0,
116,117,5,6,0,0,117,118,5,77,0,0,118,120,3,8,4,0,119,116,1,0,0,0,119,120,
1,0,0,0,120,5,1,0,0,0,121,122,7,1,0,0,122,7,1,0,0,0,123,124,7,2,0,0,124,
9,1,0,0,0,125,126,5,17,0,0,126,127,3,12,6,0,127,130,5,78,0,0,128,129,5,33,
0,0,129,131,5,79,0,0,130,128,1,0,0,0,130,131,1,0,0,0,131,11,1,0,0,0,132,
133,7,3,0,0,133,13,1,0,0,0,134,138,3,30,15,0,135,138,3,32,16,0,136,138,3,
34,17,0,137,134,1,0,0,0,137,135,1,0,0,0,137,136,1,0,0,0,138,15,1,0,0,0,139,
140,5,23,0,0,140,141,3,18,9,0,141,17,1,0,0,0,142,143,7,4,0,0,143,19,1,0,
0,0,144,145,5,25,0,0,145,148,3,82,41,0,146,147,5,32,0,0,147,149,3,22,11,
0,148,146,1,0,0,0,148,149,1,0,0,0,149,21,1,0,0,0,150,154,5,31,0,0,151,154,
5,28,0,0,152,154,3,82,41,0,153,150,1,0,0,0,153,151,1,0,0,0,153,152,1,0,0,
0,154,23,1,0,0,0,155,156,5,26,0,0,156,159,3,82,41,0,157,158,5,33,0,0,158,
160,5,79,0,0,159,157,1,0,0,0,159,160,1,0,0,0,160,25,1,0,0,0,161,162,5,27,
0,0,162,163,5,28,0,0,163,164,3,82,41,0,164,165,5,32,0,0,165,166,3,22,11,
0,166,27,1,0,0,0,167,168,5,29,0,0,168,169,3,82,41,0,169,170,5,45,0,0,170,
171,3,82,41,0,171,172,5,30,0,0,172,173,5,28,0,0,173,174,3,82,41,0,174,29,
1,0,0,0,175,176,5,36,0,0,176,179,5,79,0,0,177,178,5,33,0,0,178,180,3,80,
40,0,179,177,1,0,0,0,179,180,1,0,0,0,180,194,1,0,0,0,181,182,5,32,0,0,182,
195,7,5,0,0,183,184,5,62,0,0,184,195,3,56,28,0,185,186,5,32,0,0,186,187,
7,5,0,0,187,188,5,62,0,0,188,195,3,56,28,0,189,190,5,62,0,0,190,191,3,56,
28,0,191,192,5,32,0,0,192,193,7,5,0,0,193,195,1,0,0,0,194,181,1,0,0,0,194,
183,1,0,0,0,194,185,1,0,0,0,194,189,1,0,0,0,194,195,1,0,0,0,195,31,1,0,0,
0,196,197,5,37,0,0,197,199,5,79,0,0,198,200,3,36,18,0,199,198,1,0,0,0,199,
200,1,0,0,0,200,204,1,0,0,0,201,203,3,40,20,0,202,201,1,0,0,0,203,206,1,
0,0,0,204,202,1,0,0,0,204,205,1,0,0,0,205,207,1,0,0,0,206,204,1,0,0,0,207,
208,5,39,0,0,208,209,5,37,0,0,209,33,1,0,0,0,210,211,5,38,0,0,211,213,5,
79,0,0,212,214,3,36,18,0,213,212,1,0,0,0,213,214,1,0,0,0,214,217,1,0,0,0,
215,216,5,33,0,0,216,218,3,80,40,0,217,215,1,0,0,0,217,218,1,0,0,0,218,222,
1,0,0,0,219,221,3,40,20,0,220,219,1,0,0,0,221,224,1,0,0,0,222,220,1,0,0,
0,222,223,1,0,0,0,223,225,1,0,0,0,224,222,1,0,0,0,225,226,5,39,0,0,226,227,
5,38,0,0,227,35,1,0,0,0,228,237,5,63,0,0,229,234,3,38,19,0,230,231,5,65,
0,0,231,233,3,38,19,0,232,230,1,0,0,0,233,236,1,0,0,0,234,232,1,0,0,0,234,
235,1,0,0,0,235,238,1,0,0,0,236,234,1,0,0,0,237,229,1,0,0,0,237,238,1,0,
0,0,238,239,1,0,0,0,239,240,5,64,0,0,240,37,1,0,0,0,241,244,3,56,28,0,242,
243,5,33,0,0,243,245,3,80,40,0,244,242,1,0,0,0,244,245,1,0,0,0,245,39,1,
0,0,0,246,255,3,30,15,0,247,255,3,42,21,0,248,255,3,44,22,0,249,255,3,46,
23,0,250,255,3,48,24,0,251,255,3,50,25,0,252,255,3,52,26,0,253,255,3,54,
27,0,254,246,1,0,0,0,254,247,1,0,0,0,254,248,1,0,0,0,254,249,1,0,0,0,254,
250,1,0,0,0,254,251,1,0,0,0,254,252,1,0,0,0,254,253,1,0,0,0,255,41,1,0,0,
0,256,257,5,41,0,0,257,258,3,56,28,0,258,262,5,42,0,0,259,261,3,40,20,0,
260,259,1,0,0,0,261,264,1,0,0,0,262,260,1,0,0,0,262,263,1,0,0,0,263,272,
1,0,0,0,264,262,1,0,0,0,265,269,5,43,0,0,266,268,3,40,20,0,267,266,1,0,0,
0,268,271,1,0,0,0,269,267,1,0,0,0,269,270,1,0,0,0,270,273,1,0,0,0,271,269,
1,0,0,0,272,265,1,0,0,0,272,273,1,0,0,0,273,274,1,0,0,0,274,275,5,39,0,0,
275,276,5,41,0,0,276,43,1,0,0,0,277,278,5,44,0,0,278,279,5,79,0,0,279,280,
5,62,0,0,280,281,3,56,28,0,281,282,5,45,0,0,282,285,3,56,28,0,283,284,5,
46,0,0,284,286,3,56,28,0,285,283,1,0,0,0,285,286,1,0,0,0,286,290,1,0,0,0,
287,289,3,40,20,0,288,287,1,0,0,0,289,292,1,0,0,0,290,288,1,0,0,0,290,291,
1,0,0,0,291,299,1,0,0,0,292,290,1,0,0,0,293,294,5,39,0,0,294,300,5,44,0,
0,295,297,5,47,0,0,296,298,5,79,0,0,297,296,1,0,0,0,297,298,1,0,0,0,298,
300,1,0,0,0,299,293,1,0,0,0,299,295,1,0,0,0,300,45,1,0,0,0,301,302,5,48,
0,0,302,306,3,56,28,0,303,305,3,40,20,0,304,303,1,0,0,0,305,308,1,0,0,0,
306,304,1,0,0,0,306,307,1,0,0,0,307,309,1,0,0,0,308,306,1,0,0,0,309,310,
5,39,0,0,310,311,5,48,0,0,311,47,1,0,0,0,312,321,7,6,0,0,313,318,3,56,28,
0,314,315,5,65,0,0,315,317,3,56,28,0,316,314,1,0,0,0,317,320,1,0,0,0,318,
316,1,0,0,0,318,319,1,0,0,0,319,322,1,0,0,0,320,318,1,0,0,0,321,313,1,0,
0,0,321,322,1,0,0,0,322,49,1,0,0,0,323,324,5,79,0,0,324,325,5,62,0,0,325,
326,3,56,28,0,326,51,1,0,0,0,327,329,5,79,0,0,328,330,3,36,18,0,329,328,
1,0,0,0,329,330,1,0,0,0,330,53,1,0,0,0,331,333,5,40,0,0,332,334,3,56,28,
0,333,332,1,0,0,0,333,334,1,0,0,0,334,55,1,0,0,0,335,336,3,58,29,0,336,57,
1,0,0,0,337,342,3,60,30,0,338,339,7,7,0,0,339,341,3,60,30,0,340,338,1,0,
0,0,341,344,1,0,0,0,342,340,1,0,0,0,342,343,1,0,0,0,343,59,1,0,0,0,344,342,
1,0,0,0,345,350,3,62,31,0,346,347,7,8,0,0,347,349,3,62,31,0,348,346,1,0,
0,0,349,352,1,0,0,0,350,348,1,0,0,0,350,351,1,0,0,0,351,61,1,0,0,0,352,350,
1,0,0,0,353,358,3,64,32,0,354,355,7,9,0,0,355,357,3,64,32,0,356,354,1,0,
0,0,357,360,1,0,0,0,358,356,1,0,0,0,358,359,1,0,0,0,359,63,1,0,0,0,360,358,
1,0,0,0,361,366,3,66,33,0,362,363,7,10,0,0,363,365,3,66,33,0,364,362,1,0,
0,0,365,368,1,0,0,0,366,364,1,0,0,0,366,367,1,0,0,0,367,65,1,0,0,0,368,366,
1,0,0,0,369,374,3,68,34,0,370,371,7,11,0,0,371,373,3,68,34,0,372,370,1,0,
0,0,373,376,1,0,0,0,374,372,1,0,0,0,374,375,1,0,0,0,375,386,1,0,0,0,376,
374,1,0,0,0,377,382,3,68,34,0,378,379,5,66,0,0,379,381,3,68,34,0,380,378,
1,0,0,0,381,384,1,0,0,0,382,380,1,0,0,0,382,383,1,0,0,0,383,386,1,0,0,0,
384,382,1,0,0,0,385,369,1,0,0,0,385,377,1,0,0,0,386,67,1,0,0,0,387,392,3,
70,35,0,388,389,7,12,0,0,389,391,3,70,35,0,390,388,1,0,0,0,391,394,1,0,0,
0,392,390,1,0,0,0,392,393,1,0,0,0,393,69,1,0,0,0,394,392,1,0,0,0,395,408,
5,78,0,0,396,408,5,77,0,0,397,408,5,60,0,0,398,408,5,61,0,0,399,401,5,79,
0,0,400,402,3,36,18,0,401,400,1,0,0,0,401,402,1,0,0,0,402,408,1,0,0,0,403,
404,5,63,0,0,404,405,3,56,28,0,405,406,5,64,0,0,406,408,1,0,0,0,407,395,
1,0,0,0,407,396,1,0,0,0,407,397,1,0,0,0,407,398,1,0,0,0,407,399,1,0,0,0,
407,403,1,0,0,0,408,71,1,0,0,0,409,410,5,66,0,0,410,411,3,70,35,0,411,73,
1,0,0,0,412,413,7,11,0,0,413,414,3,70,35,0,414,75,1,0,0,0,415,416,7,12,0,
0,416,417,3,70,35,0,417,77,1,0,0,0,418,419,7,13,0,0,419,420,3,70,35,0,420,
79,1,0,0,0,421,422,7,14,0,0,422,81,1,0,0,0,423,424,7,15,0,0,424,83,1,0,0,
0,45,85,88,97,99,108,114,119,130,137,148,153,159,179,194,199,204,213,217,
222,234,237,244,254,262,269,272,285,290,297,299,306,318,321,329,333,342,
350,358,366,374,382,385,392,401,407];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class VbishParser extends antlr4.Parser {

    static grammarFileName = "Vbish.g4";
    static literalNames = [ null, "'PULSE'", "'SERVICE'", "'DAEMON'", "'PROGRAM'", 
                            "'ON'", "'EVERY'", "'LOCAL'", "'PARENT'", "'CHILD'", 
                            "'SIBLING'", "'ALTERNATE'", "'MS'", "'S'", "'M'", 
                            "'SECOND'", "'SECONDS'", "'INTEROP'", "'PASCALISH'", 
                            "'COBOLISH'", "'VBISH'", "'WFL'", "'WORKFLOW'", 
                            "'ROLE'", "'CODE_LIBRARIAN'", "'LIBRARY'", "'USE'", 
                            "'IMPORT'", "'MAPPER'", "'ROUTE'", "'USING'", 
                            "'LIBRARIAN'", "'FROM'", "'AS'", "'OPTION'", 
                            "'EXPLICIT'", "'DIM'", "'SUB'", "'FUNCTION'", 
                            "'END'", "'RETURN'", "'IF'", "'THEN'", "'ELSE'", 
                            "'FOR'", "'TO'", "'STEP'", "'NEXT'", "'WHILE'", 
                            "'PRINT'", "'DISPLAY'", "'AND'", "'OR'", "'ANDALSO'", 
                            "'ORELSE'", "'NOT'", "'STRING'", "'INTEGER'", 
                            "'DOUBLE'", "'BOOLEAN'", "'TRUE'", "'FALSE'", 
                            null, "'('", "')'", "','", "'&'", "'+'", "'-'", 
                            "'*'", "'/'", null, "'<>'", "'<'", "'>'", "'<='", 
                            "'>='" ];
    static symbolicNames = [ null, "PULSE", "SERVICE", "DAEMON", "PROGRAM", 
                             "ON", "EVERY", "LOCAL", "PARENT", "CHILD", 
                             "SIBLING", "ALTERNATE", "MS", "S", "M", "SECOND", 
                             "SECONDS", "INTEROP", "PASCALISH", "COBOLISH", 
                             "VBISH", "WFL", "WORKFLOW", "ROLE", "CODE_LIBRARIAN", 
                             "LIBRARY", "USE", "IMPORT", "MAPPER", "ROUTE", 
                             "USING", "LIBRARIAN", "FROM", "AS", "OPTION", 
                             "EXPLICIT", "DIM", "SUB", "FUNCTION", "END", 
                             "RETURN", "IF", "THEN", "ELSE", "FOR", "TO", 
                             "STEP", "NEXT", "WHILE", "PRINT", "DISPLAY", 
                             "AND", "OR", "ANDALSO", "ORELSE", "NOT", "STRING", 
                             "INTEGER", "DOUBLE", "BOOLEAN", "TRUE", "FALSE", 
                             "ASSIGN", "LPAREN", "RPAREN", "COMMA", "AMPERSAND", 
                             "PLUS", "MINUS", "MUL", "DIV", "EQ", "NE", 
                             "LT", "GT", "LTE", "GTE", "NUMBER", "STRING_LITERAL", 
                             "IDENTIFIER", "COMMENT", "WS" ];
    static ruleNames = [ "compilationUnit", "optionExplicit", "runtimeDecl", 
                         "placement", "intervalUnit", "interopDecl", "interopKind", 
                         "topLevelDecl", "roleDecl", "roleName", "libraryDecl", 
                         "librarySource", "useDecl", "importDecl", "routeDecl", 
                         "variableDecl", "subDecl", "functionDecl", "parameterList", 
                         "parameter", "statement", "ifStatement", "forStatement", 
                         "whileStatement", "printStatement", "assignment", 
                         "callStatement", "returnStatement", "expression", 
                         "logicalOr", "logicalAnd", "equality", "relational", 
                         "additive", "multiplicative", "primary", "concatenation", 
                         "addOp", "mulOp", "relOp", "typeName", "stringOrIdentifier" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = VbishParser.ruleNames;
        this.literalNames = VbishParser.literalNames;
        this.symbolicNames = VbishParser.symbolicNames;
    }



	compilationUnit() {
	    let localctx = new CompilationUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, VbishParser.RULE_compilationUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 85;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===34) {
	            this.state = 84;
	            this.optionExplicit();
	        }

	        this.state = 88;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 30) !== 0)) {
	            this.state = 87;
	            this.runtimeDecl();
	        }

	        this.state = 99;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 17)) & ~0x1f) === 0 && ((1 << (_la - 17)) & 3675969) !== 0)) {
	            this.state = 97;
	            this._errHandler.sync(this);
	            switch(this._input.LA(1)) {
	            case 17:
	                this.state = 90;
	                this.interopDecl();
	                break;
	            case 23:
	                this.state = 91;
	                this.roleDecl();
	                break;
	            case 25:
	                this.state = 92;
	                this.libraryDecl();
	                break;
	            case 26:
	                this.state = 93;
	                this.useDecl();
	                break;
	            case 27:
	                this.state = 94;
	                this.importDecl();
	                break;
	            case 29:
	                this.state = 95;
	                this.routeDecl();
	                break;
	            case 36:
	            case 37:
	            case 38:
	                this.state = 96;
	                this.topLevelDecl();
	                break;
	            default:
	                throw new antlr4.error.NoViableAltException(this);
	            }
	            this.state = 101;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 102;
	        this.match(VbishParser.EOF);
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



	optionExplicit() {
	    let localctx = new OptionExplicitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, VbishParser.RULE_optionExplicit);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 104;
	        this.match(VbishParser.OPTION);
	        this.state = 105;
	        this.match(VbishParser.EXPLICIT);
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
	    this.enterRule(localctx, 4, VbishParser.RULE_runtimeDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 108;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 107;
	            this.match(VbishParser.PULSE);
	        }

	        this.state = 110;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 28) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 111;
	        this.stringOrIdentifier();
	        this.state = 114;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===5) {
	            this.state = 112;
	            this.match(VbishParser.ON);
	            this.state = 113;
	            this.placement();
	        }

	        this.state = 119;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===6) {
	            this.state = 116;
	            this.match(VbishParser.EVERY);
	            this.state = 117;
	            this.match(VbishParser.NUMBER);
	            this.state = 118;
	            this.intervalUnit();
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



	placement() {
	    let localctx = new PlacementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, VbishParser.RULE_placement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 121;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 3968) !== 0))) {
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



	intervalUnit() {
	    let localctx = new IntervalUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, VbishParser.RULE_intervalUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 123;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 126976) !== 0))) {
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



	interopDecl() {
	    let localctx = new InteropDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, VbishParser.RULE_interopDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 125;
	        this.match(VbishParser.INTEROP);
	        this.state = 126;
	        this.interopKind();
	        this.state = 127;
	        this.match(VbishParser.STRING_LITERAL);
	        this.state = 130;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 128;
	            this.match(VbishParser.AS);
	            this.state = 129;
	            this.match(VbishParser.IDENTIFIER);
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



	interopKind() {
	    let localctx = new InteropKindContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, VbishParser.RULE_interopKind);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 132;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 8126464) !== 0))) {
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



	topLevelDecl() {
	    let localctx = new TopLevelDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, VbishParser.RULE_topLevelDecl);
	    try {
	        this.state = 137;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 36:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 134;
	            this.variableDecl();
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 135;
	            this.subDecl();
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 136;
	            this.functionDecl();
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
	    this.enterRule(localctx, 16, VbishParser.RULE_roleDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 139;
	        this.match(VbishParser.ROLE);
	        this.state = 140;
	        this.roleName();
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
	    this.enterRule(localctx, 18, VbishParser.RULE_roleName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 142;
	        _la = this._input.LA(1);
	        if(!(_la===24 || _la===79)) {
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
	    this.enterRule(localctx, 20, VbishParser.RULE_libraryDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 144;
	        this.match(VbishParser.LIBRARY);
	        this.state = 145;
	        this.stringOrIdentifier();
	        this.state = 148;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===32) {
	            this.state = 146;
	            this.match(VbishParser.FROM);
	            this.state = 147;
	            this.librarySource();
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



	librarySource() {
	    let localctx = new LibrarySourceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, VbishParser.RULE_librarySource);
	    try {
	        this.state = 153;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 31:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 150;
	            this.match(VbishParser.LIBRARIAN);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 151;
	            this.match(VbishParser.MAPPER);
	            break;
	        case 78:
	        case 79:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 152;
	            this.stringOrIdentifier();
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
	    this.enterRule(localctx, 24, VbishParser.RULE_useDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 155;
	        this.match(VbishParser.USE);
	        this.state = 156;
	        this.stringOrIdentifier();
	        this.state = 159;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 157;
	            this.match(VbishParser.AS);
	            this.state = 158;
	            this.match(VbishParser.IDENTIFIER);
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



	importDecl() {
	    let localctx = new ImportDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, VbishParser.RULE_importDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 161;
	        this.match(VbishParser.IMPORT);
	        this.state = 162;
	        this.match(VbishParser.MAPPER);
	        this.state = 163;
	        this.stringOrIdentifier();
	        this.state = 164;
	        this.match(VbishParser.FROM);
	        this.state = 165;
	        this.librarySource();
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



	routeDecl() {
	    let localctx = new RouteDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, VbishParser.RULE_routeDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 167;
	        this.match(VbishParser.ROUTE);
	        this.state = 168;
	        this.stringOrIdentifier();
	        this.state = 169;
	        this.match(VbishParser.TO);
	        this.state = 170;
	        this.stringOrIdentifier();
	        this.state = 171;
	        this.match(VbishParser.USING);
	        this.state = 172;
	        this.match(VbishParser.MAPPER);
	        this.state = 173;
	        this.stringOrIdentifier();
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



	variableDecl() {
	    let localctx = new VariableDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, VbishParser.RULE_variableDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 175;
	        this.match(VbishParser.DIM);
	        this.state = 176;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 179;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 177;
	            this.match(VbishParser.AS);
	            this.state = 178;
	            this.typeName();
	        }

	        this.state = 194;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,13,this._ctx);
	        if(la_===1) {
	            this.state = 181;
	            this.match(VbishParser.FROM);
	            this.state = 182;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===31)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }

	        } else if(la_===2) {
	            this.state = 183;
	            this.match(VbishParser.ASSIGN);
	            this.state = 184;
	            this.expression();

	        } else if(la_===3) {
	            this.state = 185;
	            this.match(VbishParser.FROM);
	            this.state = 186;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===31)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 187;
	            this.match(VbishParser.ASSIGN);
	            this.state = 188;
	            this.expression();

	        } else if(la_===4) {
	            this.state = 189;
	            this.match(VbishParser.ASSIGN);
	            this.state = 190;
	            this.expression();
	            this.state = 191;
	            this.match(VbishParser.FROM);
	            this.state = 192;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===31)) {
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



	subDecl() {
	    let localctx = new SubDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, VbishParser.RULE_subDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 196;
	        this.match(VbishParser.SUB);
	        this.state = 197;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 199;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===63) {
	            this.state = 198;
	            this.parameterList();
	        }

	        this.state = 204;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	            this.state = 201;
	            this.statement();
	            this.state = 206;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 207;
	        this.match(VbishParser.END);
	        this.state = 208;
	        this.match(VbishParser.SUB);
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



	functionDecl() {
	    let localctx = new FunctionDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, VbishParser.RULE_functionDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 210;
	        this.match(VbishParser.FUNCTION);
	        this.state = 211;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===63) {
	            this.state = 212;
	            this.parameterList();
	        }

	        this.state = 217;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 215;
	            this.match(VbishParser.AS);
	            this.state = 216;
	            this.typeName();
	        }

	        this.state = 222;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	            this.state = 219;
	            this.statement();
	            this.state = 224;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 225;
	        this.match(VbishParser.END);
	        this.state = 226;
	        this.match(VbishParser.FUNCTION);
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



	parameterList() {
	    let localctx = new ParameterListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, VbishParser.RULE_parameterList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 228;
	        this.match(VbishParser.LPAREN);
	        this.state = 237;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 60)) & ~0x1f) === 0 && ((1 << (_la - 60)) & 917515) !== 0)) {
	            this.state = 229;
	            this.parameter();
	            this.state = 234;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===65) {
	                this.state = 230;
	                this.match(VbishParser.COMMA);
	                this.state = 231;
	                this.parameter();
	                this.state = 236;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 239;
	        this.match(VbishParser.RPAREN);
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



	parameter() {
	    let localctx = new ParameterContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, VbishParser.RULE_parameter);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 241;
	        this.expression();
	        this.state = 244;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 242;
	            this.match(VbishParser.AS);
	            this.state = 243;
	            this.typeName();
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



	statement() {
	    let localctx = new StatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, VbishParser.RULE_statement);
	    try {
	        this.state = 254;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,22,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 246;
	            this.variableDecl();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 247;
	            this.ifStatement();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 248;
	            this.forStatement();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 249;
	            this.whileStatement();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 250;
	            this.printStatement();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 251;
	            this.assignment();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 252;
	            this.callStatement();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 253;
	            this.returnStatement();
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



	ifStatement() {
	    let localctx = new IfStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, VbishParser.RULE_ifStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 256;
	        this.match(VbishParser.IF);
	        this.state = 257;
	        this.expression();
	        this.state = 258;
	        this.match(VbishParser.THEN);
	        this.state = 262;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	            this.state = 259;
	            this.statement();
	            this.state = 264;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 272;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 265;
	            this.match(VbishParser.ELSE);
	            this.state = 269;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	                this.state = 266;
	                this.statement();
	                this.state = 271;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 274;
	        this.match(VbishParser.END);
	        this.state = 275;
	        this.match(VbishParser.IF);
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



	forStatement() {
	    let localctx = new ForStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, VbishParser.RULE_forStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 277;
	        this.match(VbishParser.FOR);
	        this.state = 278;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 279;
	        this.match(VbishParser.ASSIGN);
	        this.state = 280;
	        this.expression();
	        this.state = 281;
	        this.match(VbishParser.TO);
	        this.state = 282;
	        this.expression();
	        this.state = 285;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===46) {
	            this.state = 283;
	            this.match(VbishParser.STEP);
	            this.state = 284;
	            this.expression();
	        }

	        this.state = 290;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	            this.state = 287;
	            this.statement();
	            this.state = 292;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 299;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 39:
	            this.state = 293;
	            this.match(VbishParser.END);
	            this.state = 294;
	            this.match(VbishParser.FOR);
	            break;
	        case 47:
	            this.state = 295;
	            this.match(VbishParser.NEXT);
	            this.state = 297;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,28,this._ctx);
	            if(la_===1) {
	                this.state = 296;
	                this.match(VbishParser.IDENTIFIER);

	            }
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



	whileStatement() {
	    let localctx = new WhileStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, VbishParser.RULE_whileStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 301;
	        this.match(VbishParser.WHILE);
	        this.state = 302;
	        this.expression();
	        this.state = 306;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 28977) !== 0) || _la===79) {
	            this.state = 303;
	            this.statement();
	            this.state = 308;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 309;
	        this.match(VbishParser.END);
	        this.state = 310;
	        this.match(VbishParser.WHILE);
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



	printStatement() {
	    let localctx = new PrintStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, VbishParser.RULE_printStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 312;
	        _la = this._input.LA(1);
	        if(!(_la===49 || _la===50)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 321;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,32,this._ctx);
	        if(la_===1) {
	            this.state = 313;
	            this.expression();
	            this.state = 318;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===65) {
	                this.state = 314;
	                this.match(VbishParser.COMMA);
	                this.state = 315;
	                this.expression();
	                this.state = 320;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
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



	assignment() {
	    let localctx = new AssignmentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, VbishParser.RULE_assignment);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 323;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 324;
	        this.match(VbishParser.ASSIGN);
	        this.state = 325;
	        this.expression();
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



	callStatement() {
	    let localctx = new CallStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 52, VbishParser.RULE_callStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 327;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 329;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===63) {
	            this.state = 328;
	            this.parameterList();
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



	returnStatement() {
	    let localctx = new ReturnStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, VbishParser.RULE_returnStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 331;
	        this.match(VbishParser.RETURN);
	        this.state = 333;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,34,this._ctx);
	        if(la_===1) {
	            this.state = 332;
	            this.expression();

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



	expression() {
	    let localctx = new ExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, VbishParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 335;
	        this.logicalOr();
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



	logicalOr() {
	    let localctx = new LogicalOrContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 58, VbishParser.RULE_logicalOr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 337;
	        this.logicalAnd();
	        this.state = 342;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===52 || _la===54) {
	            this.state = 338;
	            _la = this._input.LA(1);
	            if(!(_la===52 || _la===54)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 339;
	            this.logicalAnd();
	            this.state = 344;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
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



	logicalAnd() {
	    let localctx = new LogicalAndContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, VbishParser.RULE_logicalAnd);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 345;
	        this.equality();
	        this.state = 350;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===51 || _la===53) {
	            this.state = 346;
	            _la = this._input.LA(1);
	            if(!(_la===51 || _la===53)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 347;
	            this.equality();
	            this.state = 352;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
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



	equality() {
	    let localctx = new EqualityContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, VbishParser.RULE_equality);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 353;
	        this.relational();
	        this.state = 358;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===71 || _la===72) {
	            this.state = 354;
	            _la = this._input.LA(1);
	            if(!(_la===71 || _la===72)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 355;
	            this.relational();
	            this.state = 360;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
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



	relational() {
	    let localctx = new RelationalContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, VbishParser.RULE_relational);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 361;
	        this.additive();
	        this.state = 366;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 73)) & ~0x1f) === 0 && ((1 << (_la - 73)) & 15) !== 0)) {
	            this.state = 362;
	            _la = this._input.LA(1);
	            if(!(((((_la - 73)) & ~0x1f) === 0 && ((1 << (_la - 73)) & 15) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 363;
	            this.additive();
	            this.state = 368;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
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



	additive() {
	    let localctx = new AdditiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, VbishParser.RULE_additive);
	    var _la = 0;
	    try {
	        this.state = 385;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,41,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 369;
	            this.multiplicative();
	            this.state = 374;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===67 || _la===68) {
	                this.state = 370;
	                _la = this._input.LA(1);
	                if(!(_la===67 || _la===68)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
	                this.state = 371;
	                this.multiplicative();
	                this.state = 376;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 377;
	            this.multiplicative();
	            this.state = 382;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===66) {
	                this.state = 378;
	                this.match(VbishParser.AMPERSAND);
	                this.state = 379;
	                this.multiplicative();
	                this.state = 384;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
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



	multiplicative() {
	    let localctx = new MultiplicativeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, VbishParser.RULE_multiplicative);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 387;
	        this.primary();
	        this.state = 392;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===69 || _la===70) {
	            this.state = 388;
	            _la = this._input.LA(1);
	            if(!(_la===69 || _la===70)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 389;
	            this.primary();
	            this.state = 394;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
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



	primary() {
	    let localctx = new PrimaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 70, VbishParser.RULE_primary);
	    var _la = 0;
	    try {
	        this.state = 407;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 78:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 395;
	            this.match(VbishParser.STRING_LITERAL);
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 396;
	            this.match(VbishParser.NUMBER);
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 397;
	            this.match(VbishParser.TRUE);
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 398;
	            this.match(VbishParser.FALSE);
	            break;
	        case 79:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 399;
	            this.match(VbishParser.IDENTIFIER);
	            this.state = 401;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===63) {
	                this.state = 400;
	                this.parameterList();
	            }

	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 403;
	            this.match(VbishParser.LPAREN);
	            this.state = 404;
	            this.expression();
	            this.state = 405;
	            this.match(VbishParser.RPAREN);
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



	concatenation() {
	    let localctx = new ConcatenationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 72, VbishParser.RULE_concatenation);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 409;
	        this.match(VbishParser.AMPERSAND);
	        this.state = 410;
	        this.primary();
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



	addOp() {
	    let localctx = new AddOpContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 74, VbishParser.RULE_addOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 412;
	        _la = this._input.LA(1);
	        if(!(_la===67 || _la===68)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 413;
	        this.primary();
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



	mulOp() {
	    let localctx = new MulOpContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 76, VbishParser.RULE_mulOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 415;
	        _la = this._input.LA(1);
	        if(!(_la===69 || _la===70)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 416;
	        this.primary();
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



	relOp() {
	    let localctx = new RelOpContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 78, VbishParser.RULE_relOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 418;
	        _la = this._input.LA(1);
	        if(!(((((_la - 71)) & ~0x1f) === 0 && ((1 << (_la - 71)) & 63) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 419;
	        this.primary();
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



	typeName() {
	    let localctx = new TypeNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 80, VbishParser.RULE_typeName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 421;
	        _la = this._input.LA(1);
	        if(!(((((_la - 56)) & ~0x1f) === 0 && ((1 << (_la - 56)) & 8388623) !== 0))) {
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



	stringOrIdentifier() {
	    let localctx = new StringOrIdentifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 82, VbishParser.RULE_stringOrIdentifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 423;
	        _la = this._input.LA(1);
	        if(!(_la===78 || _la===79)) {
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


}

VbishParser.EOF = antlr4.Token.EOF;
VbishParser.PULSE = 1;
VbishParser.SERVICE = 2;
VbishParser.DAEMON = 3;
VbishParser.PROGRAM = 4;
VbishParser.ON = 5;
VbishParser.EVERY = 6;
VbishParser.LOCAL = 7;
VbishParser.PARENT = 8;
VbishParser.CHILD = 9;
VbishParser.SIBLING = 10;
VbishParser.ALTERNATE = 11;
VbishParser.MS = 12;
VbishParser.S = 13;
VbishParser.M = 14;
VbishParser.SECOND = 15;
VbishParser.SECONDS = 16;
VbishParser.INTEROP = 17;
VbishParser.PASCALISH = 18;
VbishParser.COBOLISH = 19;
VbishParser.VBISH = 20;
VbishParser.WFL = 21;
VbishParser.WORKFLOW = 22;
VbishParser.ROLE = 23;
VbishParser.CODE_LIBRARIAN = 24;
VbishParser.LIBRARY = 25;
VbishParser.USE = 26;
VbishParser.IMPORT = 27;
VbishParser.MAPPER = 28;
VbishParser.ROUTE = 29;
VbishParser.USING = 30;
VbishParser.LIBRARIAN = 31;
VbishParser.FROM = 32;
VbishParser.AS = 33;
VbishParser.OPTION = 34;
VbishParser.EXPLICIT = 35;
VbishParser.DIM = 36;
VbishParser.SUB = 37;
VbishParser.FUNCTION = 38;
VbishParser.END = 39;
VbishParser.RETURN = 40;
VbishParser.IF = 41;
VbishParser.THEN = 42;
VbishParser.ELSE = 43;
VbishParser.FOR = 44;
VbishParser.TO = 45;
VbishParser.STEP = 46;
VbishParser.NEXT = 47;
VbishParser.WHILE = 48;
VbishParser.PRINT = 49;
VbishParser.DISPLAY = 50;
VbishParser.AND = 51;
VbishParser.OR = 52;
VbishParser.ANDALSO = 53;
VbishParser.ORELSE = 54;
VbishParser.NOT = 55;
VbishParser.STRING = 56;
VbishParser.INTEGER = 57;
VbishParser.DOUBLE = 58;
VbishParser.BOOLEAN = 59;
VbishParser.TRUE = 60;
VbishParser.FALSE = 61;
VbishParser.ASSIGN = 62;
VbishParser.LPAREN = 63;
VbishParser.RPAREN = 64;
VbishParser.COMMA = 65;
VbishParser.AMPERSAND = 66;
VbishParser.PLUS = 67;
VbishParser.MINUS = 68;
VbishParser.MUL = 69;
VbishParser.DIV = 70;
VbishParser.EQ = 71;
VbishParser.NE = 72;
VbishParser.LT = 73;
VbishParser.GT = 74;
VbishParser.LTE = 75;
VbishParser.GTE = 76;
VbishParser.NUMBER = 77;
VbishParser.STRING_LITERAL = 78;
VbishParser.IDENTIFIER = 79;
VbishParser.COMMENT = 80;
VbishParser.WS = 81;

VbishParser.RULE_compilationUnit = 0;
VbishParser.RULE_optionExplicit = 1;
VbishParser.RULE_runtimeDecl = 2;
VbishParser.RULE_placement = 3;
VbishParser.RULE_intervalUnit = 4;
VbishParser.RULE_interopDecl = 5;
VbishParser.RULE_interopKind = 6;
VbishParser.RULE_topLevelDecl = 7;
VbishParser.RULE_roleDecl = 8;
VbishParser.RULE_roleName = 9;
VbishParser.RULE_libraryDecl = 10;
VbishParser.RULE_librarySource = 11;
VbishParser.RULE_useDecl = 12;
VbishParser.RULE_importDecl = 13;
VbishParser.RULE_routeDecl = 14;
VbishParser.RULE_variableDecl = 15;
VbishParser.RULE_subDecl = 16;
VbishParser.RULE_functionDecl = 17;
VbishParser.RULE_parameterList = 18;
VbishParser.RULE_parameter = 19;
VbishParser.RULE_statement = 20;
VbishParser.RULE_ifStatement = 21;
VbishParser.RULE_forStatement = 22;
VbishParser.RULE_whileStatement = 23;
VbishParser.RULE_printStatement = 24;
VbishParser.RULE_assignment = 25;
VbishParser.RULE_callStatement = 26;
VbishParser.RULE_returnStatement = 27;
VbishParser.RULE_expression = 28;
VbishParser.RULE_logicalOr = 29;
VbishParser.RULE_logicalAnd = 30;
VbishParser.RULE_equality = 31;
VbishParser.RULE_relational = 32;
VbishParser.RULE_additive = 33;
VbishParser.RULE_multiplicative = 34;
VbishParser.RULE_primary = 35;
VbishParser.RULE_concatenation = 36;
VbishParser.RULE_addOp = 37;
VbishParser.RULE_mulOp = 38;
VbishParser.RULE_relOp = 39;
VbishParser.RULE_typeName = 40;
VbishParser.RULE_stringOrIdentifier = 41;

class CompilationUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_compilationUnit;
    }

	EOF() {
	    return this.getToken(VbishParser.EOF, 0);
	};

	optionExplicit() {
	    return this.getTypedRuleContext(OptionExplicitContext,0);
	};

	runtimeDecl() {
	    return this.getTypedRuleContext(RuntimeDeclContext,0);
	};

	interopDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(InteropDeclContext);
	    } else {
	        return this.getTypedRuleContext(InteropDeclContext,i);
	    }
	};

	roleDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RoleDeclContext);
	    } else {
	        return this.getTypedRuleContext(RoleDeclContext,i);
	    }
	};

	libraryDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(LibraryDeclContext);
	    } else {
	        return this.getTypedRuleContext(LibraryDeclContext,i);
	    }
	};

	useDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(UseDeclContext);
	    } else {
	        return this.getTypedRuleContext(UseDeclContext,i);
	    }
	};

	importDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ImportDeclContext);
	    } else {
	        return this.getTypedRuleContext(ImportDeclContext,i);
	    }
	};

	routeDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RouteDeclContext);
	    } else {
	        return this.getTypedRuleContext(RouteDeclContext,i);
	    }
	};

	topLevelDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TopLevelDeclContext);
	    } else {
	        return this.getTypedRuleContext(TopLevelDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitCompilationUnit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class OptionExplicitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_optionExplicit;
    }

	OPTION() {
	    return this.getToken(VbishParser.OPTION, 0);
	};

	EXPLICIT() {
	    return this.getToken(VbishParser.EXPLICIT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitOptionExplicit(this);
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
        this.ruleIndex = VbishParser.RULE_runtimeDecl;
    }

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	SERVICE() {
	    return this.getToken(VbishParser.SERVICE, 0);
	};

	DAEMON() {
	    return this.getToken(VbishParser.DAEMON, 0);
	};

	PROGRAM() {
	    return this.getToken(VbishParser.PROGRAM, 0);
	};

	PULSE() {
	    return this.getToken(VbishParser.PULSE, 0);
	};

	ON() {
	    return this.getToken(VbishParser.ON, 0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	EVERY() {
	    return this.getToken(VbishParser.EVERY, 0);
	};

	NUMBER() {
	    return this.getToken(VbishParser.NUMBER, 0);
	};

	intervalUnit() {
	    return this.getTypedRuleContext(IntervalUnitContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitRuntimeDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PlacementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_placement;
    }

	LOCAL() {
	    return this.getToken(VbishParser.LOCAL, 0);
	};

	PARENT() {
	    return this.getToken(VbishParser.PARENT, 0);
	};

	CHILD() {
	    return this.getToken(VbishParser.CHILD, 0);
	};

	SIBLING() {
	    return this.getToken(VbishParser.SIBLING, 0);
	};

	ALTERNATE() {
	    return this.getToken(VbishParser.ALTERNATE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitPlacement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IntervalUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_intervalUnit;
    }

	MS() {
	    return this.getToken(VbishParser.MS, 0);
	};

	S() {
	    return this.getToken(VbishParser.S, 0);
	};

	M() {
	    return this.getToken(VbishParser.M, 0);
	};

	SECOND() {
	    return this.getToken(VbishParser.SECOND, 0);
	};

	SECONDS() {
	    return this.getToken(VbishParser.SECONDS, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitIntervalUnit(this);
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
        this.ruleIndex = VbishParser.RULE_interopDecl;
    }

	INTEROP() {
	    return this.getToken(VbishParser.INTEROP, 0);
	};

	interopKind() {
	    return this.getTypedRuleContext(InteropKindContext,0);
	};

	STRING_LITERAL() {
	    return this.getToken(VbishParser.STRING_LITERAL, 0);
	};

	AS() {
	    return this.getToken(VbishParser.AS, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
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
        this.ruleIndex = VbishParser.RULE_interopKind;
    }

	PASCALISH() {
	    return this.getToken(VbishParser.PASCALISH, 0);
	};

	COBOLISH() {
	    return this.getToken(VbishParser.COBOLISH, 0);
	};

	VBISH() {
	    return this.getToken(VbishParser.VBISH, 0);
	};

	WFL() {
	    return this.getToken(VbishParser.WFL, 0);
	};

	WORKFLOW() {
	    return this.getToken(VbishParser.WORKFLOW, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitInteropKind(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TopLevelDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_topLevelDecl;
    }

	variableDecl() {
	    return this.getTypedRuleContext(VariableDeclContext,0);
	};

	subDecl() {
	    return this.getTypedRuleContext(SubDeclContext,0);
	};

	functionDecl() {
	    return this.getTypedRuleContext(FunctionDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitTopLevelDecl(this);
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
        this.ruleIndex = VbishParser.RULE_roleDecl;
    }

	ROLE() {
	    return this.getToken(VbishParser.ROLE, 0);
	};

	roleName() {
	    return this.getTypedRuleContext(RoleNameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
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
        this.ruleIndex = VbishParser.RULE_roleName;
    }

	CODE_LIBRARIAN() {
	    return this.getToken(VbishParser.CODE_LIBRARIAN, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitRoleName(this);
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
        this.ruleIndex = VbishParser.RULE_libraryDecl;
    }

	LIBRARY() {
	    return this.getToken(VbishParser.LIBRARY, 0);
	};

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	FROM() {
	    return this.getToken(VbishParser.FROM, 0);
	};

	librarySource() {
	    return this.getTypedRuleContext(LibrarySourceContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
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
        this.ruleIndex = VbishParser.RULE_librarySource;
    }

	LIBRARIAN() {
	    return this.getToken(VbishParser.LIBRARIAN, 0);
	};

	MAPPER() {
	    return this.getToken(VbishParser.MAPPER, 0);
	};

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
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
        this.ruleIndex = VbishParser.RULE_useDecl;
    }

	USE() {
	    return this.getToken(VbishParser.USE, 0);
	};

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	AS() {
	    return this.getToken(VbishParser.AS, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitUseDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ImportDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_importDecl;
    }

	IMPORT() {
	    return this.getToken(VbishParser.IMPORT, 0);
	};

	MAPPER() {
	    return this.getToken(VbishParser.MAPPER, 0);
	};

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	FROM() {
	    return this.getToken(VbishParser.FROM, 0);
	};

	librarySource() {
	    return this.getTypedRuleContext(LibrarySourceContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitImportDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RouteDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_routeDecl;
    }

	ROUTE() {
	    return this.getToken(VbishParser.ROUTE, 0);
	};

	stringOrIdentifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StringOrIdentifierContext);
	    } else {
	        return this.getTypedRuleContext(StringOrIdentifierContext,i);
	    }
	};

	TO() {
	    return this.getToken(VbishParser.TO, 0);
	};

	USING() {
	    return this.getToken(VbishParser.USING, 0);
	};

	MAPPER() {
	    return this.getToken(VbishParser.MAPPER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitRouteDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VariableDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_variableDecl;
    }

	DIM() {
	    return this.getToken(VbishParser.DIM, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	AS() {
	    return this.getToken(VbishParser.AS, 0);
	};

	typeName() {
	    return this.getTypedRuleContext(TypeNameContext,0);
	};

	FROM() {
	    return this.getToken(VbishParser.FROM, 0);
	};

	ASSIGN() {
	    return this.getToken(VbishParser.ASSIGN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	LIBRARIAN() {
	    return this.getToken(VbishParser.LIBRARIAN, 0);
	};

	MAPPER() {
	    return this.getToken(VbishParser.MAPPER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitVariableDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SubDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_subDecl;
    }

	SUB = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.SUB);
	    } else {
	        return this.getToken(VbishParser.SUB, i);
	    }
	};


	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
	};

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
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
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSubDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_functionDecl;
    }

	FUNCTION = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.FUNCTION);
	    } else {
	        return this.getToken(VbishParser.FUNCTION, i);
	    }
	};


	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
	};

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
	};

	AS() {
	    return this.getToken(VbishParser.AS, 0);
	};

	typeName() {
	    return this.getTypedRuleContext(TypeNameContext,0);
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
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitFunctionDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParameterListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_parameterList;
    }

	LPAREN() {
	    return this.getToken(VbishParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(VbishParser.RPAREN, 0);
	};

	parameter = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ParameterContext);
	    } else {
	        return this.getTypedRuleContext(ParameterContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.COMMA);
	    } else {
	        return this.getToken(VbishParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitParameterList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParameterContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_parameter;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	AS() {
	    return this.getToken(VbishParser.AS, 0);
	};

	typeName() {
	    return this.getTypedRuleContext(TypeNameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitParameter(this);
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
        this.ruleIndex = VbishParser.RULE_statement;
    }

	variableDecl() {
	    return this.getTypedRuleContext(VariableDeclContext,0);
	};

	ifStatement() {
	    return this.getTypedRuleContext(IfStatementContext,0);
	};

	forStatement() {
	    return this.getTypedRuleContext(ForStatementContext,0);
	};

	whileStatement() {
	    return this.getTypedRuleContext(WhileStatementContext,0);
	};

	printStatement() {
	    return this.getTypedRuleContext(PrintStatementContext,0);
	};

	assignment() {
	    return this.getTypedRuleContext(AssignmentContext,0);
	};

	callStatement() {
	    return this.getTypedRuleContext(CallStatementContext,0);
	};

	returnStatement() {
	    return this.getTypedRuleContext(ReturnStatementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IfStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_ifStatement;
    }

	IF = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.IF);
	    } else {
	        return this.getToken(VbishParser.IF, i);
	    }
	};


	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	THEN() {
	    return this.getToken(VbishParser.THEN, 0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
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

	ELSE() {
	    return this.getToken(VbishParser.ELSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitIfStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ForStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_forStatement;
    }

	FOR = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.FOR);
	    } else {
	        return this.getToken(VbishParser.FOR, i);
	    }
	};


	IDENTIFIER = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.IDENTIFIER);
	    } else {
	        return this.getToken(VbishParser.IDENTIFIER, i);
	    }
	};


	ASSIGN() {
	    return this.getToken(VbishParser.ASSIGN, 0);
	};

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	TO() {
	    return this.getToken(VbishParser.TO, 0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
	};

	NEXT() {
	    return this.getToken(VbishParser.NEXT, 0);
	};

	STEP() {
	    return this.getToken(VbishParser.STEP, 0);
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
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitForStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WhileStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_whileStatement;
    }

	WHILE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.WHILE);
	    } else {
	        return this.getToken(VbishParser.WHILE, i);
	    }
	};


	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
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
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitWhileStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PrintStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_printStatement;
    }

	PRINT() {
	    return this.getToken(VbishParser.PRINT, 0);
	};

	DISPLAY() {
	    return this.getToken(VbishParser.DISPLAY, 0);
	};

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.COMMA);
	    } else {
	        return this.getToken(VbishParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitPrintStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_assignment;
    }

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	ASSIGN() {
	    return this.getToken(VbishParser.ASSIGN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitAssignment(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CallStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_callStatement;
    }

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitCallStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ReturnStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_returnStatement;
    }

	RETURN() {
	    return this.getToken(VbishParser.RETURN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitReturnStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_expression;
    }

	logicalOr() {
	    return this.getTypedRuleContext(LogicalOrContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalOrContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_logicalOr;
    }

	logicalAnd = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(LogicalAndContext);
	    } else {
	        return this.getTypedRuleContext(LogicalAndContext,i);
	    }
	};

	OR = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.OR);
	    } else {
	        return this.getToken(VbishParser.OR, i);
	    }
	};


	ORELSE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.ORELSE);
	    } else {
	        return this.getToken(VbishParser.ORELSE, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitLogicalOr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalAndContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_logicalAnd;
    }

	equality = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EqualityContext);
	    } else {
	        return this.getTypedRuleContext(EqualityContext,i);
	    }
	};

	AND = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.AND);
	    } else {
	        return this.getToken(VbishParser.AND, i);
	    }
	};


	ANDALSO = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.ANDALSO);
	    } else {
	        return this.getToken(VbishParser.ANDALSO, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitLogicalAnd(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EqualityContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_equality;
    }

	relational = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RelationalContext);
	    } else {
	        return this.getTypedRuleContext(RelationalContext,i);
	    }
	};

	EQ = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.EQ);
	    } else {
	        return this.getToken(VbishParser.EQ, i);
	    }
	};


	NE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.NE);
	    } else {
	        return this.getToken(VbishParser.NE, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitEquality(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RelationalContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_relational;
    }

	additive = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AdditiveContext);
	    } else {
	        return this.getTypedRuleContext(AdditiveContext,i);
	    }
	};

	LT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.LT);
	    } else {
	        return this.getToken(VbishParser.LT, i);
	    }
	};


	GT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.GT);
	    } else {
	        return this.getToken(VbishParser.GT, i);
	    }
	};


	LTE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.LTE);
	    } else {
	        return this.getToken(VbishParser.LTE, i);
	    }
	};


	GTE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.GTE);
	    } else {
	        return this.getToken(VbishParser.GTE, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitRelational(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AdditiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_additive;
    }

	multiplicative = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MultiplicativeContext);
	    } else {
	        return this.getTypedRuleContext(MultiplicativeContext,i);
	    }
	};

	PLUS = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.PLUS);
	    } else {
	        return this.getToken(VbishParser.PLUS, i);
	    }
	};


	MINUS = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.MINUS);
	    } else {
	        return this.getToken(VbishParser.MINUS, i);
	    }
	};


	AMPERSAND = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.AMPERSAND);
	    } else {
	        return this.getToken(VbishParser.AMPERSAND, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitAdditive(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MultiplicativeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_multiplicative;
    }

	primary = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(PrimaryContext);
	    } else {
	        return this.getTypedRuleContext(PrimaryContext,i);
	    }
	};

	MUL = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.MUL);
	    } else {
	        return this.getToken(VbishParser.MUL, i);
	    }
	};


	DIV = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.DIV);
	    } else {
	        return this.getToken(VbishParser.DIV, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitMultiplicative(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PrimaryContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_primary;
    }

	STRING_LITERAL() {
	    return this.getToken(VbishParser.STRING_LITERAL, 0);
	};

	NUMBER() {
	    return this.getToken(VbishParser.NUMBER, 0);
	};

	TRUE() {
	    return this.getToken(VbishParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(VbishParser.FALSE, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	parameterList() {
	    return this.getTypedRuleContext(ParameterListContext,0);
	};

	LPAREN() {
	    return this.getToken(VbishParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(VbishParser.RPAREN, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitPrimary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConcatenationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_concatenation;
    }

	AMPERSAND() {
	    return this.getToken(VbishParser.AMPERSAND, 0);
	};

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitConcatenation(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AddOpContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_addOp;
    }

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	PLUS() {
	    return this.getToken(VbishParser.PLUS, 0);
	};

	MINUS() {
	    return this.getToken(VbishParser.MINUS, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitAddOp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MulOpContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_mulOp;
    }

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	MUL() {
	    return this.getToken(VbishParser.MUL, 0);
	};

	DIV() {
	    return this.getToken(VbishParser.DIV, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitMulOp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RelOpContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_relOp;
    }

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	EQ() {
	    return this.getToken(VbishParser.EQ, 0);
	};

	NE() {
	    return this.getToken(VbishParser.NE, 0);
	};

	LT() {
	    return this.getToken(VbishParser.LT, 0);
	};

	GT() {
	    return this.getToken(VbishParser.GT, 0);
	};

	LTE() {
	    return this.getToken(VbishParser.LTE, 0);
	};

	GTE() {
	    return this.getToken(VbishParser.GTE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitRelOp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_typeName;
    }

	STRING() {
	    return this.getToken(VbishParser.STRING, 0);
	};

	INTEGER() {
	    return this.getToken(VbishParser.INTEGER, 0);
	};

	DOUBLE() {
	    return this.getToken(VbishParser.DOUBLE, 0);
	};

	BOOLEAN() {
	    return this.getToken(VbishParser.BOOLEAN, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitTypeName(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StringOrIdentifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_stringOrIdentifier;
    }

	STRING_LITERAL() {
	    return this.getToken(VbishParser.STRING_LITERAL, 0);
	};

	IDENTIFIER() {
	    return this.getToken(VbishParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitStringOrIdentifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




VbishParser.CompilationUnitContext = CompilationUnitContext; 
VbishParser.OptionExplicitContext = OptionExplicitContext; 
VbishParser.RuntimeDeclContext = RuntimeDeclContext; 
VbishParser.PlacementContext = PlacementContext; 
VbishParser.IntervalUnitContext = IntervalUnitContext; 
VbishParser.InteropDeclContext = InteropDeclContext; 
VbishParser.InteropKindContext = InteropKindContext; 
VbishParser.TopLevelDeclContext = TopLevelDeclContext; 
VbishParser.RoleDeclContext = RoleDeclContext; 
VbishParser.RoleNameContext = RoleNameContext; 
VbishParser.LibraryDeclContext = LibraryDeclContext; 
VbishParser.LibrarySourceContext = LibrarySourceContext; 
VbishParser.UseDeclContext = UseDeclContext; 
VbishParser.ImportDeclContext = ImportDeclContext; 
VbishParser.RouteDeclContext = RouteDeclContext; 
VbishParser.VariableDeclContext = VariableDeclContext; 
VbishParser.SubDeclContext = SubDeclContext; 
VbishParser.FunctionDeclContext = FunctionDeclContext; 
VbishParser.ParameterListContext = ParameterListContext; 
VbishParser.ParameterContext = ParameterContext; 
VbishParser.StatementContext = StatementContext; 
VbishParser.IfStatementContext = IfStatementContext; 
VbishParser.ForStatementContext = ForStatementContext; 
VbishParser.WhileStatementContext = WhileStatementContext; 
VbishParser.PrintStatementContext = PrintStatementContext; 
VbishParser.AssignmentContext = AssignmentContext; 
VbishParser.CallStatementContext = CallStatementContext; 
VbishParser.ReturnStatementContext = ReturnStatementContext; 
VbishParser.ExpressionContext = ExpressionContext; 
VbishParser.LogicalOrContext = LogicalOrContext; 
VbishParser.LogicalAndContext = LogicalAndContext; 
VbishParser.EqualityContext = EqualityContext; 
VbishParser.RelationalContext = RelationalContext; 
VbishParser.AdditiveContext = AdditiveContext; 
VbishParser.MultiplicativeContext = MultiplicativeContext; 
VbishParser.PrimaryContext = PrimaryContext; 
VbishParser.ConcatenationContext = ConcatenationContext; 
VbishParser.AddOpContext = AddOpContext; 
VbishParser.MulOpContext = MulOpContext; 
VbishParser.RelOpContext = RelOpContext; 
VbishParser.TypeNameContext = TypeNameContext; 
VbishParser.StringOrIdentifierContext = StringOrIdentifierContext; 
