// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/WFL.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import WFLVisitor from './WFLVisitor.js';

const serializedATN = [4,1,58,225,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,1,
0,1,0,1,0,1,0,1,0,5,0,46,8,0,10,0,12,0,49,9,0,1,0,1,0,1,1,1,1,1,1,1,1,5,
1,57,8,1,10,1,12,1,60,9,1,1,1,1,1,1,2,1,2,1,2,3,2,67,8,2,1,3,1,3,1,3,1,3,
1,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,86,8,4,1,5,1,5,1,
5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,3,6,101,8,6,1,6,1,6,3,6,105,8,
6,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,3,8,120,8,8,1,8,1,
8,1,8,1,8,3,8,126,8,8,1,8,1,8,3,8,130,8,8,1,8,1,8,3,8,134,8,8,1,8,1,8,1,
9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,3,9,149,8,9,1,9,1,9,3,9,153,8,
9,1,9,1,9,1,10,1,10,1,11,1,11,1,12,1,12,1,12,5,12,164,8,12,10,12,12,12,167,
9,12,1,13,1,13,1,13,5,13,172,8,13,10,13,12,13,175,9,13,1,14,1,14,1,14,5,
14,180,8,14,10,14,12,14,183,9,14,1,15,1,15,1,15,5,15,188,8,15,10,15,12,15,
191,9,15,1,16,1,16,1,16,5,16,196,8,16,10,16,12,16,199,9,16,1,17,1,17,1,17,
5,17,204,8,17,10,17,12,17,207,9,17,1,18,1,18,1,18,3,18,212,8,18,1,19,1,19,
1,19,1,19,1,19,1,19,1,19,1,19,1,19,3,19,223,8,19,1,19,0,0,20,0,2,4,6,8,10,
12,14,16,18,20,22,24,26,28,30,32,34,36,38,0,7,1,0,28,29,1,0,30,34,1,0,37,
38,1,0,39,42,1,0,43,44,1,0,45,47,2,0,44,44,48,48,237,0,47,1,0,0,0,2,52,1,
0,0,0,4,66,1,0,0,0,6,68,1,0,0,0,8,85,1,0,0,0,10,87,1,0,0,0,12,92,1,0,0,0,
14,108,1,0,0,0,16,119,1,0,0,0,18,137,1,0,0,0,20,156,1,0,0,0,22,158,1,0,0,
0,24,160,1,0,0,0,26,168,1,0,0,0,28,176,1,0,0,0,30,184,1,0,0,0,32,192,1,0,
0,0,34,200,1,0,0,0,36,211,1,0,0,0,38,222,1,0,0,0,40,46,3,2,1,0,41,46,3,6,
3,0,42,46,3,10,5,0,43,46,3,14,7,0,44,46,3,18,9,0,45,40,1,0,0,0,45,41,1,0,
0,0,45,42,1,0,0,0,45,43,1,0,0,0,45,44,1,0,0,0,46,49,1,0,0,0,47,45,1,0,0,
0,47,48,1,0,0,0,48,50,1,0,0,0,49,47,1,0,0,0,50,51,5,0,0,1,51,1,1,0,0,0,52,
53,5,1,0,0,53,54,5,53,0,0,54,58,5,2,0,0,55,57,3,4,2,0,56,55,1,0,0,0,57,60,
1,0,0,0,58,56,1,0,0,0,58,59,1,0,0,0,59,61,1,0,0,0,60,58,1,0,0,0,61,62,5,
3,0,0,62,3,1,0,0,0,63,67,3,2,1,0,64,65,5,53,0,0,65,67,5,4,0,0,66,63,1,0,
0,0,66,64,1,0,0,0,67,5,1,0,0,0,68,69,5,5,0,0,69,70,3,8,4,0,70,71,5,6,0,0,
71,72,5,1,0,0,72,73,5,53,0,0,73,74,5,4,0,0,74,7,1,0,0,0,75,76,5,7,0,0,76,
86,5,53,0,0,77,78,5,8,0,0,78,86,5,53,0,0,79,80,5,9,0,0,80,86,5,53,0,0,81,
82,5,10,0,0,82,86,5,53,0,0,83,84,5,11,0,0,84,86,5,53,0,0,85,75,1,0,0,0,85,
77,1,0,0,0,85,79,1,0,0,0,85,81,1,0,0,0,85,83,1,0,0,0,86,9,1,0,0,0,87,88,
5,12,0,0,88,89,5,10,0,0,89,90,5,53,0,0,90,91,3,12,6,0,91,11,1,0,0,0,92,93,
5,13,0,0,93,94,5,53,0,0,94,95,5,14,0,0,95,96,5,55,0,0,96,97,5,1,0,0,97,100,
5,53,0,0,98,99,5,15,0,0,99,101,5,53,0,0,100,98,1,0,0,0,100,101,1,0,0,0,101,
104,1,0,0,0,102,103,5,16,0,0,103,105,5,53,0,0,104,102,1,0,0,0,104,105,1,
0,0,0,105,106,1,0,0,0,106,107,5,4,0,0,107,13,1,0,0,0,108,109,5,12,0,0,109,
110,5,11,0,0,110,111,5,53,0,0,111,112,3,16,8,0,112,15,1,0,0,0,113,114,5,
17,0,0,114,120,5,55,0,0,115,116,5,18,0,0,116,120,5,55,0,0,117,118,5,19,0,
0,118,120,5,55,0,0,119,113,1,0,0,0,119,115,1,0,0,0,119,117,1,0,0,0,120,121,
1,0,0,0,121,122,5,1,0,0,122,125,5,53,0,0,123,124,5,16,0,0,124,126,5,53,0,
0,125,123,1,0,0,0,125,126,1,0,0,0,126,129,1,0,0,0,127,128,5,20,0,0,128,130,
5,53,0,0,129,127,1,0,0,0,129,130,1,0,0,0,130,133,1,0,0,0,131,132,5,21,0,
0,132,134,3,22,11,0,133,131,1,0,0,0,133,134,1,0,0,0,134,135,1,0,0,0,135,
136,5,4,0,0,136,17,1,0,0,0,137,138,5,22,0,0,138,139,5,8,0,0,139,140,5,53,
0,0,140,141,5,23,0,0,141,142,5,24,0,0,142,143,3,22,11,0,143,148,3,20,10,
0,144,145,5,25,0,0,145,149,5,26,0,0,146,147,5,27,0,0,147,149,5,26,0,0,148,
144,1,0,0,0,148,146,1,0,0,0,148,149,1,0,0,0,149,152,1,0,0,0,150,151,5,15,
0,0,151,153,7,0,0,0,152,150,1,0,0,0,152,153,1,0,0,0,153,154,1,0,0,0,154,
155,5,4,0,0,155,19,1,0,0,0,156,157,7,1,0,0,157,21,1,0,0,0,158,159,3,24,12,
0,159,23,1,0,0,0,160,165,3,26,13,0,161,162,5,35,0,0,162,164,3,26,13,0,163,
161,1,0,0,0,164,167,1,0,0,0,165,163,1,0,0,0,165,166,1,0,0,0,166,25,1,0,0,
0,167,165,1,0,0,0,168,173,3,28,14,0,169,170,5,36,0,0,170,172,3,28,14,0,171,
169,1,0,0,0,172,175,1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,0,174,27,1,0,0,
0,175,173,1,0,0,0,176,181,3,30,15,0,177,178,7,2,0,0,178,180,3,30,15,0,179,
177,1,0,0,0,180,183,1,0,0,0,181,179,1,0,0,0,181,182,1,0,0,0,182,29,1,0,0,
0,183,181,1,0,0,0,184,189,3,32,16,0,185,186,7,3,0,0,186,188,3,32,16,0,187,
185,1,0,0,0,188,191,1,0,0,0,189,187,1,0,0,0,189,190,1,0,0,0,190,31,1,0,0,
0,191,189,1,0,0,0,192,197,3,34,17,0,193,194,7,4,0,0,194,196,3,34,17,0,195,
193,1,0,0,0,196,199,1,0,0,0,197,195,1,0,0,0,197,198,1,0,0,0,198,33,1,0,0,
0,199,197,1,0,0,0,200,205,3,36,18,0,201,202,7,5,0,0,202,204,3,36,18,0,203,
201,1,0,0,0,204,207,1,0,0,0,205,203,1,0,0,0,205,206,1,0,0,0,206,35,1,0,0,
0,207,205,1,0,0,0,208,209,7,6,0,0,209,212,3,36,18,0,210,212,3,38,19,0,211,
208,1,0,0,0,211,210,1,0,0,0,212,37,1,0,0,0,213,223,5,54,0,0,214,223,5,55,
0,0,215,223,5,49,0,0,216,223,5,50,0,0,217,223,5,53,0,0,218,219,5,51,0,0,
219,220,3,22,11,0,220,221,5,52,0,0,221,223,1,0,0,0,222,213,1,0,0,0,222,214,
1,0,0,0,222,215,1,0,0,0,222,216,1,0,0,0,222,217,1,0,0,0,222,218,1,0,0,0,
223,39,1,0,0,0,21,45,47,58,66,85,100,104,119,125,129,133,148,152,165,173,
181,189,197,205,211,222];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class WFLParser extends antlr4.Parser {

    static grammarFileName = "WFL.g4";
    static literalNames = [ null, "'cluster'", "'{'", "'}'", "';'", "'deploy'", 
                            "'to'", "'program'", "'service'", "'daemon'", 
                            "'queue'", "'file'", "'bind'", "'manager'", 
                            "'name'", "'fallback'", "'mode'", "'path'", 
                            "'device'", "'url'", "'rotate'", "'maxsize'", 
                            "'evict'", "'after'", "'idle'", "'warm'", "'reload'", 
                            "'cold'", "'parent'", "'alternate'", "'ms'", 
                            "'second'", "'seconds'", "'minute'", "'minutes'", 
                            "'or'", "'and'", "'='", "'<>'", "'<'", "'<='", 
                            "'>'", "'>='", "'+'", "'-'", "'*'", "'/'", "'mod'", 
                            "'not'", "'true'", "'false'", "'('", "')'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, "IDENT", "NUMBER", 
                             "STRING", "LINE_COMMENT", "BLOCK_COMMENT", 
                             "WS" ];
    static ruleNames = [ "wflUnit", "clusterDecl", "clusterBody", "deployDecl", 
                         "deployTarget", "bindQueueDecl", "queueBindingBody", 
                         "bindFileDecl", "fileBindingBody", "evictDecl", 
                         "timeUnit", "expr", "logicalOrExpr", "logicalAndExpr", 
                         "equalityExpr", "relationalExpr", "additiveExpr", 
                         "multiplicativeExpr", "unaryExpr", "primaryExpr" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = WFLParser.ruleNames;
        this.literalNames = WFLParser.literalNames;
        this.symbolicNames = WFLParser.symbolicNames;
    }



	wflUnit() {
	    let localctx = new WflUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, WFLParser.RULE_wflUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 47;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 4198434) !== 0)) {
	            this.state = 45;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,0,this._ctx);
	            switch(la_) {
	            case 1:
	                this.state = 40;
	                this.clusterDecl();
	                break;

	            case 2:
	                this.state = 41;
	                this.deployDecl();
	                break;

	            case 3:
	                this.state = 42;
	                this.bindQueueDecl();
	                break;

	            case 4:
	                this.state = 43;
	                this.bindFileDecl();
	                break;

	            case 5:
	                this.state = 44;
	                this.evictDecl();
	                break;

	            }
	            this.state = 49;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 50;
	        this.match(WFLParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	clusterDecl() {
	    let localctx = new ClusterDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, WFLParser.RULE_clusterDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 52;
	        this.match(WFLParser.T__0);
	        this.state = 53;
	        this.match(WFLParser.IDENT);
	        this.state = 54;
	        this.match(WFLParser.T__1);
	        this.state = 58;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===1 || _la===53) {
	            this.state = 55;
	            this.clusterBody();
	            this.state = 60;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 61;
	        this.match(WFLParser.T__2);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	clusterBody() {
	    let localctx = new ClusterBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, WFLParser.RULE_clusterBody);
	    try {
	        this.state = 66;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 63;
	            this.clusterDecl();
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 64;
	            this.match(WFLParser.IDENT);
	            this.state = 65;
	            this.match(WFLParser.T__3);
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



	deployDecl() {
	    let localctx = new DeployDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, WFLParser.RULE_deployDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 68;
	        this.match(WFLParser.T__4);
	        this.state = 69;
	        this.deployTarget();
	        this.state = 70;
	        this.match(WFLParser.T__5);
	        this.state = 71;
	        this.match(WFLParser.T__0);
	        this.state = 72;
	        this.match(WFLParser.IDENT);
	        this.state = 73;
	        this.match(WFLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	deployTarget() {
	    let localctx = new DeployTargetContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, WFLParser.RULE_deployTarget);
	    try {
	        this.state = 85;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 75;
	            this.match(WFLParser.T__6);
	            this.state = 76;
	            this.match(WFLParser.IDENT);
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 77;
	            this.match(WFLParser.T__7);
	            this.state = 78;
	            this.match(WFLParser.IDENT);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 79;
	            this.match(WFLParser.T__8);
	            this.state = 80;
	            this.match(WFLParser.IDENT);
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 81;
	            this.match(WFLParser.T__9);
	            this.state = 82;
	            this.match(WFLParser.IDENT);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 83;
	            this.match(WFLParser.T__10);
	            this.state = 84;
	            this.match(WFLParser.IDENT);
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



	bindQueueDecl() {
	    let localctx = new BindQueueDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, WFLParser.RULE_bindQueueDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 87;
	        this.match(WFLParser.T__11);
	        this.state = 88;
	        this.match(WFLParser.T__9);
	        this.state = 89;
	        this.match(WFLParser.IDENT);
	        this.state = 90;
	        this.queueBindingBody();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	queueBindingBody() {
	    let localctx = new QueueBindingBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, WFLParser.RULE_queueBindingBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 92;
	        this.match(WFLParser.T__12);
	        this.state = 93;
	        this.match(WFLParser.IDENT);
	        this.state = 94;
	        this.match(WFLParser.T__13);
	        this.state = 95;
	        this.match(WFLParser.STRING);
	        this.state = 96;
	        this.match(WFLParser.T__0);
	        this.state = 97;
	        this.match(WFLParser.IDENT);
	        this.state = 100;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===15) {
	            this.state = 98;
	            this.match(WFLParser.T__14);
	            this.state = 99;
	            this.match(WFLParser.IDENT);
	        }

	        this.state = 104;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===16) {
	            this.state = 102;
	            this.match(WFLParser.T__15);
	            this.state = 103;
	            this.match(WFLParser.IDENT);
	        }

	        this.state = 106;
	        this.match(WFLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	bindFileDecl() {
	    let localctx = new BindFileDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, WFLParser.RULE_bindFileDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 108;
	        this.match(WFLParser.T__11);
	        this.state = 109;
	        this.match(WFLParser.T__10);
	        this.state = 110;
	        this.match(WFLParser.IDENT);
	        this.state = 111;
	        this.fileBindingBody();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	fileBindingBody() {
	    let localctx = new FileBindingBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, WFLParser.RULE_fileBindingBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 119;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 17:
	            this.state = 113;
	            this.match(WFLParser.T__16);
	            this.state = 114;
	            this.match(WFLParser.STRING);
	            break;
	        case 18:
	            this.state = 115;
	            this.match(WFLParser.T__17);
	            this.state = 116;
	            this.match(WFLParser.STRING);
	            break;
	        case 19:
	            this.state = 117;
	            this.match(WFLParser.T__18);
	            this.state = 118;
	            this.match(WFLParser.STRING);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 121;
	        this.match(WFLParser.T__0);
	        this.state = 122;
	        this.match(WFLParser.IDENT);
	        this.state = 125;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===16) {
	            this.state = 123;
	            this.match(WFLParser.T__15);
	            this.state = 124;
	            this.match(WFLParser.IDENT);
	        }

	        this.state = 129;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===20) {
	            this.state = 127;
	            this.match(WFLParser.T__19);
	            this.state = 128;
	            this.match(WFLParser.IDENT);
	        }

	        this.state = 133;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===21) {
	            this.state = 131;
	            this.match(WFLParser.T__20);
	            this.state = 132;
	            this.expr();
	        }

	        this.state = 135;
	        this.match(WFLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	evictDecl() {
	    let localctx = new EvictDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, WFLParser.RULE_evictDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 137;
	        this.match(WFLParser.T__21);
	        this.state = 138;
	        this.match(WFLParser.T__7);
	        this.state = 139;
	        this.match(WFLParser.IDENT);
	        this.state = 140;
	        this.match(WFLParser.T__22);
	        this.state = 141;
	        this.match(WFLParser.T__23);
	        this.state = 142;
	        this.expr();
	        this.state = 143;
	        this.timeUnit();
	        this.state = 148;
	        this._errHandler.sync(this);
	        switch (this._input.LA(1)) {
	        case 25:
	        	this.state = 144;
	        	this.match(WFLParser.T__24);
	        	this.state = 145;
	        	this.match(WFLParser.T__25);
	        	break;
	        case 27:
	        	this.state = 146;
	        	this.match(WFLParser.T__26);
	        	this.state = 147;
	        	this.match(WFLParser.T__25);
	        	break;
	        case 4:
	        case 15:
	        	break;
	        default:
	        	break;
	        }
	        this.state = 152;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===15) {
	            this.state = 150;
	            this.match(WFLParser.T__14);
	            this.state = 151;
	            _la = this._input.LA(1);
	            if(!(_la===28 || _la===29)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	        }

	        this.state = 154;
	        this.match(WFLParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	timeUnit() {
	    let localctx = new TimeUnitContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, WFLParser.RULE_timeUnit);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 156;
	        _la = this._input.LA(1);
	        if(!(((((_la - 30)) & ~0x1f) === 0 && ((1 << (_la - 30)) & 31) !== 0))) {
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



	expr() {
	    let localctx = new ExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, WFLParser.RULE_expr);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 158;
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
	    this.enterRule(localctx, 24, WFLParser.RULE_logicalOrExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 160;
	        this.logicalAndExpr();
	        this.state = 165;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===35) {
	            this.state = 161;
	            this.match(WFLParser.T__34);
	            this.state = 162;
	            this.logicalAndExpr();
	            this.state = 167;
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
	    this.enterRule(localctx, 26, WFLParser.RULE_logicalAndExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 168;
	        this.equalityExpr();
	        this.state = 173;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===36) {
	            this.state = 169;
	            this.match(WFLParser.T__35);
	            this.state = 170;
	            this.equalityExpr();
	            this.state = 175;
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
	    this.enterRule(localctx, 28, WFLParser.RULE_equalityExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 176;
	        this.relationalExpr();
	        this.state = 181;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===37 || _la===38) {
	            this.state = 177;
	            _la = this._input.LA(1);
	            if(!(_la===37 || _la===38)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 178;
	            this.relationalExpr();
	            this.state = 183;
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
	    this.enterRule(localctx, 30, WFLParser.RULE_relationalExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 184;
	        this.additiveExpr();
	        this.state = 189;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 39)) & ~0x1f) === 0 && ((1 << (_la - 39)) & 15) !== 0)) {
	            this.state = 185;
	            _la = this._input.LA(1);
	            if(!(((((_la - 39)) & ~0x1f) === 0 && ((1 << (_la - 39)) & 15) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 186;
	            this.additiveExpr();
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



	additiveExpr() {
	    let localctx = new AdditiveExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, WFLParser.RULE_additiveExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 192;
	        this.multiplicativeExpr();
	        this.state = 197;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===43 || _la===44) {
	            this.state = 193;
	            _la = this._input.LA(1);
	            if(!(_la===43 || _la===44)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 194;
	            this.multiplicativeExpr();
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



	multiplicativeExpr() {
	    let localctx = new MultiplicativeExprContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, WFLParser.RULE_multiplicativeExpr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 200;
	        this.unaryExpr();
	        this.state = 205;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 7) !== 0)) {
	            this.state = 201;
	            _la = this._input.LA(1);
	            if(!(((((_la - 45)) & ~0x1f) === 0 && ((1 << (_la - 45)) & 7) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 202;
	            this.unaryExpr();
	            this.state = 207;
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
	    this.enterRule(localctx, 36, WFLParser.RULE_unaryExpr);
	    var _la = 0;
	    try {
	        this.state = 211;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 44:
	        case 48:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 208;
	            _la = this._input.LA(1);
	            if(!(_la===44 || _la===48)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 209;
	            this.unaryExpr();
	            break;
	        case 49:
	        case 50:
	        case 51:
	        case 53:
	        case 54:
	        case 55:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 210;
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
	    this.enterRule(localctx, 38, WFLParser.RULE_primaryExpr);
	    try {
	        this.state = 222;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 54:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 213;
	            this.match(WFLParser.NUMBER);
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 214;
	            this.match(WFLParser.STRING);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 215;
	            this.match(WFLParser.T__48);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 216;
	            this.match(WFLParser.T__49);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 217;
	            this.match(WFLParser.IDENT);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 218;
	            this.match(WFLParser.T__50);
	            this.state = 219;
	            this.expr();
	            this.state = 220;
	            this.match(WFLParser.T__51);
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

WFLParser.EOF = antlr4.Token.EOF;
WFLParser.T__0 = 1;
WFLParser.T__1 = 2;
WFLParser.T__2 = 3;
WFLParser.T__3 = 4;
WFLParser.T__4 = 5;
WFLParser.T__5 = 6;
WFLParser.T__6 = 7;
WFLParser.T__7 = 8;
WFLParser.T__8 = 9;
WFLParser.T__9 = 10;
WFLParser.T__10 = 11;
WFLParser.T__11 = 12;
WFLParser.T__12 = 13;
WFLParser.T__13 = 14;
WFLParser.T__14 = 15;
WFLParser.T__15 = 16;
WFLParser.T__16 = 17;
WFLParser.T__17 = 18;
WFLParser.T__18 = 19;
WFLParser.T__19 = 20;
WFLParser.T__20 = 21;
WFLParser.T__21 = 22;
WFLParser.T__22 = 23;
WFLParser.T__23 = 24;
WFLParser.T__24 = 25;
WFLParser.T__25 = 26;
WFLParser.T__26 = 27;
WFLParser.T__27 = 28;
WFLParser.T__28 = 29;
WFLParser.T__29 = 30;
WFLParser.T__30 = 31;
WFLParser.T__31 = 32;
WFLParser.T__32 = 33;
WFLParser.T__33 = 34;
WFLParser.T__34 = 35;
WFLParser.T__35 = 36;
WFLParser.T__36 = 37;
WFLParser.T__37 = 38;
WFLParser.T__38 = 39;
WFLParser.T__39 = 40;
WFLParser.T__40 = 41;
WFLParser.T__41 = 42;
WFLParser.T__42 = 43;
WFLParser.T__43 = 44;
WFLParser.T__44 = 45;
WFLParser.T__45 = 46;
WFLParser.T__46 = 47;
WFLParser.T__47 = 48;
WFLParser.T__48 = 49;
WFLParser.T__49 = 50;
WFLParser.T__50 = 51;
WFLParser.T__51 = 52;
WFLParser.IDENT = 53;
WFLParser.NUMBER = 54;
WFLParser.STRING = 55;
WFLParser.LINE_COMMENT = 56;
WFLParser.BLOCK_COMMENT = 57;
WFLParser.WS = 58;

WFLParser.RULE_wflUnit = 0;
WFLParser.RULE_clusterDecl = 1;
WFLParser.RULE_clusterBody = 2;
WFLParser.RULE_deployDecl = 3;
WFLParser.RULE_deployTarget = 4;
WFLParser.RULE_bindQueueDecl = 5;
WFLParser.RULE_queueBindingBody = 6;
WFLParser.RULE_bindFileDecl = 7;
WFLParser.RULE_fileBindingBody = 8;
WFLParser.RULE_evictDecl = 9;
WFLParser.RULE_timeUnit = 10;
WFLParser.RULE_expr = 11;
WFLParser.RULE_logicalOrExpr = 12;
WFLParser.RULE_logicalAndExpr = 13;
WFLParser.RULE_equalityExpr = 14;
WFLParser.RULE_relationalExpr = 15;
WFLParser.RULE_additiveExpr = 16;
WFLParser.RULE_multiplicativeExpr = 17;
WFLParser.RULE_unaryExpr = 18;
WFLParser.RULE_primaryExpr = 19;

class WflUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_wflUnit;
    }

	EOF() {
	    return this.getToken(WFLParser.EOF, 0);
	};

	clusterDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClusterDeclContext);
	    } else {
	        return this.getTypedRuleContext(ClusterDeclContext,i);
	    }
	};

	deployDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DeployDeclContext);
	    } else {
	        return this.getTypedRuleContext(DeployDeclContext,i);
	    }
	};

	bindQueueDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BindQueueDeclContext);
	    } else {
	        return this.getTypedRuleContext(BindQueueDeclContext,i);
	    }
	};

	bindFileDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BindFileDeclContext);
	    } else {
	        return this.getTypedRuleContext(BindFileDeclContext,i);
	    }
	};

	evictDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EvictDeclContext);
	    } else {
	        return this.getTypedRuleContext(EvictDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitWflUnit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClusterDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_clusterDecl;
    }

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	clusterBody = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ClusterBodyContext);
	    } else {
	        return this.getTypedRuleContext(ClusterBodyContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitClusterDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ClusterBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_clusterBody;
    }

	clusterDecl() {
	    return this.getTypedRuleContext(ClusterDeclContext,0);
	};

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitClusterBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeployDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_deployDecl;
    }

	deployTarget() {
	    return this.getTypedRuleContext(DeployTargetContext,0);
	};

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitDeployDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DeployTargetContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_deployTarget;
    }

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitDeployTarget(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BindQueueDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_bindQueueDecl;
    }

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	queueBindingBody() {
	    return this.getTypedRuleContext(QueueBindingBodyContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitBindQueueDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QueueBindingBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_queueBindingBody;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WFLParser.IDENT);
	    } else {
	        return this.getToken(WFLParser.IDENT, i);
	    }
	};


	STRING() {
	    return this.getToken(WFLParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitQueueBindingBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BindFileDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_bindFileDecl;
    }

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	fileBindingBody() {
	    return this.getTypedRuleContext(FileBindingBodyContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitBindFileDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FileBindingBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_fileBindingBody;
    }

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WFLParser.IDENT);
	    } else {
	        return this.getToken(WFLParser.IDENT, i);
	    }
	};


	STRING() {
	    return this.getToken(WFLParser.STRING, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitFileBindingBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EvictDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_evictDecl;
    }

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	timeUnit() {
	    return this.getTypedRuleContext(TimeUnitContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitEvictDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TimeUnitContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WFLParser.RULE_timeUnit;
    }


	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitTimeUnit(this);
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
        this.ruleIndex = WFLParser.RULE_expr;
    }

	logicalOrExpr() {
	    return this.getTypedRuleContext(LogicalOrExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_logicalOrExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_logicalAndExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_equalityExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_relationalExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_additiveExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_multiplicativeExpr;
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
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_unaryExpr;
    }

	unaryExpr() {
	    return this.getTypedRuleContext(UnaryExprContext,0);
	};

	primaryExpr() {
	    return this.getTypedRuleContext(PrimaryExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
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
        this.ruleIndex = WFLParser.RULE_primaryExpr;
    }

	NUMBER() {
	    return this.getToken(WFLParser.NUMBER, 0);
	};

	STRING() {
	    return this.getToken(WFLParser.STRING, 0);
	};

	IDENT() {
	    return this.getToken(WFLParser.IDENT, 0);
	};

	expr() {
	    return this.getTypedRuleContext(ExprContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WFLVisitor ) {
	        return visitor.visitPrimaryExpr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




WFLParser.WflUnitContext = WflUnitContext; 
WFLParser.ClusterDeclContext = ClusterDeclContext; 
WFLParser.ClusterBodyContext = ClusterBodyContext; 
WFLParser.DeployDeclContext = DeployDeclContext; 
WFLParser.DeployTargetContext = DeployTargetContext; 
WFLParser.BindQueueDeclContext = BindQueueDeclContext; 
WFLParser.QueueBindingBodyContext = QueueBindingBodyContext; 
WFLParser.BindFileDeclContext = BindFileDeclContext; 
WFLParser.FileBindingBodyContext = FileBindingBodyContext; 
WFLParser.EvictDeclContext = EvictDeclContext; 
WFLParser.TimeUnitContext = TimeUnitContext; 
WFLParser.ExprContext = ExprContext; 
WFLParser.LogicalOrExprContext = LogicalOrExprContext; 
WFLParser.LogicalAndExprContext = LogicalAndExprContext; 
WFLParser.EqualityExprContext = EqualityExprContext; 
WFLParser.RelationalExprContext = RelationalExprContext; 
WFLParser.AdditiveExprContext = AdditiveExprContext; 
WFLParser.MultiplicativeExprContext = MultiplicativeExprContext; 
WFLParser.UnaryExprContext = UnaryExprContext; 
WFLParser.PrimaryExprContext = PrimaryExprContext; 
