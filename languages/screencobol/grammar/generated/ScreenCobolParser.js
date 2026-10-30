// Generated from ScreenCobol.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import ScreenCobolVisitor from './ScreenCobolVisitor.js';

const serializedATN = [4,1,39,149,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,
0,1,0,1,0,1,0,1,0,1,0,1,0,4,0,35,8,0,11,0,12,0,36,1,0,1,0,1,0,1,0,4,0,43,
8,0,11,0,12,0,44,1,0,1,0,1,0,1,0,1,0,1,0,4,0,53,8,0,11,0,12,0,54,1,0,1,0,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,67,8,1,1,1,1,1,3,1,71,8,1,1,1,1,1,1,
2,1,2,1,2,1,2,1,2,1,2,1,2,3,2,82,8,2,1,2,1,2,4,2,86,8,2,11,2,12,2,87,1,3,
1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,3,3,104,8,3,1,3,1,3,
1,3,3,3,109,8,3,1,3,1,3,1,4,1,4,1,5,1,5,3,5,117,8,5,1,5,1,5,1,5,1,5,1,5,
1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,3,5,139,8,5,
1,6,1,6,1,7,1,7,1,8,1,8,1,9,1,9,1,9,0,0,10,0,2,4,6,8,10,12,14,16,18,0,4,
1,0,20,22,2,0,15,15,33,33,2,0,34,34,36,36,4,0,15,15,18,18,33,33,37,37,152,
0,20,1,0,0,0,2,58,1,0,0,0,4,74,1,0,0,0,6,89,1,0,0,0,8,112,1,0,0,0,10,138,
1,0,0,0,12,140,1,0,0,0,14,142,1,0,0,0,16,144,1,0,0,0,18,146,1,0,0,0,20,21,
5,1,0,0,21,22,5,2,0,0,22,23,5,3,0,0,23,24,5,4,0,0,24,25,5,3,0,0,25,26,3,
14,7,0,26,27,5,3,0,0,27,28,5,5,0,0,28,29,5,2,0,0,29,30,5,3,0,0,30,31,5,6,
0,0,31,32,5,7,0,0,32,34,5,3,0,0,33,35,3,2,1,0,34,33,1,0,0,0,35,36,1,0,0,
0,36,34,1,0,0,0,36,37,1,0,0,0,37,38,1,0,0,0,38,39,5,8,0,0,39,40,5,7,0,0,
40,42,5,3,0,0,41,43,3,4,2,0,42,41,1,0,0,0,43,44,1,0,0,0,44,42,1,0,0,0,44,
45,1,0,0,0,45,46,1,0,0,0,46,47,5,9,0,0,47,48,5,2,0,0,48,52,5,3,0,0,49,50,
3,10,5,0,50,51,5,3,0,0,51,53,1,0,0,0,52,49,1,0,0,0,53,54,1,0,0,0,54,52,1,
0,0,0,54,55,1,0,0,0,55,56,1,0,0,0,56,57,5,0,0,1,57,1,1,0,0,0,58,59,3,12,
6,0,59,60,3,14,7,0,60,61,5,10,0,0,61,66,5,11,0,0,62,63,5,12,0,0,63,64,3,
16,8,0,64,65,5,13,0,0,65,67,1,0,0,0,66,62,1,0,0,0,66,67,1,0,0,0,67,70,1,
0,0,0,68,69,5,14,0,0,69,71,3,18,9,0,70,68,1,0,0,0,70,71,1,0,0,0,71,72,1,
0,0,0,72,73,5,3,0,0,73,3,1,0,0,0,74,75,5,15,0,0,75,81,3,14,7,0,76,77,5,16,
0,0,77,78,3,16,8,0,78,79,5,17,0,0,79,80,3,16,8,0,80,82,1,0,0,0,81,76,1,0,
0,0,81,82,1,0,0,0,82,83,1,0,0,0,83,85,5,3,0,0,84,86,3,6,3,0,85,84,1,0,0,
0,86,87,1,0,0,0,87,85,1,0,0,0,87,88,1,0,0,0,88,5,1,0,0,0,89,90,5,18,0,0,
90,91,3,14,7,0,91,92,5,19,0,0,92,93,3,16,8,0,93,94,5,17,0,0,94,108,3,16,
8,0,95,96,5,14,0,0,96,109,3,18,9,0,97,98,5,10,0,0,98,103,5,11,0,0,99,100,
5,12,0,0,100,101,3,16,8,0,101,102,5,13,0,0,102,104,1,0,0,0,103,99,1,0,0,
0,103,104,1,0,0,0,104,105,1,0,0,0,105,106,3,8,4,0,106,107,3,14,7,0,107,109,
1,0,0,0,108,95,1,0,0,0,108,97,1,0,0,0,109,110,1,0,0,0,110,111,5,3,0,0,111,
7,1,0,0,0,112,113,7,0,0,0,113,9,1,0,0,0,114,116,5,23,0,0,115,117,5,24,0,
0,116,115,1,0,0,0,116,117,1,0,0,0,117,118,1,0,0,0,118,139,3,14,7,0,119,120,
5,25,0,0,120,139,3,14,7,0,121,122,5,26,0,0,122,123,3,18,9,0,123,124,5,22,
0,0,124,125,3,14,7,0,125,139,1,0,0,0,126,127,5,27,0,0,127,128,3,14,7,0,128,
129,5,22,0,0,129,130,3,18,9,0,130,131,5,28,0,0,131,132,5,29,0,0,132,133,
3,16,8,0,133,134,5,30,0,0,134,135,3,14,7,0,135,139,1,0,0,0,136,137,5,31,
0,0,137,139,5,32,0,0,138,114,1,0,0,0,138,119,1,0,0,0,138,121,1,0,0,0,138,
126,1,0,0,0,138,136,1,0,0,0,139,11,1,0,0,0,140,141,7,1,0,0,141,13,1,0,0,
0,142,143,7,2,0,0,143,15,1,0,0,0,144,145,7,3,0,0,145,17,1,0,0,0,146,147,
5,35,0,0,147,19,1,0,0,0,11,36,44,54,66,70,81,87,103,108,116,138];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class ScreenCobolParser extends antlr4.Parser {

    static grammarFileName = "ScreenCobol.g4";
    static literalNames = [ null, "'IDENTIFICATION'", "'DIVISION'", "'.'", 
                            "'PROGRAM-ID'", "'DATA'", "'WORKING-STORAGE'", 
                            "'SECTION'", "'SCREEN'", "'PROCEDURE'", "'PIC'", 
                            "'X'", "'('", "')'", "'VALUE'", "'01'", "'SIZE'", 
                            "','", "'05'", "'AT'", "'USING'", "'FROM'", 
                            "'TO'", "'DISPLAY'", "'BASE'", "'ACCEPT'", "'MOVE'", 
                            "'SEND'", "'REPLY'", "'CODE'", "'YIELDS'", "'STOP'", 
                            "'RUN'", "'77'", "'FILLER'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, "STRING", "IDENTIFIER", "NUMBER", 
                             "COMMENT", "WS" ];
    static ruleNames = [ "program", "item", "screen", "field", "direction", 
                         "statement", "level", "name", "integer", "string" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = ScreenCobolParser.ruleNames;
        this.literalNames = ScreenCobolParser.literalNames;
        this.symbolicNames = ScreenCobolParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, ScreenCobolParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 20;
	        this.match(ScreenCobolParser.T__0);
	        this.state = 21;
	        this.match(ScreenCobolParser.T__1);
	        this.state = 22;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 23;
	        this.match(ScreenCobolParser.T__3);
	        this.state = 24;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 25;
	        this.name();
	        this.state = 26;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 27;
	        this.match(ScreenCobolParser.T__4);
	        this.state = 28;
	        this.match(ScreenCobolParser.T__1);
	        this.state = 29;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 30;
	        this.match(ScreenCobolParser.T__5);
	        this.state = 31;
	        this.match(ScreenCobolParser.T__6);
	        this.state = 32;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 34; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 33;
	            this.item();
	            this.state = 36; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===15 || _la===33);
	        this.state = 38;
	        this.match(ScreenCobolParser.T__7);
	        this.state = 39;
	        this.match(ScreenCobolParser.T__6);
	        this.state = 40;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 42; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 41;
	            this.screen();
	            this.state = 44; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===15);
	        this.state = 46;
	        this.match(ScreenCobolParser.T__8);
	        this.state = 47;
	        this.match(ScreenCobolParser.T__1);
	        this.state = 48;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 52; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 49;
	            this.statement();
	            this.state = 50;
	            this.match(ScreenCobolParser.T__2);
	            this.state = 54; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while((((_la) & ~0x1f) === 0 && ((1 << _la) & 2390753280) !== 0));
	        this.state = 56;
	        this.match(ScreenCobolParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	item() {
	    let localctx = new ItemContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, ScreenCobolParser.RULE_item);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 58;
	        this.level();
	        this.state = 59;
	        this.name();
	        this.state = 60;
	        this.match(ScreenCobolParser.T__9);
	        this.state = 61;
	        this.match(ScreenCobolParser.T__10);
	        this.state = 66;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===12) {
	            this.state = 62;
	            this.match(ScreenCobolParser.T__11);
	            this.state = 63;
	            this.integer();
	            this.state = 64;
	            this.match(ScreenCobolParser.T__12);
	        }

	        this.state = 70;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===14) {
	            this.state = 68;
	            this.match(ScreenCobolParser.T__13);
	            this.state = 69;
	            this.string();
	        }

	        this.state = 72;
	        this.match(ScreenCobolParser.T__2);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	screen() {
	    let localctx = new ScreenContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, ScreenCobolParser.RULE_screen);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 74;
	        this.match(ScreenCobolParser.T__14);
	        this.state = 75;
	        this.name();
	        this.state = 81;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===16) {
	            this.state = 76;
	            this.match(ScreenCobolParser.T__15);
	            this.state = 77;
	            this.integer();
	            this.state = 78;
	            this.match(ScreenCobolParser.T__16);
	            this.state = 79;
	            this.integer();
	        }

	        this.state = 83;
	        this.match(ScreenCobolParser.T__2);
	        this.state = 85; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 84;
	            this.field();
	            this.state = 87; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===18);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	field() {
	    let localctx = new FieldContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, ScreenCobolParser.RULE_field);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 89;
	        this.match(ScreenCobolParser.T__17);
	        this.state = 90;
	        this.name();
	        this.state = 91;
	        this.match(ScreenCobolParser.T__18);
	        this.state = 92;
	        this.integer();
	        this.state = 93;
	        this.match(ScreenCobolParser.T__16);
	        this.state = 94;
	        this.integer();
	        this.state = 108;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 14:
	            this.state = 95;
	            this.match(ScreenCobolParser.T__13);
	            this.state = 96;
	            this.string();
	            break;
	        case 10:
	            this.state = 97;
	            this.match(ScreenCobolParser.T__9);
	            this.state = 98;
	            this.match(ScreenCobolParser.T__10);
	            this.state = 103;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===12) {
	                this.state = 99;
	                this.match(ScreenCobolParser.T__11);
	                this.state = 100;
	                this.integer();
	                this.state = 101;
	                this.match(ScreenCobolParser.T__12);
	            }

	            this.state = 105;
	            this.direction();
	            this.state = 106;
	            this.name();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 110;
	        this.match(ScreenCobolParser.T__2);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	direction() {
	    let localctx = new DirectionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, ScreenCobolParser.RULE_direction);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 112;
	        _la = this._input.LA(1);
	        if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 7340032) !== 0))) {
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



	statement() {
	    let localctx = new StatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, ScreenCobolParser.RULE_statement);
	    var _la = 0;
	    try {
	        this.state = 138;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 23:
	            localctx = new DisplayStatementContext(this, localctx);
	            this.enterOuterAlt(localctx, 1);
	            this.state = 114;
	            this.match(ScreenCobolParser.T__22);
	            this.state = 116;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===24) {
	                this.state = 115;
	                this.match(ScreenCobolParser.T__23);
	            }

	            this.state = 118;
	            this.name();
	            break;
	        case 25:
	            localctx = new AcceptStatementContext(this, localctx);
	            this.enterOuterAlt(localctx, 2);
	            this.state = 119;
	            this.match(ScreenCobolParser.T__24);
	            this.state = 120;
	            this.name();
	            break;
	        case 26:
	            localctx = new MoveStatementContext(this, localctx);
	            this.enterOuterAlt(localctx, 3);
	            this.state = 121;
	            this.match(ScreenCobolParser.T__25);
	            this.state = 122;
	            this.string();
	            this.state = 123;
	            this.match(ScreenCobolParser.T__21);
	            this.state = 124;
	            this.name();
	            break;
	        case 27:
	            localctx = new SendStatementContext(this, localctx);
	            this.enterOuterAlt(localctx, 4);
	            this.state = 126;
	            this.match(ScreenCobolParser.T__26);
	            this.state = 127;
	            this.name();
	            this.state = 128;
	            this.match(ScreenCobolParser.T__21);
	            this.state = 129;
	            this.string();
	            this.state = 130;
	            this.match(ScreenCobolParser.T__27);
	            this.state = 131;
	            this.match(ScreenCobolParser.T__28);
	            this.state = 132;
	            this.integer();
	            this.state = 133;
	            this.match(ScreenCobolParser.T__29);
	            this.state = 134;
	            this.name();
	            break;
	        case 31:
	            localctx = new StopStatementContext(this, localctx);
	            this.enterOuterAlt(localctx, 5);
	            this.state = 136;
	            this.match(ScreenCobolParser.T__30);
	            this.state = 137;
	            this.match(ScreenCobolParser.T__31);
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



	level() {
	    let localctx = new LevelContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, ScreenCobolParser.RULE_level);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 140;
	        _la = this._input.LA(1);
	        if(!(_la===15 || _la===33)) {
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



	name() {
	    let localctx = new NameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, ScreenCobolParser.RULE_name);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 142;
	        _la = this._input.LA(1);
	        if(!(_la===34 || _la===36)) {
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



	integer() {
	    let localctx = new IntegerContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, ScreenCobolParser.RULE_integer);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 144;
	        _la = this._input.LA(1);
	        if(!(((((_la - 15)) & ~0x1f) === 0 && ((1 << (_la - 15)) & 4456457) !== 0))) {
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



	string() {
	    let localctx = new StringContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, ScreenCobolParser.RULE_string);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 146;
	        this.match(ScreenCobolParser.STRING);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
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

ScreenCobolParser.EOF = antlr4.Token.EOF;
ScreenCobolParser.T__0 = 1;
ScreenCobolParser.T__1 = 2;
ScreenCobolParser.T__2 = 3;
ScreenCobolParser.T__3 = 4;
ScreenCobolParser.T__4 = 5;
ScreenCobolParser.T__5 = 6;
ScreenCobolParser.T__6 = 7;
ScreenCobolParser.T__7 = 8;
ScreenCobolParser.T__8 = 9;
ScreenCobolParser.T__9 = 10;
ScreenCobolParser.T__10 = 11;
ScreenCobolParser.T__11 = 12;
ScreenCobolParser.T__12 = 13;
ScreenCobolParser.T__13 = 14;
ScreenCobolParser.T__14 = 15;
ScreenCobolParser.T__15 = 16;
ScreenCobolParser.T__16 = 17;
ScreenCobolParser.T__17 = 18;
ScreenCobolParser.T__18 = 19;
ScreenCobolParser.T__19 = 20;
ScreenCobolParser.T__20 = 21;
ScreenCobolParser.T__21 = 22;
ScreenCobolParser.T__22 = 23;
ScreenCobolParser.T__23 = 24;
ScreenCobolParser.T__24 = 25;
ScreenCobolParser.T__25 = 26;
ScreenCobolParser.T__26 = 27;
ScreenCobolParser.T__27 = 28;
ScreenCobolParser.T__28 = 29;
ScreenCobolParser.T__29 = 30;
ScreenCobolParser.T__30 = 31;
ScreenCobolParser.T__31 = 32;
ScreenCobolParser.T__32 = 33;
ScreenCobolParser.T__33 = 34;
ScreenCobolParser.STRING = 35;
ScreenCobolParser.IDENTIFIER = 36;
ScreenCobolParser.NUMBER = 37;
ScreenCobolParser.COMMENT = 38;
ScreenCobolParser.WS = 39;

ScreenCobolParser.RULE_program = 0;
ScreenCobolParser.RULE_item = 1;
ScreenCobolParser.RULE_screen = 2;
ScreenCobolParser.RULE_field = 3;
ScreenCobolParser.RULE_direction = 4;
ScreenCobolParser.RULE_statement = 5;
ScreenCobolParser.RULE_level = 6;
ScreenCobolParser.RULE_name = 7;
ScreenCobolParser.RULE_integer = 8;
ScreenCobolParser.RULE_string = 9;

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
        this.ruleIndex = ScreenCobolParser.RULE_program;
    }

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	EOF() {
	    return this.getToken(ScreenCobolParser.EOF, 0);
	};

	item = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ItemContext);
	    } else {
	        return this.getTypedRuleContext(ItemContext,i);
	    }
	};

	screen = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ScreenContext);
	    } else {
	        return this.getTypedRuleContext(ScreenContext,i);
	    }
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
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitProgram(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ItemContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_item;
    }

	level() {
	    return this.getTypedRuleContext(LevelContext,0);
	};

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	integer() {
	    return this.getTypedRuleContext(IntegerContext,0);
	};

	string() {
	    return this.getTypedRuleContext(StringContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ScreenContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_screen;
    }

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	integer = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(IntegerContext);
	    } else {
	        return this.getTypedRuleContext(IntegerContext,i);
	    }
	};

	field = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FieldContext);
	    } else {
	        return this.getTypedRuleContext(FieldContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitScreen(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FieldContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_field;
    }

	name = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(NameContext);
	    } else {
	        return this.getTypedRuleContext(NameContext,i);
	    }
	};

	integer = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(IntegerContext);
	    } else {
	        return this.getTypedRuleContext(IntegerContext,i);
	    }
	};

	string() {
	    return this.getTypedRuleContext(StringContext,0);
	};

	direction() {
	    return this.getTypedRuleContext(DirectionContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitField(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class DirectionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_direction;
    }


	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitDirection(this);
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
        this.ruleIndex = ScreenCobolParser.RULE_statement;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class StopStatementContext extends StatementContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }


	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitStopStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

ScreenCobolParser.StopStatementContext = StopStatementContext;

class MoveStatementContext extends StatementContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	string() {
	    return this.getTypedRuleContext(StringContext,0);
	};

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitMoveStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

ScreenCobolParser.MoveStatementContext = MoveStatementContext;

class SendStatementContext extends StatementContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	name = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(NameContext);
	    } else {
	        return this.getTypedRuleContext(NameContext,i);
	    }
	};

	string() {
	    return this.getTypedRuleContext(StringContext,0);
	};

	integer() {
	    return this.getTypedRuleContext(IntegerContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitSendStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

ScreenCobolParser.SendStatementContext = SendStatementContext;

class DisplayStatementContext extends StatementContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitDisplayStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

ScreenCobolParser.DisplayStatementContext = DisplayStatementContext;

class AcceptStatementContext extends StatementContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	name() {
	    return this.getTypedRuleContext(NameContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitAcceptStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

ScreenCobolParser.AcceptStatementContext = AcceptStatementContext;

class LevelContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_level;
    }


	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitLevel(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class NameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_name;
    }

	IDENTIFIER() {
	    return this.getToken(ScreenCobolParser.IDENTIFIER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitName(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class IntegerContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_integer;
    }

	NUMBER() {
	    return this.getToken(ScreenCobolParser.NUMBER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitInteger(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StringContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScreenCobolParser.RULE_string;
    }

	STRING() {
	    return this.getToken(ScreenCobolParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof ScreenCobolVisitor ) {
	        return visitor.visitString(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




ScreenCobolParser.ProgramContext = ProgramContext; 
ScreenCobolParser.ItemContext = ItemContext; 
ScreenCobolParser.ScreenContext = ScreenContext; 
ScreenCobolParser.FieldContext = FieldContext; 
ScreenCobolParser.DirectionContext = DirectionContext; 
ScreenCobolParser.StatementContext = StatementContext; 
ScreenCobolParser.LevelContext = LevelContext; 
ScreenCobolParser.NameContext = NameContext; 
ScreenCobolParser.IntegerContext = IntegerContext; 
ScreenCobolParser.StringContext = StringContext; 
