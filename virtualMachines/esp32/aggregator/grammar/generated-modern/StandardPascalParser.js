// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/StandardPascal.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import StandardPascalVisitor from './StandardPascalVisitor.js';

const serializedATN = [4,1,34,214,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,3,1,55,8,1,1,
1,5,1,58,8,1,10,1,12,1,61,9,1,1,1,1,1,1,2,1,2,4,2,67,8,2,11,2,12,2,68,1,
3,1,3,1,3,1,3,1,3,1,4,1,4,1,4,5,4,79,8,4,10,4,12,4,82,9,4,1,5,1,5,1,5,1,
5,3,5,88,8,5,1,5,1,5,1,5,3,5,93,8,5,1,5,1,5,1,5,1,6,1,6,1,6,5,6,101,8,6,
10,6,12,6,104,9,6,1,7,1,7,1,7,1,7,1,8,1,8,3,8,112,8,8,1,8,1,8,1,9,1,9,1,
9,5,9,119,8,9,10,9,12,9,122,9,9,1,9,3,9,125,8,9,1,10,1,10,1,10,1,10,1,10,
3,10,132,8,10,1,11,1,11,1,11,1,11,1,12,1,12,1,12,3,12,141,8,12,1,12,1,12,
1,13,1,13,1,13,1,13,1,13,1,13,3,13,151,8,13,1,14,1,14,1,14,3,14,156,8,14,
1,14,1,14,1,15,1,15,1,15,5,15,163,8,15,10,15,12,15,166,9,15,1,16,1,16,3,
16,170,8,16,1,17,1,17,1,17,5,17,175,8,17,10,17,12,17,178,9,17,1,18,1,18,
1,18,3,18,183,8,18,1,19,1,19,1,19,5,19,188,8,19,10,19,12,19,191,9,19,1,20,
1,20,1,20,5,20,196,8,20,10,20,12,20,199,9,20,1,21,1,21,1,21,3,21,204,8,21,
1,22,1,22,1,22,1,22,1,22,1,22,3,22,212,8,22,1,22,0,0,23,0,2,4,6,8,10,12,
14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,0,3,1,0,22,27,1,0,18,19,
1,0,20,21,216,0,46,1,0,0,0,2,54,1,0,0,0,4,64,1,0,0,0,6,70,1,0,0,0,8,75,1,
0,0,0,10,83,1,0,0,0,12,97,1,0,0,0,14,105,1,0,0,0,16,109,1,0,0,0,18,115,1,
0,0,0,20,131,1,0,0,0,22,133,1,0,0,0,24,137,1,0,0,0,26,144,1,0,0,0,28,152,
1,0,0,0,30,159,1,0,0,0,32,169,1,0,0,0,34,171,1,0,0,0,36,179,1,0,0,0,38,184,
1,0,0,0,40,192,1,0,0,0,42,203,1,0,0,0,44,211,1,0,0,0,46,47,5,1,0,0,47,48,
5,28,0,0,48,49,5,13,0,0,49,50,3,2,1,0,50,51,5,15,0,0,51,52,5,0,0,1,52,1,
1,0,0,0,53,55,3,4,2,0,54,53,1,0,0,0,54,55,1,0,0,0,55,59,1,0,0,0,56,58,3,
10,5,0,57,56,1,0,0,0,58,61,1,0,0,0,59,57,1,0,0,0,59,60,1,0,0,0,60,62,1,0,
0,0,61,59,1,0,0,0,62,63,3,16,8,0,63,3,1,0,0,0,64,66,5,2,0,0,65,67,3,6,3,
0,66,65,1,0,0,0,67,68,1,0,0,0,68,66,1,0,0,0,68,69,1,0,0,0,69,5,1,0,0,0,70,
71,3,8,4,0,71,72,5,12,0,0,72,73,5,6,0,0,73,74,5,13,0,0,74,7,1,0,0,0,75,80,
5,28,0,0,76,77,5,14,0,0,77,79,5,28,0,0,78,76,1,0,0,0,79,82,1,0,0,0,80,78,
1,0,0,0,80,81,1,0,0,0,81,9,1,0,0,0,82,80,1,0,0,0,83,84,5,3,0,0,84,85,5,28,
0,0,85,87,5,16,0,0,86,88,3,12,6,0,87,86,1,0,0,0,87,88,1,0,0,0,88,89,1,0,
0,0,89,90,5,17,0,0,90,92,5,13,0,0,91,93,3,4,2,0,92,91,1,0,0,0,92,93,1,0,
0,0,93,94,1,0,0,0,94,95,3,16,8,0,95,96,5,13,0,0,96,11,1,0,0,0,97,102,3,14,
7,0,98,99,5,13,0,0,99,101,3,14,7,0,100,98,1,0,0,0,101,104,1,0,0,0,102,100,
1,0,0,0,102,103,1,0,0,0,103,13,1,0,0,0,104,102,1,0,0,0,105,106,3,8,4,0,106,
107,5,12,0,0,107,108,5,6,0,0,108,15,1,0,0,0,109,111,5,4,0,0,110,112,3,18,
9,0,111,110,1,0,0,0,111,112,1,0,0,0,112,113,1,0,0,0,113,114,5,5,0,0,114,
17,1,0,0,0,115,120,3,20,10,0,116,117,5,13,0,0,117,119,3,20,10,0,118,116,
1,0,0,0,119,122,1,0,0,0,120,118,1,0,0,0,120,121,1,0,0,0,121,124,1,0,0,0,
122,120,1,0,0,0,123,125,5,13,0,0,124,123,1,0,0,0,124,125,1,0,0,0,125,19,
1,0,0,0,126,132,3,22,11,0,127,132,3,24,12,0,128,132,3,26,13,0,129,132,3,
28,14,0,130,132,3,16,8,0,131,126,1,0,0,0,131,127,1,0,0,0,131,128,1,0,0,0,
131,129,1,0,0,0,131,130,1,0,0,0,132,21,1,0,0,0,133,134,5,28,0,0,134,135,
5,11,0,0,135,136,3,36,18,0,136,23,1,0,0,0,137,138,5,28,0,0,138,140,5,16,
0,0,139,141,3,34,17,0,140,139,1,0,0,0,140,141,1,0,0,0,141,142,1,0,0,0,142,
143,5,17,0,0,143,25,1,0,0,0,144,145,5,7,0,0,145,146,3,36,18,0,146,147,5,
8,0,0,147,150,3,20,10,0,148,149,5,9,0,0,149,151,3,20,10,0,150,148,1,0,0,
0,150,151,1,0,0,0,151,27,1,0,0,0,152,153,5,10,0,0,153,155,5,16,0,0,154,156,
3,30,15,0,155,154,1,0,0,0,155,156,1,0,0,0,156,157,1,0,0,0,157,158,5,17,0,
0,158,29,1,0,0,0,159,164,3,32,16,0,160,161,5,14,0,0,161,163,3,32,16,0,162,
160,1,0,0,0,163,166,1,0,0,0,164,162,1,0,0,0,164,165,1,0,0,0,165,31,1,0,0,
0,166,164,1,0,0,0,167,170,3,36,18,0,168,170,5,30,0,0,169,167,1,0,0,0,169,
168,1,0,0,0,170,33,1,0,0,0,171,176,3,36,18,0,172,173,5,14,0,0,173,175,3,
36,18,0,174,172,1,0,0,0,175,178,1,0,0,0,176,174,1,0,0,0,176,177,1,0,0,0,
177,35,1,0,0,0,178,176,1,0,0,0,179,182,3,38,19,0,180,181,7,0,0,0,181,183,
3,38,19,0,182,180,1,0,0,0,182,183,1,0,0,0,183,37,1,0,0,0,184,189,3,40,20,
0,185,186,7,1,0,0,186,188,3,40,20,0,187,185,1,0,0,0,188,191,1,0,0,0,189,
187,1,0,0,0,189,190,1,0,0,0,190,39,1,0,0,0,191,189,1,0,0,0,192,197,3,42,
21,0,193,194,7,2,0,0,194,196,3,42,21,0,195,193,1,0,0,0,196,199,1,0,0,0,197,
195,1,0,0,0,197,198,1,0,0,0,198,41,1,0,0,0,199,197,1,0,0,0,200,201,5,19,
0,0,201,204,3,42,21,0,202,204,3,44,22,0,203,200,1,0,0,0,203,202,1,0,0,0,
204,43,1,0,0,0,205,212,5,29,0,0,206,212,5,28,0,0,207,208,5,16,0,0,208,209,
3,36,18,0,209,210,5,17,0,0,210,212,1,0,0,0,211,205,1,0,0,0,211,206,1,0,0,
0,211,207,1,0,0,0,212,45,1,0,0,0,22,54,59,68,80,87,92,102,111,120,124,131,
140,150,155,164,169,176,182,189,197,203,211];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class StandardPascalParser extends antlr4.Parser {

    static grammarFileName = "StandardPascal.g4";
    static literalNames = [ null, "'PROGRAM'", "'VAR'", "'PROCEDURE'", "'BEGIN'", 
                            "'END'", "'INTEGER'", "'IF'", "'THEN'", "'ELSE'", 
                            "'WRITELN'", "':='", "':'", "';'", "','", "'.'", 
                            "'('", "')'", "'+'", "'-'", "'*'", "'/'", "'='", 
                            "'<>'", "'<'", "'<='", "'>'", "'>='" ];
    static symbolicNames = [ null, "PROGRAM", "VAR", "PROCEDURE", "BEGIN", 
                             "END", "INTEGER", "IF", "THEN", "ELSE", "WRITELN", 
                             "ASSIGN", "COLON", "SEMICOLON", "COMMA", "DOT", 
                             "LPAREN", "RPAREN", "PLUS", "MINUS", "MUL", 
                             "DIV", "EQ", "NEQ", "LT", "LE", "GT", "GE", 
                             "IDENT", "NUMBER", "STRING", "BRACE_COMMENT", 
                             "PAREN_COMMENT", "LINE_COMMENT", "WS" ];
    static ruleNames = [ "program", "block", "varSection", "varDecl", "identList", 
                         "procedureDecl", "paramList", "paramDecl", "compoundStmt", 
                         "statementList", "statement", "assignment", "procedureCall", 
                         "ifStmt", "writelnStmt", "writeArgList", "writeArg", 
                         "argList", "expr", "additiveExpr", "multiplicativeExpr", 
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
	        this.state = 46;
	        this.match(StandardPascalParser.PROGRAM);
	        this.state = 47;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 48;
	        this.match(StandardPascalParser.SEMICOLON);
	        this.state = 49;
	        this.block();
	        this.state = 50;
	        this.match(StandardPascalParser.DOT);
	        this.state = 51;
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
	        this.state = 54;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 53;
	            this.varSection();
	        }

	        this.state = 59;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===3) {
	            this.state = 56;
	            this.procedureDecl();
	            this.state = 61;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 62;
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
	        this.state = 64;
	        this.match(StandardPascalParser.VAR);
	        this.state = 66; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 65;
	            this.varDecl();
	            this.state = 68; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===28);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	        this.state = 70;
	        this.identList();
	        this.state = 71;
	        this.match(StandardPascalParser.COLON);
	        this.state = 72;
	        this.match(StandardPascalParser.INTEGER);
	        this.state = 73;
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
	        this.state = 75;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 80;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===14) {
	            this.state = 76;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 77;
	            this.match(StandardPascalParser.IDENT);
	            this.state = 82;
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
	        this.state = 83;
	        this.match(StandardPascalParser.PROCEDURE);
	        this.state = 84;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 85;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 87;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===28) {
	            this.state = 86;
	            this.paramList();
	        }

	        this.state = 89;
	        this.match(StandardPascalParser.RPAREN);
	        this.state = 90;
	        this.match(StandardPascalParser.SEMICOLON);
	        this.state = 92;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 91;
	            this.varSection();
	        }

	        this.state = 94;
	        this.compoundStmt();
	        this.state = 95;
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
	        this.state = 97;
	        this.paramDecl();
	        this.state = 102;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===13) {
	            this.state = 98;
	            this.match(StandardPascalParser.SEMICOLON);
	            this.state = 99;
	            this.paramDecl();
	            this.state = 104;
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
	        this.state = 105;
	        this.identList();
	        this.state = 106;
	        this.match(StandardPascalParser.COLON);
	        this.state = 107;
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
	        this.state = 109;
	        this.match(StandardPascalParser.BEGIN);
	        this.state = 111;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 268436624) !== 0)) {
	            this.state = 110;
	            this.statementList();
	        }

	        this.state = 113;
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
	        this.state = 115;
	        this.statement();
	        this.state = 120;
	        this._errHandler.sync(this);
	        var _alt = this._interp.adaptivePredict(this._input,8,this._ctx)
	        while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	            if(_alt===1) {
	                this.state = 116;
	                this.match(StandardPascalParser.SEMICOLON);
	                this.state = 117;
	                this.statement(); 
	            }
	            this.state = 122;
	            this._errHandler.sync(this);
	            _alt = this._interp.adaptivePredict(this._input,8,this._ctx);
	        }

	        this.state = 124;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===13) {
	            this.state = 123;
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
	        this.state = 131;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 126;
	            this.assignment();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 127;
	            this.procedureCall();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 128;
	            this.ifStmt();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 129;
	            this.writelnStmt();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 130;
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
	        this.state = 133;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 134;
	        this.match(StandardPascalParser.ASSIGN);
	        this.state = 135;
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
	        this.state = 137;
	        this.match(StandardPascalParser.IDENT);
	        this.state = 138;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 140;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 805896192) !== 0)) {
	            this.state = 139;
	            this.argList();
	        }

	        this.state = 142;
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
	        this.state = 144;
	        this.match(StandardPascalParser.IF);
	        this.state = 145;
	        this.expr();
	        this.state = 146;
	        this.match(StandardPascalParser.THEN);
	        this.state = 147;
	        this.statement();
	        this.state = 150;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,12,this._ctx);
	        if(la_===1) {
	            this.state = 148;
	            this.match(StandardPascalParser.ELSE);
	            this.state = 149;
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
	        this.state = 152;
	        this.match(StandardPascalParser.WRITELN);
	        this.state = 153;
	        this.match(StandardPascalParser.LPAREN);
	        this.state = 155;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 1879638016) !== 0)) {
	            this.state = 154;
	            this.writeArgList();
	        }

	        this.state = 157;
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
	        this.state = 159;
	        this.writeArg();
	        this.state = 164;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===14) {
	            this.state = 160;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 161;
	            this.writeArg();
	            this.state = 166;
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
	        this.state = 169;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 16:
	        case 19:
	        case 28:
	        case 29:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 167;
	            this.expr();
	            break;
	        case 30:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 168;
	            this.match(StandardPascalParser.STRING);
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



	argList() {
	    let localctx = new ArgListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, StandardPascalParser.RULE_argList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 171;
	        this.expr();
	        this.state = 176;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===14) {
	            this.state = 172;
	            this.match(StandardPascalParser.COMMA);
	            this.state = 173;
	            this.expr();
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



	expr() {
	    let localctx = new ExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, StandardPascalParser.RULE_expr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 179;
	        this.additiveExpr();
	        this.state = 182;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 264241152) !== 0)) {
	            this.state = 180;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 264241152) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 181;
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
	    this.enterRule(localctx, 38, StandardPascalParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 184;
	        this.multiplicativeExpr();
	        this.state = 189;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===18 || _la===19) {
	            this.state = 185;
	            _la = this._input.LA(1);
	            if(!(_la===18 || _la===19)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 186;
	            this.multiplicativeExpr();
	            this.state = 191;
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
	    this.enterRule(localctx, 40, StandardPascalParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 192;
	        this.unaryExpr();
	        this.state = 197;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===20 || _la===21) {
	            this.state = 193;
	            _la = this._input.LA(1);
	            if(!(_la===20 || _la===21)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 194;
	            this.unaryExpr();
	            this.state = 199;
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
	    this.enterRule(localctx, 42, StandardPascalParser.RULE_unaryExpr);
	    try {
	        this.state = 203;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 19:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 200;
	            this.match(StandardPascalParser.MINUS);
	            this.state = 201;
	            this.unaryExpr();
	            break;
	        case 16:
	        case 28:
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 202;
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
	    this.enterRule(localctx, 44, StandardPascalParser.RULE_primary);
	    try {
	        this.state = 211;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 29:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 205;
	            this.match(StandardPascalParser.NUMBER);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 206;
	            this.match(StandardPascalParser.IDENT);
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 207;
	            this.match(StandardPascalParser.LPAREN);
	            this.state = 208;
	            this.expr();
	            this.state = 209;
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
StandardPascalParser.ASSIGN = 11;
StandardPascalParser.COLON = 12;
StandardPascalParser.SEMICOLON = 13;
StandardPascalParser.COMMA = 14;
StandardPascalParser.DOT = 15;
StandardPascalParser.LPAREN = 16;
StandardPascalParser.RPAREN = 17;
StandardPascalParser.PLUS = 18;
StandardPascalParser.MINUS = 19;
StandardPascalParser.MUL = 20;
StandardPascalParser.DIV = 21;
StandardPascalParser.EQ = 22;
StandardPascalParser.NEQ = 23;
StandardPascalParser.LT = 24;
StandardPascalParser.LE = 25;
StandardPascalParser.GT = 26;
StandardPascalParser.GE = 27;
StandardPascalParser.IDENT = 28;
StandardPascalParser.NUMBER = 29;
StandardPascalParser.STRING = 30;
StandardPascalParser.BRACE_COMMENT = 31;
StandardPascalParser.PAREN_COMMENT = 32;
StandardPascalParser.LINE_COMMENT = 33;
StandardPascalParser.WS = 34;

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
StandardPascalParser.RULE_additiveExpr = 19;
StandardPascalParser.RULE_multiplicativeExpr = 20;
StandardPascalParser.RULE_unaryExpr = 21;
StandardPascalParser.RULE_primary = 22;

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
	        return visitor.visitExpr(this);
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
StandardPascalParser.AdditiveExprContext = AdditiveExprContext; 
StandardPascalParser.MultiplicativeExprContext = MultiplicativeExprContext; 
StandardPascalParser.UnaryExprContext = UnaryExprContext; 
StandardPascalParser.PrimaryContext = PrimaryContext; 
