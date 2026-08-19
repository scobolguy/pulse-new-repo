// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Pascalish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishVisitor from './PascalishVisitor.js';

const serializedATN = [4,1,95,716,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,2,48,7,48,2,
49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,
7,56,2,57,7,57,2,58,7,58,2,59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,
63,2,64,7,64,2,65,7,65,1,0,5,0,134,8,0,10,0,12,0,137,9,0,1,0,1,0,1,1,1,1,
1,1,1,1,1,1,1,1,1,1,1,1,3,1,149,8,1,1,2,1,2,1,2,1,3,1,3,1,3,3,3,157,8,3,
1,3,1,3,1,3,1,3,1,4,1,4,1,4,3,4,166,8,4,1,4,3,4,169,8,4,1,4,1,4,1,4,1,5,
5,5,175,8,5,10,5,12,5,178,9,5,1,6,1,6,1,6,3,6,183,8,6,1,6,1,6,3,6,187,8,
6,1,6,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,7,1,7,1,7,3,7,200,8,7,1,8,1,8,1,8,3,
8,205,8,8,1,8,1,8,1,8,1,8,1,9,1,9,1,9,3,9,214,8,9,1,9,3,9,217,8,9,1,9,1,
9,5,9,221,8,9,10,9,12,9,224,9,9,1,9,1,9,1,9,1,10,1,10,1,10,1,11,1,11,3,11,
234,8,11,1,12,1,12,1,12,1,12,1,12,1,13,1,13,1,13,3,13,244,8,13,1,13,1,13,
3,13,248,8,13,1,13,1,13,1,13,3,13,253,8,13,1,13,1,13,1,13,1,13,1,14,1,14,
1,14,5,14,262,8,14,10,14,12,14,265,9,14,1,15,1,15,1,15,1,15,1,16,1,16,1,
16,1,16,1,16,3,16,276,8,16,1,16,3,16,279,8,16,1,16,1,16,1,17,1,17,1,17,1,
17,3,17,287,8,17,1,18,1,18,1,18,5,18,292,8,18,10,18,12,18,295,9,18,1,19,
1,19,1,19,1,19,1,19,3,19,302,8,19,1,19,1,19,1,20,1,20,1,20,1,20,3,20,310,
8,20,1,20,1,20,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,
21,1,21,1,21,3,21,328,8,21,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,
1,22,1,22,1,22,1,22,1,22,3,22,344,8,22,1,23,1,23,1,23,1,23,1,23,1,23,1,23,
1,23,1,23,1,23,1,23,1,23,1,23,1,23,3,23,360,8,23,1,24,1,24,5,24,364,8,24,
10,24,12,24,367,9,24,1,24,1,24,1,25,1,25,1,25,1,25,1,25,1,26,1,26,1,26,1,
26,1,26,1,26,1,26,1,26,3,26,384,8,26,1,27,1,27,1,27,1,27,5,27,390,8,27,10,
27,12,27,393,9,27,1,27,1,27,1,28,1,28,1,29,1,29,3,29,401,8,29,1,30,1,30,
1,30,1,30,5,30,407,8,30,10,30,12,30,410,9,30,1,30,1,30,1,31,1,31,1,31,1,
31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,1,32,1,33,1,33,
5,33,432,8,33,10,33,12,33,435,9,33,1,33,1,33,1,34,1,34,1,34,1,34,1,34,1,
34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,1,34,3,34,454,8,34,1,35,1,35,
1,35,1,35,5,35,460,8,35,10,35,12,35,463,9,35,1,35,1,35,1,35,1,36,1,36,1,
36,1,36,1,36,1,37,1,37,1,37,1,37,3,37,477,8,37,1,37,1,37,1,37,1,38,1,38,
1,38,1,38,5,38,486,8,38,10,38,12,38,489,9,38,1,38,1,38,5,38,493,8,38,10,
38,12,38,496,9,38,3,38,498,8,38,1,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,
1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,41,1,41,5,41,519,8,41,10,
41,12,41,522,9,41,1,41,1,41,1,41,1,41,1,42,1,42,1,42,1,42,1,42,1,42,1,43,
1,43,1,43,1,43,1,43,1,43,1,44,1,44,1,44,1,44,1,44,1,44,1,45,1,45,1,45,1,
45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,1,46,1,47,1,47,1,47,1,47,1,47,3,47,
563,8,47,1,48,1,48,5,48,567,8,48,10,48,12,48,570,9,48,1,48,1,48,1,48,1,49,
1,49,1,49,1,50,1,50,1,50,1,50,1,50,1,50,3,50,584,8,50,1,51,1,51,1,51,1,51,
1,52,1,52,1,52,1,52,3,52,594,8,52,1,52,1,52,1,53,1,53,1,53,1,53,1,53,1,53,
1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,617,
8,53,1,54,1,54,1,54,5,54,622,8,54,10,54,12,54,625,9,54,1,55,1,55,1,55,5,
55,630,8,55,10,55,12,55,633,9,55,1,56,1,56,1,56,5,56,638,8,56,10,56,12,56,
641,9,56,1,57,1,57,1,58,1,58,1,58,5,58,648,8,58,10,58,12,58,651,9,58,1,59,
1,59,1,59,5,59,656,8,59,10,59,12,59,659,9,59,1,60,1,60,1,60,5,60,664,8,60,
10,60,12,60,667,9,60,1,61,1,61,1,61,5,61,672,8,61,10,61,12,61,675,9,61,1,
62,1,62,1,62,5,62,680,8,62,10,62,12,62,683,9,62,1,63,1,63,1,63,5,63,688,
8,63,10,63,12,63,691,9,63,1,64,1,64,1,64,3,64,696,8,64,1,65,1,65,1,65,1,
65,1,65,1,65,1,65,3,65,705,8,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,3,65,
714,8,65,1,65,0,0,66,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,
38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,
86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,
126,128,130,0,11,1,0,2,6,2,0,13,13,15,16,1,0,23,24,2,0,90,90,92,92,1,0,42,
45,1,0,74,75,2,0,18,18,79,79,2,0,37,38,80,81,1,0,82,83,1,0,84,86,2,0,83,
83,87,87,741,0,135,1,0,0,0,2,148,1,0,0,0,4,150,1,0,0,0,6,153,1,0,0,0,8,162,
1,0,0,0,10,176,1,0,0,0,12,179,1,0,0,0,14,199,1,0,0,0,16,201,1,0,0,0,18,210,
1,0,0,0,20,228,1,0,0,0,22,233,1,0,0,0,24,235,1,0,0,0,26,240,1,0,0,0,28,258,
1,0,0,0,30,266,1,0,0,0,32,270,1,0,0,0,34,286,1,0,0,0,36,288,1,0,0,0,38,296,
1,0,0,0,40,305,1,0,0,0,42,327,1,0,0,0,44,343,1,0,0,0,46,359,1,0,0,0,48,361,
1,0,0,0,50,370,1,0,0,0,52,383,1,0,0,0,54,385,1,0,0,0,56,396,1,0,0,0,58,398,
1,0,0,0,60,402,1,0,0,0,62,413,1,0,0,0,64,422,1,0,0,0,66,429,1,0,0,0,68,453,
1,0,0,0,70,455,1,0,0,0,72,467,1,0,0,0,74,472,1,0,0,0,76,481,1,0,0,0,78,502,
1,0,0,0,80,507,1,0,0,0,82,516,1,0,0,0,84,527,1,0,0,0,86,533,1,0,0,0,88,539,
1,0,0,0,90,545,1,0,0,0,92,551,1,0,0,0,94,562,1,0,0,0,96,564,1,0,0,0,98,574,
1,0,0,0,100,583,1,0,0,0,102,585,1,0,0,0,104,589,1,0,0,0,106,616,1,0,0,0,
108,618,1,0,0,0,110,626,1,0,0,0,112,634,1,0,0,0,114,642,1,0,0,0,116,644,
1,0,0,0,118,652,1,0,0,0,120,660,1,0,0,0,122,668,1,0,0,0,124,676,1,0,0,0,
126,684,1,0,0,0,128,695,1,0,0,0,130,713,1,0,0,0,132,134,3,2,1,0,133,132,
1,0,0,0,134,137,1,0,0,0,135,133,1,0,0,0,135,136,1,0,0,0,136,138,1,0,0,0,
137,135,1,0,0,0,138,139,5,0,0,1,139,1,1,0,0,0,140,149,3,6,3,0,141,149,3,
8,4,0,142,149,3,12,6,0,143,149,3,16,8,0,144,149,3,18,9,0,145,149,3,32,16,
0,146,149,3,40,20,0,147,149,3,38,19,0,148,140,1,0,0,0,148,141,1,0,0,0,148,
142,1,0,0,0,148,143,1,0,0,0,148,144,1,0,0,0,148,145,1,0,0,0,148,146,1,0,
0,0,148,147,1,0,0,0,149,3,1,0,0,0,150,151,5,1,0,0,151,152,7,0,0,0,152,5,
1,0,0,0,153,154,5,7,0,0,154,156,5,90,0,0,155,157,3,4,2,0,156,155,1,0,0,0,
156,157,1,0,0,0,157,158,1,0,0,0,158,159,5,8,0,0,159,160,3,66,33,0,160,161,
5,9,0,0,161,7,1,0,0,0,162,163,5,10,0,0,163,165,5,90,0,0,164,166,3,4,2,0,
165,164,1,0,0,0,165,166,1,0,0,0,166,168,1,0,0,0,167,169,5,8,0,0,168,167,
1,0,0,0,168,169,1,0,0,0,169,170,1,0,0,0,170,171,3,66,33,0,171,172,5,9,0,
0,172,9,1,0,0,0,173,175,3,68,34,0,174,173,1,0,0,0,175,178,1,0,0,0,176,174,
1,0,0,0,176,177,1,0,0,0,177,11,1,0,0,0,178,176,1,0,0,0,179,180,5,11,0,0,
180,182,5,90,0,0,181,183,3,4,2,0,182,181,1,0,0,0,182,183,1,0,0,0,183,184,
1,0,0,0,184,186,3,14,7,0,185,187,5,8,0,0,186,185,1,0,0,0,186,187,1,0,0,0,
187,188,1,0,0,0,188,189,3,66,33,0,189,190,5,9,0,0,190,13,1,0,0,0,191,192,
5,12,0,0,192,193,3,114,57,0,193,194,5,13,0,0,194,200,1,0,0,0,195,196,5,14,
0,0,196,197,3,114,57,0,197,198,7,1,0,0,198,200,1,0,0,0,199,191,1,0,0,0,199,
195,1,0,0,0,200,15,1,0,0,0,201,202,5,17,0,0,202,204,5,90,0,0,203,205,3,54,
27,0,204,203,1,0,0,0,204,205,1,0,0,0,205,206,1,0,0,0,206,207,5,18,0,0,207,
208,3,52,26,0,208,209,5,8,0,0,209,17,1,0,0,0,210,211,5,19,0,0,211,213,5,
90,0,0,212,214,3,54,27,0,213,212,1,0,0,0,213,214,1,0,0,0,214,216,1,0,0,0,
215,217,3,20,10,0,216,215,1,0,0,0,216,217,1,0,0,0,217,218,1,0,0,0,218,222,
5,8,0,0,219,221,3,22,11,0,220,219,1,0,0,0,221,224,1,0,0,0,222,220,1,0,0,
0,222,223,1,0,0,0,223,225,1,0,0,0,224,222,1,0,0,0,225,226,5,20,0,0,226,227,
5,8,0,0,227,19,1,0,0,0,228,229,5,21,0,0,229,230,3,52,26,0,230,21,1,0,0,0,
231,234,3,24,12,0,232,234,3,26,13,0,233,231,1,0,0,0,233,232,1,0,0,0,234,
23,1,0,0,0,235,236,5,90,0,0,236,237,5,22,0,0,237,238,3,52,26,0,238,239,5,
8,0,0,239,25,1,0,0,0,240,241,7,2,0,0,241,243,5,90,0,0,242,244,3,54,27,0,
243,242,1,0,0,0,243,244,1,0,0,0,244,245,1,0,0,0,245,247,5,25,0,0,246,248,
3,28,14,0,247,246,1,0,0,0,247,248,1,0,0,0,248,249,1,0,0,0,249,252,5,26,0,
0,250,251,5,22,0,0,251,253,3,52,26,0,252,250,1,0,0,0,252,253,1,0,0,0,253,
254,1,0,0,0,254,255,5,8,0,0,255,256,3,66,33,0,256,257,5,8,0,0,257,27,1,0,
0,0,258,263,3,30,15,0,259,260,5,8,0,0,260,262,3,30,15,0,261,259,1,0,0,0,
262,265,1,0,0,0,263,261,1,0,0,0,263,264,1,0,0,0,264,29,1,0,0,0,265,263,1,
0,0,0,266,267,3,36,18,0,267,268,5,22,0,0,268,269,3,52,26,0,269,31,1,0,0,
0,270,271,5,27,0,0,271,272,5,90,0,0,272,273,5,22,0,0,273,275,3,52,26,0,274,
276,3,4,2,0,275,274,1,0,0,0,275,276,1,0,0,0,276,278,1,0,0,0,277,279,3,34,
17,0,278,277,1,0,0,0,278,279,1,0,0,0,279,280,1,0,0,0,280,281,5,8,0,0,281,
33,1,0,0,0,282,283,5,28,0,0,283,287,5,29,0,0,284,285,5,28,0,0,285,287,7,
3,0,0,286,282,1,0,0,0,286,284,1,0,0,0,287,35,1,0,0,0,288,293,5,90,0,0,289,
290,5,30,0,0,290,292,5,90,0,0,291,289,1,0,0,0,292,295,1,0,0,0,293,291,1,
0,0,0,293,294,1,0,0,0,294,37,1,0,0,0,295,293,1,0,0,0,296,297,5,31,0,0,297,
298,5,90,0,0,298,299,5,32,0,0,299,301,3,52,26,0,300,302,3,4,2,0,301,300,
1,0,0,0,301,302,1,0,0,0,302,303,1,0,0,0,303,304,5,8,0,0,304,39,1,0,0,0,305,
306,5,33,0,0,306,307,5,90,0,0,307,309,3,42,21,0,308,310,3,4,2,0,309,308,
1,0,0,0,309,310,1,0,0,0,310,311,1,0,0,0,311,312,5,8,0,0,312,41,1,0,0,0,313,
314,5,33,0,0,314,315,5,34,0,0,315,316,3,114,57,0,316,317,5,35,0,0,317,318,
3,114,57,0,318,319,5,36,0,0,319,320,5,32,0,0,320,321,3,52,26,0,321,328,1,
0,0,0,322,323,5,33,0,0,323,324,5,37,0,0,324,325,3,52,26,0,325,326,5,38,0,
0,326,328,1,0,0,0,327,313,1,0,0,0,327,322,1,0,0,0,328,43,1,0,0,0,329,330,
5,39,0,0,330,331,5,34,0,0,331,332,3,114,57,0,332,333,5,35,0,0,333,334,3,
114,57,0,334,335,5,36,0,0,335,336,5,32,0,0,336,337,3,52,26,0,337,344,1,0,
0,0,338,339,5,39,0,0,339,340,5,37,0,0,340,341,3,52,26,0,341,342,5,38,0,0,
342,344,1,0,0,0,343,329,1,0,0,0,343,338,1,0,0,0,344,45,1,0,0,0,345,346,5,
40,0,0,346,347,5,34,0,0,347,348,3,114,57,0,348,349,5,35,0,0,349,350,3,114,
57,0,350,351,5,36,0,0,351,352,5,32,0,0,352,353,3,52,26,0,353,360,1,0,0,0,
354,355,5,40,0,0,355,356,5,37,0,0,356,357,3,52,26,0,357,358,5,38,0,0,358,
360,1,0,0,0,359,345,1,0,0,0,359,354,1,0,0,0,360,47,1,0,0,0,361,365,5,41,
0,0,362,364,3,50,25,0,363,362,1,0,0,0,364,367,1,0,0,0,365,363,1,0,0,0,365,
366,1,0,0,0,366,368,1,0,0,0,367,365,1,0,0,0,368,369,5,20,0,0,369,49,1,0,
0,0,370,371,5,90,0,0,371,372,5,22,0,0,372,373,3,52,26,0,373,374,5,8,0,0,
374,51,1,0,0,0,375,384,3,56,28,0,376,384,3,48,24,0,377,384,3,42,21,0,378,
384,3,44,22,0,379,384,3,46,23,0,380,384,3,62,31,0,381,384,3,64,32,0,382,
384,3,58,29,0,383,375,1,0,0,0,383,376,1,0,0,0,383,377,1,0,0,0,383,378,1,
0,0,0,383,379,1,0,0,0,383,380,1,0,0,0,383,381,1,0,0,0,383,382,1,0,0,0,384,
53,1,0,0,0,385,386,5,37,0,0,386,391,5,90,0,0,387,388,5,30,0,0,388,390,5,
90,0,0,389,387,1,0,0,0,390,393,1,0,0,0,391,389,1,0,0,0,391,392,1,0,0,0,392,
394,1,0,0,0,393,391,1,0,0,0,394,395,5,38,0,0,395,55,1,0,0,0,396,397,7,4,
0,0,397,57,1,0,0,0,398,400,5,90,0,0,399,401,3,60,30,0,400,399,1,0,0,0,400,
401,1,0,0,0,401,59,1,0,0,0,402,403,5,37,0,0,403,408,3,52,26,0,404,405,5,
30,0,0,405,407,3,52,26,0,406,404,1,0,0,0,407,410,1,0,0,0,408,406,1,0,0,0,
408,409,1,0,0,0,409,411,1,0,0,0,410,408,1,0,0,0,411,412,5,38,0,0,412,61,
1,0,0,0,413,414,5,46,0,0,414,415,5,34,0,0,415,416,3,114,57,0,416,417,5,35,
0,0,417,418,3,114,57,0,418,419,5,36,0,0,419,420,5,32,0,0,420,421,3,52,26,
0,421,63,1,0,0,0,422,423,5,46,0,0,423,424,5,37,0,0,424,425,3,52,26,0,425,
426,5,38,0,0,426,427,5,32,0,0,427,428,3,52,26,0,428,65,1,0,0,0,429,433,5,
47,0,0,430,432,3,68,34,0,431,430,1,0,0,0,432,435,1,0,0,0,433,431,1,0,0,0,
433,434,1,0,0,0,434,436,1,0,0,0,435,433,1,0,0,0,436,437,5,20,0,0,437,67,
1,0,0,0,438,454,3,72,36,0,439,454,3,74,37,0,440,454,3,76,38,0,441,454,3,
78,39,0,442,454,3,80,40,0,443,454,3,82,41,0,444,454,3,70,35,0,445,454,3,
66,33,0,446,454,3,84,42,0,447,454,3,86,43,0,448,454,3,88,44,0,449,454,3,
90,45,0,450,454,3,92,46,0,451,454,3,94,47,0,452,454,3,106,53,0,453,438,1,
0,0,0,453,439,1,0,0,0,453,440,1,0,0,0,453,441,1,0,0,0,453,442,1,0,0,0,453,
443,1,0,0,0,453,444,1,0,0,0,453,445,1,0,0,0,453,446,1,0,0,0,453,447,1,0,
0,0,453,448,1,0,0,0,453,449,1,0,0,0,453,450,1,0,0,0,453,451,1,0,0,0,453,
452,1,0,0,0,454,69,1,0,0,0,455,456,5,48,0,0,456,457,3,114,57,0,457,461,5,
49,0,0,458,460,3,68,34,0,459,458,1,0,0,0,460,463,1,0,0,0,461,459,1,0,0,0,
461,462,1,0,0,0,462,464,1,0,0,0,463,461,1,0,0,0,464,465,5,20,0,0,465,466,
5,8,0,0,466,71,1,0,0,0,467,468,3,108,54,0,468,469,5,50,0,0,469,470,3,114,
57,0,470,471,5,8,0,0,471,73,1,0,0,0,472,473,5,51,0,0,473,474,3,110,55,0,
474,476,5,25,0,0,475,477,3,112,56,0,476,475,1,0,0,0,476,477,1,0,0,0,477,
478,1,0,0,0,478,479,5,26,0,0,479,480,5,8,0,0,480,75,1,0,0,0,481,482,5,52,
0,0,482,483,3,114,57,0,483,487,5,53,0,0,484,486,3,68,34,0,485,484,1,0,0,
0,486,489,1,0,0,0,487,485,1,0,0,0,487,488,1,0,0,0,488,497,1,0,0,0,489,487,
1,0,0,0,490,494,5,54,0,0,491,493,3,68,34,0,492,491,1,0,0,0,493,496,1,0,0,
0,494,492,1,0,0,0,494,495,1,0,0,0,495,498,1,0,0,0,496,494,1,0,0,0,497,490,
1,0,0,0,497,498,1,0,0,0,498,499,1,0,0,0,499,500,5,20,0,0,500,501,5,8,0,0,
501,77,1,0,0,0,502,503,5,55,0,0,503,504,3,114,57,0,504,505,5,49,0,0,505,
506,3,68,34,0,506,79,1,0,0,0,507,508,5,56,0,0,508,509,5,90,0,0,509,510,5,
50,0,0,510,511,3,114,57,0,511,512,5,57,0,0,512,513,3,114,57,0,513,514,5,
49,0,0,514,515,3,68,34,0,515,81,1,0,0,0,516,520,5,58,0,0,517,519,3,68,34,
0,518,517,1,0,0,0,519,522,1,0,0,0,520,518,1,0,0,0,520,521,1,0,0,0,521,523,
1,0,0,0,522,520,1,0,0,0,523,524,5,59,0,0,524,525,3,114,57,0,525,526,5,8,
0,0,526,83,1,0,0,0,527,528,5,60,0,0,528,529,5,90,0,0,529,530,5,48,0,0,530,
531,3,114,57,0,531,532,5,8,0,0,532,85,1,0,0,0,533,534,5,61,0,0,534,535,5,
90,0,0,535,536,5,62,0,0,536,537,5,90,0,0,537,538,5,8,0,0,538,87,1,0,0,0,
539,540,5,63,0,0,540,541,5,90,0,0,541,542,5,62,0,0,542,543,5,90,0,0,543,
544,5,8,0,0,544,89,1,0,0,0,545,546,5,64,0,0,546,547,5,90,0,0,547,548,5,48,
0,0,548,549,3,114,57,0,549,550,5,8,0,0,550,91,1,0,0,0,551,552,5,65,0,0,552,
553,5,90,0,0,553,554,5,62,0,0,554,555,5,90,0,0,555,556,5,8,0,0,556,93,1,
0,0,0,557,563,3,96,48,0,558,563,3,98,49,0,559,563,3,100,50,0,560,563,3,102,
51,0,561,563,3,104,52,0,562,557,1,0,0,0,562,558,1,0,0,0,562,559,1,0,0,0,
562,560,1,0,0,0,562,561,1,0,0,0,563,95,1,0,0,0,564,568,5,66,0,0,565,567,
3,68,34,0,566,565,1,0,0,0,567,570,1,0,0,0,568,566,1,0,0,0,568,569,1,0,0,
0,569,571,1,0,0,0,570,568,1,0,0,0,571,572,5,67,0,0,572,573,5,8,0,0,573,97,
1,0,0,0,574,575,5,68,0,0,575,576,3,68,34,0,576,99,1,0,0,0,577,578,5,69,0,
0,578,579,5,70,0,0,579,584,5,8,0,0,580,581,5,69,0,0,581,582,5,90,0,0,582,
584,5,8,0,0,583,577,1,0,0,0,583,580,1,0,0,0,584,101,1,0,0,0,585,586,5,71,
0,0,586,587,5,90,0,0,587,588,5,8,0,0,588,103,1,0,0,0,589,590,5,72,0,0,590,
593,5,92,0,0,591,592,5,48,0,0,592,594,3,112,56,0,593,591,1,0,0,0,593,594,
1,0,0,0,594,595,1,0,0,0,595,596,5,8,0,0,596,105,1,0,0,0,597,598,5,73,0,0,
598,599,5,90,0,0,599,600,5,56,0,0,600,601,7,5,0,0,601,617,5,8,0,0,602,603,
5,74,0,0,603,604,5,90,0,0,604,605,5,62,0,0,605,606,5,90,0,0,606,617,5,8,
0,0,607,608,5,75,0,0,608,609,5,90,0,0,609,610,5,48,0,0,610,611,3,114,57,
0,611,612,5,8,0,0,612,617,1,0,0,0,613,614,5,76,0,0,614,615,5,90,0,0,615,
617,5,8,0,0,616,597,1,0,0,0,616,602,1,0,0,0,616,607,1,0,0,0,616,613,1,0,
0,0,617,107,1,0,0,0,618,623,5,90,0,0,619,620,5,9,0,0,620,622,5,90,0,0,621,
619,1,0,0,0,622,625,1,0,0,0,623,621,1,0,0,0,623,624,1,0,0,0,624,109,1,0,
0,0,625,623,1,0,0,0,626,631,5,90,0,0,627,628,5,9,0,0,628,630,5,90,0,0,629,
627,1,0,0,0,630,633,1,0,0,0,631,629,1,0,0,0,631,632,1,0,0,0,632,111,1,0,
0,0,633,631,1,0,0,0,634,639,3,114,57,0,635,636,5,30,0,0,636,638,3,114,57,
0,637,635,1,0,0,0,638,641,1,0,0,0,639,637,1,0,0,0,639,640,1,0,0,0,640,113,
1,0,0,0,641,639,1,0,0,0,642,643,3,116,58,0,643,115,1,0,0,0,644,649,3,118,
59,0,645,646,5,77,0,0,646,648,3,118,59,0,647,645,1,0,0,0,648,651,1,0,0,0,
649,647,1,0,0,0,649,650,1,0,0,0,650,117,1,0,0,0,651,649,1,0,0,0,652,657,
3,120,60,0,653,654,5,78,0,0,654,656,3,120,60,0,655,653,1,0,0,0,656,659,1,
0,0,0,657,655,1,0,0,0,657,658,1,0,0,0,658,119,1,0,0,0,659,657,1,0,0,0,660,
665,3,122,61,0,661,662,7,6,0,0,662,664,3,122,61,0,663,661,1,0,0,0,664,667,
1,0,0,0,665,663,1,0,0,0,665,666,1,0,0,0,666,121,1,0,0,0,667,665,1,0,0,0,
668,673,3,124,62,0,669,670,7,7,0,0,670,672,3,124,62,0,671,669,1,0,0,0,672,
675,1,0,0,0,673,671,1,0,0,0,673,674,1,0,0,0,674,123,1,0,0,0,675,673,1,0,
0,0,676,681,3,126,63,0,677,678,7,8,0,0,678,680,3,126,63,0,679,677,1,0,0,
0,680,683,1,0,0,0,681,679,1,0,0,0,681,682,1,0,0,0,682,125,1,0,0,0,683,681,
1,0,0,0,684,689,3,128,64,0,685,686,7,9,0,0,686,688,3,128,64,0,687,685,1,
0,0,0,688,691,1,0,0,0,689,687,1,0,0,0,689,690,1,0,0,0,690,127,1,0,0,0,691,
689,1,0,0,0,692,693,7,10,0,0,693,696,3,128,64,0,694,696,3,130,65,0,695,692,
1,0,0,0,695,694,1,0,0,0,696,129,1,0,0,0,697,714,5,91,0,0,698,714,5,92,0,
0,699,714,5,88,0,0,700,714,5,89,0,0,701,702,3,110,55,0,702,704,5,25,0,0,
703,705,3,112,56,0,704,703,1,0,0,0,704,705,1,0,0,0,705,706,1,0,0,0,706,707,
5,26,0,0,707,714,1,0,0,0,708,714,3,108,54,0,709,710,5,25,0,0,710,711,3,114,
57,0,711,712,5,26,0,0,712,714,1,0,0,0,713,697,1,0,0,0,713,698,1,0,0,0,713,
699,1,0,0,0,713,700,1,0,0,0,713,701,1,0,0,0,713,708,1,0,0,0,713,709,1,0,
0,0,714,131,1,0,0,0,57,135,148,156,165,168,176,182,186,199,204,213,216,222,
233,243,247,252,263,275,278,286,293,301,309,327,343,359,365,383,391,400,
408,433,453,461,476,487,494,497,520,562,568,583,593,616,623,631,639,649,
657,665,673,681,689,695,704,713];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class PascalishParser extends antlr4.Parser {

    static grammarFileName = "Pascalish.g4";
    static literalNames = [ null, "'on'", "'local'", "'parent'", "'child'", 
                            "'sibling'", "'alternate'", "'program'", "';'", 
                            "'.'", "'service'", "'daemon'", "'refresh'", 
                            "'ms'", "'every'", "'second'", "'seconds'", 
                            "'type'", "'='", "'class'", "'end'", "'extends'", 
                            "':'", "'procedure'", "'function'", "'('", "')'", 
                            "'var'", "'from'", "'librarian'", "','", "'file'", 
                            "'of'", "'queue'", "'['", "'..'", "']'", "'<'", 
                            "'>'", "'stack'", "'priorityqueue'", "'record'", 
                            "'integer'", "'real'", "'boolean'", "'string'", 
                            "'array'", "'begin'", "'with'", "'do'", "':='", 
                            "'call'", "'if'", "'then'", "'else'", "'while'", 
                            "'for'", "'to'", "'repeat'", "'until'", "'enqueue'", 
                            "'dequeue'", "'into'", "'peek'", "'push'", "'pop'", 
                            "'cobegin'", "'coend'", "'async'", "'wait'", 
                            "'all'", "'sync'", "'subflow'", "'open'", "'read'", 
                            "'write'", "'close'", "'or'", "'and'", "'<>'", 
                            "'<='", "'>='", "'+'", "'-'", "'*'", "'/'", 
                            "'mod'", "'not'", "'true'", "'false'" ];
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
                             null, null, null, null, null, null, null, null, 
                             null, null, "IDENT", "NUMBER", "STRING", "LINE_COMMENT", 
                             "BLOCK_COMMENT", "WS" ];
    static ruleNames = [ "compilationUnit", "decl", "placement", "programDecl", 
                         "serviceDecl", "serviceBody", "daemonDecl", "daemonSchedule", 
                         "typeDecl", "classDecl", "classInheritance", "classMember", 
                         "classFieldDecl", "classMethodDecl", "methodParamList", 
                         "methodParamDecl", "varDecl", "varSource", "identList", 
                         "fileDecl", "queueDecl", "queueType", "stackType", 
                         "priorityQueueType", "recordType", "recordField", 
                         "typeRef", "genericTypeParams", "simpleType", "userType", 
                         "genericTypeArgs", "fixedArrayType", "dynamicArrayType", 
                         "block", "statement", "withStmt", "assignStmt", 
                         "callStmt", "ifStmt", "whileStmt", "forStmt", "repeatStmt", 
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
	        this.state = 135;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 7)) & ~0x1f) === 0 && ((1 << (_la - 7)) & 84939801) !== 0)) {
	            this.state = 132;
	            this.decl();
	            this.state = 137;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 138;
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
	        this.state = 148;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 140;
	            this.programDecl();
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 141;
	            this.serviceDecl();
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 142;
	            this.daemonDecl();
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 143;
	            this.typeDecl();
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 144;
	            this.classDecl();
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 145;
	            this.varDecl();
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 146;
	            this.queueDecl();
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 147;
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
	        this.state = 150;
	        this.match(PascalishParser.T__0);
	        this.state = 151;
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
	        this.state = 153;
	        this.match(PascalishParser.T__6);
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
	        this.match(PascalishParser.T__7);
	        this.state = 159;
	        this.block();
	        this.state = 160;
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
	        this.state = 162;
	        this.match(PascalishParser.T__9);
	        this.state = 163;
	        this.match(PascalishParser.IDENT);
	        this.state = 165;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 164;
	            this.placement();
	        }

	        this.state = 168;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 167;
	            this.match(PascalishParser.T__7);
	        }

	        this.state = 170;
	        this.block();
	        this.state = 171;
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



	serviceBody() {
	    let localctx = new ServiceBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, PascalishParser.RULE_serviceBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 176;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 173;
	            this.statement();
	            this.state = 178;
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
	        this.state = 179;
	        this.match(PascalishParser.T__10);
	        this.state = 180;
	        this.match(PascalishParser.IDENT);
	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 181;
	            this.placement();
	        }

	        this.state = 184;
	        this.daemonSchedule();
	        this.state = 186;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 185;
	            this.match(PascalishParser.T__7);
	        }

	        this.state = 188;
	        this.block();
	        this.state = 189;
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



	daemonSchedule() {
	    let localctx = new DaemonScheduleContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, PascalishParser.RULE_daemonSchedule);
	    var _la = 0;
	    try {
	        this.state = 199;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 12:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 191;
	            this.match(PascalishParser.T__11);
	            this.state = 192;
	            this.expr();
	            this.state = 193;
	            this.match(PascalishParser.T__12);
	            break;
	        case 14:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 195;
	            this.match(PascalishParser.T__13);
	            this.state = 196;
	            this.expr();
	            this.state = 197;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 106496) !== 0))) {
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
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 201;
	        this.match(PascalishParser.T__16);
	        this.state = 202;
	        this.match(PascalishParser.IDENT);
	        this.state = 204;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===37) {
	            this.state = 203;
	            this.genericTypeParams();
	        }

	        this.state = 206;
	        this.match(PascalishParser.T__17);
	        this.state = 207;
	        this.typeRef();
	        this.state = 208;
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



	classDecl() {
	    let localctx = new ClassDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, PascalishParser.RULE_classDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 210;
	        this.match(PascalishParser.T__18);
	        this.state = 211;
	        this.match(PascalishParser.IDENT);
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===37) {
	            this.state = 212;
	            this.genericTypeParams();
	        }

	        this.state = 216;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===21) {
	            this.state = 215;
	            this.classInheritance();
	        }

	        this.state = 218;
	        this.match(PascalishParser.T__7);
	        this.state = 222;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===23 || _la===24 || _la===90) {
	            this.state = 219;
	            this.classMember();
	            this.state = 224;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 225;
	        this.match(PascalishParser.T__19);
	        this.state = 226;
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



	classInheritance() {
	    let localctx = new ClassInheritanceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, PascalishParser.RULE_classInheritance);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 228;
	        this.match(PascalishParser.T__20);
	        this.state = 229;
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



	classMember() {
	    let localctx = new ClassMemberContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, PascalishParser.RULE_classMember);
	    try {
	        this.state = 233;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 90:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 231;
	            this.classFieldDecl();
	            break;
	        case 23:
	        case 24:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 232;
	            this.classMethodDecl();
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



	classFieldDecl() {
	    let localctx = new ClassFieldDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, PascalishParser.RULE_classFieldDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 235;
	        this.match(PascalishParser.IDENT);
	        this.state = 236;
	        this.match(PascalishParser.T__21);
	        this.state = 237;
	        this.typeRef();
	        this.state = 238;
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



	classMethodDecl() {
	    let localctx = new ClassMethodDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishParser.RULE_classMethodDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 240;
	        _la = this._input.LA(1);
	        if(!(_la===23 || _la===24)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 241;
	        this.match(PascalishParser.IDENT);
	        this.state = 243;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===37) {
	            this.state = 242;
	            this.genericTypeParams();
	        }

	        this.state = 245;
	        this.match(PascalishParser.T__24);
	        this.state = 247;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===90) {
	            this.state = 246;
	            this.methodParamList();
	        }

	        this.state = 249;
	        this.match(PascalishParser.T__25);
	        this.state = 252;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===22) {
	            this.state = 250;
	            this.match(PascalishParser.T__21);
	            this.state = 251;
	            this.typeRef();
	        }

	        this.state = 254;
	        this.match(PascalishParser.T__7);
	        this.state = 255;
	        this.block();
	        this.state = 256;
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



	methodParamList() {
	    let localctx = new MethodParamListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, PascalishParser.RULE_methodParamList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 258;
	        this.methodParamDecl();
	        this.state = 263;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8) {
	            this.state = 259;
	            this.match(PascalishParser.T__7);
	            this.state = 260;
	            this.methodParamDecl();
	            this.state = 265;
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



	methodParamDecl() {
	    let localctx = new MethodParamDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, PascalishParser.RULE_methodParamDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 266;
	        this.identList();
	        this.state = 267;
	        this.match(PascalishParser.T__21);
	        this.state = 268;
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



	varDecl() {
	    let localctx = new VarDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, PascalishParser.RULE_varDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 270;
	        this.match(PascalishParser.T__26);
	        this.state = 271;
	        this.match(PascalishParser.IDENT);
	        this.state = 272;
	        this.match(PascalishParser.T__21);
	        this.state = 273;
	        this.typeRef();
	        this.state = 275;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 274;
	            this.placement();
	        }

	        this.state = 278;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===28) {
	            this.state = 277;
	            this.varSource();
	        }

	        this.state = 280;
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



	varSource() {
	    let localctx = new VarSourceContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, PascalishParser.RULE_varSource);
	    var _la = 0;
	    try {
	        this.state = 286;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,20,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 282;
	            this.match(PascalishParser.T__27);
	            this.state = 283;
	            this.match(PascalishParser.T__28);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 284;
	            this.match(PascalishParser.T__27);
	            this.state = 285;
	            _la = this._input.LA(1);
	            if(!(_la===90 || _la===92)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
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



	identList() {
	    let localctx = new IdentListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, PascalishParser.RULE_identList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 288;
	        this.match(PascalishParser.IDENT);
	        this.state = 293;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===30) {
	            this.state = 289;
	            this.match(PascalishParser.T__29);
	            this.state = 290;
	            this.match(PascalishParser.IDENT);
	            this.state = 295;
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



	fileDecl() {
	    let localctx = new FileDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, PascalishParser.RULE_fileDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 296;
	        this.match(PascalishParser.T__30);
	        this.state = 297;
	        this.match(PascalishParser.IDENT);
	        this.state = 298;
	        this.match(PascalishParser.T__31);
	        this.state = 299;
	        this.typeRef();
	        this.state = 301;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 300;
	            this.placement();
	        }

	        this.state = 303;
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
	    this.enterRule(localctx, 40, PascalishParser.RULE_queueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 305;
	        this.match(PascalishParser.T__32);
	        this.state = 306;
	        this.match(PascalishParser.IDENT);
	        this.state = 307;
	        this.queueType();
	        this.state = 309;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 308;
	            this.placement();
	        }

	        this.state = 311;
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
	    this.enterRule(localctx, 42, PascalishParser.RULE_queueType);
	    try {
	        this.state = 327;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,24,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 313;
	            this.match(PascalishParser.T__32);
	            this.state = 314;
	            this.match(PascalishParser.T__33);
	            this.state = 315;
	            this.expr();
	            this.state = 316;
	            this.match(PascalishParser.T__34);
	            this.state = 317;
	            this.expr();
	            this.state = 318;
	            this.match(PascalishParser.T__35);
	            this.state = 319;
	            this.match(PascalishParser.T__31);
	            this.state = 320;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 322;
	            this.match(PascalishParser.T__32);
	            this.state = 323;
	            this.match(PascalishParser.T__36);
	            this.state = 324;
	            this.typeRef();
	            this.state = 325;
	            this.match(PascalishParser.T__37);
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
	    this.enterRule(localctx, 44, PascalishParser.RULE_stackType);
	    try {
	        this.state = 343;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,25,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 329;
	            this.match(PascalishParser.T__38);
	            this.state = 330;
	            this.match(PascalishParser.T__33);
	            this.state = 331;
	            this.expr();
	            this.state = 332;
	            this.match(PascalishParser.T__34);
	            this.state = 333;
	            this.expr();
	            this.state = 334;
	            this.match(PascalishParser.T__35);
	            this.state = 335;
	            this.match(PascalishParser.T__31);
	            this.state = 336;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 338;
	            this.match(PascalishParser.T__38);
	            this.state = 339;
	            this.match(PascalishParser.T__36);
	            this.state = 340;
	            this.typeRef();
	            this.state = 341;
	            this.match(PascalishParser.T__37);
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
	    this.enterRule(localctx, 46, PascalishParser.RULE_priorityQueueType);
	    try {
	        this.state = 359;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,26,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 345;
	            this.match(PascalishParser.T__39);
	            this.state = 346;
	            this.match(PascalishParser.T__33);
	            this.state = 347;
	            this.expr();
	            this.state = 348;
	            this.match(PascalishParser.T__34);
	            this.state = 349;
	            this.expr();
	            this.state = 350;
	            this.match(PascalishParser.T__35);
	            this.state = 351;
	            this.match(PascalishParser.T__31);
	            this.state = 352;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 354;
	            this.match(PascalishParser.T__39);
	            this.state = 355;
	            this.match(PascalishParser.T__36);
	            this.state = 356;
	            this.typeRef();
	            this.state = 357;
	            this.match(PascalishParser.T__37);
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
	    this.enterRule(localctx, 48, PascalishParser.RULE_recordType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 361;
	        this.match(PascalishParser.T__40);
	        this.state = 365;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===90) {
	            this.state = 362;
	            this.recordField();
	            this.state = 367;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 368;
	        this.match(PascalishParser.T__19);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 50, PascalishParser.RULE_recordField);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 370;
	        this.match(PascalishParser.IDENT);
	        this.state = 371;
	        this.match(PascalishParser.T__21);
	        this.state = 372;
	        this.typeRef();
	        this.state = 373;
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
	    this.enterRule(localctx, 52, PascalishParser.RULE_typeRef);
	    try {
	        this.state = 383;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,28,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 375;
	            this.simpleType();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 376;
	            this.recordType();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 377;
	            this.queueType();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 378;
	            this.stackType();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 379;
	            this.priorityQueueType();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 380;
	            this.fixedArrayType();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 381;
	            this.dynamicArrayType();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 382;
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



	genericTypeParams() {
	    let localctx = new GenericTypeParamsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 54, PascalishParser.RULE_genericTypeParams);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 385;
	        this.match(PascalishParser.T__36);
	        this.state = 386;
	        this.match(PascalishParser.IDENT);
	        this.state = 391;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===30) {
	            this.state = 387;
	            this.match(PascalishParser.T__29);
	            this.state = 388;
	            this.match(PascalishParser.IDENT);
	            this.state = 393;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 394;
	        this.match(PascalishParser.T__37);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 56, PascalishParser.RULE_simpleType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 396;
	        _la = this._input.LA(1);
	        if(!(((((_la - 42)) & ~0x1f) === 0 && ((1 << (_la - 42)) & 15) !== 0))) {
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
	    this.enterRule(localctx, 58, PascalishParser.RULE_userType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 398;
	        this.match(PascalishParser.IDENT);
	        this.state = 400;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===37) {
	            this.state = 399;
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
	    this.enterRule(localctx, 60, PascalishParser.RULE_genericTypeArgs);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 402;
	        this.match(PascalishParser.T__36);
	        this.state = 403;
	        this.typeRef();
	        this.state = 408;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===30) {
	            this.state = 404;
	            this.match(PascalishParser.T__29);
	            this.state = 405;
	            this.typeRef();
	            this.state = 410;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 411;
	        this.match(PascalishParser.T__37);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 62, PascalishParser.RULE_fixedArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 413;
	        this.match(PascalishParser.T__45);
	        this.state = 414;
	        this.match(PascalishParser.T__33);
	        this.state = 415;
	        this.expr();
	        this.state = 416;
	        this.match(PascalishParser.T__34);
	        this.state = 417;
	        this.expr();
	        this.state = 418;
	        this.match(PascalishParser.T__35);
	        this.state = 419;
	        this.match(PascalishParser.T__31);
	        this.state = 420;
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
	    this.enterRule(localctx, 64, PascalishParser.RULE_dynamicArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 422;
	        this.match(PascalishParser.T__45);
	        this.state = 423;
	        this.match(PascalishParser.T__36);
	        this.state = 424;
	        this.typeRef();
	        this.state = 425;
	        this.match(PascalishParser.T__37);
	        this.state = 426;
	        this.match(PascalishParser.T__31);
	        this.state = 427;
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
	    this.enterRule(localctx, 66, PascalishParser.RULE_block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 429;
	        this.match(PascalishParser.T__46);
	        this.state = 433;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 430;
	            this.statement();
	            this.state = 435;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 436;
	        this.match(PascalishParser.T__19);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 68, PascalishParser.RULE_statement);
	    try {
	        this.state = 453;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 90:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 438;
	            this.assignStmt();
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 439;
	            this.callStmt();
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 440;
	            this.ifStmt();
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 441;
	            this.whileStmt();
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 442;
	            this.forStmt();
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 443;
	            this.repeatStmt();
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 444;
	            this.withStmt();
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 445;
	            this.block();
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 446;
	            this.enqueueStmt();
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 447;
	            this.dequeueStmt();
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 448;
	            this.peekStmt();
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 449;
	            this.pushStmt();
	            break;
	        case 65:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 450;
	            this.popStmt();
	            break;
	        case 66:
	        case 68:
	        case 69:
	        case 71:
	        case 72:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 451;
	            this.concurrentStmt();
	            break;
	        case 73:
	        case 74:
	        case 75:
	        case 76:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 452;
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



	withStmt() {
	    let localctx = new WithStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 70, PascalishParser.RULE_withStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 455;
	        this.match(PascalishParser.T__47);
	        this.state = 456;
	        this.expr();
	        this.state = 457;
	        this.match(PascalishParser.T__48);
	        this.state = 461;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 458;
	            this.statement();
	            this.state = 463;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 464;
	        this.match(PascalishParser.T__19);
	        this.state = 465;
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



	assignStmt() {
	    let localctx = new AssignStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 72, PascalishParser.RULE_assignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 467;
	        this.lvalue();
	        this.state = 468;
	        this.match(PascalishParser.T__49);
	        this.state = 469;
	        this.expr();
	        this.state = 470;
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
	    this.enterRule(localctx, 74, PascalishParser.RULE_callStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 472;
	        this.match(PascalishParser.T__50);
	        this.state = 473;
	        this.qualifiedName();
	        this.state = 474;
	        this.match(PascalishParser.T__24);
	        this.state = 476;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===25 || ((((_la - 83)) & ~0x1f) === 0 && ((1 << (_la - 83)) & 1009) !== 0)) {
	            this.state = 475;
	            this.exprList();
	        }

	        this.state = 478;
	        this.match(PascalishParser.T__25);
	        this.state = 479;
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
	    this.enterRule(localctx, 76, PascalishParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 481;
	        this.match(PascalishParser.T__51);
	        this.state = 482;
	        this.expr();
	        this.state = 483;
	        this.match(PascalishParser.T__52);
	        this.state = 487;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 484;
	            this.statement();
	            this.state = 489;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 497;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===54) {
	            this.state = 490;
	            this.match(PascalishParser.T__53);
	            this.state = 494;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	                this.state = 491;
	                this.statement();
	                this.state = 496;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 499;
	        this.match(PascalishParser.T__19);
	        this.state = 500;
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
	    this.enterRule(localctx, 78, PascalishParser.RULE_whileStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 502;
	        this.match(PascalishParser.T__54);
	        this.state = 503;
	        this.expr();
	        this.state = 504;
	        this.match(PascalishParser.T__48);
	        this.state = 505;
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
	    this.enterRule(localctx, 80, PascalishParser.RULE_forStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 507;
	        this.match(PascalishParser.T__55);
	        this.state = 508;
	        this.match(PascalishParser.IDENT);
	        this.state = 509;
	        this.match(PascalishParser.T__49);
	        this.state = 510;
	        this.expr();
	        this.state = 511;
	        this.match(PascalishParser.T__56);
	        this.state = 512;
	        this.expr();
	        this.state = 513;
	        this.match(PascalishParser.T__48);
	        this.state = 514;
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
	    this.enterRule(localctx, 82, PascalishParser.RULE_repeatStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 516;
	        this.match(PascalishParser.T__57);
	        this.state = 520;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 517;
	            this.statement();
	            this.state = 522;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 523;
	        this.match(PascalishParser.T__58);
	        this.state = 524;
	        this.expr();
	        this.state = 525;
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
	    this.enterRule(localctx, 84, PascalishParser.RULE_enqueueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 527;
	        this.match(PascalishParser.T__59);
	        this.state = 528;
	        this.match(PascalishParser.IDENT);
	        this.state = 529;
	        this.match(PascalishParser.T__47);
	        this.state = 530;
	        this.expr();
	        this.state = 531;
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
	    this.enterRule(localctx, 86, PascalishParser.RULE_dequeueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 533;
	        this.match(PascalishParser.T__60);
	        this.state = 534;
	        this.match(PascalishParser.IDENT);
	        this.state = 535;
	        this.match(PascalishParser.T__61);
	        this.state = 536;
	        this.match(PascalishParser.IDENT);
	        this.state = 537;
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
	    this.enterRule(localctx, 88, PascalishParser.RULE_peekStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 539;
	        this.match(PascalishParser.T__62);
	        this.state = 540;
	        this.match(PascalishParser.IDENT);
	        this.state = 541;
	        this.match(PascalishParser.T__61);
	        this.state = 542;
	        this.match(PascalishParser.IDENT);
	        this.state = 543;
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
	    this.enterRule(localctx, 90, PascalishParser.RULE_pushStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 545;
	        this.match(PascalishParser.T__63);
	        this.state = 546;
	        this.match(PascalishParser.IDENT);
	        this.state = 547;
	        this.match(PascalishParser.T__47);
	        this.state = 548;
	        this.expr();
	        this.state = 549;
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
	    this.enterRule(localctx, 92, PascalishParser.RULE_popStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 551;
	        this.match(PascalishParser.T__64);
	        this.state = 552;
	        this.match(PascalishParser.IDENT);
	        this.state = 553;
	        this.match(PascalishParser.T__61);
	        this.state = 554;
	        this.match(PascalishParser.IDENT);
	        this.state = 555;
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
	    this.enterRule(localctx, 94, PascalishParser.RULE_concurrentStmt);
	    try {
	        this.state = 562;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 66:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 557;
	            this.cobeginStmt();
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 558;
	            this.asyncStmt();
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 559;
	            this.waitStmt();
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 560;
	            this.syncStmt();
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 561;
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
	    this.enterRule(localctx, 96, PascalishParser.RULE_cobeginStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 564;
	        this.match(PascalishParser.T__65);
	        this.state = 568;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 47)) & ~0x1f) === 0 && ((1 << (_la - 47)) & 1064266547) !== 0) || _la===90) {
	            this.state = 565;
	            this.statement();
	            this.state = 570;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 571;
	        this.match(PascalishParser.T__66);
	        this.state = 572;
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
	    this.enterRule(localctx, 98, PascalishParser.RULE_asyncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 574;
	        this.match(PascalishParser.T__67);
	        this.state = 575;
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
	    this.enterRule(localctx, 100, PascalishParser.RULE_waitStmt);
	    try {
	        this.state = 583;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,42,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 577;
	            this.match(PascalishParser.T__68);
	            this.state = 578;
	            this.match(PascalishParser.T__69);
	            this.state = 579;
	            this.match(PascalishParser.T__7);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 580;
	            this.match(PascalishParser.T__68);
	            this.state = 581;
	            this.match(PascalishParser.IDENT);
	            this.state = 582;
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
	    this.enterRule(localctx, 102, PascalishParser.RULE_syncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 585;
	        this.match(PascalishParser.T__70);
	        this.state = 586;
	        this.match(PascalishParser.IDENT);
	        this.state = 587;
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
	    this.enterRule(localctx, 104, PascalishParser.RULE_subflowStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 589;
	        this.match(PascalishParser.T__71);
	        this.state = 590;
	        this.match(PascalishParser.STRING);
	        this.state = 593;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===48) {
	            this.state = 591;
	            this.match(PascalishParser.T__47);
	            this.state = 592;
	            this.exprList();
	        }

	        this.state = 595;
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
	    this.enterRule(localctx, 106, PascalishParser.RULE_fileStmt);
	    var _la = 0;
	    try {
	        this.state = 616;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 73:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 597;
	            this.match(PascalishParser.T__72);
	            this.state = 598;
	            this.match(PascalishParser.IDENT);
	            this.state = 599;
	            this.match(PascalishParser.T__55);
	            this.state = 600;
	            _la = this._input.LA(1);
	            if(!(_la===74 || _la===75)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 601;
	            this.match(PascalishParser.T__7);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 602;
	            this.match(PascalishParser.T__73);
	            this.state = 603;
	            this.match(PascalishParser.IDENT);
	            this.state = 604;
	            this.match(PascalishParser.T__61);
	            this.state = 605;
	            this.match(PascalishParser.IDENT);
	            this.state = 606;
	            this.match(PascalishParser.T__7);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 607;
	            this.match(PascalishParser.T__74);
	            this.state = 608;
	            this.match(PascalishParser.IDENT);
	            this.state = 609;
	            this.match(PascalishParser.T__47);
	            this.state = 610;
	            this.expr();
	            this.state = 611;
	            this.match(PascalishParser.T__7);
	            break;
	        case 76:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 613;
	            this.match(PascalishParser.T__75);
	            this.state = 614;
	            this.match(PascalishParser.IDENT);
	            this.state = 615;
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
	    this.enterRule(localctx, 108, PascalishParser.RULE_lvalue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 618;
	        this.match(PascalishParser.IDENT);
	        this.state = 623;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 619;
	            this.match(PascalishParser.T__8);
	            this.state = 620;
	            this.match(PascalishParser.IDENT);
	            this.state = 625;
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
	    this.enterRule(localctx, 110, PascalishParser.RULE_qualifiedName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 626;
	        this.match(PascalishParser.IDENT);
	        this.state = 631;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 627;
	            this.match(PascalishParser.T__8);
	            this.state = 628;
	            this.match(PascalishParser.IDENT);
	            this.state = 633;
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
	    this.enterRule(localctx, 112, PascalishParser.RULE_exprList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 634;
	        this.expr();
	        this.state = 639;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===30) {
	            this.state = 635;
	            this.match(PascalishParser.T__29);
	            this.state = 636;
	            this.expr();
	            this.state = 641;
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
	    this.enterRule(localctx, 114, PascalishParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 642;
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
	    this.enterRule(localctx, 116, PascalishParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 644;
	        this.logicalAndExpr();
	        this.state = 649;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===77) {
	            this.state = 645;
	            this.match(PascalishParser.T__76);
	            this.state = 646;
	            this.logicalAndExpr();
	            this.state = 651;
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
	    this.enterRule(localctx, 118, PascalishParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 652;
	        this.equalityExpr();
	        this.state = 657;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===78) {
	            this.state = 653;
	            this.match(PascalishParser.T__77);
	            this.state = 654;
	            this.equalityExpr();
	            this.state = 659;
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
	    this.enterRule(localctx, 120, PascalishParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 660;
	        this.relationalExpr();
	        this.state = 665;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===18 || _la===79) {
	            this.state = 661;
	            _la = this._input.LA(1);
	            if(!(_la===18 || _la===79)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 662;
	            this.relationalExpr();
	            this.state = 667;
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
	    this.enterRule(localctx, 122, PascalishParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 668;
	        this.additiveExpr();
	        this.state = 673;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===37 || _la===38 || _la===80 || _la===81) {
	            this.state = 669;
	            _la = this._input.LA(1);
	            if(!(_la===37 || _la===38 || _la===80 || _la===81)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 670;
	            this.additiveExpr();
	            this.state = 675;
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
	    this.enterRule(localctx, 124, PascalishParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 676;
	        this.multiplicativeExpr();
	        this.state = 681;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===82 || _la===83) {
	            this.state = 677;
	            _la = this._input.LA(1);
	            if(!(_la===82 || _la===83)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 678;
	            this.multiplicativeExpr();
	            this.state = 683;
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
	    this.enterRule(localctx, 126, PascalishParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 684;
	        this.unaryExpr();
	        this.state = 689;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 84)) & ~0x1f) === 0 && ((1 << (_la - 84)) & 7) !== 0)) {
	            this.state = 685;
	            _la = this._input.LA(1);
	            if(!(((((_la - 84)) & ~0x1f) === 0 && ((1 << (_la - 84)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 686;
	            this.unaryExpr();
	            this.state = 691;
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
	    this.enterRule(localctx, 128, PascalishParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 695;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 83:
	        case 87:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 692;
	            _la = this._input.LA(1);
	            if(!(_la===83 || _la===87)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 693;
	            this.unaryExpr();
	            break;
	        case 25:
	        case 88:
	        case 89:
	        case 90:
	        case 91:
	        case 92:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 694;
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
	    this.enterRule(localctx, 130, PascalishParser.RULE_primaryExpr);
	    var _la = 0;
	    try {
	        this.state = 713;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,56,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 697;
	            this.match(PascalishParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 698;
	            this.match(PascalishParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 699;
	            this.match(PascalishParser.T__87);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 700;
	            this.match(PascalishParser.T__88);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 701;
	            this.qualifiedName();
	            this.state = 702;
	            this.match(PascalishParser.T__24);
	            this.state = 704;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===25 || ((((_la - 83)) & ~0x1f) === 0 && ((1 << (_la - 83)) & 1009) !== 0)) {
	                this.state = 703;
	                this.exprList();
	            }

	            this.state = 706;
	            this.match(PascalishParser.T__25);
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 708;
	            this.lvalue();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 709;
	            this.match(PascalishParser.T__24);
	            this.state = 710;
	            this.expr();
	            this.state = 711;
	            this.match(PascalishParser.T__25);
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
PascalishParser.T__83 = 84;
PascalishParser.T__84 = 85;
PascalishParser.T__85 = 86;
PascalishParser.T__86 = 87;
PascalishParser.T__87 = 88;
PascalishParser.T__88 = 89;
PascalishParser.IDENT = 90;
PascalishParser.NUMBER = 91;
PascalishParser.STRING = 92;
PascalishParser.LINE_COMMENT = 93;
PascalishParser.BLOCK_COMMENT = 94;
PascalishParser.WS = 95;

PascalishParser.RULE_compilationUnit = 0;
PascalishParser.RULE_decl = 1;
PascalishParser.RULE_placement = 2;
PascalishParser.RULE_programDecl = 3;
PascalishParser.RULE_serviceDecl = 4;
PascalishParser.RULE_serviceBody = 5;
PascalishParser.RULE_daemonDecl = 6;
PascalishParser.RULE_daemonSchedule = 7;
PascalishParser.RULE_typeDecl = 8;
PascalishParser.RULE_classDecl = 9;
PascalishParser.RULE_classInheritance = 10;
PascalishParser.RULE_classMember = 11;
PascalishParser.RULE_classFieldDecl = 12;
PascalishParser.RULE_classMethodDecl = 13;
PascalishParser.RULE_methodParamList = 14;
PascalishParser.RULE_methodParamDecl = 15;
PascalishParser.RULE_varDecl = 16;
PascalishParser.RULE_varSource = 17;
PascalishParser.RULE_identList = 18;
PascalishParser.RULE_fileDecl = 19;
PascalishParser.RULE_queueDecl = 20;
PascalishParser.RULE_queueType = 21;
PascalishParser.RULE_stackType = 22;
PascalishParser.RULE_priorityQueueType = 23;
PascalishParser.RULE_recordType = 24;
PascalishParser.RULE_recordField = 25;
PascalishParser.RULE_typeRef = 26;
PascalishParser.RULE_genericTypeParams = 27;
PascalishParser.RULE_simpleType = 28;
PascalishParser.RULE_userType = 29;
PascalishParser.RULE_genericTypeArgs = 30;
PascalishParser.RULE_fixedArrayType = 31;
PascalishParser.RULE_dynamicArrayType = 32;
PascalishParser.RULE_block = 33;
PascalishParser.RULE_statement = 34;
PascalishParser.RULE_withStmt = 35;
PascalishParser.RULE_assignStmt = 36;
PascalishParser.RULE_callStmt = 37;
PascalishParser.RULE_ifStmt = 38;
PascalishParser.RULE_whileStmt = 39;
PascalishParser.RULE_forStmt = 40;
PascalishParser.RULE_repeatStmt = 41;
PascalishParser.RULE_enqueueStmt = 42;
PascalishParser.RULE_dequeueStmt = 43;
PascalishParser.RULE_peekStmt = 44;
PascalishParser.RULE_pushStmt = 45;
PascalishParser.RULE_popStmt = 46;
PascalishParser.RULE_concurrentStmt = 47;
PascalishParser.RULE_cobeginStmt = 48;
PascalishParser.RULE_asyncStmt = 49;
PascalishParser.RULE_waitStmt = 50;
PascalishParser.RULE_syncStmt = 51;
PascalishParser.RULE_subflowStmt = 52;
PascalishParser.RULE_fileStmt = 53;
PascalishParser.RULE_lvalue = 54;
PascalishParser.RULE_qualifiedName = 55;
PascalishParser.RULE_exprList = 56;
PascalishParser.RULE_expr = 57;
PascalishParser.RULE_logicalOrExpr = 58;
PascalishParser.RULE_logicalAndExpr = 59;
PascalishParser.RULE_equalityExpr = 60;
PascalishParser.RULE_relationalExpr = 61;
PascalishParser.RULE_additiveExpr = 62;
PascalishParser.RULE_multiplicativeExpr = 63;
PascalishParser.RULE_unaryExpr = 64;
PascalishParser.RULE_primaryExpr = 65;

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

	classDecl() {
	    return this.getTypedRuleContext(ClassDeclContext,0);
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

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
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

	genericTypeParams() {
	    return this.getTypedRuleContext(GenericTypeParamsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitTypeDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_classDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	genericTypeParams() {
	    return this.getTypedRuleContext(GenericTypeParamsContext,0);
	};

	classInheritance() {
	    return this.getTypedRuleContext(ClassInheritanceContext,0);
	};

	classMember = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClassMemberContext);
	    } else {
	        return this.getTypedRuleContext(ClassMemberContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitClassDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassInheritanceContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_classInheritance;
    }

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitClassInheritance(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassMemberContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_classMember;
    }

	classFieldDecl() {
	    return this.getTypedRuleContext(ClassFieldDeclContext,0);
	};

	classMethodDecl() {
	    return this.getTypedRuleContext(ClassMethodDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitClassMember(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassFieldDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_classFieldDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitClassFieldDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClassMethodDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_classMethodDecl;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	genericTypeParams() {
	    return this.getTypedRuleContext(GenericTypeParamsContext,0);
	};

	methodParamList() {
	    return this.getTypedRuleContext(MethodParamListContext,0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitClassMethodDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MethodParamListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_methodParamList;
    }

	methodParamDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MethodParamDeclContext);
	    } else {
	        return this.getTypedRuleContext(MethodParamDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitMethodParamList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MethodParamDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_methodParamDecl;
    }

	identList() {
	    return this.getTypedRuleContext(IdentListContext,0);
	};

	typeRef() {
	    return this.getTypedRuleContext(TypeRefContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitMethodParamDecl(this);
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

	varSource() {
	    return this.getTypedRuleContext(VarSourceContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
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
        this.ruleIndex = PascalishParser.RULE_varSource;
    }

	IDENT() {
	    return this.getToken(PascalishParser.IDENT, 0);
	};

	STRING() {
	    return this.getToken(PascalishParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitVarSource(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IdentListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_identList;
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
	        return visitor.visitIdentList(this);
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



class GenericTypeParamsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_genericTypeParams;
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
	        return visitor.visitGenericTypeParams(this);
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

	genericTypeArgs() {
	    return this.getTypedRuleContext(GenericTypeArgsContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitUserType(this);
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
        this.ruleIndex = PascalishParser.RULE_genericTypeArgs;
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
	        return visitor.visitGenericTypeArgs(this);
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

	withStmt() {
	    return this.getTypedRuleContext(WithStmtContext,0);
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



class WithStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = PascalishParser.RULE_withStmt;
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
	        return visitor.visitWithStmt(this);
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
PascalishParser.ClassDeclContext = ClassDeclContext; 
PascalishParser.ClassInheritanceContext = ClassInheritanceContext; 
PascalishParser.ClassMemberContext = ClassMemberContext; 
PascalishParser.ClassFieldDeclContext = ClassFieldDeclContext; 
PascalishParser.ClassMethodDeclContext = ClassMethodDeclContext; 
PascalishParser.MethodParamListContext = MethodParamListContext; 
PascalishParser.MethodParamDeclContext = MethodParamDeclContext; 
PascalishParser.VarDeclContext = VarDeclContext; 
PascalishParser.VarSourceContext = VarSourceContext; 
PascalishParser.IdentListContext = IdentListContext; 
PascalishParser.FileDeclContext = FileDeclContext; 
PascalishParser.QueueDeclContext = QueueDeclContext; 
PascalishParser.QueueTypeContext = QueueTypeContext; 
PascalishParser.StackTypeContext = StackTypeContext; 
PascalishParser.PriorityQueueTypeContext = PriorityQueueTypeContext; 
PascalishParser.RecordTypeContext = RecordTypeContext; 
PascalishParser.RecordFieldContext = RecordFieldContext; 
PascalishParser.TypeRefContext = TypeRefContext; 
PascalishParser.GenericTypeParamsContext = GenericTypeParamsContext; 
PascalishParser.SimpleTypeContext = SimpleTypeContext; 
PascalishParser.UserTypeContext = UserTypeContext; 
PascalishParser.GenericTypeArgsContext = GenericTypeArgsContext; 
PascalishParser.FixedArrayTypeContext = FixedArrayTypeContext; 
PascalishParser.DynamicArrayTypeContext = DynamicArrayTypeContext; 
PascalishParser.BlockContext = BlockContext; 
PascalishParser.StatementContext = StatementContext; 
PascalishParser.WithStmtContext = WithStmtContext; 
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
