// Generated from ./aggregator/grammar/MAPL.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import MAPLVisitor from './MAPLVisitor.js';

const serializedATN = [4,1,40,209,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,1,0,5,0,46,8,0,10,0,12,0,49,9,0,1,0,1,0,1,1,1,1,1,1,1,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,5,2,65,8,2,10,2,12,2,68,9,2,1,3,1,3,1,
3,1,3,1,3,1,3,3,3,76,8,3,1,4,1,4,1,4,5,4,81,8,4,10,4,12,4,84,9,4,1,5,1,5,
1,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,
3,8,106,8,8,1,8,1,8,1,9,1,9,1,9,1,9,1,9,1,9,3,9,116,8,9,1,9,1,9,1,9,1,10,
1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,11,1,11,1,11,1,11,1,12,1,12,1,
12,5,12,137,8,12,10,12,12,12,140,9,12,1,13,1,13,1,14,1,14,1,14,5,14,147,
8,14,10,14,12,14,150,9,14,1,15,1,15,1,15,5,15,155,8,15,10,15,12,15,158,9,
15,1,16,1,16,1,16,5,16,163,8,16,10,16,12,16,166,9,16,1,17,1,17,1,17,5,17,
171,8,17,10,17,12,17,174,9,17,1,18,1,18,1,18,5,18,179,8,18,10,18,12,18,182,
9,18,1,19,1,19,1,19,5,19,187,8,19,10,19,12,19,190,9,19,1,20,1,20,1,20,3,
20,195,8,20,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,1,21,3,21,207,8,
21,1,21,0,0,22,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,
42,0,5,1,0,21,22,1,0,23,26,1,0,27,28,1,0,29,31,2,0,28,28,32,32,210,0,47,
1,0,0,0,2,52,1,0,0,0,4,66,1,0,0,0,6,75,1,0,0,0,8,77,1,0,0,0,10,85,1,0,0,
0,12,90,1,0,0,0,14,97,1,0,0,0,16,102,1,0,0,0,18,109,1,0,0,0,20,120,1,0,0,
0,22,129,1,0,0,0,24,133,1,0,0,0,26,141,1,0,0,0,28,143,1,0,0,0,30,151,1,0,
0,0,32,159,1,0,0,0,34,167,1,0,0,0,36,175,1,0,0,0,38,183,1,0,0,0,40,194,1,
0,0,0,42,206,1,0,0,0,44,46,3,2,1,0,45,44,1,0,0,0,46,49,1,0,0,0,47,45,1,0,
0,0,47,48,1,0,0,0,48,50,1,0,0,0,49,47,1,0,0,0,50,51,5,0,0,1,51,1,1,0,0,0,
52,53,5,1,0,0,53,54,5,35,0,0,54,55,5,2,0,0,55,56,5,35,0,0,56,57,5,3,0,0,
57,58,5,35,0,0,58,59,5,4,0,0,59,60,3,4,2,0,60,61,5,5,0,0,61,62,5,4,0,0,62,
3,1,0,0,0,63,65,3,6,3,0,64,63,1,0,0,0,65,68,1,0,0,0,66,64,1,0,0,0,66,67,
1,0,0,0,67,5,1,0,0,0,68,66,1,0,0,0,69,76,3,10,5,0,70,76,3,12,6,0,71,76,3,
14,7,0,72,76,3,18,9,0,73,76,3,20,10,0,74,76,3,22,11,0,75,69,1,0,0,0,75,70,
1,0,0,0,75,71,1,0,0,0,75,72,1,0,0,0,75,73,1,0,0,0,75,74,1,0,0,0,76,7,1,0,
0,0,77,82,5,35,0,0,78,79,5,6,0,0,79,81,5,35,0,0,80,78,1,0,0,0,81,84,1,0,
0,0,82,80,1,0,0,0,82,83,1,0,0,0,83,9,1,0,0,0,84,82,1,0,0,0,85,86,3,8,4,0,
86,87,5,7,0,0,87,88,3,8,4,0,88,89,5,4,0,0,89,11,1,0,0,0,90,91,3,8,4,0,91,
92,5,7,0,0,92,93,3,8,4,0,93,94,5,8,0,0,94,95,3,26,13,0,95,96,5,4,0,0,96,
13,1,0,0,0,97,98,3,8,4,0,98,99,5,7,0,0,99,100,3,16,8,0,100,101,5,4,0,0,101,
15,1,0,0,0,102,103,5,35,0,0,103,105,5,9,0,0,104,106,3,24,12,0,105,104,1,
0,0,0,105,106,1,0,0,0,106,107,1,0,0,0,107,108,5,10,0,0,108,17,1,0,0,0,109,
110,5,11,0,0,110,111,3,26,13,0,111,112,5,12,0,0,112,115,3,4,2,0,113,114,
5,13,0,0,114,116,3,4,2,0,115,113,1,0,0,0,115,116,1,0,0,0,116,117,1,0,0,0,
117,118,5,5,0,0,118,119,5,4,0,0,119,19,1,0,0,0,120,121,5,14,0,0,121,122,
5,15,0,0,122,123,3,8,4,0,123,124,5,16,0,0,124,125,5,35,0,0,125,126,3,4,2,
0,126,127,5,5,0,0,127,128,5,4,0,0,128,21,1,0,0,0,129,130,5,17,0,0,130,131,
3,26,13,0,131,132,5,4,0,0,132,23,1,0,0,0,133,138,3,26,13,0,134,135,5,18,
0,0,135,137,3,26,13,0,136,134,1,0,0,0,137,140,1,0,0,0,138,136,1,0,0,0,138,
139,1,0,0,0,139,25,1,0,0,0,140,138,1,0,0,0,141,142,3,28,14,0,142,27,1,0,
0,0,143,148,3,30,15,0,144,145,5,19,0,0,145,147,3,30,15,0,146,144,1,0,0,0,
147,150,1,0,0,0,148,146,1,0,0,0,148,149,1,0,0,0,149,29,1,0,0,0,150,148,1,
0,0,0,151,156,3,32,16,0,152,153,5,20,0,0,153,155,3,32,16,0,154,152,1,0,0,
0,155,158,1,0,0,0,156,154,1,0,0,0,156,157,1,0,0,0,157,31,1,0,0,0,158,156,
1,0,0,0,159,164,3,34,17,0,160,161,7,0,0,0,161,163,3,34,17,0,162,160,1,0,
0,0,163,166,1,0,0,0,164,162,1,0,0,0,164,165,1,0,0,0,165,33,1,0,0,0,166,164,
1,0,0,0,167,172,3,36,18,0,168,169,7,1,0,0,169,171,3,36,18,0,170,168,1,0,
0,0,171,174,1,0,0,0,172,170,1,0,0,0,172,173,1,0,0,0,173,35,1,0,0,0,174,172,
1,0,0,0,175,180,3,38,19,0,176,177,7,2,0,0,177,179,3,38,19,0,178,176,1,0,
0,0,179,182,1,0,0,0,180,178,1,0,0,0,180,181,1,0,0,0,181,37,1,0,0,0,182,180,
1,0,0,0,183,188,3,40,20,0,184,185,7,3,0,0,185,187,3,40,20,0,186,184,1,0,
0,0,187,190,1,0,0,0,188,186,1,0,0,0,188,189,1,0,0,0,189,39,1,0,0,0,190,188,
1,0,0,0,191,192,7,4,0,0,192,195,3,40,20,0,193,195,3,42,21,0,194,191,1,0,
0,0,194,193,1,0,0,0,195,41,1,0,0,0,196,207,5,36,0,0,197,207,5,37,0,0,198,
207,5,33,0,0,199,207,5,34,0,0,200,207,3,16,8,0,201,207,3,8,4,0,202,203,5,
9,0,0,203,204,3,26,13,0,204,205,5,10,0,0,205,207,1,0,0,0,206,196,1,0,0,0,
206,197,1,0,0,0,206,198,1,0,0,0,206,199,1,0,0,0,206,200,1,0,0,0,206,201,
1,0,0,0,206,202,1,0,0,0,207,43,1,0,0,0,15,47,66,75,82,105,115,138,148,156,
164,172,180,188,194,206];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class MAPLParser extends antlr4.Parser {

    static grammarFileName = "MAPL.g4";
    static literalNames = [ null, "'map'", "'from'", "'to'", "';'", "'end'", 
                            "'.'", "':='", "'default'", "'('", "')'", "'if'", 
                            "'then'", "'else'", "'for'", "'each'", "'as'", 
                            "'validate'", "','", "'or'", "'and'", "'='", 
                            "'<>'", "'<'", "'<='", "'>'", "'>='", "'+'", 
                            "'-'", "'*'", "'/'", "'mod'", "'not'", "'true'", 
                            "'false'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, "IDENT", "NUMBER", "STRING", 
                             "LINE_COMMENT", "BLOCK_COMMENT", "WS" ];
    static ruleNames = [ "mapUnit", "mapDecl", "mapBody", "mapStmt", "fieldPath", 
                         "assignStmt", "assignDefaultStmt", "functionAssignStmt", 
                         "functionCall", "ifStmt", "forStmt", "validateStmt", 
                         "exprList", "expr", "logicalOrExpr", "logicalAndExpr", 
                         "equalityExpr", "relationalExpr", "additiveExpr", 
                         "multiplicativeExpr", "unaryExpr", "primaryExpr" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = MAPLParser.ruleNames;
        this.literalNames = MAPLParser.literalNames;
        this.symbolicNames = MAPLParser.symbolicNames;
    }



	mapUnit() {
	    let localctx = new MapUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, MAPLParser.RULE_mapUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 47;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1) {
	            this.state = 44;
	            this.mapDecl();
	            this.state = 49;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 50;
	        this.match(MAPLParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 2, MAPLParser.RULE_mapDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 52;
	        this.match(MAPLParser.T__0);
	        this.state = 53;
	        this.match(MAPLParser.IDENT);
	        this.state = 54;
	        this.match(MAPLParser.T__1);
	        this.state = 55;
	        this.match(MAPLParser.IDENT);
	        this.state = 56;
	        this.match(MAPLParser.T__2);
	        this.state = 57;
	        this.match(MAPLParser.IDENT);
	        this.state = 58;
	        this.match(MAPLParser.T__3);
	        this.state = 59;
	        this.mapBody();
	        this.state = 60;
	        this.match(MAPLParser.T__4);
	        this.state = 61;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	mapBody() {
	    let localctx = new MapBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, MAPLParser.RULE_mapBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 66;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 11)) & ~0x1f) === 0 && ((1 << (_la - 11)) & 16777289) !== 0)) {
	            this.state = 63;
	            this.mapStmt();
	            this.state = 68;
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



	mapStmt() {
	    let localctx = new MapStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, MAPLParser.RULE_mapStmt);
	    try {
	        this.state = 75;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,2,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 69;
	            this.assignStmt();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 70;
	            this.assignDefaultStmt();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 71;
	            this.functionAssignStmt();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 72;
	            this.ifStmt();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 73;
	            this.forStmt();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 74;
	            this.validateStmt();
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



	fieldPath() {
	    let localctx = new FieldPathContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, MAPLParser.RULE_fieldPath);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 77;
	        this.match(MAPLParser.IDENT);
	        this.state = 82;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===6) {
	            this.state = 78;
	            this.match(MAPLParser.T__5);
	            this.state = 79;
	            this.match(MAPLParser.IDENT);
	            this.state = 84;
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



	assignStmt() {
	    let localctx = new AssignStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, MAPLParser.RULE_assignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 85;
	        this.fieldPath();
	        this.state = 86;
	        this.match(MAPLParser.T__6);
	        this.state = 87;
	        this.fieldPath();
	        this.state = 88;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	assignDefaultStmt() {
	    let localctx = new AssignDefaultStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, MAPLParser.RULE_assignDefaultStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 90;
	        this.fieldPath();
	        this.state = 91;
	        this.match(MAPLParser.T__6);
	        this.state = 92;
	        this.fieldPath();
	        this.state = 93;
	        this.match(MAPLParser.T__7);
	        this.state = 94;
	        this.expr();
	        this.state = 95;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionAssignStmt() {
	    let localctx = new FunctionAssignStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, MAPLParser.RULE_functionAssignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 97;
	        this.fieldPath();
	        this.state = 98;
	        this.match(MAPLParser.T__6);
	        this.state = 99;
	        this.functionCall();
	        this.state = 100;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionCall() {
	    let localctx = new FunctionCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, MAPLParser.RULE_functionCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 102;
	        this.match(MAPLParser.IDENT);
	        this.state = 103;
	        this.match(MAPLParser.T__8);
	        this.state = 105;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(((((_la - 9)) & ~0x1f) === 0 && ((1 << (_la - 9)) & 529006593) !== 0)) {
	            this.state = 104;
	            this.exprList();
	        }

	        this.state = 107;
	        this.match(MAPLParser.T__9);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 18, MAPLParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 109;
	        this.match(MAPLParser.T__10);
	        this.state = 110;
	        this.expr();
	        this.state = 111;
	        this.match(MAPLParser.T__11);
	        this.state = 112;
	        this.mapBody();
	        this.state = 115;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===13) {
	            this.state = 113;
	            this.match(MAPLParser.T__12);
	            this.state = 114;
	            this.mapBody();
	        }

	        this.state = 117;
	        this.match(MAPLParser.T__4);
	        this.state = 118;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 20, MAPLParser.RULE_forStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 120;
	        this.match(MAPLParser.T__13);
	        this.state = 121;
	        this.match(MAPLParser.T__14);
	        this.state = 122;
	        this.fieldPath();
	        this.state = 123;
	        this.match(MAPLParser.T__15);
	        this.state = 124;
	        this.match(MAPLParser.IDENT);
	        this.state = 125;
	        this.mapBody();
	        this.state = 126;
	        this.match(MAPLParser.T__4);
	        this.state = 127;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	validateStmt() {
	    let localctx = new ValidateStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, MAPLParser.RULE_validateStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 129;
	        this.match(MAPLParser.T__16);
	        this.state = 130;
	        this.expr();
	        this.state = 131;
	        this.match(MAPLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 24, MAPLParser.RULE_exprList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 133;
	        this.expr();
	        this.state = 138;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===18) {
	            this.state = 134;
	            this.match(MAPLParser.T__17);
	            this.state = 135;
	            this.expr();
	            this.state = 140;
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
	    this.enterRule(localctx, 26, MAPLParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 141;
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
	    this.enterRule(localctx, 28, MAPLParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 143;
	        this.logicalAndExpr();
	        this.state = 148;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===19) {
	            this.state = 144;
	            this.match(MAPLParser.T__18);
	            this.state = 145;
	            this.logicalAndExpr();
	            this.state = 150;
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
	    this.enterRule(localctx, 30, MAPLParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 151;
	        this.equalityExpr();
	        this.state = 156;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===20) {
	            this.state = 152;
	            this.match(MAPLParser.T__19);
	            this.state = 153;
	            this.equalityExpr();
	            this.state = 158;
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
	    this.enterRule(localctx, 32, MAPLParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 159;
	        this.relationalExpr();
	        this.state = 164;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===21 || _la===22) {
	            this.state = 160;
	            _la = this._input.LA(1);
	            if(!(_la===21 || _la===22)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 161;
	            this.relationalExpr();
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



	relationalExpr() {
	    let localctx = new RelationalExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, MAPLParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 167;
	        this.additiveExpr();
	        this.state = 172;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 125829120) !== 0)) {
	            this.state = 168;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 125829120) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 169;
	            this.additiveExpr();
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



	additiveExpr() {
	    let localctx = new AdditiveExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, MAPLParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 175;
	        this.multiplicativeExpr();
	        this.state = 180;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===27 || _la===28) {
	            this.state = 176;
	            _la = this._input.LA(1);
	            if(!(_la===27 || _la===28)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 177;
	            this.multiplicativeExpr();
	            this.state = 182;
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
	    this.enterRule(localctx, 38, MAPLParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 183;
	        this.unaryExpr();
	        this.state = 188;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 3758096384) !== 0)) {
	            this.state = 184;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 3758096384) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 185;
	            this.unaryExpr();
	            this.state = 190;
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
	    this.enterRule(localctx, 40, MAPLParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 194;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 28:
	        case 32:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 191;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===32)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 192;
	            this.unaryExpr();
	            break;
	        case 9:
	        case 33:
	        case 34:
	        case 35:
	        case 36:
	        case 37:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 193;
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
	    this.enterRule(localctx, 42, MAPLParser.RULE_primaryExpr);
	    try {
	        this.state = 206;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,14,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 196;
	            this.match(MAPLParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 197;
	            this.match(MAPLParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 198;
	            this.match(MAPLParser.T__32);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 199;
	            this.match(MAPLParser.T__33);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 200;
	            this.functionCall();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 201;
	            this.fieldPath();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 202;
	            this.match(MAPLParser.T__8);
	            this.state = 203;
	            this.expr();
	            this.state = 204;
	            this.match(MAPLParser.T__9);
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

MAPLParser.EOF = antlr4.Token.EOF;
MAPLParser.T__0 = 1;
MAPLParser.T__1 = 2;
MAPLParser.T__2 = 3;
MAPLParser.T__3 = 4;
MAPLParser.T__4 = 5;
MAPLParser.T__5 = 6;
MAPLParser.T__6 = 7;
MAPLParser.T__7 = 8;
MAPLParser.T__8 = 9;
MAPLParser.T__9 = 10;
MAPLParser.T__10 = 11;
MAPLParser.T__11 = 12;
MAPLParser.T__12 = 13;
MAPLParser.T__13 = 14;
MAPLParser.T__14 = 15;
MAPLParser.T__15 = 16;
MAPLParser.T__16 = 17;
MAPLParser.T__17 = 18;
MAPLParser.T__18 = 19;
MAPLParser.T__19 = 20;
MAPLParser.T__20 = 21;
MAPLParser.T__21 = 22;
MAPLParser.T__22 = 23;
MAPLParser.T__23 = 24;
MAPLParser.T__24 = 25;
MAPLParser.T__25 = 26;
MAPLParser.T__26 = 27;
MAPLParser.T__27 = 28;
MAPLParser.T__28 = 29;
MAPLParser.T__29 = 30;
MAPLParser.T__30 = 31;
MAPLParser.T__31 = 32;
MAPLParser.T__32 = 33;
MAPLParser.T__33 = 34;
MAPLParser.IDENT = 35;
MAPLParser.NUMBER = 36;
MAPLParser.STRING = 37;
MAPLParser.LINE_COMMENT = 38;
MAPLParser.BLOCK_COMMENT = 39;
MAPLParser.WS = 40;

MAPLParser.RULE_mapUnit = 0;
MAPLParser.RULE_mapDecl = 1;
MAPLParser.RULE_mapBody = 2;
MAPLParser.RULE_mapStmt = 3;
MAPLParser.RULE_fieldPath = 4;
MAPLParser.RULE_assignStmt = 5;
MAPLParser.RULE_assignDefaultStmt = 6;
MAPLParser.RULE_functionAssignStmt = 7;
MAPLParser.RULE_functionCall = 8;
MAPLParser.RULE_ifStmt = 9;
MAPLParser.RULE_forStmt = 10;
MAPLParser.RULE_validateStmt = 11;
MAPLParser.RULE_exprList = 12;
MAPLParser.RULE_expr = 13;
MAPLParser.RULE_logicalOrExpr = 14;
MAPLParser.RULE_logicalAndExpr = 15;
MAPLParser.RULE_equalityExpr = 16;
MAPLParser.RULE_relationalExpr = 17;
MAPLParser.RULE_additiveExpr = 18;
MAPLParser.RULE_multiplicativeExpr = 19;
MAPLParser.RULE_unaryExpr = 20;
MAPLParser.RULE_primaryExpr = 21;

class MapUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_mapUnit;
    }

	EOF() {
	    return this.getToken(MAPLParser.EOF, 0);
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
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapUnit(this);
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
        this.ruleIndex = MAPLParser.RULE_mapDecl;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(MAPLParser.IDENT);
	    } else {
	        return this.getToken(MAPLParser.IDENT, i);
	    }
	};


	mapBody() {
	    return this.getTypedRuleContext(MapBodyContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_mapBody;
    }

	mapStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MapStmtContext);
	    } else {
	        return this.getTypedRuleContext(MapStmtContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_mapStmt;
    }

	assignStmt() {
	    return this.getTypedRuleContext(AssignStmtContext,0);
	};

	assignDefaultStmt() {
	    return this.getTypedRuleContext(AssignDefaultStmtContext,0);
	};

	functionAssignStmt() {
	    return this.getTypedRuleContext(FunctionAssignStmtContext,0);
	};

	ifStmt() {
	    return this.getTypedRuleContext(IfStmtContext,0);
	};

	forStmt() {
	    return this.getTypedRuleContext(ForStmtContext,0);
	};

	validateStmt() {
	    return this.getTypedRuleContext(ValidateStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FieldPathContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_fieldPath;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(MAPLParser.IDENT);
	    } else {
	        return this.getToken(MAPLParser.IDENT, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitFieldPath(this);
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
        this.ruleIndex = MAPLParser.RULE_assignStmt;
    }

	fieldPath = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FieldPathContext);
	    } else {
	        return this.getTypedRuleContext(FieldPathContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitAssignStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignDefaultStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_assignDefaultStmt;
    }

	fieldPath = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FieldPathContext);
	    } else {
	        return this.getTypedRuleContext(FieldPathContext,i);
	    }
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitAssignDefaultStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionAssignStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_functionAssignStmt;
    }

	fieldPath() {
	    return this.getTypedRuleContext(FieldPathContext,0);
	};

	functionCall() {
	    return this.getTypedRuleContext(FunctionCallContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitFunctionAssignStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_functionCall;
    }

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	exprList() {
	    return this.getTypedRuleContext(ExprListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitFunctionCall(this);
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
        this.ruleIndex = MAPLParser.RULE_ifStmt;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	mapBody = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MapBodyContext);
	    } else {
	        return this.getTypedRuleContext(MapBodyContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitIfStmt(this);
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
        this.ruleIndex = MAPLParser.RULE_forStmt;
    }

	fieldPath() {
	    return this.getTypedRuleContext(FieldPathContext,0);
	};

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	mapBody() {
	    return this.getTypedRuleContext(MapBodyContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitForStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ValidateStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_validateStmt;
    }

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitValidateStmt(this);
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
        this.ruleIndex = MAPLParser.RULE_exprList;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_expr;
    }

	logicalOrExpr() {
	    return this.getTypedRuleContext(LogicalOrExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_logicalOrExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_logicalAndExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_equalityExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_relationalExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_additiveExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_multiplicativeExpr;
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
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_unaryExpr;
    }

	unaryExpr() {
	    return this.getTypedRuleContext(UnaryExprContext,0);
	};

	primaryExpr() {
	    return this.getTypedRuleContext(PrimaryExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
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
        this.ruleIndex = MAPLParser.RULE_primaryExpr;
    }

	NUMBER() {
	    return this.getToken(MAPLParser.NUMBER, 0);
	};

	STRING() {
	    return this.getToken(MAPLParser.STRING, 0);
	};

	functionCall() {
	    return this.getTypedRuleContext(FunctionCallContext,0);
	};

	fieldPath() {
	    return this.getTypedRuleContext(FieldPathContext,0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitPrimaryExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




MAPLParser.MapUnitContext = MapUnitContext; 
MAPLParser.MapDeclContext = MapDeclContext; 
MAPLParser.MapBodyContext = MapBodyContext; 
MAPLParser.MapStmtContext = MapStmtContext; 
MAPLParser.FieldPathContext = FieldPathContext; 
MAPLParser.AssignStmtContext = AssignStmtContext; 
MAPLParser.AssignDefaultStmtContext = AssignDefaultStmtContext; 
MAPLParser.FunctionAssignStmtContext = FunctionAssignStmtContext; 
MAPLParser.FunctionCallContext = FunctionCallContext; 
MAPLParser.IfStmtContext = IfStmtContext; 
MAPLParser.ForStmtContext = ForStmtContext; 
MAPLParser.ValidateStmtContext = ValidateStmtContext; 
MAPLParser.ExprListContext = ExprListContext; 
MAPLParser.ExprContext = ExprContext; 
MAPLParser.LogicalOrExprContext = LogicalOrExprContext; 
MAPLParser.LogicalAndExprContext = LogicalAndExprContext; 
MAPLParser.EqualityExprContext = EqualityExprContext; 
MAPLParser.RelationalExprContext = RelationalExprContext; 
MAPLParser.AdditiveExprContext = AdditiveExprContext; 
MAPLParser.MultiplicativeExprContext = MultiplicativeExprContext; 
MAPLParser.UnaryExprContext = UnaryExprContext; 
MAPLParser.PrimaryExprContext = PrimaryExprContext; 
