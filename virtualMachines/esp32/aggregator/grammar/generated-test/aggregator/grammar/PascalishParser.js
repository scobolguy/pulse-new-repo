// Generated from ./aggregator/grammar/Pascalish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishVisitor from './PascalishVisitor.js';

const serializedATN = [4,1,89,570,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,2,48,7,48,2,
49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,2,53,7,53,1,0,5,0,110,8,0,10,0,12,
0,113,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,124,8,1,1,2,1,2,1,2,1,
3,1,3,1,3,3,3,132,8,3,1,3,1,3,1,3,1,3,1,4,1,4,1,4,3,4,141,8,4,1,4,1,4,1,
4,1,4,1,4,1,5,5,5,149,8,5,10,5,12,5,152,9,5,1,6,1,6,1,6,3,6,157,8,6,1,6,
1,6,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,7,3,7,171,8,7,1,8,1,8,1,8,1,8,
1,8,1,8,1,9,1,9,1,9,1,9,1,9,3,9,184,8,9,1,9,1,9,1,10,1,10,1,10,1,10,1,10,
3,10,193,8,10,1,10,1,10,1,11,1,11,1,11,1,11,3,11,201,8,11,1,11,1,11,1,12,
1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,3,12,219,
8,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,
13,3,13,235,8,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
1,14,1,14,1,14,3,14,251,8,14,1,15,1,15,5,15,255,8,15,10,15,12,15,258,9,15,
1,15,1,15,1,16,1,16,1,16,1,16,1,16,1,17,1,17,1,17,1,17,1,17,1,17,1,17,1,
17,3,17,275,8,17,1,18,1,18,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,1,20,
1,20,1,20,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,22,1,22,5,22,299,8,22,10,
22,12,22,302,9,22,1,22,1,22,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,
1,23,1,23,1,23,1,23,1,23,3,23,320,8,23,1,24,1,24,1,24,1,24,1,24,1,25,1,25,
1,25,1,25,3,25,331,8,25,1,25,1,25,1,25,1,26,1,26,1,26,1,26,5,26,340,8,26,
10,26,12,26,343,9,26,1,26,1,26,5,26,347,8,26,10,26,12,26,350,9,26,3,26,352,
8,26,1,26,1,26,1,26,1,27,1,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,
28,1,28,1,28,1,28,1,29,1,29,5,29,373,8,29,10,29,12,29,376,9,29,1,29,1,29,
1,29,1,29,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,
32,1,32,1,32,1,32,1,32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,34,1,34,1,34,
1,34,1,34,1,34,1,35,1,35,1,35,1,35,1,35,3,35,417,8,35,1,36,1,36,5,36,421,
8,36,10,36,12,36,424,9,36,1,36,1,36,1,36,1,37,1,37,1,37,1,38,1,38,1,38,1,
38,1,38,1,38,3,38,438,8,38,1,39,1,39,1,39,1,39,1,40,1,40,1,40,1,40,3,40,
448,8,40,1,40,1,40,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,
1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,41,3,41,471,8,41,1,42,1,42,1,42,5,42,
476,8,42,10,42,12,42,479,9,42,1,43,1,43,1,43,5,43,484,8,43,10,43,12,43,487,
9,43,1,44,1,44,1,44,5,44,492,8,44,10,44,12,44,495,9,44,1,45,1,45,1,46,1,
46,1,46,5,46,502,8,46,10,46,12,46,505,9,46,1,47,1,47,1,47,5,47,510,8,47,
10,47,12,47,513,9,47,1,48,1,48,1,48,5,48,518,8,48,10,48,12,48,521,9,48,1,
49,1,49,1,49,5,49,526,8,49,10,49,12,49,529,9,49,1,50,1,50,1,50,5,50,534,
8,50,10,50,12,50,537,9,50,1,51,1,51,1,51,5,51,542,8,51,10,51,12,51,545,9,
51,1,52,1,52,1,52,3,52,550,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,
559,8,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,568,8,53,1,53,0,0,54,0,
2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,
102,104,106,0,9,1,0,2,6,2,0,14,14,16,17,1,0,33,36,1,0,67,68,2,0,19,19,73,
73,2,0,28,29,74,75,1,0,76,77,1,0,78,80,2,0,77,77,81,81,587,0,111,1,0,0,0,
2,123,1,0,0,0,4,125,1,0,0,0,6,128,1,0,0,0,8,137,1,0,0,0,10,150,1,0,0,0,12,
153,1,0,0,0,14,170,1,0,0,0,16,172,1,0,0,0,18,178,1,0,0,0,20,187,1,0,0,0,
22,196,1,0,0,0,24,218,1,0,0,0,26,234,1,0,0,0,28,250,1,0,0,0,30,252,1,0,0,
0,32,261,1,0,0,0,34,274,1,0,0,0,36,276,1,0,0,0,38,278,1,0,0,0,40,280,1,0,
0,0,42,289,1,0,0,0,44,296,1,0,0,0,46,319,1,0,0,0,48,321,1,0,0,0,50,326,1,
0,0,0,52,335,1,0,0,0,54,356,1,0,0,0,56,361,1,0,0,0,58,370,1,0,0,0,60,381,
1,0,0,0,62,387,1,0,0,0,64,393,1,0,0,0,66,399,1,0,0,0,68,405,1,0,0,0,70,416,
1,0,0,0,72,418,1,0,0,0,74,428,1,0,0,0,76,437,1,0,0,0,78,439,1,0,0,0,80,443,
1,0,0,0,82,470,1,0,0,0,84,472,1,0,0,0,86,480,1,0,0,0,88,488,1,0,0,0,90,496,
1,0,0,0,92,498,1,0,0,0,94,506,1,0,0,0,96,514,1,0,0,0,98,522,1,0,0,0,100,
530,1,0,0,0,102,538,1,0,0,0,104,549,1,0,0,0,106,567,1,0,0,0,108,110,3,2,
1,0,109,108,1,0,0,0,110,113,1,0,0,0,111,109,1,0,0,0,111,112,1,0,0,0,112,
114,1,0,0,0,113,111,1,0,0,0,114,115,5,0,0,1,115,1,1,0,0,0,116,124,3,6,3,
0,117,124,3,8,4,0,118,124,3,12,6,0,119,124,3,16,8,0,120,124,3,18,9,0,121,
124,3,22,11,0,122,124,3,20,10,0,123,116,1,0,0,0,123,117,1,0,0,0,123,118,
1,0,0,0,123,119,1,0,0,0,123,120,1,0,0,0,123,121,1,0,0,0,123,122,1,0,0,0,
124,3,1,0,0,0,125,126,5,1,0,0,126,127,7,0,0,0,127,5,1,0,0,0,128,129,5,7,
0,0,129,131,5,84,0,0,130,132,3,4,2,0,131,130,1,0,0,0,131,132,1,0,0,0,132,
133,1,0,0,0,133,134,5,8,0,0,134,135,3,44,22,0,135,136,5,9,0,0,136,7,1,0,
0,0,137,138,5,10,0,0,138,140,5,84,0,0,139,141,3,4,2,0,140,139,1,0,0,0,140,
141,1,0,0,0,141,142,1,0,0,0,142,143,5,8,0,0,143,144,3,10,5,0,144,145,5,11,
0,0,145,146,5,8,0,0,146,9,1,0,0,0,147,149,3,46,23,0,148,147,1,0,0,0,149,
152,1,0,0,0,150,148,1,0,0,0,150,151,1,0,0,0,151,11,1,0,0,0,152,150,1,0,0,
0,153,154,5,12,0,0,154,156,5,84,0,0,155,157,3,4,2,0,156,155,1,0,0,0,156,
157,1,0,0,0,157,158,1,0,0,0,158,159,3,14,7,0,159,160,5,8,0,0,160,161,3,44,
22,0,161,13,1,0,0,0,162,163,5,13,0,0,163,164,3,90,45,0,164,165,5,14,0,0,
165,171,1,0,0,0,166,167,5,15,0,0,167,168,3,90,45,0,168,169,7,1,0,0,169,171,
1,0,0,0,170,162,1,0,0,0,170,166,1,0,0,0,171,15,1,0,0,0,172,173,5,18,0,0,
173,174,5,84,0,0,174,175,5,19,0,0,175,176,3,34,17,0,176,177,5,8,0,0,177,
17,1,0,0,0,178,179,5,20,0,0,179,180,5,84,0,0,180,181,5,21,0,0,181,183,3,
34,17,0,182,184,3,4,2,0,183,182,1,0,0,0,183,184,1,0,0,0,184,185,1,0,0,0,
185,186,5,8,0,0,186,19,1,0,0,0,187,188,5,22,0,0,188,189,5,84,0,0,189,190,
5,23,0,0,190,192,3,34,17,0,191,193,3,4,2,0,192,191,1,0,0,0,192,193,1,0,0,
0,193,194,1,0,0,0,194,195,5,8,0,0,195,21,1,0,0,0,196,197,5,24,0,0,197,198,
5,84,0,0,198,200,3,24,12,0,199,201,3,4,2,0,200,199,1,0,0,0,200,201,1,0,0,
0,201,202,1,0,0,0,202,203,5,8,0,0,203,23,1,0,0,0,204,205,5,24,0,0,205,206,
5,25,0,0,206,207,3,90,45,0,207,208,5,26,0,0,208,209,3,90,45,0,209,210,5,
27,0,0,210,211,5,23,0,0,211,212,3,34,17,0,212,219,1,0,0,0,213,214,5,24,0,
0,214,215,5,28,0,0,215,216,3,34,17,0,216,217,5,29,0,0,217,219,1,0,0,0,218,
204,1,0,0,0,218,213,1,0,0,0,219,25,1,0,0,0,220,221,5,30,0,0,221,222,5,25,
0,0,222,223,3,90,45,0,223,224,5,26,0,0,224,225,3,90,45,0,225,226,5,27,0,
0,226,227,5,23,0,0,227,228,3,34,17,0,228,235,1,0,0,0,229,230,5,30,0,0,230,
231,5,28,0,0,231,232,3,34,17,0,232,233,5,29,0,0,233,235,1,0,0,0,234,220,
1,0,0,0,234,229,1,0,0,0,235,27,1,0,0,0,236,237,5,31,0,0,237,238,5,25,0,0,
238,239,3,90,45,0,239,240,5,26,0,0,240,241,3,90,45,0,241,242,5,27,0,0,242,
243,5,23,0,0,243,244,3,34,17,0,244,251,1,0,0,0,245,246,5,31,0,0,246,247,
5,28,0,0,247,248,3,34,17,0,248,249,5,29,0,0,249,251,1,0,0,0,250,236,1,0,
0,0,250,245,1,0,0,0,251,29,1,0,0,0,252,256,5,32,0,0,253,255,3,32,16,0,254,
253,1,0,0,0,255,258,1,0,0,0,256,254,1,0,0,0,256,257,1,0,0,0,257,259,1,0,
0,0,258,256,1,0,0,0,259,260,5,11,0,0,260,31,1,0,0,0,261,262,5,84,0,0,262,
263,5,21,0,0,263,264,3,34,17,0,264,265,5,8,0,0,265,33,1,0,0,0,266,275,3,
36,18,0,267,275,3,30,15,0,268,275,3,24,12,0,269,275,3,26,13,0,270,275,3,
28,14,0,271,275,3,40,20,0,272,275,3,42,21,0,273,275,3,38,19,0,274,266,1,
0,0,0,274,267,1,0,0,0,274,268,1,0,0,0,274,269,1,0,0,0,274,270,1,0,0,0,274,
271,1,0,0,0,274,272,1,0,0,0,274,273,1,0,0,0,275,35,1,0,0,0,276,277,7,2,0,
0,277,37,1,0,0,0,278,279,5,84,0,0,279,39,1,0,0,0,280,281,5,37,0,0,281,282,
5,25,0,0,282,283,3,90,45,0,283,284,5,26,0,0,284,285,3,90,45,0,285,286,5,
27,0,0,286,287,5,23,0,0,287,288,3,34,17,0,288,41,1,0,0,0,289,290,5,37,0,
0,290,291,5,28,0,0,291,292,3,34,17,0,292,293,5,29,0,0,293,294,5,23,0,0,294,
295,3,34,17,0,295,43,1,0,0,0,296,300,5,38,0,0,297,299,3,46,23,0,298,297,
1,0,0,0,299,302,1,0,0,0,300,298,1,0,0,0,300,301,1,0,0,0,301,303,1,0,0,0,
302,300,1,0,0,0,303,304,5,11,0,0,304,45,1,0,0,0,305,320,3,48,24,0,306,320,
3,50,25,0,307,320,3,52,26,0,308,320,3,54,27,0,309,320,3,56,28,0,310,320,
3,58,29,0,311,320,3,44,22,0,312,320,3,60,30,0,313,320,3,62,31,0,314,320,
3,64,32,0,315,320,3,66,33,0,316,320,3,68,34,0,317,320,3,70,35,0,318,320,
3,82,41,0,319,305,1,0,0,0,319,306,1,0,0,0,319,307,1,0,0,0,319,308,1,0,0,
0,319,309,1,0,0,0,319,310,1,0,0,0,319,311,1,0,0,0,319,312,1,0,0,0,319,313,
1,0,0,0,319,314,1,0,0,0,319,315,1,0,0,0,319,316,1,0,0,0,319,317,1,0,0,0,
319,318,1,0,0,0,320,47,1,0,0,0,321,322,3,84,42,0,322,323,5,39,0,0,323,324,
3,90,45,0,324,325,5,8,0,0,325,49,1,0,0,0,326,327,5,40,0,0,327,328,3,86,43,
0,328,330,5,41,0,0,329,331,3,88,44,0,330,329,1,0,0,0,330,331,1,0,0,0,331,
332,1,0,0,0,332,333,5,42,0,0,333,334,5,8,0,0,334,51,1,0,0,0,335,336,5,43,
0,0,336,337,3,90,45,0,337,341,5,44,0,0,338,340,3,46,23,0,339,338,1,0,0,0,
340,343,1,0,0,0,341,339,1,0,0,0,341,342,1,0,0,0,342,351,1,0,0,0,343,341,
1,0,0,0,344,348,5,45,0,0,345,347,3,46,23,0,346,345,1,0,0,0,347,350,1,0,0,
0,348,346,1,0,0,0,348,349,1,0,0,0,349,352,1,0,0,0,350,348,1,0,0,0,351,344,
1,0,0,0,351,352,1,0,0,0,352,353,1,0,0,0,353,354,5,11,0,0,354,355,5,8,0,0,
355,53,1,0,0,0,356,357,5,46,0,0,357,358,3,90,45,0,358,359,5,47,0,0,359,360,
3,46,23,0,360,55,1,0,0,0,361,362,5,48,0,0,362,363,5,84,0,0,363,364,5,39,
0,0,364,365,3,90,45,0,365,366,5,49,0,0,366,367,3,90,45,0,367,368,5,47,0,
0,368,369,3,46,23,0,369,57,1,0,0,0,370,374,5,50,0,0,371,373,3,46,23,0,372,
371,1,0,0,0,373,376,1,0,0,0,374,372,1,0,0,0,374,375,1,0,0,0,375,377,1,0,
0,0,376,374,1,0,0,0,377,378,5,51,0,0,378,379,3,90,45,0,379,380,5,8,0,0,380,
59,1,0,0,0,381,382,5,52,0,0,382,383,5,84,0,0,383,384,5,53,0,0,384,385,3,
90,45,0,385,386,5,8,0,0,386,61,1,0,0,0,387,388,5,54,0,0,388,389,5,84,0,0,
389,390,5,55,0,0,390,391,5,84,0,0,391,392,5,8,0,0,392,63,1,0,0,0,393,394,
5,56,0,0,394,395,5,84,0,0,395,396,5,55,0,0,396,397,5,84,0,0,397,398,5,8,
0,0,398,65,1,0,0,0,399,400,5,57,0,0,400,401,5,84,0,0,401,402,5,53,0,0,402,
403,3,90,45,0,403,404,5,8,0,0,404,67,1,0,0,0,405,406,5,58,0,0,406,407,5,
84,0,0,407,408,5,55,0,0,408,409,5,84,0,0,409,410,5,8,0,0,410,69,1,0,0,0,
411,417,3,72,36,0,412,417,3,74,37,0,413,417,3,76,38,0,414,417,3,78,39,0,
415,417,3,80,40,0,416,411,1,0,0,0,416,412,1,0,0,0,416,413,1,0,0,0,416,414,
1,0,0,0,416,415,1,0,0,0,417,71,1,0,0,0,418,422,5,59,0,0,419,421,3,46,23,
0,420,419,1,0,0,0,421,424,1,0,0,0,422,420,1,0,0,0,422,423,1,0,0,0,423,425,
1,0,0,0,424,422,1,0,0,0,425,426,5,60,0,0,426,427,5,8,0,0,427,73,1,0,0,0,
428,429,5,61,0,0,429,430,3,46,23,0,430,75,1,0,0,0,431,432,5,62,0,0,432,433,
5,63,0,0,433,438,5,8,0,0,434,435,5,62,0,0,435,436,5,84,0,0,436,438,5,8,0,
0,437,431,1,0,0,0,437,434,1,0,0,0,438,77,1,0,0,0,439,440,5,64,0,0,440,441,
5,84,0,0,441,442,5,8,0,0,442,79,1,0,0,0,443,444,5,65,0,0,444,447,5,86,0,
0,445,446,5,53,0,0,446,448,3,88,44,0,447,445,1,0,0,0,447,448,1,0,0,0,448,
449,1,0,0,0,449,450,5,8,0,0,450,81,1,0,0,0,451,452,5,66,0,0,452,453,5,84,
0,0,453,454,5,48,0,0,454,455,7,3,0,0,455,471,5,8,0,0,456,457,5,67,0,0,457,
458,5,84,0,0,458,459,5,55,0,0,459,460,5,84,0,0,460,471,5,8,0,0,461,462,5,
68,0,0,462,463,5,84,0,0,463,464,5,53,0,0,464,465,3,90,45,0,465,466,5,8,0,
0,466,471,1,0,0,0,467,468,5,69,0,0,468,469,5,84,0,0,469,471,5,8,0,0,470,
451,1,0,0,0,470,456,1,0,0,0,470,461,1,0,0,0,470,467,1,0,0,0,471,83,1,0,0,
0,472,477,5,84,0,0,473,474,5,9,0,0,474,476,5,84,0,0,475,473,1,0,0,0,476,
479,1,0,0,0,477,475,1,0,0,0,477,478,1,0,0,0,478,85,1,0,0,0,479,477,1,0,0,
0,480,485,5,84,0,0,481,482,5,9,0,0,482,484,5,84,0,0,483,481,1,0,0,0,484,
487,1,0,0,0,485,483,1,0,0,0,485,486,1,0,0,0,486,87,1,0,0,0,487,485,1,0,0,
0,488,493,3,90,45,0,489,490,5,70,0,0,490,492,3,90,45,0,491,489,1,0,0,0,492,
495,1,0,0,0,493,491,1,0,0,0,493,494,1,0,0,0,494,89,1,0,0,0,495,493,1,0,0,
0,496,497,3,92,46,0,497,91,1,0,0,0,498,503,3,94,47,0,499,500,5,71,0,0,500,
502,3,94,47,0,501,499,1,0,0,0,502,505,1,0,0,0,503,501,1,0,0,0,503,504,1,
0,0,0,504,93,1,0,0,0,505,503,1,0,0,0,506,511,3,96,48,0,507,508,5,72,0,0,
508,510,3,96,48,0,509,507,1,0,0,0,510,513,1,0,0,0,511,509,1,0,0,0,511,512,
1,0,0,0,512,95,1,0,0,0,513,511,1,0,0,0,514,519,3,98,49,0,515,516,7,4,0,0,
516,518,3,98,49,0,517,515,1,0,0,0,518,521,1,0,0,0,519,517,1,0,0,0,519,520,
1,0,0,0,520,97,1,0,0,0,521,519,1,0,0,0,522,527,3,100,50,0,523,524,7,5,0,
0,524,526,3,100,50,0,525,523,1,0,0,0,526,529,1,0,0,0,527,525,1,0,0,0,527,
528,1,0,0,0,528,99,1,0,0,0,529,527,1,0,0,0,530,535,3,102,51,0,531,532,7,
6,0,0,532,534,3,102,51,0,533,531,1,0,0,0,534,537,1,0,0,0,535,533,1,0,0,0,
535,536,1,0,0,0,536,101,1,0,0,0,537,535,1,0,0,0,538,543,3,104,52,0,539,540,
7,7,0,0,540,542,3,104,52,0,541,539,1,0,0,0,542,545,1,0,0,0,543,541,1,0,0,
0,543,544,1,0,0,0,544,103,1,0,0,0,545,543,1,0,0,0,546,547,7,8,0,0,547,550,
3,104,52,0,548,550,3,106,53,0,549,546,1,0,0,0,549,548,1,0,0,0,550,105,1,
0,0,0,551,568,5,85,0,0,552,568,5,86,0,0,553,568,5,82,0,0,554,568,5,83,0,
0,555,556,3,86,43,0,556,558,5,41,0,0,557,559,3,88,44,0,558,557,1,0,0,0,558,
559,1,0,0,0,559,560,1,0,0,0,560,561,5,42,0,0,561,568,1,0,0,0,562,568,3,84,
42,0,563,564,5,41,0,0,564,565,3,90,45,0,565,566,5,42,0,0,566,568,1,0,0,0,
567,551,1,0,0,0,567,552,1,0,0,0,567,553,1,0,0,0,567,554,1,0,0,0,567,555,
1,0,0,0,567,562,1,0,0,0,567,563,1,0,0,0,568,107,1,0,0,0,39,111,123,131,140,
150,156,170,183,192,200,218,234,250,256,274,300,319,330,341,348,351,374,
416,422,437,447,470,477,485,493,503,511,519,527,535,543,549,558,567];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class PascalishParser extends antlr4.Parser {

    static grammarFileName = "Pascalish.g4";
    static literalNames = [ null, "'on'", "'local'", "'parent'", "'child'", 
                            "'sibling'", "'alternate'", "'program'", "';'", 
                            "'.'", "'service'", "'end'", "'daemon'", "'refresh'", 
                            "'ms'", "'every'", "'second'", "'seconds'", 
                            "'type'", "'='", "'var'", "':'", "'file'", "'of'", 
                            "'queue'", "'['", "'..'", "']'", "'<'", "'>'", 
                            "'stack'", "'priorityqueue'", "'record'", "'integer'", 
                            "'real'", "'boolean'", "'string'", "'array'", 
                            "'begin'", "':='", "'call'", "'('", "')'", "'if'", 
                            "'then'", "'else'", "'while'", "'do'", "'for'", 
                            "'to'", "'repeat'", "'until'", "'enqueue'", 
                            "'with'", "'dequeue'", "'into'", "'peek'", "'push'", 
                            "'pop'", "'cobegin'", "'coend'", "'async'", 
                            "'wait'", "'all'", "'sync'", "'subflow'", "'open'", 
                            "'read'", "'write'", "'close'", "','", "'or'", 
                            "'and'", "'<>'", "'<='", "'>='", "'+'", "'-'", 
                            "'*'", "'/'", "'mod'", "'not'", "'true'", "'false'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, "IDENT", "NUMBER", 
                             "STRING", "LINE_COMMENT", "BLOCK_COMMENT", 
                             "WS" ];
    static ruleNames = [ "compilationUnit", "decl", "placement", "programDecl", 
                         "serviceDecl", "serviceBody", "daemonDecl", "daemonSchedule", 
                         "typeDecl", "varDecl", "fileDecl", "queueDecl", 
                         "queueType", "stackType", "priorityQueueType", 
                         "recordType", "recordField", "typeRef", "simpleType", 
                         "userType", "fixedArrayType", "dynamicArrayType", 
                         "block", "statement", "assignStmt", "callStmt", 
                         "ifStmt", "whileStmt", "forStmt", "repeatStmt", 
                         "enqueueStmt", "dequeueStmt", "peekStmt", "pushStmt", 
                         "popStmt", "concurrentStmt", "cobeginStmt", "asyncStmt", 
                         "waitStmt", "syncStmt", "subflowStmt", "fileStmt", 
                         "lvalue", "qualifiedName", "exprList", "expr", 
                         "logicalOrExpr", "logicalAndExpr", "equalityExpr", 
                         "relationalExpr", "additiveExpr", "multiplicativeExpr", 
                         "unaryExpr", "primaryExpr" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = PascalishParser.ruleNames;
        this.literalNames = PascalishParser.literalNames;
        this.symbolicNames = PascalishParser.symbolicNames;
    }



	compilationUnit() {
	    let localctx = new CompilationUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, PascalishParser.RULE_compilationUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 111;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 22287488) !== 0)) {
	            this.state = 108;
	            this.decl();
	            this.state = 113;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 114;
	        this.match(PascalishParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	decl() {
	    let localctx = new DeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, PascalishParser.RULE_decl);
	    try {
	        this.state = 123;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 116;
	            this.programDecl();
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 117;
	            this.serviceDecl();
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 118;
	            this.daemonDecl();
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 119;
	            this.typeDecl();
	            break;
	        case 20:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 120;
	            this.varDecl();
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 121;
	            this.queueDecl();
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 122;
	            this.fileDecl();
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



	placement() {
	    let localctx = new PlacementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, PascalishParser.RULE_placement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 125;
	        this.match(PascalishParser.T__0);
	        this.state = 126;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 124) !== 0))) {
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
	    this.enterRule(localctx, 6, PascalishParser.RULE_programDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 128;
	        this.match(PascalishParser.T__6);
	        this.state = 129;
	        this.match(PascalishParser.IDENT);
	        this.state = 131;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 130;
	            this.placement();
	        }

	        this.state = 133;
	        this.match(PascalishParser.T__7);
	        this.state = 134;
	        this.block();
	        this.state = 135;
	        this.match(PascalishParser.T__8);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 8, PascalishParser.RULE_serviceDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 137;
	        this.match(PascalishParser.T__9);
	        this.state = 138;
	        this.match(PascalishParser.IDENT);
	        this.state = 140;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 139;
	            this.placement();
	        }

	        this.state = 142;
	        this.match(PascalishParser.T__7);
	        this.state = 143;
	        this.serviceBody();
	        this.state = 144;
	        this.match(PascalishParser.T__10);
	        this.state = 145;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 10, PascalishParser.RULE_serviceBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 150;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	            this.state = 147;
	            this.statement();
	            this.state = 152;
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



	daemonDecl() {
	    let localctx = new DaemonDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, PascalishParser.RULE_daemonDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 153;
	        this.match(PascalishParser.T__11);
	        this.state = 154;
	        this.match(PascalishParser.IDENT);
	        this.state = 156;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 155;
	            this.placement();
	        }

	        this.state = 158;
	        this.daemonSchedule();
	        this.state = 159;
	        this.match(PascalishParser.T__7);
	        this.state = 160;
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



	daemonSchedule() {
	    let localctx = new DaemonScheduleContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, PascalishParser.RULE_daemonSchedule);
	    var _la = 0;
	    try {
	        this.state = 170;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 13:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 162;
	            this.match(PascalishParser.T__12);
	            this.state = 163;
	            this.expr();
	            this.state = 164;
	            this.match(PascalishParser.T__13);
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 166;
	            this.match(PascalishParser.T__14);
	            this.state = 167;
	            this.expr();
	            this.state = 168;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 212992) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
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



	typeDecl() {
	    let localctx = new TypeDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, PascalishParser.RULE_typeDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 172;
	        this.match(PascalishParser.T__17);
	        this.state = 173;
	        this.match(PascalishParser.IDENT);
	        this.state = 174;
	        this.match(PascalishParser.T__18);
	        this.state = 175;
	        this.typeRef();
	        this.state = 176;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 18, PascalishParser.RULE_varDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 178;
	        this.match(PascalishParser.T__19);
	        this.state = 179;
	        this.match(PascalishParser.IDENT);
	        this.state = 180;
	        this.match(PascalishParser.T__20);
	        this.state = 181;
	        this.typeRef();
	        this.state = 183;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 182;
	            this.placement();
	        }

	        this.state = 185;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 20, PascalishParser.RULE_fileDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 187;
	        this.match(PascalishParser.T__21);
	        this.state = 188;
	        this.match(PascalishParser.IDENT);
	        this.state = 189;
	        this.match(PascalishParser.T__22);
	        this.state = 190;
	        this.typeRef();
	        this.state = 192;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 191;
	            this.placement();
	        }

	        this.state = 194;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 22, PascalishParser.RULE_queueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 196;
	        this.match(PascalishParser.T__23);
	        this.state = 197;
	        this.match(PascalishParser.IDENT);
	        this.state = 198;
	        this.queueType();
	        this.state = 200;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 199;
	            this.placement();
	        }

	        this.state = 202;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	queueType() {
	    let localctx = new QueueTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, PascalishParser.RULE_queueType);
	    try {
	        this.state = 218;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 204;
	            this.match(PascalishParser.T__23);
	            this.state = 205;
	            this.match(PascalishParser.T__24);
	            this.state = 206;
	            this.expr();
	            this.state = 207;
	            this.match(PascalishParser.T__25);
	            this.state = 208;
	            this.expr();
	            this.state = 209;
	            this.match(PascalishParser.T__26);
	            this.state = 210;
	            this.match(PascalishParser.T__22);
	            this.state = 211;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 213;
	            this.match(PascalishParser.T__23);
	            this.state = 214;
	            this.match(PascalishParser.T__27);
	            this.state = 215;
	            this.typeRef();
	            this.state = 216;
	            this.match(PascalishParser.T__28);
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



	stackType() {
	    let localctx = new StackTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishParser.RULE_stackType);
	    try {
	        this.state = 234;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,11,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 220;
	            this.match(PascalishParser.T__29);
	            this.state = 221;
	            this.match(PascalishParser.T__24);
	            this.state = 222;
	            this.expr();
	            this.state = 223;
	            this.match(PascalishParser.T__25);
	            this.state = 224;
	            this.expr();
	            this.state = 225;
	            this.match(PascalishParser.T__26);
	            this.state = 226;
	            this.match(PascalishParser.T__22);
	            this.state = 227;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 229;
	            this.match(PascalishParser.T__29);
	            this.state = 230;
	            this.match(PascalishParser.T__27);
	            this.state = 231;
	            this.typeRef();
	            this.state = 232;
	            this.match(PascalishParser.T__28);
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



	priorityQueueType() {
	    let localctx = new PriorityQueueTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, PascalishParser.RULE_priorityQueueType);
	    try {
	        this.state = 250;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,12,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 236;
	            this.match(PascalishParser.T__30);
	            this.state = 237;
	            this.match(PascalishParser.T__24);
	            this.state = 238;
	            this.expr();
	            this.state = 239;
	            this.match(PascalishParser.T__25);
	            this.state = 240;
	            this.expr();
	            this.state = 241;
	            this.match(PascalishParser.T__26);
	            this.state = 242;
	            this.match(PascalishParser.T__22);
	            this.state = 243;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 245;
	            this.match(PascalishParser.T__30);
	            this.state = 246;
	            this.match(PascalishParser.T__27);
	            this.state = 247;
	            this.typeRef();
	            this.state = 248;
	            this.match(PascalishParser.T__28);
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



	recordType() {
	    let localctx = new RecordTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, PascalishParser.RULE_recordType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 252;
	        this.match(PascalishParser.T__31);
	        this.state = 256;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===84) {
	            this.state = 253;
	            this.recordField();
	            this.state = 258;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 259;
	        this.match(PascalishParser.T__10);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	recordField() {
	    let localctx = new RecordFieldContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, PascalishParser.RULE_recordField);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 261;
	        this.match(PascalishParser.IDENT);
	        this.state = 262;
	        this.match(PascalishParser.T__20);
	        this.state = 263;
	        this.typeRef();
	        this.state = 264;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 34, PascalishParser.RULE_typeRef);
	    try {
	        this.state = 274;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,14,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 266;
	            this.simpleType();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 267;
	            this.recordType();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 268;
	            this.queueType();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 269;
	            this.stackType();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 270;
	            this.priorityQueueType();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 271;
	            this.fixedArrayType();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 272;
	            this.dynamicArrayType();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 273;
	            this.userType();
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



	simpleType() {
	    let localctx = new SimpleTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, PascalishParser.RULE_simpleType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 276;
	        _la = this._input.LA(1);
	        if(!(((((_la - 33)) & ~0x1f) === 0 && ((1 << (_la - 33)) & 15) !== 0))) {
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



	userType() {
	    let localctx = new UserTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, PascalishParser.RULE_userType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 278;
	        this.match(PascalishParser.IDENT);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	fixedArrayType() {
	    let localctx = new FixedArrayTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, PascalishParser.RULE_fixedArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 280;
	        this.match(PascalishParser.T__36);
	        this.state = 281;
	        this.match(PascalishParser.T__24);
	        this.state = 282;
	        this.expr();
	        this.state = 283;
	        this.match(PascalishParser.T__25);
	        this.state = 284;
	        this.expr();
	        this.state = 285;
	        this.match(PascalishParser.T__26);
	        this.state = 286;
	        this.match(PascalishParser.T__22);
	        this.state = 287;
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



	dynamicArrayType() {
	    let localctx = new DynamicArrayTypeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, PascalishParser.RULE_dynamicArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 289;
	        this.match(PascalishParser.T__36);
	        this.state = 290;
	        this.match(PascalishParser.T__27);
	        this.state = 291;
	        this.typeRef();
	        this.state = 292;
	        this.match(PascalishParser.T__28);
	        this.state = 293;
	        this.match(PascalishParser.T__22);
	        this.state = 294;
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



	block() {
	    let localctx = new BlockContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, PascalishParser.RULE_block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 296;
	        this.match(PascalishParser.T__37);
	        this.state = 300;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	            this.state = 297;
	            this.statement();
	            this.state = 302;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 303;
	        this.match(PascalishParser.T__10);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 46, PascalishParser.RULE_statement);
	    try {
	        this.state = 319;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 84:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 305;
	            this.assignStmt();
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 306;
	            this.callStmt();
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 307;
	            this.ifStmt();
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 308;
	            this.whileStmt();
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 309;
	            this.forStmt();
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 310;
	            this.repeatStmt();
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 311;
	            this.block();
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 312;
	            this.enqueueStmt();
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 313;
	            this.dequeueStmt();
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 314;
	            this.peekStmt();
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 315;
	            this.pushStmt();
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 316;
	            this.popStmt();
	            break;
	        case 59:
	        case 61:
	        case 62:
	        case 64:
	        case 65:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 317;
	            this.concurrentStmt();
	            break;
	        case 66:
	        case 67:
	        case 68:
	        case 69:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 318;
	            this.fileStmt();
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



	assignStmt() {
	    let localctx = new AssignStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 48, PascalishParser.RULE_assignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 321;
	        this.lvalue();
	        this.state = 322;
	        this.match(PascalishParser.T__38);
	        this.state = 323;
	        this.expr();
	        this.state = 324;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	callStmt() {
	    let localctx = new CallStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, PascalishParser.RULE_callStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 326;
	        this.match(PascalishParser.T__39);
	        this.state = 327;
	        this.qualifiedName();
	        this.state = 328;
	        this.match(PascalishParser.T__40);
	        this.state = 330;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===41 || ((((_la - 77)) & ~0x1f) === 0 && ((1 << (_la - 77)) & 1009) !== 0)) {
	            this.state = 329;
	            this.exprList();
	        }

	        this.state = 332;
	        this.match(PascalishParser.T__41);
	        this.state = 333;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 52, PascalishParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 335;
	        this.match(PascalishParser.T__42);
	        this.state = 336;
	        this.expr();
	        this.state = 337;
	        this.match(PascalishParser.T__43);
	        this.state = 341;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	            this.state = 338;
	            this.statement();
	            this.state = 343;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 351;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===45) {
	            this.state = 344;
	            this.match(PascalishParser.T__44);
	            this.state = 348;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	                this.state = 345;
	                this.statement();
	                this.state = 350;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 353;
	        this.match(PascalishParser.T__10);
	        this.state = 354;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	whileStmt() {
	    let localctx = new WhileStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, PascalishParser.RULE_whileStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 356;
	        this.match(PascalishParser.T__45);
	        this.state = 357;
	        this.expr();
	        this.state = 358;
	        this.match(PascalishParser.T__46);
	        this.state = 359;
	        this.statement();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	forStmt() {
	    let localctx = new ForStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, PascalishParser.RULE_forStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 361;
	        this.match(PascalishParser.T__47);
	        this.state = 362;
	        this.match(PascalishParser.IDENT);
	        this.state = 363;
	        this.match(PascalishParser.T__38);
	        this.state = 364;
	        this.expr();
	        this.state = 365;
	        this.match(PascalishParser.T__48);
	        this.state = 366;
	        this.expr();
	        this.state = 367;
	        this.match(PascalishParser.T__46);
	        this.state = 368;
	        this.statement();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	repeatStmt() {
	    let localctx = new RepeatStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 58, PascalishParser.RULE_repeatStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 370;
	        this.match(PascalishParser.T__49);
	        this.state = 374;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	            this.state = 371;
	            this.statement();
	            this.state = 376;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 377;
	        this.match(PascalishParser.T__50);
	        this.state = 378;
	        this.expr();
	        this.state = 379;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	enqueueStmt() {
	    let localctx = new EnqueueStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 60, PascalishParser.RULE_enqueueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 381;
	        this.match(PascalishParser.T__51);
	        this.state = 382;
	        this.match(PascalishParser.IDENT);
	        this.state = 383;
	        this.match(PascalishParser.T__52);
	        this.state = 384;
	        this.expr();
	        this.state = 385;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	dequeueStmt() {
	    let localctx = new DequeueStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 62, PascalishParser.RULE_dequeueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 387;
	        this.match(PascalishParser.T__53);
	        this.state = 388;
	        this.match(PascalishParser.IDENT);
	        this.state = 389;
	        this.match(PascalishParser.T__54);
	        this.state = 390;
	        this.match(PascalishParser.IDENT);
	        this.state = 391;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	peekStmt() {
	    let localctx = new PeekStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 64, PascalishParser.RULE_peekStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 393;
	        this.match(PascalishParser.T__55);
	        this.state = 394;
	        this.match(PascalishParser.IDENT);
	        this.state = 395;
	        this.match(PascalishParser.T__54);
	        this.state = 396;
	        this.match(PascalishParser.IDENT);
	        this.state = 397;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	pushStmt() {
	    let localctx = new PushStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 66, PascalishParser.RULE_pushStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 399;
	        this.match(PascalishParser.T__56);
	        this.state = 400;
	        this.match(PascalishParser.IDENT);
	        this.state = 401;
	        this.match(PascalishParser.T__52);
	        this.state = 402;
	        this.expr();
	        this.state = 403;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	popStmt() {
	    let localctx = new PopStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 68, PascalishParser.RULE_popStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 405;
	        this.match(PascalishParser.T__57);
	        this.state = 406;
	        this.match(PascalishParser.IDENT);
	        this.state = 407;
	        this.match(PascalishParser.T__54);
	        this.state = 408;
	        this.match(PascalishParser.IDENT);
	        this.state = 409;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	concurrentStmt() {
	    let localctx = new ConcurrentStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 70, PascalishParser.RULE_concurrentStmt);
	    try {
	        this.state = 416;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 59:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 411;
	            this.cobeginStmt();
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 412;
	            this.asyncStmt();
	            break;
	        case 62:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 413;
	            this.waitStmt();
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 414;
	            this.syncStmt();
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 415;
	            this.subflowStmt();
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
	    this.enterRule(localctx, 72, PascalishParser.RULE_cobeginStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 418;
	        this.match(PascalishParser.T__58);
	        this.state = 422;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 38)) & ~0x1f) === 0 && ((1 << (_la - 38)) & 4257043749) !== 0) || _la===84) {
	            this.state = 419;
	            this.statement();
	            this.state = 424;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 425;
	        this.match(PascalishParser.T__59);
	        this.state = 426;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	asyncStmt() {
	    let localctx = new AsyncStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 74, PascalishParser.RULE_asyncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 428;
	        this.match(PascalishParser.T__60);
	        this.state = 429;
	        this.statement();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	waitStmt() {
	    let localctx = new WaitStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 76, PascalishParser.RULE_waitStmt);
	    try {
	        this.state = 437;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,24,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 431;
	            this.match(PascalishParser.T__61);
	            this.state = 432;
	            this.match(PascalishParser.T__62);
	            this.state = 433;
	            this.match(PascalishParser.T__7);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 434;
	            this.match(PascalishParser.T__61);
	            this.state = 435;
	            this.match(PascalishParser.IDENT);
	            this.state = 436;
	            this.match(PascalishParser.T__7);
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



	syncStmt() {
	    let localctx = new SyncStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 78, PascalishParser.RULE_syncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 439;
	        this.match(PascalishParser.T__63);
	        this.state = 440;
	        this.match(PascalishParser.IDENT);
	        this.state = 441;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	subflowStmt() {
	    let localctx = new SubflowStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 80, PascalishParser.RULE_subflowStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 443;
	        this.match(PascalishParser.T__64);
	        this.state = 444;
	        this.match(PascalishParser.STRING);
	        this.state = 447;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 445;
	            this.match(PascalishParser.T__52);
	            this.state = 446;
	            this.exprList();
	        }

	        this.state = 449;
	        this.match(PascalishParser.T__7);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	fileStmt() {
	    let localctx = new FileStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 82, PascalishParser.RULE_fileStmt);
	    var _la = 0;
	    try {
	        this.state = 470;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 66:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 451;
	            this.match(PascalishParser.T__65);
	            this.state = 452;
	            this.match(PascalishParser.IDENT);
	            this.state = 453;
	            this.match(PascalishParser.T__47);
	            this.state = 454;
	            _la = this._input.LA(1);
	            if(!(_la===67 || _la===68)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 455;
	            this.match(PascalishParser.T__7);
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 456;
	            this.match(PascalishParser.T__66);
	            this.state = 457;
	            this.match(PascalishParser.IDENT);
	            this.state = 458;
	            this.match(PascalishParser.T__54);
	            this.state = 459;
	            this.match(PascalishParser.IDENT);
	            this.state = 460;
	            this.match(PascalishParser.T__7);
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 461;
	            this.match(PascalishParser.T__67);
	            this.state = 462;
	            this.match(PascalishParser.IDENT);
	            this.state = 463;
	            this.match(PascalishParser.T__52);
	            this.state = 464;
	            this.expr();
	            this.state = 465;
	            this.match(PascalishParser.T__7);
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 467;
	            this.match(PascalishParser.T__68);
	            this.state = 468;
	            this.match(PascalishParser.IDENT);
	            this.state = 469;
	            this.match(PascalishParser.T__7);
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



	lvalue() {
	    let localctx = new LvalueContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 84, PascalishParser.RULE_lvalue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 472;
	        this.match(PascalishParser.IDENT);
	        this.state = 477;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 473;
	            this.match(PascalishParser.T__8);
	            this.state = 474;
	            this.match(PascalishParser.IDENT);
	            this.state = 479;
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



	qualifiedName() {
	    let localctx = new QualifiedNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 86, PascalishParser.RULE_qualifiedName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 480;
	        this.match(PascalishParser.IDENT);
	        this.state = 485;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 481;
	            this.match(PascalishParser.T__8);
	            this.state = 482;
	            this.match(PascalishParser.IDENT);
	            this.state = 487;
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



	exprList() {
	    let localctx = new ExprListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 88, PascalishParser.RULE_exprList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 488;
	        this.expr();
	        this.state = 493;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===70) {
	            this.state = 489;
	            this.match(PascalishParser.T__69);
	            this.state = 490;
	            this.expr();
	            this.state = 495;
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



	expr() {
	    let localctx = new ExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 90, PascalishParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 496;
	        this.logicalOrExpr();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	logicalOrExpr() {
	    let localctx = new LogicalOrExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 92, PascalishParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 498;
	        this.logicalAndExpr();
	        this.state = 503;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===71) {
	            this.state = 499;
	            this.match(PascalishParser.T__70);
	            this.state = 500;
	            this.logicalAndExpr();
	            this.state = 505;
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



	logicalAndExpr() {
	    let localctx = new LogicalAndExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 94, PascalishParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 506;
	        this.equalityExpr();
	        this.state = 511;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===72) {
	            this.state = 507;
	            this.match(PascalishParser.T__71);
	            this.state = 508;
	            this.equalityExpr();
	            this.state = 513;
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



	equalityExpr() {
	    let localctx = new EqualityExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 96, PascalishParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 514;
	        this.relationalExpr();
	        this.state = 519;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===19 || _la===73) {
	            this.state = 515;
	            _la = this._input.LA(1);
	            if(!(_la===19 || _la===73)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 516;
	            this.relationalExpr();
	            this.state = 521;
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



	relationalExpr() {
	    let localctx = new RelationalExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 98, PascalishParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 522;
	        this.additiveExpr();
	        this.state = 527;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===28 || _la===29 || _la===74 || _la===75) {
	            this.state = 523;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29 || _la===74 || _la===75)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 524;
	            this.additiveExpr();
	            this.state = 529;
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



	additiveExpr() {
	    let localctx = new AdditiveExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 100, PascalishParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 530;
	        this.multiplicativeExpr();
	        this.state = 535;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===76 || _la===77) {
	            this.state = 531;
	            _la = this._input.LA(1);
	            if(!(_la===76 || _la===77)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 532;
	            this.multiplicativeExpr();
	            this.state = 537;
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



	multiplicativeExpr() {
	    let localctx = new MultiplicativeExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 102, PascalishParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 538;
	        this.unaryExpr();
	        this.state = 543;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 78)) & ~0x1f) === 0 && ((1 << (_la - 78)) & 7) !== 0)) {
	            this.state = 539;
	            _la = this._input.LA(1);
	            if(!(((((_la - 78)) & ~0x1f) === 0 && ((1 << (_la - 78)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 540;
	            this.unaryExpr();
	            this.state = 545;
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



	unaryExpr() {
	    let localctx = new UnaryExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 104, PascalishParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 549;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 77:
	        case 81:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 546;
	            _la = this._input.LA(1);
	            if(!(_la===77 || _la===81)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 547;
	            this.unaryExpr();
	            break;
	        case 41:
	        case 82:
	        case 83:
	        case 84:
	        case 85:
	        case 86:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 548;
	            this.primaryExpr();
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



	primaryExpr() {
	    let localctx = new PrimaryExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 106, PascalishParser.RULE_primaryExpr);
	    var _la = 0;
	    try {
	        this.state = 567;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,38,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 551;
	            this.match(PascalishParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 552;
	            this.match(PascalishParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 553;
	            this.match(PascalishParser.T__81);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 554;
	            this.match(PascalishParser.T__82);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 555;
	            this.qualifiedName();
	            this.state = 556;
	            this.match(PascalishParser.T__40);
	            this.state = 558;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===41 || ((((_la - 77)) & ~0x1f) === 0 && ((1 << (_la - 77)) & 1009) !== 0)) {
	                this.state = 557;
	                this.exprList();
	            }

	            this.state = 560;
	            this.match(PascalishParser.T__41);
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 562;
	            this.lvalue();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 563;
	            this.match(PascalishParser.T__40);
	            this.state = 564;
	            this.expr();
	            this.state = 565;
	            this.match(PascalishParser.T__41);
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


}

PascalishParser.EOF = antlr4.Token.EOF;
PascalishParser.T__0 = 1;
PascalishParser.T__1 = 2;
PascalishParser.T__2 = 3;
PascalishParser.T__3 = 4;
PascalishParser.T__4 = 5;
PascalishParser.T__5 = 6;
PascalishParser.T__6 = 7;
PascalishParser.T__7 = 8;
PascalishParser.T__8 = 9;
PascalishParser.T__9 = 10;
PascalishParser.T__10 = 11;
PascalishParser.T__11 = 12;
PascalishParser.T__12 = 13;
PascalishParser.T__13 = 14;
PascalishParser.T__14 = 15;
PascalishParser.T__15 = 16;
PascalishParser.T__16 = 17;
PascalishParser.T__17 = 18;
PascalishParser.T__18 = 19;
PascalishParser.T__19 = 20;
PascalishParser.T__20 = 21;
PascalishParser.T__21 = 22;
PascalishParser.T__22 = 23;
PascalishParser.T__23 = 24;
PascalishParser.T__24 = 25;
PascalishParser.T__25 = 26;
PascalishParser.T__26 = 27;
PascalishParser.T__27 = 28;
PascalishParser.T__28 = 29;
PascalishParser.T__29 = 30;
PascalishParser.T__30 = 31;
PascalishParser.T__31 = 32;
PascalishParser.T__32 = 33;
PascalishParser.T__33 = 34;
PascalishParser.T__34 = 35;
PascalishParser.T__35 = 36;
PascalishParser.T__36 = 37;
PascalishParser.T__37 = 38;
PascalishParser.T__38 = 39;
PascalishParser.T__39 = 40;
PascalishParser.T__40 = 41;
PascalishParser.T__41 = 42;
PascalishParser.T__42 = 43;
PascalishParser.T__43 = 44;
PascalishParser.T__44 = 45;
PascalishParser.T__45 = 46;
PascalishParser.T__46 = 47;
PascalishParser.T__47 = 48;
PascalishParser.T__48 = 49;
PascalishParser.T__49 = 50;
PascalishParser.T__50 = 51;
PascalishParser.T__51 = 52;
PascalishParser.T__52 = 53;
PascalishParser.T__53 = 54;
PascalishParser.T__54 = 55;
PascalishParser.T__55 = 56;
PascalishParser.T__56 = 57;
PascalishParser.T__57 = 58;
PascalishParser.T__58 = 59;
PascalishParser.T__59 = 60;
PascalishParser.T__60 = 61;
PascalishParser.T__61 = 62;
PascalishParser.T__62 = 63;
PascalishParser.T__63 = 64;
PascalishParser.T__64 = 65;
PascalishParser.T__65 = 66;
PascalishParser.T__66 = 67;
PascalishParser.T__67 = 68;
PascalishParser.T__68 = 69;
PascalishParser.T__69 = 70;
PascalishParser.T__70 = 71;
PascalishParser.T__71 = 72;
PascalishParser.T__72 = 73;
PascalishParser.T__73 = 74;
PascalishParser.T__74 = 75;
PascalishParser.T__75 = 76;
PascalishParser.T__76 = 77;
PascalishParser.T__77 = 78;
PascalishParser.T__78 = 79;
PascalishParser.T__79 = 80;
PascalishParser.T__80 = 81;
PascalishParser.T__81 = 82;
PascalishParser.T__82 = 83;
PascalishParser.IDENT = 84;
PascalishParser.NUMBER = 85;
PascalishParser.STRING = 86;
PascalishParser.LINE_COMMENT = 87;
PascalishParser.BLOCK_COMMENT = 88;
PascalishParser.WS = 89;

PascalishParser.RULE_compilationUnit = 0;
PascalishParser.RULE_decl = 1;
PascalishParser.RULE_placement = 2;
PascalishParser.RULE_programDecl = 3;
PascalishParser.RULE_serviceDecl = 4;
PascalishParser.RULE_serviceBody = 5;
PascalishParser.RULE_daemonDecl = 6;
PascalishParser.RULE_daemonSchedule = 7;
PascalishParser.RULE_typeDecl = 8;
PascalishParser.RULE_varDecl = 9;
PascalishParser.RULE_fileDecl = 10;
PascalishParser.RULE_queueDecl = 11;
PascalishParser.RULE_queueType = 12;
PascalishParser.RULE_stackType = 13;
PascalishParser.RULE_priorityQueueType = 14;
PascalishParser.RULE_recordType = 15;
PascalishParser.RULE_recordField = 16;
PascalishParser.RULE_typeRef = 17;
PascalishParser.RULE_simpleType = 18;
PascalishParser.RULE_userType = 19;
PascalishParser.RULE_fixedArrayType = 20;
PascalishParser.RULE_dynamicArrayType = 21;
PascalishParser.RULE_block = 22;
PascalishParser.RULE_statement = 23;
PascalishParser.RULE_assignStmt = 24;
PascalishParser.RULE_callStmt = 25;
PascalishParser.RULE_ifStmt = 26;
PascalishParser.RULE_whileStmt = 27;
PascalishParser.RULE_forStmt = 28;
PascalishParser.RULE_repeatStmt = 29;
PascalishParser.RULE_enqueueStmt = 30;
PascalishParser.RULE_dequeueStmt = 31;
PascalishParser.RULE_peekStmt = 32;
PascalishParser.RULE_pushStmt = 33;
PascalishParser.RULE_popStmt = 34;
PascalishParser.RULE_concurrentStmt = 35;
PascalishParser.RULE_cobeginStmt = 36;
PascalishParser.RULE_asyncStmt = 37;
PascalishParser.RULE_waitStmt = 38;
PascalishParser.RULE_syncStmt = 39;
PascalishParser.RULE_subflowStmt = 40;
PascalishParser.RULE_fileStmt = 41;
PascalishParser.RULE_lvalue = 42;
PascalishParser.RULE_qualifiedName = 43;
PascalishParser.RULE_exprList = 44;
PascalishParser.RULE_expr = 45;
PascalishParser.RULE_logicalOrExpr = 46;
PascalishParser.RULE_logicalAndExpr = 47;
PascalishParser.RULE_equalityExpr = 48;
PascalishParser.RULE_relationalExpr = 49;
PascalishParser.RULE_additiveExpr = 50;
PascalishParser.RULE_multiplicativeExpr = 51;
PascalishParser.RULE_unaryExpr = 52;
PascalishParser.RULE_primaryExpr = 53;

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
        this.ruleIndex = PascalishParser.RULE_compilationUnit;
    }

	EOF() {
	    return this.getToken(PascalishParser.EOF, 0);
	};

	decl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeclContext);
	    } else {
	        return this.getTypedRuleContext(DeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitCompilationUnit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_decl;
    }

	programDecl() {
	    return this.getTypedRuleContext(ProgramDeclContext,0);
	};

	serviceDecl() {
	    return this.getTypedRuleContext(ServiceDeclContext,0);
	};

	daemonDecl() {
	    return this.getTypedRuleContext(DaemonDeclContext,0);
	};

	typeDecl() {
	    return this.getTypedRuleContext(TypeDeclContext,0);
	};

	varDecl() {
	    return this.getTypedRuleContext(VarDeclContext,0);
	};

	queueDecl() {
	    return this.getTypedRuleContext(QueueDeclContext,0);
	};

	fileDecl() {
	    return this.getTypedRuleContext(FileDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitDecl(this);
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
        this.ruleIndex = PascalishParser.RULE_placement;
    }


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPlacement(this);
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
        this.ruleIndex = PascalishParser.RULE_programDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitProgramDecl(this);
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
        this.ruleIndex = PascalishParser.RULE_serviceDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	serviceBody() {
	    return this.getTypedRuleContext(ServiceBodyContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
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
        this.ruleIndex = PascalishParser.RULE_serviceBody;
    }

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
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitServiceBody(this);
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
        this.ruleIndex = PascalishParser.RULE_daemonDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	daemonSchedule() {
	    return this.getTypedRuleContext(DaemonScheduleContext,0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitDaemonDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DaemonScheduleContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_daemonSchedule;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitDaemonSchedule(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TypeDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_typeDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitTypeDecl(this);
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
        this.ruleIndex = PascalishParser.RULE_varDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitVarDecl(this);
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
        this.ruleIndex = PascalishParser.RULE_fileDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitFileDecl(this);
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
        this.ruleIndex = PascalishParser.RULE_queueDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	queueType() {
	    return this.getTypedRuleContext(QueueTypeContext,0);
	};

	placement() {
	    return this.getTypedRuleContext(PlacementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitQueueDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QueueTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_queueType;
    }

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitQueueType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StackTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_stackType;
    }

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitStackType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PriorityQueueTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_priorityQueueType;
    }

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPriorityQueueType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RecordTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_recordType;
    }

	recordField = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RecordFieldContext);
	    } else {
	        return this.getTypedRuleContext(RecordFieldContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitRecordType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RecordFieldContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_recordField;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitRecordField(this);
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
        this.ruleIndex = PascalishParser.RULE_typeRef;
    }

	simpleType() {
	    return this.getTypedRuleContext(SimpleTypeContext,0);
	};

	recordType() {
	    return this.getTypedRuleContext(RecordTypeContext,0);
	};

	queueType() {
	    return this.getTypedRuleContext(QueueTypeContext,0);
	};

	stackType() {
	    return this.getTypedRuleContext(StackTypeContext,0);
	};

	priorityQueueType() {
	    return this.getTypedRuleContext(PriorityQueueTypeContext,0);
	};

	fixedArrayType() {
	    return this.getTypedRuleContext(FixedArrayTypeContext,0);
	};

	dynamicArrayType() {
	    return this.getTypedRuleContext(DynamicArrayTypeContext,0);
	};

	userType() {
	    return this.getTypedRuleContext(UserTypeContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitTypeRef(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SimpleTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_simpleType;
    }


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitSimpleType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UserTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_userType;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitUserType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FixedArrayTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_fixedArrayType;
    }

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitFixedArrayType(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DynamicArrayTypeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_dynamicArrayType;
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

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitDynamicArrayType(this);
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
        this.ruleIndex = PascalishParser.RULE_block;
    }

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
	    if ( visitor instanceof PascalishVisitor ) {
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
        this.ruleIndex = PascalishParser.RULE_statement;
    }

	assignStmt() {
	    return this.getTypedRuleContext(AssignStmtContext,0);
	};

	callStmt() {
	    return this.getTypedRuleContext(CallStmtContext,0);
	};

	ifStmt() {
	    return this.getTypedRuleContext(IfStmtContext,0);
	};

	whileStmt() {
	    return this.getTypedRuleContext(WhileStmtContext,0);
	};

	forStmt() {
	    return this.getTypedRuleContext(ForStmtContext,0);
	};

	repeatStmt() {
	    return this.getTypedRuleContext(RepeatStmtContext,0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	enqueueStmt() {
	    return this.getTypedRuleContext(EnqueueStmtContext,0);
	};

	dequeueStmt() {
	    return this.getTypedRuleContext(DequeueStmtContext,0);
	};

	peekStmt() {
	    return this.getTypedRuleContext(PeekStmtContext,0);
	};

	pushStmt() {
	    return this.getTypedRuleContext(PushStmtContext,0);
	};

	popStmt() {
	    return this.getTypedRuleContext(PopStmtContext,0);
	};

	concurrentStmt() {
	    return this.getTypedRuleContext(ConcurrentStmtContext,0);
	};

	fileStmt() {
	    return this.getTypedRuleContext(FileStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_assignStmt;
    }

	lvalue() {
	    return this.getTypedRuleContext(LvalueContext,0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitAssignStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CallStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_callStmt;
    }

	qualifiedName() {
	    return this.getTypedRuleContext(QualifiedNameContext,0);
	};

	exprList() {
	    return this.getTypedRuleContext(ExprListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitCallStmt(this);
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
        this.ruleIndex = PascalishParser.RULE_ifStmt;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
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
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitIfStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WhileStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_whileStmt;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitWhileStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ForStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_forStmt;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitForStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RepeatStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_repeatStmt;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
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
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitRepeatStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EnqueueStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_enqueueStmt;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitEnqueueStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DequeueStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_dequeueStmt;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitDequeueStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PeekStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_peekStmt;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPeekStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PushStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_pushStmt;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPushStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PopStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_popStmt;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPopStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ConcurrentStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_concurrentStmt;
    }

	cobeginStmt() {
	    return this.getTypedRuleContext(CobeginStmtContext,0);
	};

	asyncStmt() {
	    return this.getTypedRuleContext(AsyncStmtContext,0);
	};

	waitStmt() {
	    return this.getTypedRuleContext(WaitStmtContext,0);
	};

	syncStmt() {
	    return this.getTypedRuleContext(SyncStmtContext,0);
	};

	subflowStmt() {
	    return this.getTypedRuleContext(SubflowStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitConcurrentStmt(this);
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
        this.ruleIndex = PascalishParser.RULE_cobeginStmt;
    }

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
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitCobeginStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AsyncStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_asyncStmt;
    }

	statement() {
	    return this.getTypedRuleContext(StatementContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitAsyncStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WaitStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_waitStmt;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitWaitStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SyncStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_syncStmt;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitSyncStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SubflowStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_subflowStmt;
    }

	STRING() {
	    return this.getToken(PascalishParser.STRING, 0);
	};

	exprList() {
	    return this.getTypedRuleContext(ExprListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitSubflowStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FileStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_fileStmt;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitFileStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LvalueContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_lvalue;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitLvalue(this);
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
        this.ruleIndex = PascalishParser.RULE_qualifiedName;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(PascalishParser.IDENT);
	    } else {
	        return this.getToken(PascalishParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitQualifiedName(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExprListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_exprList;
    }

	expr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExprContext);
	    } else {
	        return this.getTypedRuleContext(ExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitExprList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_expr;
    }

	logicalOrExpr() {
	    return this.getTypedRuleContext(LogicalOrExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalOrExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_logicalOrExpr;
    }

	logicalAndExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(LogicalAndExprContext);
	    } else {
	        return this.getTypedRuleContext(LogicalAndExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitLogicalOrExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalAndExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_logicalAndExpr;
    }

	equalityExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EqualityExprContext);
	    } else {
	        return this.getTypedRuleContext(EqualityExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitLogicalAndExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EqualityExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_equalityExpr;
    }

	relationalExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(RelationalExprContext);
	    } else {
	        return this.getTypedRuleContext(RelationalExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitEqualityExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class RelationalExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_relationalExpr;
    }

	additiveExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AdditiveExprContext);
	    } else {
	        return this.getTypedRuleContext(AdditiveExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitRelationalExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AdditiveExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_additiveExpr;
    }

	multiplicativeExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MultiplicativeExprContext);
	    } else {
	        return this.getTypedRuleContext(MultiplicativeExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitAdditiveExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MultiplicativeExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_multiplicativeExpr;
    }

	unaryExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(UnaryExprContext);
	    } else {
	        return this.getTypedRuleContext(UnaryExprContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitMultiplicativeExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UnaryExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_unaryExpr;
    }

	unaryExpr() {
	    return this.getTypedRuleContext(UnaryExprContext,0);
	};

	primaryExpr() {
	    return this.getTypedRuleContext(PrimaryExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitUnaryExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PrimaryExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_primaryExpr;
    }

	NUMBER() {
	    return this.getToken(PascalishParser.NUMBER, 0);
	};

	STRING() {
	    return this.getToken(PascalishParser.STRING, 0);
	};

	qualifiedName() {
	    return this.getTypedRuleContext(QualifiedNameContext,0);
	};

	exprList() {
	    return this.getTypedRuleContext(ExprListContext,0);
	};

	lvalue() {
	    return this.getTypedRuleContext(LvalueContext,0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitPrimaryExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




PascalishParser.CompilationUnitContext = CompilationUnitContext; 
PascalishParser.DeclContext = DeclContext; 
PascalishParser.PlacementContext = PlacementContext; 
PascalishParser.ProgramDeclContext = ProgramDeclContext; 
PascalishParser.ServiceDeclContext = ServiceDeclContext; 
PascalishParser.ServiceBodyContext = ServiceBodyContext; 
PascalishParser.DaemonDeclContext = DaemonDeclContext; 
PascalishParser.DaemonScheduleContext = DaemonScheduleContext; 
PascalishParser.TypeDeclContext = TypeDeclContext; 
PascalishParser.VarDeclContext = VarDeclContext; 
PascalishParser.FileDeclContext = FileDeclContext; 
PascalishParser.QueueDeclContext = QueueDeclContext; 
PascalishParser.QueueTypeContext = QueueTypeContext; 
PascalishParser.StackTypeContext = StackTypeContext; 
PascalishParser.PriorityQueueTypeContext = PriorityQueueTypeContext; 
PascalishParser.RecordTypeContext = RecordTypeContext; 
PascalishParser.RecordFieldContext = RecordFieldContext; 
PascalishParser.TypeRefContext = TypeRefContext; 
PascalishParser.SimpleTypeContext = SimpleTypeContext; 
PascalishParser.UserTypeContext = UserTypeContext; 
PascalishParser.FixedArrayTypeContext = FixedArrayTypeContext; 
PascalishParser.DynamicArrayTypeContext = DynamicArrayTypeContext; 
PascalishParser.BlockContext = BlockContext; 
PascalishParser.StatementContext = StatementContext; 
PascalishParser.AssignStmtContext = AssignStmtContext; 
PascalishParser.CallStmtContext = CallStmtContext; 
PascalishParser.IfStmtContext = IfStmtContext; 
PascalishParser.WhileStmtContext = WhileStmtContext; 
PascalishParser.ForStmtContext = ForStmtContext; 
PascalishParser.RepeatStmtContext = RepeatStmtContext; 
PascalishParser.EnqueueStmtContext = EnqueueStmtContext; 
PascalishParser.DequeueStmtContext = DequeueStmtContext; 
PascalishParser.PeekStmtContext = PeekStmtContext; 
PascalishParser.PushStmtContext = PushStmtContext; 
PascalishParser.PopStmtContext = PopStmtContext; 
PascalishParser.ConcurrentStmtContext = ConcurrentStmtContext; 
PascalishParser.CobeginStmtContext = CobeginStmtContext; 
PascalishParser.AsyncStmtContext = AsyncStmtContext; 
PascalishParser.WaitStmtContext = WaitStmtContext; 
PascalishParser.SyncStmtContext = SyncStmtContext; 
PascalishParser.SubflowStmtContext = SubflowStmtContext; 
PascalishParser.FileStmtContext = FileStmtContext; 
PascalishParser.LvalueContext = LvalueContext; 
PascalishParser.QualifiedNameContext = QualifiedNameContext; 
PascalishParser.ExprListContext = ExprListContext; 
PascalishParser.ExprContext = ExprContext; 
PascalishParser.LogicalOrExprContext = LogicalOrExprContext; 
PascalishParser.LogicalAndExprContext = LogicalAndExprContext; 
PascalishParser.EqualityExprContext = EqualityExprContext; 
PascalishParser.RelationalExprContext = RelationalExprContext; 
PascalishParser.AdditiveExprContext = AdditiveExprContext; 
PascalishParser.MultiplicativeExprContext = MultiplicativeExprContext; 
PascalishParser.UnaryExprContext = UnaryExprContext; 
PascalishParser.PrimaryExprContext = PrimaryExprContext; 
