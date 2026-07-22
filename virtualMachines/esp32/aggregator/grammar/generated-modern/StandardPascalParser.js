// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/StandardPascal.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import StandardPascalVisitor from './StandardPascalVisitor.js';

const serializedATN = [4,1,37,241,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,1,0,1,0,1,0,1,
0,1,0,1,0,1,0,1,1,3,1,61,8,1,1,1,5,1,64,8,1,10,1,12,1,67,9,1,1,1,1,1,1,2,
1,2,4,2,73,8,2,11,2,12,2,74,1,3,1,3,1,3,1,3,1,3,1,4,1,4,1,4,5,4,85,8,4,10,
4,12,4,88,9,4,1,5,1,5,1,5,1,5,3,5,94,8,5,1,5,1,5,1,5,3,5,99,8,5,1,5,1,5,
1,5,1,6,1,6,1,6,5,6,107,8,6,10,6,12,6,110,9,6,1,7,1,7,1,7,1,7,1,8,1,8,3,
8,118,8,8,1,8,1,8,1,9,1,9,1,9,5,9,125,8,9,10,9,12,9,128,9,9,1,9,3,9,131,
8,9,1,10,1,10,1,10,1,10,1,10,3,10,138,8,10,1,11,1,11,1,11,1,11,1,12,1,12,
1,12,3,12,147,8,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,3,13,157,8,13,
1,14,1,14,1,14,3,14,162,8,14,1,14,1,14,1,15,1,15,1,15,5,15,169,8,15,10,15,
12,15,172,9,15,1,16,1,16,3,16,176,8,16,1,17,1,17,1,17,5,17,181,8,17,10,17,
12,17,184,9,17,1,18,1,18,1,19,1,19,1,19,5,19,191,8,19,10,19,12,19,194,9,
19,1,20,1,20,1,20,5,20,199,8,20,10,20,12,20,202,9,20,1,21,1,21,1,21,3,21,
207,8,21,1,22,1,22,1,22,5,22,212,8,22,10,22,12,22,215,9,22,1,23,1,23,1,23,
5,23,220,8,23,10,23,12,23,223,9,23,1,24,1,24,1,24,1,24,1,24,3,24,230,8,24,
1,25,1,25,1,25,1,25,1,25,1,25,1,25,3,25,239,8,25,1,25,0,0,26,0,2,4,6,8,10,
12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,0,3,1,0,25,30,
1,0,21,22,1,0,23,24,244,0,52,1,0,0,0,2,60,1,0,0,0,4,70,1,0,0,0,6,76,1,0,
0,0,8,81,1,0,0,0,10,89,1,0,0,0,12,103,1,0,0,0,14,111,1,0,0,0,16,115,1,0,
0,0,18,121,1,0,0,0,20,137,1,0,0,0,22,139,1,0,0,0,24,143,1,0,0,0,26,150,1,
0,0,0,28,158,1,0,0,0,30,165,1,0,0,0,32,175,1,0,0,0,34,177,1,0,0,0,36,185,
1,0,0,0,38,187,1,0,0,0,40,195,1,0,0,0,42,203,1,0,0,0,44,208,1,0,0,0,46,216,
1,0,0,0,48,229,1,0,0,0,50,238,1,0,0,0,52,53,5,1,0,0,53,54,5,31,0,0,54,55,
5,16,0,0,55,56,3,2,1,0,56,57,5,18,0,0,57,58,5,0,0,1,58,1,1,0,0,0,59,61,3,
4,2,0,60,59,1,0,0,0,60,61,1,0,0,0,61,65,1,0,0,0,62,64,3,10,5,0,63,62,1,0,
0,0,64,67,1,0,0,0,65,63,1,0,0,0,65,66,1,0,0,0,66,68,1,0,0,0,67,65,1,0,0,
0,68,69,3,16,8,0,69,3,1,0,0,0,70,72,5,2,0,0,71,73,3,6,3,0,72,71,1,0,0,0,
73,74,1,0,0,0,74,72,1,0,0,0,74,75,1,0,0,0,75,5,1,0,0,0,76,77,3,8,4,0,77,
78,5,15,0,0,78,79,5,6,0,0,79,80,5,16,0,0,80,7,1,0,0,0,81,86,5,31,0,0,82,
83,5,17,0,0,83,85,5,31,0,0,84,82,1,0,0,0,85,88,1,0,0,0,86,84,1,0,0,0,86,
87,1,0,0,0,87,9,1,0,0,0,88,86,1,0,0,0,89,90,5,3,0,0,90,91,5,31,0,0,91,93,
5,19,0,0,92,94,3,12,6,0,93,92,1,0,0,0,93,94,1,0,0,0,94,95,1,0,0,0,95,96,
5,20,0,0,96,98,5,16,0,0,97,99,3,4,2,0,98,97,1,0,0,0,98,99,1,0,0,0,99,100,
1,0,0,0,100,101,3,16,8,0,101,102,5,16,0,0,102,11,1,0,0,0,103,108,3,14,7,
0,104,105,5,16,0,0,105,107,3,14,7,0,106,104,1,0,0,0,107,110,1,0,0,0,108,
106,1,0,0,0,108,109,1,0,0,0,109,13,1,0,0,0,110,108,1,0,0,0,111,112,3,8,4,
0,112,113,5,15,0,0,113,114,5,6,0,0,114,15,1,0,0,0,115,117,5,4,0,0,116,118,
3,18,9,0,117,116,1,0,0,0,117,118,1,0,0,0,118,119,1,0,0,0,119,120,5,5,0,0,
120,17,1,0,0,0,121,126,3,20,10,0,122,123,5,16,0,0,123,125,3,20,10,0,124,
122,1,0,0,0,125,128,1,0,0,0,126,124,1,0,0,0,126,127,1,0,0,0,127,130,1,0,
0,0,128,126,1,0,0,0,129,131,5,16,0,0,130,129,1,0,0,0,130,131,1,0,0,0,131,
19,1,0,0,0,132,138,3,22,11,0,133,138,3,24,12,0,134,138,3,26,13,0,135,138,
3,28,14,0,136,138,3,16,8,0,137,132,1,0,0,0,137,133,1,0,0,0,137,134,1,0,0,
0,137,135,1,0,0,0,137,136,1,0,0,0,138,21,1,0,0,0,139,140,5,31,0,0,140,141,
5,14,0,0,141,142,3,36,18,0,142,23,1,0,0,0,143,144,5,31,0,0,144,146,5,19,
0,0,145,147,3,34,17,0,146,145,1,0,0,0,146,147,1,0,0,0,147,148,1,0,0,0,148,
149,5,20,0,0,149,25,1,0,0,0,150,151,5,7,0,0,151,152,3,36,18,0,152,153,5,
8,0,0,153,156,3,20,10,0,154,155,5,9,0,0,155,157,3,20,10,0,156,154,1,0,0,
0,156,157,1,0,0,0,157,27,1,0,0,0,158,159,5,10,0,0,159,161,5,19,0,0,160,162,
3,30,15,0,161,160,1,0,0,0,161,162,1,0,0,0,162,163,1,0,0,0,163,164,5,20,0,
0,164,29,1,0,0,0,165,170,3,32,16,0,166,167,5,17,0,0,167,169,3,32,16,0,168,
166,1,0,0,0,169,172,1,0,0,0,170,168,1,0,0,0,170,171,1,0,0,0,171,31,1,0,0,
0,172,170,1,0,0,0,173,176,3,36,18,0,174,176,5,33,0,0,175,173,1,0,0,0,175,
174,1,0,0,0,176,33,1,0,0,0,177,182,3,36,18,0,178,179,5,17,0,0,179,181,3,
36,18,0,180,178,1,0,0,0,181,184,1,0,0,0,182,180,1,0,0,0,182,183,1,0,0,0,
183,35,1,0,0,0,184,182,1,0,0,0,185,186,3,38,19,0,186,37,1,0,0,0,187,192,
3,40,20,0,188,189,5,11,0,0,189,191,3,40,20,0,190,188,1,0,0,0,191,194,1,0,
0,0,192,190,1,0,0,0,192,193,1,0,0,0,193,39,1,0,0,0,194,192,1,0,0,0,195,200,
3,42,21,0,196,197,5,12,0,0,197,199,3,42,21,0,198,196,1,0,0,0,199,202,1,0,
0,0,200,198,1,0,0,0,200,201,1,0,0,0,201,41,1,0,0,0,202,200,1,0,0,0,203,206,
3,44,22,0,204,205,7,0,0,0,205,207,3,44,22,0,206,204,1,0,0,0,206,207,1,0,
0,0,207,43,1,0,0,0,208,213,3,46,23,0,209,210,7,1,0,0,210,212,3,46,23,0,211,
209,1,0,0,0,212,215,1,0,0,0,213,211,1,0,0,0,213,214,1,0,0,0,214,45,1,0,0,
0,215,213,1,0,0,0,216,221,3,48,24,0,217,218,7,2,0,0,218,220,3,48,24,0,219,
217,1,0,0,0,220,223,1,0,0,0,221,219,1,0,0,0,221,222,1,0,0,0,222,47,1,0,0,
0,223,221,1,0,0,0,224,225,5,22,0,0,225,230,3,48,24,0,226,227,5,13,0,0,227,
230,3,48,24,0,228,230,3,50,25,0,229,224,1,0,0,0,229,226,1,0,0,0,229,228,
1,0,0,0,230,49,1,0,0,0,231,239,5,32,0,0,232,239,5,31,0,0,233,239,5,33,0,
0,234,235,5,19,0,0,235,236,3,36,18,0,236,237,5,20,0,0,237,239,1,0,0,0,238,
231,1,0,0,0,238,232,1,0,0,0,238,233,1,0,0,0,238,234,1,0,0,0,239,51,1,0,0,
0,24,60,65,74,86,93,98,108,117,126,130,137,146,156,161,170,175,182,192,200,
206,213,221,229,238];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class StandardPascalParser extends antlr4.Parser {

    static grammarFileName = "StandardPascal.g4";
    static literalNames = [ null, "'PROGRAM'", "'VAR'", "'PROCEDURE'", "'BEGIN'", 
                            "'END'", "'INTEGER'", "'IF'", "'THEN'", "'ELSE'", 
                            "'WRITELN'", "'OR'", "'AND'", "'NOT'", "':='", 
                            "':'", "';'", "','", "'.'", "'('", "')'", "'+'", 
                            "'-'", "'*'", "'/'", "'='", "'<>'", "'<'", "'<='", 
                            "'>'", "'>='" ];
    static symbolicNames = [ null, "PROGRAM", "VAR", "PROCEDURE", "BEGIN", 
                             "END", "INTEGER", "IF", "THEN", "ELSE", "WRITELN", 
                             "OR", "AND", "NOT", "ASSIGN", "COLON", "SEMICOLON", 
                             "COMMA", "DOT", "LPAREN", "RPAREN", "PLUS", 
                             "MINUS", "MUL", "DIV", "EQ", "NEQ", "LT", "LE", 
                             "GT", "GE", "IDENT", "NUMBER", "STRING", "BRACE_COMMENT", 
                             "PAREN_COMMENT", "LINE_COMMENT", "WS" ];
    static ruleNames = [ "program", "block", "varSection", "varDecl", "identList", 
                         "procedureDecl", "paramList", "paramDecl", "compoundStmt", 
                         "statementList", "statement", "assignment", "procedureCall", 
                         "ifStmt", "writelnStmt", "writeArgList", "writeArg", 
                         "argList", "expr", "logicalOrExpr", "logicalAndExpr", 
                         "comparisonExpr", "additiveExpr", "multiplicativeExpr", 
                         "unaryExpr", "primary" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = StandardPascalParser.ruleNames;
        this.literalNames = StandardPascalParser.literalNames;
        this.symbolicNames = StandardPascalParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, StandardPascalParser.RULE_program);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 52;
	        this.match(StandardPascalParser.PROGRAM);
	        this.state = 53;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 54;
	        this.match(StandardPascalParser.SEMICOLON);
	        this.state = 55;
	        this.block();
	        this.state = 56;
	        this.match(StandardPascalParser.DOT);
	        this.state = 57;
	        this.match(StandardPascalParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 2, StandardPascalParser.RULE_block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 60;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 59;
	            this.varSection();
	        }

	        this.state = 65;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===3) {
	            this.state = 62;
	            this.procedureDecl();
	            this.state = 67;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 68;
	        this.compoundStmt();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	varSection() {
	    let localctx = new VarSectionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, StandardPascalParser.RULE_varSection);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 70;
	        this.match(StandardPascalParser.VAR);
	        this.state = 72; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 71;
	            this.varDecl();
	            this.state = 74; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===31);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 6, StandardPascalParser.RULE_varDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 76;
	        this.identList();
	        this.state = 77;
	        this.match(StandardPascalParser.COLON);
	        this.state = 78;
	        this.match(StandardPascalParser.INTEGER);
	        this.state = 79;
	        this.match(StandardPascalParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 8, StandardPascalParser.RULE_identList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 81;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 86;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17) {
	            this.state = 82;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 83;
	            this.match(StandardPascalParser.IDENT);
	            this.state = 88;
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



	procedureDecl() {
	    let localctx = new ProcedureDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, StandardPascalParser.RULE_procedureDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 89;
	        this.match(StandardPascalParser.PROCEDURE);
	        this.state = 90;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 91;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 93;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===31) {
	            this.state = 92;
	            this.paramList();
	        }

	        this.state = 95;
	        this.match(StandardPascalParser.RPAREN);
	        this.state = 96;
	        this.match(StandardPascalParser.SEMICOLON);
	        this.state = 98;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 97;
	            this.varSection();
	        }

	        this.state = 100;
	        this.compoundStmt();
	        this.state = 101;
	        this.match(StandardPascalParser.SEMICOLON);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	paramList() {
	    let localctx = new ParamListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, StandardPascalParser.RULE_paramList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 103;
	        this.paramDecl();
	        this.state = 108;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===16) {
	            this.state = 104;
	            this.match(StandardPascalParser.SEMICOLON);
	            this.state = 105;
	            this.paramDecl();
	            this.state = 110;
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



	paramDecl() {
	    let localctx = new ParamDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, StandardPascalParser.RULE_paramDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 111;
	        this.identList();
	        this.state = 112;
	        this.match(StandardPascalParser.COLON);
	        this.state = 113;
	        this.match(StandardPascalParser.INTEGER);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	compoundStmt() {
	    let localctx = new CompoundStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, StandardPascalParser.RULE_compoundStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 115;
	        this.match(StandardPascalParser.BEGIN);
	        this.state = 117;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 2147484816) !== 0)) {
	            this.state = 116;
	            this.statementList();
	        }

	        this.state = 119;
	        this.match(StandardPascalParser.END);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	statementList() {
	    let localctx = new StatementListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, StandardPascalParser.RULE_statementList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 121;
	        this.statement();
	        this.state = 126;
	        this._errHandler.sync(this);
	        var _alt = this._interp.adaptivePredict(this._input,8,this._ctx)
	        while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	            if(_alt===1) {
	                this.state = 122;
	                this.match(StandardPascalParser.SEMICOLON);
	                this.state = 123;
	                this.statement(); 
	            }
	            this.state = 128;
	            this._errHandler.sync(this);
	            _alt = this._interp.adaptivePredict(this._input,8,this._ctx);
	        }

	        this.state = 130;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===16) {
	            this.state = 129;
	            this.match(StandardPascalParser.SEMICOLON);
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
	    this.enterRule(localctx, 20, StandardPascalParser.RULE_statement);
	    try {
	        this.state = 137;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 132;
	            this.assignment();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 133;
	            this.procedureCall();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 134;
	            this.ifStmt();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 135;
	            this.writelnStmt();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 136;
	            this.compoundStmt();
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



	assignment() {
	    let localctx = new AssignmentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, StandardPascalParser.RULE_assignment);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 139;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 140;
	        this.match(StandardPascalParser.ASSIGN);
	        this.state = 141;
	        this.expr();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	procedureCall() {
	    let localctx = new ProcedureCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, StandardPascalParser.RULE_procedureCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 143;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 144;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 146;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 13)) & ~0x1f) === 0 && ((1 << (_la - 13)) & 1835585) !== 0)) {
	            this.state = 145;
	            this.argList();
	        }

	        this.state = 148;
	        this.match(StandardPascalParser.RPAREN);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 26, StandardPascalParser.RULE_ifStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 150;
	        this.match(StandardPascalParser.IF);
	        this.state = 151;
	        this.expr();
	        this.state = 152;
	        this.match(StandardPascalParser.THEN);
	        this.state = 153;
	        this.statement();
	        this.state = 156;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,12,this._ctx);
	        if(la_===1) {
	            this.state = 154;
	            this.match(StandardPascalParser.ELSE);
	            this.state = 155;
	            this.statement();

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



	writelnStmt() {
	    let localctx = new WritelnStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, StandardPascalParser.RULE_writelnStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 158;
	        this.match(StandardPascalParser.WRITELN);
	        this.state = 159;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 161;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 13)) & ~0x1f) === 0 && ((1 << (_la - 13)) & 1835585) !== 0)) {
	            this.state = 160;
	            this.writeArgList();
	        }

	        this.state = 163;
	        this.match(StandardPascalParser.RPAREN);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	writeArgList() {
	    let localctx = new WriteArgListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, StandardPascalParser.RULE_writeArgList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 165;
	        this.writeArg();
	        this.state = 170;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17) {
	            this.state = 166;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 167;
	            this.writeArg();
	            this.state = 172;
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



	writeArg() {
	    let localctx = new WriteArgContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, StandardPascalParser.RULE_writeArg);
	    try {
	        this.state = 175;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,15,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 173;
	            this.expr();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 174;
	            this.match(StandardPascalParser.STRING);
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



	argList() {
	    let localctx = new ArgListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, StandardPascalParser.RULE_argList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 177;
	        this.expr();
	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17) {
	            this.state = 178;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 179;
	            this.expr();
	            this.state = 184;
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
	    this.enterRule(localctx, 36, StandardPascalParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 185;
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
	    this.enterRule(localctx, 38, StandardPascalParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 187;
	        this.logicalAndExpr();
	        this.state = 192;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===11) {
	            this.state = 188;
	            this.match(StandardPascalParser.OR);
	            this.state = 189;
	            this.logicalAndExpr();
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



	logicalAndExpr() {
	    let localctx = new LogicalAndExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, StandardPascalParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 195;
	        this.comparisonExpr();
	        this.state = 200;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===12) {
	            this.state = 196;
	            this.match(StandardPascalParser.AND);
	            this.state = 197;
	            this.comparisonExpr();
	            this.state = 202;
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



	comparisonExpr() {
	    let localctx = new ComparisonExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 42, StandardPascalParser.RULE_comparisonExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 203;
	        this.additiveExpr();
	        this.state = 206;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 2113929216) !== 0)) {
	            this.state = 204;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 2113929216) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 205;
	            this.additiveExpr();
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
	    this.enterRule(localctx, 44, StandardPascalParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 208;
	        this.multiplicativeExpr();
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===21 || _la===22) {
	            this.state = 209;
	            _la = this._input.LA(1);
	            if(!(_la===21 || _la===22)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 210;
	            this.multiplicativeExpr();
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



	multiplicativeExpr() {
	    let localctx = new MultiplicativeExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 46, StandardPascalParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 216;
	        this.unaryExpr();
	        this.state = 221;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===23 || _la===24) {
	            this.state = 217;
	            _la = this._input.LA(1);
	            if(!(_la===23 || _la===24)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 218;
	            this.unaryExpr();
	            this.state = 223;
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
	    this.enterRule(localctx, 48, StandardPascalParser.RULE_unaryExpr);
	    try {
	        this.state = 229;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 22:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 224;
	            this.match(StandardPascalParser.MINUS);
	            this.state = 225;
	            this.unaryExpr();
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 226;
	            this.match(StandardPascalParser.NOT);
	            this.state = 227;
	            this.unaryExpr();
	            break;
	        case 19:
	        case 31:
	        case 32:
	        case 33:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 228;
	            this.primary();
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



	primary() {
	    let localctx = new PrimaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 50, StandardPascalParser.RULE_primary);
	    try {
	        this.state = 238;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 32:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 231;
	            this.match(StandardPascalParser.NUMBER);
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 232;
	            this.match(StandardPascalParser.IDENT);
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 233;
	            this.match(StandardPascalParser.STRING);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 234;
	            this.match(StandardPascalParser.LPAREN);
	            this.state = 235;
	            this.expr();
	            this.state = 236;
	            this.match(StandardPascalParser.RPAREN);
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

StandardPascalParser.EOF = antlr4.Token.EOF;
StandardPascalParser.PROGRAM = 1;
StandardPascalParser.VAR = 2;
StandardPascalParser.PROCEDURE = 3;
StandardPascalParser.BEGIN = 4;
StandardPascalParser.END = 5;
StandardPascalParser.INTEGER = 6;
StandardPascalParser.IF = 7;
StandardPascalParser.THEN = 8;
StandardPascalParser.ELSE = 9;
StandardPascalParser.WRITELN = 10;
StandardPascalParser.OR = 11;
StandardPascalParser.AND = 12;
StandardPascalParser.NOT = 13;
StandardPascalParser.ASSIGN = 14;
StandardPascalParser.COLON = 15;
StandardPascalParser.SEMICOLON = 16;
StandardPascalParser.COMMA = 17;
StandardPascalParser.DOT = 18;
StandardPascalParser.LPAREN = 19;
StandardPascalParser.RPAREN = 20;
StandardPascalParser.PLUS = 21;
StandardPascalParser.MINUS = 22;
StandardPascalParser.MUL = 23;
StandardPascalParser.DIV = 24;
StandardPascalParser.EQ = 25;
StandardPascalParser.NEQ = 26;
StandardPascalParser.LT = 27;
StandardPascalParser.LE = 28;
StandardPascalParser.GT = 29;
StandardPascalParser.GE = 30;
StandardPascalParser.IDENT = 31;
StandardPascalParser.NUMBER = 32;
StandardPascalParser.STRING = 33;
StandardPascalParser.BRACE_COMMENT = 34;
StandardPascalParser.PAREN_COMMENT = 35;
StandardPascalParser.LINE_COMMENT = 36;
StandardPascalParser.WS = 37;

StandardPascalParser.RULE_program = 0;
StandardPascalParser.RULE_block = 1;
StandardPascalParser.RULE_varSection = 2;
StandardPascalParser.RULE_varDecl = 3;
StandardPascalParser.RULE_identList = 4;
StandardPascalParser.RULE_procedureDecl = 5;
StandardPascalParser.RULE_paramList = 6;
StandardPascalParser.RULE_paramDecl = 7;
StandardPascalParser.RULE_compoundStmt = 8;
StandardPascalParser.RULE_statementList = 9;
StandardPascalParser.RULE_statement = 10;
StandardPascalParser.RULE_assignment = 11;
StandardPascalParser.RULE_procedureCall = 12;
StandardPascalParser.RULE_ifStmt = 13;
StandardPascalParser.RULE_writelnStmt = 14;
StandardPascalParser.RULE_writeArgList = 15;
StandardPascalParser.RULE_writeArg = 16;
StandardPascalParser.RULE_argList = 17;
StandardPascalParser.RULE_expr = 18;
StandardPascalParser.RULE_logicalOrExpr = 19;
StandardPascalParser.RULE_logicalAndExpr = 20;
StandardPascalParser.RULE_comparisonExpr = 21;
StandardPascalParser.RULE_additiveExpr = 22;
StandardPascalParser.RULE_multiplicativeExpr = 23;
StandardPascalParser.RULE_unaryExpr = 24;
StandardPascalParser.RULE_primary = 25;

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
        this.ruleIndex = StandardPascalParser.RULE_program;
    }

	PROGRAM() {
	    return this.getToken(StandardPascalParser.PROGRAM, 0);
	};

	IDENT() {
	    return this.getToken(StandardPascalParser.IDENT, 0);
	};

	SEMICOLON() {
	    return this.getToken(StandardPascalParser.SEMICOLON, 0);
	};

	block() {
	    return this.getTypedRuleContext(BlockContext,0);
	};

	DOT() {
	    return this.getToken(StandardPascalParser.DOT, 0);
	};

	EOF() {
	    return this.getToken(StandardPascalParser.EOF, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitProgram(this);
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
        this.ruleIndex = StandardPascalParser.RULE_block;
    }

	compoundStmt() {
	    return this.getTypedRuleContext(CompoundStmtContext,0);
	};

	varSection() {
	    return this.getTypedRuleContext(VarSectionContext,0);
	};

	procedureDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ProcedureDeclContext);
	    } else {
	        return this.getTypedRuleContext(ProcedureDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitBlock(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class VarSectionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_varSection;
    }

	VAR() {
	    return this.getToken(StandardPascalParser.VAR, 0);
	};

	varDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(VarDeclContext);
	    } else {
	        return this.getTypedRuleContext(VarDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitVarSection(this);
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
        this.ruleIndex = StandardPascalParser.RULE_varDecl;
    }

	identList() {
	    return this.getTypedRuleContext(IdentListContext,0);
	};

	COLON() {
	    return this.getToken(StandardPascalParser.COLON, 0);
	};

	INTEGER() {
	    return this.getToken(StandardPascalParser.INTEGER, 0);
	};

	SEMICOLON() {
	    return this.getToken(StandardPascalParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
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
        this.ruleIndex = StandardPascalParser.RULE_identList;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.IDENT);
	    } else {
	        return this.getToken(StandardPascalParser.IDENT, i);
	    }
	};


	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.COMMA);
	    } else {
	        return this.getToken(StandardPascalParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitIdentList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ProcedureDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_procedureDecl;
    }

	PROCEDURE() {
	    return this.getToken(StandardPascalParser.PROCEDURE, 0);
	};

	IDENT() {
	    return this.getToken(StandardPascalParser.IDENT, 0);
	};

	LPAREN() {
	    return this.getToken(StandardPascalParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(StandardPascalParser.RPAREN, 0);
	};

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.SEMICOLON);
	    } else {
	        return this.getToken(StandardPascalParser.SEMICOLON, i);
	    }
	};


	compoundStmt() {
	    return this.getTypedRuleContext(CompoundStmtContext,0);
	};

	paramList() {
	    return this.getTypedRuleContext(ParamListContext,0);
	};

	varSection() {
	    return this.getTypedRuleContext(VarSectionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitProcedureDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParamListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_paramList;
    }

	paramDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ParamDeclContext);
	    } else {
	        return this.getTypedRuleContext(ParamDeclContext,i);
	    }
	};

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.SEMICOLON);
	    } else {
	        return this.getToken(StandardPascalParser.SEMICOLON, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitParamList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ParamDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_paramDecl;
    }

	identList() {
	    return this.getTypedRuleContext(IdentListContext,0);
	};

	COLON() {
	    return this.getToken(StandardPascalParser.COLON, 0);
	};

	INTEGER() {
	    return this.getToken(StandardPascalParser.INTEGER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitParamDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CompoundStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_compoundStmt;
    }

	BEGIN() {
	    return this.getToken(StandardPascalParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(StandardPascalParser.END, 0);
	};

	statementList() {
	    return this.getTypedRuleContext(StatementListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitCompoundStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StatementListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_statementList;
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

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.SEMICOLON);
	    } else {
	        return this.getToken(StandardPascalParser.SEMICOLON, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitStatementList(this);
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
        this.ruleIndex = StandardPascalParser.RULE_statement;
    }

	assignment() {
	    return this.getTypedRuleContext(AssignmentContext,0);
	};

	procedureCall() {
	    return this.getTypedRuleContext(ProcedureCallContext,0);
	};

	ifStmt() {
	    return this.getTypedRuleContext(IfStmtContext,0);
	};

	writelnStmt() {
	    return this.getTypedRuleContext(WritelnStmtContext,0);
	};

	compoundStmt() {
	    return this.getTypedRuleContext(CompoundStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitStatement(this);
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
        this.ruleIndex = StandardPascalParser.RULE_assignment;
    }

	IDENT() {
	    return this.getToken(StandardPascalParser.IDENT, 0);
	};

	ASSIGN() {
	    return this.getToken(StandardPascalParser.ASSIGN, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitAssignment(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ProcedureCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_procedureCall;
    }

	IDENT() {
	    return this.getToken(StandardPascalParser.IDENT, 0);
	};

	LPAREN() {
	    return this.getToken(StandardPascalParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(StandardPascalParser.RPAREN, 0);
	};

	argList() {
	    return this.getTypedRuleContext(ArgListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitProcedureCall(this);
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
        this.ruleIndex = StandardPascalParser.RULE_ifStmt;
    }

	IF() {
	    return this.getToken(StandardPascalParser.IF, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	THEN() {
	    return this.getToken(StandardPascalParser.THEN, 0);
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
	    return this.getToken(StandardPascalParser.ELSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitIfStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WritelnStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_writelnStmt;
    }

	WRITELN() {
	    return this.getToken(StandardPascalParser.WRITELN, 0);
	};

	LPAREN() {
	    return this.getToken(StandardPascalParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(StandardPascalParser.RPAREN, 0);
	};

	writeArgList() {
	    return this.getTypedRuleContext(WriteArgListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitWritelnStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WriteArgListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_writeArgList;
    }

	writeArg = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WriteArgContext);
	    } else {
	        return this.getTypedRuleContext(WriteArgContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.COMMA);
	    } else {
	        return this.getToken(StandardPascalParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitWriteArgList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WriteArgContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_writeArg;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	STRING() {
	    return this.getToken(StandardPascalParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitWriteArg(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArgListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_argList;
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

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.COMMA);
	    } else {
	        return this.getToken(StandardPascalParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitArgList(this);
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
        this.ruleIndex = StandardPascalParser.RULE_expr;
    }

	logicalOrExpr() {
	    return this.getTypedRuleContext(LogicalOrExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
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
        this.ruleIndex = StandardPascalParser.RULE_logicalOrExpr;
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

	OR = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.OR);
	    } else {
	        return this.getToken(StandardPascalParser.OR, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
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
        this.ruleIndex = StandardPascalParser.RULE_logicalAndExpr;
    }

	comparisonExpr = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ComparisonExprContext);
	    } else {
	        return this.getTypedRuleContext(ComparisonExprContext,i);
	    }
	};

	AND = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.AND);
	    } else {
	        return this.getToken(StandardPascalParser.AND, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitLogicalAndExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ComparisonExprContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = StandardPascalParser.RULE_comparisonExpr;
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

	EQ() {
	    return this.getToken(StandardPascalParser.EQ, 0);
	};

	NEQ() {
	    return this.getToken(StandardPascalParser.NEQ, 0);
	};

	LT() {
	    return this.getToken(StandardPascalParser.LT, 0);
	};

	LE() {
	    return this.getToken(StandardPascalParser.LE, 0);
	};

	GT() {
	    return this.getToken(StandardPascalParser.GT, 0);
	};

	GE() {
	    return this.getToken(StandardPascalParser.GE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitComparisonExpr(this);
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
        this.ruleIndex = StandardPascalParser.RULE_additiveExpr;
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

	PLUS = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.PLUS);
	    } else {
	        return this.getToken(StandardPascalParser.PLUS, i);
	    }
	};


	MINUS = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.MINUS);
	    } else {
	        return this.getToken(StandardPascalParser.MINUS, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
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
        this.ruleIndex = StandardPascalParser.RULE_multiplicativeExpr;
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

	MUL = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.MUL);
	    } else {
	        return this.getToken(StandardPascalParser.MUL, i);
	    }
	};


	DIV = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(StandardPascalParser.DIV);
	    } else {
	        return this.getToken(StandardPascalParser.DIV, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
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
        this.ruleIndex = StandardPascalParser.RULE_unaryExpr;
    }

	MINUS() {
	    return this.getToken(StandardPascalParser.MINUS, 0);
	};

	unaryExpr() {
	    return this.getTypedRuleContext(UnaryExprContext,0);
	};

	NOT() {
	    return this.getToken(StandardPascalParser.NOT, 0);
	};

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitUnaryExpr(this);
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
        this.ruleIndex = StandardPascalParser.RULE_primary;
    }

	NUMBER() {
	    return this.getToken(StandardPascalParser.NUMBER, 0);
	};

	IDENT() {
	    return this.getToken(StandardPascalParser.IDENT, 0);
	};

	STRING() {
	    return this.getToken(StandardPascalParser.STRING, 0);
	};

	LPAREN() {
	    return this.getToken(StandardPascalParser.LPAREN, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	RPAREN() {
	    return this.getToken(StandardPascalParser.RPAREN, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof StandardPascalVisitor ) {
	        return visitor.visitPrimary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




StandardPascalParser.ProgramContext = ProgramContext; 
StandardPascalParser.BlockContext = BlockContext; 
StandardPascalParser.VarSectionContext = VarSectionContext; 
StandardPascalParser.VarDeclContext = VarDeclContext; 
StandardPascalParser.IdentListContext = IdentListContext; 
StandardPascalParser.ProcedureDeclContext = ProcedureDeclContext; 
StandardPascalParser.ParamListContext = ParamListContext; 
StandardPascalParser.ParamDeclContext = ParamDeclContext; 
StandardPascalParser.CompoundStmtContext = CompoundStmtContext; 
StandardPascalParser.StatementListContext = StatementListContext; 
StandardPascalParser.StatementContext = StatementContext; 
StandardPascalParser.AssignmentContext = AssignmentContext; 
StandardPascalParser.ProcedureCallContext = ProcedureCallContext; 
StandardPascalParser.IfStmtContext = IfStmtContext; 
StandardPascalParser.WritelnStmtContext = WritelnStmtContext; 
StandardPascalParser.WriteArgListContext = WriteArgListContext; 
StandardPascalParser.WriteArgContext = WriteArgContext; 
StandardPascalParser.ArgListContext = ArgListContext; 
StandardPascalParser.ExprContext = ExprContext; 
StandardPascalParser.LogicalOrExprContext = LogicalOrExprContext; 
StandardPascalParser.LogicalAndExprContext = LogicalAndExprContext; 
StandardPascalParser.ComparisonExprContext = ComparisonExprContext; 
StandardPascalParser.AdditiveExprContext = AdditiveExprContext; 
StandardPascalParser.MultiplicativeExprContext = MultiplicativeExprContext; 
StandardPascalParser.UnaryExprContext = UnaryExprContext; 
StandardPascalParser.PrimaryContext = PrimaryContext; 
