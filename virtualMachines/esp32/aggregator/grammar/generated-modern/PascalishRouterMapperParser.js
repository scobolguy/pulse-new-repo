// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/PascalishRouterMapper.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishRouterMapperVisitor from './PascalishRouterMapperVisitor.js';

const serializedATN = [4,1,106,521,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,2,48,7,48,1,
0,5,0,100,8,0,10,0,12,0,103,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
1,1,1,1,3,1,117,8,1,1,2,1,2,1,2,1,2,1,3,1,3,1,4,1,4,3,4,127,8,4,1,5,1,5,
5,5,131,8,5,10,5,12,5,134,9,5,1,5,1,5,3,5,138,8,5,1,6,1,6,1,6,1,6,1,6,3,
6,145,8,6,1,6,1,6,1,7,1,7,1,7,1,7,3,7,153,8,7,1,8,1,8,1,8,3,8,158,8,8,1,
8,1,8,1,8,5,8,163,8,8,10,8,12,8,166,9,8,1,8,3,8,169,8,8,1,8,3,8,172,8,8,
1,9,1,9,1,9,1,10,1,10,1,10,3,10,180,8,10,1,10,3,10,183,8,10,1,10,1,10,1,
10,1,11,1,11,1,12,1,12,1,12,1,13,1,13,1,13,1,14,1,14,5,14,198,8,14,10,14,
12,14,201,9,14,1,14,1,14,1,15,1,15,1,15,1,15,3,15,209,8,15,1,16,1,16,1,16,
1,16,4,16,215,8,16,11,16,12,16,216,1,16,1,16,1,16,1,16,3,16,223,8,16,1,16,
1,16,3,16,227,8,16,1,17,1,17,1,17,1,17,1,17,1,18,1,18,1,18,1,19,1,19,1,19,
1,19,1,19,3,19,242,8,19,1,20,1,20,1,20,5,20,247,8,20,10,20,12,20,250,9,20,
1,21,1,21,1,22,1,22,1,22,1,22,1,23,1,23,1,23,3,23,261,8,23,1,23,1,23,1,24,
1,24,1,24,3,24,268,8,24,1,25,1,25,1,26,1,26,1,26,1,26,1,26,1,26,1,27,1,27,
3,27,280,8,27,1,28,1,28,1,28,1,28,3,28,286,8,28,1,28,1,28,1,29,1,29,1,29,
1,29,1,29,3,29,295,8,29,1,29,1,29,1,30,1,30,1,31,1,31,1,31,1,31,1,31,5,31,
306,8,31,10,31,12,31,309,9,31,1,31,1,31,5,31,313,8,31,10,31,12,31,316,9,
31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,1,32,1,32,3,32,329,8,32,
1,33,1,33,1,33,1,33,1,33,5,33,336,8,33,10,33,12,33,339,9,33,1,33,1,33,3,
33,343,8,33,1,34,1,34,1,34,3,34,348,8,34,1,34,1,34,1,34,1,34,1,34,1,34,1,
35,1,35,1,35,1,35,3,35,360,8,35,1,36,1,36,1,36,1,36,1,36,1,36,1,36,5,36,
369,8,36,10,36,12,36,372,9,36,1,36,1,36,5,36,376,8,36,10,36,12,36,379,9,
36,1,36,1,36,1,36,1,37,1,37,1,37,1,37,3,37,388,8,37,1,38,1,38,1,38,1,38,
1,38,1,38,3,38,396,8,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,5,39,405,8,39,
10,39,12,39,408,9,39,1,39,1,39,3,39,412,8,39,1,40,1,40,1,40,1,40,1,40,5,
40,419,8,40,10,40,12,40,422,9,40,1,40,1,40,3,40,426,8,40,1,41,1,41,3,41,
430,8,41,1,42,1,42,1,42,1,42,5,42,436,8,42,10,42,12,42,439,9,42,1,42,1,42,
1,43,1,43,3,43,445,8,43,1,44,1,44,1,45,1,45,1,46,1,46,3,46,453,8,46,1,47,
1,47,5,47,457,8,47,10,47,12,47,460,9,47,1,47,1,47,1,48,1,48,1,48,1,48,1,
48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,
48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,519,8,48,1,48,0,0,49,0,2,4,6,8,10,
12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,
60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,0,8,2,0,17,17,101,
101,1,0,93,94,1,0,60,64,1,0,65,69,2,0,65,69,101,101,1,0,9,11,1,0,18,21,1,
0,39,40,583,0,101,1,0,0,0,2,116,1,0,0,0,4,118,1,0,0,0,6,122,1,0,0,0,8,126,
1,0,0,0,10,128,1,0,0,0,12,139,1,0,0,0,14,152,1,0,0,0,16,154,1,0,0,0,18,173,
1,0,0,0,20,176,1,0,0,0,22,187,1,0,0,0,24,189,1,0,0,0,26,192,1,0,0,0,28,195,
1,0,0,0,30,208,1,0,0,0,32,210,1,0,0,0,34,228,1,0,0,0,36,233,1,0,0,0,38,241,
1,0,0,0,40,243,1,0,0,0,42,251,1,0,0,0,44,253,1,0,0,0,46,257,1,0,0,0,48,264,
1,0,0,0,50,269,1,0,0,0,52,271,1,0,0,0,54,279,1,0,0,0,56,281,1,0,0,0,58,289,
1,0,0,0,60,298,1,0,0,0,62,300,1,0,0,0,64,328,1,0,0,0,66,342,1,0,0,0,68,344,
1,0,0,0,70,359,1,0,0,0,72,361,1,0,0,0,74,387,1,0,0,0,76,389,1,0,0,0,78,411,
1,0,0,0,80,425,1,0,0,0,82,427,1,0,0,0,84,431,1,0,0,0,86,444,1,0,0,0,88,446,
1,0,0,0,90,448,1,0,0,0,92,452,1,0,0,0,94,454,1,0,0,0,96,518,1,0,0,0,98,100,
3,2,1,0,99,98,1,0,0,0,100,103,1,0,0,0,101,99,1,0,0,0,101,102,1,0,0,0,102,
104,1,0,0,0,103,101,1,0,0,0,104,105,5,0,0,1,105,1,1,0,0,0,106,117,3,16,8,
0,107,117,3,8,4,0,108,117,3,4,2,0,109,117,3,12,6,0,110,117,3,52,26,0,111,
117,3,56,28,0,112,117,3,58,29,0,113,117,3,62,31,0,114,117,3,72,36,0,115,
117,3,10,5,0,116,106,1,0,0,0,116,107,1,0,0,0,116,108,1,0,0,0,116,109,1,0,
0,0,116,110,1,0,0,0,116,111,1,0,0,0,116,112,1,0,0,0,116,113,1,0,0,0,116,
114,1,0,0,0,116,115,1,0,0,0,117,3,1,0,0,0,118,119,5,16,0,0,119,120,3,6,3,
0,120,121,5,93,0,0,121,5,1,0,0,0,122,123,7,0,0,0,123,7,1,0,0,0,124,127,3,
44,22,0,125,127,3,46,23,0,126,124,1,0,0,0,126,125,1,0,0,0,127,9,1,0,0,0,
128,132,5,29,0,0,129,131,3,96,48,0,130,129,1,0,0,0,131,134,1,0,0,0,132,130,
1,0,0,0,132,133,1,0,0,0,133,135,1,0,0,0,134,132,1,0,0,0,135,137,5,30,0,0,
136,138,7,1,0,0,137,136,1,0,0,0,137,138,1,0,0,0,138,11,1,0,0,0,139,140,5,
80,0,0,140,141,5,101,0,0,141,142,5,96,0,0,142,144,3,82,41,0,143,145,3,14,
7,0,144,143,1,0,0,0,144,145,1,0,0,0,145,146,1,0,0,0,146,147,5,93,0,0,147,
13,1,0,0,0,148,149,5,81,0,0,149,153,5,82,0,0,150,151,5,81,0,0,151,153,3,
86,43,0,152,148,1,0,0,0,152,150,1,0,0,0,153,15,1,0,0,0,154,155,5,1,0,0,155,
157,3,86,43,0,156,158,3,18,9,0,157,156,1,0,0,0,157,158,1,0,0,0,158,159,1,
0,0,0,159,168,5,93,0,0,160,169,3,28,14,0,161,163,3,20,10,0,162,161,1,0,0,
0,163,166,1,0,0,0,164,162,1,0,0,0,164,165,1,0,0,0,165,167,1,0,0,0,166,164,
1,0,0,0,167,169,5,30,0,0,168,160,1,0,0,0,168,164,1,0,0,0,169,171,1,0,0,0,
170,172,7,1,0,0,171,170,1,0,0,0,171,172,1,0,0,0,172,17,1,0,0,0,173,174,5,
59,0,0,174,175,7,2,0,0,175,19,1,0,0,0,176,177,3,22,11,0,177,179,3,88,44,
0,178,180,3,24,12,0,179,178,1,0,0,0,179,180,1,0,0,0,180,182,1,0,0,0,181,
183,3,26,13,0,182,181,1,0,0,0,182,183,1,0,0,0,183,184,1,0,0,0,184,185,5,
93,0,0,185,186,3,10,5,0,186,21,1,0,0,0,187,188,7,3,0,0,188,23,1,0,0,0,189,
190,5,70,0,0,190,191,3,82,41,0,191,25,1,0,0,0,192,193,5,71,0,0,193,194,3,
82,41,0,194,27,1,0,0,0,195,199,5,29,0,0,196,198,3,30,15,0,197,196,1,0,0,
0,198,201,1,0,0,0,199,197,1,0,0,0,199,200,1,0,0,0,200,202,1,0,0,0,201,199,
1,0,0,0,202,203,5,30,0,0,203,29,1,0,0,0,204,209,3,32,16,0,205,206,3,36,18,
0,206,207,5,93,0,0,207,209,1,0,0,0,208,204,1,0,0,0,208,205,1,0,0,0,209,31,
1,0,0,0,210,211,5,2,0,0,211,212,3,38,19,0,212,214,5,3,0,0,213,215,3,34,17,
0,214,213,1,0,0,0,215,216,1,0,0,0,216,214,1,0,0,0,216,217,1,0,0,0,217,222,
1,0,0,0,218,219,5,43,0,0,219,220,3,36,18,0,220,221,5,93,0,0,221,223,1,0,
0,0,222,218,1,0,0,0,222,223,1,0,0,0,223,224,1,0,0,0,224,226,5,30,0,0,225,
227,5,93,0,0,226,225,1,0,0,0,226,227,1,0,0,0,227,33,1,0,0,0,228,229,3,38,
19,0,229,230,5,96,0,0,230,231,3,36,18,0,231,232,5,93,0,0,232,35,1,0,0,0,
233,234,5,4,0,0,234,235,3,38,19,0,235,37,1,0,0,0,236,242,3,40,20,0,237,242,
3,88,44,0,238,242,5,102,0,0,239,242,5,39,0,0,240,242,5,40,0,0,241,236,1,
0,0,0,241,237,1,0,0,0,241,238,1,0,0,0,241,239,1,0,0,0,241,240,1,0,0,0,242,
39,1,0,0,0,243,248,5,101,0,0,244,245,5,94,0,0,245,247,3,42,21,0,246,244,
1,0,0,0,247,250,1,0,0,0,248,246,1,0,0,0,248,249,1,0,0,0,249,41,1,0,0,0,250,
248,1,0,0,0,251,252,7,4,0,0,252,43,1,0,0,0,253,254,5,6,0,0,254,255,3,86,
43,0,255,256,5,93,0,0,256,45,1,0,0,0,257,258,5,7,0,0,258,260,3,86,43,0,259,
261,3,48,24,0,260,259,1,0,0,0,260,261,1,0,0,0,261,262,1,0,0,0,262,263,5,
93,0,0,263,47,1,0,0,0,264,265,5,8,0,0,265,267,5,102,0,0,266,268,3,50,25,
0,267,266,1,0,0,0,267,268,1,0,0,0,268,49,1,0,0,0,269,270,7,5,0,0,270,51,
1,0,0,0,271,272,5,12,0,0,272,273,3,86,43,0,273,274,5,81,0,0,274,275,3,54,
27,0,275,276,5,93,0,0,276,53,1,0,0,0,277,280,5,82,0,0,278,280,3,86,43,0,
279,277,1,0,0,0,279,278,1,0,0,0,280,55,1,0,0,0,281,282,5,13,0,0,282,285,
3,86,43,0,283,284,5,14,0,0,284,286,5,101,0,0,285,283,1,0,0,0,285,286,1,0,
0,0,286,287,1,0,0,0,287,288,5,93,0,0,288,57,1,0,0,0,289,290,5,15,0,0,290,
291,3,60,30,0,291,294,3,86,43,0,292,293,5,14,0,0,293,295,5,101,0,0,294,292,
1,0,0,0,294,295,1,0,0,0,295,296,1,0,0,0,296,297,5,93,0,0,297,59,1,0,0,0,
298,299,7,6,0,0,299,61,1,0,0,0,300,301,5,22,0,0,301,302,3,86,43,0,302,303,
5,24,0,0,303,307,3,88,44,0,304,306,3,64,32,0,305,304,1,0,0,0,306,309,1,0,
0,0,307,305,1,0,0,0,307,308,1,0,0,0,308,310,1,0,0,0,309,307,1,0,0,0,310,
314,5,29,0,0,311,313,3,68,34,0,312,311,1,0,0,0,313,316,1,0,0,0,314,312,1,
0,0,0,314,315,1,0,0,0,315,317,1,0,0,0,316,314,1,0,0,0,317,318,5,30,0,0,318,
319,5,93,0,0,319,63,1,0,0,0,320,321,5,27,0,0,321,329,3,88,44,0,322,323,5,
28,0,0,323,329,3,90,45,0,324,325,5,1,0,0,325,329,3,88,44,0,326,327,5,5,0,
0,327,329,3,66,33,0,328,320,1,0,0,0,328,322,1,0,0,0,328,324,1,0,0,0,328,
326,1,0,0,0,329,65,1,0,0,0,330,343,3,86,43,0,331,332,5,83,0,0,332,337,3,
86,43,0,333,334,5,92,0,0,334,336,3,86,43,0,335,333,1,0,0,0,336,339,1,0,0,
0,337,335,1,0,0,0,337,338,1,0,0,0,338,340,1,0,0,0,339,337,1,0,0,0,340,341,
5,84,0,0,341,343,1,0,0,0,342,330,1,0,0,0,342,331,1,0,0,0,343,67,1,0,0,0,
344,345,5,31,0,0,345,347,3,88,44,0,346,348,3,70,35,0,347,346,1,0,0,0,347,
348,1,0,0,0,348,349,1,0,0,0,349,350,5,34,0,0,350,351,3,92,46,0,351,352,5,
35,0,0,352,353,3,92,46,0,353,354,5,93,0,0,354,69,1,0,0,0,355,356,5,32,0,
0,356,360,3,82,41,0,357,358,5,33,0,0,358,360,3,80,40,0,359,355,1,0,0,0,359,
357,1,0,0,0,360,71,1,0,0,0,361,362,5,23,0,0,362,363,3,86,43,0,363,364,5,
25,0,0,364,365,3,82,41,0,365,366,5,26,0,0,366,370,3,82,41,0,367,369,3,74,
37,0,368,367,1,0,0,0,369,372,1,0,0,0,370,368,1,0,0,0,370,371,1,0,0,0,371,
373,1,0,0,0,372,370,1,0,0,0,373,377,5,29,0,0,374,376,3,76,38,0,375,374,1,
0,0,0,376,379,1,0,0,0,377,375,1,0,0,0,377,378,1,0,0,0,378,380,1,0,0,0,379,
377,1,0,0,0,380,381,5,30,0,0,381,382,5,93,0,0,382,73,1,0,0,0,383,384,5,27,
0,0,384,388,3,88,44,0,385,386,5,28,0,0,386,388,3,90,45,0,387,383,1,0,0,0,
387,385,1,0,0,0,388,75,1,0,0,0,389,390,5,36,0,0,390,391,3,88,44,0,391,392,
5,37,0,0,392,395,3,88,44,0,393,394,5,38,0,0,394,396,3,92,46,0,395,393,1,
0,0,0,395,396,1,0,0,0,396,397,1,0,0,0,397,398,5,93,0,0,398,77,1,0,0,0,399,
412,3,88,44,0,400,401,5,83,0,0,401,406,3,88,44,0,402,403,5,92,0,0,403,405,
3,88,44,0,404,402,1,0,0,0,405,408,1,0,0,0,406,404,1,0,0,0,406,407,1,0,0,
0,407,409,1,0,0,0,408,406,1,0,0,0,409,410,5,84,0,0,410,412,1,0,0,0,411,399,
1,0,0,0,411,400,1,0,0,0,412,79,1,0,0,0,413,426,3,82,41,0,414,415,5,83,0,
0,415,420,3,82,41,0,416,417,5,92,0,0,417,419,3,82,41,0,418,416,1,0,0,0,419,
422,1,0,0,0,420,418,1,0,0,0,420,421,1,0,0,0,421,423,1,0,0,0,422,420,1,0,
0,0,423,424,5,84,0,0,424,426,1,0,0,0,425,413,1,0,0,0,425,414,1,0,0,0,426,
81,1,0,0,0,427,429,3,86,43,0,428,430,3,84,42,0,429,428,1,0,0,0,429,430,1,
0,0,0,430,83,1,0,0,0,431,432,5,90,0,0,432,437,3,82,41,0,433,434,5,92,0,0,
434,436,3,82,41,0,435,433,1,0,0,0,436,439,1,0,0,0,437,435,1,0,0,0,437,438,
1,0,0,0,438,440,1,0,0,0,439,437,1,0,0,0,440,441,5,91,0,0,441,85,1,0,0,0,
442,445,3,88,44,0,443,445,5,101,0,0,444,442,1,0,0,0,444,443,1,0,0,0,445,
87,1,0,0,0,446,447,5,103,0,0,447,89,1,0,0,0,448,449,7,7,0,0,449,91,1,0,0,
0,450,453,5,103,0,0,451,453,3,94,47,0,452,450,1,0,0,0,452,451,1,0,0,0,453,
93,1,0,0,0,454,458,5,29,0,0,455,457,3,96,48,0,456,455,1,0,0,0,457,460,1,
0,0,0,458,456,1,0,0,0,458,459,1,0,0,0,459,461,1,0,0,0,460,458,1,0,0,0,461,
462,5,30,0,0,462,95,1,0,0,0,463,519,3,94,47,0,464,519,5,83,0,0,465,519,5,
84,0,0,466,519,5,85,0,0,467,519,5,86,0,0,468,519,5,87,0,0,469,519,5,88,0,
0,470,519,5,89,0,0,471,519,5,90,0,0,472,519,5,91,0,0,473,519,5,98,0,0,474,
519,5,99,0,0,475,519,5,100,0,0,476,519,5,92,0,0,477,519,5,93,0,0,478,519,
5,94,0,0,479,519,5,95,0,0,480,519,5,97,0,0,481,519,5,41,0,0,482,519,5,42,
0,0,483,519,5,43,0,0,484,519,5,44,0,0,485,519,5,45,0,0,486,519,5,46,0,0,
487,519,5,47,0,0,488,519,5,4,0,0,489,519,5,48,0,0,490,519,5,49,0,0,491,519,
5,50,0,0,492,519,5,51,0,0,493,519,5,52,0,0,494,519,5,53,0,0,495,519,5,54,
0,0,496,519,5,55,0,0,497,519,5,56,0,0,498,519,5,57,0,0,499,519,5,58,0,0,
500,519,5,9,0,0,501,519,5,10,0,0,502,519,5,11,0,0,503,519,5,59,0,0,504,519,
5,72,0,0,505,519,5,73,0,0,506,519,5,74,0,0,507,519,5,75,0,0,508,519,5,76,
0,0,509,519,5,77,0,0,510,519,5,78,0,0,511,519,5,79,0,0,512,519,5,39,0,0,
513,519,5,40,0,0,514,519,5,36,0,0,515,519,5,102,0,0,516,519,5,103,0,0,517,
519,5,101,0,0,518,463,1,0,0,0,518,464,1,0,0,0,518,465,1,0,0,0,518,466,1,
0,0,0,518,467,1,0,0,0,518,468,1,0,0,0,518,469,1,0,0,0,518,470,1,0,0,0,518,
471,1,0,0,0,518,472,1,0,0,0,518,473,1,0,0,0,518,474,1,0,0,0,518,475,1,0,
0,0,518,476,1,0,0,0,518,477,1,0,0,0,518,478,1,0,0,0,518,479,1,0,0,0,518,
480,1,0,0,0,518,481,1,0,0,0,518,482,1,0,0,0,518,483,1,0,0,0,518,484,1,0,
0,0,518,485,1,0,0,0,518,486,1,0,0,0,518,487,1,0,0,0,518,488,1,0,0,0,518,
489,1,0,0,0,518,490,1,0,0,0,518,491,1,0,0,0,518,492,1,0,0,0,518,493,1,0,
0,0,518,494,1,0,0,0,518,495,1,0,0,0,518,496,1,0,0,0,518,497,1,0,0,0,518,
498,1,0,0,0,518,499,1,0,0,0,518,500,1,0,0,0,518,501,1,0,0,0,518,502,1,0,
0,0,518,503,1,0,0,0,518,504,1,0,0,0,518,505,1,0,0,0,518,506,1,0,0,0,518,
507,1,0,0,0,518,508,1,0,0,0,518,509,1,0,0,0,518,510,1,0,0,0,518,511,1,0,
0,0,518,512,1,0,0,0,518,513,1,0,0,0,518,514,1,0,0,0,518,515,1,0,0,0,518,
516,1,0,0,0,518,517,1,0,0,0,519,97,1,0,0,0,46,101,116,126,132,137,144,152,
157,164,168,171,179,182,199,208,216,222,226,241,248,260,267,279,285,294,
307,314,328,337,342,347,359,370,377,387,395,406,411,420,425,429,437,444,
452,458,518];


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
                            "'ON'", "'LOCAL'", "'PARENT'", "'CHILD'", "'SIBLING'", 
                            "'ALTERNATE'", "'GET'", "'POST'", "'PUT'", "'DELETE'", 
                            "'PATCH'", "'ACCEPTS'", "'RETURNS'", "'ERROR'", 
                            "'FAIL'", "'TRANSACTION'", "'SUCCESS'", "'BACKOUT'", 
                            "'TRY'", "'CATCH'", "'ENDTRY'", "'VAR'", "'FROM'", 
                            "'LIBRARIAN'", "'('", "')'", "'+'", "'-'", "'*'", 
                            "'/'", "'='", "'<'", "'>'", "','", "';'", "'.'", 
                            "':='", "':'", "'||'", "'<='", "'>='", "'<>'" ];
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
                             "INTO", "ON", "LOCAL", "PARENT", "CHILD", "SIBLING", 
                             "ALTERNATE", "GET", "POST", "PUT", "DELETE", 
                             "PATCH", "ACCEPTS", "RETURNS", "ERROR", "FAIL", 
                             "TRANSACTION", "SUCCESS", "BACKOUT", "TRY", 
                             "CATCH", "ENDTRY", "VAR", "FROM", "LIBRARIAN", 
                             "LPAREN", "RPAREN", "PLUS", "MINUS", "MUL", 
                             "DIV", "EQ", "LT", "GT", "COMMA", "SEMICOLON", 
                             "DOT", "ASSIGN", "COLON", "CONCAT", "LE", "GE", 
                             "NEQ", "IDENT", "NUMBER", "STRING", "BRACE_COMMENT", 
                             "PAREN_COMMENT", "WS" ];
    static ruleNames = [ "program", "statement", "roleDecl", "roleName", 
                         "runtimeDecl", "blockStmt", "varDecl", "varSource", 
                         "serviceDecl", "placement", "serviceEndpoint", 
                         "httpVerb", "endpointAccepts", "endpointReturns", 
                         "serviceBody", "serviceStmt", "serviceCaseStmt", 
                         "serviceCaseArm", "serviceReturnStmt", "serviceExpr", 
                         "qualifiedIdent", "qualifiedPart", "programDecl", 
                         "daemonDecl", "daemonRefresh", "daemonRefreshUnit", 
                         "libraryDecl", "librarySource", "useDecl", "interopDecl", 
                         "interopKind", "routerDecl", "routerHeaderProp", 
                         "verbList", "outputDecl", "outputTypeMeta", "mapperDecl", 
                         "mapperHeaderProp", "mapDecl", "stringList", "typeRefList", 
                         "typeRef", "genericTypeArgs", "stringOrIdent", 
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
	        this.state = 101;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 549564610) !== 0) || _la===80) {
	            this.state = 98;
	            this.statement();
	            this.state = 103;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 104;
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
	        this.state = 116;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 106;
	            this.serviceDecl();
	            break;
	        case 6:
	        case 7:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 107;
	            this.runtimeDecl();
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 108;
	            this.roleDecl();
	            break;
	        case 80:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 109;
	            this.varDecl();
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 110;
	            this.libraryDecl();
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 111;
	            this.useDecl();
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 112;
	            this.interopDecl();
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 113;
	            this.routerDecl();
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 114;
	            this.mapperDecl();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 115;
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
	        this.state = 118;
	        this.match(PascalishRouterMapperParser.ROLE);
	        this.state = 119;
	        this.roleName();
	        this.state = 120;
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
	        this.state = 122;
	        _la = this._input.LA(1);
	        if(!(_la===17 || _la===101)) {
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
	        this.state = 126;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 6:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 124;
	            this.programDecl();
	            break;
	        case 7:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 125;
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
	        this.state = 128;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 132;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536874512) !== 0) || ((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 16777209) !== 0) || ((((_la - 72)) & ~0x1f) === 0 && ((1 << (_la - 72)) & 4278188287) !== 0)) {
	            this.state = 129;
	            this.pl0Element();
	            this.state = 134;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 135;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 137;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===93 || _la===94) {
	            this.state = 136;
	            _la = this._input.LA(1);
	            if(!(_la===93 || _la===94)) {
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
	        this.state = 139;
	        this.match(PascalishRouterMapperParser.VAR);
	        this.state = 140;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 141;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 142;
	        this.typeRef();
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===81) {
	            this.state = 143;
	            this.varSource();
	        }

	        this.state = 146;
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
	        this.state = 152;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,6,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 148;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 149;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 150;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 151;
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
	        this.state = 154;
	        this.match(PascalishRouterMapperParser.SERVICE);
	        this.state = 155;
	        this.stringOrIdent();
	        this.state = 157;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===59) {
	            this.state = 156;
	            this.placement();
	        }

	        this.state = 159;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	        this.state = 168;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 29:
	            this.state = 160;
	            this.serviceBody();
	            break;
	        case 30:
	        case 65:
	        case 66:
	        case 67:
	        case 68:
	        case 69:
	            this.state = 164;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 65)) & ~0x1f) === 0 && ((1 << (_la - 65)) & 31) !== 0)) {
	                this.state = 161;
	                this.serviceEndpoint();
	                this.state = 166;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 167;
	            this.match(PascalishRouterMapperParser.END);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 171;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===93 || _la===94) {
	            this.state = 170;
	            _la = this._input.LA(1);
	            if(!(_la===93 || _la===94)) {
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



	placement() {
	    let localctx = new PlacementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, PascalishRouterMapperParser.RULE_placement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 173;
	        this.match(PascalishRouterMapperParser.ON);
	        this.state = 174;
	        _la = this._input.LA(1);
	        if(!(((((_la - 60)) & ~0x1f) === 0 && ((1 << (_la - 60)) & 31) !== 0))) {
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



	serviceEndpoint() {
	    let localctx = new ServiceEndpointContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, PascalishRouterMapperParser.RULE_serviceEndpoint);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 176;
	        this.httpVerb();
	        this.state = 177;
	        this.stringValue();
	        this.state = 179;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===70) {
	            this.state = 178;
	            this.endpointAccepts();
	        }

	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===71) {
	            this.state = 181;
	            this.endpointReturns();
	        }

	        this.state = 184;
	        this.match(PascalishRouterMapperParser.SEMICOLON);
	        this.state = 185;
	        this.blockStmt();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	httpVerb() {
	    let localctx = new HttpVerbContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, PascalishRouterMapperParser.RULE_httpVerb);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 187;
	        _la = this._input.LA(1);
	        if(!(((((_la - 65)) & ~0x1f) === 0 && ((1 << (_la - 65)) & 31) !== 0))) {
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



	endpointAccepts() {
	    let localctx = new EndpointAcceptsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, PascalishRouterMapperParser.RULE_endpointAccepts);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 189;
	        this.match(PascalishRouterMapperParser.ACCEPTS);
	        this.state = 190;
	        this.typeRef();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	endpointReturns() {
	    let localctx = new EndpointReturnsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishRouterMapperParser.RULE_endpointReturns);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 192;
	        this.match(PascalishRouterMapperParser.RETURNS);
	        this.state = 193;
	        this.typeRef();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 28, PascalishRouterMapperParser.RULE_serviceBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 195;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 199;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===2 || _la===4) {
	            this.state = 196;
	            this.serviceStmt();
	            this.state = 201;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 202;
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
	    this.enterRule(localctx, 30, PascalishRouterMapperParser.RULE_serviceStmt);
	    try {
	        this.state = 208;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 2:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 204;
	            this.serviceCaseStmt();
	            break;
	        case 4:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 205;
	            this.serviceReturnStmt();
	            this.state = 206;
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
	    this.enterRule(localctx, 32, PascalishRouterMapperParser.RULE_serviceCaseStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 210;
	        this.match(PascalishRouterMapperParser.CASE);
	        this.state = 211;
	        this.serviceExpr();
	        this.state = 212;
	        this.match(PascalishRouterMapperParser.OF);
	        this.state = 214; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 213;
	            this.serviceCaseArm();
	            this.state = 216; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===39 || _la===40 || ((((_la - 101)) & ~0x1f) === 0 && ((1 << (_la - 101)) & 7) !== 0));
	        this.state = 222;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===43) {
	            this.state = 218;
	            this.match(PascalishRouterMapperParser.ELSE);
	            this.state = 219;
	            this.serviceReturnStmt();
	            this.state = 220;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	        }

	        this.state = 224;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 226;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===93) {
	            this.state = 225;
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
	    this.enterRule(localctx, 34, PascalishRouterMapperParser.RULE_serviceCaseArm);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 228;
	        this.serviceExpr();
	        this.state = 229;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 230;
	        this.serviceReturnStmt();
	        this.state = 231;
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
	    this.enterRule(localctx, 36, PascalishRouterMapperParser.RULE_serviceReturnStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 233;
	        this.match(PascalishRouterMapperParser.RETURN);
	        this.state = 234;
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
	    this.enterRule(localctx, 38, PascalishRouterMapperParser.RULE_serviceExpr);
	    try {
	        this.state = 241;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 101:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 236;
	            this.qualifiedIdent();
	            break;
	        case 103:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 237;
	            this.stringValue();
	            break;
	        case 102:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 238;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 239;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 240;
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
	    this.enterRule(localctx, 40, PascalishRouterMapperParser.RULE_qualifiedIdent);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 243;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 248;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===94) {
	            this.state = 244;
	            this.match(PascalishRouterMapperParser.DOT);
	            this.state = 245;
	            this.qualifiedPart();
	            this.state = 250;
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



	qualifiedPart() {
	    let localctx = new QualifiedPartContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, PascalishRouterMapperParser.RULE_qualifiedPart);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 251;
	        _la = this._input.LA(1);
	        if(!(((((_la - 65)) & ~0x1f) === 0 && ((1 << (_la - 65)) & 31) !== 0) || _la===101)) {
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



	programDecl() {
	    let localctx = new ProgramDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, PascalishRouterMapperParser.RULE_programDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 253;
	        this.match(PascalishRouterMapperParser.PROGRAM);
	        this.state = 254;
	        this.stringOrIdent();
	        this.state = 255;
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
	    this.enterRule(localctx, 46, PascalishRouterMapperParser.RULE_daemonDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 257;
	        this.match(PascalishRouterMapperParser.DAEMON);
	        this.state = 258;
	        this.stringOrIdent();
	        this.state = 260;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 259;
	            this.daemonRefresh();
	        }

	        this.state = 262;
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
	    this.enterRule(localctx, 48, PascalishRouterMapperParser.RULE_daemonRefresh);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 264;
	        this.match(PascalishRouterMapperParser.REFRESH);
	        this.state = 265;
	        this.match(PascalishRouterMapperParser.NUMBER);
	        this.state = 267;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 3584) !== 0)) {
	            this.state = 266;
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
	    this.enterRule(localctx, 50, PascalishRouterMapperParser.RULE_daemonRefreshUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 269;
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
	    this.enterRule(localctx, 52, PascalishRouterMapperParser.RULE_libraryDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 271;
	        this.match(PascalishRouterMapperParser.LIBRARY);
	        this.state = 272;
	        this.stringOrIdent();
	        this.state = 273;
	        this.match(PascalishRouterMapperParser.FROM);
	        this.state = 274;
	        this.librarySource();
	        this.state = 275;
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
	    this.enterRule(localctx, 54, PascalishRouterMapperParser.RULE_librarySource);
	    try {
	        this.state = 279;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 82:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 277;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;
	        case 101:
	        case 103:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 278;
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
	    this.enterRule(localctx, 56, PascalishRouterMapperParser.RULE_useDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 281;
	        this.match(PascalishRouterMapperParser.USE);
	        this.state = 282;
	        this.stringOrIdent();
	        this.state = 285;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===14) {
	            this.state = 283;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 284;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 287;
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
	    this.enterRule(localctx, 58, PascalishRouterMapperParser.RULE_interopDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 289;
	        this.match(PascalishRouterMapperParser.INTEROP);
	        this.state = 290;
	        this.interopKind();
	        this.state = 291;
	        this.stringOrIdent();
	        this.state = 294;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===14) {
	            this.state = 292;
	            this.match(PascalishRouterMapperParser.AS);
	            this.state = 293;
	            this.match(PascalishRouterMapperParser.IDENT);
	        }

	        this.state = 296;
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
	    this.enterRule(localctx, 60, PascalishRouterMapperParser.RULE_interopKind);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 298;
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
	    this.enterRule(localctx, 62, PascalishRouterMapperParser.RULE_routerDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 300;
	        this.match(PascalishRouterMapperParser.ROUTER);
	        this.state = 301;
	        this.stringOrIdent();
	        this.state = 302;
	        this.match(PascalishRouterMapperParser.INPUT);
	        this.state = 303;
	        this.stringValue();
	        this.state = 307;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 402653218) !== 0)) {
	            this.state = 304;
	            this.routerHeaderProp();
	            this.state = 309;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 310;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 314;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===31) {
	            this.state = 311;
	            this.outputDecl();
	            this.state = 316;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 317;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 318;
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
	    this.enterRule(localctx, 64, PascalishRouterMapperParser.RULE_routerHeaderProp);
	    try {
	        this.state = 328;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 27:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 320;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 321;
	            this.stringValue();
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 322;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 323;
	            this.booleanValue();
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 324;
	            this.match(PascalishRouterMapperParser.SERVICE);
	            this.state = 325;
	            this.stringValue();
	            break;
	        case 5:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 326;
	            this.match(PascalishRouterMapperParser.METHODS);
	            this.state = 327;
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
	    this.enterRule(localctx, 66, PascalishRouterMapperParser.RULE_verbList);
	    var _la = 0;
	    try {
	        this.state = 342;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 101:
	        case 103:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 330;
	            this.stringOrIdent();
	            break;
	        case 83:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 331;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 332;
	            this.stringOrIdent();
	            this.state = 337;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===92) {
	                this.state = 333;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 334;
	                this.stringOrIdent();
	                this.state = 339;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 340;
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
	    this.enterRule(localctx, 68, PascalishRouterMapperParser.RULE_outputDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 344;
	        this.match(PascalishRouterMapperParser.OUTPUT);
	        this.state = 345;
	        this.stringValue();
	        this.state = 347;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===32 || _la===33) {
	            this.state = 346;
	            this.outputTypeMeta();
	        }

	        this.state = 349;
	        this.match(PascalishRouterMapperParser.WHEN);
	        this.state = 350;
	        this.pl0Snippet();
	        this.state = 351;
	        this.match(PascalishRouterMapperParser.TRANSFORM);
	        this.state = 352;
	        this.pl0Snippet();
	        this.state = 353;
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
	    this.enterRule(localctx, 70, PascalishRouterMapperParser.RULE_outputTypeMeta);
	    try {
	        this.state = 359;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 32:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 355;
	            this.match(PascalishRouterMapperParser.TYPE);
	            this.state = 356;
	            this.typeRef();
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 357;
	            this.match(PascalishRouterMapperParser.TYPES);
	            this.state = 358;
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
	    this.enterRule(localctx, 72, PascalishRouterMapperParser.RULE_mapperDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 361;
	        this.match(PascalishRouterMapperParser.MAPPER);
	        this.state = 362;
	        this.stringOrIdent();
	        this.state = 363;
	        this.match(PascalishRouterMapperParser.SOURCE);
	        this.state = 364;
	        this.typeRef();
	        this.state = 365;
	        this.match(PascalishRouterMapperParser.TARGET);
	        this.state = 366;
	        this.typeRef();
	        this.state = 370;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===27 || _la===28) {
	            this.state = 367;
	            this.mapperHeaderProp();
	            this.state = 372;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 373;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 377;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===36) {
	            this.state = 374;
	            this.mapDecl();
	            this.state = 379;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 380;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 381;
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
	    this.enterRule(localctx, 74, PascalishRouterMapperParser.RULE_mapperHeaderProp);
	    try {
	        this.state = 387;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 27:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 383;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 384;
	            this.stringValue();
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 385;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 386;
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
	    this.enterRule(localctx, 76, PascalishRouterMapperParser.RULE_mapDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 389;
	        this.match(PascalishRouterMapperParser.MAP);
	        this.state = 390;
	        this.stringValue();
	        this.state = 391;
	        this.match(PascalishRouterMapperParser.TO);
	        this.state = 392;
	        this.stringValue();
	        this.state = 395;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===38) {
	            this.state = 393;
	            this.match(PascalishRouterMapperParser.USING);
	            this.state = 394;
	            this.pl0Snippet();
	        }

	        this.state = 397;
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
	    this.enterRule(localctx, 78, PascalishRouterMapperParser.RULE_stringList);
	    var _la = 0;
	    try {
	        this.state = 411;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 103:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 399;
	            this.stringValue();
	            break;
	        case 83:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 400;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 401;
	            this.stringValue();
	            this.state = 406;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===92) {
	                this.state = 402;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 403;
	                this.stringValue();
	                this.state = 408;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 409;
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
	    this.enterRule(localctx, 80, PascalishRouterMapperParser.RULE_typeRefList);
	    var _la = 0;
	    try {
	        this.state = 425;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 101:
	        case 103:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 413;
	            this.typeRef();
	            break;
	        case 83:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 414;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 415;
	            this.typeRef();
	            this.state = 420;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===92) {
	                this.state = 416;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 417;
	                this.typeRef();
	                this.state = 422;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 423;
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
	    this.enterRule(localctx, 82, PascalishRouterMapperParser.RULE_typeRef);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 427;
	        this.stringOrIdent();
	        this.state = 429;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===90) {
	            this.state = 428;
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
	    this.enterRule(localctx, 84, PascalishRouterMapperParser.RULE_genericTypeArgs);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 431;
	        this.match(PascalishRouterMapperParser.LT);
	        this.state = 432;
	        this.typeRef();
	        this.state = 437;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===92) {
	            this.state = 433;
	            this.match(PascalishRouterMapperParser.COMMA);
	            this.state = 434;
	            this.typeRef();
	            this.state = 439;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 440;
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
	    this.enterRule(localctx, 86, PascalishRouterMapperParser.RULE_stringOrIdent);
	    try {
	        this.state = 444;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 103:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 442;
	            this.stringValue();
	            break;
	        case 101:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 443;
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
	    this.enterRule(localctx, 88, PascalishRouterMapperParser.RULE_stringValue);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 446;
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
	    this.enterRule(localctx, 90, PascalishRouterMapperParser.RULE_booleanValue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 448;
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
	    this.enterRule(localctx, 92, PascalishRouterMapperParser.RULE_pl0Snippet);
	    try {
	        this.state = 452;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 103:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 450;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 451;
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
	    this.enterRule(localctx, 94, PascalishRouterMapperParser.RULE_pl0Block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 454;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 458;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536874512) !== 0) || ((((_la - 36)) & ~0x1f) === 0 && ((1 << (_la - 36)) & 16777209) !== 0) || ((((_la - 72)) & ~0x1f) === 0 && ((1 << (_la - 72)) & 4278188287) !== 0)) {
	            this.state = 455;
	            this.pl0Element();
	            this.state = 460;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 461;
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
	    this.enterRule(localctx, 96, PascalishRouterMapperParser.RULE_pl0Element);
	    try {
	        this.state = 518;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 29:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 463;
	            this.pl0Block();
	            break;
	        case 83:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 464;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            break;
	        case 84:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 465;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        case 85:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 466;
	            this.match(PascalishRouterMapperParser.PLUS);
	            break;
	        case 86:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 467;
	            this.match(PascalishRouterMapperParser.MINUS);
	            break;
	        case 87:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 468;
	            this.match(PascalishRouterMapperParser.MUL);
	            break;
	        case 88:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 469;
	            this.match(PascalishRouterMapperParser.DIV);
	            break;
	        case 89:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 470;
	            this.match(PascalishRouterMapperParser.EQ);
	            break;
	        case 90:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 471;
	            this.match(PascalishRouterMapperParser.LT);
	            break;
	        case 91:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 472;
	            this.match(PascalishRouterMapperParser.GT);
	            break;
	        case 98:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 473;
	            this.match(PascalishRouterMapperParser.LE);
	            break;
	        case 99:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 474;
	            this.match(PascalishRouterMapperParser.GE);
	            break;
	        case 100:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 475;
	            this.match(PascalishRouterMapperParser.NEQ);
	            break;
	        case 92:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 476;
	            this.match(PascalishRouterMapperParser.COMMA);
	            break;
	        case 93:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 477;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	            break;
	        case 94:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 478;
	            this.match(PascalishRouterMapperParser.DOT);
	            break;
	        case 95:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 479;
	            this.match(PascalishRouterMapperParser.ASSIGN);
	            break;
	        case 97:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 480;
	            this.match(PascalishRouterMapperParser.CONCAT);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 481;
	            this.match(PascalishRouterMapperParser.IF);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 482;
	            this.match(PascalishRouterMapperParser.THEN);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 483;
	            this.match(PascalishRouterMapperParser.ELSE);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 484;
	            this.match(PascalishRouterMapperParser.WHILE);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 485;
	            this.match(PascalishRouterMapperParser.DO);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 486;
	            this.match(PascalishRouterMapperParser.FOR);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 487;
	            this.match(PascalishRouterMapperParser.CALL);
	            break;
	        case 4:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 488;
	            this.match(PascalishRouterMapperParser.RETURN);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 489;
	            this.match(PascalishRouterMapperParser.NOT);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 490;
	            this.match(PascalishRouterMapperParser.COBEGIN);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 491;
	            this.match(PascalishRouterMapperParser.COEND);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 492;
	            this.match(PascalishRouterMapperParser.SUBFLOW);
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 493;
	            this.match(PascalishRouterMapperParser.SYNC);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 494;
	            this.match(PascalishRouterMapperParser.ASYNC);
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 495;
	            this.match(PascalishRouterMapperParser.WAIT);
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 496;
	            this.match(PascalishRouterMapperParser.ALL);
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 497;
	            this.match(PascalishRouterMapperParser.WITH);
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 498;
	            this.match(PascalishRouterMapperParser.TIMEOUT);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 499;
	            this.match(PascalishRouterMapperParser.INTO);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 500;
	            this.match(PascalishRouterMapperParser.MS);
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 501;
	            this.match(PascalishRouterMapperParser.S);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 502;
	            this.match(PascalishRouterMapperParser.M);
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 503;
	            this.match(PascalishRouterMapperParser.ON);
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 504;
	            this.match(PascalishRouterMapperParser.ERROR);
	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 43);
	            this.state = 505;
	            this.match(PascalishRouterMapperParser.FAIL);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 44);
	            this.state = 506;
	            this.match(PascalishRouterMapperParser.TRANSACTION);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 45);
	            this.state = 507;
	            this.match(PascalishRouterMapperParser.SUCCESS);
	            break;
	        case 76:
	            this.enterOuterAlt(localctx, 46);
	            this.state = 508;
	            this.match(PascalishRouterMapperParser.BACKOUT);
	            break;
	        case 77:
	            this.enterOuterAlt(localctx, 47);
	            this.state = 509;
	            this.match(PascalishRouterMapperParser.TRY);
	            break;
	        case 78:
	            this.enterOuterAlt(localctx, 48);
	            this.state = 510;
	            this.match(PascalishRouterMapperParser.CATCH);
	            break;
	        case 79:
	            this.enterOuterAlt(localctx, 49);
	            this.state = 511;
	            this.match(PascalishRouterMapperParser.ENDTRY);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 50);
	            this.state = 512;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 51);
	            this.state = 513;
	            this.match(PascalishRouterMapperParser.FALSE);
	            break;
	        case 36:
	            this.enterOuterAlt(localctx, 52);
	            this.state = 514;
	            this.match(PascalishRouterMapperParser.MAP);
	            break;
	        case 102:
	            this.enterOuterAlt(localctx, 53);
	            this.state = 515;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 103:
	            this.enterOuterAlt(localctx, 54);
	            this.state = 516;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 101:
	            this.enterOuterAlt(localctx, 55);
	            this.state = 517;
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
PascalishRouterMapperParser.LOCAL = 60;
PascalishRouterMapperParser.PARENT = 61;
PascalishRouterMapperParser.CHILD = 62;
PascalishRouterMapperParser.SIBLING = 63;
PascalishRouterMapperParser.ALTERNATE = 64;
PascalishRouterMapperParser.GET = 65;
PascalishRouterMapperParser.POST = 66;
PascalishRouterMapperParser.PUT = 67;
PascalishRouterMapperParser.DELETE = 68;
PascalishRouterMapperParser.PATCH = 69;
PascalishRouterMapperParser.ACCEPTS = 70;
PascalishRouterMapperParser.RETURNS = 71;
PascalishRouterMapperParser.ERROR = 72;
PascalishRouterMapperParser.FAIL = 73;
PascalishRouterMapperParser.TRANSACTION = 74;
PascalishRouterMapperParser.SUCCESS = 75;
PascalishRouterMapperParser.BACKOUT = 76;
PascalishRouterMapperParser.TRY = 77;
PascalishRouterMapperParser.CATCH = 78;
PascalishRouterMapperParser.ENDTRY = 79;
PascalishRouterMapperParser.VAR = 80;
PascalishRouterMapperParser.FROM = 81;
PascalishRouterMapperParser.LIBRARIAN = 82;
PascalishRouterMapperParser.LPAREN = 83;
PascalishRouterMapperParser.RPAREN = 84;
PascalishRouterMapperParser.PLUS = 85;
PascalishRouterMapperParser.MINUS = 86;
PascalishRouterMapperParser.MUL = 87;
PascalishRouterMapperParser.DIV = 88;
PascalishRouterMapperParser.EQ = 89;
PascalishRouterMapperParser.LT = 90;
PascalishRouterMapperParser.GT = 91;
PascalishRouterMapperParser.COMMA = 92;
PascalishRouterMapperParser.SEMICOLON = 93;
PascalishRouterMapperParser.DOT = 94;
PascalishRouterMapperParser.ASSIGN = 95;
PascalishRouterMapperParser.COLON = 96;
PascalishRouterMapperParser.CONCAT = 97;
PascalishRouterMapperParser.LE = 98;
PascalishRouterMapperParser.GE = 99;
PascalishRouterMapperParser.NEQ = 100;
PascalishRouterMapperParser.IDENT = 101;
PascalishRouterMapperParser.NUMBER = 102;
PascalishRouterMapperParser.STRING = 103;
PascalishRouterMapperParser.BRACE_COMMENT = 104;
PascalishRouterMapperParser.PAREN_COMMENT = 105;
PascalishRouterMapperParser.WS = 106;

PascalishRouterMapperParser.RULE_program = 0;
PascalishRouterMapperParser.RULE_statement = 1;
PascalishRouterMapperParser.RULE_roleDecl = 2;
PascalishRouterMapperParser.RULE_roleName = 3;
PascalishRouterMapperParser.RULE_runtimeDecl = 4;
PascalishRouterMapperParser.RULE_blockStmt = 5;
PascalishRouterMapperParser.RULE_varDecl = 6;
PascalishRouterMapperParser.RULE_varSource = 7;
PascalishRouterMapperParser.RULE_serviceDecl = 8;
PascalishRouterMapperParser.RULE_placement = 9;
PascalishRouterMapperParser.RULE_serviceEndpoint = 10;
PascalishRouterMapperParser.RULE_httpVerb = 11;
PascalishRouterMapperParser.RULE_endpointAccepts = 12;
PascalishRouterMapperParser.RULE_endpointReturns = 13;
PascalishRouterMapperParser.RULE_serviceBody = 14;
PascalishRouterMapperParser.RULE_serviceStmt = 15;
PascalishRouterMapperParser.RULE_serviceCaseStmt = 16;
PascalishRouterMapperParser.RULE_serviceCaseArm = 17;
PascalishRouterMapperParser.RULE_serviceReturnStmt = 18;
PascalishRouterMapperParser.RULE_serviceExpr = 19;
PascalishRouterMapperParser.RULE_qualifiedIdent = 20;
PascalishRouterMapperParser.RULE_qualifiedPart = 21;
PascalishRouterMapperParser.RULE_programDecl = 22;
PascalishRouterMapperParser.RULE_daemonDecl = 23;
PascalishRouterMapperParser.RULE_daemonRefresh = 24;
PascalishRouterMapperParser.RULE_daemonRefreshUnit = 25;
PascalishRouterMapperParser.RULE_libraryDecl = 26;
PascalishRouterMapperParser.RULE_librarySource = 27;
PascalishRouterMapperParser.RULE_useDecl = 28;
PascalishRouterMapperParser.RULE_interopDecl = 29;
PascalishRouterMapperParser.RULE_interopKind = 30;
PascalishRouterMapperParser.RULE_routerDecl = 31;
PascalishRouterMapperParser.RULE_routerHeaderProp = 32;
PascalishRouterMapperParser.RULE_verbList = 33;
PascalishRouterMapperParser.RULE_outputDecl = 34;
PascalishRouterMapperParser.RULE_outputTypeMeta = 35;
PascalishRouterMapperParser.RULE_mapperDecl = 36;
PascalishRouterMapperParser.RULE_mapperHeaderProp = 37;
PascalishRouterMapperParser.RULE_mapDecl = 38;
PascalishRouterMapperParser.RULE_stringList = 39;
PascalishRouterMapperParser.RULE_typeRefList = 40;
PascalishRouterMapperParser.RULE_typeRef = 41;
PascalishRouterMapperParser.RULE_genericTypeArgs = 42;
PascalishRouterMapperParser.RULE_stringOrIdent = 43;
PascalishRouterMapperParser.RULE_stringValue = 44;
PascalishRouterMapperParser.RULE_booleanValue = 45;
PascalishRouterMapperParser.RULE_pl0Snippet = 46;
PascalishRouterMapperParser.RULE_pl0Block = 47;
PascalishRouterMapperParser.RULE_pl0Element = 48;

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

	END() {
	    return this.getToken(PascalishRouterMapperParser.END, 0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	DOT() {
	    return this.getToken(PascalishRouterMapperParser.DOT, 0);
	};

	serviceEndpoint = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ServiceEndpointContext);
	    } else {
	        return this.getTypedRuleContext(ServiceEndpointContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceDecl(this);
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
        this.ruleIndex = PascalishRouterMapperParser.RULE_placement;
    }

	ON() {
	    return this.getToken(PascalishRouterMapperParser.ON, 0);
	};

	LOCAL() {
	    return this.getToken(PascalishRouterMapperParser.LOCAL, 0);
	};

	PARENT() {
	    return this.getToken(PascalishRouterMapperParser.PARENT, 0);
	};

	CHILD() {
	    return this.getToken(PascalishRouterMapperParser.CHILD, 0);
	};

	SIBLING() {
	    return this.getToken(PascalishRouterMapperParser.SIBLING, 0);
	};

	ALTERNATE() {
	    return this.getToken(PascalishRouterMapperParser.ALTERNATE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitPlacement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ServiceEndpointContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_serviceEndpoint;
    }

	httpVerb() {
	    return this.getTypedRuleContext(HttpVerbContext,0);
	};

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	blockStmt() {
	    return this.getTypedRuleContext(BlockStmtContext,0);
	};

	endpointAccepts() {
	    return this.getTypedRuleContext(EndpointAcceptsContext,0);
	};

	endpointReturns() {
	    return this.getTypedRuleContext(EndpointReturnsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceEndpoint(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class HttpVerbContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_httpVerb;
    }

	GET() {
	    return this.getToken(PascalishRouterMapperParser.GET, 0);
	};

	POST() {
	    return this.getToken(PascalishRouterMapperParser.POST, 0);
	};

	PUT() {
	    return this.getToken(PascalishRouterMapperParser.PUT, 0);
	};

	DELETE() {
	    return this.getToken(PascalishRouterMapperParser.DELETE, 0);
	};

	PATCH() {
	    return this.getToken(PascalishRouterMapperParser.PATCH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitHttpVerb(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EndpointAcceptsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_endpointAccepts;
    }

	ACCEPTS() {
	    return this.getToken(PascalishRouterMapperParser.ACCEPTS, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitEndpointAccepts(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EndpointReturnsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_endpointReturns;
    }

	RETURNS() {
	    return this.getToken(PascalishRouterMapperParser.RETURNS, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitEndpointReturns(this);
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

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
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


	qualifiedPart = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QualifiedPartContext);
	    } else {
	        return this.getTypedRuleContext(QualifiedPartContext,i);
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



class QualifiedPartContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishRouterMapperParser.RULE_qualifiedPart;
    }

	IDENT() {
	    return this.getToken(PascalishRouterMapperParser.IDENT, 0);
	};

	GET() {
	    return this.getToken(PascalishRouterMapperParser.GET, 0);
	};

	POST() {
	    return this.getToken(PascalishRouterMapperParser.POST, 0);
	};

	PUT() {
	    return this.getToken(PascalishRouterMapperParser.PUT, 0);
	};

	DELETE() {
	    return this.getToken(PascalishRouterMapperParser.DELETE, 0);
	};

	PATCH() {
	    return this.getToken(PascalishRouterMapperParser.PATCH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitQualifiedPart(this);
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

	MAP() {
	    return this.getToken(PascalishRouterMapperParser.MAP, 0);
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
PascalishRouterMapperParser.PlacementContext = PlacementContext; 
PascalishRouterMapperParser.ServiceEndpointContext = ServiceEndpointContext; 
PascalishRouterMapperParser.HttpVerbContext = HttpVerbContext; 
PascalishRouterMapperParser.EndpointAcceptsContext = EndpointAcceptsContext; 
PascalishRouterMapperParser.EndpointReturnsContext = EndpointReturnsContext; 
PascalishRouterMapperParser.ServiceBodyContext = ServiceBodyContext; 
PascalishRouterMapperParser.ServiceStmtContext = ServiceStmtContext; 
PascalishRouterMapperParser.ServiceCaseStmtContext = ServiceCaseStmtContext; 
PascalishRouterMapperParser.ServiceCaseArmContext = ServiceCaseArmContext; 
PascalishRouterMapperParser.ServiceReturnStmtContext = ServiceReturnStmtContext; 
PascalishRouterMapperParser.ServiceExprContext = ServiceExprContext; 
PascalishRouterMapperParser.QualifiedIdentContext = QualifiedIdentContext; 
PascalishRouterMapperParser.QualifiedPartContext = QualifiedPartContext; 
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
