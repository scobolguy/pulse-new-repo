// Generated from Csharp.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import CsharpVisitor from './CsharpVisitor.js';

const serializedATN = [4,1,72,429,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,1,0,5,0,74,8,0,10,0,12,0,77,9,0,1,0,1,0,5,0,81,8,0,10,0,12,
0,84,9,0,3,0,86,8,0,1,0,1,0,1,1,1,1,1,1,1,1,1,2,1,2,1,2,1,2,5,2,98,8,2,10,
2,12,2,101,9,2,1,2,1,2,1,3,5,3,106,8,3,10,3,12,3,109,9,3,1,3,1,3,1,3,1,3,
5,3,115,8,3,10,3,12,3,118,9,3,1,3,1,3,1,4,1,4,1,5,1,5,5,5,126,8,5,10,5,12,
5,129,9,5,1,5,5,5,132,8,5,10,5,12,5,135,9,5,1,5,3,5,138,8,5,1,5,1,5,1,5,
3,5,143,8,5,1,5,1,5,3,5,147,8,5,1,5,1,5,1,5,3,5,152,8,5,1,6,5,6,155,8,6,
10,6,12,6,158,9,6,1,6,1,6,1,6,3,6,163,8,6,1,6,1,6,1,6,1,7,1,7,1,7,3,7,171,
8,7,1,7,1,7,1,8,1,8,1,9,1,9,1,9,1,9,5,9,181,8,9,10,9,12,9,184,9,9,1,9,1,
9,1,10,1,10,1,10,5,10,191,8,10,10,10,12,10,194,9,10,1,11,1,11,1,11,1,12,
1,12,1,12,1,12,3,12,203,8,12,3,12,205,8,12,1,13,1,13,1,14,1,14,1,14,5,14,
212,8,14,10,14,12,14,215,9,14,1,15,1,15,5,15,219,8,15,10,15,12,15,222,9,
15,1,15,1,15,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,3,16,
237,8,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,
1,16,1,16,1,16,1,16,3,16,256,8,16,1,16,1,16,3,16,260,8,16,1,16,1,16,3,16,
264,8,16,1,16,1,16,1,16,1,16,3,16,270,8,16,1,16,1,16,1,16,1,16,1,16,1,16,
1,16,1,16,1,16,3,16,281,8,16,1,17,1,17,3,17,285,8,17,1,18,1,18,1,18,1,18,
5,18,291,8,18,10,18,12,18,294,9,18,1,19,1,19,1,19,3,19,299,8,19,1,20,1,20,
1,20,5,20,304,8,20,10,20,12,20,307,9,20,1,21,1,21,1,22,1,22,1,22,1,22,3,
22,315,8,22,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,24,3,24,325,8,24,1,25,1,
25,1,25,5,25,330,8,25,10,25,12,25,333,9,25,1,26,1,26,1,26,5,26,338,8,26,
10,26,12,26,341,9,26,1,27,1,27,1,27,5,27,346,8,27,10,27,12,27,349,9,27,1,
28,1,28,1,28,5,28,354,8,28,10,28,12,28,357,9,28,1,29,1,29,1,29,5,29,362,
8,29,10,29,12,29,365,9,29,1,30,1,30,1,30,5,30,370,8,30,10,30,12,30,373,9,
30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,3,31,384,8,31,3,31,386,8,
31,1,32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,
1,33,1,33,1,33,3,33,405,8,33,1,33,3,33,408,8,33,3,33,410,8,33,1,34,1,34,
1,34,1,34,5,34,416,8,34,10,34,12,34,419,9,34,1,34,1,34,1,35,1,35,3,35,425,
8,35,1,35,1,35,1,35,0,0,36,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,
34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,0,12,2,0,4,5,7,
8,1,0,4,7,1,0,28,29,1,0,24,25,2,0,31,35,44,44,1,0,36,37,2,0,38,39,45,46,
1,0,47,48,1,0,49,51,3,0,42,43,47,48,52,52,1,0,42,43,1,0,10,16,454,0,75,1,
0,0,0,2,89,1,0,0,0,4,93,1,0,0,0,6,107,1,0,0,0,8,121,1,0,0,0,10,151,1,0,0,
0,12,156,1,0,0,0,14,167,1,0,0,0,16,174,1,0,0,0,18,176,1,0,0,0,20,187,1,0,
0,0,22,195,1,0,0,0,24,204,1,0,0,0,26,206,1,0,0,0,28,208,1,0,0,0,30,216,1,
0,0,0,32,280,1,0,0,0,34,284,1,0,0,0,36,286,1,0,0,0,38,295,1,0,0,0,40,300,
1,0,0,0,42,308,1,0,0,0,44,310,1,0,0,0,46,316,1,0,0,0,48,318,1,0,0,0,50,326,
1,0,0,0,52,334,1,0,0,0,54,342,1,0,0,0,56,350,1,0,0,0,58,358,1,0,0,0,60,366,
1,0,0,0,62,385,1,0,0,0,64,387,1,0,0,0,66,409,1,0,0,0,68,411,1,0,0,0,70,422,
1,0,0,0,72,74,3,2,1,0,73,72,1,0,0,0,74,77,1,0,0,0,75,73,1,0,0,0,75,76,1,
0,0,0,76,85,1,0,0,0,77,75,1,0,0,0,78,86,3,4,2,0,79,81,3,6,3,0,80,79,1,0,
0,0,81,84,1,0,0,0,82,80,1,0,0,0,82,83,1,0,0,0,83,86,1,0,0,0,84,82,1,0,0,
0,85,78,1,0,0,0,85,82,1,0,0,0,86,87,1,0,0,0,87,88,5,0,0,1,88,1,1,0,0,0,89,
90,5,1,0,0,90,91,3,28,14,0,91,92,5,55,0,0,92,3,1,0,0,0,93,94,5,2,0,0,94,
95,3,28,14,0,95,99,5,60,0,0,96,98,3,6,3,0,97,96,1,0,0,0,98,101,1,0,0,0,99,
97,1,0,0,0,99,100,1,0,0,0,100,102,1,0,0,0,101,99,1,0,0,0,102,103,5,61,0,
0,103,5,1,0,0,0,104,106,3,8,4,0,105,104,1,0,0,0,106,109,1,0,0,0,107,105,
1,0,0,0,107,108,1,0,0,0,108,110,1,0,0,0,109,107,1,0,0,0,110,111,5,3,0,0,
111,112,3,26,13,0,112,116,5,60,0,0,113,115,3,10,5,0,114,113,1,0,0,0,115,
118,1,0,0,0,116,114,1,0,0,0,116,117,1,0,0,0,117,119,1,0,0,0,118,116,1,0,
0,0,119,120,5,61,0,0,120,7,1,0,0,0,121,122,7,0,0,0,122,9,1,0,0,0,123,152,
3,12,6,0,124,126,3,14,7,0,125,124,1,0,0,0,126,129,1,0,0,0,127,125,1,0,0,
0,127,128,1,0,0,0,128,133,1,0,0,0,129,127,1,0,0,0,130,132,3,16,8,0,131,130,
1,0,0,0,132,135,1,0,0,0,133,131,1,0,0,0,133,134,1,0,0,0,134,137,1,0,0,0,
135,133,1,0,0,0,136,138,5,9,0,0,137,136,1,0,0,0,137,138,1,0,0,0,138,139,
1,0,0,0,139,140,3,24,12,0,140,142,3,26,13,0,141,143,3,18,9,0,142,141,1,0,
0,0,142,143,1,0,0,0,143,144,1,0,0,0,144,146,5,58,0,0,145,147,3,20,10,0,146,
145,1,0,0,0,146,147,1,0,0,0,147,148,1,0,0,0,148,149,5,59,0,0,149,150,3,30,
15,0,150,152,1,0,0,0,151,123,1,0,0,0,151,127,1,0,0,0,152,11,1,0,0,0,153,
155,3,16,8,0,154,153,1,0,0,0,155,158,1,0,0,0,156,154,1,0,0,0,156,157,1,0,
0,0,157,159,1,0,0,0,158,156,1,0,0,0,159,160,3,26,13,0,160,162,5,58,0,0,161,
163,3,20,10,0,162,161,1,0,0,0,162,163,1,0,0,0,163,164,1,0,0,0,164,165,5,
59,0,0,165,166,3,30,15,0,166,13,1,0,0,0,167,168,5,62,0,0,168,170,3,26,13,
0,169,171,3,70,35,0,170,169,1,0,0,0,170,171,1,0,0,0,171,172,1,0,0,0,172,
173,5,63,0,0,173,15,1,0,0,0,174,175,7,1,0,0,175,17,1,0,0,0,176,177,5,45,
0,0,177,182,3,26,13,0,178,179,5,56,0,0,179,181,3,26,13,0,180,178,1,0,0,0,
181,184,1,0,0,0,182,180,1,0,0,0,182,183,1,0,0,0,183,185,1,0,0,0,184,182,
1,0,0,0,185,186,5,46,0,0,186,19,1,0,0,0,187,192,3,22,11,0,188,189,5,56,0,
0,189,191,3,22,11,0,190,188,1,0,0,0,191,194,1,0,0,0,192,190,1,0,0,0,192,
193,1,0,0,0,193,21,1,0,0,0,194,192,1,0,0,0,195,196,3,24,12,0,196,197,3,26,
13,0,197,23,1,0,0,0,198,205,3,64,32,0,199,205,5,17,0,0,200,202,3,26,13,0,
201,203,3,68,34,0,202,201,1,0,0,0,202,203,1,0,0,0,203,205,1,0,0,0,204,198,
1,0,0,0,204,199,1,0,0,0,204,200,1,0,0,0,205,25,1,0,0,0,206,207,5,65,0,0,
207,27,1,0,0,0,208,213,3,26,13,0,209,210,5,57,0,0,210,212,3,26,13,0,211,
209,1,0,0,0,212,215,1,0,0,0,213,211,1,0,0,0,213,214,1,0,0,0,214,29,1,0,0,
0,215,213,1,0,0,0,216,220,5,60,0,0,217,219,3,32,16,0,218,217,1,0,0,0,219,
222,1,0,0,0,220,218,1,0,0,0,220,221,1,0,0,0,221,223,1,0,0,0,222,220,1,0,
0,0,223,224,5,61,0,0,224,31,1,0,0,0,225,281,3,30,15,0,226,227,7,2,0,0,227,
281,3,30,15,0,228,281,5,55,0,0,229,230,5,18,0,0,230,231,5,58,0,0,231,232,
3,42,21,0,232,233,5,59,0,0,233,236,3,32,16,0,234,235,5,19,0,0,235,237,3,
32,16,0,236,234,1,0,0,0,236,237,1,0,0,0,237,281,1,0,0,0,238,239,5,20,0,0,
239,240,5,58,0,0,240,241,3,42,21,0,241,242,5,59,0,0,242,243,3,32,16,0,243,
281,1,0,0,0,244,245,5,21,0,0,245,246,3,32,16,0,246,247,5,20,0,0,247,248,
5,58,0,0,248,249,3,42,21,0,249,250,5,59,0,0,250,251,5,55,0,0,251,281,1,0,
0,0,252,253,5,22,0,0,253,255,5,58,0,0,254,256,3,34,17,0,255,254,1,0,0,0,
255,256,1,0,0,0,256,257,1,0,0,0,257,259,5,55,0,0,258,260,3,42,21,0,259,258,
1,0,0,0,259,260,1,0,0,0,260,261,1,0,0,0,261,263,5,55,0,0,262,264,3,40,20,
0,263,262,1,0,0,0,263,264,1,0,0,0,264,265,1,0,0,0,265,266,5,59,0,0,266,281,
3,32,16,0,267,269,5,23,0,0,268,270,3,42,21,0,269,268,1,0,0,0,269,270,1,0,
0,0,270,271,1,0,0,0,271,281,5,55,0,0,272,273,7,3,0,0,273,281,5,55,0,0,274,
275,3,36,18,0,275,276,5,55,0,0,276,281,1,0,0,0,277,278,3,42,21,0,278,279,
5,55,0,0,279,281,1,0,0,0,280,225,1,0,0,0,280,226,1,0,0,0,280,228,1,0,0,0,
280,229,1,0,0,0,280,238,1,0,0,0,280,244,1,0,0,0,280,252,1,0,0,0,280,267,
1,0,0,0,280,272,1,0,0,0,280,274,1,0,0,0,280,277,1,0,0,0,281,33,1,0,0,0,282,
285,3,36,18,0,283,285,3,40,20,0,284,282,1,0,0,0,284,283,1,0,0,0,285,35,1,
0,0,0,286,287,3,24,12,0,287,292,3,38,19,0,288,289,5,56,0,0,289,291,3,38,
19,0,290,288,1,0,0,0,291,294,1,0,0,0,292,290,1,0,0,0,292,293,1,0,0,0,293,
37,1,0,0,0,294,292,1,0,0,0,295,298,3,26,13,0,296,297,5,44,0,0,297,299,3,
42,21,0,298,296,1,0,0,0,298,299,1,0,0,0,299,39,1,0,0,0,300,305,3,42,21,0,
301,302,5,56,0,0,302,304,3,42,21,0,303,301,1,0,0,0,304,307,1,0,0,0,305,303,
1,0,0,0,305,306,1,0,0,0,306,41,1,0,0,0,307,305,1,0,0,0,308,309,3,44,22,0,
309,43,1,0,0,0,310,314,3,48,24,0,311,312,3,46,23,0,312,313,3,44,22,0,313,
315,1,0,0,0,314,311,1,0,0,0,314,315,1,0,0,0,315,45,1,0,0,0,316,317,7,4,0,
0,317,47,1,0,0,0,318,324,3,50,25,0,319,320,5,53,0,0,320,321,3,42,21,0,321,
322,5,54,0,0,322,323,3,42,21,0,323,325,1,0,0,0,324,319,1,0,0,0,324,325,1,
0,0,0,325,49,1,0,0,0,326,331,3,52,26,0,327,328,5,41,0,0,328,330,3,52,26,
0,329,327,1,0,0,0,330,333,1,0,0,0,331,329,1,0,0,0,331,332,1,0,0,0,332,51,
1,0,0,0,333,331,1,0,0,0,334,339,3,54,27,0,335,336,5,40,0,0,336,338,3,54,
27,0,337,335,1,0,0,0,338,341,1,0,0,0,339,337,1,0,0,0,339,340,1,0,0,0,340,
53,1,0,0,0,341,339,1,0,0,0,342,347,3,56,28,0,343,344,7,5,0,0,344,346,3,56,
28,0,345,343,1,0,0,0,346,349,1,0,0,0,347,345,1,0,0,0,347,348,1,0,0,0,348,
55,1,0,0,0,349,347,1,0,0,0,350,355,3,58,29,0,351,352,7,6,0,0,352,354,3,58,
29,0,353,351,1,0,0,0,354,357,1,0,0,0,355,353,1,0,0,0,355,356,1,0,0,0,356,
57,1,0,0,0,357,355,1,0,0,0,358,363,3,60,30,0,359,360,7,7,0,0,360,362,3,60,
30,0,361,359,1,0,0,0,362,365,1,0,0,0,363,361,1,0,0,0,363,364,1,0,0,0,364,
59,1,0,0,0,365,363,1,0,0,0,366,371,3,62,31,0,367,368,7,8,0,0,368,370,3,62,
31,0,369,367,1,0,0,0,370,373,1,0,0,0,371,369,1,0,0,0,371,372,1,0,0,0,372,
61,1,0,0,0,373,371,1,0,0,0,374,375,7,9,0,0,375,386,3,62,31,0,376,377,5,58,
0,0,377,378,3,64,32,0,378,379,5,59,0,0,379,380,3,62,31,0,380,386,1,0,0,0,
381,383,3,66,33,0,382,384,7,10,0,0,383,382,1,0,0,0,383,384,1,0,0,0,384,386,
1,0,0,0,385,374,1,0,0,0,385,376,1,0,0,0,385,381,1,0,0,0,386,63,1,0,0,0,387,
388,7,11,0,0,388,65,1,0,0,0,389,410,5,64,0,0,390,410,5,66,0,0,391,410,5,
26,0,0,392,410,5,27,0,0,393,394,7,2,0,0,394,395,5,58,0,0,395,396,3,42,21,
0,396,397,5,59,0,0,397,410,1,0,0,0,398,399,5,58,0,0,399,400,3,42,21,0,400,
401,5,59,0,0,401,410,1,0,0,0,402,407,3,28,14,0,403,405,3,68,34,0,404,403,
1,0,0,0,404,405,1,0,0,0,405,406,1,0,0,0,406,408,3,70,35,0,407,404,1,0,0,
0,407,408,1,0,0,0,408,410,1,0,0,0,409,389,1,0,0,0,409,390,1,0,0,0,409,391,
1,0,0,0,409,392,1,0,0,0,409,393,1,0,0,0,409,398,1,0,0,0,409,402,1,0,0,0,
410,67,1,0,0,0,411,412,5,45,0,0,412,417,3,24,12,0,413,414,5,56,0,0,414,416,
3,24,12,0,415,413,1,0,0,0,416,419,1,0,0,0,417,415,1,0,0,0,417,418,1,0,0,
0,418,420,1,0,0,0,419,417,1,0,0,0,420,421,5,46,0,0,421,69,1,0,0,0,422,424,
5,58,0,0,423,425,3,40,20,0,424,423,1,0,0,0,424,425,1,0,0,0,425,426,1,0,0,
0,426,427,5,59,0,0,427,71,1,0,0,0,46,75,82,85,99,107,116,127,133,137,142,
146,151,156,162,170,182,192,202,204,213,220,236,255,259,263,269,280,284,
292,298,305,314,324,331,339,347,355,363,371,383,385,404,407,409,417,424];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class CsharpParser extends antlr4.Parser {

    static grammarFileName = "Csharp.g4";
    static literalNames = [ null, "'using'", "'namespace'", "'class'", "'public'",
                            "'internal'", "'private'", "'static'", "'sealed'",
                            "'async'", "'int'", "'sbyte'", "'byte'", "'short'",
                            "'ushort'", "'bool'", "'string'", "'void'",
                            "'if'", "'else'", "'while'", "'do'", "'for'",
                            "'return'", "'break'", "'continue'", "'true'",
                            "'false'", "'unchecked'", "'checked'", null,
                            "'+='", "'-='", "'*='", "'/='", "'%='", "'=='",
                            "'!='", "'<='", "'>='", "'&&'", "'||'", "'++'",
                            "'--'", "'='", "'<'", "'>'", "'+'", "'-'", "'*'",
                            "'/'", "'%'", "'!'", "'?'", "':'", "';'", "','",
                            "'.'", "'('", "')'", "'{'", "'}'", "'['", "']'" ];
    static symbolicNames = [ null, "USING", "NAMESPACE", "CLASS", "PUBLIC",
                             "INTERNAL", "PRIVATE", "STATIC", "SEALED",
                             "ASYNC", "INT", "SBYTE", "BYTE", "SHORT", "USHORT",
                             "BOOL", "STRING", "VOID", "IF", "ELSE", "WHILE",
                             "DO", "FOR", "RETURN", "BREAK", "CONTINUE",
                             "TRUE", "FALSE", "UNCHECKED", "CHECKED", "UNSUPPORTED_KEYWORD",
                             "PLUS_ASSIGN", "MINUS_ASSIGN", "MUL_ASSIGN",
                             "DIV_ASSIGN", "MOD_ASSIGN", "EQ", "NE", "LE",
                             "GE", "AND_AND", "OR_OR", "INC", "DEC", "ASSIGN",
                             "LT", "GT", "PLUS", "MINUS", "MUL", "DIV",
                             "MOD", "NOT", "QUESTION", "COLON", "SEMI",
                             "COMMA", "DOT", "LPAREN", "RPAREN", "LBRACE",
                             "RBRACE", "LBRACKET", "RBRACKET", "INTEGER_LITERAL",
                             "IDENTIFIER", "STRING_LITERAL", "UNTERMINATED_STRING",
                             "BLOCK_COMMENT", "UNTERMINATED_COMMENT", "LINE_COMMENT",
                             "WHITESPACE", "INVALID_CHARACTER" ];
    static ruleNames = [ "compilationUnit", "usingDirective", "namespaceDeclaration",
                         "classDeclaration", "classModifier", "memberDeclaration",
                         "constructorDeclaration", "attributeSection", "methodModifier",
                         "typeParameters", "parameters", "parameter", "type",
                         "identifier", "qualifiedName", "block", "statement",
                         "forInitializer", "declaration", "variableDeclarator",
                         "expressionList", "expression", "assignmentExpression",
                         "assignmentOperator", "conditionalExpression",
                         "logicalOr", "logicalAnd", "equality", "relational",
                         "additive", "multiplicative", "unary", "scalarCastType",
                         "primary", "typeArguments", "arguments" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = CsharpParser.ruleNames;
        this.literalNames = CsharpParser.literalNames;
        this.symbolicNames = CsharpParser.symbolicNames;
    }



	compilationUnit() {
	    let localctx = new CompilationUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, CsharpParser.RULE_compilationUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 75;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1) {
	            this.state = 72;
	            this.usingDirective();
	            this.state = 77;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 85;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 2:
	            this.state = 78;
	            this.namespaceDeclaration();
	            break;
	        case -1:
	        case 3:
	        case 4:
	        case 5:
	        case 7:
	        case 8:
	            this.state = 82;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while((((_la) & ~0x1f) === 0 && ((1 << _la) & 440) !== 0)) {
	                this.state = 79;
	                this.classDeclaration();
	                this.state = 84;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 87;
	        this.match(CsharpParser.EOF);
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



	usingDirective() {
	    let localctx = new UsingDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, CsharpParser.RULE_usingDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 89;
	        this.match(CsharpParser.USING);
	        this.state = 90;
	        this.qualifiedName();
	        this.state = 91;
	        this.match(CsharpParser.SEMI);
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



	namespaceDeclaration() {
	    let localctx = new NamespaceDeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, CsharpParser.RULE_namespaceDeclaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 93;
	        this.match(CsharpParser.NAMESPACE);
	        this.state = 94;
	        this.qualifiedName();
	        this.state = 95;
	        this.match(CsharpParser.LBRACE);
	        this.state = 99;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 440) !== 0)) {
	            this.state = 96;
	            this.classDeclaration();
	            this.state = 101;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 102;
	        this.match(CsharpParser.RBRACE);
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



	classDeclaration() {
	    let localctx = new ClassDeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, CsharpParser.RULE_classDeclaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 107;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 432) !== 0)) {
	            this.state = 104;
	            this.classModifier();
	            this.state = 109;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 110;
	        this.match(CsharpParser.CLASS);
	        this.state = 111;
	        this.identifier();
	        this.state = 112;
	        this.match(CsharpParser.LBRACE);
	        this.state = 116;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 261872) !== 0) || _la===62 || _la===65) {
	            this.state = 113;
	            this.memberDeclaration();
	            this.state = 118;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 119;
	        this.match(CsharpParser.RBRACE);
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



	classModifier() {
	    let localctx = new ClassModifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, CsharpParser.RULE_classModifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 121;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 432) !== 0))) {
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



	memberDeclaration() {
	    let localctx = new MemberDeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, CsharpParser.RULE_memberDeclaration);
	    var _la = 0;
	    try {
	        this.state = 151;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,11,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 123;
	            this.constructorDeclaration();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 127;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===62) {
	                this.state = 124;
	                this.attributeSection();
	                this.state = 129;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 133;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while((((_la) & ~0x1f) === 0 && ((1 << _la) & 240) !== 0)) {
	                this.state = 130;
	                this.methodModifier();
	                this.state = 135;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 137;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===9) {
	                this.state = 136;
	                this.match(CsharpParser.ASYNC);
	            }

	            this.state = 139;
	            this.type();
	            this.state = 140;
	            this.identifier();
	            this.state = 142;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===45) {
	                this.state = 141;
	                this.typeParameters();
	            }

	            this.state = 144;
	            this.match(CsharpParser.LPAREN);
	            this.state = 146;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 261120) !== 0) || _la===65) {
	                this.state = 145;
	                this.parameters();
	            }

	            this.state = 148;
	            this.match(CsharpParser.RPAREN);
	            this.state = 149;
	            this.block();
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



	constructorDeclaration() {
	    let localctx = new ConstructorDeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, CsharpParser.RULE_constructorDeclaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 156;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 240) !== 0)) {
	            this.state = 153;
	            this.methodModifier();
	            this.state = 158;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 159;
	        this.identifier();
	        this.state = 160;
	        this.match(CsharpParser.LPAREN);
	        this.state = 162;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 261120) !== 0) || _la===65) {
	            this.state = 161;
	            this.parameters();
	        }

	        this.state = 164;
	        this.match(CsharpParser.RPAREN);
	        this.state = 165;
	        this.block();
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



	attributeSection() {
	    let localctx = new AttributeSectionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, CsharpParser.RULE_attributeSection);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 167;
	        this.match(CsharpParser.LBRACKET);
	        this.state = 168;
	        this.identifier();
	        this.state = 170;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===58) {
	            this.state = 169;
	            this.arguments();
	        }

	        this.state = 172;
	        this.match(CsharpParser.RBRACKET);
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



	methodModifier() {
	    let localctx = new MethodModifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, CsharpParser.RULE_methodModifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 174;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 240) !== 0))) {
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



	typeParameters() {
	    let localctx = new TypeParametersContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, CsharpParser.RULE_typeParameters);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 176;
	        this.match(CsharpParser.LT);
	        this.state = 177;
	        this.identifier();
	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 178;
	            this.match(CsharpParser.COMMA);
	            this.state = 179;
	            this.identifier();
	            this.state = 184;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 185;
	        this.match(CsharpParser.GT);
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



	parameters() {
	    let localctx = new ParametersContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, CsharpParser.RULE_parameters);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 187;
	        this.parameter();
	        this.state = 192;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 188;
	            this.match(CsharpParser.COMMA);
	            this.state = 189;
	            this.parameter();
	            this.state = 194;
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



	parameter() {
	    let localctx = new ParameterContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, CsharpParser.RULE_parameter);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 195;
	        this.type();
	        this.state = 196;
	        this.identifier();
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



	type() {
	    let localctx = new TypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, CsharpParser.RULE_type);
	    var _la = 0;
	    try {
	        this.state = 204;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 10:
	        case 11:
	        case 12:
	        case 13:
	        case 14:
	        case 15:
	        case 16:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 198;
	            this.scalarCastType();
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 199;
	            this.match(CsharpParser.VOID);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 200;
	            this.identifier();
	            this.state = 202;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===45) {
	                this.state = 201;
	                this.typeArguments();
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



	identifier() {
	    let localctx = new IdentifierContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, CsharpParser.RULE_identifier);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 206;
	        this.match(CsharpParser.IDENTIFIER);
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



	qualifiedName() {
	    let localctx = new QualifiedNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, CsharpParser.RULE_qualifiedName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 208;
	        this.identifier();
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 209;
	            this.match(CsharpParser.DOT);
	            this.state = 210;
	            this.identifier();
	            this.state = 215;
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



	block() {
	    let localctx = new BlockContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, CsharpParser.RULE_block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 216;
	        this.match(CsharpParser.LBRACE);
	        this.state = 220;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 1073216512) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29697123) !== 0)) {
	            this.state = 217;
	            this.statement();
	            this.state = 222;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 223;
	        this.match(CsharpParser.RBRACE);
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
	    this.enterRule(localctx, 32, CsharpParser.RULE_statement);
	    var _la = 0;
	    try {
	        this.state = 280;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,26,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 225;
	            this.block();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 226;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 227;
	            this.block();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 228;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 229;
	            this.match(CsharpParser.IF);
	            this.state = 230;
	            this.match(CsharpParser.LPAREN);
	            this.state = 231;
	            this.expression();
	            this.state = 232;
	            this.match(CsharpParser.RPAREN);
	            this.state = 233;
	            this.statement();
	            this.state = 236;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,21,this._ctx);
	            if(la_===1) {
	                this.state = 234;
	                this.match(CsharpParser.ELSE);
	                this.state = 235;
	                this.statement();

	            }
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 238;
	            this.match(CsharpParser.WHILE);
	            this.state = 239;
	            this.match(CsharpParser.LPAREN);
	            this.state = 240;
	            this.expression();
	            this.state = 241;
	            this.match(CsharpParser.RPAREN);
	            this.state = 242;
	            this.statement();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 244;
	            this.match(CsharpParser.DO);
	            this.state = 245;
	            this.statement();
	            this.state = 246;
	            this.match(CsharpParser.WHILE);
	            this.state = 247;
	            this.match(CsharpParser.LPAREN);
	            this.state = 248;
	            this.expression();
	            this.state = 249;
	            this.match(CsharpParser.RPAREN);
	            this.state = 250;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 252;
	            this.match(CsharpParser.FOR);
	            this.state = 253;
	            this.match(CsharpParser.LPAREN);
	            this.state = 255;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006894080) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 254;
	                this.forInitializer();
	            }

	            this.state = 257;
	            this.match(CsharpParser.SEMI);
	            this.state = 259;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 258;
	                localctx.condition = this.expression();
	            }

	            this.state = 261;
	            this.match(CsharpParser.SEMI);
	            this.state = 263;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 262;
	                localctx.increment = this.expressionList();
	            }

	            this.state = 265;
	            this.match(CsharpParser.RPAREN);
	            this.state = 266;
	            this.statement();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 267;
	            this.match(CsharpParser.RETURN);
	            this.state = 269;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 268;
	                this.expression();
	            }

	            this.state = 271;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 9:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 272;
	            _la = this._input.LA(1);
	            if(!(_la===24 || _la===25)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 273;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 10:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 274;
	            this.declaration();
	            this.state = 275;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 11:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 277;
	            this.expression();
	            this.state = 278;
	            this.match(CsharpParser.SEMI);
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



	forInitializer() {
	    let localctx = new ForInitializerContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, CsharpParser.RULE_forInitializer);
	    try {
	        this.state = 284;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,27,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 282;
	            this.declaration();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 283;
	            this.expressionList();
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



	declaration() {
	    let localctx = new DeclarationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, CsharpParser.RULE_declaration);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 286;
	        this.type();
	        this.state = 287;
	        this.variableDeclarator();
	        this.state = 292;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 288;
	            this.match(CsharpParser.COMMA);
	            this.state = 289;
	            this.variableDeclarator();
	            this.state = 294;
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



	variableDeclarator() {
	    let localctx = new VariableDeclaratorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, CsharpParser.RULE_variableDeclarator);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 295;
	        this.identifier();
	        this.state = 298;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===44) {
	            this.state = 296;
	            this.match(CsharpParser.ASSIGN);
	            this.state = 297;
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



	expressionList() {
	    let localctx = new ExpressionListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, CsharpParser.RULE_expressionList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 300;
	        this.expression();
	        this.state = 305;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 301;
	            this.match(CsharpParser.COMMA);
	            this.state = 302;
	            this.expression();
	            this.state = 307;
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



	expression() {
	    let localctx = new ExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, CsharpParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 308;
	        this.assignmentExpression();
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



	assignmentExpression() {
	    let localctx = new AssignmentExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, CsharpParser.RULE_assignmentExpression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 310;
	        this.conditionalExpression();
	        this.state = 314;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,31,this._ctx);
	        if(la_===1) {
	            this.state = 311;
	            this.assignmentOperator();
	            this.state = 312;
	            this.assignmentExpression();

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



	assignmentOperator() {
	    let localctx = new AssignmentOperatorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, CsharpParser.RULE_assignmentOperator);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 316;
	        _la = this._input.LA(1);
	        if(!(((((_la - 31)) & ~0x1f) === 0 && ((1 << (_la - 31)) & 8223) !== 0))) {
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



	conditionalExpression() {
	    let localctx = new ConditionalExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, CsharpParser.RULE_conditionalExpression);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 318;
	        this.logicalOr();
	        this.state = 324;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 319;
	            this.match(CsharpParser.QUESTION);
	            this.state = 320;
	            this.expression();
	            this.state = 321;
	            this.match(CsharpParser.COLON);
	            this.state = 322;
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



	logicalOr() {
	    let localctx = new LogicalOrContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, CsharpParser.RULE_logicalOr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 326;
	        this.logicalAnd();
	        this.state = 331;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===41) {
	            this.state = 327;
	            this.match(CsharpParser.OR_OR);
	            this.state = 328;
	            this.logicalAnd();
	            this.state = 333;
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
	    this.enterRule(localctx, 52, CsharpParser.RULE_logicalAnd);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 334;
	        this.equality();
	        this.state = 339;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===40) {
	            this.state = 335;
	            this.match(CsharpParser.AND_AND);
	            this.state = 336;
	            this.equality();
	            this.state = 341;
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
	    this.enterRule(localctx, 54, CsharpParser.RULE_equality);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 342;
	        this.relational();
	        this.state = 347;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===36 || _la===37) {
	            this.state = 343;
	            _la = this._input.LA(1);
	            if(!(_la===36 || _la===37)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 344;
	            this.relational();
	            this.state = 349;
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
	    this.enterRule(localctx, 56, CsharpParser.RULE_relational);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 350;
	        this.additive();
	        this.state = 355;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 387) !== 0)) {
	            this.state = 351;
	            _la = this._input.LA(1);
	            if(!(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 387) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 352;
	            this.additive();
	            this.state = 357;
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
	    this.enterRule(localctx, 58, CsharpParser.RULE_additive);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 358;
	        this.multiplicative();
	        this.state = 363;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===47 || _la===48) {
	            this.state = 359;
	            _la = this._input.LA(1);
	            if(!(_la===47 || _la===48)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 360;
	            this.multiplicative();
	            this.state = 365;
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



	multiplicative() {
	    let localctx = new MultiplicativeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, CsharpParser.RULE_multiplicative);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 366;
	        this.unary();
	        this.state = 371;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 7) !== 0)) {
	            this.state = 367;
	            _la = this._input.LA(1);
	            if(!(((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 368;
	            this.unary();
	            this.state = 373;
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



	unary() {
	    let localctx = new UnaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, CsharpParser.RULE_unary);
	    var _la = 0;
	    try {
	        this.state = 385;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,40,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 374;
	            _la = this._input.LA(1);
	            if(!(((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 1123) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 375;
	            this.unary();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 376;
	            this.match(CsharpParser.LPAREN);
	            this.state = 377;
	            this.scalarCastType();
	            this.state = 378;
	            this.match(CsharpParser.RPAREN);
	            this.state = 379;
	            this.unary();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 381;
	            this.primary();
	            this.state = 383;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===42 || _la===43) {
	                this.state = 382;
	                _la = this._input.LA(1);
	                if(!(_la===42 || _la===43)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
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



	scalarCastType() {
	    let localctx = new ScalarCastTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, CsharpParser.RULE_scalarCastType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 387;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 130048) !== 0))) {
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



	primary() {
	    let localctx = new PrimaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, CsharpParser.RULE_primary);
	    var _la = 0;
	    try {
	        this.state = 409;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 64:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 389;
	            this.match(CsharpParser.INTEGER_LITERAL);
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 390;
	            this.match(CsharpParser.STRING_LITERAL);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 391;
	            this.match(CsharpParser.TRUE);
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 392;
	            this.match(CsharpParser.FALSE);
	            break;
	        case 28:
	        case 29:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 393;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 394;
	            this.match(CsharpParser.LPAREN);
	            this.state = 395;
	            this.expression();
	            this.state = 396;
	            this.match(CsharpParser.RPAREN);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 398;
	            this.match(CsharpParser.LPAREN);
	            this.state = 399;
	            this.expression();
	            this.state = 400;
	            this.match(CsharpParser.RPAREN);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 402;
	            this.qualifiedName();
	            this.state = 407;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,42,this._ctx);
	            if(la_===1) {
	                this.state = 404;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	                if(_la===45) {
	                    this.state = 403;
	                    this.typeArguments();
	                }

	                this.state = 406;
	                this.arguments();

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



	typeArguments() {
	    let localctx = new TypeArgumentsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, CsharpParser.RULE_typeArguments);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 411;
	        this.match(CsharpParser.LT);
	        this.state = 412;
	        this.type();
	        this.state = 417;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 413;
	            this.match(CsharpParser.COMMA);
	            this.state = 414;
	            this.type();
	            this.state = 419;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 420;
	        this.match(CsharpParser.GT);
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



	arguments() {
	    let localctx = new ArgumentsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 70, CsharpParser.RULE_arguments);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 422;
	        this.match(CsharpParser.LPAREN);
	        this.state = 424;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	            this.state = 423;
	            this.expressionList();
	        }

	        this.state = 426;
	        this.match(CsharpParser.RPAREN);
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

CsharpParser.EOF = antlr4.Token.EOF;
CsharpParser.USING = 1;
CsharpParser.NAMESPACE = 2;
CsharpParser.CLASS = 3;
CsharpParser.PUBLIC = 4;
CsharpParser.INTERNAL = 5;
CsharpParser.PRIVATE = 6;
CsharpParser.STATIC = 7;
CsharpParser.SEALED = 8;
CsharpParser.ASYNC = 9;
CsharpParser.INT = 10;
CsharpParser.SBYTE = 11;
CsharpParser.BYTE = 12;
CsharpParser.SHORT = 13;
CsharpParser.USHORT = 14;
CsharpParser.BOOL = 15;
CsharpParser.STRING = 16;
CsharpParser.VOID = 17;
CsharpParser.IF = 18;
CsharpParser.ELSE = 19;
CsharpParser.WHILE = 20;
CsharpParser.DO = 21;
CsharpParser.FOR = 22;
CsharpParser.RETURN = 23;
CsharpParser.BREAK = 24;
CsharpParser.CONTINUE = 25;
CsharpParser.TRUE = 26;
CsharpParser.FALSE = 27;
CsharpParser.UNCHECKED = 28;
CsharpParser.CHECKED = 29;
CsharpParser.UNSUPPORTED_KEYWORD = 30;
CsharpParser.PLUS_ASSIGN = 31;
CsharpParser.MINUS_ASSIGN = 32;
CsharpParser.MUL_ASSIGN = 33;
CsharpParser.DIV_ASSIGN = 34;
CsharpParser.MOD_ASSIGN = 35;
CsharpParser.EQ = 36;
CsharpParser.NE = 37;
CsharpParser.LE = 38;
CsharpParser.GE = 39;
CsharpParser.AND_AND = 40;
CsharpParser.OR_OR = 41;
CsharpParser.INC = 42;
CsharpParser.DEC = 43;
CsharpParser.ASSIGN = 44;
CsharpParser.LT = 45;
CsharpParser.GT = 46;
CsharpParser.PLUS = 47;
CsharpParser.MINUS = 48;
CsharpParser.MUL = 49;
CsharpParser.DIV = 50;
CsharpParser.MOD = 51;
CsharpParser.NOT = 52;
CsharpParser.QUESTION = 53;
CsharpParser.COLON = 54;
CsharpParser.SEMI = 55;
CsharpParser.COMMA = 56;
CsharpParser.DOT = 57;
CsharpParser.LPAREN = 58;
CsharpParser.RPAREN = 59;
CsharpParser.LBRACE = 60;
CsharpParser.RBRACE = 61;
CsharpParser.LBRACKET = 62;
CsharpParser.RBRACKET = 63;
CsharpParser.INTEGER_LITERAL = 64;
CsharpParser.IDENTIFIER = 65;
CsharpParser.STRING_LITERAL = 66;
CsharpParser.UNTERMINATED_STRING = 67;
CsharpParser.BLOCK_COMMENT = 68;
CsharpParser.UNTERMINATED_COMMENT = 69;
CsharpParser.LINE_COMMENT = 70;
CsharpParser.WHITESPACE = 71;
CsharpParser.INVALID_CHARACTER = 72;

CsharpParser.RULE_compilationUnit = 0;
CsharpParser.RULE_usingDirective = 1;
CsharpParser.RULE_namespaceDeclaration = 2;
CsharpParser.RULE_classDeclaration = 3;
CsharpParser.RULE_classModifier = 4;
CsharpParser.RULE_memberDeclaration = 5;
CsharpParser.RULE_constructorDeclaration = 6;
CsharpParser.RULE_attributeSection = 7;
CsharpParser.RULE_methodModifier = 8;
CsharpParser.RULE_typeParameters = 9;
CsharpParser.RULE_parameters = 10;
CsharpParser.RULE_parameter = 11;
CsharpParser.RULE_type = 12;
CsharpParser.RULE_identifier = 13;
CsharpParser.RULE_qualifiedName = 14;
CsharpParser.RULE_block = 15;
CsharpParser.RULE_statement = 16;
CsharpParser.RULE_forInitializer = 17;
CsharpParser.RULE_declaration = 18;
CsharpParser.RULE_variableDeclarator = 19;
CsharpParser.RULE_expressionList = 20;
CsharpParser.RULE_expression = 21;
CsharpParser.RULE_assignmentExpression = 22;
CsharpParser.RULE_assignmentOperator = 23;
CsharpParser.RULE_conditionalExpression = 24;
CsharpParser.RULE_logicalOr = 25;
CsharpParser.RULE_logicalAnd = 26;
CsharpParser.RULE_equality = 27;
CsharpParser.RULE_relational = 28;
CsharpParser.RULE_additive = 29;
CsharpParser.RULE_multiplicative = 30;
CsharpParser.RULE_unary = 31;
CsharpParser.RULE_scalarCastType = 32;
CsharpParser.RULE_primary = 33;
CsharpParser.RULE_typeArguments = 34;
CsharpParser.RULE_arguments = 35;

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
        this.ruleIndex = CsharpParser.RULE_compilationUnit;
    }

	EOF() {
	    return this.getToken(CsharpParser.EOF, 0);
	};

	namespaceDeclaration() {
	    return this.getTypedRuleContext(NamespaceDeclarationContext,0);
	};

	usingDirective = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(UsingDirectiveContext);
	    } else {
	        return this.getTypedRuleContext(UsingDirectiveContext,i);
	    }
	};

	classDeclaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClassDeclarationContext);
	    } else {
	        return this.getTypedRuleContext(ClassDeclarationContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitCompilationUnit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UsingDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_usingDirective;
    }

	USING() {
	    return this.getToken(CsharpParser.USING, 0);
	};

	qualifiedName() {
	    return this.getTypedRuleContext(QualifiedNameContext,0);
	};

	SEMI() {
	    return this.getToken(CsharpParser.SEMI, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitUsingDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class NamespaceDeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_namespaceDeclaration;
    }

	NAMESPACE() {
	    return this.getToken(CsharpParser.NAMESPACE, 0);
	};

	qualifiedName() {
	    return this.getTypedRuleContext(QualifiedNameContext,0);
	};

	LBRACE() {
	    return this.getToken(CsharpParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(CsharpParser.RBRACE, 0);
	};

	classDeclaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClassDeclarationContext);
	    } else {
	        return this.getTypedRuleContext(ClassDeclarationContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitNamespaceDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassDeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_classDeclaration;
    }

	CLASS() {
	    return this.getToken(CsharpParser.CLASS, 0);
	};

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	LBRACE() {
	    return this.getToken(CsharpParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(CsharpParser.RBRACE, 0);
	};

	classModifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClassModifierContext);
	    } else {
	        return this.getTypedRuleContext(ClassModifierContext,i);
	    }
	};

	memberDeclaration = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MemberDeclarationContext);
	    } else {
	        return this.getTypedRuleContext(MemberDeclarationContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitClassDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassModifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_classModifier;
    }

	PUBLIC() {
	    return this.getToken(CsharpParser.PUBLIC, 0);
	};

	INTERNAL() {
	    return this.getToken(CsharpParser.INTERNAL, 0);
	};

	STATIC() {
	    return this.getToken(CsharpParser.STATIC, 0);
	};

	SEALED() {
	    return this.getToken(CsharpParser.SEALED, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitClassModifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MemberDeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_memberDeclaration;
    }

	constructorDeclaration() {
	    return this.getTypedRuleContext(ConstructorDeclarationContext,0);
	};

	type() {
	    return this.getTypedRuleContext(TypeContext,0);
	};

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	attributeSection = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AttributeSectionContext);
	    } else {
	        return this.getTypedRuleContext(AttributeSectionContext,i);
	    }
	};

	methodModifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MethodModifierContext);
	    } else {
	        return this.getTypedRuleContext(MethodModifierContext,i);
	    }
	};

	ASYNC() {
	    return this.getToken(CsharpParser.ASYNC, 0);
	};

	typeParameters() {
	    return this.getTypedRuleContext(TypeParametersContext,0);
	};

	parameters() {
	    return this.getTypedRuleContext(ParametersContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitMemberDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConstructorDeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_constructorDeclaration;
    }

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	methodModifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MethodModifierContext);
	    } else {
	        return this.getTypedRuleContext(MethodModifierContext,i);
	    }
	};

	parameters() {
	    return this.getTypedRuleContext(ParametersContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitConstructorDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AttributeSectionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_attributeSection;
    }

	LBRACKET() {
	    return this.getToken(CsharpParser.LBRACKET, 0);
	};

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	RBRACKET() {
	    return this.getToken(CsharpParser.RBRACKET, 0);
	};

	arguments() {
	    return this.getTypedRuleContext(ArgumentsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitAttributeSection(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MethodModifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_methodModifier;
    }

	PUBLIC() {
	    return this.getToken(CsharpParser.PUBLIC, 0);
	};

	INTERNAL() {
	    return this.getToken(CsharpParser.INTERNAL, 0);
	};

	PRIVATE() {
	    return this.getToken(CsharpParser.PRIVATE, 0);
	};

	STATIC() {
	    return this.getToken(CsharpParser.STATIC, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitMethodModifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeParametersContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_typeParameters;
    }

	LT() {
	    return this.getToken(CsharpParser.LT, 0);
	};

	identifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(IdentifierContext);
	    } else {
	        return this.getTypedRuleContext(IdentifierContext,i);
	    }
	};

	GT() {
	    return this.getToken(CsharpParser.GT, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.COMMA);
	    } else {
	        return this.getToken(CsharpParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitTypeParameters(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParametersContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_parameters;
    }

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
	        return this.getTokens(CsharpParser.COMMA);
	    } else {
	        return this.getToken(CsharpParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitParameters(this);
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
        this.ruleIndex = CsharpParser.RULE_parameter;
    }

	type() {
	    return this.getTypedRuleContext(TypeContext,0);
	};

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitParameter(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_type;
    }

	scalarCastType() {
	    return this.getTypedRuleContext(ScalarCastTypeContext,0);
	};

	VOID() {
	    return this.getToken(CsharpParser.VOID, 0);
	};

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	typeArguments() {
	    return this.getTypedRuleContext(TypeArgumentsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IdentifierContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_identifier;
    }

	IDENTIFIER() {
	    return this.getToken(CsharpParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitIdentifier(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QualifiedNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_qualifiedName;
    }

	identifier = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(IdentifierContext);
	    } else {
	        return this.getTypedRuleContext(IdentifierContext,i);
	    }
	};

	DOT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.DOT);
	    } else {
	        return this.getToken(CsharpParser.DOT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitQualifiedName(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BlockContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_block;
    }

	LBRACE() {
	    return this.getToken(CsharpParser.LBRACE, 0);
	};

	RBRACE() {
	    return this.getToken(CsharpParser.RBRACE, 0);
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
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitBlock(this);
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
        this.ruleIndex = CsharpParser.RULE_statement;
        this.condition = null;
        this.increment = null;
    }

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	CHECKED() {
	    return this.getToken(CsharpParser.CHECKED, 0);
	};

	UNCHECKED() {
	    return this.getToken(CsharpParser.UNCHECKED, 0);
	};

	SEMI = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.SEMI);
	    } else {
	        return this.getToken(CsharpParser.SEMI, i);
	    }
	};


	IF() {
	    return this.getToken(CsharpParser.IF, 0);
	};

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
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
	    return this.getToken(CsharpParser.ELSE, 0);
	};

	WHILE() {
	    return this.getToken(CsharpParser.WHILE, 0);
	};

	DO() {
	    return this.getToken(CsharpParser.DO, 0);
	};

	FOR() {
	    return this.getToken(CsharpParser.FOR, 0);
	};

	forInitializer() {
	    return this.getTypedRuleContext(ForInitializerContext,0);
	};

	expressionList() {
	    return this.getTypedRuleContext(ExpressionListContext,0);
	};

	RETURN() {
	    return this.getToken(CsharpParser.RETURN, 0);
	};

	BREAK() {
	    return this.getToken(CsharpParser.BREAK, 0);
	};

	CONTINUE() {
	    return this.getToken(CsharpParser.CONTINUE, 0);
	};

	declaration() {
	    return this.getTypedRuleContext(DeclarationContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ForInitializerContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_forInitializer;
    }

	declaration() {
	    return this.getTypedRuleContext(DeclarationContext,0);
	};

	expressionList() {
	    return this.getTypedRuleContext(ExpressionListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitForInitializer(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeclarationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_declaration;
    }

	type() {
	    return this.getTypedRuleContext(TypeContext,0);
	};

	variableDeclarator = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(VariableDeclaratorContext);
	    } else {
	        return this.getTypedRuleContext(VariableDeclaratorContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.COMMA);
	    } else {
	        return this.getToken(CsharpParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitDeclaration(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VariableDeclaratorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_variableDeclarator;
    }

	identifier() {
	    return this.getTypedRuleContext(IdentifierContext,0);
	};

	ASSIGN() {
	    return this.getToken(CsharpParser.ASSIGN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitVariableDeclarator(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_expressionList;
    }

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
	        return this.getTokens(CsharpParser.COMMA);
	    } else {
	        return this.getToken(CsharpParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitExpressionList(this);
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
        this.ruleIndex = CsharpParser.RULE_expression;
    }

	assignmentExpression() {
	    return this.getTypedRuleContext(AssignmentExpressionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_assignmentExpression;
    }

	conditionalExpression() {
	    return this.getTypedRuleContext(ConditionalExpressionContext,0);
	};

	assignmentOperator() {
	    return this.getTypedRuleContext(AssignmentOperatorContext,0);
	};

	assignmentExpression() {
	    return this.getTypedRuleContext(AssignmentExpressionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitAssignmentExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentOperatorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_assignmentOperator;
    }

	ASSIGN() {
	    return this.getToken(CsharpParser.ASSIGN, 0);
	};

	PLUS_ASSIGN() {
	    return this.getToken(CsharpParser.PLUS_ASSIGN, 0);
	};

	MINUS_ASSIGN() {
	    return this.getToken(CsharpParser.MINUS_ASSIGN, 0);
	};

	MUL_ASSIGN() {
	    return this.getToken(CsharpParser.MUL_ASSIGN, 0);
	};

	DIV_ASSIGN() {
	    return this.getToken(CsharpParser.DIV_ASSIGN, 0);
	};

	MOD_ASSIGN() {
	    return this.getToken(CsharpParser.MOD_ASSIGN, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitAssignmentOperator(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConditionalExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_conditionalExpression;
    }

	logicalOr() {
	    return this.getTypedRuleContext(LogicalOrContext,0);
	};

	QUESTION() {
	    return this.getToken(CsharpParser.QUESTION, 0);
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

	COLON() {
	    return this.getToken(CsharpParser.COLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitConditionalExpression(this);
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
        this.ruleIndex = CsharpParser.RULE_logicalOr;
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

	OR_OR = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.OR_OR);
	    } else {
	        return this.getToken(CsharpParser.OR_OR, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
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
        this.ruleIndex = CsharpParser.RULE_logicalAnd;
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

	AND_AND = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.AND_AND);
	    } else {
	        return this.getToken(CsharpParser.AND_AND, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
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
        this.ruleIndex = CsharpParser.RULE_equality;
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
	        return this.getTokens(CsharpParser.EQ);
	    } else {
	        return this.getToken(CsharpParser.EQ, i);
	    }
	};


	NE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.NE);
	    } else {
	        return this.getToken(CsharpParser.NE, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
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
        this.ruleIndex = CsharpParser.RULE_relational;
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
	        return this.getTokens(CsharpParser.LT);
	    } else {
	        return this.getToken(CsharpParser.LT, i);
	    }
	};


	LE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.LE);
	    } else {
	        return this.getToken(CsharpParser.LE, i);
	    }
	};


	GT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.GT);
	    } else {
	        return this.getToken(CsharpParser.GT, i);
	    }
	};


	GE = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.GE);
	    } else {
	        return this.getToken(CsharpParser.GE, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
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
        this.ruleIndex = CsharpParser.RULE_additive;
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
	        return this.getTokens(CsharpParser.PLUS);
	    } else {
	        return this.getToken(CsharpParser.PLUS, i);
	    }
	};


	MINUS = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.MINUS);
	    } else {
	        return this.getToken(CsharpParser.MINUS, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
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
        this.ruleIndex = CsharpParser.RULE_multiplicative;
    }

	unary = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(UnaryContext);
	    } else {
	        return this.getTypedRuleContext(UnaryContext,i);
	    }
	};

	MUL = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.MUL);
	    } else {
	        return this.getToken(CsharpParser.MUL, i);
	    }
	};


	DIV = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.DIV);
	    } else {
	        return this.getToken(CsharpParser.DIV, i);
	    }
	};


	MOD = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.MOD);
	    } else {
	        return this.getToken(CsharpParser.MOD, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitMultiplicative(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UnaryContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_unary;
    }

	unary() {
	    return this.getTypedRuleContext(UnaryContext,0);
	};

	PLUS() {
	    return this.getToken(CsharpParser.PLUS, 0);
	};

	MINUS() {
	    return this.getToken(CsharpParser.MINUS, 0);
	};

	NOT() {
	    return this.getToken(CsharpParser.NOT, 0);
	};

	INC() {
	    return this.getToken(CsharpParser.INC, 0);
	};

	DEC() {
	    return this.getToken(CsharpParser.DEC, 0);
	};

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	scalarCastType() {
	    return this.getTypedRuleContext(ScalarCastTypeContext,0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
	};

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitUnary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ScalarCastTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_scalarCastType;
    }

	INT() {
	    return this.getToken(CsharpParser.INT, 0);
	};

	SBYTE() {
	    return this.getToken(CsharpParser.SBYTE, 0);
	};

	BYTE() {
	    return this.getToken(CsharpParser.BYTE, 0);
	};

	SHORT() {
	    return this.getToken(CsharpParser.SHORT, 0);
	};

	USHORT() {
	    return this.getToken(CsharpParser.USHORT, 0);
	};

	BOOL() {
	    return this.getToken(CsharpParser.BOOL, 0);
	};

	STRING() {
	    return this.getToken(CsharpParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitScalarCastType(this);
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
        this.ruleIndex = CsharpParser.RULE_primary;
    }

	INTEGER_LITERAL() {
	    return this.getToken(CsharpParser.INTEGER_LITERAL, 0);
	};

	STRING_LITERAL() {
	    return this.getToken(CsharpParser.STRING_LITERAL, 0);
	};

	TRUE() {
	    return this.getToken(CsharpParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(CsharpParser.FALSE, 0);
	};

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
	};

	CHECKED() {
	    return this.getToken(CsharpParser.CHECKED, 0);
	};

	UNCHECKED() {
	    return this.getToken(CsharpParser.UNCHECKED, 0);
	};

	qualifiedName() {
	    return this.getTypedRuleContext(QualifiedNameContext,0);
	};

	arguments() {
	    return this.getTypedRuleContext(ArgumentsContext,0);
	};

	typeArguments() {
	    return this.getTypedRuleContext(TypeArgumentsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitPrimary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeArgumentsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_typeArguments;
    }

	LT() {
	    return this.getToken(CsharpParser.LT, 0);
	};

	type = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(TypeContext);
	    } else {
	        return this.getTypedRuleContext(TypeContext,i);
	    }
	};

	GT() {
	    return this.getToken(CsharpParser.GT, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(CsharpParser.COMMA);
	    } else {
	        return this.getToken(CsharpParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitTypeArguments(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArgumentsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = CsharpParser.RULE_arguments;
    }

	LPAREN() {
	    return this.getToken(CsharpParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(CsharpParser.RPAREN, 0);
	};

	expressionList() {
	    return this.getTypedRuleContext(ExpressionListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof CsharpVisitor ) {
	        return visitor.visitArguments(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




CsharpParser.CompilationUnitContext = CompilationUnitContext;
CsharpParser.UsingDirectiveContext = UsingDirectiveContext;
CsharpParser.NamespaceDeclarationContext = NamespaceDeclarationContext;
CsharpParser.ClassDeclarationContext = ClassDeclarationContext;
CsharpParser.ClassModifierContext = ClassModifierContext;
CsharpParser.MemberDeclarationContext = MemberDeclarationContext;
CsharpParser.ConstructorDeclarationContext = ConstructorDeclarationContext;
CsharpParser.AttributeSectionContext = AttributeSectionContext;
CsharpParser.MethodModifierContext = MethodModifierContext;
CsharpParser.TypeParametersContext = TypeParametersContext;
CsharpParser.ParametersContext = ParametersContext;
CsharpParser.ParameterContext = ParameterContext;
CsharpParser.TypeContext = TypeContext;
CsharpParser.IdentifierContext = IdentifierContext;
CsharpParser.QualifiedNameContext = QualifiedNameContext;
CsharpParser.BlockContext = BlockContext;
CsharpParser.StatementContext = StatementContext;
CsharpParser.ForInitializerContext = ForInitializerContext;
CsharpParser.DeclarationContext = DeclarationContext;
CsharpParser.VariableDeclaratorContext = VariableDeclaratorContext;
CsharpParser.ExpressionListContext = ExpressionListContext;
CsharpParser.ExpressionContext = ExpressionContext;
CsharpParser.AssignmentExpressionContext = AssignmentExpressionContext;
CsharpParser.AssignmentOperatorContext = AssignmentOperatorContext;
CsharpParser.ConditionalExpressionContext = ConditionalExpressionContext;
CsharpParser.LogicalOrContext = LogicalOrContext;
CsharpParser.LogicalAndContext = LogicalAndContext;
CsharpParser.EqualityContext = EqualityContext;
CsharpParser.RelationalContext = RelationalContext;
CsharpParser.AdditiveContext = AdditiveContext;
CsharpParser.MultiplicativeContext = MultiplicativeContext;
CsharpParser.UnaryContext = UnaryContext;
CsharpParser.ScalarCastTypeContext = ScalarCastTypeContext;
CsharpParser.PrimaryContext = PrimaryContext;
CsharpParser.TypeArgumentsContext = TypeArgumentsContext;
CsharpParser.ArgumentsContext = ArgumentsContext;
