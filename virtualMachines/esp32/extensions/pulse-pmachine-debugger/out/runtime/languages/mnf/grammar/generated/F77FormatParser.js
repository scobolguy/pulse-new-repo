// Generated from F77Format.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import F77FormatVisitor from './F77FormatVisitor.js';

const serializedATN = [4,1,28,81,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,1,0,1,0,
3,0,11,8,0,1,0,1,0,1,0,1,1,1,1,3,1,18,8,1,1,1,5,1,21,8,1,10,1,12,1,24,9,
1,1,2,3,2,27,8,2,1,2,1,2,1,2,1,2,1,2,3,2,34,8,2,1,2,1,2,3,2,38,8,2,1,2,1,
2,1,2,1,2,3,2,44,8,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,3,2,53,8,2,1,3,1,3,1,3,
1,3,3,3,59,8,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,3,3,71,8,3,1,3,1,
3,1,3,1,3,3,3,77,8,3,3,3,79,8,3,1,3,0,0,4,0,2,4,6,0,5,2,0,1,2,15,15,1,0,
26,27,2,0,3,4,17,17,1,0,5,6,1,0,9,11,99,0,8,1,0,0,0,2,15,1,0,0,0,4,52,1,
0,0,0,6,78,1,0,0,0,8,10,5,20,0,0,9,11,3,2,1,0,10,9,1,0,0,0,10,11,1,0,0,0,
11,12,1,0,0,0,12,13,5,21,0,0,13,14,5,0,0,1,14,1,1,0,0,0,15,22,3,4,2,0,16,
18,5,22,0,0,17,16,1,0,0,0,17,18,1,0,0,0,18,19,1,0,0,0,19,21,3,4,2,0,20,17,
1,0,0,0,21,24,1,0,0,0,22,20,1,0,0,0,22,23,1,0,0,0,23,3,1,0,0,0,24,22,1,0,
0,0,25,27,5,18,0,0,26,25,1,0,0,0,26,27,1,0,0,0,27,28,1,0,0,0,28,29,5,20,
0,0,29,30,3,2,1,0,30,31,5,21,0,0,31,53,1,0,0,0,32,34,5,18,0,0,33,32,1,0,
0,0,33,34,1,0,0,0,34,35,1,0,0,0,35,53,3,6,3,0,36,38,5,18,0,0,37,36,1,0,0,
0,37,38,1,0,0,0,38,39,1,0,0,0,39,53,5,14,0,0,40,41,7,0,0,0,41,53,5,18,0,
0,42,44,7,1,0,0,43,42,1,0,0,0,43,44,1,0,0,0,44,45,1,0,0,0,45,46,5,18,0,0,
46,53,5,16,0,0,47,53,7,2,0,0,48,53,7,3,0,0,49,53,5,24,0,0,50,53,5,25,0,0,
51,53,5,19,0,0,52,26,1,0,0,0,52,33,1,0,0,0,52,37,1,0,0,0,52,40,1,0,0,0,52,
43,1,0,0,0,52,47,1,0,0,0,52,48,1,0,0,0,52,49,1,0,0,0,52,50,1,0,0,0,52,51,
1,0,0,0,53,5,1,0,0,0,54,55,5,7,0,0,55,58,5,18,0,0,56,57,5,23,0,0,57,59,5,
18,0,0,58,56,1,0,0,0,58,59,1,0,0,0,59,79,1,0,0,0,60,61,5,8,0,0,61,62,5,18,
0,0,62,63,5,23,0,0,63,79,5,18,0,0,64,65,7,4,0,0,65,66,5,18,0,0,66,67,5,23,
0,0,67,70,5,18,0,0,68,69,5,9,0,0,69,71,5,18,0,0,70,68,1,0,0,0,70,71,1,0,
0,0,71,79,1,0,0,0,72,73,5,12,0,0,73,79,5,18,0,0,74,76,5,13,0,0,75,77,5,18,
0,0,76,75,1,0,0,0,76,77,1,0,0,0,77,79,1,0,0,0,78,54,1,0,0,0,78,60,1,0,0,
0,78,64,1,0,0,0,78,72,1,0,0,0,78,74,1,0,0,0,79,7,1,0,0,0,12,10,17,22,26,
33,37,43,52,58,70,76,78];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class F77FormatParser extends antlr4.Parser {

    static grammarFileName = "F77Format.g4";
    static literalNames = [ null, "'TL'", "'TR'", "'SP'", "'SS'", "'BN'", 
                            "'BZ'", "'I'", "'F'", "'E'", "'D'", "'G'", "'L'", 
                            "'A'", "'X'", "'T'", "'P'", "'S'", null, null, 
                            "'('", "')'", "','", "'.'", "'/'", "':'", "'+'", 
                            "'-'" ];
    static symbolicNames = [ null, "TL", "TR", "SP", "SS", "BN", "BZ", "I", 
                             "F", "E", "D", "G", "L", "A", "X", "T", "P", 
                             "S", "ICON", "SCON", "LPAREN", "RPAREN", "COMMA", 
                             "DOT", "SLASH", "COLON", "PLUS", "MINUS", "WS" ];
    static ruleNames = [ "formatSpecification", "formatList", "formatItem", 
                         "dataEdit" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = F77FormatParser.ruleNames;
        this.literalNames = F77FormatParser.literalNames;
        this.symbolicNames = F77FormatParser.symbolicNames;
    }



	formatSpecification() {
	    let localctx = new FormatSpecificationContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, F77FormatParser.RULE_formatSpecification);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 8;
	        this.match(F77FormatParser.LPAREN);
	        this.state = 10;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 253689854) !== 0)) {
	            this.state = 9;
	            this.formatList();
	        }

	        this.state = 12;
	        this.match(F77FormatParser.RPAREN);
	        this.state = 13;
	        this.match(F77FormatParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	formatList() {
	    let localctx = new FormatListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, F77FormatParser.RULE_formatList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 15;
	        this.formatItem();
	        this.state = 22;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 257884158) !== 0)) {
	            this.state = 17;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===22) {
	                this.state = 16;
	                this.match(F77FormatParser.COMMA);
	            }

	            this.state = 19;
	            this.formatItem();
	            this.state = 24;
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



	formatItem() {
	    let localctx = new FormatItemContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, F77FormatParser.RULE_formatItem);
	    var _la = 0;
	    try {
	        this.state = 52;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,7,this._ctx);
	        switch(la_) {
	        case 1:
	            localctx = new GroupItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 1);
	            this.state = 26;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===18) {
	                this.state = 25;
	                this.match(F77FormatParser.ICON);
	            }

	            this.state = 28;
	            this.match(F77FormatParser.LPAREN);
	            this.state = 29;
	            this.formatList();
	            this.state = 30;
	            this.match(F77FormatParser.RPAREN);
	            break;

	        case 2:
	            localctx = new DataItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 2);
	            this.state = 33;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===18) {
	                this.state = 32;
	                this.match(F77FormatParser.ICON);
	            }

	            this.state = 35;
	            this.dataEdit();
	            break;

	        case 3:
	            localctx = new SkipItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 3);
	            this.state = 37;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===18) {
	                this.state = 36;
	                this.match(F77FormatParser.ICON);
	            }

	            this.state = 39;
	            this.match(F77FormatParser.X);
	            break;

	        case 4:
	            localctx = new TabItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 4);
	            this.state = 40;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 32774) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 41;
	            this.match(F77FormatParser.ICON);
	            break;

	        case 5:
	            localctx = new ScaleItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 5);
	            this.state = 43;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===26 || _la===27) {
	                this.state = 42;
	                _la = this._input.LA(1);
	                if(!(_la===26 || _la===27)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
	            }

	            this.state = 45;
	            this.match(F77FormatParser.ICON);
	            this.state = 46;
	            this.match(F77FormatParser.P);
	            break;

	        case 6:
	            localctx = new SignItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 6);
	            this.state = 47;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 131096) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            break;

	        case 7:
	            localctx = new BlankItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 7);
	            this.state = 48;
	            _la = this._input.LA(1);
	            if(!(_la===5 || _la===6)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            break;

	        case 8:
	            localctx = new SlashItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 8);
	            this.state = 49;
	            this.match(F77FormatParser.SLASH);
	            break;

	        case 9:
	            localctx = new ColonItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 9);
	            this.state = 50;
	            this.match(F77FormatParser.COLON);
	            break;

	        case 10:
	            localctx = new LiteralItemContext(this, localctx);
	            this.enterOuterAlt(localctx, 10);
	            this.state = 51;
	            this.match(F77FormatParser.SCON);
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



	dataEdit() {
	    let localctx = new DataEditContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, F77FormatParser.RULE_dataEdit);
	    var _la = 0;
	    try {
	        this.state = 78;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 7:
	            localctx = new IntegerEditContext(this, localctx);
	            this.enterOuterAlt(localctx, 1);
	            this.state = 54;
	            this.match(F77FormatParser.I);
	            this.state = 55;
	            this.match(F77FormatParser.ICON);
	            this.state = 58;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===23) {
	                this.state = 56;
	                this.match(F77FormatParser.DOT);
	                this.state = 57;
	                this.match(F77FormatParser.ICON);
	            }

	            break;
	        case 8:
	            localctx = new FixedEditContext(this, localctx);
	            this.enterOuterAlt(localctx, 2);
	            this.state = 60;
	            this.match(F77FormatParser.F);
	            this.state = 61;
	            this.match(F77FormatParser.ICON);
	            this.state = 62;
	            this.match(F77FormatParser.DOT);
	            this.state = 63;
	            this.match(F77FormatParser.ICON);
	            break;
	        case 9:
	        case 10:
	        case 11:
	            localctx = new ExponentEditContext(this, localctx);
	            this.enterOuterAlt(localctx, 3);
	            this.state = 64;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 3584) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 65;
	            this.match(F77FormatParser.ICON);
	            this.state = 66;
	            this.match(F77FormatParser.DOT);
	            this.state = 67;
	            this.match(F77FormatParser.ICON);
	            this.state = 70;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,9,this._ctx);
	            if(la_===1) {
	                this.state = 68;
	                this.match(F77FormatParser.E);
	                this.state = 69;
	                this.match(F77FormatParser.ICON);

	            }
	            break;
	        case 12:
	            localctx = new LogicalEditContext(this, localctx);
	            this.enterOuterAlt(localctx, 4);
	            this.state = 72;
	            this.match(F77FormatParser.L);
	            this.state = 73;
	            this.match(F77FormatParser.ICON);
	            break;
	        case 13:
	            localctx = new CharacterEditContext(this, localctx);
	            this.enterOuterAlt(localctx, 5);
	            this.state = 74;
	            this.match(F77FormatParser.A);
	            this.state = 76;
	            this._errHandler.sync(this);
	            var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	            if(la_===1) {
	                this.state = 75;
	                this.match(F77FormatParser.ICON);

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


}

