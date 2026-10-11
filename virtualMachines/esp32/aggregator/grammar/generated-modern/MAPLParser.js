// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/MAPL.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import MAPLVisitor from './MAPLVisitor.js';

const serializedATN = [4,1,42,238,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,1,0,5,0,54,8,0,
10,0,12,0,57,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,1,69,8,1,10,1,
12,1,72,9,1,1,1,1,1,1,1,1,1,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,4,1,4,1,5,5,5,
88,8,5,10,5,12,5,91,9,5,1,6,1,6,1,6,1,6,1,6,1,6,3,6,99,8,6,1,7,1,7,1,7,5,
7,104,8,7,10,7,12,7,107,9,7,1,8,1,8,1,9,1,9,1,9,1,9,1,9,3,9,116,8,9,1,9,
1,9,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,11,1,11,1,11,1,11,1,11,1,12,1,12,
1,12,3,12,135,8,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,3,13,145,8,13,
1,13,1,13,1,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,15,1,15,1,
15,1,15,1,16,1,16,1,16,5,16,166,8,16,10,16,12,16,169,9,16,1,17,1,17,1,18,
1,18,1,18,5,18,176,8,18,10,18,12,18,179,9,18,1,19,1,19,1,19,5,19,184,8,19,
10,19,12,19,187,9,19,1,20,1,20,1,20,5,20,192,8,20,10,20,12,20,195,9,20,1,
21,1,21,1,21,5,21,200,8,21,10,21,12,21,203,9,21,1,22,1,22,1,22,5,22,208,
8,22,10,22,12,22,211,9,22,1,23,1,23,1,23,5,23,216,8,23,10,23,12,23,219,9,
23,1,24,1,24,1,24,3,24,224,8,24,1,25,1,25,1,25,1,25,1,25,1,25,1,25,1,25,
1,25,1,25,3,25,236,8,25,1,25,0,0,26,0,2,4,6,8,10,12,14,16,18,20,22,24,26,
28,30,32,34,36,38,40,42,44,46,48,50,0,7,2,0,37,37,39,39,2,0,7,8,38,39,1,
0,25,26,1,0,27,30,1,0,31,32,1,0,33,35,2,0,32,32,36,36,237,0,55,1,0,0,0,2,
60,1,0,0,0,4,77,1,0,0,0,6,79,1,0,0,0,8,84,1,0,0,0,10,89,1,0,0,0,12,98,1,
0,0,0,14,100,1,0,0,0,16,108,1,0,0,0,18,110,1,0,0,0,20,119,1,0,0,0,22,126,
1,0,0,0,24,131,1,0,0,0,26,138,1,0,0,0,28,149,1,0,0,0,30,158,1,0,0,0,32,162,
1,0,0,0,34,170,1,0,0,0,36,172,1,0,0,0,38,180,1,0,0,0,40,188,1,0,0,0,42,196,
1,0,0,0,44,204,1,0,0,0,46,212,1,0,0,0,48,223,1,0,0,0,50,235,1,0,0,0,52,54,
3,2,1,0,53,52,1,0,0,0,54,57,1,0,0,0,55,53,1,0,0,0,55,56,1,0,0,0,56,58,1,
0,0,0,57,55,1,0,0,0,58,59,5,0,0,1,59,1,1,0,0,0,60,61,5,1,0,0,61,62,3,4,2,
0,62,63,5,2,0,0,63,64,3,4,2,0,64,65,5,3,0,0,65,66,3,4,2,0,66,70,5,4,0,0,
67,69,3,6,3,0,68,67,1,0,0,0,69,72,1,0,0,0,70,68,1,0,0,0,70,71,1,0,0,0,71,
73,1,0,0,0,72,70,1,0,0,0,73,74,3,10,5,0,74,75,5,5,0,0,75,76,5,4,0,0,76,3,
1,0,0,0,77,78,7,0,0,0,78,5,1,0,0,0,79,80,5,6,0,0,80,81,5,37,0,0,81,82,3,
8,4,0,82,83,5,4,0,0,83,7,1,0,0,0,84,85,7,1,0,0,85,9,1,0,0,0,86,88,3,12,6,
0,87,86,1,0,0,0,88,91,1,0,0,0,89,87,1,0,0,0,89,90,1,0,0,0,90,11,1,0,0,0,
91,89,1,0,0,0,92,99,3,18,9,0,93,99,3,20,10,0,94,99,3,22,11,0,95,99,3,26,
13,0,96,99,3,28,14,0,97,99,3,30,15,0,98,92,1,0,0,0,98,93,1,0,0,0,98,94,1,
0,0,0,98,95,1,0,0,0,98,96,1,0,0,0,98,97,1,0,0,0,99,13,1,0,0,0,100,105,5,
37,0,0,101,102,5,9,0,0,102,104,3,16,8,0,103,101,1,0,0,0,104,107,1,0,0,0,
105,103,1,0,0,0,105,106,1,0,0,0,106,15,1,0,0,0,107,105,1,0,0,0,108,109,7,
0,0,0,109,17,1,0,0,0,110,111,3,14,7,0,111,112,5,10,0,0,112,115,3,14,7,0,
113,114,5,11,0,0,114,116,5,39,0,0,115,113,1,0,0,0,115,116,1,0,0,0,116,117,
1,0,0,0,117,118,5,4,0,0,118,19,1,0,0,0,119,120,3,14,7,0,120,121,5,10,0,0,
121,122,3,14,7,0,122,123,5,12,0,0,123,124,3,34,17,0,124,125,5,4,0,0,125,
21,1,0,0,0,126,127,3,14,7,0,127,128,5,10,0,0,128,129,3,24,12,0,129,130,5,
4,0,0,130,23,1,0,0,0,131,132,5,37,0,0,132,134,5,13,0,0,133,135,3,32,16,0,
134,133,1,0,0,0,134,135,1,0,0,0,135,136,1,0,0,0,136,137,5,14,0,0,137,25,
1,0,0,0,138,139,5,15,0,0,139,140,3,34,17,0,140,141,5,16,0,0,141,144,3,10,
5,0,142,143,5,17,0,0,143,145,3,10,5,0,144,142,1,0,0,0,144,145,1,0,0,0,145,
146,1,0,0,0,146,147,5,5,0,0,147,148,5,4,0,0,148,27,1,0,0,0,149,150,5,18,
0,0,150,151,5,19,0,0,151,152,3,14,7,0,152,153,5,20,0,0,153,154,5,37,0,0,
154,155,3,10,5,0,155,156,5,5,0,0,156,157,5,4,0,0,157,29,1,0,0,0,158,159,
5,21,0,0,159,160,3,34,17,0,160,161,5,4,0,0,161,31,1,0,0,0,162,167,3,34,17,
0,163,164,5,22,0,0,164,166,3,34,17,0,165,163,1,0,0,0,166,169,1,0,0,0,167,
165,1,0,0,0,167,168,1,0,0,0,168,33,1,0,0,0,169,167,1,0,0,0,170,171,3,36,
18,0,171,35,1,0,0,0,172,177,3,38,19,0,173,174,5,23,0,0,174,176,3,38,19,0,
175,173,1,0,0,0,176,179,1,0,0,0,177,175,1,0,0,0,177,178,1,0,0,0,178,37,1,
0,0,0,179,177,1,0,0,0,180,185,3,40,20,0,181,182,5,24,0,0,182,184,3,40,20,
0,183,181,1,0,0,0,184,187,1,0,0,0,185,183,1,0,0,0,185,186,1,0,0,0,186,39,
1,0,0,0,187,185,1,0,0,0,188,193,3,42,21,0,189,190,7,2,0,0,190,192,3,42,21,
0,191,189,1,0,0,0,192,195,1,0,0,0,193,191,1,0,0,0,193,194,1,0,0,0,194,41,
1,0,0,0,195,193,1,0,0,0,196,201,3,44,22,0,197,198,7,3,0,0,198,200,3,44,22,
0,199,197,1,0,0,0,200,203,1,0,0,0,201,199,1,0,0,0,201,202,1,0,0,0,202,43,
1,0,0,0,203,201,1,0,0,0,204,209,3,46,23,0,205,206,7,4,0,0,206,208,3,46,23,
0,207,205,1,0,0,0,208,211,1,0,0,0,209,207,1,0,0,0,209,210,1,0,0,0,210,45,
1,0,0,0,211,209,1,0,0,0,212,217,3,48,24,0,213,214,7,5,0,0,214,216,3,48,24,
0,215,213,1,0,0,0,216,219,1,0,0,0,217,215,1,0,0,0,217,218,1,0,0,0,218,47,
1,0,0,0,219,217,1,0,0,0,220,221,7,6,0,0,221,224,3,48,24,0,222,224,3,50,25,
0,223,220,1,0,0,0,223,222,1,0,0,0,224,49,1,0,0,0,225,236,5,38,0,0,226,236,
5,39,0,0,227,236,5,7,0,0,228,236,5,8,0,0,229,236,3,24,12,0,230,236,3,14,
7,0,231,232,5,13,0,0,232,233,3,34,17,0,233,234,5,14,0,0,234,236,1,0,0,0,
235,225,1,0,0,0,235,226,1,0,0,0,235,227,1,0,0,0,235,228,1,0,0,0,235,229,
1,0,0,0,235,230,1,0,0,0,235,231,1,0,0,0,236,51,1,0,0,0,17,55,70,89,98,105,
115,134,144,167,177,185,193,201,209,217,223,235];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class MAPLParser extends antlr4.Parser {

    static grammarFileName = "MAPL.g4";
    static literalNames = [ null, "'map'", "'from'", "'to'", "';'", "'end'", 
                            "'@'", "'true'", "'false'", "'.'", "':='", "'using'", 
                            "'default'", "'('", "')'", "'if'", "'then'", 
                            "'else'", "'for'", "'each'", "'as'", "'validate'", 
                            "','", "'or'", "'and'", "'='", "'<>'", "'<'", 
                            "'<='", "'>'", "'>='", "'+'", "'-'", "'*'", 
                            "'/'", "'mod'", "'not'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, "IDENT", "NUMBER", 
                             "STRING", "LINE_COMMENT", "BLOCK_COMMENT", 
                             "WS" ];
    static ruleNames = [ "mapUnit", "mapDecl", "nameRef", "mapDirective", 
                         "directiveValue", "mapBody", "mapStmt", "fieldPath", 
                         "pathSegment", "assignStmt", "assignDefaultStmt", 
                         "functionAssignStmt", "functionCall", "ifStmt", 
                         "forStmt", "validateStmt", "exprList", "expr", 
                         "logicalOrExpr", "logicalAndExpr", "equalityExpr", 
                         "relationalExpr", "additiveExpr", "multiplicativeExpr", 
                         "unaryExpr", "primaryExpr" ];

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
	        this.state = 55;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1) {
	            this.state = 52;
	            this.mapDecl();
	            this.state = 57;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 58;
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
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 60;
	        this.match(MAPLParser.T__0);
	        this.state = 61;
	        this.nameRef();
	        this.state = 62;
	        this.match(MAPLParser.T__1);
	        this.state = 63;
	        this.nameRef();
	        this.state = 64;
	        this.match(MAPLParser.T__2);
	        this.state = 65;
	        this.nameRef();
	        this.state = 66;
	        this.match(MAPLParser.T__3);
	        this.state = 70;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===6) {
	            this.state = 67;
	            this.mapDirective();
	            this.state = 72;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 73;
	        this.mapBody();
	        this.state = 74;
	        this.match(MAPLParser.T__4);
	        this.state = 75;
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



	nameRef() {
	    let localctx = new NameRefContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, MAPLParser.RULE_nameRef);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 77;
	        _la = this._input.LA(1);
	        if(!(_la===37 || _la===39)) {
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



	mapDirective() {
	    let localctx = new MapDirectiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, MAPLParser.RULE_mapDirective);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 79;
	        this.match(MAPLParser.T__5);
	        this.state = 80;
	        this.match(MAPLParser.IDENT);
	        this.state = 81;
	        this.directiveValue();
	        this.state = 82;
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



	directiveValue() {
	    let localctx = new DirectiveValueContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, MAPLParser.RULE_directiveValue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 84;
	        _la = this._input.LA(1);
	        if(!(_la===7 || _la===8 || _la===38 || _la===39)) {
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



	mapBody() {
	    let localctx = new MapBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, MAPLParser.RULE_mapBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 89;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 15)) & ~0x1f) === 0 && ((1 << (_la - 15)) & 4194377) !== 0)) {
	            this.state = 86;
	            this.mapStmt();
	            this.state = 91;
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
	    this.enterRule(localctx, 12, MAPLParser.RULE_mapStmt);
	    try {
	        this.state = 98;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,3,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 92;
	            this.assignStmt();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 93;
	            this.assignDefaultStmt();
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 94;
	            this.functionAssignStmt();
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 95;
	            this.ifStmt();
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 96;
	            this.forStmt();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 97;
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
	    this.enterRule(localctx, 14, MAPLParser.RULE_fieldPath);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 100;
	        this.match(MAPLParser.IDENT);
	        this.state = 105;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===9) {
	            this.state = 101;
	            this.match(MAPLParser.T__8);
	            this.state = 102;
	            this.pathSegment();
	            this.state = 107;
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



	pathSegment() {
	    let localctx = new PathSegmentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, MAPLParser.RULE_pathSegment);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 108;
	        _la = this._input.LA(1);
	        if(!(_la===37 || _la===39)) {
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



	assignStmt() {
	    let localctx = new AssignStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, MAPLParser.RULE_assignStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 110;
	        this.fieldPath();
	        this.state = 111;
	        this.match(MAPLParser.T__9);
	        this.state = 112;
	        this.fieldPath();
	        this.state = 115;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===11) {
	            this.state = 113;
	            this.match(MAPLParser.T__10);
	            this.state = 114;
	            this.match(MAPLParser.STRING);
	        }

	        this.state = 117;
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
	    this.enterRule(localctx, 20, MAPLParser.RULE_assignDefaultStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 119;
	        this.fieldPath();
	        this.state = 120;
	        this.match(MAPLParser.T__9);
	        this.state = 121;
	        this.fieldPath();
	        this.state = 122;
	        this.match(MAPLParser.T__11);
	        this.state = 123;
	        this.expr();
	        this.state = 124;
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
	    this.enterRule(localctx, 22, MAPLParser.RULE_functionAssignStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 126;
	        this.fieldPath();
	        this.state = 127;
	        this.match(MAPLParser.T__9);
	        this.state = 128;
	        this.functionCall();
	        this.state = 129;
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
	    this.enterRule(localctx, 24, MAPLParser.RULE_functionCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 131;
	        this.match(MAPLParser.IDENT);
	        this.state = 132;
	        this.match(MAPLParser.T__12);
	        this.state = 134;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 8576) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 241) !== 0)) {
	            this.state = 133;
	            this.exprList();
	        }

	        this.state = 136;
	        this.match(MAPLParser.T__13);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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
	    this.enterRule(localctx, 26, MAPLParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 138;
	        this.match(MAPLParser.T__14);
	        this.state = 139;
	        this.expr();
	        this.state = 140;
	        this.match(MAPLParser.T__15);
	        this.state = 141;
	        this.mapBody();
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===17) {
	            this.state = 142;
	            this.match(MAPLParser.T__16);
	            this.state = 143;
	            this.mapBody();
	        }

	        this.state = 146;
	        this.match(MAPLParser.T__4);
	        this.state = 147;
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
	    this.enterRule(localctx, 28, MAPLParser.RULE_forStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 149;
	        this.match(MAPLParser.T__17);
	        this.state = 150;
	        this.match(MAPLParser.T__18);
	        this.state = 151;
	        this.fieldPath();
	        this.state = 152;
	        this.match(MAPLParser.T__19);
	        this.state = 153;
	        this.match(MAPLParser.IDENT);
	        this.state = 154;
	        this.mapBody();
	        this.state = 155;
	        this.match(MAPLParser.T__4);
	        this.state = 156;
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
	    this.enterRule(localctx, 30, MAPLParser.RULE_validateStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 158;
	        this.match(MAPLParser.T__20);
	        this.state = 159;
	        this.expr();
	        this.state = 160;
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
	    this.enterRule(localctx, 32, MAPLParser.RULE_exprList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 162;
	        this.expr();
	        this.state = 167;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===22) {
	            this.state = 163;
	            this.match(MAPLParser.T__21);
	            this.state = 164;
	            this.expr();
	            this.state = 169;
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
	    this.enterRule(localctx, 34, MAPLParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 170;
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
	    this.enterRule(localctx, 36, MAPLParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 172;
	        this.logicalAndExpr();
	        this.state = 177;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===23) {
	            this.state = 173;
	            this.match(MAPLParser.T__22);
	            this.state = 174;
	            this.logicalAndExpr();
	            this.state = 179;
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
	    this.enterRule(localctx, 38, MAPLParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 180;
	        this.equalityExpr();
	        this.state = 185;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===24) {
	            this.state = 181;
	            this.match(MAPLParser.T__23);
	            this.state = 182;
	            this.equalityExpr();
	            this.state = 187;
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
	    this.enterRule(localctx, 40, MAPLParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 188;
	        this.relationalExpr();
	        this.state = 193;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===25 || _la===26) {
	            this.state = 189;
	            _la = this._input.LA(1);
	            if(!(_la===25 || _la===26)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 190;
	            this.relationalExpr();
	            this.state = 195;
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
	    this.enterRule(localctx, 42, MAPLParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 196;
	        this.additiveExpr();
	        this.state = 201;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 2013265920) !== 0)) {
	            this.state = 197;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 2013265920) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 198;
	            this.additiveExpr();
	            this.state = 203;
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
	    this.enterRule(localctx, 44, MAPLParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 204;
	        this.multiplicativeExpr();
	        this.state = 209;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===31 || _la===32) {
	            this.state = 205;
	            _la = this._input.LA(1);
	            if(!(_la===31 || _la===32)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 206;
	            this.multiplicativeExpr();
	            this.state = 211;
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
	    this.enterRule(localctx, 46, MAPLParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 212;
	        this.unaryExpr();
	        this.state = 217;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 33)) & ~0x1f) === 0 && ((1 << (_la - 33)) & 7) !== 0)) {
	            this.state = 213;
	            _la = this._input.LA(1);
	            if(!(((((_la - 33)) & ~0x1f) === 0 && ((1 << (_la - 33)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 214;
	            this.unaryExpr();
	            this.state = 219;
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
	    this.enterRule(localctx, 48, MAPLParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 223;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 32:
	        case 36:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 220;
	            _la = this._input.LA(1);
	            if(!(_la===32 || _la===36)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 221;
	            this.unaryExpr();
	            break;
	        case 7:
	        case 8:
	        case 13:
	        case 37:
	        case 38:
	        case 39:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 222;
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
	    this.enterRule(localctx, 50, MAPLParser.RULE_primaryExpr);
	    try {
	        this.state = 235;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,16,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 225;
	            this.match(MAPLParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 226;
	            this.match(MAPLParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 227;
	            this.match(MAPLParser.T__6);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 228;
	            this.match(MAPLParser.T__7);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 229;
	            this.functionCall();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 230;
	            this.fieldPath();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 231;
	            this.match(MAPLParser.T__12);
	            this.state = 232;
	            this.expr();
	            this.state = 233;
	            this.match(MAPLParser.T__13);
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
MAPLParser.T__34 = 35;
MAPLParser.T__35 = 36;
MAPLParser.IDENT = 37;
MAPLParser.NUMBER = 38;
MAPLParser.STRING = 39;
MAPLParser.LINE_COMMENT = 40;
MAPLParser.BLOCK_COMMENT = 41;
MAPLParser.WS = 42;

MAPLParser.RULE_mapUnit = 0;
MAPLParser.RULE_mapDecl = 1;
MAPLParser.RULE_nameRef = 2;
MAPLParser.RULE_mapDirective = 3;
MAPLParser.RULE_directiveValue = 4;
MAPLParser.RULE_mapBody = 5;
MAPLParser.RULE_mapStmt = 6;
MAPLParser.RULE_fieldPath = 7;
MAPLParser.RULE_pathSegment = 8;
MAPLParser.RULE_assignStmt = 9;
MAPLParser.RULE_assignDefaultStmt = 10;
MAPLParser.RULE_functionAssignStmt = 11;
MAPLParser.RULE_functionCall = 12;
MAPLParser.RULE_ifStmt = 13;
MAPLParser.RULE_forStmt = 14;
MAPLParser.RULE_validateStmt = 15;
MAPLParser.RULE_exprList = 16;
MAPLParser.RULE_expr = 17;
MAPLParser.RULE_logicalOrExpr = 18;
MAPLParser.RULE_logicalAndExpr = 19;
MAPLParser.RULE_equalityExpr = 20;
MAPLParser.RULE_relationalExpr = 21;
MAPLParser.RULE_additiveExpr = 22;
MAPLParser.RULE_multiplicativeExpr = 23;
MAPLParser.RULE_unaryExpr = 24;
MAPLParser.RULE_primaryExpr = 25;

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

	nameRef = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(NameRefContext);
	    } else {
	        return this.getTypedRuleContext(NameRefContext,i);
	    }
	};

	mapBody() {
	    return this.getTypedRuleContext(MapBodyContext,0);
	};

	mapDirective = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MapDirectiveContext);
	    } else {
	        return this.getTypedRuleContext(MapDirectiveContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class NameRefContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_nameRef;
    }

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	STRING() {
	    return this.getToken(MAPLParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitNameRef(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MapDirectiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_mapDirective;
    }

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	directiveValue() {
	    return this.getTypedRuleContext(DirectiveValueContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitMapDirective(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DirectiveValueContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_directiveValue;
    }

	STRING() {
	    return this.getToken(MAPLParser.STRING, 0);
	};

	NUMBER() {
	    return this.getToken(MAPLParser.NUMBER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitDirectiveValue(this);
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

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	pathSegment = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(PathSegmentContext);
	    } else {
	        return this.getTypedRuleContext(PathSegmentContext,i);
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



class PathSegmentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = MAPLParser.RULE_pathSegment;
    }

	IDENT() {
	    return this.getToken(MAPLParser.IDENT, 0);
	};

	STRING() {
	    return this.getToken(MAPLParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof MAPLVisitor ) {
	        return visitor.visitPathSegment(this);
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

	STRING() {
	    return this.getToken(MAPLParser.STRING, 0);
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
MAPLParser.NameRefContext = NameRefContext; 
MAPLParser.MapDirectiveContext = MapDirectiveContext; 
MAPLParser.DirectiveValueContext = DirectiveValueContext; 
MAPLParser.MapBodyContext = MapBodyContext; 
MAPLParser.MapStmtContext = MapStmtContext; 
MAPLParser.FieldPathContext = FieldPathContext; 
MAPLParser.PathSegmentContext = PathSegmentContext; 
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
