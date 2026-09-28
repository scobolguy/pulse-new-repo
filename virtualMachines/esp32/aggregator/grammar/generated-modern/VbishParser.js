// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Vbish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import VbishVisitor from './VbishVisitor.js';

const serializedATN = [4,1,91,496,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,1,0,3,0,98,8,
0,1,0,3,0,101,8,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,112,8,0,10,0,12,
0,115,9,0,1,0,1,0,1,1,1,1,1,1,1,2,3,2,123,8,2,1,2,1,2,1,2,1,2,3,2,129,8,
2,1,2,1,2,1,2,3,2,134,8,2,1,3,1,3,1,4,1,4,1,5,1,5,1,5,1,5,1,5,3,5,145,8,
5,1,6,1,6,1,7,1,7,1,7,3,7,152,8,7,1,8,1,8,1,8,1,9,1,9,1,10,1,10,1,10,1,10,
3,10,163,8,10,1,11,1,11,1,11,3,11,168,8,11,1,12,1,12,1,12,1,12,3,12,174,
8,12,1,13,1,13,1,13,1,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,
14,1,15,1,15,1,15,1,15,1,15,1,15,1,15,3,15,197,8,15,3,15,199,8,15,1,15,3,
15,202,8,15,1,15,1,15,5,15,206,8,15,10,15,12,15,209,9,15,1,15,1,15,1,16,
1,16,1,16,1,16,1,16,1,17,1,17,1,17,3,17,221,8,17,1,18,1,18,1,18,1,18,3,18,
227,8,18,1,18,1,18,1,18,3,18,232,8,18,1,19,1,19,1,19,1,19,3,19,238,8,19,
1,19,3,19,241,8,19,1,20,1,20,1,20,1,21,1,21,1,21,1,21,3,21,250,8,21,1,21,
1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,3,21,265,8,21,
1,22,1,22,1,22,3,22,270,8,22,1,22,5,22,273,8,22,10,22,12,22,276,9,22,1,22,
1,22,1,22,1,23,1,23,1,23,3,23,284,8,23,1,23,1,23,3,23,288,8,23,1,23,5,23,
291,8,23,10,23,12,23,294,9,23,1,23,1,23,1,23,1,24,1,24,1,24,1,24,5,24,303,
8,24,10,24,12,24,306,9,24,3,24,308,8,24,1,24,1,24,1,25,1,25,1,25,3,25,315,
8,25,1,26,1,26,1,26,1,26,1,26,1,26,1,26,1,26,3,26,325,8,26,1,27,1,27,1,27,
1,27,5,27,331,8,27,10,27,12,27,334,9,27,1,27,1,27,5,27,338,8,27,10,27,12,
27,341,9,27,3,27,343,8,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,1,
28,1,28,3,28,356,8,28,1,28,5,28,359,8,28,10,28,12,28,362,9,28,1,28,1,28,
1,28,1,28,3,28,368,8,28,3,28,370,8,28,1,29,1,29,1,29,5,29,375,8,29,10,29,
12,29,378,9,29,1,29,1,29,1,29,1,30,1,30,1,30,1,30,5,30,387,8,30,10,30,12,
30,390,9,30,3,30,392,8,30,1,31,1,31,1,31,1,31,1,32,1,32,3,32,400,8,32,1,
33,1,33,3,33,404,8,33,1,34,1,34,1,35,1,35,1,35,5,35,411,8,35,10,35,12,35,
414,9,35,1,36,1,36,1,36,5,36,419,8,36,10,36,12,36,422,9,36,1,37,1,37,1,37,
5,37,427,8,37,10,37,12,37,430,9,37,1,38,1,38,1,38,5,38,435,8,38,10,38,12,
38,438,9,38,1,39,1,39,1,39,5,39,443,8,39,10,39,12,39,446,9,39,1,39,1,39,
1,39,5,39,451,8,39,10,39,12,39,454,9,39,3,39,456,8,39,1,40,1,40,1,40,5,40,
461,8,40,10,40,12,40,464,9,40,1,41,1,41,1,41,1,41,1,41,1,41,3,41,472,8,41,
1,41,1,41,1,41,1,41,3,41,478,8,41,1,42,1,42,1,42,1,43,1,43,1,43,1,44,1,44,
1,44,1,45,1,45,1,45,1,46,1,46,1,47,1,47,1,47,0,0,48,0,2,4,6,8,10,12,14,16,
18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,
66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,0,17,1,0,2,4,1,0,7,11,1,0,12,
16,1,0,18,22,2,0,24,24,88,88,1,0,36,37,2,0,28,28,41,41,1,0,59,60,2,0,62,
62,64,64,2,0,61,61,63,63,2,0,72,72,81,81,1,0,82,85,1,0,77,78,1,0,79,80,2,
0,81,85,91,91,2,0,66,69,88,88,1,0,87,88,524,0,97,1,0,0,0,2,118,1,0,0,0,4,
122,1,0,0,0,6,135,1,0,0,0,8,137,1,0,0,0,10,139,1,0,0,0,12,146,1,0,0,0,14,
151,1,0,0,0,16,153,1,0,0,0,18,156,1,0,0,0,20,158,1,0,0,0,22,167,1,0,0,0,
24,169,1,0,0,0,26,175,1,0,0,0,28,181,1,0,0,0,30,189,1,0,0,0,32,212,1,0,0,
0,34,220,1,0,0,0,36,222,1,0,0,0,38,233,1,0,0,0,40,242,1,0,0,0,42,245,1,0,
0,0,44,266,1,0,0,0,46,280,1,0,0,0,48,298,1,0,0,0,50,311,1,0,0,0,52,324,1,
0,0,0,54,326,1,0,0,0,56,347,1,0,0,0,58,371,1,0,0,0,60,382,1,0,0,0,62,393,
1,0,0,0,64,397,1,0,0,0,66,401,1,0,0,0,68,405,1,0,0,0,70,407,1,0,0,0,72,415,
1,0,0,0,74,423,1,0,0,0,76,431,1,0,0,0,78,455,1,0,0,0,80,457,1,0,0,0,82,477,
1,0,0,0,84,479,1,0,0,0,86,482,1,0,0,0,88,485,1,0,0,0,90,488,1,0,0,0,92,491,
1,0,0,0,94,493,1,0,0,0,96,98,3,2,1,0,97,96,1,0,0,0,97,98,1,0,0,0,98,100,
1,0,0,0,99,101,3,4,2,0,100,99,1,0,0,0,100,101,1,0,0,0,101,113,1,0,0,0,102,
112,3,10,5,0,103,112,3,16,8,0,104,112,3,20,10,0,105,112,3,24,12,0,106,112,
3,26,13,0,107,112,3,28,14,0,108,112,3,30,15,0,109,112,3,32,16,0,110,112,
3,14,7,0,111,102,1,0,0,0,111,103,1,0,0,0,111,104,1,0,0,0,111,105,1,0,0,0,
111,106,1,0,0,0,111,107,1,0,0,0,111,108,1,0,0,0,111,109,1,0,0,0,111,110,
1,0,0,0,112,115,1,0,0,0,113,111,1,0,0,0,113,114,1,0,0,0,114,116,1,0,0,0,
115,113,1,0,0,0,116,117,5,0,0,1,117,1,1,0,0,0,118,119,5,44,0,0,119,120,5,
45,0,0,120,3,1,0,0,0,121,123,5,1,0,0,122,121,1,0,0,0,122,123,1,0,0,0,123,
124,1,0,0,0,124,125,7,0,0,0,125,128,3,94,47,0,126,127,5,5,0,0,127,129,3,
6,3,0,128,126,1,0,0,0,128,129,1,0,0,0,129,133,1,0,0,0,130,131,5,6,0,0,131,
132,5,86,0,0,132,134,3,8,4,0,133,130,1,0,0,0,133,134,1,0,0,0,134,5,1,0,0,
0,135,136,7,1,0,0,136,7,1,0,0,0,137,138,7,2,0,0,138,9,1,0,0,0,139,140,5,
17,0,0,140,141,3,12,6,0,141,144,5,87,0,0,142,143,5,43,0,0,143,145,5,88,0,
0,144,142,1,0,0,0,144,145,1,0,0,0,145,11,1,0,0,0,146,147,7,3,0,0,147,13,
1,0,0,0,148,152,3,42,21,0,149,152,3,44,22,0,150,152,3,46,23,0,151,148,1,
0,0,0,151,149,1,0,0,0,151,150,1,0,0,0,152,15,1,0,0,0,153,154,5,23,0,0,154,
155,3,18,9,0,155,17,1,0,0,0,156,157,7,4,0,0,157,19,1,0,0,0,158,159,5,25,
0,0,159,162,3,94,47,0,160,161,5,42,0,0,161,163,3,22,11,0,162,160,1,0,0,0,
162,163,1,0,0,0,163,21,1,0,0,0,164,168,5,41,0,0,165,168,5,28,0,0,166,168,
3,94,47,0,167,164,1,0,0,0,167,165,1,0,0,0,167,166,1,0,0,0,168,23,1,0,0,0,
169,170,5,26,0,0,170,173,3,94,47,0,171,172,5,43,0,0,172,174,5,88,0,0,173,
171,1,0,0,0,173,174,1,0,0,0,174,25,1,0,0,0,175,176,5,27,0,0,176,177,5,28,
0,0,177,178,3,94,47,0,178,179,5,42,0,0,179,180,3,22,11,0,180,27,1,0,0,0,
181,182,5,29,0,0,182,183,3,94,47,0,183,184,5,55,0,0,184,185,3,94,47,0,185,
186,5,40,0,0,186,187,5,28,0,0,187,188,3,94,47,0,188,29,1,0,0,0,189,198,5,
30,0,0,190,191,5,31,0,0,191,199,3,94,47,0,192,196,3,94,47,0,193,194,5,33,
0,0,194,195,5,31,0,0,195,197,3,94,47,0,196,193,1,0,0,0,196,197,1,0,0,0,197,
199,1,0,0,0,198,190,1,0,0,0,198,192,1,0,0,0,199,201,1,0,0,0,200,202,3,40,
20,0,201,200,1,0,0,0,201,202,1,0,0,0,202,203,1,0,0,0,203,207,5,38,0,0,204,
206,3,34,17,0,205,204,1,0,0,0,206,209,1,0,0,0,207,205,1,0,0,0,207,208,1,
0,0,0,208,210,1,0,0,0,209,207,1,0,0,0,210,211,5,49,0,0,211,31,1,0,0,0,212,
213,5,32,0,0,213,214,3,94,47,0,214,215,5,31,0,0,215,216,3,92,46,0,216,33,
1,0,0,0,217,221,3,36,18,0,218,221,3,38,19,0,219,221,3,30,15,0,220,217,1,
0,0,0,220,218,1,0,0,0,220,219,1,0,0,0,221,35,1,0,0,0,222,223,5,34,0,0,223,
226,3,94,47,0,224,225,5,39,0,0,225,227,3,94,47,0,226,224,1,0,0,0,226,227,
1,0,0,0,227,228,1,0,0,0,228,229,5,31,0,0,229,231,3,94,47,0,230,232,3,40,
20,0,231,230,1,0,0,0,231,232,1,0,0,0,232,37,1,0,0,0,233,234,5,2,0,0,234,
237,3,94,47,0,235,236,5,39,0,0,236,238,3,94,47,0,237,235,1,0,0,0,237,238,
1,0,0,0,238,240,1,0,0,0,239,241,3,40,20,0,240,239,1,0,0,0,240,241,1,0,0,
0,241,39,1,0,0,0,242,243,5,35,0,0,243,244,7,5,0,0,244,41,1,0,0,0,245,246,
5,46,0,0,246,249,5,88,0,0,247,248,5,43,0,0,248,250,3,92,46,0,249,247,1,0,
0,0,249,250,1,0,0,0,250,264,1,0,0,0,251,252,5,42,0,0,252,265,7,6,0,0,253,
254,5,72,0,0,254,265,3,68,34,0,255,256,5,42,0,0,256,257,7,6,0,0,257,258,
5,72,0,0,258,265,3,68,34,0,259,260,5,72,0,0,260,261,3,68,34,0,261,262,5,
42,0,0,262,263,7,6,0,0,263,265,1,0,0,0,264,251,1,0,0,0,264,253,1,0,0,0,264,
255,1,0,0,0,264,259,1,0,0,0,264,265,1,0,0,0,265,43,1,0,0,0,266,267,5,47,
0,0,267,269,5,88,0,0,268,270,3,48,24,0,269,268,1,0,0,0,269,270,1,0,0,0,270,
274,1,0,0,0,271,273,3,52,26,0,272,271,1,0,0,0,273,276,1,0,0,0,274,272,1,
0,0,0,274,275,1,0,0,0,275,277,1,0,0,0,276,274,1,0,0,0,277,278,5,49,0,0,278,
279,5,47,0,0,279,45,1,0,0,0,280,281,5,48,0,0,281,283,5,88,0,0,282,284,3,
48,24,0,283,282,1,0,0,0,283,284,1,0,0,0,284,287,1,0,0,0,285,286,5,43,0,0,
286,288,3,92,46,0,287,285,1,0,0,0,287,288,1,0,0,0,288,292,1,0,0,0,289,291,
3,52,26,0,290,289,1,0,0,0,291,294,1,0,0,0,292,290,1,0,0,0,292,293,1,0,0,
0,293,295,1,0,0,0,294,292,1,0,0,0,295,296,5,49,0,0,296,297,5,48,0,0,297,
47,1,0,0,0,298,307,5,73,0,0,299,304,3,50,25,0,300,301,5,75,0,0,301,303,3,
50,25,0,302,300,1,0,0,0,303,306,1,0,0,0,304,302,1,0,0,0,304,305,1,0,0,0,
305,308,1,0,0,0,306,304,1,0,0,0,307,299,1,0,0,0,307,308,1,0,0,0,308,309,
1,0,0,0,309,310,5,74,0,0,310,49,1,0,0,0,311,314,3,68,34,0,312,313,5,43,0,
0,313,315,3,92,46,0,314,312,1,0,0,0,314,315,1,0,0,0,315,51,1,0,0,0,316,325,
3,42,21,0,317,325,3,54,27,0,318,325,3,56,28,0,319,325,3,58,29,0,320,325,
3,60,30,0,321,325,3,62,31,0,322,325,3,64,32,0,323,325,3,66,33,0,324,316,
1,0,0,0,324,317,1,0,0,0,324,318,1,0,0,0,324,319,1,0,0,0,324,320,1,0,0,0,
324,321,1,0,0,0,324,322,1,0,0,0,324,323,1,0,0,0,325,53,1,0,0,0,326,327,5,
51,0,0,327,328,3,68,34,0,328,332,5,52,0,0,329,331,3,52,26,0,330,329,1,0,
0,0,331,334,1,0,0,0,332,330,1,0,0,0,332,333,1,0,0,0,333,342,1,0,0,0,334,
332,1,0,0,0,335,339,5,53,0,0,336,338,3,52,26,0,337,336,1,0,0,0,338,341,1,
0,0,0,339,337,1,0,0,0,339,340,1,0,0,0,340,343,1,0,0,0,341,339,1,0,0,0,342,
335,1,0,0,0,342,343,1,0,0,0,343,344,1,0,0,0,344,345,5,49,0,0,345,346,5,51,
0,0,346,55,1,0,0,0,347,348,5,54,0,0,348,349,5,88,0,0,349,350,5,72,0,0,350,
351,3,68,34,0,351,352,5,55,0,0,352,355,3,68,34,0,353,354,5,56,0,0,354,356,
3,68,34,0,355,353,1,0,0,0,355,356,1,0,0,0,356,360,1,0,0,0,357,359,3,52,26,
0,358,357,1,0,0,0,359,362,1,0,0,0,360,358,1,0,0,0,360,361,1,0,0,0,361,369,
1,0,0,0,362,360,1,0,0,0,363,364,5,49,0,0,364,370,5,54,0,0,365,367,5,57,0,
0,366,368,5,88,0,0,367,366,1,0,0,0,367,368,1,0,0,0,368,370,1,0,0,0,369,363,
1,0,0,0,369,365,1,0,0,0,370,57,1,0,0,0,371,372,5,58,0,0,372,376,3,68,34,
0,373,375,3,52,26,0,374,373,1,0,0,0,375,378,1,0,0,0,376,374,1,0,0,0,376,
377,1,0,0,0,377,379,1,0,0,0,378,376,1,0,0,0,379,380,5,49,0,0,380,381,5,58,
0,0,381,59,1,0,0,0,382,391,7,7,0,0,383,388,3,68,34,0,384,385,5,75,0,0,385,
387,3,68,34,0,386,384,1,0,0,0,387,390,1,0,0,0,388,386,1,0,0,0,388,389,1,
0,0,0,389,392,1,0,0,0,390,388,1,0,0,0,391,383,1,0,0,0,391,392,1,0,0,0,392,
61,1,0,0,0,393,394,5,88,0,0,394,395,5,72,0,0,395,396,3,68,34,0,396,63,1,
0,0,0,397,399,5,88,0,0,398,400,3,48,24,0,399,398,1,0,0,0,399,400,1,0,0,0,
400,65,1,0,0,0,401,403,5,50,0,0,402,404,3,68,34,0,403,402,1,0,0,0,403,404,
1,0,0,0,404,67,1,0,0,0,405,406,3,70,35,0,406,69,1,0,0,0,407,412,3,72,36,
0,408,409,7,8,0,0,409,411,3,72,36,0,410,408,1,0,0,0,411,414,1,0,0,0,412,
410,1,0,0,0,412,413,1,0,0,0,413,71,1,0,0,0,414,412,1,0,0,0,415,420,3,74,
37,0,416,417,7,9,0,0,417,419,3,74,37,0,418,416,1,0,0,0,419,422,1,0,0,0,420,
418,1,0,0,0,420,421,1,0,0,0,421,73,1,0,0,0,422,420,1,0,0,0,423,428,3,76,
38,0,424,425,7,10,0,0,425,427,3,76,38,0,426,424,1,0,0,0,427,430,1,0,0,0,
428,426,1,0,0,0,428,429,1,0,0,0,429,75,1,0,0,0,430,428,1,0,0,0,431,436,3,
78,39,0,432,433,7,11,0,0,433,435,3,78,39,0,434,432,1,0,0,0,435,438,1,0,0,
0,436,434,1,0,0,0,436,437,1,0,0,0,437,77,1,0,0,0,438,436,1,0,0,0,439,444,
3,80,40,0,440,441,7,12,0,0,441,443,3,80,40,0,442,440,1,0,0,0,443,446,1,0,
0,0,444,442,1,0,0,0,444,445,1,0,0,0,445,456,1,0,0,0,446,444,1,0,0,0,447,
452,3,80,40,0,448,449,5,76,0,0,449,451,3,80,40,0,450,448,1,0,0,0,451,454,
1,0,0,0,452,450,1,0,0,0,452,453,1,0,0,0,453,456,1,0,0,0,454,452,1,0,0,0,
455,439,1,0,0,0,455,447,1,0,0,0,456,79,1,0,0,0,457,462,3,82,41,0,458,459,
7,13,0,0,459,461,3,82,41,0,460,458,1,0,0,0,461,464,1,0,0,0,462,460,1,0,0,
0,462,463,1,0,0,0,463,81,1,0,0,0,464,462,1,0,0,0,465,478,5,87,0,0,466,478,
5,86,0,0,467,478,5,70,0,0,468,478,5,71,0,0,469,471,5,88,0,0,470,472,3,48,
24,0,471,470,1,0,0,0,471,472,1,0,0,0,472,478,1,0,0,0,473,474,5,73,0,0,474,
475,3,68,34,0,475,476,5,74,0,0,476,478,1,0,0,0,477,465,1,0,0,0,477,466,1,
0,0,0,477,467,1,0,0,0,477,468,1,0,0,0,477,469,1,0,0,0,477,473,1,0,0,0,478,
83,1,0,0,0,479,480,5,76,0,0,480,481,3,82,41,0,481,85,1,0,0,0,482,483,7,12,
0,0,483,484,3,82,41,0,484,87,1,0,0,0,485,486,7,13,0,0,486,487,3,82,41,0,
487,89,1,0,0,0,488,489,7,14,0,0,489,490,3,82,41,0,490,91,1,0,0,0,491,492,
7,15,0,0,492,93,1,0,0,0,493,494,7,16,0,0,494,95,1,0,0,0,54,97,100,111,113,
122,128,133,144,151,162,167,173,196,198,201,207,220,226,231,237,240,249,
264,269,274,283,287,292,304,307,314,324,332,339,342,355,360,367,369,376,
388,391,399,403,412,420,428,436,444,452,455,462,471,477];


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
                            "'IMPORT'", "'MAPPER'", "'ROUTE'", "'SYSTEM'", 
                            "'TYPE'", "'DATABASE'", "'OF'", "'QUEUE'", "'VISIBILITY'", 
                            "'INTERNAL'", "'EXPOSED'", "'BEGIN'", "'->'", 
                            "'USING'", "'LIBRARIAN'", "'FROM'", "'AS'", 
                            "'OPTION'", "'EXPLICIT'", "'DIM'", "'SUB'", 
                            "'FUNCTION'", "'END'", "'RETURN'", "'IF'", "'THEN'", 
                            "'ELSE'", "'FOR'", "'TO'", "'STEP'", "'NEXT'", 
                            "'WHILE'", "'PRINT'", "'DISPLAY'", "'AND'", 
                            "'OR'", "'ANDALSO'", "'ORELSE'", "'NOT'", "'STRING'", 
                            "'INTEGER'", "'DOUBLE'", "'BOOLEAN'", "'TRUE'", 
                            "'FALSE'", "'='", "'('", "')'", "','", "'&'", 
                            "'+'", "'-'", "'*'", "'/'", "'<>'", "'<'", "'>'", 
                            "'<='", "'>='" ];
    static symbolicNames = [ null, "PULSE", "SERVICE", "DAEMON", "PROGRAM", 
                             "ON", "EVERY", "LOCAL", "PARENT", "CHILD", 
                             "SIBLING", "ALTERNATE", "MS", "S", "M", "SECOND", 
                             "SECONDS", "INTEROP", "PASCALISH", "COBOLISH", 
                             "VBISH", "WFL", "WORKFLOW", "ROLE", "CODE_LIBRARIAN", 
                             "LIBRARY", "USE", "IMPORT", "MAPPER", "ROUTE", 
                             "SYSTEM", "TYPE", "DATABASE", "OF", "QUEUE", 
                             "VISIBILITY", "INTERNAL", "EXPOSED", "BEGIN_KW", 
                             "ARROW", "USING", "LIBRARIAN", "FROM", "AS", 
                             "OPTION", "EXPLICIT", "DIM", "SUB", "FUNCTION", 
                             "END", "RETURN", "IF", "THEN", "ELSE", "FOR", 
                             "TO", "STEP", "NEXT", "WHILE", "PRINT", "DISPLAY", 
                             "AND", "OR", "ANDALSO", "ORELSE", "NOT", "STRING", 
                             "INTEGER", "DOUBLE", "BOOLEAN", "TRUE", "FALSE", 
                             "ASSIGN", "LPAREN", "RPAREN", "COMMA", "AMPERSAND", 
                             "PLUS", "MINUS", "MUL", "DIV", "NE", "LT", 
                             "GT", "LTE", "GTE", "NUMBER", "STRING_LITERAL", 
                             "IDENTIFIER", "COMMENT", "WS", "EQ" ];
    static ruleNames = [ "compilationUnit", "optionExplicit", "runtimeDecl", 
                         "placement", "intervalUnit", "interopDecl", "interopKind", 
                         "topLevelDecl", "roleDecl", "roleName", "libraryDecl", 
                         "librarySource", "useDecl", "importDecl", "routeDecl", 
                         "systemDecl", "databaseDecl", "systemMember", "systemQueueDecl", 
                         "systemServiceDecl", "systemVisibilityClause", 
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
	        this.state = 97;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===44) {
	            this.state = 96;
	            this.optionExplicit();
	        }

	        this.state = 100;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 30) !== 0)) {
	            this.state = 99;
	            this.runtimeDecl();
	        }

	        this.state = 113;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 17)) & ~0x1f) === 0 && ((1 << (_la - 17)) & 3758143297) !== 0)) {
	            this.state = 111;
	            this._errHandler.sync(this);
	            switch(this._input.LA(1)) {
	            case 17:
	                this.state = 102;
	                this.interopDecl();
	                break;
	            case 23:
	                this.state = 103;
	                this.roleDecl();
	                break;
	            case 25:
	                this.state = 104;
	                this.libraryDecl();
	                break;
	            case 26:
	                this.state = 105;
	                this.useDecl();
	                break;
	            case 27:
	                this.state = 106;
	                this.importDecl();
	                break;
	            case 29:
	                this.state = 107;
	                this.routeDecl();
	                break;
	            case 30:
	                this.state = 108;
	                this.systemDecl();
	                break;
	            case 32:
	                this.state = 109;
	                this.databaseDecl();
	                break;
	            case 46:
	            case 47:
	            case 48:
	                this.state = 110;
	                this.topLevelDecl();
	                break;
	            default:
	                throw new antlr4.error.NoViableAltException(this);
	            }
	            this.state = 115;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 116;
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
	        this.state = 118;
	        this.match(VbishParser.OPTION);
	        this.state = 119;
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
	        this.state = 122;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 121;
	            this.match(VbishParser.PULSE);
	        }

	        this.state = 124;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 28) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 125;
	        this.stringOrIdentifier();
	        this.state = 128;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===5) {
	            this.state = 126;
	            this.match(VbishParser.ON);
	            this.state = 127;
	            this.placement();
	        }

	        this.state = 133;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===6) {
	            this.state = 130;
	            this.match(VbishParser.EVERY);
	            this.state = 131;
	            this.match(VbishParser.NUMBER);
	            this.state = 132;
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
	        this.state = 135;
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
	        this.state = 137;
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
	        this.state = 139;
	        this.match(VbishParser.INTEROP);
	        this.state = 140;
	        this.interopKind();
	        this.state = 141;
	        this.match(VbishParser.STRING_LITERAL);
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 142;
	            this.match(VbishParser.AS);
	            this.state = 143;
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
	        this.state = 146;
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
	        this.state = 151;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 46:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 148;
	            this.variableDecl();
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 149;
	            this.subDecl();
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 150;
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
	        this.state = 153;
	        this.match(VbishParser.ROLE);
	        this.state = 154;
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
	        this.state = 156;
	        _la = this._input.LA(1);
	        if(!(_la===24 || _la===88)) {
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
	        this.state = 158;
	        this.match(VbishParser.LIBRARY);
	        this.state = 159;
	        this.stringOrIdentifier();
	        this.state = 162;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===42) {
	            this.state = 160;
	            this.match(VbishParser.FROM);
	            this.state = 161;
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
	        this.state = 167;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 41:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 164;
	            this.match(VbishParser.LIBRARIAN);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 165;
	            this.match(VbishParser.MAPPER);
	            break;
	        case 87:
	        case 88:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 166;
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
	        this.state = 169;
	        this.match(VbishParser.USE);
	        this.state = 170;
	        this.stringOrIdentifier();
	        this.state = 173;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 171;
	            this.match(VbishParser.AS);
	            this.state = 172;
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
	        this.state = 175;
	        this.match(VbishParser.IMPORT);
	        this.state = 176;
	        this.match(VbishParser.MAPPER);
	        this.state = 177;
	        this.stringOrIdentifier();
	        this.state = 178;
	        this.match(VbishParser.FROM);
	        this.state = 179;
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
	        this.state = 181;
	        this.match(VbishParser.ROUTE);
	        this.state = 182;
	        this.stringOrIdentifier();
	        this.state = 183;
	        this.match(VbishParser.TO);
	        this.state = 184;
	        this.stringOrIdentifier();
	        this.state = 185;
	        this.match(VbishParser.USING);
	        this.state = 186;
	        this.match(VbishParser.MAPPER);
	        this.state = 187;
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



	systemDecl() {
	    let localctx = new SystemDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, VbishParser.RULE_systemDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 189;
	        this.match(VbishParser.SYSTEM);
	        this.state = 198;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 31:
	            this.state = 190;
	            this.match(VbishParser.TYPE);
	            this.state = 191;
	            this.stringOrIdentifier();
	            break;
	        case 87:
	        case 88:
	            this.state = 192;
	            this.stringOrIdentifier();
	            this.state = 196;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===33) {
	                this.state = 193;
	                this.match(VbishParser.OF);
	                this.state = 194;
	                this.match(VbishParser.TYPE);
	                this.state = 195;
	                this.stringOrIdentifier();
	            }

	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 201;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 200;
	            this.systemVisibilityClause();
	        }

	        this.state = 203;
	        this.match(VbishParser.BEGIN_KW);
	        this.state = 207;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===2 || _la===30 || _la===34) {
	            this.state = 204;
	            this.systemMember();
	            this.state = 209;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 210;
	        this.match(VbishParser.END);
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



	databaseDecl() {
	    let localctx = new DatabaseDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, VbishParser.RULE_databaseDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 212;
	        this.match(VbishParser.DATABASE);
	        this.state = 213;
	        this.stringOrIdentifier();
	        this.state = 214;
	        this.match(VbishParser.TYPE);
	        this.state = 215;
	        this.typeName();
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



	systemMember() {
	    let localctx = new SystemMemberContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, VbishParser.RULE_systemMember);
	    try {
	        this.state = 220;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 34:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 217;
	            this.systemQueueDecl();
	            break;
	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 218;
	            this.systemServiceDecl();
	            break;
	        case 30:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 219;
	            this.systemDecl();
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



	systemQueueDecl() {
	    let localctx = new SystemQueueDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, VbishParser.RULE_systemQueueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 222;
	        this.match(VbishParser.QUEUE);
	        this.state = 223;
	        this.stringOrIdentifier();
	        this.state = 226;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===39) {
	            this.state = 224;
	            this.match(VbishParser.ARROW);
	            this.state = 225;
	            this.stringOrIdentifier();
	        }

	        this.state = 228;
	        this.match(VbishParser.TYPE);
	        this.state = 229;
	        this.stringOrIdentifier();
	        this.state = 231;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 230;
	            this.systemVisibilityClause();
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



	systemServiceDecl() {
	    let localctx = new SystemServiceDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, VbishParser.RULE_systemServiceDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 233;
	        this.match(VbishParser.SERVICE);
	        this.state = 234;
	        this.stringOrIdentifier();
	        this.state = 237;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===39) {
	            this.state = 235;
	            this.match(VbishParser.ARROW);
	            this.state = 236;
	            this.stringOrIdentifier();
	        }

	        this.state = 240;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 239;
	            this.systemVisibilityClause();
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



	systemVisibilityClause() {
	    let localctx = new SystemVisibilityClauseContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, VbishParser.RULE_systemVisibilityClause);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 242;
	        this.match(VbishParser.VISIBILITY);
	        this.state = 243;
	        _la = this._input.LA(1);
	        if(!(_la===36 || _la===37)) {
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



	variableDecl() {
	    let localctx = new VariableDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, VbishParser.RULE_variableDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 245;
	        this.match(VbishParser.DIM);
	        this.state = 246;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 249;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 247;
	            this.match(VbishParser.AS);
	            this.state = 248;
	            this.typeName();
	        }

	        this.state = 264;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,22,this._ctx);
	        if(la_===1) {
	            this.state = 251;
	            this.match(VbishParser.FROM);
	            this.state = 252;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===41)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }

	        } else if(la_===2) {
	            this.state = 253;
	            this.match(VbishParser.ASSIGN);
	            this.state = 254;
	            this.expression();

	        } else if(la_===3) {
	            this.state = 255;
	            this.match(VbishParser.FROM);
	            this.state = 256;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===41)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 257;
	            this.match(VbishParser.ASSIGN);
	            this.state = 258;
	            this.expression();

	        } else if(la_===4) {
	            this.state = 259;
	            this.match(VbishParser.ASSIGN);
	            this.state = 260;
	            this.expression();
	            this.state = 261;
	            this.match(VbishParser.FROM);
	            this.state = 262;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===41)) {
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
	    this.enterRule(localctx, 44, VbishParser.RULE_subDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 266;
	        this.match(VbishParser.SUB);
	        this.state = 267;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 269;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===73) {
	            this.state = 268;
	            this.parameterList();
	        }

	        this.state = 274;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	            this.state = 271;
	            this.statement();
	            this.state = 276;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 277;
	        this.match(VbishParser.END);
	        this.state = 278;
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
	    this.enterRule(localctx, 46, VbishParser.RULE_functionDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 280;
	        this.match(VbishParser.FUNCTION);
	        this.state = 281;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 283;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===73) {
	            this.state = 282;
	            this.parameterList();
	        }

	        this.state = 287;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 285;
	            this.match(VbishParser.AS);
	            this.state = 286;
	            this.typeName();
	        }

	        this.state = 292;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	            this.state = 289;
	            this.statement();
	            this.state = 294;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 295;
	        this.match(VbishParser.END);
	        this.state = 296;
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
	    this.enterRule(localctx, 48, VbishParser.RULE_parameterList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 298;
	        this.match(VbishParser.LPAREN);
	        this.state = 307;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 70)) & ~0x1f) === 0 && ((1 << (_la - 70)) & 458763) !== 0)) {
	            this.state = 299;
	            this.parameter();
	            this.state = 304;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===75) {
	                this.state = 300;
	                this.match(VbishParser.COMMA);
	                this.state = 301;
	                this.parameter();
	                this.state = 306;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 309;
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
	    this.enterRule(localctx, 50, VbishParser.RULE_parameter);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 311;
	        this.expression();
	        this.state = 314;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 312;
	            this.match(VbishParser.AS);
	            this.state = 313;
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
	    this.enterRule(localctx, 52, VbishParser.RULE_statement);
	    try {
	        this.state = 324;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,31,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 316;
	            this.variableDecl();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 317;
	            this.ifStatement();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 318;
	            this.forStatement();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 319;
	            this.whileStatement();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 320;
	            this.printStatement();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 321;
	            this.assignment();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 322;
	            this.callStatement();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 323;
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
	    this.enterRule(localctx, 54, VbishParser.RULE_ifStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 326;
	        this.match(VbishParser.IF);
	        this.state = 327;
	        this.expression();
	        this.state = 328;
	        this.match(VbishParser.THEN);
	        this.state = 332;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	            this.state = 329;
	            this.statement();
	            this.state = 334;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 342;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 335;
	            this.match(VbishParser.ELSE);
	            this.state = 339;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	                this.state = 336;
	                this.statement();
	                this.state = 341;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 344;
	        this.match(VbishParser.END);
	        this.state = 345;
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
	    this.enterRule(localctx, 56, VbishParser.RULE_forStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 347;
	        this.match(VbishParser.FOR);
	        this.state = 348;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 349;
	        this.match(VbishParser.ASSIGN);
	        this.state = 350;
	        this.expression();
	        this.state = 351;
	        this.match(VbishParser.TO);
	        this.state = 352;
	        this.expression();
	        this.state = 355;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===56) {
	            this.state = 353;
	            this.match(VbishParser.STEP);
	            this.state = 354;
	            this.expression();
	        }

	        this.state = 360;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	            this.state = 357;
	            this.statement();
	            this.state = 362;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 369;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 49:
	            this.state = 363;
	            this.match(VbishParser.END);
	            this.state = 364;
	            this.match(VbishParser.FOR);
	            break;
	        case 57:
	            this.state = 365;
	            this.match(VbishParser.NEXT);
	            this.state = 367;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,37,this._ctx);
	            if(la_===1) {
	                this.state = 366;
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
	    this.enterRule(localctx, 58, VbishParser.RULE_whileStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 371;
	        this.match(VbishParser.WHILE);
	        this.state = 372;
	        this.expression();
	        this.state = 376;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 28977) !== 0) || _la===88) {
	            this.state = 373;
	            this.statement();
	            this.state = 378;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 379;
	        this.match(VbishParser.END);
	        this.state = 380;
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
	    this.enterRule(localctx, 60, VbishParser.RULE_printStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 382;
	        _la = this._input.LA(1);
	        if(!(_la===59 || _la===60)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 391;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,41,this._ctx);
	        if(la_===1) {
	            this.state = 383;
	            this.expression();
	            this.state = 388;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===75) {
	                this.state = 384;
	                this.match(VbishParser.COMMA);
	                this.state = 385;
	                this.expression();
	                this.state = 390;
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
	    this.enterRule(localctx, 62, VbishParser.RULE_assignment);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 393;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 394;
	        this.match(VbishParser.ASSIGN);
	        this.state = 395;
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
	    this.enterRule(localctx, 64, VbishParser.RULE_callStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 397;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 399;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===73) {
	            this.state = 398;
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
	    this.enterRule(localctx, 66, VbishParser.RULE_returnStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 401;
	        this.match(VbishParser.RETURN);
	        this.state = 403;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,43,this._ctx);
	        if(la_===1) {
	            this.state = 402;
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
	    this.enterRule(localctx, 68, VbishParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 405;
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
	    this.enterRule(localctx, 70, VbishParser.RULE_logicalOr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 407;
	        this.logicalAnd();
	        this.state = 412;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===62 || _la===64) {
	            this.state = 408;
	            _la = this._input.LA(1);
	            if(!(_la===62 || _la===64)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 409;
	            this.logicalAnd();
	            this.state = 414;
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
	    this.enterRule(localctx, 72, VbishParser.RULE_logicalAnd);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 415;
	        this.equality();
	        this.state = 420;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===61 || _la===63) {
	            this.state = 416;
	            _la = this._input.LA(1);
	            if(!(_la===61 || _la===63)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 417;
	            this.equality();
	            this.state = 422;
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
	    this.enterRule(localctx, 74, VbishParser.RULE_equality);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 423;
	        this.relational();
	        this.state = 428;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===72 || _la===81) {
	            this.state = 424;
	            _la = this._input.LA(1);
	            if(!(_la===72 || _la===81)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 425;
	            this.relational();
	            this.state = 430;
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
	    this.enterRule(localctx, 76, VbishParser.RULE_relational);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 431;
	        this.additive();
	        this.state = 436;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 82)) & ~0x1f) === 0 && ((1 << (_la - 82)) & 15) !== 0)) {
	            this.state = 432;
	            _la = this._input.LA(1);
	            if(!(((((_la - 82)) & ~0x1f) === 0 && ((1 << (_la - 82)) & 15) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 433;
	            this.additive();
	            this.state = 438;
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
	    this.enterRule(localctx, 78, VbishParser.RULE_additive);
	    var _la = 0;
	    try {
	        this.state = 455;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,50,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 439;
	            this.multiplicative();
	            this.state = 444;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===77 || _la===78) {
	                this.state = 440;
	                _la = this._input.LA(1);
	                if(!(_la===77 || _la===78)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
	                this.state = 441;
	                this.multiplicative();
	                this.state = 446;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 447;
	            this.multiplicative();
	            this.state = 452;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===76) {
	                this.state = 448;
	                this.match(VbishParser.AMPERSAND);
	                this.state = 449;
	                this.multiplicative();
	                this.state = 454;
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
	    this.enterRule(localctx, 80, VbishParser.RULE_multiplicative);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 457;
	        this.primary();
	        this.state = 462;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===79 || _la===80) {
	            this.state = 458;
	            _la = this._input.LA(1);
	            if(!(_la===79 || _la===80)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 459;
	            this.primary();
	            this.state = 464;
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
	    this.enterRule(localctx, 82, VbishParser.RULE_primary);
	    var _la = 0;
	    try {
	        this.state = 477;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 87:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 465;
	            this.match(VbishParser.STRING_LITERAL);
	            break;
	        case 86:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 466;
	            this.match(VbishParser.NUMBER);
	            break;
	        case 70:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 467;
	            this.match(VbishParser.TRUE);
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 468;
	            this.match(VbishParser.FALSE);
	            break;
	        case 88:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 469;
	            this.match(VbishParser.IDENTIFIER);
	            this.state = 471;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===73) {
	                this.state = 470;
	                this.parameterList();
	            }

	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 473;
	            this.match(VbishParser.LPAREN);
	            this.state = 474;
	            this.expression();
	            this.state = 475;
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
	    this.enterRule(localctx, 84, VbishParser.RULE_concatenation);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 479;
	        this.match(VbishParser.AMPERSAND);
	        this.state = 480;
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
	    this.enterRule(localctx, 86, VbishParser.RULE_addOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 482;
	        _la = this._input.LA(1);
	        if(!(_la===77 || _la===78)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 483;
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
	    this.enterRule(localctx, 88, VbishParser.RULE_mulOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 485;
	        _la = this._input.LA(1);
	        if(!(_la===79 || _la===80)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 486;
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
	    this.enterRule(localctx, 90, VbishParser.RULE_relOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 488;
	        _la = this._input.LA(1);
	        if(!(((((_la - 81)) & ~0x1f) === 0 && ((1 << (_la - 81)) & 1055) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 489;
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
	    this.enterRule(localctx, 92, VbishParser.RULE_typeName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 491;
	        _la = this._input.LA(1);
	        if(!(((((_la - 66)) & ~0x1f) === 0 && ((1 << (_la - 66)) & 4194319) !== 0))) {
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
	    this.enterRule(localctx, 94, VbishParser.RULE_stringOrIdentifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 493;
	        _la = this._input.LA(1);
	        if(!(_la===87 || _la===88)) {
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
VbishParser.SYSTEM = 30;
VbishParser.TYPE = 31;
VbishParser.DATABASE = 32;
VbishParser.OF = 33;
VbishParser.QUEUE = 34;
VbishParser.VISIBILITY = 35;
VbishParser.INTERNAL = 36;
VbishParser.EXPOSED = 37;
VbishParser.BEGIN_KW = 38;
VbishParser.ARROW = 39;
VbishParser.USING = 40;
VbishParser.LIBRARIAN = 41;
VbishParser.FROM = 42;
VbishParser.AS = 43;
VbishParser.OPTION = 44;
VbishParser.EXPLICIT = 45;
VbishParser.DIM = 46;
VbishParser.SUB = 47;
VbishParser.FUNCTION = 48;
VbishParser.END = 49;
VbishParser.RETURN = 50;
VbishParser.IF = 51;
VbishParser.THEN = 52;
VbishParser.ELSE = 53;
VbishParser.FOR = 54;
VbishParser.TO = 55;
VbishParser.STEP = 56;
VbishParser.NEXT = 57;
VbishParser.WHILE = 58;
VbishParser.PRINT = 59;
VbishParser.DISPLAY = 60;
VbishParser.AND = 61;
VbishParser.OR = 62;
VbishParser.ANDALSO = 63;
VbishParser.ORELSE = 64;
VbishParser.NOT = 65;
VbishParser.STRING = 66;
VbishParser.INTEGER = 67;
VbishParser.DOUBLE = 68;
VbishParser.BOOLEAN = 69;
VbishParser.TRUE = 70;
VbishParser.FALSE = 71;
VbishParser.ASSIGN = 72;
VbishParser.LPAREN = 73;
VbishParser.RPAREN = 74;
VbishParser.COMMA = 75;
VbishParser.AMPERSAND = 76;
VbishParser.PLUS = 77;
VbishParser.MINUS = 78;
VbishParser.MUL = 79;
VbishParser.DIV = 80;
VbishParser.NE = 81;
VbishParser.LT = 82;
VbishParser.GT = 83;
VbishParser.LTE = 84;
VbishParser.GTE = 85;
VbishParser.NUMBER = 86;
VbishParser.STRING_LITERAL = 87;
VbishParser.IDENTIFIER = 88;
VbishParser.COMMENT = 89;
VbishParser.WS = 90;
VbishParser.EQ = 91;

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
VbishParser.RULE_systemDecl = 15;
VbishParser.RULE_databaseDecl = 16;
VbishParser.RULE_systemMember = 17;
VbishParser.RULE_systemQueueDecl = 18;
VbishParser.RULE_systemServiceDecl = 19;
VbishParser.RULE_systemVisibilityClause = 20;
VbishParser.RULE_variableDecl = 21;
VbishParser.RULE_subDecl = 22;
VbishParser.RULE_functionDecl = 23;
VbishParser.RULE_parameterList = 24;
VbishParser.RULE_parameter = 25;
VbishParser.RULE_statement = 26;
VbishParser.RULE_ifStatement = 27;
VbishParser.RULE_forStatement = 28;
VbishParser.RULE_whileStatement = 29;
VbishParser.RULE_printStatement = 30;
VbishParser.RULE_assignment = 31;
VbishParser.RULE_callStatement = 32;
VbishParser.RULE_returnStatement = 33;
VbishParser.RULE_expression = 34;
VbishParser.RULE_logicalOr = 35;
VbishParser.RULE_logicalAnd = 36;
VbishParser.RULE_equality = 37;
VbishParser.RULE_relational = 38;
VbishParser.RULE_additive = 39;
VbishParser.RULE_multiplicative = 40;
VbishParser.RULE_primary = 41;
VbishParser.RULE_concatenation = 42;
VbishParser.RULE_addOp = 43;
VbishParser.RULE_mulOp = 44;
VbishParser.RULE_relOp = 45;
VbishParser.RULE_typeName = 46;
VbishParser.RULE_stringOrIdentifier = 47;

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

	systemDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SystemDeclContext);
	    } else {
	        return this.getTypedRuleContext(SystemDeclContext,i);
	    }
	};

	databaseDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DatabaseDeclContext);
	    } else {
	        return this.getTypedRuleContext(DatabaseDeclContext,i);
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



class SystemDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_systemDecl;
    }

	SYSTEM() {
	    return this.getToken(VbishParser.SYSTEM, 0);
	};

	BEGIN_KW() {
	    return this.getToken(VbishParser.BEGIN_KW, 0);
	};

	END() {
	    return this.getToken(VbishParser.END, 0);
	};

	TYPE() {
	    return this.getToken(VbishParser.TYPE, 0);
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

	systemVisibilityClause() {
	    return this.getTypedRuleContext(SystemVisibilityClauseContext,0);
	};

	systemMember = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SystemMemberContext);
	    } else {
	        return this.getTypedRuleContext(SystemMemberContext,i);
	    }
	};

	OF() {
	    return this.getToken(VbishParser.OF, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSystemDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DatabaseDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_databaseDecl;
    }

	DATABASE() {
	    return this.getToken(VbishParser.DATABASE, 0);
	};

	stringOrIdentifier() {
	    return this.getTypedRuleContext(StringOrIdentifierContext,0);
	};

	TYPE() {
	    return this.getToken(VbishParser.TYPE, 0);
	};

	typeName() {
	    return this.getTypedRuleContext(TypeNameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitDatabaseDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SystemMemberContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_systemMember;
    }

	systemQueueDecl() {
	    return this.getTypedRuleContext(SystemQueueDeclContext,0);
	};

	systemServiceDecl() {
	    return this.getTypedRuleContext(SystemServiceDeclContext,0);
	};

	systemDecl() {
	    return this.getTypedRuleContext(SystemDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSystemMember(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SystemQueueDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_systemQueueDecl;
    }

	QUEUE() {
	    return this.getToken(VbishParser.QUEUE, 0);
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

	TYPE() {
	    return this.getToken(VbishParser.TYPE, 0);
	};

	ARROW() {
	    return this.getToken(VbishParser.ARROW, 0);
	};

	systemVisibilityClause() {
	    return this.getTypedRuleContext(SystemVisibilityClauseContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSystemQueueDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SystemServiceDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_systemServiceDecl;
    }

	SERVICE() {
	    return this.getToken(VbishParser.SERVICE, 0);
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

	ARROW() {
	    return this.getToken(VbishParser.ARROW, 0);
	};

	systemVisibilityClause() {
	    return this.getTypedRuleContext(SystemVisibilityClauseContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSystemServiceDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SystemVisibilityClauseContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = VbishParser.RULE_systemVisibilityClause;
    }

	VISIBILITY() {
	    return this.getToken(VbishParser.VISIBILITY, 0);
	};

	INTERNAL() {
	    return this.getToken(VbishParser.INTERNAL, 0);
	};

	EXPOSED() {
	    return this.getToken(VbishParser.EXPOSED, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof VbishVisitor ) {
	        return visitor.visitSystemVisibilityClause(this);
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

	ASSIGN = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(VbishParser.ASSIGN);
	    } else {
	        return this.getToken(VbishParser.ASSIGN, i);
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
VbishParser.SystemDeclContext = SystemDeclContext; 
VbishParser.DatabaseDeclContext = DatabaseDeclContext; 
VbishParser.SystemMemberContext = SystemMemberContext; 
VbishParser.SystemQueueDeclContext = SystemQueueDeclContext; 
VbishParser.SystemServiceDeclContext = SystemServiceDeclContext; 
VbishParser.SystemVisibilityClauseContext = SystemVisibilityClauseContext; 
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