F77FormatParser.EOF = antlr4.Token.EOF;
F77FormatParser.TL = 1;
F77FormatParser.TR = 2;
F77FormatParser.SP = 3;
F77FormatParser.SS = 4;
F77FormatParser.BN = 5;
F77FormatParser.BZ = 6;
F77FormatParser.I = 7;
F77FormatParser.F = 8;
F77FormatParser.E = 9;
F77FormatParser.D = 10;
F77FormatParser.G = 11;
F77FormatParser.L = 12;
F77FormatParser.A = 13;
F77FormatParser.X = 14;
F77FormatParser.T = 15;
F77FormatParser.P = 16;
F77FormatParser.S = 17;
F77FormatParser.ICON = 18;
F77FormatParser.SCON = 19;
F77FormatParser.LPAREN = 20;
F77FormatParser.RPAREN = 21;
F77FormatParser.COMMA = 22;
F77FormatParser.DOT = 23;
F77FormatParser.SLASH = 24;
F77FormatParser.COLON = 25;
F77FormatParser.PLUS = 26;
F77FormatParser.MINUS = 27;
F77FormatParser.WS = 28;

F77FormatParser.RULE_formatSpecification = 0;
F77FormatParser.RULE_formatList = 1;
F77FormatParser.RULE_formatItem = 2;
F77FormatParser.RULE_dataEdit = 3;

class FormatSpecificationContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = F77FormatParser.RULE_formatSpecification;
    }

	LPAREN() {
	    return this.getToken(F77FormatParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(F77FormatParser.RPAREN, 0);
	};

	EOF() {
	    return this.getToken(F77FormatParser.EOF, 0);
	};

	formatList() {
	    return this.getTypedRuleContext(FormatListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitFormatSpecification(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FormatListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = F77FormatParser.RULE_formatList;
    }

	formatItem = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FormatItemContext);
	    } else {
	        return this.getTypedRuleContext(FormatItemContext,i);
	    }
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(F77FormatParser.COMMA);
	    } else {
	        return this.getToken(F77FormatParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitFormatList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FormatItemContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = F77FormatParser.RULE_formatItem;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class DataItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	dataEdit() {
	    return this.getTypedRuleContext(DataEditContext,0);
	};

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitDataItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.DataItemContext = DataItemContext;

class ScaleItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	P() {
	    return this.getToken(F77FormatParser.P, 0);
	};

	PLUS() {
	    return this.getToken(F77FormatParser.PLUS, 0);
	};

	MINUS() {
	    return this.getToken(F77FormatParser.MINUS, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitScaleItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.ScaleItemContext = ScaleItemContext;

class SlashItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	SLASH() {
	    return this.getToken(F77FormatParser.SLASH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitSlashItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.SlashItemContext = SlashItemContext;

class GroupItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	LPAREN() {
	    return this.getToken(F77FormatParser.LPAREN, 0);
	};

	formatList() {
	    return this.getTypedRuleContext(FormatListContext,0);
	};

	RPAREN() {
	    return this.getToken(F77FormatParser.RPAREN, 0);
	};

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitGroupItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.GroupItemContext = GroupItemContext;

class ColonItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	COLON() {
	    return this.getToken(F77FormatParser.COLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitColonItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.ColonItemContext = ColonItemContext;

class LiteralItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	SCON() {
	    return this.getToken(F77FormatParser.SCON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitLiteralItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.LiteralItemContext = LiteralItemContext;

class TabItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	T() {
	    return this.getToken(F77FormatParser.T, 0);
	};

	TL() {
	    return this.getToken(F77FormatParser.TL, 0);
	};

	TR() {
	    return this.getToken(F77FormatParser.TR, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitTabItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.TabItemContext = TabItemContext;

class SkipItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	X() {
	    return this.getToken(F77FormatParser.X, 0);
	};

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitSkipItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.SkipItemContext = SkipItemContext;

class SignItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	S() {
	    return this.getToken(F77FormatParser.S, 0);
	};

	SP() {
	    return this.getToken(F77FormatParser.SP, 0);
	};

	SS() {
	    return this.getToken(F77FormatParser.SS, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitSignItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.SignItemContext = SignItemContext;

class BlankItemContext extends FormatItemContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	BN() {
	    return this.getToken(F77FormatParser.BN, 0);
	};

	BZ() {
	    return this.getToken(F77FormatParser.BZ, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitBlankItem(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.BlankItemContext = BlankItemContext;

class DataEditContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = F77FormatParser.RULE_dataEdit;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class FixedEditContext extends DataEditContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	F() {
	    return this.getToken(F77FormatParser.F, 0);
	};

	ICON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(F77FormatParser.ICON);
	    } else {
	        return this.getToken(F77FormatParser.ICON, i);
	    }
	};


	DOT() {
	    return this.getToken(F77FormatParser.DOT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitFixedEdit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.FixedEditContext = FixedEditContext;

class LogicalEditContext extends DataEditContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	L() {
	    return this.getToken(F77FormatParser.L, 0);
	};

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitLogicalEdit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.LogicalEditContext = LogicalEditContext;

class CharacterEditContext extends DataEditContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	A() {
	    return this.getToken(F77FormatParser.A, 0);
	};

	ICON() {
	    return this.getToken(F77FormatParser.ICON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitCharacterEdit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.CharacterEditContext = CharacterEditContext;

class IntegerEditContext extends DataEditContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	I() {
	    return this.getToken(F77FormatParser.I, 0);
	};

	ICON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(F77FormatParser.ICON);
	    } else {
	        return this.getToken(F77FormatParser.ICON, i);
	    }
	};


	DOT() {
	    return this.getToken(F77FormatParser.DOT, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitIntegerEdit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.IntegerEditContext = IntegerEditContext;

class ExponentEditContext extends DataEditContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	ICON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(F77FormatParser.ICON);
	    } else {
	        return this.getToken(F77FormatParser.ICON, i);
	    }
	};


	DOT() {
	    return this.getToken(F77FormatParser.DOT, 0);
	};

	E = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(F77FormatParser.E);
	    } else {
	        return this.getToken(F77FormatParser.E, i);
	    }
	};


	D() {
	    return this.getToken(F77FormatParser.D, 0);
	};

	G() {
	    return this.getToken(F77FormatParser.G, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof F77FormatVisitor ) {
	        return visitor.visitExponentEdit(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}

F77FormatParser.ExponentEditContext = ExponentEditContext;


F77FormatParser.FormatSpecificationContext = FormatSpecificationContext; 
F77FormatParser.FormatListContext = FormatListContext; 
F77FormatParser.FormatItemContext = FormatItemContext; 
F77FormatParser.DataEditContext = DataEditContext; 
