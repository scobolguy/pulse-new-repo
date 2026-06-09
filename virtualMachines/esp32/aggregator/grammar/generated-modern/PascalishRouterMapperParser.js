// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/PascalishRouterMapper.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishRouterMapperVisitor from './PascalishRouterMapperVisitor.js';

const serializedATN = [4,1,94,472,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,1,0,5,0,88,8,0,10,0,12,0,91,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,
1,1,1,1,1,1,1,1,1,3,1,105,8,1,1,2,1,2,1,2,1,2,1,3,1,3,1,4,1,4,3,4,115,8,
4,1,5,1,5,5,5,119,8,5,10,5,12,5,122,9,5,1,5,1,5,3,5,126,8,5,1,6,1,6,1,6,
1,6,1,6,3,6,133,8,6,1,6,1,6,1,7,1,7,1,7,1,7,3,7,141,8,7,1,8,1,8,1,8,1,8,
1,8,3,8,148,8,8,1,9,1,9,5,9,152,8,9,10,9,12,9,155,9,9,1,9,1,9,1,10,1,10,
1,10,1,10,3,10,163,8,10,1,11,1,11,1,11,1,11,4,11,169,8,11,11,11,12,11,170,
1,11,1,11,1,11,1,11,3,11,177,8,11,1,11,1,11,3,11,181,8,11,1,12,1,12,1,12,
1,12,1,12,1,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,3,14,196,8,14,1,15,1,15,
1,15,5,15,201,8,15,10,15,12,15,204,9,15,1,16,1,16,1,16,1,16,1,17,1,17,1,
17,3,17,213,8,17,1,17,1,17,1,18,1,18,1,18,3,18,220,8,18,1,19,1,19,1,20,1,
20,1,20,1,20,1,20,1,20,1,21,1,21,3,21,232,8,21,1,22,1,22,1,22,1,22,3,22,
238,8,22,1,22,1,22,1,23,1,23,1,23,1,23,1,23,3,23,247,8,23,1,23,1,23,1,24,
1,24,1,25,1,25,1,25,1,25,1,25,5,25,258,8,25,10,25,12,25,261,9,25,1,25,1,
25,5,25,265,8,25,10,25,12,25,268,9,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,
1,26,1,26,1,26,1,26,3,26,281,8,26,1,27,1,27,1,27,1,27,1,27,5,27,288,8,27,
10,27,12,27,291,9,27,1,27,1,27,3,27,295,8,27,1,28,1,28,1,28,3,28,300,8,28,
1,28,1,28,1,28,1,28,1,28,1,28,1,29,1,29,1,29,1,29,3,29,312,8,29,1,30,1,30,
1,30,1,30,1,30,1,30,1,30,5,30,321,8,30,10,30,12,30,324,9,30,1,30,1,30,5,
30,328,8,30,10,30,12,30,331,9,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,3,31,
340,8,31,1,32,1,32,1,32,1,32,1,32,1,32,3,32,348,8,32,1,32,1,32,1,33,1,33,
1,33,1,33,1,33,5,33,357,8,33,10,33,12,33,360,9,33,1,33,1,33,3,33,364,8,33,
1,34,1,34,1,34,1,34,1,34,5,34,371,8,34,10,34,12,34,374,9,34,1,34,1,34,3,
34,378,8,34,1,35,1,35,3,35,382,8,35,1,36,1,36,1,36,1,36,5,36,388,8,36,10,
36,12,36,391,9,36,1,36,1,36,1,37,1,37,3,37,397,8,37,1,38,1,38,1,39,1,39,
1,40,1,40,3,40,405,8,40,1,41,1,41,5,41,409,8,41,10,41,12,41,412,9,41,1,41,
1,41,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,
42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,
1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,
42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,42,3,42,470,8,42,
1,42,0,0,43,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,
44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,0,5,2,0,17,
17,89,89,1,0,81,82,1,0,9,11,1,0,18,21,1,0,39,40,534,0,89,1,0,0,0,2,104,1,
0,0,0,4,106,1,0,0,0,6,110,1,0,0,0,8,114,1,0,0,0,10,116,1,0,0,0,12,127,1,
0,0,0,14,140,1,0,0,0,16,142,1,0,0,0,18,149,1,0,0,0,20,162,1,0,0,0,22,164,
1,0,0,0,24,182,1,0,0,0,26,187,1,0,0,0,28,195,1,0,0,0,30,197,1,0,0,0,32,205,
1,0,0,0,34,209,1,0,0,0,36,216,1,0,0,0,38,221,1,0,0,0,40,223,1,0,0,0,42,231,
1,0,0,0,44,233,1,0,0,0,46,241,1,0,0,0,48,250,1,0,0,0,50,252,1,0,0,0,52,280,
1,0,0,0,54,294,1,0,0,0,56,296,1,0,0,0,58,311,1,0,0,0,60,313,1,0,0,0,62,339,
1,0,0,0,64,341,1,0,0,0,66,363,1,0,0,0,68,377,1,0,0,0,70,379,1,0,0,0,72,383,
1,0,0,0,74,396,1,0,0,0,76,398,1,0,0,0,78,400,1,0,0,0,80,404,1,0,0,0,82,406,
1,0,0,0,84,469,1,0,0,0,86,88,3,2,1,0,87,86,1,0,0,0,88,91,1,0,0,0,89,87,1,
0,0,0,89,90,1,0,0,0,90,92,1,0,0,0,91,89,1,0,0,0,92,93,5,0,0,1,93,1,1,0,0,
0,94,105,3,16,8,0,95,105,3,8,4,0,96,105,3,4,2,0,97,105,3,12,6,0,98,105,3,
40,20,0,99,105,3,44,22,0,100,105,3,46,23,0,101,105,3,50,25,0,102,105,3,60,
30,0,103,105,3,10,5,0,104,94,1,0,0,0,104,95,1,0,0,0,104,96,1,0,0,0,104,97,
1,0,0,0,104,98,1,0,0,0,104,99,1,0,0,0,104,100,1,0,0,0,104,101,1,0,0,0,104,
102,1,0,0,0,104,103,1,0,0,0,105,3,1,0,0,0,106,107,5,16,0,0,107,108,3,6,3,
0,108,109,5,81,0,0,109,5,1,0,0,0,110,111,7,0,0,0,111,7,1,0,0,0,112,115,3,
32,16,0,113,115,3,34,17,0,114,112,1,0,0,0,114,113,1,0,0,0,115,9,1,0,0,0,
116,120,5,29,0,0,117,119,3,84,42,0,118,117,1,0,0,0,119,122,1,0,0,0,120,118,
1,0,0,0,120,121,1,0,0,0,121,123,1,0,0,0,122,120,1,0,0,0,123,125,5,30,0,0,
124,126,7,1,0,0,125,124,1,0,0,0,125,126,1,0,0,0,126,11,1,0,0,0,127,128,5,
68,0,0,128,129,5,89,0,0,129,130,5,84,0,0,130,132,3,70,35,0,131,133,3,14,
7,0,132,131,1,0,0,0,132,133,1,0,0,0,133,134,1,0,0,0,134,135,5,81,0,0,135,
13,1,0,0,0,136,137,5,69,0,0,137,141,5,70,0,0,138,139,5,69,0,0,139,141,3,
74,37,0,140,136,1,0,0,0,140,138,1,0,0,0,141,15,1,0,0,0,142,143,5,1,0,0,143,
144,3,74,37,0,144,145,5,81,0,0,145,147,3,18,9,0,146,148,7,1,0,0,147,146,
1,0,0,0,147,148,1,0,0,0,148,17,1,0,0,0,149,153,5,29,0,0,150,152,3,20,10,
0,151,150,1,0,0,0,152,155,1,0,0,0,153,151,1,0,0,0,153,154,1,0,0,0,154,156,
1,0,0,0,155,153,1,0,0,0,156,157,5,30,0,0,157,19,1,0,0,0,158,163,3,22,11,
0,159,160,3,26,13,0,160,161,5,81,0,0,161,163,1,0,0,0,162,158,1,0,0,0,162,
159,1,0,0,0,163,21,1,0,0,0,164,165,5,2,0,0,165,166,3,28,14,0,166,168,5,3,
0,0,167,169,3,24,12,0,168,167,1,0,0,0,169,170,1,0,0,0,170,168,1,0,0,0,170,
171,1,0,0,0,171,176,1,0,0,0,172,173,5,43,0,0,173,174,3,26,13,0,174,175,5,
81,0,0,175,177,1,0,0,0,176,172,1,0,0,0,176,177,1,0,0,0,177,178,1,0,0,0,178,
180,5,30,0,0,179,181,5,81,0,0,180,179,1,0,0,0,180,181,1,0,0,0,181,23,1,0,
0,0,182,183,3,28,14,0,183,184,5,84,0,0,184,185,3,26,13,0,185,186,5,81,0,
0,186,25,1,0,0,0,187,188,5,4,0,0,188,189,3,28,14,0,189,27,1,0,0,0,190,196,
3,30,15,0,191,196,3,76,38,0,192,196,5,90,0,0,193,196,5,39,0,0,194,196,5,
40,0,0,195,190,1,0,0,0,195,191,1,0,0,0,195,192,1,0,0,0,195,193,1,0,0,0,195,
194,1,0,0,0,196,29,1,0,0,0,197,202,5,89,0,0,198,199,5,82,0,0,199,201,5,89,
0,0,200,198,1,0,0,0,201,204,1,0,0,0,202,200,1,0,0,0,202,203,1,0,0,0,203,
31,1,0,0,0,204,202,1,0,0,0,205,206,5,6,0,0,206,207,3,74,37,0,207,208,5,81,
0,0,208,33,1,0,0,0,209,210,5,7,0,0,210,212,3,74,37,0,211,213,3,36,18,0,212,
211,1,0,0,0,212,213,1,0,0,0,213,214,1,0,0,0,214,215,5,81,0,0,215,35,1,0,
0,0,216,217,5,8,0,0,217,219,5,90,0,0,218,220,3,38,19,0,219,218,1,0,0,0,219,
220,1,0,0,0,220,37,1,0,0,0,221,222,7,2,0,0,222,39,1,0,0,0,223,224,5,12,0,
0,224,225,3,74,37,0,225,226,5,69,0,0,226,227,3,42,21,0,227,228,5,81,0,0,
228,41,1,0,0,0,229,232,5,70,0,0,230,232,3,74,37,0,231,229,1,0,0,0,231,230,
1,0,0,0,232,43,1,0,0,0,233,234,5,13,0,0,234,237,3,74,37,0,235,236,5,14,0,
0,236,238,5,89,0,0,237,235,1,0,0,0,237,238,1,0,0,0,238,239,1,0,0,0,239,240,
5,81,0,0,240,45,1,0,0,0,241,242,5,15,0,0,242,243,3,48,24,0,243,246,3,74,
37,0,244,245,5,14,0,0,245,247,5,89,0,0,246,244,1,0,0,0,246,247,1,0,0,0,247,
248,1,0,0,0,248,249,5,81,0,0,249,47,1,0,0,0,250,251,7,3,0,0,251,49,1,0,0,
0,252,253,5,22,0,0,253,254,3,74,37,0,254,255,5,24,0,0,255,259,3,76,38,0,
256,258,3,52,26,0,257,256,1,0,0,0,258,261,1,0,0,0,259,257,1,0,0,0,259,260,
1,0,0,0,260,262,1,0,0,0,261,259,1,0,0,0,262,266,5,29,0,0,263,265,3,56,28,
0,264,263,1,0,0,0,265,268,1,0,0,0,266,264,1,0,0,0,266,267,1,0,0,0,267,269,
1,0,0,0,268,266,1,0,0,0,269,270,5,30,0,0,270,271,5,81,0,0,271,51,1,0,0,0,
272,273,5,27,0,0,273,281,3,76,38,0,274,275,5,28,0,0,275,281,3,78,39,0,276,
277,5,1,0,0,277,281,3,76,38,0,278,279,5,5,0,0,279,281,3,54,27,0,280,272,
1,0,0,0,280,274,1,0,0,0,280,276,1,0,0,0,280,278,1,0,0,0,281,53,1,0,0,0,282,
295,3,74,37,0,283,284,5,71,0,0,284,289,3,74,37,0,285,286,5,80,0,0,286,288,
3,74,37,0,287,285,1,0,0,0,288,291,1,0,0,0,289,287,1,0,0,0,289,290,1,0,0,
0,290,292,1,0,0,0,291,289,1,0,0,0,292,293,5,72,0,0,293,295,1,0,0,0,294,282,
1,0,0,0,294,283,1,0,0,0,295,55,1,0,0,0,296,297,5,31,0,0,297,299,3,76,38,
0,298,300,3,58,29,0,299,298,1,0,0,0,299,300,1,0,0,0,300,301,1,0,0,0,301,
302,5,34,0,0,302,303,3,80,40,0,303,304,5,35,0,0,304,305,3,80,40,0,305,306,
5,81,0,0,306,57,1,0,0,0,307,308,5,32,0,0,308,312,3,70,35,0,309,310,5,33,
0,0,310,312,3,68,34,0,311,307,1,0,0,0,311,309,1,0,0,0,312,59,1,0,0,0,313,
314,5,23,0,0,314,315,3,74,37,0,315,316,5,25,0,0,316,317,3,70,35,0,317,318,
5,26,0,0,318,322,3,70,35,0,319,321,3,62,31,0,320,319,1,0,0,0,321,324,1,0,
0,0,322,320,1,0,0,0,322,323,1,0,0,0,323,325,1,0,0,0,324,322,1,0,0,0,325,
329,5,29,0,0,326,328,3,64,32,0,327,326,1,0,0,0,328,331,1,0,0,0,329,327,1,
0,0,0,329,330,1,0,0,0,330,332,1,0,0,0,331,329,1,0,0,0,332,333,5,30,0,0,333,
334,5,81,0,0,334,61,1,0,0,0,335,336,5,27,0,0,336,340,3,76,38,0,337,338,5,
28,0,0,338,340,3,78,39,0,339,335,1,0,0,0,339,337,1,0,0,0,340,63,1,0,0,0,
341,342,5,36,0,0,342,343,3,76,38,0,343,344,5,37,0,0,344,347,3,76,38,0,345,
346,5,38,0,0,346,348,3,80,40,0,347,345,1,0,0,0,347,348,1,0,0,0,348,349,1,
0,0,0,349,350,5,81,0,0,350,65,1,0,0,0,351,364,3,76,38,0,352,353,5,71,0,0,
353,358,3,76,38,0,354,355,5,80,0,0,355,357,3,76,38,0,356,354,1,0,0,0,357,
360,1,0,0,0,358,356,1,0,0,0,358,359,1,0,0,0,359,361,1,0,0,0,360,358,1,0,
0,0,361,362,5,72,0,0,362,364,1,0,0,0,363,351,1,0,0,0,363,352,1,0,0,0,364,
67,1,0,0,0,365,378,3,70,35,0,366,367,5,71,0,0,367,372,3,70,35,0,368,369,
5,80,0,0,369,371,3,70,35,0,370,368,1,0,0,0,371,374,1,0,0,0,372,370,1,0,0,
0,372,373,1,0,0,0,373,375,1,0,0,0,374,372,1,0,0,0,375,376,5,72,0,0,376,378,
1,0,0,0,377,365,1,0,0,0,377,366,1,0,0,0,378,69,1,0,0,0,379,381,3,74,37,0,
380,382,3,72,36,0,381,380,1,0,0,0,381,382,1,0,0,0,382,71,1,0,0,0,383,384,
5,78,0,0,384,389,3,70,35,0,385,386,5,80,0,0,386,388,3,70,35,0,387,385,1,
0,0,0,388,391,1,0,0,0,389,387,1,0,0,0,389,390,1,0,0,0,390,392,1,0,0,0,391,
389,1,0,0,0,392,393,5,79,0,0,393,73,1,0,0,0,394,397,3,76,38,0,395,397,5,
89,0,0,396,394,1,0,0,0,396,395,1,0,0,0,397,75,1,0,0,0,398,399,5,91,0,0,399,
77,1,0,0,0,400,401,7,4,0,0,401,79,1,0,0,0,402,405,5,91,0,0,403,405,3,82,
41,0,404,402,1,0,0,0,404,403,1,0,0,0,405,81,1,0,0,0,406,410,5,29,0,0,407,
409,3,84,42,0,408,407,1,0,0,0,409,412,1,0,0,0,410,408,1,0,0,0,410,411,1,
0,0,0,411,413,1,0,0,0,412,410,1,0,0,0,413,414,5,30,0,0,414,83,1,0,0,0,415,
470,3,82,41,0,416,470,5,71,0,0,417,470,5,72,0,0,418,470,5,73,0,0,419,470,
5,74,0,0,420,470,5,75,0,0,421,470,5,76,0,0,422,470,5,77,0,0,423,470,5,78,
0,0,424,470,5,79,0,0,425,470,5,86,0,0,426,470,5,87,0,0,427,470,5,88,0,0,
428,470,5,80,0,0,429,470,5,81,0,0,430,470,5,82,0,0,431,470,5,83,0,0,432,
470,5,85,0,0,433,470,5,41,0,0,434,470,5,42,0,0,435,470,5,43,0,0,436,470,
5,44,0,0,437,470,5,45,0,0,438,470,5,46,0,0,439,470,5,47,0,0,440,470,5,4,
0,0,441,470,5,48,0,0,442,470,5,49,0,0,443,470,5,50,0,0,444,470,5,51,0,0,
445,470,5,52,0,0,446,470,5,53,0,0,447,470,5,54,0,0,448,470,5,55,0,0,449,
470,5,56,0,0,450,470,5,57,0,0,451,470,5,58,0,0,452,470,5,9,0,0,453,470,5,
10,0,0,454,470,5,11,0,0,455,470,5,59,0,0,456,470,5,60,0,0,457,470,5,61,0,
0,458,470,5,62,0,0,459,470,5,63,0,0,460,470,5,64,0,0,461,470,5,65,0,0,462,
470,5,66,0,0,463,470,5,67,0,0,464,470,5,39,0,0,465,470,5,40,0,0,466,470,
5,90,0,0,467,470,5,91,0,0,468,470,5,89,0,0,469,415,1,0,0,0,469,416,1,0,0,
0,469,417,1,0,0,0,469,418,1,0,0,0,469,419,1,0,0,0,469,420,1,0,0,0,469,421,
1,0,0,0,469,422,1,0,0,0,469,423,1,0,0,0,469,424,1,0,0,0,469,425,1,0,0,0,
469,426,1,0,0,0,469,427,1,0,0,0,469,428,1,0,0,0,469,429,1,0,0,0,469,430,
1,0,0,0,469,431,1,0,0,0,469,432,1,0,0,0,469,433,1,0,0,0,469,434,1,0,0,0,
469,435,1,0,0,0,469,436,1,0,0,0,469,437,1,0,0,0,469,438,1,0,0,0,469,439,
1,0,0,0,469,440,1,0,0,0,469,441,1,0,0,0,469,442,1,0,0,0,469,443,1,0,0,0,
469,444,1,0,0,0,469,445,1,0,0,0,469,446,1,0,0,0,469,447,1,0,0,0,469,448,
1,0,0,0,469,449,1,0,0,0,469,450,1,0,0,0,469,451,1,0,0,0,469,452,1,0,0,0,
469,453,1,0,0,0,469,454,1,0,0,0,469,455,1,0,0,0,469,456,1,0,0,0,469,457,
1,0,0,0,469,458,1,0,0,0,469,459,1,0,0,0,469,460,1,0,0,0,469,461,1,0,0,0,
469,462,1,0,0,0,469,463,1,0,0,0,469,464,1,0,0,0,469,465,1,0,0,0,469,466,
1,0,0,0,469,467,1,0,0,0,469,468,1,0,0,0,470,85,1,0,0,0,41,89,104,114,120,
125,132,140,147,153,162,170,176,180,195,202,212,219,231,237,246,259,266,
280,289,294,299,311,322,329,339,347,358,363,372,377,381,389,396,404,410,
469];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class PascalishRouterMapperParser extends antlr4.Parser {

    static grammarFileName = "PascalishRouterMapper.g4";
    static literalNames = [ null, "'SERVICE'", "'CASE'", "'OF'", "'RETURN'", 
                            "'METHODS'", "'PROGRAM'", "'DAEMON'", "'REFRESH'", 
                            "'MS'", "'S'", "'M'", "'LIBRARY'", "'USE'", 
                            "'AS'", "'INTEROP'", "'ROLE'", "'CODE_LIBRARIAN'", 
                            "'WFL'", "'WORKFLOW'", "'COBOLISH'", "'PASCALISH'", 
                            "'ROUTER'", "'MAPPER'", "'INPUT'", "'SOURCE'", 
                            "'TARGET'", "'DESCRIPTION'", "'ENABLED'", "'BEGIN'", 
                            "'END'", "'OUTPUT'", "'TYPE'", "'TYPES'", "'WHEN'", 
                            "'TRANSFORM'", "'MAP'", "'TO'", "'USING'", "'TRUE'", 
                            "'FALSE'", "'IF'", "'THEN'", "'ELSE'", "'WHILE'", 
                            "'DO'", "'FOR'", "'CALL'", "'NOT'", "'COBEGIN'", 
                            "'COEND'", "'SUBFLOW'", "'SYNC'", "'ASYNC'", 
                            "'WAIT'", "'ALL'", "'WITH'", "'TIMEOUT'", "'INTO'", 
                            "'ON'", "'ERROR'", "'FAIL'", "'TRANSACTION'", 
                            "'SUCCESS'", "'BACKOUT'", "'TRY'", "'CATCH'", 
                            "'ENDTRY'", "'VAR'", "'FROM'", "'LIBRARIAN'", 
                            "'('", "')'", "'+'", "'-'", "'*'", "'/'", "'='", 
                            "'<'", "'>'", "','", "';'", "'.'", "':='", "':'", 
                            "'||'", "'<='", "'>='", "'<>'" ];
    static symbolicNames = [ null, "SERVICE", "CASE", "OF", "RETURN", "METHODS", 
                             "PROGRAM", "DAEMON", "REFRESH", "MS", "S", 
                             "M", "LIBRARY", "USE", "AS", "INTEROP", "ROLE", 
                             "CODE_LIBRARIAN", "WFL", "WORKFLOW", "COBOLISH", 
                             "PASCALISH", "ROUTER", "MAPPER", "INPUT", "SOURCE", 
                             "TARGET", "DESCRIPTION", "ENABLED", "BEGIN", 
                             "END", "OUTPUT", "TYPE", "TYPES", "WHEN", "TRANSFORM", 
                             "MAP", "TO", "USING", "TRUE", "FALSE", "IF", 
                             "THEN", "ELSE", "WHILE", "DO", "FOR", "CALL", 
                             "NOT", "COBEGIN", "COEND", "SUBFLOW", "SYNC", 
                             "ASYNC", "WAIT", "ALL", "WITH", "TIMEOUT", 
                             "INTO", "ON", "ERROR", "FAIL", "TRANSACTION", 
                             "SUCCESS", "BACKOUT", "TRY", "CATCH", "ENDTRY", 
                             "VAR", "FROM", "LIBRARIAN", "LPAREN", "RPAREN", 
                             "PLUS", "MINUS", "MUL", "DIV", "EQ", "LT", 
                             "GT", "COMMA", "SEMICOLON", "DOT", "ASSIGN", 
                             "COLON", "CONCAT", "LE", "GE", "NEQ", "IDENT", 
                             "NUMBER", "STRING", "BRACE_COMMENT", "PAREN_COMMENT", 
                             "WS" ];
    static ruleNames = [ "program", "statement", "roleDecl", "roleName", 
                         "runtimeDecl", "blockStmt", "varDecl", "varSource", 
                         "serviceDecl", "serviceBody", "serviceStmt", "serviceCaseStmt", 
                         "serviceCaseArm", "serviceReturnStmt", "serviceExpr", 
                         "qualifiedIdent", "programDecl", "daemonDecl", 
                         "daemonRefresh", "daemonRefreshUnit", "libraryDecl", 
                         "librarySource", "useDecl", "interopDecl", "interopKind", 
                         "routerDecl", "routerHeaderProp", "verbList", "outputDecl", 
                         "outputTypeMeta", "mapperDecl", "mapperHeaderProp", 
                         "mapDecl", "stringList", "typeRefList", "typeRef", 
                         "genericTypeArgs", "stringOrIdent", "stringValue", 
                         "booleanValue", "pl0Snippet", "pl0Block", "pl0Element" ];

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
	        this.state = 89;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 549564610) !== 0) || _la===68) {
	            this.state = 86;
	            this.statement();
	            this.state = 91;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 92;
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
	        this.state = 104;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 94;
	            this.serviceDecl();
	            break;
	        case 6:
	        case 7:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 95;
	            this.runtimeDecl();
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 96;
	            this.roleDecl();
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 97;
	            this.varDecl();
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 98;
	            this.libraryDecl();
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 99;
	            this.useDecl();
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 100;
	            this.interopDecl();
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 101;
	            this.routerDecl();
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 102;
	            this.mapperDecl();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 103;
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
	        this.state = 106;
	        this.match(PascalishRouterMapperParser.ROLE);
	        this.state = 107;
	        this.roleName();
	        this.state = 108;
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
	        this.state = 110;
	        _la = this._input.LA(1);
	        if(!(_la===17 || _la===89)) {
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
	        this.state = 114;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 6:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 112;
	            this.programDecl();
	            break;
	        case 7:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 113;
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
	        this.state = 116;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 120;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536874512) !== 0) || ((((_la - 39)) & ~0x1f) === 0 && ((1 << (_la - 39)) & 536870911) !== 0) || ((((_la - 71)) & ~0x1f) === 0 && ((1 << (_la - 71)) & 2088959) !== 0)) {
	            this.state = 117;
	            this.pl0Element();
	            this.state = 122;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 123;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 125;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===81 || _la===82) {
	            this.state = 124;
	            _la = this._input.LA(1);
	            if(!(_la===81 || _la===82)) {
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
	        this.state = 127;
	        this.match(PascalishRouterMapperParser.VAR);
	        this.state = 128;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 129;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 130;
	        this.typeRef();
	        this.state = 132;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===69) {
	            this.state = 131;
	            this.varSource();
	        }

	        this.state = 134;
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
	        this.state = 140;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,6,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 136;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 137;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 138;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 139;
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
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 142;
	        this.match(PascalishRouterMapperParser.SERVICE);
	        this.state = 143;
	        this.stringOrIdent();
	        this.state = 144;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	        this.state = 145;
	        this.serviceBody();
	        this.state = 147;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===81 || _la===82) {
	            this.state = 146;
	            _la = this._input.LA(1);
	            if(!(_la===81 || _la===82)) {
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



	serviceBody() {
	    let localctx = new ServiceBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, PascalishRouterMapperParser.RULE_serviceBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 149;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 153;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===2 || _la===4) {
	            this.state = 150;
	            this.serviceStmt();
	            this.state = 155;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 156;
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



	serviceStmt() {
	    let localctx = new ServiceStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, PascalishRouterMapperParser.RULE_serviceStmt);
	    try {
	        this.state = 162;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 2:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 158;
	            this.serviceCaseStmt();
	            break;
	        case 4:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 159;
	            this.serviceReturnStmt();
	            this.state = 160;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
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



	serviceCaseStmt() {
	    let localctx = new ServiceCaseStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, PascalishRouterMapperParser.RULE_serviceCaseStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 164;
	        this.match(PascalishRouterMapperParser.CASE);
	        this.state = 165;
	        this.serviceExpr();
	        this.state = 166;
	        this.match(PascalishRouterMapperParser.OF);
	        this.state = 168; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 167;
	            this.serviceCaseArm();
	            this.state = 170; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===39 || _la===40 || ((((_la - 89)) & ~0x1f) === 0 && ((1 << (_la - 89)) & 7) !== 0));
	        this.state = 176;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 172;
	            this.match(PascalishRouterMapperParser.ELSE);
	            this.state = 173;
	            this.serviceReturnStmt();
	            this.state = 174;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	        }

	        this.state = 178;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 180;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===81) {
	            this.state = 179;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
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



	serviceCaseArm() {
	    let localctx = new ServiceCaseArmContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, PascalishRouterMapperParser.RULE_serviceCaseArm);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 182;
	        this.serviceExpr();
	        this.state = 183;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 184;
	        this.serviceReturnStmt();
	        this.state = 185;
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



	serviceReturnStmt() {
	    let localctx = new ServiceReturnStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishRouterMapperParser.RULE_serviceReturnStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 187;
	        this.match(PascalishRouterMapperParser.RETURN);
	        this.state = 188;
	        this.serviceExpr();
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



	serviceExpr() {
	    let localctx = new ServiceExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, PascalishRouterMapperParser.RULE_serviceExpr);
	    try {
	        this.state = 195;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 89:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 190;
	            this.qualifiedIdent();
	            break;
	        case 91:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 191;
	            this.stringValue();
	            break;
	        case 90:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 192;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 193;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 194;
	            this.match(PascalishRouterMapperParser.FALSE);
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



	qualifiedIdent() {
	    let localctx = new QualifiedIdentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, PascalishRouterMapperParser.RULE_qualifiedIdent);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 197;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 202;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===82) {
	            this.state = 198;
	            this.match(PascalishRouterMapperParser.DOT);
	            this.state = 199;
	            this.match(PascalishRouterMapperParser.IDENT);
	            this.state = 204;
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



	programDecl() {
	    let localctx = new ProgramDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, PascalishRouterMapperParser.RULE_programDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 205;
	        this.match(PascalishRouterMapperParser.PROGRAM);
	        this.state = 206;
	        this.stringOrIdent();
	        this.state = 207;
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
	    this.enterRule(localctx, 34, PascalishRouterMapperParser.RULE_daemonDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 209;
	        this.match(PascalishRouterMapperParser.DAEMON);
	        this.state = 210;
	        this.stringOrIdent();
	        this.state = 212;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 211;
	            this.daemonRefresh();
	        }

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



	daemonRefresh() {
	    let localctx = new DaemonRefreshContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, PascalishRouterMapperParser.RULE_daemonRefresh);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 216;
	        this.match(PascalishRouterMapperParser.REFRESH);
	        this.state = 217;
	        this.match(PascalishRouterMapperParser.NUMBER);
	        this.state = 219;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 3584) !== 0)) {
	            this.state = 218;
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
	    this.enterRule(localctx, 38, PascalishRouterMapperParser.RULE_daemonRefreshUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 221;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 3584) !== 0))) {
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
	    this.enterRule(localctx, 40, PascalishRouterMapperParser.RULE_libraryDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 223;
	        this.match(PascalishRouterMapperParser.LIBRARY);
	        this.state = 224;
	        this.stringOrIdent();
	        this.state = 225;
	        this.match(PascalishRouterMapperParser.FROM);
	        this.state = 226;
	        this.librarySource();
	        this.state = 227;
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
	    this.enterRule(localctx, 42, PascalishRouterMapperParser.RULE_librarySource);
	    try {
	        this.state = 231;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 70:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 229;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;
	        case 89:
	        case 91:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 230;
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
	    this.enterRule(localctx, 44, PascalishRouterMapperParser.RULE_useDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 233;
	        this.match(PascalishRouterMapperParser.USE);
	        this.state = 234;
	        this.stringOrIdent();
	        this.state = 237;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===14) {
	            this.state = 235;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 236;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 239;
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
	    this.enterRule(localctx, 46, PascalishRouterMapperParser.RULE_interopDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 241;
	        this.match(PascalishRouterMapperParser.INTEROP);
	        this.state = 242;
	        this.interopKind();
	        this.state = 243;
	        this.stringOrIdent();
	        this.state = 246;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===14) {
	            this.state = 244;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 245;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 248;
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
	    this.enterRule(localctx, 48, PascalishRouterMapperParser.RULE_interopKind);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 250;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 3932160) !== 0))) {
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
	    this.enterRule(localctx, 50, PascalishRouterMapperParser.RULE_routerDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 252;
	        this.match(PascalishRouterMapperParser.ROUTER);
	        this.state = 253;
	        this.stringOrIdent();
	        this.state = 254;
	        this.match(PascalishRouterMapperParser.INPUT);
	        this.state = 255;
	        this.stringValue();
	        this.state = 259;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 402653218) !== 0)) {
	            this.state = 256;
	            this.routerHeaderProp();
	            this.state = 261;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 262;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 266;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===31) {
	            this.state = 263;
	            this.outputDecl();
	            this.state = 268;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 269;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 270;
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
	    this.enterRule(localctx, 52, PascalishRouterMapperParser.RULE_routerHeaderProp);
	    try {
	        this.state = 280;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 27:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 272;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 273;
	            this.stringValue();
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 274;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 275;
	            this.booleanValue();
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 276;
	            this.match(PascalishRouterMapperParser.SERVICE);
	            this.state = 277;
	            this.stringValue();
	            break;
	        case 5:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 278;
	            this.match(PascalishRouterMapperParser.METHODS);
	            this.state = 279;
	            this.verbList();
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



	verbList() {
	    let localctx = new VerbListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, PascalishRouterMapperParser.RULE_verbList);
	    var _la = 0;
	    try {
	        this.state = 294;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 89:
	        case 91:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 282;
	            this.stringOrIdent();
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 283;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 284;
	            this.stringOrIdent();
	            this.state = 289;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===80) {
	                this.state = 285;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 286;
	                this.stringOrIdent();
	                this.state = 291;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 292;
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



	outputDecl() {
	    let localctx = new OutputDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, PascalishRouterMapperParser.RULE_outputDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 296;
	        this.match(PascalishRouterMapperParser.OUTPUT);
	        this.state = 297;
	        this.stringValue();
	        this.state = 299;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===32 || _la===33) {
	            this.state = 298;
	            this.outputTypeMeta();
	        }

	        this.state = 301;
	        this.match(PascalishRouterMapperParser.WHEN);
	        this.state = 302;
	        this.pl0Snippet();
	        this.state = 303;
	        this.match(PascalishRouterMapperParser.TRANSFORM);
	        this.state = 304;
	        this.pl0Snippet();
	        this.state = 305;
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
	    this.enterRule(localctx, 58, PascalishRouterMapperParser.RULE_outputTypeMeta);
	    try {
	        this.state = 311;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 32:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 307;
	            this.match(PascalishRouterMapperParser.TYPE);
	            this.state = 308;
	            this.typeRef();
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 309;
	            this.match(PascalishRouterMapperParser.TYPES);
	            this.state = 310;
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
	    this.enterRule(localctx, 60, PascalishRouterMapperParser.RULE_mapperDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 313;
	        this.match(PascalishRouterMapperParser.MAPPER);
	        this.state = 314;
	        this.stringOrIdent();
	        this.state = 315;
	        this.match(PascalishRouterMapperParser.SOURCE);
	        this.state = 316;
	        this.typeRef();
	        this.state = 317;
	        this.match(PascalishRouterMapperParser.TARGET);
	        this.state = 318;
	        this.typeRef();
	        this.state = 322;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===27 || _la===28) {
	            this.state = 319;
	            this.mapperHeaderProp();
	            this.state = 324;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 325;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 329;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===36) {
	            this.state = 326;
	            this.mapDecl();
	            this.state = 331;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 332;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 333;
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
	    this.enterRule(localctx, 62, PascalishRouterMapperParser.RULE_mapperHeaderProp);
	    try {
	        this.state = 339;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 27:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 335;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 336;
	            this.stringValue();
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 337;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 338;
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
	    this.enterRule(localctx, 64, PascalishRouterMapperParser.RULE_mapDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 341;
	        this.match(PascalishRouterMapperParser.MAP);
	        this.state = 342;
	        this.stringValue();
	        this.state = 343;
	        this.match(PascalishRouterMapperParser.TO);
	        this.state = 344;
	        this.stringValue();
	        this.state = 347;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===38) {
	            this.state = 345;
	            this.match(PascalishRouterMapperParser.USING);
	            this.state = 346;
	            this.pl0Snippet();
	        }

	        this.state = 349;
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
	    this.enterRule(localctx, 66, PascalishRouterMapperParser.RULE_stringList);
	    var _la = 0;
	    try {
	        this.state = 363;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 91:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 351;
	            this.stringValue();
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 352;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 353;
	            this.stringValue();
	            this.state = 358;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===80) {
	                this.state = 354;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 355;
	                this.stringValue();
	                this.state = 360;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 361;
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
	    this.enterRule(localctx, 68, PascalishRouterMapperParser.RULE_typeRefList);
	    var _la = 0;
	    try {
	        this.state = 377;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 89:
	        case 91:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 365;
	            this.typeRef();
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 366;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 367;
	            this.typeRef();
	            this.state = 372;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===80) {
	                this.state = 368;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 369;
	                this.typeRef();
	                this.state = 374;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 375;
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
	    this.enterRule(localctx, 70, PascalishRouterMapperParser.RULE_typeRef);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 379;
	        this.stringOrIdent();
	        this.state = 381;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===78) {
	            this.state = 380;
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
	    this.enterRule(localctx, 72, PascalishRouterMapperParser.RULE_genericTypeArgs);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 383;
	        this.match(PascalishRouterMapperParser.LT);
	        this.state = 384;
	        this.typeRef();
	        this.state = 389;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===80) {
	            this.state = 385;
	            this.match(PascalishRouterMapperParser.COMMA);
	            this.state = 386;
	            this.typeRef();
	            this.state = 391;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 392;
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
	    this.enterRule(localctx, 74, PascalishRouterMapperParser.RULE_stringOrIdent);
	    try {
	        this.state = 396;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 91:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 394;
	            this.stringValue();
	            break;
	        case 89:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 395;
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
	    this.enterRule(localctx, 76, PascalishRouterMapperParser.RULE_stringValue);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 398;
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
	    this.enterRule(localctx, 78, PascalishRouterMapperParser.RULE_booleanValue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 400;
	        _la = this._input.LA(1);
	        if(!(_la===39 || _la===40)) {
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
	    this.enterRule(localctx, 80, PascalishRouterMapperParser.RULE_pl0Snippet);
	    try {
	        this.state = 404;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 91:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 402;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 403;
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
	    this.enterRule(localctx, 82, PascalishRouterMapperParser.RULE_pl0Block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 406;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 410;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536874512) !== 0) || ((((_la - 39)) & ~0x1f) === 0 && ((1 << (_la - 39)) & 536870911) !== 0) || ((((_la - 71)) & ~0x1f) === 0 && ((1 << (_la - 71)) & 2088959) !== 0)) {
	            this.state = 407;
	            this.pl0Element();
	            this.state = 412;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 413;
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
	    this.enterRule(localctx, 84, PascalishRouterMapperParser.RULE_pl0Element);
	    try {
	        this.state = 469;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 29:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 415;
	            this.pl0Block();
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 416;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 417;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 418;
	            this.match(PascalishRouterMapperParser.PLUS);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 419;
	            this.match(PascalishRouterMapperParser.MINUS);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 420;
	            this.match(PascalishRouterMapperParser.MUL);
	            break;
	        case 76:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 421;
	            this.match(PascalishRouterMapperParser.DIV);
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 422;
	            this.match(PascalishRouterMapperParser.EQ);
	            break;
	        case 78:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 423;
	            this.match(PascalishRouterMapperParser.LT);
	            break;
	        case 79:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 424;
	            this.match(PascalishRouterMapperParser.GT);
	            break;
	        case 86:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 425;
	            this.match(PascalishRouterMapperParser.LE);
	            break;
	        case 87:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 426;
	            this.match(PascalishRouterMapperParser.GE);
	            break;
	        case 88:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 427;
	            this.match(PascalishRouterMapperParser.NEQ);
	            break;
	        case 80:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 428;
	            this.match(PascalishRouterMapperParser.COMMA);
	            break;
	        case 81:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 429;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	            break;
	        case 82:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 430;
	            this.match(PascalishRouterMapperParser.DOT);
	            break;
	        case 83:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 431;
	            this.match(PascalishRouterMapperParser.ASSIGN);
	            break;
	        case 85:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 432;
	            this.match(PascalishRouterMapperParser.CONCAT);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 433;
	            this.match(PascalishRouterMapperParser.IF);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 434;
	            this.match(PascalishRouterMapperParser.THEN);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 435;
	            this.match(PascalishRouterMapperParser.ELSE);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 436;
	            this.match(PascalishRouterMapperParser.WHILE);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 437;
	            this.match(PascalishRouterMapperParser.DO);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 438;
	            this.match(PascalishRouterMapperParser.FOR);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 439;
	            this.match(PascalishRouterMapperParser.CALL);
	            break;
	        case 4:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 440;
	            this.match(PascalishRouterMapperParser.RETURN);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 441;
	            this.match(PascalishRouterMapperParser.NOT);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 442;
	            this.match(PascalishRouterMapperParser.COBEGIN);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 443;
	            this.match(PascalishRouterMapperParser.COEND);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 444;
	            this.match(PascalishRouterMapperParser.SUBFLOW);
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 445;
	            this.match(PascalishRouterMapperParser.SYNC);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 446;
	            this.match(PascalishRouterMapperParser.ASYNC);
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 447;
	            this.match(PascalishRouterMapperParser.WAIT);
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 448;
	            this.match(PascalishRouterMapperParser.ALL);
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 449;
	            this.match(PascalishRouterMapperParser.WITH);
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 450;
	            this.match(PascalishRouterMapperParser.TIMEOUT);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 451;
	            this.match(PascalishRouterMapperParser.INTO);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 452;
	            this.match(PascalishRouterMapperParser.MS);
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 453;
	            this.match(PascalishRouterMapperParser.S);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 454;
	            this.match(PascalishRouterMapperParser.M);
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 455;
	            this.match(PascalishRouterMapperParser.ON);
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 456;
	            this.match(PascalishRouterMapperParser.ERROR);
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 43);
	            this.state = 457;
	            this.match(PascalishRouterMapperParser.FAIL);
	            break;
	        case 62:
	            this.enterOuterAlt(localctx, 44);
	            this.state = 458;
	            this.match(PascalishRouterMapperParser.TRANSACTION);
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 45);
	            this.state = 459;
	            this.match(PascalishRouterMapperParser.SUCCESS);
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 46);
	            this.state = 460;
	            this.match(PascalishRouterMapperParser.BACKOUT);
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 47);
	            this.state = 461;
	            this.match(PascalishRouterMapperParser.TRY);
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 48);
	            this.state = 462;
	            this.match(PascalishRouterMapperParser.CATCH);
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 49);
	            this.state = 463;
	            this.match(PascalishRouterMapperParser.ENDTRY);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 50);
	            this.state = 464;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 51);
	            this.state = 465;
	            this.match(PascalishRouterMapperParser.FALSE);
	            break;
	        case 90:
	            this.enterOuterAlt(localctx, 52);
	            this.state = 466;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 91:
	            this.enterOuterAlt(localctx, 53);
	            this.state = 467;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 89:
	            this.enterOuterAlt(localctx, 54);
	            this.state = 468;
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
PascalishRouterMapperParser.CASE = 2;
PascalishRouterMapperParser.OF = 3;
PascalishRouterMapperParser.RETURN = 4;
PascalishRouterMapperParser.METHODS = 5;
PascalishRouterMapperParser.PROGRAM = 6;
PascalishRouterMapperParser.DAEMON = 7;
PascalishRouterMapperParser.REFRESH = 8;
PascalishRouterMapperParser.MS = 9;
PascalishRouterMapperParser.S = 10;
PascalishRouterMapperParser.M = 11;
PascalishRouterMapperParser.LIBRARY = 12;
PascalishRouterMapperParser.USE = 13;
PascalishRouterMapperParser.AS = 14;
PascalishRouterMapperParser.INTEROP = 15;
PascalishRouterMapperParser.ROLE = 16;
PascalishRouterMapperParser.CODE_LIBRARIAN = 17;
PascalishRouterMapperParser.WFL = 18;
PascalishRouterMapperParser.WORKFLOW = 19;
PascalishRouterMapperParser.COBOLISH = 20;
PascalishRouterMapperParser.PASCALISH = 21;
PascalishRouterMapperParser.ROUTER = 22;
PascalishRouterMapperParser.MAPPER = 23;
PascalishRouterMapperParser.INPUT = 24;
PascalishRouterMapperParser.SOURCE = 25;
PascalishRouterMapperParser.TARGET = 26;
PascalishRouterMapperParser.DESCRIPTION = 27;
PascalishRouterMapperParser.ENABLED = 28;
PascalishRouterMapperParser.BEGIN = 29;
PascalishRouterMapperParser.END = 30;
PascalishRouterMapperParser.OUTPUT = 31;
PascalishRouterMapperParser.TYPE = 32;
PascalishRouterMapperParser.TYPES = 33;
PascalishRouterMapperParser.WHEN = 34;
PascalishRouterMapperParser.TRANSFORM = 35;
PascalishRouterMapperParser.MAP = 36;
PascalishRouterMapperParser.TO = 37;
PascalishRouterMapperParser.USING = 38;
PascalishRouterMapperParser.TRUE = 39;
PascalishRouterMapperParser.FALSE = 40;
PascalishRouterMapperParser.IF = 41;
PascalishRouterMapperParser.THEN = 42;
PascalishRouterMapperParser.ELSE = 43;
PascalishRouterMapperParser.WHILE = 44;
PascalishRouterMapperParser.DO = 45;
PascalishRouterMapperParser.FOR = 46;
PascalishRouterMapperParser.CALL = 47;
PascalishRouterMapperParser.NOT = 48;
PascalishRouterMapperParser.COBEGIN = 49;
PascalishRouterMapperParser.COEND = 50;
PascalishRouterMapperParser.SUBFLOW = 51;
PascalishRouterMapperParser.SYNC = 52;
PascalishRouterMapperParser.ASYNC = 53;
PascalishRouterMapperParser.WAIT = 54;
PascalishRouterMapperParser.ALL = 55;
PascalishRouterMapperParser.WITH = 56;
PascalishRouterMapperParser.TIMEOUT = 57;
PascalishRouterMapperParser.INTO = 58;
PascalishRouterMapperParser.ON = 59;
PascalishRouterMapperParser.ERROR = 60;
PascalishRouterMapperParser.FAIL = 61;
PascalishRouterMapperParser.TRANSACTION = 62;
PascalishRouterMapperParser.SUCCESS = 63;
PascalishRouterMapperParser.BACKOUT = 64;
PascalishRouterMapperParser.TRY = 65;
PascalishRouterMapperParser.CATCH = 66;
PascalishRouterMapperParser.ENDTRY = 67;
PascalishRouterMapperParser.VAR = 68;
PascalishRouterMapperParser.FROM = 69;
PascalishRouterMapperParser.LIBRARIAN = 70;
PascalishRouterMapperParser.LPAREN = 71;
PascalishRouterMapperParser.RPAREN = 72;
PascalishRouterMapperParser.PLUS = 73;
PascalishRouterMapperParser.MINUS = 74;
PascalishRouterMapperParser.MUL = 75;
PascalishRouterMapperParser.DIV = 76;
PascalishRouterMapperParser.EQ = 77;
PascalishRouterMapperParser.LT = 78;
PascalishRouterMapperParser.GT = 79;
PascalishRouterMapperParser.COMMA = 80;
PascalishRouterMapperParser.SEMICOLON = 81;
PascalishRouterMapperParser.DOT = 82;
PascalishRouterMapperParser.ASSIGN = 83;
PascalishRouterMapperParser.COLON = 84;
PascalishRouterMapperParser.CONCAT = 85;
PascalishRouterMapperParser.LE = 86;
PascalishRouterMapperParser.GE = 87;
PascalishRouterMapperParser.NEQ = 88;
PascalishRouterMapperParser.IDENT = 89;
PascalishRouterMapperParser.NUMBER = 90;
PascalishRouterMapperParser.STRING = 91;
PascalishRouterMapperParser.BRACE_COMMENT = 92;
PascalishRouterMapperParser.PAREN_COMMENT = 93;
PascalishRouterMapperParser.WS = 94;

PascalishRouterMapperParser.RULE_program = 0;
PascalishRouterMapperParser.RULE_statement = 1;
PascalishRouterMapperParser.RULE_roleDecl = 2;
PascalishRouterMapperParser.RULE_roleName = 3;
PascalishRouterMapperParser.RULE_runtimeDecl = 4;
PascalishRouterMapperParser.RULE_blockStmt = 5;
PascalishRouterMapperParser.RULE_varDecl = 6;
PascalishRouterMapperParser.RULE_varSource = 7;
PascalishRouterMapperParser.RULE_serviceDecl = 8;
PascalishRouterMapperParser.RULE_serviceBody = 9;
PascalishRouterMapperParser.RULE_serviceStmt = 10;
PascalishRouterMapperParser.RULE_serviceCaseStmt = 11;
PascalishRouterMapperParser.RULE_serviceCaseArm = 12;
PascalishRouterMapperParser.RULE_serviceReturnStmt = 13;
PascalishRouterMapperParser.RULE_serviceExpr = 14;
PascalishRouterMapperParser.RULE_qualifiedIdent = 15;
PascalishRouterMapperParser.RULE_programDecl = 16;
PascalishRouterMapperParser.RULE_daemonDecl = 17;
PascalishRouterMapperParser.RULE_daemonRefresh = 18;
PascalishRouterMapperParser.RULE_daemonRefreshUnit = 19;
PascalishRouterMapperParser.RULE_libraryDecl = 20;
PascalishRouterMapperParser.RULE_librarySource = 21;
PascalishRouterMapperParser.RULE_useDecl = 22;
PascalishRouterMapperParser.RULE_interopDecl = 23;
PascalishRouterMapperParser.RULE_interopKind = 24;
PascalishRouterMapperParser.RULE_routerDecl = 25;
PascalishRouterMapperParser.RULE_routerHeaderProp = 26;
PascalishRouterMapperParser.RULE_verbList = 27;
PascalishRouterMapperParser.RULE_outputDecl = 28;
PascalishRouterMapperParser.RULE_outputTypeMeta = 29;
PascalishRouterMapperParser.RULE_mapperDecl = 30;
PascalishRouterMapperParser.RULE_mapperHeaderProp = 31;
PascalishRouterMapperParser.RULE_mapDecl = 32;
PascalishRouterMapperParser.RULE_stringList = 33;
PascalishRouterMapperParser.RULE_typeRefList = 34;
PascalishRouterMapperParser.RULE_typeRef = 35;
PascalishRouterMapperParser.RULE_genericTypeArgs = 36;
PascalishRouterMapperParser.RULE_stringOrIdent = 37;
PascalishRouterMapperParser.RULE_stringValue = 38;
PascalishRouterMapperParser.RULE_booleanValue = 39;
PascalishRouterMapperParser.RULE_pl0Snippet = 40;
PascalishRouterMapperParser.RULE_pl0Block = 41;
PascalishRouterMapperParser.RULE_pl0Element = 42;

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

	serviceDecl() {
	    return this.getTypedRuleContext(ServiceDeclContext,0);
	};

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

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.SEMICOLON);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.SEMICOLON, i);
	    }
	};


	serviceBody() {
	    return this.getTypedRuleContext(ServiceBodyContext,0);
	};

	DOT() {
	    return this.getToken(PascalishRouterMapperParser.DOT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceBody;
    }

	BEGIN() {
	    return this.getToken(PascalishRouterMapperParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	serviceStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ServiceStmtContext);
	    } else {
	        return this.getTypedRuleContext(ServiceStmtContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceStmt;
    }

	serviceCaseStmt() {
	    return this.getTypedRuleContext(ServiceCaseStmtContext,0);
	};

	serviceReturnStmt() {
	    return this.getTypedRuleContext(ServiceReturnStmtContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceCaseStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceCaseStmt;
    }

	CASE() {
	    return this.getToken(PascalishRouterMapperParser.CASE, 0);
	};

	serviceExpr() {
	    return this.getTypedRuleContext(ServiceExprContext,0);
	};

	OF() {
	    return this.getToken(PascalishRouterMapperParser.OF, 0);
	};

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	serviceCaseArm = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ServiceCaseArmContext);
	    } else {
	        return this.getTypedRuleContext(ServiceCaseArmContext,i);
	    }
	};

	ELSE() {
	    return this.getToken(PascalishRouterMapperParser.ELSE, 0);
	};

	serviceReturnStmt() {
	    return this.getTypedRuleContext(ServiceReturnStmtContext,0);
	};

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.SEMICOLON);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.SEMICOLON, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceCaseStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceCaseArmContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceCaseArm;
    }

	serviceExpr() {
	    return this.getTypedRuleContext(ServiceExprContext,0);
	};

	COLON() {
	    return this.getToken(PascalishRouterMapperParser.COLON, 0);
	};

	serviceReturnStmt() {
	    return this.getTypedRuleContext(ServiceReturnStmtContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceCaseArm(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceReturnStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceReturnStmt;
    }

	RETURN() {
	    return this.getToken(PascalishRouterMapperParser.RETURN, 0);
	};

	serviceExpr() {
	    return this.getTypedRuleContext(ServiceExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceReturnStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceExpr;
    }

	qualifiedIdent() {
	    return this.getTypedRuleContext(QualifiedIdentContext,0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	NUMBER() {
	    return this.getToken(PascalishRouterMapperParser.NUMBER, 0);
	};

	TRUE() {
	    return this.getToken(PascalishRouterMapperParser.TRUE, 0);
	};

	FALSE() {
	    return this.getToken(PascalishRouterMapperParser.FALSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QualifiedIdentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_qualifiedIdent;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.IDENT);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.IDENT, i);
	    }
	};


	DOT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishRouterMapperParser.DOT);
	    } else {
	        return this.getToken(PascalishRouterMapperParser.DOT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitQualifiedIdent(this);
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

	METHODS() {
	    return this.getToken(PascalishRouterMapperParser.METHODS, 0);
	};

	verbList() {
	    return this.getTypedRuleContext(VerbListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRouterHeaderProp(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VerbListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_verbList;
    }

	stringOrIdent = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StringOrIdentContext);
	    } else {
	        return this.getTypedRuleContext(StringOrIdentContext,i);
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
	        return visitor.visitVerbList(this);
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

	DOT() {
	    return this.getToken(PascalishRouterMapperParser.DOT, 0);
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

	RETURN() {
	    return this.getToken(PascalishRouterMapperParser.RETURN, 0);
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

	ALL() {
	    return this.getToken(PascalishRouterMapperParser.ALL, 0);
	};

	WITH() {
	    return this.getToken(PascalishRouterMapperParser.WITH, 0);
	};

	TIMEOUT() {
	    return this.getToken(PascalishRouterMapperParser.TIMEOUT, 0);
	};

	INTO() {
	    return this.getToken(PascalishRouterMapperParser.INTO, 0);
	};

	MS() {
	    return this.getToken(PascalishRouterMapperParser.MS, 0);
	};

	S() {
	    return this.getToken(PascalishRouterMapperParser.S, 0);
	};

	M() {
	    return this.getToken(PascalishRouterMapperParser.M, 0);
	};

	ON() {
	    return this.getToken(PascalishRouterMapperParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(PascalishRouterMapperParser.ERROR, 0);
	};

	FAIL() {
	    return this.getToken(PascalishRouterMapperParser.FAIL, 0);
	};

	TRANSACTION() {
	    return this.getToken(PascalishRouterMapperParser.TRANSACTION, 0);
	};

	SUCCESS() {
	    return this.getToken(PascalishRouterMapperParser.SUCCESS, 0);
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
PascalishRouterMapperParser.ServiceBodyContext = ServiceBodyContext; 
PascalishRouterMapperParser.ServiceStmtContext = ServiceStmtContext; 
PascalishRouterMapperParser.ServiceCaseStmtContext = ServiceCaseStmtContext; 
PascalishRouterMapperParser.ServiceCaseArmContext = ServiceCaseArmContext; 
PascalishRouterMapperParser.ServiceReturnStmtContext = ServiceReturnStmtContext; 
PascalishRouterMapperParser.ServiceExprContext = ServiceExprContext; 
PascalishRouterMapperParser.QualifiedIdentContext = QualifiedIdentContext; 
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
PascalishRouterMapperParser.VerbListContext = VerbListContext; 
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
