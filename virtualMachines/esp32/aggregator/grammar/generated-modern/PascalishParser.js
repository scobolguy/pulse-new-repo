// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Pascalish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishVisitor from './PascalishVisitor.js';

const serializedATN = [4,1,93,690,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,
2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,46,7,46,2,47,7,47,2,48,7,48,2,
49,7,49,2,50,7,50,2,51,7,51,2,52,7,52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,
7,56,2,57,7,57,2,58,7,58,2,59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,
63,1,0,5,0,130,8,0,10,0,12,0,133,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
1,1,3,1,145,8,1,1,2,1,2,1,2,1,3,1,3,1,3,3,3,153,8,3,1,3,1,3,1,3,1,3,1,4,
1,4,1,4,3,4,162,8,4,1,4,3,4,165,8,4,1,4,1,4,1,4,1,5,5,5,171,8,5,10,5,12,
5,174,9,5,1,6,1,6,1,6,3,6,179,8,6,1,6,1,6,3,6,183,8,6,1,6,1,6,1,6,1,7,1,
7,1,7,1,7,1,7,1,7,1,7,1,7,3,7,196,8,7,1,8,1,8,1,8,3,8,201,8,8,1,8,1,8,1,
8,1,8,1,9,1,9,1,9,3,9,210,8,9,1,9,3,9,213,8,9,1,9,1,9,5,9,217,8,9,10,9,12,
9,220,9,9,1,9,1,9,1,9,1,10,1,10,1,10,1,11,1,11,3,11,230,8,11,1,12,1,12,1,
12,1,12,1,12,1,13,1,13,1,13,3,13,240,8,13,1,13,1,13,3,13,244,8,13,1,13,1,
13,1,13,3,13,249,8,13,1,13,1,13,1,13,1,13,1,14,1,14,1,14,5,14,258,8,14,10,
14,12,14,261,9,14,1,15,1,15,1,15,1,15,1,16,1,16,1,16,1,16,1,16,3,16,272,
8,16,1,16,1,16,1,17,1,17,1,17,5,17,279,8,17,10,17,12,17,282,9,17,1,18,1,
18,1,18,1,18,1,18,3,18,289,8,18,1,18,1,18,1,19,1,19,1,19,1,19,3,19,297,8,
19,1,19,1,19,1,20,1,20,1,20,1,20,1,20,1,20,1,20,1,20,1,20,1,20,1,20,1,20,
1,20,1,20,3,20,315,8,20,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,
1,21,1,21,1,21,1,21,3,21,331,8,21,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,
1,22,1,22,1,22,1,22,1,22,1,22,3,22,347,8,22,1,23,1,23,5,23,351,8,23,10,23,
12,23,354,9,23,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,25,1,25,1,25,1,25,1,
25,1,25,1,25,1,25,3,25,371,8,25,1,26,1,26,1,26,1,26,5,26,377,8,26,10,26,
12,26,380,9,26,1,26,1,26,1,27,1,27,1,28,1,28,3,28,388,8,28,1,29,1,29,1,29,
1,29,5,29,394,8,29,10,29,12,29,397,9,29,1,29,1,29,1,30,1,30,1,30,1,30,1,
30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,5,32,
419,8,32,10,32,12,32,422,9,32,1,32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,
33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,3,33,440,8,33,1,34,1,34,1,34,1,34,
1,34,1,35,1,35,1,35,1,35,3,35,451,8,35,1,35,1,35,1,35,1,36,1,36,1,36,1,36,
5,36,460,8,36,10,36,12,36,463,9,36,1,36,1,36,5,36,467,8,36,10,36,12,36,470,
9,36,3,36,472,8,36,1,36,1,36,1,36,1,37,1,37,1,37,1,37,1,37,1,38,1,38,1,38,
1,38,1,38,1,38,1,38,1,38,1,38,1,39,1,39,5,39,493,8,39,10,39,12,39,496,9,
39,1,39,1,39,1,39,1,39,1,40,1,40,1,40,1,40,1,40,1,40,1,41,1,41,1,41,1,41,
1,41,1,41,1,42,1,42,1,42,1,42,1,42,1,42,1,43,1,43,1,43,1,43,1,43,1,43,1,
44,1,44,1,44,1,44,1,44,1,44,1,45,1,45,1,45,1,45,1,45,3,45,537,8,45,1,46,
1,46,5,46,541,8,46,10,46,12,46,544,9,46,1,46,1,46,1,46,1,47,1,47,1,47,1,
48,1,48,1,48,1,48,1,48,1,48,3,48,558,8,48,1,49,1,49,1,49,1,49,1,50,1,50,
1,50,1,50,3,50,568,8,50,1,50,1,50,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,
1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,3,51,591,8,51,1,52,
1,52,1,52,5,52,596,8,52,10,52,12,52,599,9,52,1,53,1,53,1,53,5,53,604,8,53,
10,53,12,53,607,9,53,1,54,1,54,1,54,5,54,612,8,54,10,54,12,54,615,9,54,1,
55,1,55,1,56,1,56,1,56,5,56,622,8,56,10,56,12,56,625,9,56,1,57,1,57,1,57,
5,57,630,8,57,10,57,12,57,633,9,57,1,58,1,58,1,58,5,58,638,8,58,10,58,12,
58,641,9,58,1,59,1,59,1,59,5,59,646,8,59,10,59,12,59,649,9,59,1,60,1,60,
1,60,5,60,654,8,60,10,60,12,60,657,9,60,1,61,1,61,1,61,5,61,662,8,61,10,
61,12,61,665,9,61,1,62,1,62,1,62,3,62,670,8,62,1,63,1,63,1,63,1,63,1,63,
1,63,1,63,3,63,679,8,63,1,63,1,63,1,63,1,63,1,63,1,63,1,63,3,63,688,8,63,
1,63,0,0,64,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,
44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,
92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,0,10,
1,0,2,6,2,0,13,13,15,16,1,0,23,24,1,0,40,43,1,0,72,73,2,0,18,18,77,77,2,
0,35,36,78,79,1,0,80,81,1,0,82,84,2,0,81,81,85,85,713,0,131,1,0,0,0,2,144,
1,0,0,0,4,146,1,0,0,0,6,149,1,0,0,0,8,158,1,0,0,0,10,172,1,0,0,0,12,175,
1,0,0,0,14,195,1,0,0,0,16,197,1,0,0,0,18,206,1,0,0,0,20,224,1,0,0,0,22,229,
1,0,0,0,24,231,1,0,0,0,26,236,1,0,0,0,28,254,1,0,0,0,30,262,1,0,0,0,32,266,
1,0,0,0,34,275,1,0,0,0,36,283,1,0,0,0,38,292,1,0,0,0,40,314,1,0,0,0,42,330,
1,0,0,0,44,346,1,0,0,0,46,348,1,0,0,0,48,357,1,0,0,0,50,370,1,0,0,0,52,372,
1,0,0,0,54,383,1,0,0,0,56,385,1,0,0,0,58,389,1,0,0,0,60,400,1,0,0,0,62,409,
1,0,0,0,64,416,1,0,0,0,66,439,1,0,0,0,68,441,1,0,0,0,70,446,1,0,0,0,72,455,
1,0,0,0,74,476,1,0,0,0,76,481,1,0,0,0,78,490,1,0,0,0,80,501,1,0,0,0,82,507,
1,0,0,0,84,513,1,0,0,0,86,519,1,0,0,0,88,525,1,0,0,0,90,536,1,0,0,0,92,538,
1,0,0,0,94,548,1,0,0,0,96,557,1,0,0,0,98,559,1,0,0,0,100,563,1,0,0,0,102,
590,1,0,0,0,104,592,1,0,0,0,106,600,1,0,0,0,108,608,1,0,0,0,110,616,1,0,
0,0,112,618,1,0,0,0,114,626,1,0,0,0,116,634,1,0,0,0,118,642,1,0,0,0,120,
650,1,0,0,0,122,658,1,0,0,0,124,669,1,0,0,0,126,687,1,0,0,0,128,130,3,2,
1,0,129,128,1,0,0,0,130,133,1,0,0,0,131,129,1,0,0,0,131,132,1,0,0,0,132,
134,1,0,0,0,133,131,1,0,0,0,134,135,5,0,0,1,135,1,1,0,0,0,136,145,3,6,3,
0,137,145,3,8,4,0,138,145,3,12,6,0,139,145,3,16,8,0,140,145,3,18,9,0,141,
145,3,32,16,0,142,145,3,38,19,0,143,145,3,36,18,0,144,136,1,0,0,0,144,137,
1,0,0,0,144,138,1,0,0,0,144,139,1,0,0,0,144,140,1,0,0,0,144,141,1,0,0,0,
144,142,1,0,0,0,144,143,1,0,0,0,145,3,1,0,0,0,146,147,5,1,0,0,147,148,7,
0,0,0,148,5,1,0,0,0,149,150,5,7,0,0,150,152,5,88,0,0,151,153,3,4,2,0,152,
151,1,0,0,0,152,153,1,0,0,0,153,154,1,0,0,0,154,155,5,8,0,0,155,156,3,64,
32,0,156,157,5,9,0,0,157,7,1,0,0,0,158,159,5,10,0,0,159,161,5,88,0,0,160,
162,3,4,2,0,161,160,1,0,0,0,161,162,1,0,0,0,162,164,1,0,0,0,163,165,5,8,
0,0,164,163,1,0,0,0,164,165,1,0,0,0,165,166,1,0,0,0,166,167,3,64,32,0,167,
168,5,9,0,0,168,9,1,0,0,0,169,171,3,66,33,0,170,169,1,0,0,0,171,174,1,0,
0,0,172,170,1,0,0,0,172,173,1,0,0,0,173,11,1,0,0,0,174,172,1,0,0,0,175,176,
5,11,0,0,176,178,5,88,0,0,177,179,3,4,2,0,178,177,1,0,0,0,178,179,1,0,0,
0,179,180,1,0,0,0,180,182,3,14,7,0,181,183,5,8,0,0,182,181,1,0,0,0,182,183,
1,0,0,0,183,184,1,0,0,0,184,185,3,64,32,0,185,186,5,9,0,0,186,13,1,0,0,0,
187,188,5,12,0,0,188,189,3,110,55,0,189,190,5,13,0,0,190,196,1,0,0,0,191,
192,5,14,0,0,192,193,3,110,55,0,193,194,7,1,0,0,194,196,1,0,0,0,195,187,
1,0,0,0,195,191,1,0,0,0,196,15,1,0,0,0,197,198,5,17,0,0,198,200,5,88,0,0,
199,201,3,52,26,0,200,199,1,0,0,0,200,201,1,0,0,0,201,202,1,0,0,0,202,203,
5,18,0,0,203,204,3,50,25,0,204,205,5,8,0,0,205,17,1,0,0,0,206,207,5,19,0,
0,207,209,5,88,0,0,208,210,3,52,26,0,209,208,1,0,0,0,209,210,1,0,0,0,210,
212,1,0,0,0,211,213,3,20,10,0,212,211,1,0,0,0,212,213,1,0,0,0,213,214,1,
0,0,0,214,218,5,8,0,0,215,217,3,22,11,0,216,215,1,0,0,0,217,220,1,0,0,0,
218,216,1,0,0,0,218,219,1,0,0,0,219,221,1,0,0,0,220,218,1,0,0,0,221,222,
5,20,0,0,222,223,5,8,0,0,223,19,1,0,0,0,224,225,5,21,0,0,225,226,3,50,25,
0,226,21,1,0,0,0,227,230,3,24,12,0,228,230,3,26,13,0,229,227,1,0,0,0,229,
228,1,0,0,0,230,23,1,0,0,0,231,232,5,88,0,0,232,233,5,22,0,0,233,234,3,50,
25,0,234,235,5,8,0,0,235,25,1,0,0,0,236,237,7,2,0,0,237,239,5,88,0,0,238,
240,3,52,26,0,239,238,1,0,0,0,239,240,1,0,0,0,240,241,1,0,0,0,241,243,5,
25,0,0,242,244,3,28,14,0,243,242,1,0,0,0,243,244,1,0,0,0,244,245,1,0,0,0,
245,248,5,26,0,0,246,247,5,22,0,0,247,249,3,50,25,0,248,246,1,0,0,0,248,
249,1,0,0,0,249,250,1,0,0,0,250,251,5,8,0,0,251,252,3,64,32,0,252,253,5,
8,0,0,253,27,1,0,0,0,254,259,3,30,15,0,255,256,5,8,0,0,256,258,3,30,15,0,
257,255,1,0,0,0,258,261,1,0,0,0,259,257,1,0,0,0,259,260,1,0,0,0,260,29,1,
0,0,0,261,259,1,0,0,0,262,263,3,34,17,0,263,264,5,22,0,0,264,265,3,50,25,
0,265,31,1,0,0,0,266,267,5,27,0,0,267,268,5,88,0,0,268,269,5,22,0,0,269,
271,3,50,25,0,270,272,3,4,2,0,271,270,1,0,0,0,271,272,1,0,0,0,272,273,1,
0,0,0,273,274,5,8,0,0,274,33,1,0,0,0,275,280,5,88,0,0,276,277,5,28,0,0,277,
279,5,88,0,0,278,276,1,0,0,0,279,282,1,0,0,0,280,278,1,0,0,0,280,281,1,0,
0,0,281,35,1,0,0,0,282,280,1,0,0,0,283,284,5,29,0,0,284,285,5,88,0,0,285,
286,5,30,0,0,286,288,3,50,25,0,287,289,3,4,2,0,288,287,1,0,0,0,288,289,1,
0,0,0,289,290,1,0,0,0,290,291,5,8,0,0,291,37,1,0,0,0,292,293,5,31,0,0,293,
294,5,88,0,0,294,296,3,40,20,0,295,297,3,4,2,0,296,295,1,0,0,0,296,297,1,
0,0,0,297,298,1,0,0,0,298,299,5,8,0,0,299,39,1,0,0,0,300,301,5,31,0,0,301,
302,5,32,0,0,302,303,3,110,55,0,303,304,5,33,0,0,304,305,3,110,55,0,305,
306,5,34,0,0,306,307,5,30,0,0,307,308,3,50,25,0,308,315,1,0,0,0,309,310,
5,31,0,0,310,311,5,35,0,0,311,312,3,50,25,0,312,313,5,36,0,0,313,315,1,0,
0,0,314,300,1,0,0,0,314,309,1,0,0,0,315,41,1,0,0,0,316,317,5,37,0,0,317,
318,5,32,0,0,318,319,3,110,55,0,319,320,5,33,0,0,320,321,3,110,55,0,321,
322,5,34,0,0,322,323,5,30,0,0,323,324,3,50,25,0,324,331,1,0,0,0,325,326,
5,37,0,0,326,327,5,35,0,0,327,328,3,50,25,0,328,329,5,36,0,0,329,331,1,0,
0,0,330,316,1,0,0,0,330,325,1,0,0,0,331,43,1,0,0,0,332,333,5,38,0,0,333,
334,5,32,0,0,334,335,3,110,55,0,335,336,5,33,0,0,336,337,3,110,55,0,337,
338,5,34,0,0,338,339,5,30,0,0,339,340,3,50,25,0,340,347,1,0,0,0,341,342,
5,38,0,0,342,343,5,35,0,0,343,344,3,50,25,0,344,345,5,36,0,0,345,347,1,0,
0,0,346,332,1,0,0,0,346,341,1,0,0,0,347,45,1,0,0,0,348,352,5,39,0,0,349,
351,3,48,24,0,350,349,1,0,0,0,351,354,1,0,0,0,352,350,1,0,0,0,352,353,1,
0,0,0,353,355,1,0,0,0,354,352,1,0,0,0,355,356,5,20,0,0,356,47,1,0,0,0,357,
358,5,88,0,0,358,359,5,22,0,0,359,360,3,50,25,0,360,361,5,8,0,0,361,49,1,
0,0,0,362,371,3,54,27,0,363,371,3,46,23,0,364,371,3,40,20,0,365,371,3,42,
21,0,366,371,3,44,22,0,367,371,3,60,30,0,368,371,3,62,31,0,369,371,3,56,
28,0,370,362,1,0,0,0,370,363,1,0,0,0,370,364,1,0,0,0,370,365,1,0,0,0,370,
366,1,0,0,0,370,367,1,0,0,0,370,368,1,0,0,0,370,369,1,0,0,0,371,51,1,0,0,
0,372,373,5,35,0,0,373,378,5,88,0,0,374,375,5,28,0,0,375,377,5,88,0,0,376,
374,1,0,0,0,377,380,1,0,0,0,378,376,1,0,0,0,378,379,1,0,0,0,379,381,1,0,
0,0,380,378,1,0,0,0,381,382,5,36,0,0,382,53,1,0,0,0,383,384,7,3,0,0,384,
55,1,0,0,0,385,387,5,88,0,0,386,388,3,58,29,0,387,386,1,0,0,0,387,388,1,
0,0,0,388,57,1,0,0,0,389,390,5,35,0,0,390,395,3,50,25,0,391,392,5,28,0,0,
392,394,3,50,25,0,393,391,1,0,0,0,394,397,1,0,0,0,395,393,1,0,0,0,395,396,
1,0,0,0,396,398,1,0,0,0,397,395,1,0,0,0,398,399,5,36,0,0,399,59,1,0,0,0,
400,401,5,44,0,0,401,402,5,32,0,0,402,403,3,110,55,0,403,404,5,33,0,0,404,
405,3,110,55,0,405,406,5,34,0,0,406,407,5,30,0,0,407,408,3,50,25,0,408,61,
1,0,0,0,409,410,5,44,0,0,410,411,5,35,0,0,411,412,3,50,25,0,412,413,5,36,
0,0,413,414,5,30,0,0,414,415,3,50,25,0,415,63,1,0,0,0,416,420,5,45,0,0,417,
419,3,66,33,0,418,417,1,0,0,0,419,422,1,0,0,0,420,418,1,0,0,0,420,421,1,
0,0,0,421,423,1,0,0,0,422,420,1,0,0,0,423,424,5,20,0,0,424,65,1,0,0,0,425,
440,3,68,34,0,426,440,3,70,35,0,427,440,3,72,36,0,428,440,3,74,37,0,429,
440,3,76,38,0,430,440,3,78,39,0,431,440,3,64,32,0,432,440,3,80,40,0,433,
440,3,82,41,0,434,440,3,84,42,0,435,440,3,86,43,0,436,440,3,88,44,0,437,
440,3,90,45,0,438,440,3,102,51,0,439,425,1,0,0,0,439,426,1,0,0,0,439,427,
1,0,0,0,439,428,1,0,0,0,439,429,1,0,0,0,439,430,1,0,0,0,439,431,1,0,0,0,
439,432,1,0,0,0,439,433,1,0,0,0,439,434,1,0,0,0,439,435,1,0,0,0,439,436,
1,0,0,0,439,437,1,0,0,0,439,438,1,0,0,0,440,67,1,0,0,0,441,442,3,104,52,
0,442,443,5,46,0,0,443,444,3,110,55,0,444,445,5,8,0,0,445,69,1,0,0,0,446,
447,5,47,0,0,447,448,3,106,53,0,448,450,5,25,0,0,449,451,3,108,54,0,450,
449,1,0,0,0,450,451,1,0,0,0,451,452,1,0,0,0,452,453,5,26,0,0,453,454,5,8,
0,0,454,71,1,0,0,0,455,456,5,48,0,0,456,457,3,110,55,0,457,461,5,49,0,0,
458,460,3,66,33,0,459,458,1,0,0,0,460,463,1,0,0,0,461,459,1,0,0,0,461,462,
1,0,0,0,462,471,1,0,0,0,463,461,1,0,0,0,464,468,5,50,0,0,465,467,3,66,33,
0,466,465,1,0,0,0,467,470,1,0,0,0,468,466,1,0,0,0,468,469,1,0,0,0,469,472,
1,0,0,0,470,468,1,0,0,0,471,464,1,0,0,0,471,472,1,0,0,0,472,473,1,0,0,0,
473,474,5,20,0,0,474,475,5,8,0,0,475,73,1,0,0,0,476,477,5,51,0,0,477,478,
3,110,55,0,478,479,5,52,0,0,479,480,3,66,33,0,480,75,1,0,0,0,481,482,5,53,
0,0,482,483,5,88,0,0,483,484,5,46,0,0,484,485,3,110,55,0,485,486,5,54,0,
0,486,487,3,110,55,0,487,488,5,52,0,0,488,489,3,66,33,0,489,77,1,0,0,0,490,
494,5,55,0,0,491,493,3,66,33,0,492,491,1,0,0,0,493,496,1,0,0,0,494,492,1,
0,0,0,494,495,1,0,0,0,495,497,1,0,0,0,496,494,1,0,0,0,497,498,5,56,0,0,498,
499,3,110,55,0,499,500,5,8,0,0,500,79,1,0,0,0,501,502,5,57,0,0,502,503,5,
88,0,0,503,504,5,58,0,0,504,505,3,110,55,0,505,506,5,8,0,0,506,81,1,0,0,
0,507,508,5,59,0,0,508,509,5,88,0,0,509,510,5,60,0,0,510,511,5,88,0,0,511,
512,5,8,0,0,512,83,1,0,0,0,513,514,5,61,0,0,514,515,5,88,0,0,515,516,5,60,
0,0,516,517,5,88,0,0,517,518,5,8,0,0,518,85,1,0,0,0,519,520,5,62,0,0,520,
521,5,88,0,0,521,522,5,58,0,0,522,523,3,110,55,0,523,524,5,8,0,0,524,87,
1,0,0,0,525,526,5,63,0,0,526,527,5,88,0,0,527,528,5,60,0,0,528,529,5,88,
0,0,529,530,5,8,0,0,530,89,1,0,0,0,531,537,3,92,46,0,532,537,3,94,47,0,533,
537,3,96,48,0,534,537,3,98,49,0,535,537,3,100,50,0,536,531,1,0,0,0,536,532,
1,0,0,0,536,533,1,0,0,0,536,534,1,0,0,0,536,535,1,0,0,0,537,91,1,0,0,0,538,
542,5,64,0,0,539,541,3,66,33,0,540,539,1,0,0,0,541,544,1,0,0,0,542,540,1,
0,0,0,542,543,1,0,0,0,543,545,1,0,0,0,544,542,1,0,0,0,545,546,5,65,0,0,546,
547,5,8,0,0,547,93,1,0,0,0,548,549,5,66,0,0,549,550,3,66,33,0,550,95,1,0,
0,0,551,552,5,67,0,0,552,553,5,68,0,0,553,558,5,8,0,0,554,555,5,67,0,0,555,
556,5,88,0,0,556,558,5,8,0,0,557,551,1,0,0,0,557,554,1,0,0,0,558,97,1,0,
0,0,559,560,5,69,0,0,560,561,5,88,0,0,561,562,5,8,0,0,562,99,1,0,0,0,563,
564,5,70,0,0,564,567,5,90,0,0,565,566,5,58,0,0,566,568,3,108,54,0,567,565,
1,0,0,0,567,568,1,0,0,0,568,569,1,0,0,0,569,570,5,8,0,0,570,101,1,0,0,0,
571,572,5,71,0,0,572,573,5,88,0,0,573,574,5,53,0,0,574,575,7,4,0,0,575,591,
5,8,0,0,576,577,5,72,0,0,577,578,5,88,0,0,578,579,5,60,0,0,579,580,5,88,
0,0,580,591,5,8,0,0,581,582,5,73,0,0,582,583,5,88,0,0,583,584,5,58,0,0,584,
585,3,110,55,0,585,586,5,8,0,0,586,591,1,0,0,0,587,588,5,74,0,0,588,589,
5,88,0,0,589,591,5,8,0,0,590,571,1,0,0,0,590,576,1,0,0,0,590,581,1,0,0,0,
590,587,1,0,0,0,591,103,1,0,0,0,592,597,5,88,0,0,593,594,5,9,0,0,594,596,
5,88,0,0,595,593,1,0,0,0,596,599,1,0,0,0,597,595,1,0,0,0,597,598,1,0,0,0,
598,105,1,0,0,0,599,597,1,0,0,0,600,605,5,88,0,0,601,602,5,9,0,0,602,604,
5,88,0,0,603,601,1,0,0,0,604,607,1,0,0,0,605,603,1,0,0,0,605,606,1,0,0,0,
606,107,1,0,0,0,607,605,1,0,0,0,608,613,3,110,55,0,609,610,5,28,0,0,610,
612,3,110,55,0,611,609,1,0,0,0,612,615,1,0,0,0,613,611,1,0,0,0,613,614,1,
0,0,0,614,109,1,0,0,0,615,613,1,0,0,0,616,617,3,112,56,0,617,111,1,0,0,0,
618,623,3,114,57,0,619,620,5,75,0,0,620,622,3,114,57,0,621,619,1,0,0,0,622,
625,1,0,0,0,623,621,1,0,0,0,623,624,1,0,0,0,624,113,1,0,0,0,625,623,1,0,
0,0,626,631,3,116,58,0,627,628,5,76,0,0,628,630,3,116,58,0,629,627,1,0,0,
0,630,633,1,0,0,0,631,629,1,0,0,0,631,632,1,0,0,0,632,115,1,0,0,0,633,631,
1,0,0,0,634,639,3,118,59,0,635,636,7,5,0,0,636,638,3,118,59,0,637,635,1,
0,0,0,638,641,1,0,0,0,639,637,1,0,0,0,639,640,1,0,0,0,640,117,1,0,0,0,641,
639,1,0,0,0,642,647,3,120,60,0,643,644,7,6,0,0,644,646,3,120,60,0,645,643,
1,0,0,0,646,649,1,0,0,0,647,645,1,0,0,0,647,648,1,0,0,0,648,119,1,0,0,0,
649,647,1,0,0,0,650,655,3,122,61,0,651,652,7,7,0,0,652,654,3,122,61,0,653,
651,1,0,0,0,654,657,1,0,0,0,655,653,1,0,0,0,655,656,1,0,0,0,656,121,1,0,
0,0,657,655,1,0,0,0,658,663,3,124,62,0,659,660,7,8,0,0,660,662,3,124,62,
0,661,659,1,0,0,0,662,665,1,0,0,0,663,661,1,0,0,0,663,664,1,0,0,0,664,123,
1,0,0,0,665,663,1,0,0,0,666,667,7,9,0,0,667,670,3,124,62,0,668,670,3,126,
63,0,669,666,1,0,0,0,669,668,1,0,0,0,670,125,1,0,0,0,671,688,5,89,0,0,672,
688,5,90,0,0,673,688,5,86,0,0,674,688,5,87,0,0,675,676,3,106,53,0,676,678,
5,25,0,0,677,679,3,108,54,0,678,677,1,0,0,0,678,679,1,0,0,0,679,680,1,0,
0,0,680,681,5,26,0,0,681,688,1,0,0,0,682,688,3,104,52,0,683,684,5,25,0,0,
684,685,3,110,55,0,685,686,5,26,0,0,686,688,1,0,0,0,687,671,1,0,0,0,687,
672,1,0,0,0,687,673,1,0,0,0,687,674,1,0,0,0,687,675,1,0,0,0,687,682,1,0,
0,0,687,683,1,0,0,0,688,127,1,0,0,0,54,131,144,152,161,164,172,178,182,195,
200,209,212,218,229,239,243,248,259,271,280,288,296,314,330,346,352,370,
378,387,395,420,439,450,461,468,471,494,536,542,557,567,590,597,605,613,
623,631,639,647,655,663,669,678,687];


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
                            "'var'", "','", "'file'", "'of'", "'queue'", 
                            "'['", "'..'", "']'", "'<'", "'>'", "'stack'", 
                            "'priorityqueue'", "'record'", "'integer'", 
                            "'real'", "'boolean'", "'string'", "'array'", 
                            "'begin'", "':='", "'call'", "'if'", "'then'", 
                            "'else'", "'while'", "'do'", "'for'", "'to'", 
                            "'repeat'", "'until'", "'enqueue'", "'with'", 
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
                             "IDENT", "NUMBER", "STRING", "LINE_COMMENT", 
                             "BLOCK_COMMENT", "WS" ];
    static ruleNames = [ "compilationUnit", "decl", "placement", "programDecl", 
                         "serviceDecl", "serviceBody", "daemonDecl", "daemonSchedule", 
                         "typeDecl", "classDecl", "classInheritance", "classMember", 
                         "classFieldDecl", "classMethodDecl", "methodParamList", 
                         "methodParamDecl", "varDecl", "identList", "fileDecl", 
                         "queueDecl", "queueType", "stackType", "priorityQueueType", 
                         "recordType", "recordField", "typeRef", "genericTypeParams", 
                         "simpleType", "userType", "genericTypeArgs", "fixedArrayType", 
                         "dynamicArrayType", "block", "statement", "assignStmt", 
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
	        this.state = 131;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 2819230848) !== 0)) {
	            this.state = 128;
	            this.decl();
	            this.state = 133;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 134;
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
	        this.state = 144;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 136;
	            this.programDecl();
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 137;
	            this.serviceDecl();
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 138;
	            this.daemonDecl();
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 139;
	            this.typeDecl();
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 140;
	            this.classDecl();
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 141;
	            this.varDecl();
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 142;
	            this.queueDecl();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 143;
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
	        this.state = 146;
	        this.match(PascalishParser.T__0);
	        this.state = 147;
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
	        this.state = 149;
	        this.match(PascalishParser.T__6);
	        this.state = 150;
	        this.match(PascalishParser.IDENT);
	        this.state = 152;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 151;
	            this.placement();
	        }

	        this.state = 154;
	        this.match(PascalishParser.T__7);
	        this.state = 155;
	        this.block();
	        this.state = 156;
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
	        this.state = 158;
	        this.match(PascalishParser.T__9);
	        this.state = 159;
	        this.match(PascalishParser.IDENT);
	        this.state = 161;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 160;
	            this.placement();
	        }

	        this.state = 164;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 163;
	            this.match(PascalishParser.T__7);
	        }

	        this.state = 166;
	        this.block();
	        this.state = 167;
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
	        this.state = 172;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	            this.state = 169;
	            this.statement();
	            this.state = 174;
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
	        this.state = 175;
	        this.match(PascalishParser.T__10);
	        this.state = 176;
	        this.match(PascalishParser.IDENT);
	        this.state = 178;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 177;
	            this.placement();
	        }

	        this.state = 180;
	        this.daemonSchedule();
	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===8) {
	            this.state = 181;
	            this.match(PascalishParser.T__7);
	        }

	        this.state = 184;
	        this.block();
	        this.state = 185;
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
	        this.state = 195;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 12:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 187;
	            this.match(PascalishParser.T__11);
	            this.state = 188;
	            this.expr();
	            this.state = 189;
	            this.match(PascalishParser.T__12);
	            break;
	        case 14:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 191;
	            this.match(PascalishParser.T__13);
	            this.state = 192;
	            this.expr();
	            this.state = 193;
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
	        this.state = 197;
	        this.match(PascalishParser.T__16);
	        this.state = 198;
	        this.match(PascalishParser.IDENT);
	        this.state = 200;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 199;
	            this.genericTypeParams();
	        }

	        this.state = 202;
	        this.match(PascalishParser.T__17);
	        this.state = 203;
	        this.typeRef();
	        this.state = 204;
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
	        this.state = 206;
	        this.match(PascalishParser.T__18);
	        this.state = 207;
	        this.match(PascalishParser.IDENT);
	        this.state = 209;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 208;
	            this.genericTypeParams();
	        }

	        this.state = 212;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===21) {
	            this.state = 211;
	            this.classInheritance();
	        }

	        this.state = 214;
	        this.match(PascalishParser.T__7);
	        this.state = 218;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===23 || _la===24 || _la===88) {
	            this.state = 215;
	            this.classMember();
	            this.state = 220;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 221;
	        this.match(PascalishParser.T__19);
	        this.state = 222;
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
	        this.state = 224;
	        this.match(PascalishParser.T__20);
	        this.state = 225;
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
	        this.state = 229;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 88:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 227;
	            this.classFieldDecl();
	            break;
	        case 23:
	        case 24:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 228;
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
	        this.state = 231;
	        this.match(PascalishParser.IDENT);
	        this.state = 232;
	        this.match(PascalishParser.T__21);
	        this.state = 233;
	        this.typeRef();
	        this.state = 234;
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
	        this.state = 236;
	        _la = this._input.LA(1);
	        if(!(_la===23 || _la===24)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 237;
	        this.match(PascalishParser.IDENT);
	        this.state = 239;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 238;
	            this.genericTypeParams();
	        }

	        this.state = 241;
	        this.match(PascalishParser.T__24);
	        this.state = 243;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===88) {
	            this.state = 242;
	            this.methodParamList();
	        }

	        this.state = 245;
	        this.match(PascalishParser.T__25);
	        this.state = 248;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===22) {
	            this.state = 246;
	            this.match(PascalishParser.T__21);
	            this.state = 247;
	            this.typeRef();
	        }

	        this.state = 250;
	        this.match(PascalishParser.T__7);
	        this.state = 251;
	        this.block();
	        this.state = 252;
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
	        this.state = 254;
	        this.methodParamDecl();
	        this.state = 259;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8) {
	            this.state = 255;
	            this.match(PascalishParser.T__7);
	            this.state = 256;
	            this.methodParamDecl();
	            this.state = 261;
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
	        this.state = 262;
	        this.identList();
	        this.state = 263;
	        this.match(PascalishParser.T__21);
	        this.state = 264;
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
	        this.state = 266;
	        this.match(PascalishParser.T__26);
	        this.state = 267;
	        this.match(PascalishParser.IDENT);
	        this.state = 268;
	        this.match(PascalishParser.T__21);
	        this.state = 269;
	        this.typeRef();
	        this.state = 271;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 270;
	            this.placement();
	        }

	        this.state = 273;
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



	identList() {
	    let localctx = new IdentListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, PascalishParser.RULE_identList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 275;
	        this.match(PascalishParser.IDENT);
	        this.state = 280;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===28) {
	            this.state = 276;
	            this.match(PascalishParser.T__27);
	            this.state = 277;
	            this.match(PascalishParser.IDENT);
	            this.state = 282;
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
	    this.enterRule(localctx, 36, PascalishParser.RULE_fileDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 283;
	        this.match(PascalishParser.T__28);
	        this.state = 284;
	        this.match(PascalishParser.IDENT);
	        this.state = 285;
	        this.match(PascalishParser.T__29);
	        this.state = 286;
	        this.typeRef();
	        this.state = 288;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 287;
	            this.placement();
	        }

	        this.state = 290;
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
	    this.enterRule(localctx, 38, PascalishParser.RULE_queueDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 292;
	        this.match(PascalishParser.T__30);
	        this.state = 293;
	        this.match(PascalishParser.IDENT);
	        this.state = 294;
	        this.queueType();
	        this.state = 296;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 295;
	            this.placement();
	        }

	        this.state = 298;
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
	    this.enterRule(localctx, 40, PascalishParser.RULE_queueType);
	    try {
	        this.state = 314;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,22,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 300;
	            this.match(PascalishParser.T__30);
	            this.state = 301;
	            this.match(PascalishParser.T__31);
	            this.state = 302;
	            this.expr();
	            this.state = 303;
	            this.match(PascalishParser.T__32);
	            this.state = 304;
	            this.expr();
	            this.state = 305;
	            this.match(PascalishParser.T__33);
	            this.state = 306;
	            this.match(PascalishParser.T__29);
	            this.state = 307;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 309;
	            this.match(PascalishParser.T__30);
	            this.state = 310;
	            this.match(PascalishParser.T__34);
	            this.state = 311;
	            this.typeRef();
	            this.state = 312;
	            this.match(PascalishParser.T__35);
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
	    this.enterRule(localctx, 42, PascalishParser.RULE_stackType);
	    try {
	        this.state = 330;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,23,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 316;
	            this.match(PascalishParser.T__36);
	            this.state = 317;
	            this.match(PascalishParser.T__31);
	            this.state = 318;
	            this.expr();
	            this.state = 319;
	            this.match(PascalishParser.T__32);
	            this.state = 320;
	            this.expr();
	            this.state = 321;
	            this.match(PascalishParser.T__33);
	            this.state = 322;
	            this.match(PascalishParser.T__29);
	            this.state = 323;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 325;
	            this.match(PascalishParser.T__36);
	            this.state = 326;
	            this.match(PascalishParser.T__34);
	            this.state = 327;
	            this.typeRef();
	            this.state = 328;
	            this.match(PascalishParser.T__35);
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
	    this.enterRule(localctx, 44, PascalishParser.RULE_priorityQueueType);
	    try {
	        this.state = 346;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,24,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 332;
	            this.match(PascalishParser.T__37);
	            this.state = 333;
	            this.match(PascalishParser.T__31);
	            this.state = 334;
	            this.expr();
	            this.state = 335;
	            this.match(PascalishParser.T__32);
	            this.state = 336;
	            this.expr();
	            this.state = 337;
	            this.match(PascalishParser.T__33);
	            this.state = 338;
	            this.match(PascalishParser.T__29);
	            this.state = 339;
	            this.typeRef();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 341;
	            this.match(PascalishParser.T__37);
	            this.state = 342;
	            this.match(PascalishParser.T__34);
	            this.state = 343;
	            this.typeRef();
	            this.state = 344;
	            this.match(PascalishParser.T__35);
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
	    this.enterRule(localctx, 46, PascalishParser.RULE_recordType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 348;
	        this.match(PascalishParser.T__38);
	        this.state = 352;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===88) {
	            this.state = 349;
	            this.recordField();
	            this.state = 354;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 355;
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
	    this.enterRule(localctx, 48, PascalishParser.RULE_recordField);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 357;
	        this.match(PascalishParser.IDENT);
	        this.state = 358;
	        this.match(PascalishParser.T__21);
	        this.state = 359;
	        this.typeRef();
	        this.state = 360;
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
	    this.enterRule(localctx, 50, PascalishParser.RULE_typeRef);
	    try {
	        this.state = 370;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,26,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 362;
	            this.simpleType();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 363;
	            this.recordType();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 364;
	            this.queueType();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 365;
	            this.stackType();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 366;
	            this.priorityQueueType();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 367;
	            this.fixedArrayType();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 368;
	            this.dynamicArrayType();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 369;
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
	    this.enterRule(localctx, 52, PascalishParser.RULE_genericTypeParams);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 372;
	        this.match(PascalishParser.T__34);
	        this.state = 373;
	        this.match(PascalishParser.IDENT);
	        this.state = 378;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===28) {
	            this.state = 374;
	            this.match(PascalishParser.T__27);
	            this.state = 375;
	            this.match(PascalishParser.IDENT);
	            this.state = 380;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 381;
	        this.match(PascalishParser.T__35);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 54, PascalishParser.RULE_simpleType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 383;
	        _la = this._input.LA(1);
	        if(!(((((_la - 40)) & ~0x1f) === 0 && ((1 << (_la - 40)) & 15) !== 0))) {
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
	    this.enterRule(localctx, 56, PascalishParser.RULE_userType);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 385;
	        this.match(PascalishParser.IDENT);
	        this.state = 387;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===35) {
	            this.state = 386;
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
	    this.enterRule(localctx, 58, PascalishParser.RULE_genericTypeArgs);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 389;
	        this.match(PascalishParser.T__34);
	        this.state = 390;
	        this.typeRef();
	        this.state = 395;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===28) {
	            this.state = 391;
	            this.match(PascalishParser.T__27);
	            this.state = 392;
	            this.typeRef();
	            this.state = 397;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 398;
	        this.match(PascalishParser.T__35);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 60, PascalishParser.RULE_fixedArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 400;
	        this.match(PascalishParser.T__43);
	        this.state = 401;
	        this.match(PascalishParser.T__31);
	        this.state = 402;
	        this.expr();
	        this.state = 403;
	        this.match(PascalishParser.T__32);
	        this.state = 404;
	        this.expr();
	        this.state = 405;
	        this.match(PascalishParser.T__33);
	        this.state = 406;
	        this.match(PascalishParser.T__29);
	        this.state = 407;
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
	    this.enterRule(localctx, 62, PascalishParser.RULE_dynamicArrayType);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 409;
	        this.match(PascalishParser.T__43);
	        this.state = 410;
	        this.match(PascalishParser.T__34);
	        this.state = 411;
	        this.typeRef();
	        this.state = 412;
	        this.match(PascalishParser.T__35);
	        this.state = 413;
	        this.match(PascalishParser.T__29);
	        this.state = 414;
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
	    this.enterRule(localctx, 64, PascalishParser.RULE_block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 416;
	        this.match(PascalishParser.T__44);
	        this.state = 420;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	            this.state = 417;
	            this.statement();
	            this.state = 422;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 423;
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
	    this.enterRule(localctx, 66, PascalishParser.RULE_statement);
	    try {
	        this.state = 439;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 88:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 425;
	            this.assignStmt();
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 426;
	            this.callStmt();
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 427;
	            this.ifStmt();
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 428;
	            this.whileStmt();
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 429;
	            this.forStmt();
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 430;
	            this.repeatStmt();
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 431;
	            this.block();
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 432;
	            this.enqueueStmt();
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 433;
	            this.dequeueStmt();
	            break;
	        case 61:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 434;
	            this.peekStmt();
	            break;
	        case 62:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 435;
	            this.pushStmt();
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 436;
	            this.popStmt();
	            break;
	        case 64:
	        case 66:
	        case 67:
	        case 69:
	        case 70:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 437;
	            this.concurrentStmt();
	            break;
	        case 71:
	        case 72:
	        case 73:
	        case 74:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 438;
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
	    this.enterRule(localctx, 68, PascalishParser.RULE_assignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 441;
	        this.lvalue();
	        this.state = 442;
	        this.match(PascalishParser.T__45);
	        this.state = 443;
	        this.expr();
	        this.state = 444;
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
	    this.enterRule(localctx, 70, PascalishParser.RULE_callStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 446;
	        this.match(PascalishParser.T__46);
	        this.state = 447;
	        this.qualifiedName();
	        this.state = 448;
	        this.match(PascalishParser.T__24);
	        this.state = 450;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===25 || ((((_la - 81)) & ~0x1f) === 0 && ((1 << (_la - 81)) & 1009) !== 0)) {
	            this.state = 449;
	            this.exprList();
	        }

	        this.state = 452;
	        this.match(PascalishParser.T__25);
	        this.state = 453;
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
	    this.enterRule(localctx, 72, PascalishParser.RULE_ifStmt);
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
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	            this.state = 458;
	            this.statement();
	            this.state = 463;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 471;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===50) {
	            this.state = 464;
	            this.match(PascalishParser.T__49);
	            this.state = 468;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	                this.state = 465;
	                this.statement();
	                this.state = 470;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 473;
	        this.match(PascalishParser.T__19);
	        this.state = 474;
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
	    this.enterRule(localctx, 74, PascalishParser.RULE_whileStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 476;
	        this.match(PascalishParser.T__50);
	        this.state = 477;
	        this.expr();
	        this.state = 478;
	        this.match(PascalishParser.T__51);
	        this.state = 479;
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
	    this.enterRule(localctx, 76, PascalishParser.RULE_forStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 481;
	        this.match(PascalishParser.T__52);
	        this.state = 482;
	        this.match(PascalishParser.IDENT);
	        this.state = 483;
	        this.match(PascalishParser.T__45);
	        this.state = 484;
	        this.expr();
	        this.state = 485;
	        this.match(PascalishParser.T__53);
	        this.state = 486;
	        this.expr();
	        this.state = 487;
	        this.match(PascalishParser.T__51);
	        this.state = 488;
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
	    this.enterRule(localctx, 78, PascalishParser.RULE_repeatStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 490;
	        this.match(PascalishParser.T__54);
	        this.state = 494;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	            this.state = 491;
	            this.statement();
	            this.state = 496;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 497;
	        this.match(PascalishParser.T__55);
	        this.state = 498;
	        this.expr();
	        this.state = 499;
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
	    this.enterRule(localctx, 80, PascalishParser.RULE_enqueueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 501;
	        this.match(PascalishParser.T__56);
	        this.state = 502;
	        this.match(PascalishParser.IDENT);
	        this.state = 503;
	        this.match(PascalishParser.T__57);
	        this.state = 504;
	        this.expr();
	        this.state = 505;
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
	    this.enterRule(localctx, 82, PascalishParser.RULE_dequeueStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 507;
	        this.match(PascalishParser.T__58);
	        this.state = 508;
	        this.match(PascalishParser.IDENT);
	        this.state = 509;
	        this.match(PascalishParser.T__59);
	        this.state = 510;
	        this.match(PascalishParser.IDENT);
	        this.state = 511;
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
	    this.enterRule(localctx, 84, PascalishParser.RULE_peekStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 513;
	        this.match(PascalishParser.T__60);
	        this.state = 514;
	        this.match(PascalishParser.IDENT);
	        this.state = 515;
	        this.match(PascalishParser.T__59);
	        this.state = 516;
	        this.match(PascalishParser.IDENT);
	        this.state = 517;
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
	    this.enterRule(localctx, 86, PascalishParser.RULE_pushStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 519;
	        this.match(PascalishParser.T__61);
	        this.state = 520;
	        this.match(PascalishParser.IDENT);
	        this.state = 521;
	        this.match(PascalishParser.T__57);
	        this.state = 522;
	        this.expr();
	        this.state = 523;
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
	    this.enterRule(localctx, 88, PascalishParser.RULE_popStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 525;
	        this.match(PascalishParser.T__62);
	        this.state = 526;
	        this.match(PascalishParser.IDENT);
	        this.state = 527;
	        this.match(PascalishParser.T__59);
	        this.state = 528;
	        this.match(PascalishParser.IDENT);
	        this.state = 529;
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
	    this.enterRule(localctx, 90, PascalishParser.RULE_concurrentStmt);
	    try {
	        this.state = 536;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 64:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 531;
	            this.cobeginStmt();
	            break;
	        case 66:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 532;
	            this.asyncStmt();
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 533;
	            this.waitStmt();
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 534;
	            this.syncStmt();
	            break;
	        case 70:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 535;
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
	    this.enterRule(localctx, 92, PascalishParser.RULE_cobeginStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 538;
	        this.match(PascalishParser.T__63);
	        this.state = 542;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 1064260941) !== 0) || _la===88) {
	            this.state = 539;
	            this.statement();
	            this.state = 544;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 545;
	        this.match(PascalishParser.T__64);
	        this.state = 546;
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
	    this.enterRule(localctx, 94, PascalishParser.RULE_asyncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 548;
	        this.match(PascalishParser.T__65);
	        this.state = 549;
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
	    this.enterRule(localctx, 96, PascalishParser.RULE_waitStmt);
	    try {
	        this.state = 557;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,39,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 551;
	            this.match(PascalishParser.T__66);
	            this.state = 552;
	            this.match(PascalishParser.T__67);
	            this.state = 553;
	            this.match(PascalishParser.T__7);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 554;
	            this.match(PascalishParser.T__66);
	            this.state = 555;
	            this.match(PascalishParser.IDENT);
	            this.state = 556;
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
	    this.enterRule(localctx, 98, PascalishParser.RULE_syncStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 559;
	        this.match(PascalishParser.T__68);
	        this.state = 560;
	        this.match(PascalishParser.IDENT);
	        this.state = 561;
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
	    this.enterRule(localctx, 100, PascalishParser.RULE_subflowStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 563;
	        this.match(PascalishParser.T__69);
	        this.state = 564;
	        this.match(PascalishParser.STRING);
	        this.state = 567;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===58) {
	            this.state = 565;
	            this.match(PascalishParser.T__57);
	            this.state = 566;
	            this.exprList();
	        }

	        this.state = 569;
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
	    this.enterRule(localctx, 102, PascalishParser.RULE_fileStmt);
	    var _la = 0;
	    try {
	        this.state = 590;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 71:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 571;
	            this.match(PascalishParser.T__70);
	            this.state = 572;
	            this.match(PascalishParser.IDENT);
	            this.state = 573;
	            this.match(PascalishParser.T__52);
	            this.state = 574;
	            _la = this._input.LA(1);
	            if(!(_la===72 || _la===73)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 575;
	            this.match(PascalishParser.T__7);
	            break;
	        case 72:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 576;
	            this.match(PascalishParser.T__71);
	            this.state = 577;
	            this.match(PascalishParser.IDENT);
	            this.state = 578;
	            this.match(PascalishParser.T__59);
	            this.state = 579;
	            this.match(PascalishParser.IDENT);
	            this.state = 580;
	            this.match(PascalishParser.T__7);
	            break;
	        case 73:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 581;
	            this.match(PascalishParser.T__72);
	            this.state = 582;
	            this.match(PascalishParser.IDENT);
	            this.state = 583;
	            this.match(PascalishParser.T__57);
	            this.state = 584;
	            this.expr();
	            this.state = 585;
	            this.match(PascalishParser.T__7);
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 587;
	            this.match(PascalishParser.T__73);
	            this.state = 588;
	            this.match(PascalishParser.IDENT);
	            this.state = 589;
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
	    this.enterRule(localctx, 104, PascalishParser.RULE_lvalue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 592;
	        this.match(PascalishParser.IDENT);
	        this.state = 597;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 593;
	            this.match(PascalishParser.T__8);
	            this.state = 594;
	            this.match(PascalishParser.IDENT);
	            this.state = 599;
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
	    this.enterRule(localctx, 106, PascalishParser.RULE_qualifiedName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 600;
	        this.match(PascalishParser.IDENT);
	        this.state = 605;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 601;
	            this.match(PascalishParser.T__8);
	            this.state = 602;
	            this.match(PascalishParser.IDENT);
	            this.state = 607;
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
	    this.enterRule(localctx, 108, PascalishParser.RULE_exprList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 608;
	        this.expr();
	        this.state = 613;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===28) {
	            this.state = 609;
	            this.match(PascalishParser.T__27);
	            this.state = 610;
	            this.expr();
	            this.state = 615;
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
	    this.enterRule(localctx, 110, PascalishParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 616;
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
	    this.enterRule(localctx, 112, PascalishParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 618;
	        this.logicalAndExpr();
	        this.state = 623;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===75) {
	            this.state = 619;
	            this.match(PascalishParser.T__74);
	            this.state = 620;
	            this.logicalAndExpr();
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



	logicalAndExpr() {
	    let localctx = new LogicalAndExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 114, PascalishParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 626;
	        this.equalityExpr();
	        this.state = 631;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===76) {
	            this.state = 627;
	            this.match(PascalishParser.T__75);
	            this.state = 628;
	            this.equalityExpr();
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



	equalityExpr() {
	    let localctx = new EqualityExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 116, PascalishParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 634;
	        this.relationalExpr();
	        this.state = 639;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===18 || _la===77) {
	            this.state = 635;
	            _la = this._input.LA(1);
	            if(!(_la===18 || _la===77)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 636;
	            this.relationalExpr();
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



	relationalExpr() {
	    let localctx = new RelationalExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 118, PascalishParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 642;
	        this.additiveExpr();
	        this.state = 647;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===35 || _la===36 || _la===78 || _la===79) {
	            this.state = 643;
	            _la = this._input.LA(1);
	            if(!(_la===35 || _la===36 || _la===78 || _la===79)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 644;
	            this.additiveExpr();
	            this.state = 649;
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
	    this.enterRule(localctx, 120, PascalishParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 650;
	        this.multiplicativeExpr();
	        this.state = 655;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===80 || _la===81) {
	            this.state = 651;
	            _la = this._input.LA(1);
	            if(!(_la===80 || _la===81)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 652;
	            this.multiplicativeExpr();
	            this.state = 657;
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
	    this.enterRule(localctx, 122, PascalishParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 658;
	        this.unaryExpr();
	        this.state = 663;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 82)) & ~0x1f) === 0 && ((1 << (_la - 82)) & 7) !== 0)) {
	            this.state = 659;
	            _la = this._input.LA(1);
	            if(!(((((_la - 82)) & ~0x1f) === 0 && ((1 << (_la - 82)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 660;
	            this.unaryExpr();
	            this.state = 665;
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
	    this.enterRule(localctx, 124, PascalishParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 669;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 81:
	        case 85:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 666;
	            _la = this._input.LA(1);
	            if(!(_la===81 || _la===85)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 667;
	            this.unaryExpr();
	            break;
	        case 25:
	        case 86:
	        case 87:
	        case 88:
	        case 89:
	        case 90:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 668;
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
	    this.enterRule(localctx, 126, PascalishParser.RULE_primaryExpr);
	    var _la = 0;
	    try {
	        this.state = 687;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,53,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 671;
	            this.match(PascalishParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 672;
	            this.match(PascalishParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 673;
	            this.match(PascalishParser.T__85);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 674;
	            this.match(PascalishParser.T__86);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 675;
	            this.qualifiedName();
	            this.state = 676;
	            this.match(PascalishParser.T__24);
	            this.state = 678;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===25 || ((((_la - 81)) & ~0x1f) === 0 && ((1 << (_la - 81)) & 1009) !== 0)) {
	                this.state = 677;
	                this.exprList();
	            }

	            this.state = 680;
	            this.match(PascalishParser.T__25);
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 682;
	            this.lvalue();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 683;
	            this.match(PascalishParser.T__24);
	            this.state = 684;
	            this.expr();
	            this.state = 685;
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
PascalishParser.IDENT = 88;
PascalishParser.NUMBER = 89;
PascalishParser.STRING = 90;
PascalishParser.LINE_COMMENT = 91;
PascalishParser.BLOCK_COMMENT = 92;
PascalishParser.WS = 93;

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
PascalishParser.RULE_identList = 17;
PascalishParser.RULE_fileDecl = 18;
PascalishParser.RULE_queueDecl = 19;
PascalishParser.RULE_queueType = 20;
PascalishParser.RULE_stackType = 21;
PascalishParser.RULE_priorityQueueType = 22;
PascalishParser.RULE_recordType = 23;
PascalishParser.RULE_recordField = 24;
PascalishParser.RULE_typeRef = 25;
PascalishParser.RULE_genericTypeParams = 26;
PascalishParser.RULE_simpleType = 27;
PascalishParser.RULE_userType = 28;
PascalishParser.RULE_genericTypeArgs = 29;
PascalishParser.RULE_fixedArrayType = 30;
PascalishParser.RULE_dynamicArrayType = 31;
PascalishParser.RULE_block = 32;
PascalishParser.RULE_statement = 33;
PascalishParser.RULE_assignStmt = 34;
PascalishParser.RULE_callStmt = 35;
PascalishParser.RULE_ifStmt = 36;
PascalishParser.RULE_whileStmt = 37;
PascalishParser.RULE_forStmt = 38;
PascalishParser.RULE_repeatStmt = 39;
PascalishParser.RULE_enqueueStmt = 40;
PascalishParser.RULE_dequeueStmt = 41;
PascalishParser.RULE_peekStmt = 42;
PascalishParser.RULE_pushStmt = 43;
PascalishParser.RULE_popStmt = 44;
PascalishParser.RULE_concurrentStmt = 45;
PascalishParser.RULE_cobeginStmt = 46;
PascalishParser.RULE_asyncStmt = 47;
PascalishParser.RULE_waitStmt = 48;
PascalishParser.RULE_syncStmt = 49;
PascalishParser.RULE_subflowStmt = 50;
PascalishParser.RULE_fileStmt = 51;
PascalishParser.RULE_lvalue = 52;
PascalishParser.RULE_qualifiedName = 53;
PascalishParser.RULE_exprList = 54;
PascalishParser.RULE_expr = 55;
PascalishParser.RULE_logicalOrExpr = 56;
PascalishParser.RULE_logicalAndExpr = 57;
PascalishParser.RULE_equalityExpr = 58;
PascalishParser.RULE_relationalExpr = 59;
PascalishParser.RULE_additiveExpr = 60;
PascalishParser.RULE_multiplicativeExpr = 61;
PascalishParser.RULE_unaryExpr = 62;
PascalishParser.RULE_primaryExpr = 63;

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

	accept(visitor) {
	    if ( visitor instanceof PascalishVisitor ) {
	        return visitor.visitVarDecl(this);
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
PascalishParser.ClassDeclContext = ClassDeclContext; 
PascalishParser.ClassInheritanceContext = ClassInheritanceContext; 
PascalishParser.ClassMemberContext = ClassMemberContext; 
PascalishParser.ClassFieldDeclContext = ClassFieldDeclContext; 
PascalishParser.ClassMethodDeclContext = ClassMethodDeclContext; 
PascalishParser.MethodParamListContext = MethodParamListContext; 
PascalishParser.MethodParamDeclContext = MethodParamDeclContext; 
PascalishParser.VarDeclContext = VarDeclContext; 
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
