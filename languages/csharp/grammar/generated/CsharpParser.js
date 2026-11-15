// Generated from Csharp.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import CsharpVisitor from './CsharpVisitor.js';

const serializedATN = [4,1,72,435,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,1,0,5,0,74,8,0,10,0,12,0,77,9,0,1,0,1,0,5,0,81,8,0,10,0,12,
0,84,9,0,3,0,86,8,0,1,0,1,0,1,1,1,1,1,1,1,1,1,2,1,2,1,2,1,2,5,2,98,8,2,10,
2,12,2,101,9,2,1,2,1,2,1,3,5,3,106,8,3,10,3,12,3,109,9,3,1,3,5,3,112,8,3,
10,3,12,3,115,9,3,1,3,1,3,1,3,1,3,5,3,121,8,3,10,3,12,3,124,9,3,1,3,1,3,
1,4,1,4,1,5,1,5,5,5,132,8,5,10,5,12,5,135,9,5,1,5,5,5,138,8,5,10,5,12,5,
141,9,5,1,5,3,5,144,8,5,1,5,1,5,1,5,3,5,149,8,5,1,5,1,5,3,5,153,8,5,1,5,
1,5,1,5,3,5,158,8,5,1,6,5,6,161,8,6,10,6,12,6,164,9,6,1,6,1,6,1,6,3,6,169,
8,6,1,6,1,6,1,6,1,7,1,7,1,7,3,7,177,8,7,1,7,1,7,1,8,1,8,1,9,1,9,1,9,1,9,
5,9,187,8,9,10,9,12,9,190,9,9,1,9,1,9,1,10,1,10,1,10,5,10,197,8,10,10,10,
12,10,200,9,10,1,11,1,11,1,11,1,12,1,12,1,12,1,12,3,12,209,8,12,3,12,211,
8,12,1,13,1,13,1,14,1,14,1,14,5,14,218,8,14,10,14,12,14,221,9,14,1,15,1,
15,5,15,225,8,15,10,15,12,15,228,9,15,1,15,1,15,1,16,1,16,1,16,1,16,1,16,
1,16,1,16,1,16,1,16,1,16,1,16,3,16,243,8,16,1,16,1,16,1,16,1,16,1,16,1,16,
1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,3,16,262,8,16,1,16,
1,16,3,16,266,8,16,1,16,1,16,3,16,270,8,16,1,16,1,16,1,16,1,16,3,16,276,
8,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,3,16,287,8,16,1,17,1,17,
3,17,291,8,17,1,18,1,18,1,18,1,18,5,18,297,8,18,10,18,12,18,300,9,18,1,19,
1,19,1,19,3,19,305,8,19,1,20,1,20,1,20,5,20,310,8,20,10,20,12,20,313,9,20,
1,21,1,21,1,22,1,22,1,22,1,22,3,22,321,8,22,1,23,1,23,1,24,1,24,1,24,1,24,
1,24,1,24,3,24,331,8,24,1,25,1,25,1,25,5,25,336,8,25,10,25,12,25,339,9,25,
1,26,1,26,1,26,5,26,344,8,26,10,26,12,26,347,9,26,1,27,1,27,1,27,5,27,352,
8,27,10,27,12,27,355,9,27,1,28,1,28,1,28,5,28,360,8,28,10,28,12,28,363,9,
28,1,29,1,29,1,29,5,29,368,8,29,10,29,12,29,371,9,29,1,30,1,30,1,30,5,30,
376,8,30,10,30,12,30,379,9,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,
31,3,31,390,8,31,3,31,392,8,31,1,32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,
33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,3,33,411,8,33,1,33,3,33,414,8,
33,3,33,416,8,33,1,34,1,34,1,34,1,34,5,34,422,8,34,10,34,12,34,425,9,34,
1,34,1,34,1,35,1,35,3,35,431,8,35,1,35,1,35,1,35,0,0,36,0,2,4,6,8,10,12,
14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,
62,64,66,68,70,0,12,2,0,4,5,7,8,1,0,4,7,1,0,28,29,1,0,24,25,2,0,31,35,44,
44,1,0,36,37,2,0,38,39,45,46,1,0,47,48,1,0,49,51,3,0,42,43,47,48,52,52,1,
0,42,43,1,0,10,16,461,0,75,1,0,0,0,2,89,1,0,0,0,4,93,1,0,0,0,6,107,1,0,0,
0,8,127,1,0,0,0,10,157,1,0,0,0,12,162,1,0,0,0,14,173,1,0,0,0,16,180,1,0,
0,0,18,182,1,0,0,0,20,193,1,0,0,0,22,201,1,0,0,0,24,210,1,0,0,0,26,212,1,
0,0,0,28,214,1,0,0,0,30,222,1,0,0,0,32,286,1,0,0,0,34,290,1,0,0,0,36,292,
1,0,0,0,38,301,1,0,0,0,40,306,1,0,0,0,42,314,1,0,0,0,44,316,1,0,0,0,46,322,
1,0,0,0,48,324,1,0,0,0,50,332,1,0,0,0,52,340,1,0,0,0,54,348,1,0,0,0,56,356,
1,0,0,0,58,364,1,0,0,0,60,372,1,0,0,0,62,391,1,0,0,0,64,393,1,0,0,0,66,415,
1,0,0,0,68,417,1,0,0,0,70,428,1,0,0,0,72,74,3,2,1,0,73,72,1,0,0,0,74,77,
1,0,0,0,75,73,1,0,0,0,75,76,1,0,0,0,76,85,1,0,0,0,77,75,1,0,0,0,78,86,3,
4,2,0,79,81,3,6,3,0,80,79,1,0,0,0,81,84,1,0,0,0,82,80,1,0,0,0,82,83,1,0,
0,0,83,86,1,0,0,0,84,82,1,0,0,0,85,78,1,0,0,0,85,82,1,0,0,0,86,87,1,0,0,
0,87,88,5,0,0,1,88,1,1,0,0,0,89,90,5,1,0,0,90,91,3,28,14,0,91,92,5,55,0,
0,92,3,1,0,0,0,93,94,5,2,0,0,94,95,3,28,14,0,95,99,5,60,0,0,96,98,3,6,3,
0,97,96,1,0,0,0,98,101,1,0,0,0,99,97,1,0,0,0,99,100,1,0,0,0,100,102,1,0,
0,0,101,99,1,0,0,0,102,103,5,61,0,0,103,5,1,0,0,0,104,106,3,14,7,0,105,104,
1,0,0,0,106,109,1,0,0,0,107,105,1,0,0,0,107,108,1,0,0,0,108,113,1,0,0,0,
109,107,1,0,0,0,110,112,3,8,4,0,111,110,1,0,0,0,112,115,1,0,0,0,113,111,
1,0,0,0,113,114,1,0,0,0,114,116,1,0,0,0,115,113,1,0,0,0,116,117,5,3,0,0,
117,118,3,26,13,0,118,122,5,60,0,0,119,121,3,10,5,0,120,119,1,0,0,0,121,
124,1,0,0,0,122,120,1,0,0,0,122,123,1,0,0,0,123,125,1,0,0,0,124,122,1,0,
0,0,125,126,5,61,0,0,126,7,1,0,0,0,127,128,7,0,0,0,128,9,1,0,0,0,129,158,
3,12,6,0,130,132,3,14,7,0,131,130,1,0,0,0,132,135,1,0,0,0,133,131,1,0,0,
0,133,134,1,0,0,0,134,139,1,0,0,0,135,133,1,0,0,0,136,138,3,16,8,0,137,136,
1,0,0,0,138,141,1,0,0,0,139,137,1,0,0,0,139,140,1,0,0,0,140,143,1,0,0,0,
141,139,1,0,0,0,142,144,5,9,0,0,143,142,1,0,0,0,143,144,1,0,0,0,144,145,
1,0,0,0,145,146,3,24,12,0,146,148,3,26,13,0,147,149,3,18,9,0,148,147,1,0,
0,0,148,149,1,0,0,0,149,150,1,0,0,0,150,152,5,58,0,0,151,153,3,20,10,0,152,
151,1,0,0,0,152,153,1,0,0,0,153,154,1,0,0,0,154,155,5,59,0,0,155,156,3,30,
15,0,156,158,1,0,0,0,157,129,1,0,0,0,157,133,1,0,0,0,158,11,1,0,0,0,159,
161,3,16,8,0,160,159,1,0,0,0,161,164,1,0,0,0,162,160,1,0,0,0,162,163,1,0,
0,0,163,165,1,0,0,0,164,162,1,0,0,0,165,166,3,26,13,0,166,168,5,58,0,0,167,
169,3,20,10,0,168,167,1,0,0,0,168,169,1,0,0,0,169,170,1,0,0,0,170,171,5,
59,0,0,171,172,3,30,15,0,172,13,1,0,0,0,173,174,5,62,0,0,174,176,3,26,13,
0,175,177,3,70,35,0,176,175,1,0,0,0,176,177,1,0,0,0,177,178,1,0,0,0,178,
179,5,63,0,0,179,15,1,0,0,0,180,181,7,1,0,0,181,17,1,0,0,0,182,183,5,45,
0,0,183,188,3,26,13,0,184,185,5,56,0,0,185,187,3,26,13,0,186,184,1,0,0,0,
187,190,1,0,0,0,188,186,1,0,0,0,188,189,1,0,0,0,189,191,1,0,0,0,190,188,
1,0,0,0,191,192,5,46,0,0,192,19,1,0,0,0,193,198,3,22,11,0,194,195,5,56,0,
0,195,197,3,22,11,0,196,194,1,0,0,0,197,200,1,0,0,0,198,196,1,0,0,0,198,
199,1,0,0,0,199,21,1,0,0,0,200,198,1,0,0,0,201,202,3,24,12,0,202,203,3,26,
13,0,203,23,1,0,0,0,204,211,3,64,32,0,205,211,5,17,0,0,206,208,3,26,13,0,
207,209,3,68,34,0,208,207,1,0,0,0,208,209,1,0,0,0,209,211,1,0,0,0,210,204,
1,0,0,0,210,205,1,0,0,0,210,206,1,0,0,0,211,25,1,0,0,0,212,213,5,65,0,0,
213,27,1,0,0,0,214,219,3,26,13,0,215,216,5,57,0,0,216,218,3,26,13,0,217,
215,1,0,0,0,218,221,1,0,0,0,219,217,1,0,0,0,219,220,1,0,0,0,220,29,1,0,0,
0,221,219,1,0,0,0,222,226,5,60,0,0,223,225,3,32,16,0,224,223,1,0,0,0,225,
228,1,0,0,0,226,224,1,0,0,0,226,227,1,0,0,0,227,229,1,0,0,0,228,226,1,0,
0,0,229,230,5,61,0,0,230,31,1,0,0,0,231,287,3,30,15,0,232,233,7,2,0,0,233,
287,3,30,15,0,234,287,5,55,0,0,235,236,5,18,0,0,236,237,5,58,0,0,237,238,
3,42,21,0,238,239,5,59,0,0,239,242,3,32,16,0,240,241,5,19,0,0,241,243,3,
32,16,0,242,240,1,0,0,0,242,243,1,0,0,0,243,287,1,0,0,0,244,245,5,20,0,0,
245,246,5,58,0,0,246,247,3,42,21,0,247,248,5,59,0,0,248,249,3,32,16,0,249,
287,1,0,0,0,250,251,5,21,0,0,251,252,3,32,16,0,252,253,5,20,0,0,253,254,
5,58,0,0,254,255,3,42,21,0,255,256,5,59,0,0,256,257,5,55,0,0,257,287,1,0,
0,0,258,259,5,22,0,0,259,261,5,58,0,0,260,262,3,34,17,0,261,260,1,0,0,0,
261,262,1,0,0,0,262,263,1,0,0,0,263,265,5,55,0,0,264,266,3,42,21,0,265,264,
1,0,0,0,265,266,1,0,0,0,266,267,1,0,0,0,267,269,5,55,0,0,268,270,3,40,20,
0,269,268,1,0,0,0,269,270,1,0,0,0,270,271,1,0,0,0,271,272,5,59,0,0,272,287,
3,32,16,0,273,275,5,23,0,0,274,276,3,42,21,0,275,274,1,0,0,0,275,276,1,0,
0,0,276,277,1,0,0,0,277,287,5,55,0,0,278,279,7,3,0,0,279,287,5,55,0,0,280,
281,3,36,18,0,281,282,5,55,0,0,282,287,1,0,0,0,283,284,3,42,21,0,284,285,
5,55,0,0,285,287,1,0,0,0,286,231,1,0,0,0,286,232,1,0,0,0,286,234,1,0,0,0,
286,235,1,0,0,0,286,244,1,0,0,0,286,250,1,0,0,0,286,258,1,0,0,0,286,273,
1,0,0,0,286,278,1,0,0,0,286,280,1,0,0,0,286,283,1,0,0,0,287,33,1,0,0,0,288,
291,3,36,18,0,289,291,3,40,20,0,290,288,1,0,0,0,290,289,1,0,0,0,291,35,1,
0,0,0,292,293,3,24,12,0,293,298,3,38,19,0,294,295,5,56,0,0,295,297,3,38,
19,0,296,294,1,0,0,0,297,300,1,0,0,0,298,296,1,0,0,0,298,299,1,0,0,0,299,
37,1,0,0,0,300,298,1,0,0,0,301,304,3,26,13,0,302,303,5,44,0,0,303,305,3,
42,21,0,304,302,1,0,0,0,304,305,1,0,0,0,305,39,1,0,0,0,306,311,3,42,21,0,
307,308,5,56,0,0,308,310,3,42,21,0,309,307,1,0,0,0,310,313,1,0,0,0,311,309,
1,0,0,0,311,312,1,0,0,0,312,41,1,0,0,0,313,311,1,0,0,0,314,315,3,44,22,0,
315,43,1,0,0,0,316,320,3,48,24,0,317,318,3,46,23,0,318,319,3,44,22,0,319,
321,1,0,0,0,320,317,1,0,0,0,320,321,1,0,0,0,321,45,1,0,0,0,322,323,7,4,0,
0,323,47,1,0,0,0,324,330,3,50,25,0,325,326,5,53,0,0,326,327,3,42,21,0,327,
328,5,54,0,0,328,329,3,42,21,0,329,331,1,0,0,0,330,325,1,0,0,0,330,331,1,
0,0,0,331,49,1,0,0,0,332,337,3,52,26,0,333,334,5,41,0,0,334,336,3,52,26,
0,335,333,1,0,0,0,336,339,1,0,0,0,337,335,1,0,0,0,337,338,1,0,0,0,338,51,
1,0,0,0,339,337,1,0,0,0,340,345,3,54,27,0,341,342,5,40,0,0,342,344,3,54,
27,0,343,341,1,0,0,0,344,347,1,0,0,0,345,343,1,0,0,0,345,346,1,0,0,0,346,
53,1,0,0,0,347,345,1,0,0,0,348,353,3,56,28,0,349,350,7,5,0,0,350,352,3,56,
28,0,351,349,1,0,0,0,352,355,1,0,0,0,353,351,1,0,0,0,353,354,1,0,0,0,354,
55,1,0,0,0,355,353,1,0,0,0,356,361,3,58,29,0,357,358,7,6,0,0,358,360,3,58,
29,0,359,357,1,0,0,0,360,363,1,0,0,0,361,359,1,0,0,0,361,362,1,0,0,0,362,
57,1,0,0,0,363,361,1,0,0,0,364,369,3,60,30,0,365,366,7,7,0,0,366,368,3,60,
30,0,367,365,1,0,0,0,368,371,1,0,0,0,369,367,1,0,0,0,369,370,1,0,0,0,370,
59,1,0,0,0,371,369,1,0,0,0,372,377,3,62,31,0,373,374,7,8,0,0,374,376,3,62,
31,0,375,373,1,0,0,0,376,379,1,0,0,0,377,375,1,0,0,0,377,378,1,0,0,0,378,
61,1,0,0,0,379,377,1,0,0,0,380,381,7,9,0,0,381,392,3,62,31,0,382,383,5,58,
0,0,383,384,3,64,32,0,384,385,5,59,0,0,385,386,3,62,31,0,386,392,1,0,0,0,
387,389,3,66,33,0,388,390,7,10,0,0,389,388,1,0,0,0,389,390,1,0,0,0,390,392,
1,0,0,0,391,380,1,0,0,0,391,382,1,0,0,0,391,387,1,0,0,0,392,63,1,0,0,0,393,
394,7,11,0,0,394,65,1,0,0,0,395,416,5,64,0,0,396,416,5,66,0,0,397,416,5,
26,0,0,398,416,5,27,0,0,399,400,7,2,0,0,400,401,5,58,0,0,401,402,3,42,21,
0,402,403,5,59,0,0,403,416,1,0,0,0,404,405,5,58,0,0,405,406,3,42,21,0,406,
407,5,59,0,0,407,416,1,0,0,0,408,413,3,28,14,0,409,411,3,68,34,0,410,409,
1,0,0,0,410,411,1,0,0,0,411,412,1,0,0,0,412,414,3,70,35,0,413,410,1,0,0,
0,413,414,1,0,0,0,414,416,1,0,0,0,415,395,1,0,0,0,415,396,1,0,0,0,415,397,
1,0,0,0,415,398,1,0,0,0,415,399,1,0,0,0,415,404,1,0,0,0,415,408,1,0,0,0,
416,67,1,0,0,0,417,418,5,45,0,0,418,423,3,24,12,0,419,420,5,56,0,0,420,422,
3,24,12,0,421,419,1,0,0,0,422,425,1,0,0,0,423,421,1,0,0,0,423,424,1,0,0,
0,424,426,1,0,0,0,425,423,1,0,0,0,426,427,5,46,0,0,427,69,1,0,0,0,428,430,
5,58,0,0,429,431,3,40,20,0,430,429,1,0,0,0,430,431,1,0,0,0,431,432,1,0,0,
0,432,433,5,59,0,0,433,71,1,0,0,0,47,75,82,85,99,107,113,122,133,139,143,
148,152,157,162,168,176,188,198,208,210,219,226,242,261,265,269,275,286,
290,298,304,311,320,330,337,345,353,361,369,377,389,391,410,413,415,423,
430];


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
	        case 62:
	            this.state = 82;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while((((_la) & ~0x1f) === 0 && ((1 << _la) & 440) !== 0) || _la===62) {
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
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 440) !== 0) || _la===62) {
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
	        while(_la===62) {
	            this.state = 104;
	            this.attributeSection();
	            this.state = 109;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 113;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 432) !== 0)) {
	            this.state = 110;
	            this.classModifier();
	            this.state = 115;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 116;
	        this.match(CsharpParser.CLASS);
	        this.state = 117;
	        this.identifier();
	        this.state = 118;
	        this.match(CsharpParser.LBRACE);
	        this.state = 122;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 261872) !== 0) || _la===62 || _la===65) {
	            this.state = 119;
	            this.memberDeclaration();
	            this.state = 124;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 125;
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
	        this.state = 127;
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
	        this.state = 157;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,12,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 129;
	            this.constructorDeclaration();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 133;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===62) {
	                this.state = 130;
	                this.attributeSection();
	                this.state = 135;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 139;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while((((_la) & ~0x1f) === 0 && ((1 << _la) & 240) !== 0)) {
	                this.state = 136;
	                this.methodModifier();
	                this.state = 141;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 143;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===9) {
	                this.state = 142;
	                this.match(CsharpParser.ASYNC);
	            }

	            this.state = 145;
	            this.type();
	            this.state = 146;
	            this.identifier();
	            this.state = 148;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===45) {
	                this.state = 147;
	                this.typeParameters();
	            }

	            this.state = 150;
	            this.match(CsharpParser.LPAREN);
	            this.state = 152;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 261120) !== 0) || _la===65) {
	                this.state = 151;
	                this.parameters();
	            }

	            this.state = 154;
	            this.match(CsharpParser.RPAREN);
	            this.state = 155;
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
	        this.state = 162;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 240) !== 0)) {
	            this.state = 159;
	            this.methodModifier();
	            this.state = 164;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 165;
	        this.identifier();
	        this.state = 166;
	        this.match(CsharpParser.LPAREN);
	        this.state = 168;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 261120) !== 0) || _la===65) {
	            this.state = 167;
	            this.parameters();
	        }

	        this.state = 170;
	        this.match(CsharpParser.RPAREN);
	        this.state = 171;
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
	        this.state = 173;
	        this.match(CsharpParser.LBRACKET);
	        this.state = 174;
	        this.identifier();
	        this.state = 176;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===58) {
	            this.state = 175;
	            this.arguments();
	        }

	        this.state = 178;
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
	        this.state = 180;
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
	        this.state = 182;
	        this.match(CsharpParser.LT);
	        this.state = 183;
	        this.identifier();
	        this.state = 188;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 184;
	            this.match(CsharpParser.COMMA);
	            this.state = 185;
	            this.identifier();
	            this.state = 190;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 191;
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
	        this.state = 193;
	        this.parameter();
	        this.state = 198;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 194;
	            this.match(CsharpParser.COMMA);
	            this.state = 195;
	            this.parameter();
	            this.state = 200;
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
	        this.state = 201;
	        this.type();
	        this.state = 202;
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
	        this.state = 210;
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
	            this.state = 204;
	            this.scalarCastType();
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 205;
	            this.match(CsharpParser.VOID);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 206;
	            this.identifier();
	            this.state = 208;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===45) {
	                this.state = 207;
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
	        this.state = 212;
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
	        this.state = 214;
	        this.identifier();
	        this.state = 219;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===57) {
	            this.state = 215;
	            this.match(CsharpParser.DOT);
	            this.state = 216;
	            this.identifier();
	            this.state = 221;
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
	        this.state = 222;
	        this.match(CsharpParser.LBRACE);
	        this.state = 226;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 1073216512) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29697123) !== 0)) {
	            this.state = 223;
	            this.statement();
	            this.state = 228;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 229;
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
	        this.state = 286;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,27,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 231;
	            this.block();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 232;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 233;
	            this.block();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 234;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 235;
	            this.match(CsharpParser.IF);
	            this.state = 236;
	            this.match(CsharpParser.LPAREN);
	            this.state = 237;
	            this.expression();
	            this.state = 238;
	            this.match(CsharpParser.RPAREN);
	            this.state = 239;
	            this.statement();
	            this.state = 242;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,22,this._ctx);
	            if(la_===1) {
	                this.state = 240;
	                this.match(CsharpParser.ELSE);
	                this.state = 241;
	                this.statement();

	            }
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 244;
	            this.match(CsharpParser.WHILE);
	            this.state = 245;
	            this.match(CsharpParser.LPAREN);
	            this.state = 246;
	            this.expression();
	            this.state = 247;
	            this.match(CsharpParser.RPAREN);
	            this.state = 248;
	            this.statement();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 250;
	            this.match(CsharpParser.DO);
	            this.state = 251;
	            this.statement();
	            this.state = 252;
	            this.match(CsharpParser.WHILE);
	            this.state = 253;
	            this.match(CsharpParser.LPAREN);
	            this.state = 254;
	            this.expression();
	            this.state = 255;
	            this.match(CsharpParser.RPAREN);
	            this.state = 256;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 258;
	            this.match(CsharpParser.FOR);
	            this.state = 259;
	            this.match(CsharpParser.LPAREN);
	            this.state = 261;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006894080) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 260;
	                this.forInitializer();
	            }

	            this.state = 263;
	            this.match(CsharpParser.SEMI);
	            this.state = 265;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 264;
	                localctx.condition = this.expression();
	            }

	            this.state = 267;
	            this.match(CsharpParser.SEMI);
	            this.state = 269;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 268;
	                localctx.increment = this.expressionList();
	            }

	            this.state = 271;
	            this.match(CsharpParser.RPAREN);
	            this.state = 272;
	            this.statement();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 273;
	            this.match(CsharpParser.RETURN);
	            this.state = 275;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	                this.state = 274;
	                this.expression();
	            }

	            this.state = 277;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 9:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 278;
	            _la = this._input.LA(1);
	            if(!(_la===24 || _la===25)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 279;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 10:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 280;
	            this.declaration();
	            this.state = 281;
	            this.match(CsharpParser.SEMI);
	            break;

	        case 11:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 283;
	            this.expression();
	            this.state = 284;
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
	        this.state = 290;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,28,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 288;
	            this.declaration();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 289;
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
	        this.state = 292;
	        this.type();
	        this.state = 293;
	        this.variableDeclarator();
	        this.state = 298;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 294;
	            this.match(CsharpParser.COMMA);
	            this.state = 295;
	            this.variableDeclarator();
	            this.state = 300;
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
	        this.state = 301;
	        this.identifier();
	        this.state = 304;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===44) {
	            this.state = 302;
	            this.match(CsharpParser.ASSIGN);
	            this.state = 303;
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
	        this.state = 306;
	        this.expression();
	        this.state = 311;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 307;
	            this.match(CsharpParser.COMMA);
	            this.state = 308;
	            this.expression();
	            this.state = 313;
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
	        this.state = 314;
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
	        this.state = 316;
	        this.conditionalExpression();
	        this.state = 320;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,32,this._ctx);
	        if(la_===1) {
	            this.state = 317;
	            this.assignmentOperator();
	            this.state = 318;
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
	        this.state = 322;
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
	        this.state = 324;
	        this.logicalOr();
	        this.state = 330;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 325;
	            this.match(CsharpParser.QUESTION);
	            this.state = 326;
	            this.expression();
	            this.state = 327;
	            this.match(CsharpParser.COLON);
	            this.state = 328;
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
	        this.state = 332;
	        this.logicalAnd();
	        this.state = 337;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===41) {
	            this.state = 333;
	            this.match(CsharpParser.OR_OR);
	            this.state = 334;
	            this.logicalAnd();
	            this.state = 339;
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
	        this.state = 340;
	        this.equality();
	        this.state = 345;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===40) {
	            this.state = 341;
	            this.match(CsharpParser.AND_AND);
	            this.state = 342;
	            this.equality();
	            this.state = 347;
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
	        this.state = 348;
	        this.relational();
	        this.state = 353;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===36 || _la===37) {
	            this.state = 349;
	            _la = this._input.LA(1);
	            if(!(_la===36 || _la===37)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 350;
	            this.relational();
	            this.state = 355;
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
	        this.state = 356;
	        this.additive();
	        this.state = 361;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 387) !== 0)) {
	            this.state = 357;
	            _la = this._input.LA(1);
	            if(!(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 387) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 358;
	            this.additive();
	            this.state = 363;
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
	        this.state = 364;
	        this.multiplicative();
	        this.state = 369;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===47 || _la===48) {
	            this.state = 365;
	            _la = this._input.LA(1);
	            if(!(_la===47 || _la===48)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 366;
	            this.multiplicative();
	            this.state = 371;
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
	        this.state = 372;
	        this.unary();
	        this.state = 377;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 7) !== 0)) {
	            this.state = 373;
	            _la = this._input.LA(1);
	            if(!(((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 374;
	            this.unary();
	            this.state = 379;
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
	        this.state = 391;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,41,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 380;
	            _la = this._input.LA(1);
	            if(!(((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 1123) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 381;
	            this.unary();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 382;
	            this.match(CsharpParser.LPAREN);
	            this.state = 383;
	            this.scalarCastType();
	            this.state = 384;
	            this.match(CsharpParser.RPAREN);
	            this.state = 385;
	            this.unary();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 387;
	            this.primary();
	            this.state = 389;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===42 || _la===43) {
	                this.state = 388;
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
	        this.state = 393;
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
	        this.state = 415;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 64:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 395;
	            this.match(CsharpParser.INTEGER_LITERAL);
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 396;
	            this.match(CsharpParser.STRING_LITERAL);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 397;
	            this.match(CsharpParser.TRUE);
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 398;
	            this.match(CsharpParser.FALSE);
	            break;
	        case 28:
	        case 29:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 399;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 400;
	            this.match(CsharpParser.LPAREN);
	            this.state = 401;
	            this.expression();
	            this.state = 402;
	            this.match(CsharpParser.RPAREN);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 404;
	            this.match(CsharpParser.LPAREN);
	            this.state = 405;
	            this.expression();
	            this.state = 406;
	            this.match(CsharpParser.RPAREN);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 408;
	            this.qualifiedName();
	            this.state = 413;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,43,this._ctx);
	            if(la_===1) {
	                this.state = 410;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	                if(_la===45) {
	                    this.state = 409;
	                    this.typeArguments();
	                }

	                this.state = 412;
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
	        this.state = 417;
	        this.match(CsharpParser.LT);
	        this.state = 418;
	        this.type();
	        this.state = 423;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===56) {
	            this.state = 419;
	            this.match(CsharpParser.COMMA);
	            this.state = 420;
	            this.type();
	            this.state = 425;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 426;
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
	        this.state = 428;
	        this.match(CsharpParser.LPAREN);
	        this.state = 430;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1006632960) !== 0) || ((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 29426787) !== 0)) {
	            this.state = 429;
	            this.expressionList();
	        }

	        this.state = 432;
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
