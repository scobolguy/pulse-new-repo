// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Vbish.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import VbishVisitor from './VbishVisitor.js';

const serializedATN = [4,1,71,365,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,
7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,
34,1,0,3,0,72,8,0,1,0,3,0,75,8,0,1,0,5,0,78,8,0,10,0,12,0,81,9,0,1,0,5,0,
84,8,0,10,0,12,0,87,9,0,1,0,1,0,1,1,1,1,1,1,1,2,3,2,95,8,2,1,2,1,2,1,2,1,
2,3,2,101,8,2,1,2,1,2,1,2,3,2,106,8,2,1,3,1,3,1,4,1,4,1,5,1,5,1,5,1,5,1,
5,3,5,117,8,5,1,6,1,6,1,7,1,7,1,7,3,7,124,8,7,1,8,1,8,1,8,1,8,3,8,130,8,
8,1,8,1,8,3,8,134,8,8,1,9,1,9,1,9,3,9,139,8,9,1,9,5,9,142,8,9,10,9,12,9,
145,9,9,1,9,1,9,1,9,1,10,1,10,1,10,3,10,153,8,10,1,10,1,10,3,10,157,8,10,
1,10,5,10,160,8,10,10,10,12,10,163,9,10,1,10,1,10,1,10,1,11,1,11,1,11,1,
11,5,11,172,8,11,10,11,12,11,175,9,11,3,11,177,8,11,1,11,1,11,1,12,1,12,
1,12,3,12,184,8,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,3,13,194,8,13,
1,14,1,14,1,14,1,14,5,14,200,8,14,10,14,12,14,203,9,14,1,14,1,14,5,14,207,
8,14,10,14,12,14,210,9,14,3,14,212,8,14,1,14,1,14,1,14,1,15,1,15,1,15,1,
15,1,15,1,15,1,15,1,15,3,15,225,8,15,1,15,5,15,228,8,15,10,15,12,15,231,
9,15,1,15,1,15,1,15,1,15,3,15,237,8,15,3,15,239,8,15,1,16,1,16,1,16,5,16,
244,8,16,10,16,12,16,247,9,16,1,16,1,16,1,16,1,17,1,17,1,17,1,17,5,17,256,
8,17,10,17,12,17,259,9,17,3,17,261,8,17,1,18,1,18,1,18,1,18,1,19,1,19,3,
19,269,8,19,1,20,1,20,3,20,273,8,20,1,21,1,21,1,22,1,22,1,22,5,22,280,8,
22,10,22,12,22,283,9,22,1,23,1,23,1,23,5,23,288,8,23,10,23,12,23,291,9,23,
1,24,1,24,1,24,5,24,296,8,24,10,24,12,24,299,9,24,1,25,1,25,1,25,5,25,304,
8,25,10,25,12,25,307,9,25,1,26,1,26,1,26,5,26,312,8,26,10,26,12,26,315,9,
26,1,26,1,26,1,26,5,26,320,8,26,10,26,12,26,323,9,26,3,26,325,8,26,1,27,
1,27,1,27,5,27,330,8,27,10,27,12,27,333,9,27,1,28,1,28,1,28,1,28,1,28,1,
28,3,28,341,8,28,1,28,1,28,1,28,1,28,3,28,347,8,28,1,29,1,29,1,29,1,30,1,
30,1,30,1,31,1,31,1,31,1,32,1,32,1,32,1,33,1,33,1,34,1,34,1,34,0,0,35,0,
2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,
54,56,58,60,62,64,66,68,0,14,1,0,2,4,1,0,7,11,1,0,12,16,1,0,18,22,1,0,39,
40,2,0,42,42,44,44,2,0,41,41,43,43,1,0,61,62,1,0,63,66,1,0,57,58,1,0,59,
60,1,0,61,66,2,0,46,49,69,69,1,0,68,69,382,0,71,1,0,0,0,2,90,1,0,0,0,4,94,
1,0,0,0,6,107,1,0,0,0,8,109,1,0,0,0,10,111,1,0,0,0,12,118,1,0,0,0,14,123,
1,0,0,0,16,125,1,0,0,0,18,135,1,0,0,0,20,149,1,0,0,0,22,167,1,0,0,0,24,180,
1,0,0,0,26,193,1,0,0,0,28,195,1,0,0,0,30,216,1,0,0,0,32,240,1,0,0,0,34,251,
1,0,0,0,36,262,1,0,0,0,38,266,1,0,0,0,40,270,1,0,0,0,42,274,1,0,0,0,44,276,
1,0,0,0,46,284,1,0,0,0,48,292,1,0,0,0,50,300,1,0,0,0,52,324,1,0,0,0,54,326,
1,0,0,0,56,346,1,0,0,0,58,348,1,0,0,0,60,351,1,0,0,0,62,354,1,0,0,0,64,357,
1,0,0,0,66,360,1,0,0,0,68,362,1,0,0,0,70,72,3,2,1,0,71,70,1,0,0,0,71,72,
1,0,0,0,72,74,1,0,0,0,73,75,3,4,2,0,74,73,1,0,0,0,74,75,1,0,0,0,75,79,1,
0,0,0,76,78,3,10,5,0,77,76,1,0,0,0,78,81,1,0,0,0,79,77,1,0,0,0,79,80,1,0,
0,0,80,85,1,0,0,0,81,79,1,0,0,0,82,84,3,14,7,0,83,82,1,0,0,0,84,87,1,0,0,
0,85,83,1,0,0,0,85,86,1,0,0,0,86,88,1,0,0,0,87,85,1,0,0,0,88,89,5,0,0,1,
89,1,1,0,0,0,90,91,5,24,0,0,91,92,5,25,0,0,92,3,1,0,0,0,93,95,5,1,0,0,94,
93,1,0,0,0,94,95,1,0,0,0,95,96,1,0,0,0,96,97,7,0,0,0,97,100,3,68,34,0,98,
99,5,5,0,0,99,101,3,6,3,0,100,98,1,0,0,0,100,101,1,0,0,0,101,105,1,0,0,0,
102,103,5,6,0,0,103,104,5,67,0,0,104,106,3,8,4,0,105,102,1,0,0,0,105,106,
1,0,0,0,106,5,1,0,0,0,107,108,7,1,0,0,108,7,1,0,0,0,109,110,7,2,0,0,110,
9,1,0,0,0,111,112,5,17,0,0,112,113,3,12,6,0,113,116,5,68,0,0,114,115,5,23,
0,0,115,117,5,69,0,0,116,114,1,0,0,0,116,117,1,0,0,0,117,11,1,0,0,0,118,
119,7,3,0,0,119,13,1,0,0,0,120,124,3,16,8,0,121,124,3,18,9,0,122,124,3,20,
10,0,123,120,1,0,0,0,123,121,1,0,0,0,123,122,1,0,0,0,124,15,1,0,0,0,125,
126,5,26,0,0,126,129,5,69,0,0,127,128,5,23,0,0,128,130,3,66,33,0,129,127,
1,0,0,0,129,130,1,0,0,0,130,133,1,0,0,0,131,132,5,52,0,0,132,134,3,42,21,
0,133,131,1,0,0,0,133,134,1,0,0,0,134,17,1,0,0,0,135,136,5,27,0,0,136,138,
5,69,0,0,137,139,3,22,11,0,138,137,1,0,0,0,138,139,1,0,0,0,139,143,1,0,0,
0,140,142,3,26,13,0,141,140,1,0,0,0,142,145,1,0,0,0,143,141,1,0,0,0,143,
144,1,0,0,0,144,146,1,0,0,0,145,143,1,0,0,0,146,147,5,29,0,0,147,148,5,27,
0,0,148,19,1,0,0,0,149,150,5,28,0,0,150,152,5,69,0,0,151,153,3,22,11,0,152,
151,1,0,0,0,152,153,1,0,0,0,153,156,1,0,0,0,154,155,5,23,0,0,155,157,3,66,
33,0,156,154,1,0,0,0,156,157,1,0,0,0,157,161,1,0,0,0,158,160,3,26,13,0,159,
158,1,0,0,0,160,163,1,0,0,0,161,159,1,0,0,0,161,162,1,0,0,0,162,164,1,0,
0,0,163,161,1,0,0,0,164,165,5,29,0,0,165,166,5,28,0,0,166,21,1,0,0,0,167,
176,5,53,0,0,168,173,3,24,12,0,169,170,5,55,0,0,170,172,3,24,12,0,171,169,
1,0,0,0,172,175,1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,0,174,177,1,0,0,0,
175,173,1,0,0,0,176,168,1,0,0,0,176,177,1,0,0,0,177,178,1,0,0,0,178,179,
5,54,0,0,179,23,1,0,0,0,180,183,3,42,21,0,181,182,5,23,0,0,182,184,3,66,
33,0,183,181,1,0,0,0,183,184,1,0,0,0,184,25,1,0,0,0,185,194,3,16,8,0,186,
194,3,28,14,0,187,194,3,30,15,0,188,194,3,32,16,0,189,194,3,34,17,0,190,
194,3,36,18,0,191,194,3,38,19,0,192,194,3,40,20,0,193,185,1,0,0,0,193,186,
1,0,0,0,193,187,1,0,0,0,193,188,1,0,0,0,193,189,1,0,0,0,193,190,1,0,0,0,
193,191,1,0,0,0,193,192,1,0,0,0,194,27,1,0,0,0,195,196,5,31,0,0,196,197,
3,42,21,0,197,201,5,32,0,0,198,200,3,26,13,0,199,198,1,0,0,0,200,203,1,0,
0,0,201,199,1,0,0,0,201,202,1,0,0,0,202,211,1,0,0,0,203,201,1,0,0,0,204,
208,5,33,0,0,205,207,3,26,13,0,206,205,1,0,0,0,207,210,1,0,0,0,208,206,1,
0,0,0,208,209,1,0,0,0,209,212,1,0,0,0,210,208,1,0,0,0,211,204,1,0,0,0,211,
212,1,0,0,0,212,213,1,0,0,0,213,214,5,29,0,0,214,215,5,31,0,0,215,29,1,0,
0,0,216,217,5,34,0,0,217,218,5,69,0,0,218,219,5,52,0,0,219,220,3,42,21,0,
220,221,5,35,0,0,221,224,3,42,21,0,222,223,5,36,0,0,223,225,3,42,21,0,224,
222,1,0,0,0,224,225,1,0,0,0,225,229,1,0,0,0,226,228,3,26,13,0,227,226,1,
0,0,0,228,231,1,0,0,0,229,227,1,0,0,0,229,230,1,0,0,0,230,238,1,0,0,0,231,
229,1,0,0,0,232,233,5,29,0,0,233,239,5,34,0,0,234,236,5,37,0,0,235,237,5,
69,0,0,236,235,1,0,0,0,236,237,1,0,0,0,237,239,1,0,0,0,238,232,1,0,0,0,238,
234,1,0,0,0,239,31,1,0,0,0,240,241,5,38,0,0,241,245,3,42,21,0,242,244,3,
26,13,0,243,242,1,0,0,0,244,247,1,0,0,0,245,243,1,0,0,0,245,246,1,0,0,0,
246,248,1,0,0,0,247,245,1,0,0,0,248,249,5,29,0,0,249,250,5,38,0,0,250,33,
1,0,0,0,251,260,7,4,0,0,252,257,3,42,21,0,253,254,5,55,0,0,254,256,3,42,
21,0,255,253,1,0,0,0,256,259,1,0,0,0,257,255,1,0,0,0,257,258,1,0,0,0,258,
261,1,0,0,0,259,257,1,0,0,0,260,252,1,0,0,0,260,261,1,0,0,0,261,35,1,0,0,
0,262,263,5,69,0,0,263,264,5,52,0,0,264,265,3,42,21,0,265,37,1,0,0,0,266,
268,5,69,0,0,267,269,3,22,11,0,268,267,1,0,0,0,268,269,1,0,0,0,269,39,1,
0,0,0,270,272,5,30,0,0,271,273,3,42,21,0,272,271,1,0,0,0,272,273,1,0,0,0,
273,41,1,0,0,0,274,275,3,44,22,0,275,43,1,0,0,0,276,281,3,46,23,0,277,278,
7,5,0,0,278,280,3,46,23,0,279,277,1,0,0,0,280,283,1,0,0,0,281,279,1,0,0,
0,281,282,1,0,0,0,282,45,1,0,0,0,283,281,1,0,0,0,284,289,3,48,24,0,285,286,
7,6,0,0,286,288,3,48,24,0,287,285,1,0,0,0,288,291,1,0,0,0,289,287,1,0,0,
0,289,290,1,0,0,0,290,47,1,0,0,0,291,289,1,0,0,0,292,297,3,50,25,0,293,294,
7,7,0,0,294,296,3,50,25,0,295,293,1,0,0,0,296,299,1,0,0,0,297,295,1,0,0,
0,297,298,1,0,0,0,298,49,1,0,0,0,299,297,1,0,0,0,300,305,3,52,26,0,301,302,
7,8,0,0,302,304,3,52,26,0,303,301,1,0,0,0,304,307,1,0,0,0,305,303,1,0,0,
0,305,306,1,0,0,0,306,51,1,0,0,0,307,305,1,0,0,0,308,313,3,54,27,0,309,310,
7,9,0,0,310,312,3,54,27,0,311,309,1,0,0,0,312,315,1,0,0,0,313,311,1,0,0,
0,313,314,1,0,0,0,314,325,1,0,0,0,315,313,1,0,0,0,316,321,3,54,27,0,317,
318,5,56,0,0,318,320,3,54,27,0,319,317,1,0,0,0,320,323,1,0,0,0,321,319,1,
0,0,0,321,322,1,0,0,0,322,325,1,0,0,0,323,321,1,0,0,0,324,308,1,0,0,0,324,
316,1,0,0,0,325,53,1,0,0,0,326,331,3,56,28,0,327,328,7,10,0,0,328,330,3,
56,28,0,329,327,1,0,0,0,330,333,1,0,0,0,331,329,1,0,0,0,331,332,1,0,0,0,
332,55,1,0,0,0,333,331,1,0,0,0,334,347,5,68,0,0,335,347,5,67,0,0,336,347,
5,50,0,0,337,347,5,51,0,0,338,340,5,69,0,0,339,341,3,22,11,0,340,339,1,0,
0,0,340,341,1,0,0,0,341,347,1,0,0,0,342,343,5,53,0,0,343,344,3,42,21,0,344,
345,5,54,0,0,345,347,1,0,0,0,346,334,1,0,0,0,346,335,1,0,0,0,346,336,1,0,
0,0,346,337,1,0,0,0,346,338,1,0,0,0,346,342,1,0,0,0,347,57,1,0,0,0,348,349,
5,56,0,0,349,350,3,56,28,0,350,59,1,0,0,0,351,352,7,9,0,0,352,353,3,56,28,
0,353,61,1,0,0,0,354,355,7,10,0,0,355,356,3,56,28,0,356,63,1,0,0,0,357,358,
7,11,0,0,358,359,3,56,28,0,359,65,1,0,0,0,360,361,7,12,0,0,361,67,1,0,0,
0,362,363,7,13,0,0,363,69,1,0,0,0,42,71,74,79,85,94,100,105,116,123,129,
133,138,143,152,156,161,173,176,183,193,201,208,211,224,229,236,238,245,
257,260,268,272,281,289,297,305,313,321,324,331,340,346];


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
                            "'AS'", "'OPTION'", "'EXPLICIT'", "'DIM'", "'SUB'", 
                            "'FUNCTION'", "'END'", "'RETURN'", "'IF'", "'THEN'", 
                            "'ELSE'", "'FOR'", "'TO'", "'STEP'", "'NEXT'", 
                            "'WHILE'", "'PRINT'", "'DISPLAY'", "'AND'", 
                            "'OR'", "'ANDALSO'", "'ORELSE'", "'NOT'", "'STRING'", 
                            "'INTEGER'", "'DOUBLE'", "'BOOLEAN'", "'TRUE'", 
                            "'FALSE'", null, "'('", "')'", "','", "'&'", 
                            "'+'", "'-'", "'*'", "'/'", null, "'<>'", "'<'", 
                            "'>'", "'<='", "'>='" ];
    static symbolicNames = [ null, "PULSE", "SERVICE", "DAEMON", "PROGRAM", 
                             "ON", "EVERY", "LOCAL", "PARENT", "CHILD", 
                             "SIBLING", "ALTERNATE", "MS", "S", "M", "SECOND", 
                             "SECONDS", "INTEROP", "PASCALISH", "COBOLISH", 
                             "VBISH", "WFL", "WORKFLOW", "AS", "OPTION", 
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
                         "topLevelDecl", "variableDecl", "subDecl", "functionDecl", 
                         "parameterList", "parameter", "statement", "ifStatement", 
                         "forStatement", "whileStatement", "printStatement", 
                         "assignment", "callStatement", "returnStatement", 
                         "expression", "logicalOr", "logicalAnd", "equality", 
                         "relational", "additive", "multiplicative", "primary", 
                         "concatenation", "addOp", "mulOp", "relOp", "typeName", 
                         "stringOrIdentifier" ];

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
	        this.state = 71;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===24) {
	            this.state = 70;
	            this.optionExplicit();
	        }

	        this.state = 74;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 30) !== 0)) {
	            this.state = 73;
	            this.runtimeDecl();
	        }

	        this.state = 79;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17) {
	            this.state = 76;
	            this.interopDecl();
	            this.state = 81;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 85;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 469762048) !== 0)) {
	            this.state = 82;
	            this.topLevelDecl();
	            this.state = 87;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 88;
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
	        this.state = 90;
	        this.match(VbishParser.OPTION);
	        this.state = 91;
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
	        this.state = 94;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===1) {
	            this.state = 93;
	            this.match(VbishParser.PULSE);
	        }

	        this.state = 96;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 28) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 97;
	        this.stringOrIdentifier();
	        this.state = 100;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===5) {
	            this.state = 98;
	            this.match(VbishParser.ON);
	            this.state = 99;
	            this.placement();
	        }

	        this.state = 105;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===6) {
	            this.state = 102;
	            this.match(VbishParser.EVERY);
	            this.state = 103;
	            this.match(VbishParser.NUMBER);
	            this.state = 104;
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
	        this.state = 107;
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
	        this.state = 109;
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
	        this.state = 111;
	        this.match(VbishParser.INTEROP);
	        this.state = 112;
	        this.interopKind();
	        this.state = 113;
	        this.match(VbishParser.STRING_LITERAL);
	        this.state = 116;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===23) {
	            this.state = 114;
	            this.match(VbishParser.AS);
	            this.state = 115;
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
	        this.state = 118;
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
	        this.state = 123;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 26:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 120;
	            this.variableDecl();
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 121;
	            this.subDecl();
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 122;
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



	variableDecl() {
	    let localctx = new VariableDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, VbishParser.RULE_variableDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 125;
	        this.match(VbishParser.DIM);
	        this.state = 126;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 129;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===23) {
	            this.state = 127;
	            this.match(VbishParser.AS);
	            this.state = 128;
	            this.typeName();
	        }

	        this.state = 133;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===52) {
	            this.state = 131;
	            this.match(VbishParser.ASSIGN);
	            this.state = 132;
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



	subDecl() {
	    let localctx = new SubDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, VbishParser.RULE_subDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 135;
	        this.match(VbishParser.SUB);
	        this.state = 136;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 138;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 137;
	            this.parameterList();
	        }

	        this.state = 143;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	            this.state = 140;
	            this.statement();
	            this.state = 145;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 146;
	        this.match(VbishParser.END);
	        this.state = 147;
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
	    this.enterRule(localctx, 20, VbishParser.RULE_functionDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 149;
	        this.match(VbishParser.FUNCTION);
	        this.state = 150;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 152;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 151;
	            this.parameterList();
	        }

	        this.state = 156;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===23) {
	            this.state = 154;
	            this.match(VbishParser.AS);
	            this.state = 155;
	            this.typeName();
	        }

	        this.state = 161;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	            this.state = 158;
	            this.statement();
	            this.state = 163;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 164;
	        this.match(VbishParser.END);
	        this.state = 165;
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
	    this.enterRule(localctx, 22, VbishParser.RULE_parameterList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 167;
	        this.match(VbishParser.LPAREN);
	        this.state = 176;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 50)) & ~0x1f) === 0 && ((1 << (_la - 50)) & 917515) !== 0)) {
	            this.state = 168;
	            this.parameter();
	            this.state = 173;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===55) {
	                this.state = 169;
	                this.match(VbishParser.COMMA);
	                this.state = 170;
	                this.parameter();
	                this.state = 175;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 178;
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
	    this.enterRule(localctx, 24, VbishParser.RULE_parameter);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 180;
	        this.expression();
	        this.state = 183;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===23) {
	            this.state = 181;
	            this.match(VbishParser.AS);
	            this.state = 182;
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
	    this.enterRule(localctx, 26, VbishParser.RULE_statement);
	    try {
	        this.state = 193;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,19,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 185;
	            this.variableDecl();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 186;
	            this.ifStatement();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 187;
	            this.forStatement();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 188;
	            this.whileStatement();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 189;
	            this.printStatement();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 190;
	            this.assignment();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 191;
	            this.callStatement();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 192;
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
	    this.enterRule(localctx, 28, VbishParser.RULE_ifStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 195;
	        this.match(VbishParser.IF);
	        this.state = 196;
	        this.expression();
	        this.state = 197;
	        this.match(VbishParser.THEN);
	        this.state = 201;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	            this.state = 198;
	            this.statement();
	            this.state = 203;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 211;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===33) {
	            this.state = 204;
	            this.match(VbishParser.ELSE);
	            this.state = 208;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	                this.state = 205;
	                this.statement();
	                this.state = 210;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 213;
	        this.match(VbishParser.END);
	        this.state = 214;
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
	    this.enterRule(localctx, 30, VbishParser.RULE_forStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 216;
	        this.match(VbishParser.FOR);
	        this.state = 217;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 218;
	        this.match(VbishParser.ASSIGN);
	        this.state = 219;
	        this.expression();
	        this.state = 220;
	        this.match(VbishParser.TO);
	        this.state = 221;
	        this.expression();
	        this.state = 224;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===36) {
	            this.state = 222;
	            this.match(VbishParser.STEP);
	            this.state = 223;
	            this.expression();
	        }

	        this.state = 229;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	            this.state = 226;
	            this.statement();
	            this.state = 231;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 238;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 29:
	            this.state = 232;
	            this.match(VbishParser.END);
	            this.state = 233;
	            this.match(VbishParser.FOR);
	            break;
	        case 37:
	            this.state = 234;
	            this.match(VbishParser.NEXT);
	            this.state = 236;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,25,this._ctx);
	            if(la_===1) {
	                this.state = 235;
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
	    this.enterRule(localctx, 32, VbishParser.RULE_whileStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 240;
	        this.match(VbishParser.WHILE);
	        this.state = 241;
	        this.expression();
	        this.state = 245;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 26)) & ~0x1f) === 0 && ((1 << (_la - 26)) & 28977) !== 0) || _la===69) {
	            this.state = 242;
	            this.statement();
	            this.state = 247;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 248;
	        this.match(VbishParser.END);
	        this.state = 249;
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
	    this.enterRule(localctx, 34, VbishParser.RULE_printStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 251;
	        _la = this._input.LA(1);
	        if(!(_la===39 || _la===40)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 260;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,29,this._ctx);
	        if(la_===1) {
	            this.state = 252;
	            this.expression();
	            this.state = 257;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===55) {
	                this.state = 253;
	                this.match(VbishParser.COMMA);
	                this.state = 254;
	                this.expression();
	                this.state = 259;
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
	    this.enterRule(localctx, 36, VbishParser.RULE_assignment);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 262;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 263;
	        this.match(VbishParser.ASSIGN);
	        this.state = 264;
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
	    this.enterRule(localctx, 38, VbishParser.RULE_callStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 266;
	        this.match(VbishParser.IDENTIFIER);
	        this.state = 268;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===53) {
	            this.state = 267;
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
	    this.enterRule(localctx, 40, VbishParser.RULE_returnStatement);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 270;
	        this.match(VbishParser.RETURN);
	        this.state = 272;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,31,this._ctx);
	        if(la_===1) {
	            this.state = 271;
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
	    this.enterRule(localctx, 42, VbishParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 274;
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
	    this.enterRule(localctx, 44, VbishParser.RULE_logicalOr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 276;
	        this.logicalAnd();
	        this.state = 281;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===42 || _la===44) {
	            this.state = 277;
	            _la = this._input.LA(1);
	            if(!(_la===42 || _la===44)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 278;
	            this.logicalAnd();
	            this.state = 283;
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
	    this.enterRule(localctx, 46, VbishParser.RULE_logicalAnd);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 284;
	        this.equality();
	        this.state = 289;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===41 || _la===43) {
	            this.state = 285;
	            _la = this._input.LA(1);
	            if(!(_la===41 || _la===43)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 286;
	            this.equality();
	            this.state = 291;
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
	    this.enterRule(localctx, 48, VbishParser.RULE_equality);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 292;
	        this.relational();
	        this.state = 297;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===61 || _la===62) {
	            this.state = 293;
	            _la = this._input.LA(1);
	            if(!(_la===61 || _la===62)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 294;
	            this.relational();
	            this.state = 299;
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
	    this.enterRule(localctx, 50, VbishParser.RULE_relational);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 300;
	        this.additive();
	        this.state = 305;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 63)) & ~0x1f) === 0 && ((1 << (_la - 63)) & 15) !== 0)) {
	            this.state = 301;
	            _la = this._input.LA(1);
	            if(!(((((_la - 63)) & ~0x1f) === 0 && ((1 << (_la - 63)) & 15) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 302;
	            this.additive();
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



	additive() {
	    let localctx = new AdditiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 52, VbishParser.RULE_additive);
	    var _la = 0;
	    try {
	        this.state = 324;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,38,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 308;
	            this.multiplicative();
	            this.state = 313;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===57 || _la===58) {
	                this.state = 309;
	                _la = this._input.LA(1);
	                if(!(_la===57 || _la===58)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
	                this.state = 310;
	                this.multiplicative();
	                this.state = 315;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 316;
	            this.multiplicative();
	            this.state = 321;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===56) {
	                this.state = 317;
	                this.match(VbishParser.AMPERSAND);
	                this.state = 318;
	                this.multiplicative();
	                this.state = 323;
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
	    this.enterRule(localctx, 54, VbishParser.RULE_multiplicative);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 326;
	        this.primary();
	        this.state = 331;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===59 || _la===60) {
	            this.state = 327;
	            _la = this._input.LA(1);
	            if(!(_la===59 || _la===60)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 328;
	            this.primary();
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



	primary() {
	    let localctx = new PrimaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 56, VbishParser.RULE_primary);
	    var _la = 0;
	    try {
	        this.state = 346;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 68:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 334;
	            this.match(VbishParser.STRING_LITERAL);
	            break;
	        case 67:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 335;
	            this.match(VbishParser.NUMBER);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 336;
	            this.match(VbishParser.TRUE);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 337;
	            this.match(VbishParser.FALSE);
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 338;
	            this.match(VbishParser.IDENTIFIER);
	            this.state = 340;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===53) {
	                this.state = 339;
	                this.parameterList();
	            }

	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 342;
	            this.match(VbishParser.LPAREN);
	            this.state = 343;
	            this.expression();
	            this.state = 344;
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
	    this.enterRule(localctx, 58, VbishParser.RULE_concatenation);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 348;
	        this.match(VbishParser.AMPERSAND);
	        this.state = 349;
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
	    this.enterRule(localctx, 60, VbishParser.RULE_addOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 351;
	        _la = this._input.LA(1);
	        if(!(_la===57 || _la===58)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 352;
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
	    this.enterRule(localctx, 62, VbishParser.RULE_mulOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 354;
	        _la = this._input.LA(1);
	        if(!(_la===59 || _la===60)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 355;
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
	    this.enterRule(localctx, 64, VbishParser.RULE_relOp);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 357;
	        _la = this._input.LA(1);
	        if(!(((((_la - 61)) & ~0x1f) === 0 && ((1 << (_la - 61)) & 63) !== 0))) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 358;
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
	    this.enterRule(localctx, 66, VbishParser.RULE_typeName);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 360;
	        _la = this._input.LA(1);
	        if(!(((((_la - 46)) & ~0x1f) === 0 && ((1 << (_la - 46)) & 8388623) !== 0))) {
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
	    this.enterRule(localctx, 68, VbishParser.RULE_stringOrIdentifier);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 362;
	        _la = this._input.LA(1);
	        if(!(_la===68 || _la===69)) {
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
VbishParser.AS = 23;
VbishParser.OPTION = 24;
VbishParser.EXPLICIT = 25;
VbishParser.DIM = 26;
VbishParser.SUB = 27;
VbishParser.FUNCTION = 28;
VbishParser.END = 29;
VbishParser.RETURN = 30;
VbishParser.IF = 31;
VbishParser.THEN = 32;
VbishParser.ELSE = 33;
VbishParser.FOR = 34;
VbishParser.TO = 35;
VbishParser.STEP = 36;
VbishParser.NEXT = 37;
VbishParser.WHILE = 38;
VbishParser.PRINT = 39;
VbishParser.DISPLAY = 40;
VbishParser.AND = 41;
VbishParser.OR = 42;
VbishParser.ANDALSO = 43;
VbishParser.ORELSE = 44;
VbishParser.NOT = 45;
VbishParser.STRING = 46;
VbishParser.INTEGER = 47;
VbishParser.DOUBLE = 48;
VbishParser.BOOLEAN = 49;
VbishParser.TRUE = 50;
VbishParser.FALSE = 51;
VbishParser.ASSIGN = 52;
VbishParser.LPAREN = 53;
VbishParser.RPAREN = 54;
VbishParser.COMMA = 55;
VbishParser.AMPERSAND = 56;
VbishParser.PLUS = 57;
VbishParser.MINUS = 58;
VbishParser.MUL = 59;
VbishParser.DIV = 60;
VbishParser.EQ = 61;
VbishParser.NE = 62;
VbishParser.LT = 63;
VbishParser.GT = 64;
VbishParser.LTE = 65;
VbishParser.GTE = 66;
VbishParser.NUMBER = 67;
VbishParser.STRING_LITERAL = 68;
VbishParser.IDENTIFIER = 69;
VbishParser.COMMENT = 70;
VbishParser.WS = 71;

VbishParser.RULE_compilationUnit = 0;
VbishParser.RULE_optionExplicit = 1;
VbishParser.RULE_runtimeDecl = 2;
VbishParser.RULE_placement = 3;
VbishParser.RULE_intervalUnit = 4;
VbishParser.RULE_interopDecl = 5;
VbishParser.RULE_interopKind = 6;
VbishParser.RULE_topLevelDecl = 7;
VbishParser.RULE_variableDecl = 8;
VbishParser.RULE_subDecl = 9;
VbishParser.RULE_functionDecl = 10;
VbishParser.RULE_parameterList = 11;
VbishParser.RULE_parameter = 12;
VbishParser.RULE_statement = 13;
VbishParser.RULE_ifStatement = 14;
VbishParser.RULE_forStatement = 15;
VbishParser.RULE_whileStatement = 16;
VbishParser.RULE_printStatement = 17;
VbishParser.RULE_assignment = 18;
VbishParser.RULE_callStatement = 19;
VbishParser.RULE_returnStatement = 20;
VbishParser.RULE_expression = 21;
VbishParser.RULE_logicalOr = 22;
VbishParser.RULE_logicalAnd = 23;
VbishParser.RULE_equality = 24;
VbishParser.RULE_relational = 25;
VbishParser.RULE_additive = 26;
VbishParser.RULE_multiplicative = 27;
VbishParser.RULE_primary = 28;
VbishParser.RULE_concatenation = 29;
VbishParser.RULE_addOp = 30;
VbishParser.RULE_mulOp = 31;
VbishParser.RULE_relOp = 32;
VbishParser.RULE_typeName = 33;
VbishParser.RULE_stringOrIdentifier = 34;

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

	ASSIGN() {
	    return this.getToken(VbishParser.ASSIGN, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
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
