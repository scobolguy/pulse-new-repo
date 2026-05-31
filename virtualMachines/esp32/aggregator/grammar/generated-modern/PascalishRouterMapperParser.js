// Generated from grammar/PascalishRouterMapper.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import PascalishRouterMapperVisitor from './PascalishRouterMapperVisitor.js';

const serializedATN = [4,1,54,222,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,1,0,5,0,40,8,
0,10,0,12,0,43,9,0,1,0,1,0,1,1,1,1,1,1,1,1,3,1,51,8,1,1,2,1,2,1,2,1,2,1,
2,3,2,58,8,2,1,2,1,2,1,3,1,3,1,3,1,3,3,3,66,8,3,1,4,1,4,1,4,1,4,1,5,1,5,
1,5,1,5,1,5,5,5,77,8,5,10,5,12,5,80,9,5,1,5,1,5,5,5,84,8,5,10,5,12,5,87,
9,5,1,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,3,6,98,8,6,1,7,1,7,1,7,3,7,103,8,
7,1,7,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,3,8,115,8,8,1,9,1,9,1,9,1,9,1,
9,1,9,1,9,5,9,124,8,9,10,9,12,9,127,9,9,1,9,1,9,5,9,131,8,9,10,9,12,9,134,
9,9,1,9,1,9,1,9,1,10,1,10,1,10,1,10,3,10,143,8,10,1,11,1,11,1,11,1,11,1,
11,1,11,3,11,151,8,11,1,11,1,11,1,12,1,12,1,12,1,12,1,12,5,12,160,8,12,10,
12,12,12,163,9,12,1,12,1,12,3,12,167,8,12,1,13,1,13,3,13,171,8,13,1,14,1,
14,1,15,1,15,1,16,1,16,3,16,179,8,16,1,17,1,17,5,17,183,8,17,10,17,12,17,
186,9,17,1,17,1,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,
1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,
18,1,18,1,18,1,18,1,18,3,18,220,8,18,1,18,0,0,19,0,2,4,6,8,10,12,14,16,18,
20,22,24,26,28,30,32,34,36,0,1,1,0,19,20,252,0,41,1,0,0,0,2,50,1,0,0,0,4,
52,1,0,0,0,6,65,1,0,0,0,8,67,1,0,0,0,10,71,1,0,0,0,12,97,1,0,0,0,14,99,1,
0,0,0,16,114,1,0,0,0,18,116,1,0,0,0,20,142,1,0,0,0,22,144,1,0,0,0,24,166,
1,0,0,0,26,170,1,0,0,0,28,172,1,0,0,0,30,174,1,0,0,0,32,178,1,0,0,0,34,180,
1,0,0,0,36,219,1,0,0,0,38,40,3,2,1,0,39,38,1,0,0,0,40,43,1,0,0,0,41,39,1,
0,0,0,41,42,1,0,0,0,42,44,1,0,0,0,43,41,1,0,0,0,44,45,5,0,0,1,45,1,1,0,0,
0,46,51,3,8,4,0,47,51,3,4,2,0,48,51,3,10,5,0,49,51,3,18,9,0,50,46,1,0,0,
0,50,47,1,0,0,0,50,48,1,0,0,0,50,49,1,0,0,0,51,3,1,0,0,0,52,53,5,29,0,0,
53,54,5,49,0,0,54,55,5,44,0,0,55,57,3,26,13,0,56,58,3,6,3,0,57,56,1,0,0,
0,57,58,1,0,0,0,58,59,1,0,0,0,59,60,5,42,0,0,60,5,1,0,0,0,61,62,5,30,0,0,
62,66,5,31,0,0,63,64,5,30,0,0,64,66,3,26,13,0,65,61,1,0,0,0,65,63,1,0,0,
0,66,7,1,0,0,0,67,68,5,1,0,0,68,69,3,28,14,0,69,70,5,42,0,0,70,9,1,0,0,0,
71,72,5,2,0,0,72,73,3,26,13,0,73,74,5,4,0,0,74,78,3,28,14,0,75,77,3,12,6,
0,76,75,1,0,0,0,77,80,1,0,0,0,78,76,1,0,0,0,78,79,1,0,0,0,79,81,1,0,0,0,
80,78,1,0,0,0,81,85,5,9,0,0,82,84,3,14,7,0,83,82,1,0,0,0,84,87,1,0,0,0,85,
83,1,0,0,0,85,86,1,0,0,0,86,88,1,0,0,0,87,85,1,0,0,0,88,89,5,10,0,0,89,90,
5,42,0,0,90,11,1,0,0,0,91,92,5,7,0,0,92,98,3,28,14,0,93,94,5,8,0,0,94,98,
3,30,15,0,95,96,5,1,0,0,96,98,3,28,14,0,97,91,1,0,0,0,97,93,1,0,0,0,97,95,
1,0,0,0,98,13,1,0,0,0,99,100,5,11,0,0,100,102,3,28,14,0,101,103,3,16,8,0,
102,101,1,0,0,0,102,103,1,0,0,0,103,104,1,0,0,0,104,105,5,14,0,0,105,106,
3,32,16,0,106,107,5,15,0,0,107,108,3,32,16,0,108,109,5,42,0,0,109,15,1,0,
0,0,110,111,5,12,0,0,111,115,3,28,14,0,112,113,5,13,0,0,113,115,3,24,12,
0,114,110,1,0,0,0,114,112,1,0,0,0,115,17,1,0,0,0,116,117,5,3,0,0,117,118,
3,26,13,0,118,119,5,5,0,0,119,120,3,28,14,0,120,121,5,6,0,0,121,125,3,28,
14,0,122,124,3,20,10,0,123,122,1,0,0,0,124,127,1,0,0,0,125,123,1,0,0,0,125,
126,1,0,0,0,126,128,1,0,0,0,127,125,1,0,0,0,128,132,5,9,0,0,129,131,3,22,
11,0,130,129,1,0,0,0,131,134,1,0,0,0,132,130,1,0,0,0,132,133,1,0,0,0,133,
135,1,0,0,0,134,132,1,0,0,0,135,136,5,10,0,0,136,137,5,42,0,0,137,19,1,0,
0,0,138,139,5,7,0,0,139,143,3,28,14,0,140,141,5,8,0,0,141,143,3,30,15,0,
142,138,1,0,0,0,142,140,1,0,0,0,143,21,1,0,0,0,144,145,5,16,0,0,145,146,
3,28,14,0,146,147,5,17,0,0,147,150,3,28,14,0,148,149,5,18,0,0,149,151,3,
32,16,0,150,148,1,0,0,0,150,151,1,0,0,0,151,152,1,0,0,0,152,153,5,42,0,0,
153,23,1,0,0,0,154,167,3,28,14,0,155,156,5,32,0,0,156,161,3,28,14,0,157,
158,5,41,0,0,158,160,3,28,14,0,159,157,1,0,0,0,160,163,1,0,0,0,161,159,1,
0,0,0,161,162,1,0,0,0,162,164,1,0,0,0,163,161,1,0,0,0,164,165,5,33,0,0,165,
167,1,0,0,0,166,154,1,0,0,0,166,155,1,0,0,0,167,25,1,0,0,0,168,171,3,28,
14,0,169,171,5,49,0,0,170,168,1,0,0,0,170,169,1,0,0,0,171,27,1,0,0,0,172,
173,5,51,0,0,173,29,1,0,0,0,174,175,7,0,0,0,175,31,1,0,0,0,176,179,5,51,
0,0,177,179,3,34,17,0,178,176,1,0,0,0,178,177,1,0,0,0,179,33,1,0,0,0,180,
184,5,9,0,0,181,183,3,36,18,0,182,181,1,0,0,0,183,186,1,0,0,0,184,182,1,
0,0,0,184,185,1,0,0,0,185,187,1,0,0,0,186,184,1,0,0,0,187,188,5,10,0,0,188,
35,1,0,0,0,189,220,3,34,17,0,190,220,5,32,0,0,191,220,5,33,0,0,192,220,5,
34,0,0,193,220,5,35,0,0,194,220,5,36,0,0,195,220,5,37,0,0,196,220,5,38,0,
0,197,220,5,39,0,0,198,220,5,40,0,0,199,220,5,46,0,0,200,220,5,47,0,0,201,
220,5,48,0,0,202,220,5,41,0,0,203,220,5,42,0,0,204,220,5,43,0,0,205,220,
5,45,0,0,206,220,5,21,0,0,207,220,5,22,0,0,208,220,5,23,0,0,209,220,5,24,
0,0,210,220,5,25,0,0,211,220,5,26,0,0,212,220,5,27,0,0,213,220,5,28,0,0,
214,220,5,19,0,0,215,220,5,20,0,0,216,220,5,50,0,0,217,220,5,51,0,0,218,
220,5,49,0,0,219,189,1,0,0,0,219,190,1,0,0,0,219,191,1,0,0,0,219,192,1,0,
0,0,219,193,1,0,0,0,219,194,1,0,0,0,219,195,1,0,0,0,219,196,1,0,0,0,219,
197,1,0,0,0,219,198,1,0,0,0,219,199,1,0,0,0,219,200,1,0,0,0,219,201,1,0,
0,0,219,202,1,0,0,0,219,203,1,0,0,0,219,204,1,0,0,0,219,205,1,0,0,0,219,
206,1,0,0,0,219,207,1,0,0,0,219,208,1,0,0,0,219,209,1,0,0,0,219,210,1,0,
0,0,219,211,1,0,0,0,219,212,1,0,0,0,219,213,1,0,0,0,219,214,1,0,0,0,219,
215,1,0,0,0,219,216,1,0,0,0,219,217,1,0,0,0,219,218,1,0,0,0,220,37,1,0,0,
0,19,41,50,57,65,78,85,97,102,114,125,132,142,150,161,166,170,178,184,219];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class PascalishRouterMapperParser extends antlr4.Parser {

    static grammarFileName = "PascalishRouterMapper.g4";
    static literalNames = [ null, "'SERVICE'", "'ROUTER'", "'MAPPER'", "'INPUT'", 
                            "'SOURCE'", "'TARGET'", "'DESCRIPTION'", "'ENABLED'", 
                            "'BEGIN'", "'END'", "'OUTPUT'", "'TYPE'", "'TYPES'", 
                            "'WHEN'", "'TRANSFORM'", "'MAP'", "'TO'", "'USING'", 
                            "'TRUE'", "'FALSE'", "'IF'", "'THEN'", "'ELSE'", 
                            "'WHILE'", "'DO'", "'FOR'", "'CALL'", "'NOT'", 
                            "'VAR'", "'FROM'", "'LIBRARIAN'", "'('", "')'", 
                            "'+'", "'-'", "'*'", "'/'", "'='", "'<'", "'>'", 
                            "','", "';'", "':='", "':'", "'||'", "'<='", 
                            "'>='", "'<>'" ];
    static symbolicNames = [ null, "SERVICE", "ROUTER", "MAPPER", "INPUT", 
                             "SOURCE", "TARGET", "DESCRIPTION", "ENABLED", 
                             "BEGIN", "END", "OUTPUT", "TYPE", "TYPES", 
                             "WHEN", "TRANSFORM", "MAP", "TO", "USING", 
                             "TRUE", "FALSE", "IF", "THEN", "ELSE", "WHILE", 
                             "DO", "FOR", "CALL", "NOT", "VAR", "FROM", 
                             "LIBRARIAN", "LPAREN", "RPAREN", "PLUS", "MINUS", 
                             "MUL", "DIV", "EQ", "LT", "GT", "COMMA", "SEMICOLON", 
                             "ASSIGN", "COLON", "CONCAT", "LE", "GE", "NEQ", 
                             "IDENT", "NUMBER", "STRING", "BRACE_COMMENT", 
                             "PAREN_COMMENT", "WS" ];
    static ruleNames = [ "program", "statement", "varDecl", "varSource", 
                         "serviceDecl", "routerDecl", "routerHeaderProp", 
                         "outputDecl", "outputTypeMeta", "mapperDecl", "mapperHeaderProp", 
                         "mapDecl", "stringList", "stringOrIdent", "stringValue", 
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
	        this.state = 41;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536870926) !== 0)) {
	            this.state = 38;
	            this.statement();
	            this.state = 43;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 44;
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
	        this.state = 50;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 46;
	            this.serviceDecl();
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 47;
	            this.varDecl();
	            break;
	        case 2:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 48;
	            this.routerDecl();
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 49;
	            this.mapperDecl();
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



	varDecl() {
	    let localctx = new VarDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, PascalishRouterMapperParser.RULE_varDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 52;
	        this.match(PascalishRouterMapperParser.VAR);
	        this.state = 53;
	        this.match(PascalishRouterMapperParser.IDENT);
	        this.state = 54;
	        this.match(PascalishRouterMapperParser.COLON);
	        this.state = 55;
	        this.stringOrIdent();
	        this.state = 57;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===30) {
	            this.state = 56;
	            this.varSource();
	        }

	        this.state = 59;
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
	    this.enterRule(localctx, 6, PascalishRouterMapperParser.RULE_varSource);
	    try {
	        this.state = 65;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,3,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 61;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 62;
	            this.match(PascalishRouterMapperParser.LIBRARIAN);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 63;
	            this.match(PascalishRouterMapperParser.FROM);
	            this.state = 64;
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
	    this.enterRule(localctx, 8, PascalishRouterMapperParser.RULE_serviceDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 67;
	        this.match(PascalishRouterMapperParser.SERVICE);
	        this.state = 68;
	        this.stringValue();
	        this.state = 69;
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



	routerDecl() {
	    let localctx = new RouterDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, PascalishRouterMapperParser.RULE_routerDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 71;
	        this.match(PascalishRouterMapperParser.ROUTER);
	        this.state = 72;
	        this.stringOrIdent();
	        this.state = 73;
	        this.match(PascalishRouterMapperParser.INPUT);
	        this.state = 74;
	        this.stringValue();
	        this.state = 78;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 386) !== 0)) {
	            this.state = 75;
	            this.routerHeaderProp();
	            this.state = 80;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 81;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 85;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===11) {
	            this.state = 82;
	            this.outputDecl();
	            this.state = 87;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 88;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 89;
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
	    this.enterRule(localctx, 12, PascalishRouterMapperParser.RULE_routerHeaderProp);
	    try {
	        this.state = 97;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 91;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 92;
	            this.stringValue();
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 93;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 94;
	            this.booleanValue();
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 95;
	            this.match(PascalishRouterMapperParser.SERVICE);
	            this.state = 96;
	            this.stringValue();
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
	    this.enterRule(localctx, 14, PascalishRouterMapperParser.RULE_outputDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 99;
	        this.match(PascalishRouterMapperParser.OUTPUT);
	        this.state = 100;
	        this.stringValue();
	        this.state = 102;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===12 || _la===13) {
	            this.state = 101;
	            this.outputTypeMeta();
	        }

	        this.state = 104;
	        this.match(PascalishRouterMapperParser.WHEN);
	        this.state = 105;
	        this.pl0Snippet();
	        this.state = 106;
	        this.match(PascalishRouterMapperParser.TRANSFORM);
	        this.state = 107;
	        this.pl0Snippet();
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



	outputTypeMeta() {
	    let localctx = new OutputTypeMetaContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, PascalishRouterMapperParser.RULE_outputTypeMeta);
	    try {
	        this.state = 114;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 12:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 110;
	            this.match(PascalishRouterMapperParser.TYPE);
	            this.state = 111;
	            this.stringValue();
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 112;
	            this.match(PascalishRouterMapperParser.TYPES);
	            this.state = 113;
	            this.stringList();
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
	    this.enterRule(localctx, 18, PascalishRouterMapperParser.RULE_mapperDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 116;
	        this.match(PascalishRouterMapperParser.MAPPER);
	        this.state = 117;
	        this.stringOrIdent();
	        this.state = 118;
	        this.match(PascalishRouterMapperParser.SOURCE);
	        this.state = 119;
	        this.stringValue();
	        this.state = 120;
	        this.match(PascalishRouterMapperParser.TARGET);
	        this.state = 121;
	        this.stringValue();
	        this.state = 125;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===7 || _la===8) {
	            this.state = 122;
	            this.mapperHeaderProp();
	            this.state = 127;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 128;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 132;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===16) {
	            this.state = 129;
	            this.mapDecl();
	            this.state = 134;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 135;
	        this.match(PascalishRouterMapperParser.END);
	        this.state = 136;
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
	    this.enterRule(localctx, 20, PascalishRouterMapperParser.RULE_mapperHeaderProp);
	    try {
	        this.state = 142;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 138;
	            this.match(PascalishRouterMapperParser.DESCRIPTION);
	            this.state = 139;
	            this.stringValue();
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 140;
	            this.match(PascalishRouterMapperParser.ENABLED);
	            this.state = 141;
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
	    this.enterRule(localctx, 22, PascalishRouterMapperParser.RULE_mapDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 144;
	        this.match(PascalishRouterMapperParser.MAP);
	        this.state = 145;
	        this.stringValue();
	        this.state = 146;
	        this.match(PascalishRouterMapperParser.TO);
	        this.state = 147;
	        this.stringValue();
	        this.state = 150;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===18) {
	            this.state = 148;
	            this.match(PascalishRouterMapperParser.USING);
	            this.state = 149;
	            this.pl0Snippet();
	        }

	        this.state = 152;
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
	    this.enterRule(localctx, 24, PascalishRouterMapperParser.RULE_stringList);
	    var _la = 0;
	    try {
	        this.state = 166;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 51:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 154;
	            this.stringValue();
	            break;
	        case 32:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 155;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            this.state = 156;
	            this.stringValue();
	            this.state = 161;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===41) {
	                this.state = 157;
	                this.match(PascalishRouterMapperParser.COMMA);
	                this.state = 158;
	                this.stringValue();
	                this.state = 163;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 164;
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



	stringOrIdent() {
	    let localctx = new StringOrIdentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, PascalishRouterMapperParser.RULE_stringOrIdent);
	    try {
	        this.state = 170;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 51:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 168;
	            this.stringValue();
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 169;
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
	    this.enterRule(localctx, 28, PascalishRouterMapperParser.RULE_stringValue);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 172;
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
	    this.enterRule(localctx, 30, PascalishRouterMapperParser.RULE_booleanValue);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 174;
	        _la = this._input.LA(1);
	        if(!(_la===19 || _la===20)) {
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
	    this.enterRule(localctx, 32, PascalishRouterMapperParser.RULE_pl0Snippet);
	    try {
	        this.state = 178;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 51:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 176;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 177;
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
	    this.enterRule(localctx, 34, PascalishRouterMapperParser.RULE_pl0Block);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 180;
	        this.match(PascalishRouterMapperParser.BEGIN);
	        this.state = 184;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 536347136) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 1044479) !== 0)) {
	            this.state = 181;
	            this.pl0Element();
	            this.state = 186;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 187;
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
	    this.enterRule(localctx, 36, PascalishRouterMapperParser.RULE_pl0Element);
	    try {
	        this.state = 219;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 9:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 189;
	            this.pl0Block();
	            break;
	        case 32:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 190;
	            this.match(PascalishRouterMapperParser.LPAREN);
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 191;
	            this.match(PascalishRouterMapperParser.RPAREN);
	            break;
	        case 34:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 192;
	            this.match(PascalishRouterMapperParser.PLUS);
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 193;
	            this.match(PascalishRouterMapperParser.MINUS);
	            break;
	        case 36:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 194;
	            this.match(PascalishRouterMapperParser.MUL);
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 195;
	            this.match(PascalishRouterMapperParser.DIV);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 196;
	            this.match(PascalishRouterMapperParser.EQ);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 197;
	            this.match(PascalishRouterMapperParser.LT);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 198;
	            this.match(PascalishRouterMapperParser.GT);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 199;
	            this.match(PascalishRouterMapperParser.LE);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 200;
	            this.match(PascalishRouterMapperParser.GE);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 201;
	            this.match(PascalishRouterMapperParser.NEQ);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 202;
	            this.match(PascalishRouterMapperParser.COMMA);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 203;
	            this.match(PascalishRouterMapperParser.SEMICOLON);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 204;
	            this.match(PascalishRouterMapperParser.ASSIGN);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 205;
	            this.match(PascalishRouterMapperParser.CONCAT);
	            break;
	        case 21:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 206;
	            this.match(PascalishRouterMapperParser.IF);
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 207;
	            this.match(PascalishRouterMapperParser.THEN);
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 208;
	            this.match(PascalishRouterMapperParser.ELSE);
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 209;
	            this.match(PascalishRouterMapperParser.WHILE);
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 210;
	            this.match(PascalishRouterMapperParser.DO);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 211;
	            this.match(PascalishRouterMapperParser.FOR);
	            break;
	        case 27:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 212;
	            this.match(PascalishRouterMapperParser.CALL);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 213;
	            this.match(PascalishRouterMapperParser.NOT);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 214;
	            this.match(PascalishRouterMapperParser.TRUE);
	            break;
	        case 20:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 215;
	            this.match(PascalishRouterMapperParser.FALSE);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 216;
	            this.match(PascalishRouterMapperParser.NUMBER);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 217;
	            this.match(PascalishRouterMapperParser.STRING);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 218;
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
PascalishRouterMapperParser.ROUTER = 2;
PascalishRouterMapperParser.MAPPER = 3;
PascalishRouterMapperParser.INPUT = 4;
PascalishRouterMapperParser.SOURCE = 5;
PascalishRouterMapperParser.TARGET = 6;
PascalishRouterMapperParser.DESCRIPTION = 7;
PascalishRouterMapperParser.ENABLED = 8;
PascalishRouterMapperParser.BEGIN = 9;
PascalishRouterMapperParser.END = 10;
PascalishRouterMapperParser.OUTPUT = 11;
PascalishRouterMapperParser.TYPE = 12;
PascalishRouterMapperParser.TYPES = 13;
PascalishRouterMapperParser.WHEN = 14;
PascalishRouterMapperParser.TRANSFORM = 15;
PascalishRouterMapperParser.MAP = 16;
PascalishRouterMapperParser.TO = 17;
PascalishRouterMapperParser.USING = 18;
PascalishRouterMapperParser.TRUE = 19;
PascalishRouterMapperParser.FALSE = 20;
PascalishRouterMapperParser.IF = 21;
PascalishRouterMapperParser.THEN = 22;
PascalishRouterMapperParser.ELSE = 23;
PascalishRouterMapperParser.WHILE = 24;
PascalishRouterMapperParser.DO = 25;
PascalishRouterMapperParser.FOR = 26;
PascalishRouterMapperParser.CALL = 27;
PascalishRouterMapperParser.NOT = 28;
PascalishRouterMapperParser.VAR = 29;
PascalishRouterMapperParser.FROM = 30;
PascalishRouterMapperParser.LIBRARIAN = 31;
PascalishRouterMapperParser.LPAREN = 32;
PascalishRouterMapperParser.RPAREN = 33;
PascalishRouterMapperParser.PLUS = 34;
PascalishRouterMapperParser.MINUS = 35;
PascalishRouterMapperParser.MUL = 36;
PascalishRouterMapperParser.DIV = 37;
PascalishRouterMapperParser.EQ = 38;
PascalishRouterMapperParser.LT = 39;
PascalishRouterMapperParser.GT = 40;
PascalishRouterMapperParser.COMMA = 41;
PascalishRouterMapperParser.SEMICOLON = 42;
PascalishRouterMapperParser.ASSIGN = 43;
PascalishRouterMapperParser.COLON = 44;
PascalishRouterMapperParser.CONCAT = 45;
PascalishRouterMapperParser.LE = 46;
PascalishRouterMapperParser.GE = 47;
PascalishRouterMapperParser.NEQ = 48;
PascalishRouterMapperParser.IDENT = 49;
PascalishRouterMapperParser.NUMBER = 50;
PascalishRouterMapperParser.STRING = 51;
PascalishRouterMapperParser.BRACE_COMMENT = 52;
PascalishRouterMapperParser.PAREN_COMMENT = 53;
PascalishRouterMapperParser.WS = 54;

PascalishRouterMapperParser.RULE_program = 0;
PascalishRouterMapperParser.RULE_statement = 1;
PascalishRouterMapperParser.RULE_varDecl = 2;
PascalishRouterMapperParser.RULE_varSource = 3;
PascalishRouterMapperParser.RULE_serviceDecl = 4;
PascalishRouterMapperParser.RULE_routerDecl = 5;
PascalishRouterMapperParser.RULE_routerHeaderProp = 6;
PascalishRouterMapperParser.RULE_outputDecl = 7;
PascalishRouterMapperParser.RULE_outputTypeMeta = 8;
PascalishRouterMapperParser.RULE_mapperDecl = 9;
PascalishRouterMapperParser.RULE_mapperHeaderProp = 10;
PascalishRouterMapperParser.RULE_mapDecl = 11;
PascalishRouterMapperParser.RULE_stringList = 12;
PascalishRouterMapperParser.RULE_stringOrIdent = 13;
PascalishRouterMapperParser.RULE_stringValue = 14;
PascalishRouterMapperParser.RULE_booleanValue = 15;
PascalishRouterMapperParser.RULE_pl0Snippet = 16;
PascalishRouterMapperParser.RULE_pl0Block = 17;
PascalishRouterMapperParser.RULE_pl0Element = 18;

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

	varDecl() {
	    return this.getTypedRuleContext(VarDeclContext,0);
	};

	routerDecl() {
	    return this.getTypedRuleContext(RouterDeclContext,0);
	};

	mapperDecl() {
	    return this.getTypedRuleContext(MapperDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitStatement(this);
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

	stringOrIdent() {
	    return this.getTypedRuleContext(StringOrIdentContext,0);
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

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	SEMICOLON() {
	    return this.getToken(PascalishRouterMapperParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitServiceDecl(this);
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

	accept(visitor) {
	    if ( visitor instanceof PascalishRouterMapperVisitor ) {
	        return visitor.visitRouterHeaderProp(this);
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

	stringValue() {
	    return this.getTypedRuleContext(StringValueContext,0);
	};

	TYPES() {
	    return this.getToken(PascalishRouterMapperParser.TYPES, 0);
	};

	stringList() {
	    return this.getTypedRuleContext(StringListContext,0);
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

	NOT() {
	    return this.getToken(PascalishRouterMapperParser.NOT, 0);
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
PascalishRouterMapperParser.VarDeclContext = VarDeclContext; 
PascalishRouterMapperParser.VarSourceContext = VarSourceContext; 
PascalishRouterMapperParser.ServiceDeclContext = ServiceDeclContext; 
PascalishRouterMapperParser.RouterDeclContext = RouterDeclContext; 
PascalishRouterMapperParser.RouterHeaderPropContext = RouterHeaderPropContext; 
PascalishRouterMapperParser.OutputDeclContext = OutputDeclContext; 
PascalishRouterMapperParser.OutputTypeMetaContext = OutputTypeMetaContext; 
PascalishRouterMapperParser.MapperDeclContext = MapperDeclContext; 
PascalishRouterMapperParser.MapperHeaderPropContext = MapperHeaderPropContext; 
PascalishRouterMapperParser.MapDeclContext = MapDeclContext; 
PascalishRouterMapperParser.StringListContext = StringListContext; 
PascalishRouterMapperParser.StringOrIdentContext = StringOrIdentContext; 
PascalishRouterMapperParser.StringValueContext = StringValueContext; 
PascalishRouterMapperParser.BooleanValueContext = BooleanValueContext; 
PascalishRouterMapperParser.Pl0SnippetContext = Pl0SnippetContext; 
PascalishRouterMapperParser.Pl0BlockContext = Pl0BlockContext; 
PascalishRouterMapperParser.Pl0ElementContext = Pl0ElementContext; 
