// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/WorkflowDsl.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import WorkflowDslVisitor from './WorkflowDslVisitor.js';

const serializedATN = [4,1,68,183,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,1,0,5,0,30,8,0,10,0,12,0,33,9,0,1,0,1,0,1,1,1,1,1,1,1,1,3,1,41,
8,1,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,3,2,51,8,2,1,2,1,2,1,3,1,3,1,3,1,3,1,
3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,5,1,5,1,5,1,5,5,5,71,8,5,10,5,12,5,74,9,
5,1,5,1,5,1,5,1,6,1,6,3,6,81,8,6,1,7,1,7,1,7,1,7,1,7,1,8,4,8,89,8,8,11,8,
12,8,90,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,
1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,
1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,1,9,3,9,141,8,9,1,10,
1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,3,10,153,8,10,1,10,1,10,1,10,
1,11,1,11,5,11,160,8,11,10,11,12,11,163,9,11,1,11,1,11,1,11,3,11,168,8,11,
1,12,1,12,1,12,1,12,5,12,174,8,12,10,12,12,12,177,9,12,1,12,1,12,1,13,1,
13,1,13,0,0,14,0,2,4,6,8,10,12,14,16,18,20,22,24,26,0,1,1,0,51,52,228,0,
31,1,0,0,0,2,40,1,0,0,0,4,42,1,0,0,0,6,54,1,0,0,0,8,60,1,0,0,0,10,66,1,0,
0,0,12,80,1,0,0,0,14,82,1,0,0,0,16,88,1,0,0,0,18,140,1,0,0,0,20,142,1,0,
0,0,22,167,1,0,0,0,24,169,1,0,0,0,26,180,1,0,0,0,28,30,3,2,1,0,29,28,1,0,
0,0,30,33,1,0,0,0,31,29,1,0,0,0,31,32,1,0,0,0,32,34,1,0,0,0,33,31,1,0,0,
0,34,35,5,0,0,1,35,1,1,0,0,0,36,41,3,4,2,0,37,41,3,6,3,0,38,41,3,8,4,0,39,
41,3,10,5,0,40,36,1,0,0,0,40,37,1,0,0,0,40,38,1,0,0,0,40,39,1,0,0,0,41,3,
1,0,0,0,42,43,5,1,0,0,43,44,3,26,13,0,44,45,5,56,0,0,45,50,3,26,13,0,46,
47,5,26,0,0,47,51,3,26,13,0,48,49,5,27,0,0,49,51,3,24,12,0,50,46,1,0,0,0,
50,48,1,0,0,0,50,51,1,0,0,0,51,52,1,0,0,0,52,53,5,61,0,0,53,5,1,0,0,0,54,
55,5,2,0,0,55,56,3,26,13,0,56,57,5,56,0,0,57,58,3,26,13,0,58,59,5,61,0,0,
59,7,1,0,0,0,60,61,5,3,0,0,61,62,3,26,13,0,62,63,5,4,0,0,63,64,3,26,13,0,
64,65,5,61,0,0,65,9,1,0,0,0,66,67,5,5,0,0,67,68,3,26,13,0,68,72,5,6,0,0,
69,71,3,12,6,0,70,69,1,0,0,0,71,74,1,0,0,0,72,70,1,0,0,0,72,73,1,0,0,0,73,
75,1,0,0,0,74,72,1,0,0,0,75,76,5,7,0,0,76,77,5,61,0,0,77,11,1,0,0,0,78,81,
3,14,7,0,79,81,3,20,10,0,80,78,1,0,0,0,80,79,1,0,0,0,81,13,1,0,0,0,82,83,
5,8,0,0,83,84,3,26,13,0,84,85,3,16,8,0,85,86,5,61,0,0,86,15,1,0,0,0,87,89,
3,18,9,0,88,87,1,0,0,0,89,90,1,0,0,0,90,88,1,0,0,0,90,91,1,0,0,0,91,17,1,
0,0,0,92,141,3,26,13,0,93,141,5,63,0,0,94,141,5,64,0,0,95,141,5,58,0,0,96,
141,5,59,0,0,97,141,5,60,0,0,98,141,5,57,0,0,99,141,5,9,0,0,100,141,5,3,
0,0,101,141,5,10,0,0,102,141,5,1,0,0,103,141,5,11,0,0,104,141,5,12,0,0,105,
141,5,13,0,0,106,141,5,14,0,0,107,141,5,15,0,0,108,141,5,16,0,0,109,141,
5,17,0,0,110,141,5,18,0,0,111,141,5,19,0,0,112,141,5,20,0,0,113,141,5,21,
0,0,114,141,5,22,0,0,115,141,5,23,0,0,116,141,5,24,0,0,117,141,5,25,0,0,
118,141,5,26,0,0,119,141,5,28,0,0,120,141,5,29,0,0,121,141,5,30,0,0,122,
141,5,31,0,0,123,141,5,32,0,0,124,141,5,33,0,0,125,141,5,34,0,0,126,141,
5,35,0,0,127,141,5,36,0,0,128,141,5,37,0,0,129,141,5,38,0,0,130,141,5,39,
0,0,131,141,5,40,0,0,132,141,5,41,0,0,133,141,5,42,0,0,134,141,5,43,0,0,
135,141,5,44,0,0,136,141,5,45,0,0,137,141,5,46,0,0,138,141,5,47,0,0,139,
141,5,48,0,0,140,92,1,0,0,0,140,93,1,0,0,0,140,94,1,0,0,0,140,95,1,0,0,0,
140,96,1,0,0,0,140,97,1,0,0,0,140,98,1,0,0,0,140,99,1,0,0,0,140,100,1,0,
0,0,140,101,1,0,0,0,140,102,1,0,0,0,140,103,1,0,0,0,140,104,1,0,0,0,140,
105,1,0,0,0,140,106,1,0,0,0,140,107,1,0,0,0,140,108,1,0,0,0,140,109,1,0,
0,0,140,110,1,0,0,0,140,111,1,0,0,0,140,112,1,0,0,0,140,113,1,0,0,0,140,
114,1,0,0,0,140,115,1,0,0,0,140,116,1,0,0,0,140,117,1,0,0,0,140,118,1,0,
0,0,140,119,1,0,0,0,140,120,1,0,0,0,140,121,1,0,0,0,140,122,1,0,0,0,140,
123,1,0,0,0,140,124,1,0,0,0,140,125,1,0,0,0,140,126,1,0,0,0,140,127,1,0,
0,0,140,128,1,0,0,0,140,129,1,0,0,0,140,130,1,0,0,0,140,131,1,0,0,0,140,
132,1,0,0,0,140,133,1,0,0,0,140,134,1,0,0,0,140,135,1,0,0,0,140,136,1,0,
0,0,140,137,1,0,0,0,140,138,1,0,0,0,140,139,1,0,0,0,141,19,1,0,0,0,142,143,
5,49,0,0,143,144,5,50,0,0,144,145,3,26,13,0,145,146,7,0,0,0,146,147,3,26,
13,0,147,148,5,53,0,0,148,152,3,22,11,0,149,150,5,54,0,0,150,151,5,61,0,
0,151,153,3,22,11,0,152,149,1,0,0,0,152,153,1,0,0,0,153,154,1,0,0,0,154,
155,5,55,0,0,155,156,5,61,0,0,156,21,1,0,0,0,157,161,5,6,0,0,158,160,3,12,
6,0,159,158,1,0,0,0,160,163,1,0,0,0,161,159,1,0,0,0,161,162,1,0,0,0,162,
164,1,0,0,0,163,161,1,0,0,0,164,165,5,7,0,0,165,168,5,61,0,0,166,168,3,14,
7,0,167,157,1,0,0,0,167,166,1,0,0,0,168,23,1,0,0,0,169,170,5,58,0,0,170,
175,3,26,13,0,171,172,5,60,0,0,172,174,3,26,13,0,173,171,1,0,0,0,174,177,
1,0,0,0,175,173,1,0,0,0,175,176,1,0,0,0,176,178,1,0,0,0,177,175,1,0,0,0,
178,179,5,59,0,0,179,25,1,0,0,0,180,181,5,62,0,0,181,27,1,0,0,0,11,31,40,
50,72,80,90,140,152,161,167,175];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class WorkflowDslParser extends antlr4.Parser {

    static grammarFileName = "WorkflowDsl.g4";
    static literalNames = [ null, "'QUEUE'", "'FILE'", "'API'", "'BASE'", 
                            "'WORKFLOW'", "'BEGIN'", "'END'", "'STEP'", 
                            "'CALL'", "'ROUTE'", "'SET'", "'STATE'", "'WAIT'", 
                            "'CHECK'", "'EXPECT'", "'RETRIES'", "'EVERY'", 
                            "'ISSUE'", "'CREATE'", "'TITLE'", "'DESCRIPTION'", 
                            "'PRIORITY'", "'ASSIGN'", "'USER'", "'REPORTER'", 
                            "'TYPE'", "'TYPES'", "'INTO'", "'TESTCASE'", 
                            "'TESTPLAN'", "'PLAN'", "'LINK'", "'TO'", "'ADD'", 
                            "'PROJECT'", "'RELEASE'", "'FOR'", "'DEPLOYMENT'", 
                            "'ARTIFACT'", "'LOCATION'", "'PROJECTPLAN'", 
                            "'MILESTONE'", "'DUE'", "'DATE'", "'TASK'", 
                            "'SYNCHPOINT'", "'DELIVERABLE'", "'RESOURCE'", 
                            "'IF'", "'FIELD'", "'EQUALS'", "'CONTAINS'", 
                            "'THEN'", "'ELSE'", "'ENDIF'", "'->'", "'='", 
                            "'('", "')'", "','", "';'" ];
    static symbolicNames = [ null, "QUEUE", "FILE", "API", "BASE", "WORKFLOW", 
                             "BEGIN", "END", "STEP", "CALL", "ROUTE", "SET", 
                             "STATE", "WAIT", "CHECK", "EXPECT", "RETRIES", 
                             "EVERY", "ISSUE", "CREATE", "TITLE", "DESCRIPTION", 
                             "PRIORITY", "ASSIGN", "USER", "REPORTER", "TYPE", 
                             "TYPES", "INTO", "TESTCASE", "TESTPLAN", "PLAN", 
                             "LINK", "TO", "ADD", "PROJECT", "RELEASE", 
                             "FOR", "DEPLOYMENT", "ARTIFACT", "LOCATION", 
                             "PROJECTPLAN", "MILESTONE", "DUE", "DATE", 
                             "TASK", "SYNCHPOINT", "DELIVERABLE", "RESOURCE", 
                             "IF", "FIELD", "EQUALS", "CONTAINS", "THEN", 
                             "ELSE", "ENDIF", "ARROW", "ASSIGN_EQ", "LPAREN", 
                             "RPAREN", "COMMA", "SEMICOLON", "STRING", "NUMBER", 
                             "IDENT", "HASH_COMMENT", "SLASH_COMMENT", "DASH_COMMENT", 
                             "WS" ];
    static ruleNames = [ "program", "item", "queueDecl", "fileDecl", "apiDecl", 
                         "workflowDecl", "workflowStmt", "stepStmt", "stepBody", 
                         "stepToken", "ifStmt", "branch", "quotedList", 
                         "quotedString" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = WorkflowDslParser.ruleNames;
        this.literalNames = WorkflowDslParser.literalNames;
        this.symbolicNames = WorkflowDslParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, WorkflowDslParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 31;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 46) !== 0)) {
	            this.state = 28;
	            this.item();
	            this.state = 33;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 34;
	        this.match(WorkflowDslParser.EOF);
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
	    this.enterRule(localctx, 2, WorkflowDslParser.RULE_item);
	    try {
	        this.state = 40;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 36;
	            this.queueDecl();
	            break;
	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 37;
	            this.fileDecl();
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 38;
	            this.apiDecl();
	            break;
	        case 5:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 39;
	            this.workflowDecl();
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



	queueDecl() {
	    let localctx = new QueueDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, WorkflowDslParser.RULE_queueDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 42;
	        this.match(WorkflowDslParser.QUEUE);
	        this.state = 43;
	        this.quotedString();
	        this.state = 44;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 45;
	        this.quotedString();
	        this.state = 50;
	        this._errHandler.sync(this);
	        switch (this._input.LA(1)) {
	        case 26:
	        	this.state = 46;
	        	this.match(WorkflowDslParser.TYPE);
	        	this.state = 47;
	        	this.quotedString();
	        	break;
	        case 27:
	        	this.state = 48;
	        	this.match(WorkflowDslParser.TYPES);
	        	this.state = 49;
	        	this.quotedList();
	        	break;
	        case 61:
	        	break;
	        default:
	        	break;
	        }
	        this.state = 52;
	        this.match(WorkflowDslParser.SEMICOLON);
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
	    this.enterRule(localctx, 6, WorkflowDslParser.RULE_fileDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 54;
	        this.match(WorkflowDslParser.FILE);
	        this.state = 55;
	        this.quotedString();
	        this.state = 56;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 57;
	        this.quotedString();
	        this.state = 58;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	apiDecl() {
	    let localctx = new ApiDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, WorkflowDslParser.RULE_apiDecl);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 60;
	        this.match(WorkflowDslParser.API);
	        this.state = 61;
	        this.quotedString();
	        this.state = 62;
	        this.match(WorkflowDslParser.BASE);
	        this.state = 63;
	        this.quotedString();
	        this.state = 64;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	workflowDecl() {
	    let localctx = new WorkflowDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, WorkflowDslParser.RULE_workflowDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 66;
	        this.match(WorkflowDslParser.WORKFLOW);
	        this.state = 67;
	        this.quotedString();
	        this.state = 68;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 72;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8 || _la===49) {
	            this.state = 69;
	            this.workflowStmt();
	            this.state = 74;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 75;
	        this.match(WorkflowDslParser.END);
	        this.state = 76;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	workflowStmt() {
	    let localctx = new WorkflowStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, WorkflowDslParser.RULE_workflowStmt);
	    try {
	        this.state = 80;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 8:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 78;
	            this.stepStmt();
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 79;
	            this.ifStmt();
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



	stepStmt() {
	    let localctx = new StepStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, WorkflowDslParser.RULE_stepStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 82;
	        this.match(WorkflowDslParser.STEP);
	        this.state = 83;
	        this.quotedString();
	        this.state = 84;
	        this.stepBody();
	        this.state = 85;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	stepBody() {
	    let localctx = new StepBodyContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, WorkflowDslParser.RULE_stepBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 88; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 87;
	            this.stepToken();
	            this.state = 90; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(((((_la - 1)) & ~0x1f) === 0 && ((1 << (_la - 1)) & 4227858181) !== 0) || ((((_la - 33)) & ~0x1f) === 0 && ((1 << (_la - 33)) & 4009820159) !== 0));
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



	stepToken() {
	    let localctx = new StepTokenContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, WorkflowDslParser.RULE_stepToken);
	    try {
	        this.state = 140;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 62:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 92;
	            this.quotedString();
	            break;
	        case 63:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 93;
	            this.match(WorkflowDslParser.NUMBER);
	            break;
	        case 64:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 94;
	            this.match(WorkflowDslParser.IDENT);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 95;
	            this.match(WorkflowDslParser.LPAREN);
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 96;
	            this.match(WorkflowDslParser.RPAREN);
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 97;
	            this.match(WorkflowDslParser.COMMA);
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 98;
	            this.match(WorkflowDslParser.ASSIGN_EQ);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 99;
	            this.match(WorkflowDslParser.CALL);
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 100;
	            this.match(WorkflowDslParser.API);
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 101;
	            this.match(WorkflowDslParser.ROUTE);
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 102;
	            this.match(WorkflowDslParser.QUEUE);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 103;
	            this.match(WorkflowDslParser.SET);
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 104;
	            this.match(WorkflowDslParser.STATE);
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 105;
	            this.match(WorkflowDslParser.WAIT);
	            break;
	        case 14:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 106;
	            this.match(WorkflowDslParser.CHECK);
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 107;
	            this.match(WorkflowDslParser.EXPECT);
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 108;
	            this.match(WorkflowDslParser.RETRIES);
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 109;
	            this.match(WorkflowDslParser.EVERY);
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 110;
	            this.match(WorkflowDslParser.ISSUE);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 111;
	            this.match(WorkflowDslParser.CREATE);
	            break;
	        case 20:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 112;
	            this.match(WorkflowDslParser.TITLE);
	            break;
	        case 21:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 113;
	            this.match(WorkflowDslParser.DESCRIPTION);
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 114;
	            this.match(WorkflowDslParser.PRIORITY);
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 115;
	            this.match(WorkflowDslParser.ASSIGN);
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 116;
	            this.match(WorkflowDslParser.USER);
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 117;
	            this.match(WorkflowDslParser.REPORTER);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 118;
	            this.match(WorkflowDslParser.TYPE);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 119;
	            this.match(WorkflowDslParser.INTO);
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 120;
	            this.match(WorkflowDslParser.TESTCASE);
	            break;
	        case 30:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 121;
	            this.match(WorkflowDslParser.TESTPLAN);
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 122;
	            this.match(WorkflowDslParser.PLAN);
	            break;
	        case 32:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 123;
	            this.match(WorkflowDslParser.LINK);
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 124;
	            this.match(WorkflowDslParser.TO);
	            break;
	        case 34:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 125;
	            this.match(WorkflowDslParser.ADD);
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 126;
	            this.match(WorkflowDslParser.PROJECT);
	            break;
	        case 36:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 127;
	            this.match(WorkflowDslParser.RELEASE);
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 128;
	            this.match(WorkflowDslParser.FOR);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 129;
	            this.match(WorkflowDslParser.DEPLOYMENT);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 130;
	            this.match(WorkflowDslParser.ARTIFACT);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 131;
	            this.match(WorkflowDslParser.LOCATION);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 132;
	            this.match(WorkflowDslParser.PROJECTPLAN);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 133;
	            this.match(WorkflowDslParser.MILESTONE);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 43);
	            this.state = 134;
	            this.match(WorkflowDslParser.DUE);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 44);
	            this.state = 135;
	            this.match(WorkflowDslParser.DATE);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 45);
	            this.state = 136;
	            this.match(WorkflowDslParser.TASK);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 46);
	            this.state = 137;
	            this.match(WorkflowDslParser.SYNCHPOINT);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 47);
	            this.state = 138;
	            this.match(WorkflowDslParser.DELIVERABLE);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 48);
	            this.state = 139;
	            this.match(WorkflowDslParser.RESOURCE);
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



	ifStmt() {
	    let localctx = new IfStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, WorkflowDslParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 142;
	        this.match(WorkflowDslParser.IF);
	        this.state = 143;
	        this.match(WorkflowDslParser.FIELD);
	        this.state = 144;
	        this.quotedString();
	        this.state = 145;
	        _la = this._input.LA(1);
	        if(!(_la===51 || _la===52)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 146;
	        this.quotedString();
	        this.state = 147;
	        this.match(WorkflowDslParser.THEN);
	        this.state = 148;
	        this.branch();
	        this.state = 152;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===54) {
	            this.state = 149;
	            this.match(WorkflowDslParser.ELSE);
	            this.state = 150;
	            this.match(WorkflowDslParser.SEMICOLON);
	            this.state = 151;
	            this.branch();
	        }

	        this.state = 154;
	        this.match(WorkflowDslParser.ENDIF);
	        this.state = 155;
	        this.match(WorkflowDslParser.SEMICOLON);
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



	branch() {
	    let localctx = new BranchContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, WorkflowDslParser.RULE_branch);
	    var _la = 0;
	    try {
	        this.state = 167;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 6:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 157;
	            this.match(WorkflowDslParser.BEGIN);
	            this.state = 161;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===8 || _la===49) {
	                this.state = 158;
	                this.workflowStmt();
	                this.state = 163;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 164;
	            this.match(WorkflowDslParser.END);
	            this.state = 165;
	            this.match(WorkflowDslParser.SEMICOLON);
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 166;
	            this.stepStmt();
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



	quotedList() {
	    let localctx = new QuotedListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, WorkflowDslParser.RULE_quotedList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 169;
	        this.match(WorkflowDslParser.LPAREN);
	        this.state = 170;
	        this.quotedString();
	        this.state = 175;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===60) {
	            this.state = 171;
	            this.match(WorkflowDslParser.COMMA);
	            this.state = 172;
	            this.quotedString();
	            this.state = 177;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 178;
	        this.match(WorkflowDslParser.RPAREN);
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



	quotedString() {
	    let localctx = new QuotedStringContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, WorkflowDslParser.RULE_quotedString);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 180;
	        this.match(WorkflowDslParser.STRING);
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

WorkflowDslParser.EOF = antlr4.Token.EOF;
WorkflowDslParser.QUEUE = 1;
WorkflowDslParser.FILE = 2;
WorkflowDslParser.API = 3;
WorkflowDslParser.BASE = 4;
WorkflowDslParser.WORKFLOW = 5;
WorkflowDslParser.BEGIN = 6;
WorkflowDslParser.END = 7;
WorkflowDslParser.STEP = 8;
WorkflowDslParser.CALL = 9;
WorkflowDslParser.ROUTE = 10;
WorkflowDslParser.SET = 11;
WorkflowDslParser.STATE = 12;
WorkflowDslParser.WAIT = 13;
WorkflowDslParser.CHECK = 14;
WorkflowDslParser.EXPECT = 15;
WorkflowDslParser.RETRIES = 16;
WorkflowDslParser.EVERY = 17;
WorkflowDslParser.ISSUE = 18;
WorkflowDslParser.CREATE = 19;
WorkflowDslParser.TITLE = 20;
WorkflowDslParser.DESCRIPTION = 21;
WorkflowDslParser.PRIORITY = 22;
WorkflowDslParser.ASSIGN = 23;
WorkflowDslParser.USER = 24;
WorkflowDslParser.REPORTER = 25;
WorkflowDslParser.TYPE = 26;
WorkflowDslParser.TYPES = 27;
WorkflowDslParser.INTO = 28;
WorkflowDslParser.TESTCASE = 29;
WorkflowDslParser.TESTPLAN = 30;
WorkflowDslParser.PLAN = 31;
WorkflowDslParser.LINK = 32;
WorkflowDslParser.TO = 33;
WorkflowDslParser.ADD = 34;
WorkflowDslParser.PROJECT = 35;
WorkflowDslParser.RELEASE = 36;
WorkflowDslParser.FOR = 37;
WorkflowDslParser.DEPLOYMENT = 38;
WorkflowDslParser.ARTIFACT = 39;
WorkflowDslParser.LOCATION = 40;
WorkflowDslParser.PROJECTPLAN = 41;
WorkflowDslParser.MILESTONE = 42;
WorkflowDslParser.DUE = 43;
WorkflowDslParser.DATE = 44;
WorkflowDslParser.TASK = 45;
WorkflowDslParser.SYNCHPOINT = 46;
WorkflowDslParser.DELIVERABLE = 47;
WorkflowDslParser.RESOURCE = 48;
WorkflowDslParser.IF = 49;
WorkflowDslParser.FIELD = 50;
WorkflowDslParser.EQUALS = 51;
WorkflowDslParser.CONTAINS = 52;
WorkflowDslParser.THEN = 53;
WorkflowDslParser.ELSE = 54;
WorkflowDslParser.ENDIF = 55;
WorkflowDslParser.ARROW = 56;
WorkflowDslParser.ASSIGN_EQ = 57;
WorkflowDslParser.LPAREN = 58;
WorkflowDslParser.RPAREN = 59;
WorkflowDslParser.COMMA = 60;
WorkflowDslParser.SEMICOLON = 61;
WorkflowDslParser.STRING = 62;
WorkflowDslParser.NUMBER = 63;
WorkflowDslParser.IDENT = 64;
WorkflowDslParser.HASH_COMMENT = 65;
WorkflowDslParser.SLASH_COMMENT = 66;
WorkflowDslParser.DASH_COMMENT = 67;
WorkflowDslParser.WS = 68;

WorkflowDslParser.RULE_program = 0;
WorkflowDslParser.RULE_item = 1;
WorkflowDslParser.RULE_queueDecl = 2;
WorkflowDslParser.RULE_fileDecl = 3;
WorkflowDslParser.RULE_apiDecl = 4;
WorkflowDslParser.RULE_workflowDecl = 5;
WorkflowDslParser.RULE_workflowStmt = 6;
WorkflowDslParser.RULE_stepStmt = 7;
WorkflowDslParser.RULE_stepBody = 8;
WorkflowDslParser.RULE_stepToken = 9;
WorkflowDslParser.RULE_ifStmt = 10;
WorkflowDslParser.RULE_branch = 11;
WorkflowDslParser.RULE_quotedList = 12;
WorkflowDslParser.RULE_quotedString = 13;

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
        this.ruleIndex = WorkflowDslParser.RULE_program;
    }

	EOF() {
	    return this.getToken(WorkflowDslParser.EOF, 0);
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

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
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
        this.ruleIndex = WorkflowDslParser.RULE_item;
    }

	queueDecl() {
	    return this.getTypedRuleContext(QueueDeclContext,0);
	};

	fileDecl() {
	    return this.getTypedRuleContext(FileDeclContext,0);
	};

	apiDecl() {
	    return this.getTypedRuleContext(ApiDeclContext,0);
	};

	workflowDecl() {
	    return this.getTypedRuleContext(WorkflowDeclContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitItem(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_queueDecl;
    }

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	TYPES() {
	    return this.getToken(WorkflowDslParser.TYPES, 0);
	};

	quotedList() {
	    return this.getTypedRuleContext(QuotedListContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQueueDecl(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_fileDecl;
    }

	FILE() {
	    return this.getToken(WorkflowDslParser.FILE, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	ARROW() {
	    return this.getToken(WorkflowDslParser.ARROW, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitFileDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ApiDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_apiDecl;
    }

	API() {
	    return this.getToken(WorkflowDslParser.API, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	BASE() {
	    return this.getToken(WorkflowDslParser.BASE, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitApiDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WorkflowDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_workflowDecl;
    }

	WORKFLOW() {
	    return this.getToken(WorkflowDslParser.WORKFLOW, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitWorkflowDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class WorkflowStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_workflowStmt;
    }

	stepStmt() {
	    return this.getTypedRuleContext(StepStmtContext,0);
	};

	ifStmt() {
	    return this.getTypedRuleContext(IfStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitWorkflowStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepStmt;
    }

	STEP() {
	    return this.getToken(WorkflowDslParser.STEP, 0);
	};

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	stepBody() {
	    return this.getTypedRuleContext(StepBodyContext,0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepBodyContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepBody;
    }

	stepToken = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StepTokenContext);
	    } else {
	        return this.getTypedRuleContext(StepTokenContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepBody(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StepTokenContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_stepToken;
    }

	quotedString() {
	    return this.getTypedRuleContext(QuotedStringContext,0);
	};

	NUMBER() {
	    return this.getToken(WorkflowDslParser.NUMBER, 0);
	};

	IDENT() {
	    return this.getToken(WorkflowDslParser.IDENT, 0);
	};

	LPAREN() {
	    return this.getToken(WorkflowDslParser.LPAREN, 0);
	};

	RPAREN() {
	    return this.getToken(WorkflowDslParser.RPAREN, 0);
	};

	COMMA() {
	    return this.getToken(WorkflowDslParser.COMMA, 0);
	};

	ASSIGN_EQ() {
	    return this.getToken(WorkflowDslParser.ASSIGN_EQ, 0);
	};

	CALL() {
	    return this.getToken(WorkflowDslParser.CALL, 0);
	};

	API() {
	    return this.getToken(WorkflowDslParser.API, 0);
	};

	ROUTE() {
	    return this.getToken(WorkflowDslParser.ROUTE, 0);
	};

	QUEUE() {
	    return this.getToken(WorkflowDslParser.QUEUE, 0);
	};

	SET() {
	    return this.getToken(WorkflowDslParser.SET, 0);
	};

	STATE() {
	    return this.getToken(WorkflowDslParser.STATE, 0);
	};

	WAIT() {
	    return this.getToken(WorkflowDslParser.WAIT, 0);
	};

	CHECK() {
	    return this.getToken(WorkflowDslParser.CHECK, 0);
	};

	EXPECT() {
	    return this.getToken(WorkflowDslParser.EXPECT, 0);
	};

	RETRIES() {
	    return this.getToken(WorkflowDslParser.RETRIES, 0);
	};

	EVERY() {
	    return this.getToken(WorkflowDslParser.EVERY, 0);
	};

	ISSUE() {
	    return this.getToken(WorkflowDslParser.ISSUE, 0);
	};

	CREATE() {
	    return this.getToken(WorkflowDslParser.CREATE, 0);
	};

	TITLE() {
	    return this.getToken(WorkflowDslParser.TITLE, 0);
	};

	DESCRIPTION() {
	    return this.getToken(WorkflowDslParser.DESCRIPTION, 0);
	};

	PRIORITY() {
	    return this.getToken(WorkflowDslParser.PRIORITY, 0);
	};

	ASSIGN() {
	    return this.getToken(WorkflowDslParser.ASSIGN, 0);
	};

	USER() {
	    return this.getToken(WorkflowDslParser.USER, 0);
	};

	REPORTER() {
	    return this.getToken(WorkflowDslParser.REPORTER, 0);
	};

	TYPE() {
	    return this.getToken(WorkflowDslParser.TYPE, 0);
	};

	INTO() {
	    return this.getToken(WorkflowDslParser.INTO, 0);
	};

	TESTCASE() {
	    return this.getToken(WorkflowDslParser.TESTCASE, 0);
	};

	TESTPLAN() {
	    return this.getToken(WorkflowDslParser.TESTPLAN, 0);
	};

	PLAN() {
	    return this.getToken(WorkflowDslParser.PLAN, 0);
	};

	LINK() {
	    return this.getToken(WorkflowDslParser.LINK, 0);
	};

	TO() {
	    return this.getToken(WorkflowDslParser.TO, 0);
	};

	ADD() {
	    return this.getToken(WorkflowDslParser.ADD, 0);
	};

	PROJECT() {
	    return this.getToken(WorkflowDslParser.PROJECT, 0);
	};

	RELEASE() {
	    return this.getToken(WorkflowDslParser.RELEASE, 0);
	};

	FOR() {
	    return this.getToken(WorkflowDslParser.FOR, 0);
	};

	DEPLOYMENT() {
	    return this.getToken(WorkflowDslParser.DEPLOYMENT, 0);
	};

	ARTIFACT() {
	    return this.getToken(WorkflowDslParser.ARTIFACT, 0);
	};

	LOCATION() {
	    return this.getToken(WorkflowDslParser.LOCATION, 0);
	};

	PROJECTPLAN() {
	    return this.getToken(WorkflowDslParser.PROJECTPLAN, 0);
	};

	MILESTONE() {
	    return this.getToken(WorkflowDslParser.MILESTONE, 0);
	};

	DUE() {
	    return this.getToken(WorkflowDslParser.DUE, 0);
	};

	DATE() {
	    return this.getToken(WorkflowDslParser.DATE, 0);
	};

	TASK() {
	    return this.getToken(WorkflowDslParser.TASK, 0);
	};

	SYNCHPOINT() {
	    return this.getToken(WorkflowDslParser.SYNCHPOINT, 0);
	};

	DELIVERABLE() {
	    return this.getToken(WorkflowDslParser.DELIVERABLE, 0);
	};

	RESOURCE() {
	    return this.getToken(WorkflowDslParser.RESOURCE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitStepToken(this);
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
        this.ruleIndex = WorkflowDslParser.RULE_ifStmt;
    }

	IF() {
	    return this.getToken(WorkflowDslParser.IF, 0);
	};

	FIELD() {
	    return this.getToken(WorkflowDslParser.FIELD, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	THEN() {
	    return this.getToken(WorkflowDslParser.THEN, 0);
	};

	branch = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(BranchContext);
	    } else {
	        return this.getTypedRuleContext(BranchContext,i);
	    }
	};

	ENDIF() {
	    return this.getToken(WorkflowDslParser.ENDIF, 0);
	};

	SEMICOLON = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.SEMICOLON);
	    } else {
	        return this.getToken(WorkflowDslParser.SEMICOLON, i);
	    }
	};


	EQUALS() {
	    return this.getToken(WorkflowDslParser.EQUALS, 0);
	};

	CONTAINS() {
	    return this.getToken(WorkflowDslParser.CONTAINS, 0);
	};

	ELSE() {
	    return this.getToken(WorkflowDslParser.ELSE, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitIfStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class BranchContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_branch;
    }

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	END() {
	    return this.getToken(WorkflowDslParser.END, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	workflowStmt = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(WorkflowStmtContext);
	    } else {
	        return this.getTypedRuleContext(WorkflowStmtContext,i);
	    }
	};

	stepStmt() {
	    return this.getTypedRuleContext(StepStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitBranch(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QuotedListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_quotedList;
    }

	LPAREN() {
	    return this.getToken(WorkflowDslParser.LPAREN, 0);
	};

	quotedString = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(QuotedStringContext);
	    } else {
	        return this.getTypedRuleContext(QuotedStringContext,i);
	    }
	};

	RPAREN() {
	    return this.getToken(WorkflowDslParser.RPAREN, 0);
	};

	COMMA = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.COMMA);
	    } else {
	        return this.getToken(WorkflowDslParser.COMMA, i);
	    }
	};


	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQuotedList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class QuotedStringContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_quotedString;
    }

	STRING() {
	    return this.getToken(WorkflowDslParser.STRING, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitQuotedString(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




WorkflowDslParser.ProgramContext = ProgramContext; 
WorkflowDslParser.ItemContext = ItemContext; 
WorkflowDslParser.QueueDeclContext = QueueDeclContext; 
WorkflowDslParser.FileDeclContext = FileDeclContext; 
WorkflowDslParser.ApiDeclContext = ApiDeclContext; 
WorkflowDslParser.WorkflowDeclContext = WorkflowDeclContext; 
WorkflowDslParser.WorkflowStmtContext = WorkflowStmtContext; 
WorkflowDslParser.StepStmtContext = StepStmtContext; 
WorkflowDslParser.StepBodyContext = StepBodyContext; 
WorkflowDslParser.StepTokenContext = StepTokenContext; 
WorkflowDslParser.IfStmtContext = IfStmtContext; 
WorkflowDslParser.BranchContext = BranchContext; 
WorkflowDslParser.QuotedListContext = QuotedListContext; 
WorkflowDslParser.QuotedStringContext = QuotedStringContext; 
