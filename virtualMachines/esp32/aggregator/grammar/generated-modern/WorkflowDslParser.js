// Generated from grammar/WorkflowDsl.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import WorkflowDslVisitor from './WorkflowDslVisitor.js';

const serializedATN = [4,1,111,515,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,1,0,5,0,72,8,0,10,0,12,0,75,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
1,1,1,1,1,1,1,3,1,90,8,1,1,2,1,2,1,2,1,2,5,2,96,8,2,10,2,12,2,99,9,2,1,2,
1,2,1,2,1,3,1,3,1,3,3,3,107,8,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,5,1,5,1,5,
1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,3,6,132,8,6,1,6,1,6,
1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,
1,8,1,8,5,8,156,8,8,10,8,12,8,159,9,8,1,8,1,8,1,8,1,9,1,9,1,9,1,9,1,9,1,
9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,3,9,177,8,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,
9,1,9,1,9,3,9,189,8,9,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,
1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,3,12,209,8,12,1,12,1,12,1,12,1,12,
3,12,215,8,12,1,12,1,12,3,12,219,8,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,
1,13,3,13,229,8,13,1,13,1,13,3,13,233,8,13,1,13,1,13,3,13,237,8,13,1,13,
1,13,1,14,1,14,1,14,1,14,1,14,5,14,246,8,14,10,14,12,14,249,9,14,1,14,1,
14,1,14,1,15,1,15,1,15,1,15,1,15,3,15,259,8,15,1,15,3,15,262,8,15,1,15,1,
15,5,15,266,8,15,10,15,12,15,269,9,15,1,15,1,15,1,15,1,16,1,16,1,16,3,16,
277,8,16,1,17,1,17,1,17,1,17,3,17,283,8,17,1,17,1,17,3,17,287,8,17,1,17,
1,17,1,17,1,17,3,17,293,8,17,1,17,3,17,296,8,17,1,17,1,17,1,18,1,18,1,18,
1,18,1,18,3,18,305,8,18,1,18,1,18,1,19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,
1,20,3,20,318,8,20,1,20,1,20,1,21,1,21,1,21,1,21,1,21,1,21,1,22,1,22,1,22,
1,22,5,22,332,8,22,10,22,12,22,335,9,22,1,22,1,22,1,22,1,23,1,23,1,23,1,
23,3,23,344,8,23,1,24,1,24,1,24,1,24,1,24,3,24,351,8,24,1,24,1,24,4,24,355,
8,24,11,24,12,24,356,1,24,1,24,1,24,1,25,1,25,1,25,1,25,3,25,366,8,25,1,
26,1,26,1,26,1,26,5,26,372,8,26,10,26,12,26,375,9,26,1,26,1,26,1,26,1,27,
1,27,1,27,5,27,383,8,27,10,27,12,27,386,9,27,1,27,1,27,1,27,1,27,5,27,392,
8,27,10,27,12,27,395,9,27,1,27,3,27,398,8,27,1,27,1,27,1,27,1,28,1,28,1,
28,1,28,1,28,1,29,4,29,409,8,29,11,29,12,29,410,1,30,1,30,1,30,1,30,1,30,
1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,
30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,
1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,
30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,30,3,30,473,8,30,
1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,3,31,485,8,31,1,31,1,31,
1,31,1,32,1,32,5,32,492,8,32,10,32,12,32,495,9,32,1,32,1,32,1,32,3,32,500,
8,32,1,33,1,33,1,33,1,33,5,33,506,8,33,10,33,12,33,509,9,33,1,33,1,33,1,
34,1,34,1,34,0,0,35,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,
38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,0,6,1,0,55,56,1,0,87,89,
1,0,97,98,1,0,72,73,1,0,9,10,1,0,82,83,592,0,73,1,0,0,0,2,89,1,0,0,0,4,91,
1,0,0,0,6,106,1,0,0,0,8,108,1,0,0,0,10,115,1,0,0,0,12,126,1,0,0,0,14,137,
1,0,0,0,16,147,1,0,0,0,18,188,1,0,0,0,20,190,1,0,0,0,22,200,1,0,0,0,24,202,
1,0,0,0,26,222,1,0,0,0,28,240,1,0,0,0,30,253,1,0,0,0,32,276,1,0,0,0,34,278,
1,0,0,0,36,299,1,0,0,0,38,308,1,0,0,0,40,311,1,0,0,0,42,321,1,0,0,0,44,327,
1,0,0,0,46,343,1,0,0,0,48,345,1,0,0,0,50,365,1,0,0,0,52,367,1,0,0,0,54,379,
1,0,0,0,56,402,1,0,0,0,58,408,1,0,0,0,60,472,1,0,0,0,62,474,1,0,0,0,64,499,
1,0,0,0,66,501,1,0,0,0,68,512,1,0,0,0,70,72,3,2,1,0,71,70,1,0,0,0,72,75,
1,0,0,0,73,71,1,0,0,0,73,74,1,0,0,0,74,76,1,0,0,0,75,73,1,0,0,0,76,77,5,
0,0,1,77,1,1,0,0,0,78,90,3,24,12,0,79,90,3,26,13,0,80,90,3,28,14,0,81,90,
3,30,15,0,82,90,3,40,20,0,83,90,3,42,21,0,84,90,3,44,22,0,85,90,3,16,8,0,
86,90,3,12,6,0,87,90,3,14,7,0,88,90,3,4,2,0,89,78,1,0,0,0,89,79,1,0,0,0,
89,80,1,0,0,0,89,81,1,0,0,0,89,82,1,0,0,0,89,83,1,0,0,0,89,84,1,0,0,0,89,
85,1,0,0,0,89,86,1,0,0,0,89,87,1,0,0,0,89,88,1,0,0,0,90,3,1,0,0,0,91,92,
5,53,0,0,92,93,3,68,34,0,93,97,5,15,0,0,94,96,3,6,3,0,95,94,1,0,0,0,96,99,
1,0,0,0,97,95,1,0,0,0,97,98,1,0,0,0,98,100,1,0,0,0,99,97,1,0,0,0,100,101,
5,16,0,0,101,102,5,104,0,0,102,5,1,0,0,0,103,107,3,4,2,0,104,107,3,8,4,0,
105,107,3,10,5,0,106,103,1,0,0,0,106,104,1,0,0,0,106,105,1,0,0,0,107,7,1,
0,0,0,108,109,5,54,0,0,109,110,3,68,34,0,110,111,7,0,0,0,111,112,5,35,0,
0,112,113,3,68,34,0,113,114,5,104,0,0,114,9,1,0,0,0,115,116,5,57,0,0,116,
117,5,1,0,0,117,118,3,68,34,0,118,119,5,58,0,0,119,120,3,68,34,0,120,121,
5,42,0,0,121,122,3,68,34,0,122,123,5,35,0,0,123,124,3,68,34,0,124,125,5,
104,0,0,125,11,1,0,0,0,126,127,5,28,0,0,127,128,5,50,0,0,128,131,3,68,34,
0,129,130,5,52,0,0,130,132,3,68,34,0,131,129,1,0,0,0,131,132,1,0,0,0,132,
133,1,0,0,0,133,134,5,51,0,0,134,135,3,66,33,0,135,136,5,104,0,0,136,13,
1,0,0,0,137,138,5,48,0,0,138,139,5,49,0,0,139,140,3,68,34,0,140,141,5,11,
0,0,141,142,3,68,34,0,142,143,5,42,0,0,143,144,5,50,0,0,144,145,3,68,34,
0,145,146,5,104,0,0,146,15,1,0,0,0,147,148,5,47,0,0,148,149,3,68,34,0,149,
150,5,44,0,0,150,151,3,68,34,0,151,152,5,95,0,0,152,153,3,66,33,0,153,157,
5,15,0,0,154,156,3,18,9,0,155,154,1,0,0,0,156,159,1,0,0,0,157,155,1,0,0,
0,157,158,1,0,0,0,158,160,1,0,0,0,159,157,1,0,0,0,160,161,5,16,0,0,161,162,
5,104,0,0,162,17,1,0,0,0,163,164,7,1,0,0,164,165,3,68,34,0,165,166,5,11,
0,0,166,167,3,68,34,0,167,168,5,1,0,0,168,169,3,68,34,0,169,170,5,99,0,0,
170,171,3,68,34,0,171,172,5,95,0,0,172,173,3,66,33,0,173,174,5,96,0,0,174,
176,3,22,11,0,175,177,3,20,10,0,176,175,1,0,0,0,176,177,1,0,0,0,177,178,
1,0,0,0,178,179,5,104,0,0,179,189,1,0,0,0,180,181,5,59,0,0,181,182,5,87,
0,0,182,183,3,68,34,0,183,184,5,58,0,0,184,185,5,95,0,0,185,186,3,66,33,
0,186,187,5,104,0,0,187,189,1,0,0,0,188,163,1,0,0,0,188,180,1,0,0,0,189,
19,1,0,0,0,190,191,5,90,0,0,191,192,3,22,11,0,192,193,5,91,0,0,193,194,5,
106,0,0,194,195,5,92,0,0,195,196,5,106,0,0,196,197,5,93,0,0,197,198,5,106,
0,0,198,199,5,94,0,0,199,21,1,0,0,0,200,201,7,2,0,0,201,23,1,0,0,0,202,203,
5,1,0,0,203,204,3,68,34,0,204,205,5,99,0,0,205,208,3,68,34,0,206,207,5,3,
0,0,207,209,3,68,34,0,208,206,1,0,0,0,208,209,1,0,0,0,209,214,1,0,0,0,210,
211,5,35,0,0,211,215,3,68,34,0,212,213,5,36,0,0,213,215,3,66,33,0,214,210,
1,0,0,0,214,212,1,0,0,0,214,215,1,0,0,0,215,218,1,0,0,0,216,217,5,5,0,0,
217,219,7,3,0,0,218,216,1,0,0,0,218,219,1,0,0,0,219,220,1,0,0,0,220,221,
5,104,0,0,221,25,1,0,0,0,222,223,5,2,0,0,223,224,3,68,34,0,224,225,5,99,
0,0,225,228,3,68,34,0,226,227,5,35,0,0,227,229,3,68,34,0,228,226,1,0,0,0,
228,229,1,0,0,0,229,232,1,0,0,0,230,231,5,3,0,0,231,233,3,68,34,0,232,230,
1,0,0,0,232,233,1,0,0,0,233,236,1,0,0,0,234,235,5,4,0,0,235,237,3,68,34,
0,236,234,1,0,0,0,236,237,1,0,0,0,237,238,1,0,0,0,238,239,5,104,0,0,239,
27,1,0,0,0,240,241,5,6,0,0,241,242,5,35,0,0,242,243,3,68,34,0,243,247,5,
15,0,0,244,246,3,32,16,0,245,244,1,0,0,0,246,249,1,0,0,0,247,245,1,0,0,0,
247,248,1,0,0,0,248,250,1,0,0,0,249,247,1,0,0,0,250,251,5,16,0,0,251,252,
5,104,0,0,252,29,1,0,0,0,253,254,5,6,0,0,254,258,3,68,34,0,255,256,5,7,0,
0,256,257,5,35,0,0,257,259,3,68,34,0,258,255,1,0,0,0,258,259,1,0,0,0,259,
261,1,0,0,0,260,262,3,38,19,0,261,260,1,0,0,0,261,262,1,0,0,0,262,263,1,
0,0,0,263,267,5,15,0,0,264,266,3,32,16,0,265,264,1,0,0,0,266,269,1,0,0,0,
267,265,1,0,0,0,267,268,1,0,0,0,268,270,1,0,0,0,269,267,1,0,0,0,270,271,
5,16,0,0,271,272,5,104,0,0,272,31,1,0,0,0,273,277,3,34,17,0,274,277,3,36,
18,0,275,277,3,30,15,0,276,273,1,0,0,0,276,274,1,0,0,0,276,275,1,0,0,0,277,
33,1,0,0,0,278,279,5,1,0,0,279,282,3,68,34,0,280,281,5,99,0,0,281,283,3,
68,34,0,282,280,1,0,0,0,282,283,1,0,0,0,283,286,1,0,0,0,284,285,5,3,0,0,
285,287,3,68,34,0,286,284,1,0,0,0,286,287,1,0,0,0,287,292,1,0,0,0,288,289,
5,35,0,0,289,293,3,68,34,0,290,291,5,36,0,0,291,293,3,66,33,0,292,288,1,
0,0,0,292,290,1,0,0,0,292,293,1,0,0,0,293,295,1,0,0,0,294,296,3,38,19,0,
295,294,1,0,0,0,295,296,1,0,0,0,296,297,1,0,0,0,297,298,5,104,0,0,298,35,
1,0,0,0,299,300,5,87,0,0,300,301,3,68,34,0,301,302,5,99,0,0,302,304,3,68,
34,0,303,305,3,38,19,0,304,303,1,0,0,0,304,305,1,0,0,0,305,306,1,0,0,0,306,
307,5,104,0,0,307,37,1,0,0,0,308,309,5,8,0,0,309,310,7,4,0,0,310,39,1,0,
0,0,311,312,5,11,0,0,312,313,3,68,34,0,313,314,5,99,0,0,314,317,3,68,34,
0,315,316,5,3,0,0,316,318,3,68,34,0,317,315,1,0,0,0,317,318,1,0,0,0,318,
319,1,0,0,0,319,320,5,104,0,0,320,41,1,0,0,0,321,322,5,12,0,0,322,323,3,
68,34,0,323,324,5,13,0,0,324,325,3,68,34,0,325,326,5,104,0,0,326,43,1,0,
0,0,327,328,5,14,0,0,328,329,3,68,34,0,329,333,5,15,0,0,330,332,3,46,23,
0,331,330,1,0,0,0,332,335,1,0,0,0,333,331,1,0,0,0,333,334,1,0,0,0,334,336,
1,0,0,0,335,333,1,0,0,0,336,337,5,16,0,0,337,338,5,104,0,0,338,45,1,0,0,
0,339,344,3,56,28,0,340,344,3,62,31,0,341,344,3,48,24,0,342,344,3,54,27,
0,343,339,1,0,0,0,343,340,1,0,0,0,343,341,1,0,0,0,343,342,1,0,0,0,344,47,
1,0,0,0,345,346,5,69,0,0,346,350,3,50,25,0,347,348,5,74,0,0,348,349,5,75,
0,0,349,351,5,76,0,0,350,347,1,0,0,0,350,351,1,0,0,0,351,352,1,0,0,0,352,
354,5,15,0,0,353,355,3,52,26,0,354,353,1,0,0,0,355,356,1,0,0,0,356,354,1,
0,0,0,356,357,1,0,0,0,357,358,1,0,0,0,358,359,5,70,0,0,359,360,5,104,0,0,
360,49,1,0,0,0,361,366,5,72,0,0,362,363,5,73,0,0,363,364,5,22,0,0,364,366,
5,106,0,0,365,361,1,0,0,0,365,362,1,0,0,0,366,51,1,0,0,0,367,368,5,71,0,
0,368,369,3,68,34,0,369,373,5,15,0,0,370,372,3,46,23,0,371,370,1,0,0,0,372,
375,1,0,0,0,373,371,1,0,0,0,373,374,1,0,0,0,374,376,1,0,0,0,375,373,1,0,
0,0,376,377,5,16,0,0,377,378,5,104,0,0,378,53,1,0,0,0,379,380,5,77,0,0,380,
384,5,15,0,0,381,383,3,46,23,0,382,381,1,0,0,0,383,386,1,0,0,0,384,382,1,
0,0,0,384,385,1,0,0,0,385,387,1,0,0,0,386,384,1,0,0,0,387,397,5,16,0,0,388,
389,5,78,0,0,389,393,5,15,0,0,390,392,3,46,23,0,391,390,1,0,0,0,392,395,
1,0,0,0,393,391,1,0,0,0,393,394,1,0,0,0,394,396,1,0,0,0,395,393,1,0,0,0,
396,398,5,16,0,0,397,388,1,0,0,0,397,398,1,0,0,0,398,399,1,0,0,0,399,400,
5,79,0,0,400,401,5,104,0,0,401,55,1,0,0,0,402,403,5,17,0,0,403,404,3,68,
34,0,404,405,3,58,29,0,405,406,5,104,0,0,406,57,1,0,0,0,407,409,3,60,30,
0,408,407,1,0,0,0,409,410,1,0,0,0,410,408,1,0,0,0,410,411,1,0,0,0,411,59,
1,0,0,0,412,473,3,68,34,0,413,473,5,106,0,0,414,473,5,107,0,0,415,473,5,
101,0,0,416,473,5,102,0,0,417,473,5,103,0,0,418,473,5,100,0,0,419,473,5,
18,0,0,420,473,5,87,0,0,421,473,5,12,0,0,422,473,5,19,0,0,423,473,5,1,0,
0,424,473,5,20,0,0,425,473,5,21,0,0,426,473,5,22,0,0,427,473,5,23,0,0,428,
473,5,24,0,0,429,473,5,25,0,0,430,473,5,26,0,0,431,473,5,27,0,0,432,473,
5,28,0,0,433,473,5,29,0,0,434,473,5,30,0,0,435,473,5,31,0,0,436,473,5,32,
0,0,437,473,5,33,0,0,438,473,5,34,0,0,439,473,5,35,0,0,440,473,5,37,0,0,
441,473,5,38,0,0,442,473,5,39,0,0,443,473,5,40,0,0,444,473,5,41,0,0,445,
473,5,42,0,0,446,473,5,43,0,0,447,473,5,44,0,0,448,473,5,45,0,0,449,473,
5,46,0,0,450,473,5,47,0,0,451,473,5,49,0,0,452,473,5,60,0,0,453,473,5,61,
0,0,454,473,5,62,0,0,455,473,5,63,0,0,456,473,5,64,0,0,457,473,5,65,0,0,
458,473,5,66,0,0,459,473,5,67,0,0,460,473,5,68,0,0,461,473,5,69,0,0,462,
473,5,70,0,0,463,473,5,71,0,0,464,473,5,72,0,0,465,473,5,73,0,0,466,473,
5,74,0,0,467,473,5,75,0,0,468,473,5,76,0,0,469,473,5,77,0,0,470,473,5,78,
0,0,471,473,5,79,0,0,472,412,1,0,0,0,472,413,1,0,0,0,472,414,1,0,0,0,472,
415,1,0,0,0,472,416,1,0,0,0,472,417,1,0,0,0,472,418,1,0,0,0,472,419,1,0,
0,0,472,420,1,0,0,0,472,421,1,0,0,0,472,422,1,0,0,0,472,423,1,0,0,0,472,
424,1,0,0,0,472,425,1,0,0,0,472,426,1,0,0,0,472,427,1,0,0,0,472,428,1,0,
0,0,472,429,1,0,0,0,472,430,1,0,0,0,472,431,1,0,0,0,472,432,1,0,0,0,472,
433,1,0,0,0,472,434,1,0,0,0,472,435,1,0,0,0,472,436,1,0,0,0,472,437,1,0,
0,0,472,438,1,0,0,0,472,439,1,0,0,0,472,440,1,0,0,0,472,441,1,0,0,0,472,
442,1,0,0,0,472,443,1,0,0,0,472,444,1,0,0,0,472,445,1,0,0,0,472,446,1,0,
0,0,472,447,1,0,0,0,472,448,1,0,0,0,472,449,1,0,0,0,472,450,1,0,0,0,472,
451,1,0,0,0,472,452,1,0,0,0,472,453,1,0,0,0,472,454,1,0,0,0,472,455,1,0,
0,0,472,456,1,0,0,0,472,457,1,0,0,0,472,458,1,0,0,0,472,459,1,0,0,0,472,
460,1,0,0,0,472,461,1,0,0,0,472,462,1,0,0,0,472,463,1,0,0,0,472,464,1,0,
0,0,472,465,1,0,0,0,472,466,1,0,0,0,472,467,1,0,0,0,472,468,1,0,0,0,472,
469,1,0,0,0,472,470,1,0,0,0,472,471,1,0,0,0,473,61,1,0,0,0,474,475,5,80,
0,0,475,476,5,81,0,0,476,477,3,68,34,0,477,478,7,5,0,0,478,479,3,68,34,0,
479,480,5,84,0,0,480,484,3,64,32,0,481,482,5,85,0,0,482,483,5,104,0,0,483,
485,3,64,32,0,484,481,1,0,0,0,484,485,1,0,0,0,485,486,1,0,0,0,486,487,5,
86,0,0,487,488,5,104,0,0,488,63,1,0,0,0,489,493,5,15,0,0,490,492,3,46,23,
0,491,490,1,0,0,0,492,495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,496,
1,0,0,0,495,493,1,0,0,0,496,497,5,16,0,0,497,500,5,104,0,0,498,500,3,56,
28,0,499,489,1,0,0,0,499,498,1,0,0,0,500,65,1,0,0,0,501,502,5,101,0,0,502,
507,3,68,34,0,503,504,5,103,0,0,504,506,3,68,34,0,505,503,1,0,0,0,506,509,
1,0,0,0,507,505,1,0,0,0,507,508,1,0,0,0,508,510,1,0,0,0,509,507,1,0,0,0,
510,511,5,102,0,0,511,67,1,0,0,0,512,513,5,105,0,0,513,69,1,0,0,0,40,73,
89,97,106,131,157,176,188,208,214,218,228,232,236,247,258,261,267,276,282,
286,292,295,304,317,333,343,350,356,365,373,384,393,397,410,472,484,493,
499,507];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class WorkflowDslParser extends antlr4.Parser {

    static grammarFileName = "WorkflowDsl.g4";
    static literalNames = [ null, "'QUEUE'", "'DATABASE'", "'MANAGER'", 
                            "'CONNECTION'", "'MODE'", "'SYSTEM'", "'OF'", 
                            "'VISIBILITY'", "'INTERNAL'", "'EXPOSED'", "'FILE'", 
                            "'API'", "'BASE'", "'WORKFLOW'", "'BEGIN'", 
                            "'END'", "'STEP'", "'CALL'", "'ROUTE'", "'SET'", 
                            "'STATE'", "'WAIT'", "'CHECK'", "'EXPECT'", 
                            "'RETRIES'", "'EVERY'", "'ISSUE'", "'CREATE'", 
                            "'TITLE'", "'DESCRIPTION'", "'PRIORITY'", "'ASSIGN'", 
                            "'USER'", "'REPORTER'", "'TYPE'", "'TYPES'", 
                            "'INTO'", "'TESTCASE'", "'TESTPLAN'", "'PLAN'", 
                            "'LINK'", "'TO'", "'ADD'", "'PROJECT'", "'RELEASE'", 
                            "'FOR'", "'DEPLOYMENT'", "'DEPLOY'", "'ARTIFACT'", 
                            "'CLUSTER'", "'NODES'", "'LABEL'", "'GENERIC_SYSTEM'", 
                            "'PORT'", "'INPUT'", "'OUTPUT'", "'CONNECT'", 
                            "'FROM'", "'REMOVE'", "'LOCATION'", "'PROJECTPLAN'", 
                            "'MILESTONE'", "'DUE'", "'DATE'", "'TASK'", 
                            "'SYNCHPOINT'", "'DELIVERABLE'", "'RESOURCE'", 
                            "'COBEGIN'", "'COEND'", "'SUBFLOW'", "'SYNC'", 
                            "'ASYNC'", "'ON'", "'ERROR'", "'BACKOUT'", "'TRY'", 
                            "'CATCH'", "'ENDTRY'", "'IF'", "'FIELD'", "'EQUALS'", 
                            "'CONTAINS'", "'THEN'", "'ELSE'", "'ENDIF'", 
                            "'SERVICE'", "'PROGRAM'", "'DAEMON'", "'PERSISTENT'", 
                            "'MIN_INSTANCES'", "'MAX_INSTANCES'", "'IDLE_TIMEOUT'", 
                            null, "'TARGETS'", "'STARTUP'", "'TRUE'", "'FALSE'", 
                            "'->'", "'='", "'('", "')'", "','", "';'" ];
    static symbolicNames = [ null, "QUEUE", "DATABASE", "MANAGER", "CONNECTION", 
                             "MODE", "SYSTEM", "OF", "VISIBILITY", "INTERNAL", 
                             "EXPOSED", "FILE", "API", "BASE", "WORKFLOW", 
                             "BEGIN", "END", "STEP", "CALL", "ROUTE", "SET", 
                             "STATE", "WAIT", "CHECK", "EXPECT", "RETRIES", 
                             "EVERY", "ISSUE", "CREATE", "TITLE", "DESCRIPTION", 
                             "PRIORITY", "ASSIGN", "USER", "REPORTER", "TYPE", 
                             "TYPES", "INTO", "TESTCASE", "TESTPLAN", "PLAN", 
                             "LINK", "TO", "ADD", "PROJECT", "RELEASE", 
                             "FOR", "DEPLOYMENT", "DEPLOY", "ARTIFACT", 
                             "CLUSTER", "NODES", "LABEL", "GENERIC_SYSTEM", 
                             "PORT", "INPUT", "OUTPUT", "CONNECT", "FROM", 
                             "REMOVE", "LOCATION", "PROJECTPLAN", "MILESTONE", 
                             "DUE", "DATE", "TASK", "SYNCHPOINT", "DELIVERABLE", 
                             "RESOURCE", "COBEGIN", "COEND", "SUBFLOW", 
                             "SYNC", "ASYNC", "ON", "ERROR", "BACKOUT", 
                             "TRY", "CATCH", "ENDTRY", "IF", "FIELD", "EQUALS", 
                             "CONTAINS", "THEN", "ELSE", "ENDIF", "SERVICE", 
                             "PROGRAM", "DAEMON", "PERSISTENT", "MIN_INSTANCES", 
                             "MAX_INSTANCES", "IDLE_TIMEOUT", "TIME_UNIT", 
                             "TARGETS", "STARTUP", "TRUE", "FALSE", "ARROW", 
                             "ASSIGN_EQ", "LPAREN", "RPAREN", "COMMA", "SEMICOLON", 
                             "STRING", "NUMBER", "IDENT", "HASH_COMMENT", 
                             "SLASH_COMMENT", "DASH_COMMENT", "WS" ];
    static ruleNames = [ "program", "item", "genericSystemDecl", "genericSystemMember", 
                         "genericSystemPortDecl", "genericSystemConnectionDecl", 
                         "clusterCreateDecl", "artifactDeployDecl", "deploymentDecl", 
                         "deploymentItem", "serviceLifecycleClause", "booleanLiteral", 
                         "queueDecl", "databaseDecl", "systemTypeDecl", 
                         "systemDecl", "systemMember", "systemQueueDecl", 
                         "serviceDecl", "visibilityClause", "fileDecl", 
                         "apiDecl", "workflowDecl", "workflowStmt", "cobeginStmt", 
                         "cobeginMode", "subflowDecl", "tryStmt", "stepStmt", 
                         "stepBody", "stepToken", "ifStmt", "branch", "quotedList", 
                         "quotedString" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = WorkflowDslParser.ruleNames;
        this.literalNames = WorkflowDslParser.literalNames;
        this.symbolicNames = WorkflowDslParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, WorkflowDslParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 73;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 268458054) !== 0) || ((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 67) !== 0)) {
	            this.state = 70;
	            this.item();
	            this.state = 75;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 76;
	        this.match(WorkflowDslParser.EOF);
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



	item() {
	    let localctx = new ItemContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, WorkflowDslParser.RULE_item);
	    try {
	        this.state = 89;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,1,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 78;
	            this.queueDecl();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 79;
	            this.databaseDecl();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 80;
	            this.systemTypeDecl();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 81;
	            this.systemDecl();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 82;
	            this.fileDecl();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 83;
	            this.apiDecl();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 84;
	            this.workflowDecl();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 85;
	            this.deploymentDecl();
	            break;

	        case 9:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 86;
	            this.clusterCreateDecl();
	            break;

	        case 10:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 87;
	            this.artifactDeployDecl();
	            break;

	        case 11:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 88;
	            this.genericSystemDecl();
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



	genericSystemDecl() {
	    let localctx = new GenericSystemDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, WorkflowDslParser.RULE_genericSystemDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 91;
	        this.match(WorkflowDslParser.GENERIC_SYSTEM);
	        this.state = 92;
	        this.quotedString();
	        this.state = 93;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 97;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 53)) & ~0x1f) === 0 && ((1 << (_la - 53)) & 19) !== 0)) {
	            this.state = 94;
	            this.genericSystemMember();
	            this.state = 99;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 100;
	        this.match(WorkflowDslParser.END);
	        this.state = 101;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	genericSystemMember() {
	    let localctx = new GenericSystemMemberContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, WorkflowDslParser.RULE_genericSystemMember);
	    try {
	        this.state = 106;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 53:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 103;
	            this.genericSystemDecl();
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 104;
	            this.genericSystemPortDecl();
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 105;
	            this.genericSystemConnectionDecl();
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



	genericSystemPortDecl() {
	    let localctx = new GenericSystemPortDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, WorkflowDslParser.RULE_genericSystemPortDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 108;
	        this.match(WorkflowDslParser.PORT);
	        this.state = 109;
	        this.quotedString();
	        this.state = 110;
	        _la = this._input.LA(1);
	        if(!(_la===55 || _la===56)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 111;
	        this.match(WorkflowDslParser.TYPE);
	        this.state = 112;
	        this.quotedString();
	        this.state = 113;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	genericSystemConnectionDecl() {
	    let localctx = new GenericSystemConnectionDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, WorkflowDslParser.RULE_genericSystemConnectionDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 115;
	        this.match(WorkflowDslParser.CONNECT);
	        this.state = 116;
	        this.match(WorkflowDslParser.QUEUE);
	        this.state = 117;
	        this.quotedString();
	        this.state = 118;
	        this.match(WorkflowDslParser.FROM);
	        this.state = 119;
	        this.quotedString();
	        this.state = 120;
	        this.match(WorkflowDslParser.TO);
	        this.state = 121;
	        this.quotedString();
	        this.state = 122;
	        this.match(WorkflowDslParser.TYPE);
	        this.state = 123;
	        this.quotedString();
	        this.state = 124;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	clusterCreateDecl() {
	    let localctx = new ClusterCreateDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, WorkflowDslParser.RULE_clusterCreateDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 126;
	        this.match(WorkflowDslParser.CREATE);
	        this.state = 127;
	        this.match(WorkflowDslParser.CLUSTER);
	        this.state = 128;
	        this.quotedString();
	        this.state = 131;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===52) {
	            this.state = 129;
	            this.match(WorkflowDslParser.LABEL);
	            this.state = 130;
	            this.quotedString();
	        }

	        this.state = 133;
	        this.match(WorkflowDslParser.NODES);
	        this.state = 134;
	        this.quotedList();
	        this.state = 135;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	artifactDeployDecl() {
	    let localctx = new ArtifactDeployDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, WorkflowDslParser.RULE_artifactDeployDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 137;
	        this.match(WorkflowDslParser.DEPLOY);
	        this.state = 138;
	        this.match(WorkflowDslParser.ARTIFACT);
	        this.state = 139;
	        this.quotedString();
	        this.state = 140;
	        this.match(WorkflowDslParser.FILE);
	        this.state = 141;
	        this.quotedString();
	        this.state = 142;
	        this.match(WorkflowDslParser.TO);
	        this.state = 143;
	        this.match(WorkflowDslParser.CLUSTER);
	        this.state = 144;
	        this.quotedString();
	        this.state = 145;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	deploymentDecl() {
	    let localctx = new DeploymentDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, WorkflowDslParser.RULE_deploymentDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 147;
	        this.match(WorkflowDslParser.DEPLOYMENT);
	        this.state = 148;
	        this.quotedString();
	        this.state = 149;
	        this.match(WorkflowDslParser.PROJECT);
	        this.state = 150;
	        this.quotedString();
	        this.state = 151;
	        this.match(WorkflowDslParser.TARGETS);
	        this.state = 152;
	        this.quotedList();
	        this.state = 153;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 157;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 59)) & ~0x1f) === 0 && ((1 << (_la - 59)) & 1879048193) !== 0)) {
	            this.state = 154;
	            this.deploymentItem();
	            this.state = 159;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 160;
	        this.match(WorkflowDslParser.END);
	        this.state = 161;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	deploymentItem() {
	    let localctx = new DeploymentItemContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, WorkflowDslParser.RULE_deploymentItem);
	    var _la = 0;
	    try {
	        this.state = 188;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 87:
	        case 88:
	        case 89:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 163;
	            _la = this._input.LA(1);
	            if(!(((((_la - 87)) & ~0x1f) === 0 && ((1 << (_la - 87)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 164;
	            this.quotedString();
	            this.state = 165;
	            this.match(WorkflowDslParser.FILE);
	            this.state = 166;
	            this.quotedString();
	            this.state = 167;
	            this.match(WorkflowDslParser.QUEUE);
	            this.state = 168;
	            this.quotedString();
	            this.state = 169;
	            this.match(WorkflowDslParser.ARROW);
	            this.state = 170;
	            this.quotedString();
	            this.state = 171;
	            this.match(WorkflowDslParser.TARGETS);
	            this.state = 172;
	            this.quotedList();
	            this.state = 173;
	            this.match(WorkflowDslParser.STARTUP);
	            this.state = 174;
	            this.booleanLiteral();
	            this.state = 176;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===90) {
	                this.state = 175;
	                this.serviceLifecycleClause();
	            }

	            this.state = 178;
	            this.match(WorkflowDslParser.SEMICOLON);
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 180;
	            this.match(WorkflowDslParser.REMOVE);
	            this.state = 181;
	            this.match(WorkflowDslParser.SERVICE);
	            this.state = 182;
	            this.quotedString();
	            this.state = 183;
	            this.match(WorkflowDslParser.FROM);
	            this.state = 184;
	            this.match(WorkflowDslParser.TARGETS);
	            this.state = 185;
	            this.quotedList();
	            this.state = 186;
	            this.match(WorkflowDslParser.SEMICOLON);
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



	serviceLifecycleClause() {
	    let localctx = new ServiceLifecycleClauseContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, WorkflowDslParser.RULE_serviceLifecycleClause);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 190;
	        this.match(WorkflowDslParser.PERSISTENT);
	        this.state = 191;
	        this.booleanLiteral();
	        this.state = 192;
	        this.match(WorkflowDslParser.MIN_INSTANCES);
	        this.state = 193;
	        this.match(WorkflowDslParser.NUMBER);
	        this.state = 194;
	        this.match(WorkflowDslParser.MAX_INSTANCES);
	        this.state = 195;
	        this.match(WorkflowDslParser.NUMBER);
	        this.state = 196;
	        this.match(WorkflowDslParser.IDLE_TIMEOUT);
	        this.state = 197;
	        this.match(WorkflowDslParser.NUMBER);
	        this.state = 198;
	        this.match(WorkflowDslParser.TIME_UNIT);
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



	booleanLiteral() {
	    let localctx = new BooleanLiteralContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, WorkflowDslParser.RULE_booleanLiteral);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 200;
	        _la = this._input.LA(1);
	        if(!(_la===97 || _la===98)) {
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



	queueDecl() {
	    let localctx = new QueueDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, WorkflowDslParser.RULE_queueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 202;
	        this.match(WorkflowDslParser.QUEUE);
	        this.state = 203;
	        this.quotedString();
	        this.state = 204;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 205;
	        this.quotedString();
	        this.state = 208;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===3) {
	            this.state = 206;
	            this.match(WorkflowDslParser.MANAGER);
	            this.state = 207;
	            this.quotedString();
	        }

	        this.state = 214;
	        this._errHandler.sync(this);
	        switch (this._input.LA(1)) {
	        case 35:
	        	this.state = 210;
	        	this.match(WorkflowDslParser.TYPE);
	        	this.state = 211;
	        	this.quotedString();
	        	break;
	        case 36:
	        	this.state = 212;
	        	this.match(WorkflowDslParser.TYPES);
	        	this.state = 213;
	        	this.quotedList();
	        	break;
	        case 5:
	        case 104:
	        	break;
	        default:
	        	break;
	        }
	        this.state = 218;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===5) {
	            this.state = 216;
	            this.match(WorkflowDslParser.MODE);
	            this.state = 217;
	            _la = this._input.LA(1);
	            if(!(_la===72 || _la===73)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	        }

	        this.state = 220;
	        this.match(WorkflowDslParser.SEMICOLON);
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
	    this.enterRule(localctx, 26, WorkflowDslParser.RULE_databaseDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 222;
	        this.match(WorkflowDslParser.DATABASE);
	        this.state = 223;
	        this.quotedString();
	        this.state = 224;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 225;
	        this.quotedString();
	        this.state = 228;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 226;
	            this.match(WorkflowDslParser.TYPE);
	            this.state = 227;
	            this.quotedString();
	        }

	        this.state = 232;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===3) {
	            this.state = 230;
	            this.match(WorkflowDslParser.MANAGER);
	            this.state = 231;
	            this.quotedString();
	        }

	        this.state = 236;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===4) {
	            this.state = 234;
	            this.match(WorkflowDslParser.CONNECTION);
	            this.state = 235;
	            this.quotedString();
	        }

	        this.state = 238;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	systemTypeDecl() {
	    let localctx = new SystemTypeDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, WorkflowDslParser.RULE_systemTypeDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 240;
	        this.match(WorkflowDslParser.SYSTEM);
	        this.state = 241;
	        this.match(WorkflowDslParser.TYPE);
	        this.state = 242;
	        this.quotedString();
	        this.state = 243;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 247;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1 || _la===6 || _la===87) {
	            this.state = 244;
	            this.systemMember();
	            this.state = 249;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 250;
	        this.match(WorkflowDslParser.END);
	        this.state = 251;
	        this.match(WorkflowDslParser.SEMICOLON);
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
	    this.enterRule(localctx, 30, WorkflowDslParser.RULE_systemDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 253;
	        this.match(WorkflowDslParser.SYSTEM);
	        this.state = 254;
	        this.quotedString();
	        this.state = 258;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===7) {
	            this.state = 255;
	            this.match(WorkflowDslParser.OF);
	            this.state = 256;
	            this.match(WorkflowDslParser.TYPE);
	            this.state = 257;
	            this.quotedString();
	        }

	        this.state = 261;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 260;
	            this.visibilityClause();
	        }

	        this.state = 263;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 267;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1 || _la===6 || _la===87) {
	            this.state = 264;
	            this.systemMember();
	            this.state = 269;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 270;
	        this.match(WorkflowDslParser.END);
	        this.state = 271;
	        this.match(WorkflowDslParser.SEMICOLON);
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
	    this.enterRule(localctx, 32, WorkflowDslParser.RULE_systemMember);
	    try {
	        this.state = 276;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 273;
	            this.systemQueueDecl();
	            break;
	        case 87:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 274;
	            this.serviceDecl();
	            break;
	        case 6:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 275;
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
	    this.enterRule(localctx, 34, WorkflowDslParser.RULE_systemQueueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 278;
	        this.match(WorkflowDslParser.QUEUE);
	        this.state = 279;
	        this.quotedString();
	        this.state = 282;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===99) {
	            this.state = 280;
	            this.match(WorkflowDslParser.ARROW);
	            this.state = 281;
	            this.quotedString();
	        }

	        this.state = 286;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===3) {
	            this.state = 284;
	            this.match(WorkflowDslParser.MANAGER);
	            this.state = 285;
	            this.quotedString();
	        }

	        this.state = 292;
	        this._errHandler.sync(this);
	        switch (this._input.LA(1)) {
	        case 35:
	        	this.state = 288;
	        	this.match(WorkflowDslParser.TYPE);
	        	this.state = 289;
	        	this.quotedString();
	        	break;
	        case 36:
	        	this.state = 290;
	        	this.match(WorkflowDslParser.TYPES);
	        	this.state = 291;
	        	this.quotedList();
	        	break;
	        case 8:
	        case 104:
	        	break;
	        default:
	        	break;
	        }
	        this.state = 295;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 294;
	            this.visibilityClause();
	        }

	        this.state = 297;
	        this.match(WorkflowDslParser.SEMICOLON);
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
	    this.enterRule(localctx, 36, WorkflowDslParser.RULE_serviceDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 299;
	        this.match(WorkflowDslParser.SERVICE);
	        this.state = 300;
	        this.quotedString();
	        this.state = 301;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 302;
	        this.quotedString();
	        this.state = 304;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 303;
	            this.visibilityClause();
	        }

	        this.state = 306;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	visibilityClause() {
	    let localctx = new VisibilityClauseContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, WorkflowDslParser.RULE_visibilityClause);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 308;
	        this.match(WorkflowDslParser.VISIBILITY);
	        this.state = 309;
	        _la = this._input.LA(1);
	        if(!(_la===9 || _la===10)) {
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



	fileDecl() {
	    let localctx = new FileDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, WorkflowDslParser.RULE_fileDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 311;
	        this.match(WorkflowDslParser.FILE);
	        this.state = 312;
	        this.quotedString();
	        this.state = 313;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 314;
	        this.quotedString();
	        this.state = 317;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===3) {
	            this.state = 315;
	            this.match(WorkflowDslParser.MANAGER);
	            this.state = 316;
	            this.quotedString();
	        }

	        this.state = 319;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	apiDecl() {
	    let localctx = new ApiDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, WorkflowDslParser.RULE_apiDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 321;
	        this.match(WorkflowDslParser.API);
	        this.state = 322;
	        this.quotedString();
	        this.state = 323;
	        this.match(WorkflowDslParser.BASE);
	        this.state = 324;
	        this.quotedString();
	        this.state = 325;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	workflowDecl() {
	    let localctx = new WorkflowDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, WorkflowDslParser.RULE_workflowDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 327;
	        this.match(WorkflowDslParser.WORKFLOW);
	        this.state = 328;
	        this.quotedString();
	        this.state = 329;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 333;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17 || ((((_la - 69)) & ~0x1f) === 0 && ((1 << (_la - 69)) & 2305) !== 0)) {
	            this.state = 330;
	            this.workflowStmt();
	            this.state = 335;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 336;
	        this.match(WorkflowDslParser.END);
	        this.state = 337;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	workflowStmt() {
	    let localctx = new WorkflowStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, WorkflowDslParser.RULE_workflowStmt);
	    try {
	        this.state = 343;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 17:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 339;
	            this.stepStmt();
	            break;
	        case 80:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 340;
	            this.ifStmt();
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 341;
	            this.cobeginStmt();
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 342;
	            this.tryStmt();
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



	cobeginStmt() {
	    let localctx = new CobeginStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, WorkflowDslParser.RULE_cobeginStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 345;
	        this.match(WorkflowDslParser.COBEGIN);
	        this.state = 346;
	        this.cobeginMode();
	        this.state = 350;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===74) {
	            this.state = 347;
	            this.match(WorkflowDslParser.ON);
	            this.state = 348;
	            this.match(WorkflowDslParser.ERROR);
	            this.state = 349;
	            this.match(WorkflowDslParser.BACKOUT);
	        }

	        this.state = 352;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 354; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 353;
	            this.subflowDecl();
	            this.state = 356; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===71);
	        this.state = 358;
	        this.match(WorkflowDslParser.COEND);
	        this.state = 359;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	cobeginMode() {
	    let localctx = new CobeginModeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, WorkflowDslParser.RULE_cobeginMode);
	    try {
	        this.state = 365;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 72:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 361;
	            this.match(WorkflowDslParser.SYNC);
	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 362;
	            this.match(WorkflowDslParser.ASYNC);
	            this.state = 363;
	            this.match(WorkflowDslParser.WAIT);
	            this.state = 364;
	            this.match(WorkflowDslParser.NUMBER);
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



	subflowDecl() {
	    let localctx = new SubflowDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 52, WorkflowDslParser.RULE_subflowDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 367;
	        this.match(WorkflowDslParser.SUBFLOW);
	        this.state = 368;
	        this.quotedString();
	        this.state = 369;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 373;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17 || ((((_la - 69)) & ~0x1f) === 0 && ((1 << (_la - 69)) & 2305) !== 0)) {
	            this.state = 370;
	            this.workflowStmt();
	            this.state = 375;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 376;
	        this.match(WorkflowDslParser.END);
	        this.state = 377;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	tryStmt() {
	    let localctx = new TryStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, WorkflowDslParser.RULE_tryStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 379;
	        this.match(WorkflowDslParser.TRY);
	        this.state = 380;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 384;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17 || ((((_la - 69)) & ~0x1f) === 0 && ((1 << (_la - 69)) & 2305) !== 0)) {
	            this.state = 381;
	            this.workflowStmt();
	            this.state = 386;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 387;
	        this.match(WorkflowDslParser.END);
	        this.state = 397;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===78) {
	            this.state = 388;
	            this.match(WorkflowDslParser.CATCH);
	            this.state = 389;
	            this.match(WorkflowDslParser.BEGIN);
	            this.state = 393;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===17 || ((((_la - 69)) & ~0x1f) === 0 && ((1 << (_la - 69)) & 2305) !== 0)) {
	                this.state = 390;
	                this.workflowStmt();
	                this.state = 395;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 396;
	            this.match(WorkflowDslParser.END);
	        }

	        this.state = 399;
	        this.match(WorkflowDslParser.ENDTRY);
	        this.state = 400;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	stepStmt() {
	    let localctx = new StepStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, WorkflowDslParser.RULE_stepStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 402;
	        this.match(WorkflowDslParser.STEP);
	        this.state = 403;
	        this.quotedString();
	        this.state = 404;
	        this.stepBody();
	        this.state = 405;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	stepBody() {
	    let localctx = new StepBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 58, WorkflowDslParser.RULE_stepBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 408; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 407;
	            this.stepToken();
	            this.state = 410; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while((((_la) & ~0x1f) === 0 && ((1 << _la) & 4294709250) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 4026728431) !== 0) || ((((_la - 64)) & ~0x1f) === 0 && ((1 << (_la - 64)) & 8454143) !== 0) || ((((_la - 100)) & ~0x1f) === 0 && ((1 << (_la - 100)) & 239) !== 0));
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



	stepToken() {
	    let localctx = new StepTokenContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, WorkflowDslParser.RULE_stepToken);
	    try {
	        this.state = 472;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 105:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 412;
	            this.quotedString();
	            break;
	        case 106:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 413;
	            this.match(WorkflowDslParser.NUMBER);
	            break;
	        case 107:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 414;
	            this.match(WorkflowDslParser.IDENT);
	            break;
	        case 101:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 415;
	            this.match(WorkflowDslParser.LPAREN);
	            break;
	        case 102:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 416;
	            this.match(WorkflowDslParser.RPAREN);
	            break;
	        case 103:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 417;
	            this.match(WorkflowDslParser.COMMA);
	            break;
	        case 100:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 418;
	            this.match(WorkflowDslParser.ASSIGN_EQ);
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 419;
	            this.match(WorkflowDslParser.CALL);
	            break;
	        case 87:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 420;
	            this.match(WorkflowDslParser.SERVICE);
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 421;
	            this.match(WorkflowDslParser.API);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 422;
	            this.match(WorkflowDslParser.ROUTE);
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 423;
	            this.match(WorkflowDslParser.QUEUE);
	            break;
	        case 20:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 424;
	            this.match(WorkflowDslParser.SET);
	            break;
	        case 21:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 425;
	            this.match(WorkflowDslParser.STATE);
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 426;
	            this.match(WorkflowDslParser.WAIT);
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 427;
	            this.match(WorkflowDslParser.CHECK);
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 428;
	            this.match(WorkflowDslParser.EXPECT);
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 429;
	            this.match(WorkflowDslParser.RETRIES);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 430;
	            this.match(WorkflowDslParser.EVERY);
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 431;
	            this.match(WorkflowDslParser.ISSUE);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 432;
	            this.match(WorkflowDslParser.CREATE);
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 433;
	            this.match(WorkflowDslParser.TITLE);
	            break;
	        case 30:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 434;
	            this.match(WorkflowDslParser.DESCRIPTION);
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 435;
	            this.match(WorkflowDslParser.PRIORITY);
	            break;
	        case 32:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 436;
	            this.match(WorkflowDslParser.ASSIGN);
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 437;
	            this.match(WorkflowDslParser.USER);
	            break;
	        case 34:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 438;
	            this.match(WorkflowDslParser.REPORTER);
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 439;
	            this.match(WorkflowDslParser.TYPE);
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 440;
	            this.match(WorkflowDslParser.INTO);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 441;
	            this.match(WorkflowDslParser.TESTCASE);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 442;
	            this.match(WorkflowDslParser.TESTPLAN);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 443;
	            this.match(WorkflowDslParser.PLAN);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 444;
	            this.match(WorkflowDslParser.LINK);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 445;
	            this.match(WorkflowDslParser.TO);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 446;
	            this.match(WorkflowDslParser.ADD);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 447;
	            this.match(WorkflowDslParser.PROJECT);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 448;
	            this.match(WorkflowDslParser.RELEASE);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 449;
	            this.match(WorkflowDslParser.FOR);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 450;
	            this.match(WorkflowDslParser.DEPLOYMENT);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 451;
	            this.match(WorkflowDslParser.ARTIFACT);
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 452;
	            this.match(WorkflowDslParser.LOCATION);
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 453;
	            this.match(WorkflowDslParser.PROJECTPLAN);
	            break;
	        case 62:
	            this.enterOuterAlt(localctx, 43);
	            this.state = 454;
	            this.match(WorkflowDslParser.MILESTONE);
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 44);
	            this.state = 455;
	            this.match(WorkflowDslParser.DUE);
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 45);
	            this.state = 456;
	            this.match(WorkflowDslParser.DATE);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 46);
	            this.state = 457;
	            this.match(WorkflowDslParser.TASK);
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 47);
	            this.state = 458;
	            this.match(WorkflowDslParser.SYNCHPOINT);
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 48);
	            this.state = 459;
	            this.match(WorkflowDslParser.DELIVERABLE);
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 49);
	            this.state = 460;
	            this.match(WorkflowDslParser.RESOURCE);
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 50);
	            this.state = 461;
	            this.match(WorkflowDslParser.COBEGIN);
	            break;
	        case 70:
	            this.enterOuterAlt(localctx, 51);
	            this.state = 462;
	            this.match(WorkflowDslParser.COEND);
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 52);
	            this.state = 463;
	            this.match(WorkflowDslParser.SUBFLOW);
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 53);
	            this.state = 464;
	            this.match(WorkflowDslParser.SYNC);
	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 54);
	            this.state = 465;
	            this.match(WorkflowDslParser.ASYNC);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 55);
	            this.state = 466;
	            this.match(WorkflowDslParser.ON);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 56);
	            this.state = 467;
	            this.match(WorkflowDslParser.ERROR);
	            break;
	        case 76:
	            this.enterOuterAlt(localctx, 57);
	            this.state = 468;
	            this.match(WorkflowDslParser.BACKOUT);
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 58);
	            this.state = 469;
	            this.match(WorkflowDslParser.TRY);
	            break;
	        case 78:
	            this.enterOuterAlt(localctx, 59);
	            this.state = 470;
	            this.match(WorkflowDslParser.CATCH);
	            break;
	        case 79:
	            this.enterOuterAlt(localctx, 60);
	            this.state = 471;
	            this.match(WorkflowDslParser.ENDTRY);
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



	ifStmt() {
	    let localctx = new IfStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, WorkflowDslParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 474;
	        this.match(WorkflowDslParser.IF);
	        this.state = 475;
	        this.match(WorkflowDslParser.FIELD);
	        this.state = 476;
	        this.quotedString();
	        this.state = 477;
	        _la = this._input.LA(1);
	        if(!(_la===82 || _la===83)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 478;
	        this.quotedString();
	        this.state = 479;
	        this.match(WorkflowDslParser.THEN);
	        this.state = 480;
	        this.branch();
	        this.state = 484;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===85) {
	            this.state = 481;
	            this.match(WorkflowDslParser.ELSE);
	            this.state = 482;
	            this.match(WorkflowDslParser.SEMICOLON);
	            this.state = 483;
	            this.branch();
	        }

	        this.state = 486;
	        this.match(WorkflowDslParser.ENDIF);
	        this.state = 487;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	branch() {
	    let localctx = new BranchContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, WorkflowDslParser.RULE_branch);
	    var _la = 0;
	    try {
	        this.state = 499;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 15:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 489;
	            this.match(WorkflowDslParser.BEGIN);
	            this.state = 493;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===17 || ((((_la - 69)) & ~0x1f) === 0 && ((1 << (_la - 69)) & 2305) !== 0)) {
	                this.state = 490;
	                this.workflowStmt();
	                this.state = 495;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 496;
	            this.match(WorkflowDslParser.END);
	            this.state = 497;
	            this.match(WorkflowDslParser.SEMICOLON);
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 498;
	            this.stepStmt();
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



	quotedList() {
	    let localctx = new QuotedListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, WorkflowDslParser.RULE_quotedList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 501;
	        this.match(WorkflowDslParser.LPAREN);
	        this.state = 502;
	        this.quotedString();
	        this.state = 507;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===103) {
	            this.state = 503;
	            this.match(WorkflowDslParser.COMMA);
	            this.state = 504;
	            this.quotedString();
	            this.state = 509;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 510;
	        this.match(WorkflowDslParser.RPAREN);
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



	quotedString() {
	    let localctx = new QuotedStringContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, WorkflowDslParser.RULE_quotedString);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 512;
	        this.match(WorkflowDslParser.STRING);
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

WorkflowDslParser.EOF = antlr4.Token.EOF;
WorkflowDslParser.QUEUE = 1;
WorkflowDslParser.DATABASE = 2;
WorkflowDslParser.MANAGER = 3;
WorkflowDslParser.CONNECTION = 4;
WorkflowDslParser.MODE = 5;
WorkflowDslParser.SYSTEM = 6;
WorkflowDslParser.OF = 7;
WorkflowDslParser.VISIBILITY = 8;
WorkflowDslParser.INTERNAL = 9;
WorkflowDslParser.EXPOSED = 10;
WorkflowDslParser.FILE = 11;
WorkflowDslParser.API = 12;
WorkflowDslParser.BASE = 13;
WorkflowDslParser.WORKFLOW = 14;
WorkflowDslParser.BEGIN = 15;
WorkflowDslParser.END = 16;
WorkflowDslParser.STEP = 17;
WorkflowDslParser.CALL = 18;
WorkflowDslParser.ROUTE = 19;
WorkflowDslParser.SET = 20;
WorkflowDslParser.STATE = 21;
WorkflowDslParser.WAIT = 22;
WorkflowDslParser.CHECK = 23;
WorkflowDslParser.EXPECT = 24;
WorkflowDslParser.RETRIES = 25;
WorkflowDslParser.EVERY = 26;
WorkflowDslParser.ISSUE = 27;
WorkflowDslParser.CREATE = 28;
WorkflowDslParser.TITLE = 29;
WorkflowDslParser.DESCRIPTION = 30;
WorkflowDslParser.PRIORITY = 31;
WorkflowDslParser.ASSIGN = 32;
WorkflowDslParser.USER = 33;
WorkflowDslParser.REPORTER = 34;
WorkflowDslParser.TYPE = 35;
WorkflowDslParser.TYPES = 36;
WorkflowDslParser.INTO = 37;
WorkflowDslParser.TESTCASE = 38;
WorkflowDslParser.TESTPLAN = 39;
WorkflowDslParser.PLAN = 40;
WorkflowDslParser.LINK = 41;
WorkflowDslParser.TO = 42;
WorkflowDslParser.ADD = 43;
WorkflowDslParser.PROJECT = 44;
WorkflowDslParser.RELEASE = 45;
WorkflowDslParser.FOR = 46;
WorkflowDslParser.DEPLOYMENT = 47;
WorkflowDslParser.DEPLOY = 48;
WorkflowDslParser.ARTIFACT = 49;
WorkflowDslParser.CLUSTER = 50;
WorkflowDslParser.NODES = 51;
WorkflowDslParser.LABEL = 52;
WorkflowDslParser.GENERIC_SYSTEM = 53;
WorkflowDslParser.PORT = 54;
WorkflowDslParser.INPUT = 55;
WorkflowDslParser.OUTPUT = 56;
WorkflowDslParser.CONNECT = 57;
WorkflowDslParser.FROM = 58;
WorkflowDslParser.REMOVE = 59;
WorkflowDslParser.LOCATION = 60;
WorkflowDslParser.PROJECTPLAN = 61;
WorkflowDslParser.MILESTONE = 62;
WorkflowDslParser.DUE = 63;
WorkflowDslParser.DATE = 64;
WorkflowDslParser.TASK = 65;
WorkflowDslParser.SYNCHPOINT = 66;
WorkflowDslParser.DELIVERABLE = 67;
WorkflowDslParser.RESOURCE = 68;
WorkflowDslParser.COBEGIN = 69;
WorkflowDslParser.COEND = 70;
WorkflowDslParser.SUBFLOW = 71;
WorkflowDslParser.SYNC = 72;
WorkflowDslParser.ASYNC = 73;
WorkflowDslParser.ON = 74;
WorkflowDslParser.ERROR = 75;
WorkflowDslParser.BACKOUT = 76;
WorkflowDslParser.TRY = 77;
WorkflowDslParser.CATCH = 78;
WorkflowDslParser.ENDTRY = 79;
WorkflowDslParser.IF = 80;
WorkflowDslParser.FIELD = 81;
WorkflowDslParser.EQUALS = 82;
WorkflowDslParser.CONTAINS = 83;
WorkflowDslParser.THEN = 84;
WorkflowDslParser.ELSE = 85;
WorkflowDslParser.ENDIF = 86;
WorkflowDslParser.SERVICE = 87;
WorkflowDslParser.PROGRAM = 88;
WorkflowDslParser.DAEMON = 89;
WorkflowDslParser.PERSISTENT = 90;
WorkflowDslParser.MIN_INSTANCES = 91;
WorkflowDslParser.MAX_INSTANCES = 92;
WorkflowDslParser.IDLE_TIMEOUT = 93;
WorkflowDslParser.TIME_UNIT = 94;
WorkflowDslParser.TARGETS = 95;
WorkflowDslParser.STARTUP = 96;
WorkflowDslParser.TRUE = 97;
WorkflowDslParser.FALSE = 98;
WorkflowDslParser.ARROW = 99;
WorkflowDslParser.ASSIGN_EQ = 100;
WorkflowDslParser.LPAREN = 101;
WorkflowDslParser.RPAREN = 102;
WorkflowDslParser.COMMA = 103;
WorkflowDslParser.SEMICOLON = 104;
WorkflowDslParser.STRING = 105;
WorkflowDslParser.NUMBER = 106;
WorkflowDslParser.IDENT = 107;
WorkflowDslParser.HASH_COMMENT = 108;
WorkflowDslParser.SLASH_COMMENT = 109;
WorkflowDslParser.DASH_COMMENT = 110;
WorkflowDslParser.WS = 111;

WorkflowDslParser.RULE_program = 0;
WorkflowDslParser.RULE_item = 1;
WorkflowDslParser.RULE_genericSystemDecl = 2;
WorkflowDslParser.RULE_genericSystemMember = 3;
WorkflowDslParser.RULE_genericSystemPortDecl = 4;
WorkflowDslParser.RULE_genericSystemConnectionDecl = 5;
WorkflowDslParser.RULE_clusterCreateDecl = 6;
WorkflowDslParser.RULE_artifactDeployDecl = 7;
WorkflowDslParser.RULE_deploymentDecl = 8;
WorkflowDslParser.RULE_deploymentItem = 9;
WorkflowDslParser.RULE_serviceLifecycleClause = 10;
WorkflowDslParser.RULE_booleanLiteral = 11;
WorkflowDslParser.RULE_queueDecl = 12;
WorkflowDslParser.RULE_databaseDecl = 13;
WorkflowDslParser.RULE_systemTypeDecl = 14;
WorkflowDslParser.RULE_systemDecl = 15;
WorkflowDslParser.RULE_systemMember = 16;
WorkflowDslParser.RULE_systemQueueDecl = 17;
WorkflowDslParser.RULE_serviceDecl = 18;
WorkflowDslParser.RULE_visibilityClause = 19;
WorkflowDslParser.RULE_fileDecl = 20;
WorkflowDslParser.RULE_apiDecl = 21;
WorkflowDslParser.RULE_workflowDecl = 22;
WorkflowDslParser.RULE_workflowStmt = 23;
WorkflowDslParser.RULE_cobeginStmt = 24;
WorkflowDslParser.RULE_cobeginMode = 25;
WorkflowDslParser.RULE_subflowDecl = 26;
WorkflowDslParser.RULE_tryStmt = 27;
WorkflowDslParser.RULE_stepStmt = 28;
WorkflowDslParser.RULE_stepBody = 29;
WorkflowDslParser.RULE_stepToken = 30;
WorkflowDslParser.RULE_ifStmt = 31;
WorkflowDslParser.RULE_branch = 32;
WorkflowDslParser.RULE_quotedList = 33;
WorkflowDslParser.RULE_quotedString = 34;

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
        this.ruleIndex = WorkflowDslParser.RULE_program;
    }

	EOF() {
	    return this.getToken(WorkflowDslParser.EOF, 0);
	};

	item = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ItemContext);
	    } else {
	        return this.getTypedRuleContext(ItemContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitProgram(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ItemContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_item;
    }

	queueDecl() {
	    return this.getTypedRuleContext(QueueDeclContext,0);
	};

	databaseDecl() {
	    return this.getTypedRuleContext(DatabaseDeclContext,0);
	};

	systemTypeDecl() {
	    return this.getTypedRuleContext(SystemTypeDeclContext,0);
	};

	systemDecl() {
	    return this.getTypedRuleContext(SystemDeclContext,0);
	};

	fileDecl() {
	    return this.getTypedRuleContext(FileDeclContext,0);
	};

	apiDecl() {
	    return this.getTypedRuleContext(ApiDeclContext,0);
	};

	workflowDecl() {
	    return this.getTypedRuleContext(WorkflowDeclContext,0);
	};

	deploymentDecl() {
	    return this.getTypedRuleContext(DeploymentDeclContext,0);
	};

	clusterCreateDecl() {
	    return this.getTypedRuleContext(ClusterCreateDeclContext,0);
	};

	artifactDeployDecl() {
	    return this.getTypedRuleContext(ArtifactDeployDeclContext,0);
	};

	genericSystemDecl() {
	    return this.getTypedRuleContext(GenericSystemDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class GenericSystemDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_genericSystemDecl;
    }

	GENERIC_SYSTEM() {
	    return this.getToken(WorkflowDslParser.GENERIC_SYSTEM, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	genericSystemMember = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(GenericSystemMemberContext);
	    } else {
	        return this.getTypedRuleContext(GenericSystemMemberContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitGenericSystemDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class GenericSystemMemberContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_genericSystemMember;
    }

	genericSystemDecl() {
	    return this.getTypedRuleContext(GenericSystemDeclContext,0);
	};

	genericSystemPortDecl() {
	    return this.getTypedRuleContext(GenericSystemPortDeclContext,0);
	};

	genericSystemConnectionDecl() {
	    return this.getTypedRuleContext(GenericSystemConnectionDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitGenericSystemMember(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class GenericSystemPortDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_genericSystemPortDecl;
    }

	PORT() {
	    return this.getToken(WorkflowDslParser.PORT, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	INPUT() {
	    return this.getToken(WorkflowDslParser.INPUT, 0);
	};

	OUTPUT() {
	    return this.getToken(WorkflowDslParser.OUTPUT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitGenericSystemPortDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class GenericSystemConnectionDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_genericSystemConnectionDecl;
    }

	CONNECT() {
	    return this.getToken(WorkflowDslParser.CONNECT, 0);
	};

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	FROM() {
	    return this.getToken(WorkflowDslParser.FROM, 0);
	};

	TO() {
	    return this.getToken(WorkflowDslParser.TO, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitGenericSystemConnectionDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClusterCreateDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_clusterCreateDecl;
    }

	CREATE() {
	    return this.getToken(WorkflowDslParser.CREATE, 0);
	};

	CLUSTER() {
	    return this.getToken(WorkflowDslParser.CLUSTER, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	NODES() {
	    return this.getToken(WorkflowDslParser.NODES, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	LABEL() {
	    return this.getToken(WorkflowDslParser.LABEL, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitClusterCreateDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArtifactDeployDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_artifactDeployDecl;
    }

	DEPLOY() {
	    return this.getToken(WorkflowDslParser.DEPLOY, 0);
	};

	ARTIFACT() {
	    return this.getToken(WorkflowDslParser.ARTIFACT, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	FILE() {
	    return this.getToken(WorkflowDslParser.FILE, 0);
	};

	TO() {
	    return this.getToken(WorkflowDslParser.TO, 0);
	};

	CLUSTER() {
	    return this.getToken(WorkflowDslParser.CLUSTER, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitArtifactDeployDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeploymentDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_deploymentDecl;
    }

	DEPLOYMENT() {
	    return this.getToken(WorkflowDslParser.DEPLOYMENT, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	PROJECT() {
	    return this.getToken(WorkflowDslParser.PROJECT, 0);
	};

	TARGETS() {
	    return this.getToken(WorkflowDslParser.TARGETS, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	deploymentItem = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeploymentItemContext);
	    } else {
	        return this.getTypedRuleContext(DeploymentItemContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitDeploymentDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeploymentItemContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_deploymentItem;
    }

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	FILE() {
	    return this.getToken(WorkflowDslParser.FILE, 0);
	};

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	TARGETS() {
	    return this.getToken(WorkflowDslParser.TARGETS, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	STARTUP() {
	    return this.getToken(WorkflowDslParser.STARTUP, 0);
	};

	booleanLiteral() {
	    return this.getTypedRuleContext(BooleanLiteralContext,0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	SERVICE() {
	    return this.getToken(WorkflowDslParser.SERVICE, 0);
	};

	PROGRAM() {
	    return this.getToken(WorkflowDslParser.PROGRAM, 0);
	};

	DAEMON() {
	    return this.getToken(WorkflowDslParser.DAEMON, 0);
	};

	serviceLifecycleClause() {
	    return this.getTypedRuleContext(ServiceLifecycleClauseContext,0);
	};

	REMOVE() {
	    return this.getToken(WorkflowDslParser.REMOVE, 0);
	};

	FROM() {
	    return this.getToken(WorkflowDslParser.FROM, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitDeploymentItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceLifecycleClauseContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_serviceLifecycleClause;
    }

	PERSISTENT() {
	    return this.getToken(WorkflowDslParser.PERSISTENT, 0);
	};

	booleanLiteral() {
	    return this.getTypedRuleContext(BooleanLiteralContext,0);
	};

	MIN_INSTANCES() {
	    return this.getToken(WorkflowDslParser.MIN_INSTANCES, 0);
	};

	NUMBER = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.NUMBER);
	    } else {
	        return this.getToken(WorkflowDslParser.NUMBER, i);
	    }
	};


	MAX_INSTANCES() {
	    return this.getToken(WorkflowDslParser.MAX_INSTANCES, 0);
	};

	IDLE_TIMEOUT() {
	    return this.getToken(WorkflowDslParser.IDLE_TIMEOUT, 0);
	};

	TIME_UNIT() {
	    return this.getToken(WorkflowDslParser.TIME_UNIT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitServiceLifecycleClause(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BooleanLiteralContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_booleanLiteral;
    }

	TRUE() {
	    return this.getToken(WorkflowDslParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(WorkflowDslParser.FALSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitBooleanLiteral(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QueueDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_queueDecl;
    }

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	MANAGER() {
	    return this.getToken(WorkflowDslParser.MANAGER, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	TYPES() {
	    return this.getToken(WorkflowDslParser.TYPES, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	MODE() {
	    return this.getToken(WorkflowDslParser.MODE, 0);
	};

	SYNC() {
	    return this.getToken(WorkflowDslParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(WorkflowDslParser.ASYNC, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQueueDecl(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_databaseDecl;
    }

	DATABASE() {
	    return this.getToken(WorkflowDslParser.DATABASE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	MANAGER() {
	    return this.getToken(WorkflowDslParser.MANAGER, 0);
	};

	CONNECTION() {
	    return this.getToken(WorkflowDslParser.CONNECTION, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitDatabaseDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SystemTypeDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_systemTypeDecl;
    }

	SYSTEM() {
	    return this.getToken(WorkflowDslParser.SYSTEM, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
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

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitSystemTypeDecl(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_systemDecl;
    }

	SYSTEM() {
	    return this.getToken(WorkflowDslParser.SYSTEM, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	OF() {
	    return this.getToken(WorkflowDslParser.OF, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	visibilityClause() {
	    return this.getTypedRuleContext(VisibilityClauseContext,0);
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

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitSystemDecl(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_systemMember;
    }

	systemQueueDecl() {
	    return this.getTypedRuleContext(SystemQueueDeclContext,0);
	};

	serviceDecl() {
	    return this.getTypedRuleContext(ServiceDeclContext,0);
	};

	systemDecl() {
	    return this.getTypedRuleContext(SystemDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
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
        this.ruleIndex = WorkflowDslParser.RULE_systemQueueDecl;
    }

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	MANAGER() {
	    return this.getToken(WorkflowDslParser.MANAGER, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	TYPES() {
	    return this.getToken(WorkflowDslParser.TYPES, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	visibilityClause() {
	    return this.getTypedRuleContext(VisibilityClauseContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitSystemQueueDecl(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_serviceDecl;
    }

	SERVICE() {
	    return this.getToken(WorkflowDslParser.SERVICE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	visibilityClause() {
	    return this.getTypedRuleContext(VisibilityClauseContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitServiceDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VisibilityClauseContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_visibilityClause;
    }

	VISIBILITY() {
	    return this.getToken(WorkflowDslParser.VISIBILITY, 0);
	};

	INTERNAL() {
	    return this.getToken(WorkflowDslParser.INTERNAL, 0);
	};

	EXPOSED() {
	    return this.getToken(WorkflowDslParser.EXPOSED, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitVisibilityClause(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FileDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_fileDecl;
    }

	FILE() {
	    return this.getToken(WorkflowDslParser.FILE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	MANAGER() {
	    return this.getToken(WorkflowDslParser.MANAGER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitFileDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ApiDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_apiDecl;
    }

	API() {
	    return this.getToken(WorkflowDslParser.API, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	BASE() {
	    return this.getToken(WorkflowDslParser.BASE, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitApiDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WorkflowDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_workflowDecl;
    }

	WORKFLOW() {
	    return this.getToken(WorkflowDslParser.WORKFLOW, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitWorkflowDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WorkflowStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_workflowStmt;
    }

	stepStmt() {
	    return this.getTypedRuleContext(StepStmtContext,0);
	};

	ifStmt() {
	    return this.getTypedRuleContext(IfStmtContext,0);
	};

	cobeginStmt() {
	    return this.getTypedRuleContext(CobeginStmtContext,0);
	};

	tryStmt() {
	    return this.getTypedRuleContext(TryStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitWorkflowStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CobeginStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_cobeginStmt;
    }

	COBEGIN() {
	    return this.getToken(WorkflowDslParser.COBEGIN, 0);
	};

	cobeginMode() {
	    return this.getTypedRuleContext(CobeginModeContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	COEND() {
	    return this.getToken(WorkflowDslParser.COEND, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	ON() {
	    return this.getToken(WorkflowDslParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(WorkflowDslParser.ERROR, 0);
	};

	BACKOUT() {
	    return this.getToken(WorkflowDslParser.BACKOUT, 0);
	};

	subflowDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SubflowDeclContext);
	    } else {
	        return this.getTypedRuleContext(SubflowDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitCobeginStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CobeginModeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_cobeginMode;
    }

	SYNC() {
	    return this.getToken(WorkflowDslParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(WorkflowDslParser.ASYNC, 0);
	};

	WAIT() {
	    return this.getToken(WorkflowDslParser.WAIT, 0);
	};

	NUMBER() {
	    return this.getToken(WorkflowDslParser.NUMBER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitCobeginMode(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SubflowDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_subflowDecl;
    }

	SUBFLOW() {
	    return this.getToken(WorkflowDslParser.SUBFLOW, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitSubflowDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TryStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_tryStmt;
    }

	TRY() {
	    return this.getToken(WorkflowDslParser.TRY, 0);
	};

	BEGIN = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.BEGIN);
	    } else {
	        return this.getToken(WorkflowDslParser.BEGIN, i);
	    }
	};


	END = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.END);
	    } else {
	        return this.getToken(WorkflowDslParser.END, i);
	    }
	};


	ENDTRY() {
	    return this.getToken(WorkflowDslParser.ENDTRY, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	CATCH() {
	    return this.getToken(WorkflowDslParser.CATCH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitTryStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepStmt;
    }

	STEP() {
	    return this.getToken(WorkflowDslParser.STEP, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	stepBody() {
	    return this.getTypedRuleContext(StepBodyContext,0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepBody;
    }

	stepToken = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StepTokenContext);
	    } else {
	        return this.getTypedRuleContext(StepTokenContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepTokenContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepToken;
    }

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	NUMBER() {
	    return this.getToken(WorkflowDslParser.NUMBER, 0);
	};

	IDENT() {
	    return this.getToken(WorkflowDslParser.IDENT, 0);
	};

	LPAREN() {
	    return this.getToken(WorkflowDslParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(WorkflowDslParser.RPAREN, 0);
	};

	COMMA() {
	    return this.getToken(WorkflowDslParser.COMMA, 0);
	};

	ASSIGN_EQ() {
	    return this.getToken(WorkflowDslParser.ASSIGN_EQ, 0);
	};

	CALL() {
	    return this.getToken(WorkflowDslParser.CALL, 0);
	};

	SERVICE() {
	    return this.getToken(WorkflowDslParser.SERVICE, 0);
	};

	API() {
	    return this.getToken(WorkflowDslParser.API, 0);
	};

	ROUTE() {
	    return this.getToken(WorkflowDslParser.ROUTE, 0);
	};

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	SET() {
	    return this.getToken(WorkflowDslParser.SET, 0);
	};

	STATE() {
	    return this.getToken(WorkflowDslParser.STATE, 0);
	};

	WAIT() {
	    return this.getToken(WorkflowDslParser.WAIT, 0);
	};

	CHECK() {
	    return this.getToken(WorkflowDslParser.CHECK, 0);
	};

	EXPECT() {
	    return this.getToken(WorkflowDslParser.EXPECT, 0);
	};

	RETRIES() {
	    return this.getToken(WorkflowDslParser.RETRIES, 0);
	};

	EVERY() {
	    return this.getToken(WorkflowDslParser.EVERY, 0);
	};

	ISSUE() {
	    return this.getToken(WorkflowDslParser.ISSUE, 0);
	};

	CREATE() {
	    return this.getToken(WorkflowDslParser.CREATE, 0);
	};

	TITLE() {
	    return this.getToken(WorkflowDslParser.TITLE, 0);
	};

	DESCRIPTION() {
	    return this.getToken(WorkflowDslParser.DESCRIPTION, 0);
	};

	PRIORITY() {
	    return this.getToken(WorkflowDslParser.PRIORITY, 0);
	};

	ASSIGN() {
	    return this.getToken(WorkflowDslParser.ASSIGN, 0);
	};

	USER() {
	    return this.getToken(WorkflowDslParser.USER, 0);
	};

	REPORTER() {
	    return this.getToken(WorkflowDslParser.REPORTER, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	INTO() {
	    return this.getToken(WorkflowDslParser.INTO, 0);
	};

	TESTCASE() {
	    return this.getToken(WorkflowDslParser.TESTCASE, 0);
	};

	TESTPLAN() {
	    return this.getToken(WorkflowDslParser.TESTPLAN, 0);
	};

	PLAN() {
	    return this.getToken(WorkflowDslParser.PLAN, 0);
	};

	LINK() {
	    return this.getToken(WorkflowDslParser.LINK, 0);
	};

	TO() {
	    return this.getToken(WorkflowDslParser.TO, 0);
	};

	ADD() {
	    return this.getToken(WorkflowDslParser.ADD, 0);
	};

	PROJECT() {
	    return this.getToken(WorkflowDslParser.PROJECT, 0);
	};

	RELEASE() {
	    return this.getToken(WorkflowDslParser.RELEASE, 0);
	};

	FOR() {
	    return this.getToken(WorkflowDslParser.FOR, 0);
	};

	DEPLOYMENT() {
	    return this.getToken(WorkflowDslParser.DEPLOYMENT, 0);
	};

	ARTIFACT() {
	    return this.getToken(WorkflowDslParser.ARTIFACT, 0);
	};

	LOCATION() {
	    return this.getToken(WorkflowDslParser.LOCATION, 0);
	};

	PROJECTPLAN() {
	    return this.getToken(WorkflowDslParser.PROJECTPLAN, 0);
	};

	MILESTONE() {
	    return this.getToken(WorkflowDslParser.MILESTONE, 0);
	};

	DUE() {
	    return this.getToken(WorkflowDslParser.DUE, 0);
	};

	DATE() {
	    return this.getToken(WorkflowDslParser.DATE, 0);
	};

	TASK() {
	    return this.getToken(WorkflowDslParser.TASK, 0);
	};

	SYNCHPOINT() {
	    return this.getToken(WorkflowDslParser.SYNCHPOINT, 0);
	};

	DELIVERABLE() {
	    return this.getToken(WorkflowDslParser.DELIVERABLE, 0);
	};

	RESOURCE() {
	    return this.getToken(WorkflowDslParser.RESOURCE, 0);
	};

	COBEGIN() {
	    return this.getToken(WorkflowDslParser.COBEGIN, 0);
	};

	COEND() {
	    return this.getToken(WorkflowDslParser.COEND, 0);
	};

	SUBFLOW() {
	    return this.getToken(WorkflowDslParser.SUBFLOW, 0);
	};

	SYNC() {
	    return this.getToken(WorkflowDslParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(WorkflowDslParser.ASYNC, 0);
	};

	ON() {
	    return this.getToken(WorkflowDslParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(WorkflowDslParser.ERROR, 0);
	};

	BACKOUT() {
	    return this.getToken(WorkflowDslParser.BACKOUT, 0);
	};

	TRY() {
	    return this.getToken(WorkflowDslParser.TRY, 0);
	};

	CATCH() {
	    return this.getToken(WorkflowDslParser.CATCH, 0);
	};

	ENDTRY() {
	    return this.getToken(WorkflowDslParser.ENDTRY, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepToken(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IfStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_ifStmt;
    }

	IF() {
	    return this.getToken(WorkflowDslParser.IF, 0);
	};

	FIELD() {
	    return this.getToken(WorkflowDslParser.FIELD, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	THEN() {
	    return this.getToken(WorkflowDslParser.THEN, 0);
	};

	branch = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BranchContext);
	    } else {
	        return this.getTypedRuleContext(BranchContext,i);
	    }
	};

	ENDIF() {
	    return this.getToken(WorkflowDslParser.ENDIF, 0);
	};

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.SEMICOLON);
	    } else {
	        return this.getToken(WorkflowDslParser.SEMICOLON, i);
	    }
	};


	EQUALS() {
	    return this.getToken(WorkflowDslParser.EQUALS, 0);
	};

	CONTAINS() {
	    return this.getToken(WorkflowDslParser.CONTAINS, 0);
	};

	ELSE() {
	    return this.getToken(WorkflowDslParser.ELSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitIfStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BranchContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_branch;
    }

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	stepStmt() {
	    return this.getTypedRuleContext(StepStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitBranch(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QuotedListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_quotedList;
    }

	LPAREN() {
	    return this.getToken(WorkflowDslParser.LPAREN, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	RPAREN() {
	    return this.getToken(WorkflowDslParser.RPAREN, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.COMMA);
	    } else {
	        return this.getToken(WorkflowDslParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQuotedList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QuotedStringContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_quotedString;
    }

	STRING() {
	    return this.getToken(WorkflowDslParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQuotedString(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




WorkflowDslParser.ProgramContext = ProgramContext; 
WorkflowDslParser.ItemContext = ItemContext; 
WorkflowDslParser.GenericSystemDeclContext = GenericSystemDeclContext; 
WorkflowDslParser.GenericSystemMemberContext = GenericSystemMemberContext; 
WorkflowDslParser.GenericSystemPortDeclContext = GenericSystemPortDeclContext; 
WorkflowDslParser.GenericSystemConnectionDeclContext = GenericSystemConnectionDeclContext; 
WorkflowDslParser.ClusterCreateDeclContext = ClusterCreateDeclContext; 
WorkflowDslParser.ArtifactDeployDeclContext = ArtifactDeployDeclContext; 
WorkflowDslParser.DeploymentDeclContext = DeploymentDeclContext; 
WorkflowDslParser.DeploymentItemContext = DeploymentItemContext; 
WorkflowDslParser.ServiceLifecycleClauseContext = ServiceLifecycleClauseContext; 
WorkflowDslParser.BooleanLiteralContext = BooleanLiteralContext; 
WorkflowDslParser.QueueDeclContext = QueueDeclContext; 
WorkflowDslParser.DatabaseDeclContext = DatabaseDeclContext; 
WorkflowDslParser.SystemTypeDeclContext = SystemTypeDeclContext; 
WorkflowDslParser.SystemDeclContext = SystemDeclContext; 
WorkflowDslParser.SystemMemberContext = SystemMemberContext; 
WorkflowDslParser.SystemQueueDeclContext = SystemQueueDeclContext; 
WorkflowDslParser.ServiceDeclContext = ServiceDeclContext; 
WorkflowDslParser.VisibilityClauseContext = VisibilityClauseContext; 
WorkflowDslParser.FileDeclContext = FileDeclContext; 
WorkflowDslParser.ApiDeclContext = ApiDeclContext; 
WorkflowDslParser.WorkflowDeclContext = WorkflowDeclContext; 
WorkflowDslParser.WorkflowStmtContext = WorkflowStmtContext; 
WorkflowDslParser.CobeginStmtContext = CobeginStmtContext; 
WorkflowDslParser.CobeginModeContext = CobeginModeContext; 
WorkflowDslParser.SubflowDeclContext = SubflowDeclContext; 
WorkflowDslParser.TryStmtContext = TryStmtContext; 
WorkflowDslParser.StepStmtContext = StepStmtContext; 
WorkflowDslParser.StepBodyContext = StepBodyContext; 
WorkflowDslParser.StepTokenContext = StepTokenContext; 
WorkflowDslParser.IfStmtContext = IfStmtContext; 
WorkflowDslParser.BranchContext = BranchContext; 
WorkflowDslParser.QuotedListContext = QuotedListContext; 
WorkflowDslParser.QuotedStringContext = QuotedStringContext; 
