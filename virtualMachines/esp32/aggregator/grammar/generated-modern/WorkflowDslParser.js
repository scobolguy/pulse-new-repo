// Generated from C:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/WorkflowDsl.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';
import WorkflowDslVisitor from './WorkflowDslVisitor.js';

const serializedATN = [4,1,79,261,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,1,0,5,0,38,8,0,10,0,12,
0,41,9,0,1,0,1,0,1,1,1,1,1,1,1,1,3,1,49,8,1,1,2,1,2,1,2,1,2,1,2,1,2,1,2,
1,2,3,2,59,8,2,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,3,1,4,1,4,1,4,1,4,1,4,1,4,1,
5,1,5,1,5,1,5,5,5,79,8,5,10,5,12,5,82,9,5,1,5,1,5,1,5,1,6,1,6,1,6,1,6,3,
6,91,8,6,1,7,1,7,1,7,1,7,1,7,3,7,98,8,7,1,7,1,7,4,7,102,8,7,11,7,12,7,103,
1,7,1,7,1,7,1,8,1,8,1,8,1,8,3,8,113,8,8,1,9,1,9,1,9,1,9,5,9,119,8,9,10,9,
12,9,122,9,9,1,9,1,9,1,9,1,10,1,10,1,10,5,10,130,8,10,10,10,12,10,133,9,
10,1,10,1,10,1,10,1,10,5,10,139,8,10,10,10,12,10,142,9,10,1,10,3,10,145,
8,10,1,10,1,10,1,10,1,11,1,11,1,11,1,11,1,11,1,12,4,12,156,8,12,11,12,12,
12,157,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,
13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,
13,1,13,1,13,3,13,219,8,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
1,14,3,14,231,8,14,1,14,1,14,1,14,1,15,1,15,5,15,238,8,15,10,15,12,15,241,
9,15,1,15,1,15,1,15,3,15,246,8,15,1,16,1,16,1,16,1,16,5,16,252,8,16,10,16,
12,16,255,9,16,1,16,1,16,1,17,1,17,1,17,0,0,18,0,2,4,6,8,10,12,14,16,18,
20,22,24,26,28,30,32,34,0,1,1,0,62,63,322,0,39,1,0,0,0,2,48,1,0,0,0,4,50,
1,0,0,0,6,62,1,0,0,0,8,68,1,0,0,0,10,74,1,0,0,0,12,90,1,0,0,0,14,92,1,0,
0,0,16,112,1,0,0,0,18,114,1,0,0,0,20,126,1,0,0,0,22,149,1,0,0,0,24,155,1,
0,0,0,26,218,1,0,0,0,28,220,1,0,0,0,30,245,1,0,0,0,32,247,1,0,0,0,34,258,
1,0,0,0,36,38,3,2,1,0,37,36,1,0,0,0,38,41,1,0,0,0,39,37,1,0,0,0,39,40,1,
0,0,0,40,42,1,0,0,0,41,39,1,0,0,0,42,43,5,0,0,1,43,1,1,0,0,0,44,49,3,4,2,
0,45,49,3,6,3,0,46,49,3,8,4,0,47,49,3,10,5,0,48,44,1,0,0,0,48,45,1,0,0,0,
48,46,1,0,0,0,48,47,1,0,0,0,49,3,1,0,0,0,50,51,5,1,0,0,51,52,3,34,17,0,52,
53,5,67,0,0,53,58,3,34,17,0,54,55,5,26,0,0,55,59,3,34,17,0,56,57,5,27,0,
0,57,59,3,32,16,0,58,54,1,0,0,0,58,56,1,0,0,0,58,59,1,0,0,0,59,60,1,0,0,
0,60,61,5,72,0,0,61,5,1,0,0,0,62,63,5,2,0,0,63,64,3,34,17,0,64,65,5,67,0,
0,65,66,3,34,17,0,66,67,5,72,0,0,67,7,1,0,0,0,68,69,5,3,0,0,69,70,3,34,17,
0,70,71,5,4,0,0,71,72,3,34,17,0,72,73,5,72,0,0,73,9,1,0,0,0,74,75,5,5,0,
0,75,76,3,34,17,0,76,80,5,6,0,0,77,79,3,12,6,0,78,77,1,0,0,0,79,82,1,0,0,
0,80,78,1,0,0,0,80,81,1,0,0,0,81,83,1,0,0,0,82,80,1,0,0,0,83,84,5,7,0,0,
84,85,5,72,0,0,85,11,1,0,0,0,86,91,3,22,11,0,87,91,3,28,14,0,88,91,3,14,
7,0,89,91,3,20,10,0,90,86,1,0,0,0,90,87,1,0,0,0,90,88,1,0,0,0,90,89,1,0,
0,0,91,13,1,0,0,0,92,93,5,49,0,0,93,97,3,16,8,0,94,95,5,54,0,0,95,96,5,55,
0,0,96,98,5,56,0,0,97,94,1,0,0,0,97,98,1,0,0,0,98,99,1,0,0,0,99,101,5,6,
0,0,100,102,3,18,9,0,101,100,1,0,0,0,102,103,1,0,0,0,103,101,1,0,0,0,103,
104,1,0,0,0,104,105,1,0,0,0,105,106,5,50,0,0,106,107,5,72,0,0,107,15,1,0,
0,0,108,113,5,52,0,0,109,110,5,53,0,0,110,111,5,13,0,0,111,113,5,74,0,0,
112,108,1,0,0,0,112,109,1,0,0,0,113,17,1,0,0,0,114,115,5,51,0,0,115,116,
3,34,17,0,116,120,5,6,0,0,117,119,3,12,6,0,118,117,1,0,0,0,119,122,1,0,0,
0,120,118,1,0,0,0,120,121,1,0,0,0,121,123,1,0,0,0,122,120,1,0,0,0,123,124,
5,7,0,0,124,125,5,72,0,0,125,19,1,0,0,0,126,127,5,57,0,0,127,131,5,6,0,0,
128,130,3,12,6,0,129,128,1,0,0,0,130,133,1,0,0,0,131,129,1,0,0,0,131,132,
1,0,0,0,132,134,1,0,0,0,133,131,1,0,0,0,134,144,5,7,0,0,135,136,5,58,0,0,
136,140,5,6,0,0,137,139,3,12,6,0,138,137,1,0,0,0,139,142,1,0,0,0,140,138,
1,0,0,0,140,141,1,0,0,0,141,143,1,0,0,0,142,140,1,0,0,0,143,145,5,7,0,0,
144,135,1,0,0,0,144,145,1,0,0,0,145,146,1,0,0,0,146,147,5,59,0,0,147,148,
5,72,0,0,148,21,1,0,0,0,149,150,5,8,0,0,150,151,3,34,17,0,151,152,3,24,12,
0,152,153,5,72,0,0,153,23,1,0,0,0,154,156,3,26,13,0,155,154,1,0,0,0,156,
157,1,0,0,0,157,155,1,0,0,0,157,158,1,0,0,0,158,25,1,0,0,0,159,219,3,34,
17,0,160,219,5,74,0,0,161,219,5,75,0,0,162,219,5,69,0,0,163,219,5,70,0,0,
164,219,5,71,0,0,165,219,5,68,0,0,166,219,5,9,0,0,167,219,5,3,0,0,168,219,
5,10,0,0,169,219,5,1,0,0,170,219,5,11,0,0,171,219,5,12,0,0,172,219,5,13,
0,0,173,219,5,14,0,0,174,219,5,15,0,0,175,219,5,16,0,0,176,219,5,17,0,0,
177,219,5,18,0,0,178,219,5,19,0,0,179,219,5,20,0,0,180,219,5,21,0,0,181,
219,5,22,0,0,182,219,5,23,0,0,183,219,5,24,0,0,184,219,5,25,0,0,185,219,
5,26,0,0,186,219,5,28,0,0,187,219,5,29,0,0,188,219,5,30,0,0,189,219,5,31,
0,0,190,219,5,32,0,0,191,219,5,33,0,0,192,219,5,34,0,0,193,219,5,35,0,0,
194,219,5,36,0,0,195,219,5,37,0,0,196,219,5,38,0,0,197,219,5,39,0,0,198,
219,5,40,0,0,199,219,5,41,0,0,200,219,5,42,0,0,201,219,5,43,0,0,202,219,
5,44,0,0,203,219,5,45,0,0,204,219,5,46,0,0,205,219,5,47,0,0,206,219,5,48,
0,0,207,219,5,49,0,0,208,219,5,50,0,0,209,219,5,51,0,0,210,219,5,52,0,0,
211,219,5,53,0,0,212,219,5,54,0,0,213,219,5,55,0,0,214,219,5,56,0,0,215,
219,5,57,0,0,216,219,5,58,0,0,217,219,5,59,0,0,218,159,1,0,0,0,218,160,1,
0,0,0,218,161,1,0,0,0,218,162,1,0,0,0,218,163,1,0,0,0,218,164,1,0,0,0,218,
165,1,0,0,0,218,166,1,0,0,0,218,167,1,0,0,0,218,168,1,0,0,0,218,169,1,0,
0,0,218,170,1,0,0,0,218,171,1,0,0,0,218,172,1,0,0,0,218,173,1,0,0,0,218,
174,1,0,0,0,218,175,1,0,0,0,218,176,1,0,0,0,218,177,1,0,0,0,218,178,1,0,
0,0,218,179,1,0,0,0,218,180,1,0,0,0,218,181,1,0,0,0,218,182,1,0,0,0,218,
183,1,0,0,0,218,184,1,0,0,0,218,185,1,0,0,0,218,186,1,0,0,0,218,187,1,0,
0,0,218,188,1,0,0,0,218,189,1,0,0,0,218,190,1,0,0,0,218,191,1,0,0,0,218,
192,1,0,0,0,218,193,1,0,0,0,218,194,1,0,0,0,218,195,1,0,0,0,218,196,1,0,
0,0,218,197,1,0,0,0,218,198,1,0,0,0,218,199,1,0,0,0,218,200,1,0,0,0,218,
201,1,0,0,0,218,202,1,0,0,0,218,203,1,0,0,0,218,204,1,0,0,0,218,205,1,0,
0,0,218,206,1,0,0,0,218,207,1,0,0,0,218,208,1,0,0,0,218,209,1,0,0,0,218,
210,1,0,0,0,218,211,1,0,0,0,218,212,1,0,0,0,218,213,1,0,0,0,218,214,1,0,
0,0,218,215,1,0,0,0,218,216,1,0,0,0,218,217,1,0,0,0,219,27,1,0,0,0,220,221,
5,60,0,0,221,222,5,61,0,0,222,223,3,34,17,0,223,224,7,0,0,0,224,225,3,34,
17,0,225,226,5,64,0,0,226,230,3,30,15,0,227,228,5,65,0,0,228,229,5,72,0,
0,229,231,3,30,15,0,230,227,1,0,0,0,230,231,1,0,0,0,231,232,1,0,0,0,232,
233,5,66,0,0,233,234,5,72,0,0,234,29,1,0,0,0,235,239,5,6,0,0,236,238,3,12,
6,0,237,236,1,0,0,0,238,241,1,0,0,0,239,237,1,0,0,0,239,240,1,0,0,0,240,
242,1,0,0,0,241,239,1,0,0,0,242,243,5,7,0,0,243,246,5,72,0,0,244,246,3,22,
11,0,245,235,1,0,0,0,245,244,1,0,0,0,246,31,1,0,0,0,247,248,5,69,0,0,248,
253,3,34,17,0,249,250,5,71,0,0,250,252,3,34,17,0,251,249,1,0,0,0,252,255,
1,0,0,0,253,251,1,0,0,0,253,254,1,0,0,0,254,256,1,0,0,0,255,253,1,0,0,0,
256,257,5,70,0,0,257,33,1,0,0,0,258,259,5,73,0,0,259,35,1,0,0,0,18,39,48,
58,80,90,97,103,112,120,131,140,144,157,218,230,239,245,253];


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
                            "'COBEGIN'", "'COEND'", "'SUBFLOW'", "'SYNC'", 
                            "'ASYNC'", "'ON'", "'ERROR'", "'BACKOUT'", "'TRY'", 
                            "'CATCH'", "'ENDTRY'", "'IF'", "'FIELD'", "'EQUALS'", 
                            "'CONTAINS'", "'THEN'", "'ELSE'", "'ENDIF'", 
                            "'->'", "'='", "'('", "')'", "','", "';'" ];
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
                             "COBEGIN", "COEND", "SUBFLOW", "SYNC", "ASYNC", 
                             "ON", "ERROR", "BACKOUT", "TRY", "CATCH", "ENDTRY", 
                             "IF", "FIELD", "EQUALS", "CONTAINS", "THEN", 
                             "ELSE", "ENDIF", "ARROW", "ASSIGN_EQ", "LPAREN", 
                             "RPAREN", "COMMA", "SEMICOLON", "STRING", "NUMBER", 
                             "IDENT", "HASH_COMMENT", "SLASH_COMMENT", "DASH_COMMENT", 
                             "WS" ];
    static ruleNames = [ "program", "item", "queueDecl", "fileDecl", "apiDecl", 
                         "workflowDecl", "workflowStmt", "cobeginStmt", 
                         "cobeginMode", "subflowDecl", "tryStmt", "stepStmt", 
                         "stepBody", "stepToken", "ifStmt", "branch", "quotedList", 
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
	        this.state = 39;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 46) !== 0)) {
	            this.state = 36;
	            this.item();
	            this.state = 41;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 42;
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
	        this.state = 48;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 44;
	            this.queueDecl();
	            break;
	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 45;
	            this.fileDecl();
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 46;
	            this.apiDecl();
	            break;
	        case 5:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 47;
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
	        this.state = 50;
	        this.match(WorkflowDslParser.QUEUE);
	        this.state = 51;
	        this.quotedString();
	        this.state = 52;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 53;
	        this.quotedString();
	        this.state = 58;
	        this._errHandler.sync(this);
	        switch (this._input.LA(1)) {
	        case 26:
	        	this.state = 54;
	        	this.match(WorkflowDslParser.TYPE);
	        	this.state = 55;
	        	this.quotedString();
	        	break;
	        case 27:
	        	this.state = 56;
	        	this.match(WorkflowDslParser.TYPES);
	        	this.state = 57;
	        	this.quotedList();
	        	break;
	        case 72:
	        	break;
	        default:
	        	break;
	        }
	        this.state = 60;
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
	        this.state = 62;
	        this.match(WorkflowDslParser.FILE);
	        this.state = 63;
	        this.quotedString();
	        this.state = 64;
	        this.match(WorkflowDslParser.ARROW);
	        this.state = 65;
	        this.quotedString();
	        this.state = 66;
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
	        this.state = 68;
	        this.match(WorkflowDslParser.API);
	        this.state = 69;
	        this.quotedString();
	        this.state = 70;
	        this.match(WorkflowDslParser.BASE);
	        this.state = 71;
	        this.quotedString();
	        this.state = 72;
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
	        this.state = 74;
	        this.match(WorkflowDslParser.WORKFLOW);
	        this.state = 75;
	        this.quotedString();
	        this.state = 76;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 80;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8 || ((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 2305) !== 0)) {
	            this.state = 77;
	            this.workflowStmt();
	            this.state = 82;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 83;
	        this.match(WorkflowDslParser.END);
	        this.state = 84;
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
	        this.state = 90;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 8:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 86;
	            this.stepStmt();
	            break;
	        case 60:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 87;
	            this.ifStmt();
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 88;
	            this.cobeginStmt();
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 89;
	            this.tryStmt();
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



	cobeginStmt() {
	    let localctx = new CobeginStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, WorkflowDslParser.RULE_cobeginStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 92;
	        this.match(WorkflowDslParser.COBEGIN);
	        this.state = 93;
	        this.cobeginMode();
	        this.state = 97;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===54) {
	            this.state = 94;
	            this.match(WorkflowDslParser.ON);
	            this.state = 95;
	            this.match(WorkflowDslParser.ERROR);
	            this.state = 96;
	            this.match(WorkflowDslParser.BACKOUT);
	        }

	        this.state = 99;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 101; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 100;
	            this.subflowDecl();
	            this.state = 103; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while(_la===51);
	        this.state = 105;
	        this.match(WorkflowDslParser.COEND);
	        this.state = 106;
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



	cobeginMode() {
	    let localctx = new CobeginModeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, WorkflowDslParser.RULE_cobeginMode);
	    try {
	        this.state = 112;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 52:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 108;
	            this.match(WorkflowDslParser.SYNC);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 109;
	            this.match(WorkflowDslParser.ASYNC);
	            this.state = 110;
	            this.match(WorkflowDslParser.WAIT);
	            this.state = 111;
	            this.match(WorkflowDslParser.NUMBER);
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



	subflowDecl() {
	    let localctx = new SubflowDeclContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, WorkflowDslParser.RULE_subflowDecl);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 114;
	        this.match(WorkflowDslParser.SUBFLOW);
	        this.state = 115;
	        this.quotedString();
	        this.state = 116;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 120;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8 || ((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 2305) !== 0)) {
	            this.state = 117;
	            this.workflowStmt();
	            this.state = 122;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 123;
	        this.match(WorkflowDslParser.END);
	        this.state = 124;
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



	tryStmt() {
	    let localctx = new TryStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, WorkflowDslParser.RULE_tryStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 126;
	        this.match(WorkflowDslParser.TRY);
	        this.state = 127;
	        this.match(WorkflowDslParser.BEGIN);
	        this.state = 131;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===8 || ((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 2305) !== 0)) {
	            this.state = 128;
	            this.workflowStmt();
	            this.state = 133;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 134;
	        this.match(WorkflowDslParser.END);
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===58) {
	            this.state = 135;
	            this.match(WorkflowDslParser.CATCH);
	            this.state = 136;
	            this.match(WorkflowDslParser.BEGIN);
	            this.state = 140;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===8 || ((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 2305) !== 0)) {
	                this.state = 137;
	                this.workflowStmt();
	                this.state = 142;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 143;
	            this.match(WorkflowDslParser.END);
	        }

	        this.state = 146;
	        this.match(WorkflowDslParser.ENDTRY);
	        this.state = 147;
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



	stepStmt() {
	    let localctx = new StepStmtContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, WorkflowDslParser.RULE_stepStmt);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 149;
	        this.match(WorkflowDslParser.STEP);
	        this.state = 150;
	        this.quotedString();
	        this.state = 151;
	        this.stepBody();
	        this.state = 152;
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
	    this.enterRule(localctx, 24, WorkflowDslParser.RULE_stepBody);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 155; 
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        do {
	            this.state = 154;
	            this.stepToken();
	            this.state = 157; 
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        } while((((_la) & ~0x1f) === 0 && ((1 << _la) & 4160749066) !== 0) || ((((_la - 32)) & ~0x1f) === 0 && ((1 << (_la - 32)) & 268435455) !== 0) || ((((_la - 68)) & ~0x1f) === 0 && ((1 << (_la - 68)) & 239) !== 0));
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
	    this.enterRule(localctx, 26, WorkflowDslParser.RULE_stepToken);
	    try {
	        this.state = 218;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 73:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 159;
	            this.quotedString();
	            break;
	        case 74:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 160;
	            this.match(WorkflowDslParser.NUMBER);
	            break;
	        case 75:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 161;
	            this.match(WorkflowDslParser.IDENT);
	            break;
	        case 69:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 162;
	            this.match(WorkflowDslParser.LPAREN);
	            break;
	        case 70:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 163;
	            this.match(WorkflowDslParser.RPAREN);
	            break;
	        case 71:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 164;
	            this.match(WorkflowDslParser.COMMA);
	            break;
	        case 68:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 165;
	            this.match(WorkflowDslParser.ASSIGN_EQ);
	            break;
	        case 9:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 166;
	            this.match(WorkflowDslParser.CALL);
	            break;
	        case 3:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 167;
	            this.match(WorkflowDslParser.API);
	            break;
	        case 10:
	            this.enterOuterAlt(localctx, 10);
	            this.state = 168;
	            this.match(WorkflowDslParser.ROUTE);
	            break;
	        case 1:
	            this.enterOuterAlt(localctx, 11);
	            this.state = 169;
	            this.match(WorkflowDslParser.QUEUE);
	            break;
	        case 11:
	            this.enterOuterAlt(localctx, 12);
	            this.state = 170;
	            this.match(WorkflowDslParser.SET);
	            break;
	        case 12:
	            this.enterOuterAlt(localctx, 13);
	            this.state = 171;
	            this.match(WorkflowDslParser.STATE);
	            break;
	        case 13:
	            this.enterOuterAlt(localctx, 14);
	            this.state = 172;
	            this.match(WorkflowDslParser.WAIT);
	            break;
	        case 14:
	            this.enterOuterAlt(localctx, 15);
	            this.state = 173;
	            this.match(WorkflowDslParser.CHECK);
	            break;
	        case 15:
	            this.enterOuterAlt(localctx, 16);
	            this.state = 174;
	            this.match(WorkflowDslParser.EXPECT);
	            break;
	        case 16:
	            this.enterOuterAlt(localctx, 17);
	            this.state = 175;
	            this.match(WorkflowDslParser.RETRIES);
	            break;
	        case 17:
	            this.enterOuterAlt(localctx, 18);
	            this.state = 176;
	            this.match(WorkflowDslParser.EVERY);
	            break;
	        case 18:
	            this.enterOuterAlt(localctx, 19);
	            this.state = 177;
	            this.match(WorkflowDslParser.ISSUE);
	            break;
	        case 19:
	            this.enterOuterAlt(localctx, 20);
	            this.state = 178;
	            this.match(WorkflowDslParser.CREATE);
	            break;
	        case 20:
	            this.enterOuterAlt(localctx, 21);
	            this.state = 179;
	            this.match(WorkflowDslParser.TITLE);
	            break;
	        case 21:
	            this.enterOuterAlt(localctx, 22);
	            this.state = 180;
	            this.match(WorkflowDslParser.DESCRIPTION);
	            break;
	        case 22:
	            this.enterOuterAlt(localctx, 23);
	            this.state = 181;
	            this.match(WorkflowDslParser.PRIORITY);
	            break;
	        case 23:
	            this.enterOuterAlt(localctx, 24);
	            this.state = 182;
	            this.match(WorkflowDslParser.ASSIGN);
	            break;
	        case 24:
	            this.enterOuterAlt(localctx, 25);
	            this.state = 183;
	            this.match(WorkflowDslParser.USER);
	            break;
	        case 25:
	            this.enterOuterAlt(localctx, 26);
	            this.state = 184;
	            this.match(WorkflowDslParser.REPORTER);
	            break;
	        case 26:
	            this.enterOuterAlt(localctx, 27);
	            this.state = 185;
	            this.match(WorkflowDslParser.TYPE);
	            break;
	        case 28:
	            this.enterOuterAlt(localctx, 28);
	            this.state = 186;
	            this.match(WorkflowDslParser.INTO);
	            break;
	        case 29:
	            this.enterOuterAlt(localctx, 29);
	            this.state = 187;
	            this.match(WorkflowDslParser.TESTCASE);
	            break;
	        case 30:
	            this.enterOuterAlt(localctx, 30);
	            this.state = 188;
	            this.match(WorkflowDslParser.TESTPLAN);
	            break;
	        case 31:
	            this.enterOuterAlt(localctx, 31);
	            this.state = 189;
	            this.match(WorkflowDslParser.PLAN);
	            break;
	        case 32:
	            this.enterOuterAlt(localctx, 32);
	            this.state = 190;
	            this.match(WorkflowDslParser.LINK);
	            break;
	        case 33:
	            this.enterOuterAlt(localctx, 33);
	            this.state = 191;
	            this.match(WorkflowDslParser.TO);
	            break;
	        case 34:
	            this.enterOuterAlt(localctx, 34);
	            this.state = 192;
	            this.match(WorkflowDslParser.ADD);
	            break;
	        case 35:
	            this.enterOuterAlt(localctx, 35);
	            this.state = 193;
	            this.match(WorkflowDslParser.PROJECT);
	            break;
	        case 36:
	            this.enterOuterAlt(localctx, 36);
	            this.state = 194;
	            this.match(WorkflowDslParser.RELEASE);
	            break;
	        case 37:
	            this.enterOuterAlt(localctx, 37);
	            this.state = 195;
	            this.match(WorkflowDslParser.FOR);
	            break;
	        case 38:
	            this.enterOuterAlt(localctx, 38);
	            this.state = 196;
	            this.match(WorkflowDslParser.DEPLOYMENT);
	            break;
	        case 39:
	            this.enterOuterAlt(localctx, 39);
	            this.state = 197;
	            this.match(WorkflowDslParser.ARTIFACT);
	            break;
	        case 40:
	            this.enterOuterAlt(localctx, 40);
	            this.state = 198;
	            this.match(WorkflowDslParser.LOCATION);
	            break;
	        case 41:
	            this.enterOuterAlt(localctx, 41);
	            this.state = 199;
	            this.match(WorkflowDslParser.PROJECTPLAN);
	            break;
	        case 42:
	            this.enterOuterAlt(localctx, 42);
	            this.state = 200;
	            this.match(WorkflowDslParser.MILESTONE);
	            break;
	        case 43:
	            this.enterOuterAlt(localctx, 43);
	            this.state = 201;
	            this.match(WorkflowDslParser.DUE);
	            break;
	        case 44:
	            this.enterOuterAlt(localctx, 44);
	            this.state = 202;
	            this.match(WorkflowDslParser.DATE);
	            break;
	        case 45:
	            this.enterOuterAlt(localctx, 45);
	            this.state = 203;
	            this.match(WorkflowDslParser.TASK);
	            break;
	        case 46:
	            this.enterOuterAlt(localctx, 46);
	            this.state = 204;
	            this.match(WorkflowDslParser.SYNCHPOINT);
	            break;
	        case 47:
	            this.enterOuterAlt(localctx, 47);
	            this.state = 205;
	            this.match(WorkflowDslParser.DELIVERABLE);
	            break;
	        case 48:
	            this.enterOuterAlt(localctx, 48);
	            this.state = 206;
	            this.match(WorkflowDslParser.RESOURCE);
	            break;
	        case 49:
	            this.enterOuterAlt(localctx, 49);
	            this.state = 207;
	            this.match(WorkflowDslParser.COBEGIN);
	            break;
	        case 50:
	            this.enterOuterAlt(localctx, 50);
	            this.state = 208;
	            this.match(WorkflowDslParser.COEND);
	            break;
	        case 51:
	            this.enterOuterAlt(localctx, 51);
	            this.state = 209;
	            this.match(WorkflowDslParser.SUBFLOW);
	            break;
	        case 52:
	            this.enterOuterAlt(localctx, 52);
	            this.state = 210;
	            this.match(WorkflowDslParser.SYNC);
	            break;
	        case 53:
	            this.enterOuterAlt(localctx, 53);
	            this.state = 211;
	            this.match(WorkflowDslParser.ASYNC);
	            break;
	        case 54:
	            this.enterOuterAlt(localctx, 54);
	            this.state = 212;
	            this.match(WorkflowDslParser.ON);
	            break;
	        case 55:
	            this.enterOuterAlt(localctx, 55);
	            this.state = 213;
	            this.match(WorkflowDslParser.ERROR);
	            break;
	        case 56:
	            this.enterOuterAlt(localctx, 56);
	            this.state = 214;
	            this.match(WorkflowDslParser.BACKOUT);
	            break;
	        case 57:
	            this.enterOuterAlt(localctx, 57);
	            this.state = 215;
	            this.match(WorkflowDslParser.TRY);
	            break;
	        case 58:
	            this.enterOuterAlt(localctx, 58);
	            this.state = 216;
	            this.match(WorkflowDslParser.CATCH);
	            break;
	        case 59:
	            this.enterOuterAlt(localctx, 59);
	            this.state = 217;
	            this.match(WorkflowDslParser.ENDTRY);
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
	    this.enterRule(localctx, 28, WorkflowDslParser.RULE_ifStmt);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 220;
	        this.match(WorkflowDslParser.IF);
	        this.state = 221;
	        this.match(WorkflowDslParser.FIELD);
	        this.state = 222;
	        this.quotedString();
	        this.state = 223;
	        _la = this._input.LA(1);
	        if(!(_la===62 || _la===63)) {
	        this._errHandler.recoverInline(this);
	        }
	        else {
	        	this._errHandler.reportMatch(this);
	            this.consume();
	        }
	        this.state = 224;
	        this.quotedString();
	        this.state = 225;
	        this.match(WorkflowDslParser.THEN);
	        this.state = 226;
	        this.branch();
	        this.state = 230;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===65) {
	            this.state = 227;
	            this.match(WorkflowDslParser.ELSE);
	            this.state = 228;
	            this.match(WorkflowDslParser.SEMICOLON);
	            this.state = 229;
	            this.branch();
	        }

	        this.state = 232;
	        this.match(WorkflowDslParser.ENDIF);
	        this.state = 233;
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
	    this.enterRule(localctx, 30, WorkflowDslParser.RULE_branch);
	    var _la = 0;
	    try {
	        this.state = 245;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 6:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 235;
	            this.match(WorkflowDslParser.BEGIN);
	            this.state = 239;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===8 || ((((_la - 49)) & ~0x1f) === 0 && ((1 << (_la - 49)) & 2305) !== 0)) {
	                this.state = 236;
	                this.workflowStmt();
	                this.state = 241;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	            this.state = 242;
	            this.match(WorkflowDslParser.END);
	            this.state = 243;
	            this.match(WorkflowDslParser.SEMICOLON);
	            break;
	        case 8:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 244;
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
	    this.enterRule(localctx, 32, WorkflowDslParser.RULE_quotedList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 247;
	        this.match(WorkflowDslParser.LPAREN);
	        this.state = 248;
	        this.quotedString();
	        this.state = 253;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===71) {
	            this.state = 249;
	            this.match(WorkflowDslParser.COMMA);
	            this.state = 250;
	            this.quotedString();
	            this.state = 255;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 256;
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
	    this.enterRule(localctx, 34, WorkflowDslParser.RULE_quotedString);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 258;
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
WorkflowDslParser.COBEGIN = 49;
WorkflowDslParser.COEND = 50;
WorkflowDslParser.SUBFLOW = 51;
WorkflowDslParser.SYNC = 52;
WorkflowDslParser.ASYNC = 53;
WorkflowDslParser.ON = 54;
WorkflowDslParser.ERROR = 55;
WorkflowDslParser.BACKOUT = 56;
WorkflowDslParser.TRY = 57;
WorkflowDslParser.CATCH = 58;
WorkflowDslParser.ENDTRY = 59;
WorkflowDslParser.IF = 60;
WorkflowDslParser.FIELD = 61;
WorkflowDslParser.EQUALS = 62;
WorkflowDslParser.CONTAINS = 63;
WorkflowDslParser.THEN = 64;
WorkflowDslParser.ELSE = 65;
WorkflowDslParser.ENDIF = 66;
WorkflowDslParser.ARROW = 67;
WorkflowDslParser.ASSIGN_EQ = 68;
WorkflowDslParser.LPAREN = 69;
WorkflowDslParser.RPAREN = 70;
WorkflowDslParser.COMMA = 71;
WorkflowDslParser.SEMICOLON = 72;
WorkflowDslParser.STRING = 73;
WorkflowDslParser.NUMBER = 74;
WorkflowDslParser.IDENT = 75;
WorkflowDslParser.HASH_COMMENT = 76;
WorkflowDslParser.SLASH_COMMENT = 77;
WorkflowDslParser.DASH_COMMENT = 78;
WorkflowDslParser.WS = 79;

WorkflowDslParser.RULE_program = 0;
WorkflowDslParser.RULE_item = 1;
WorkflowDslParser.RULE_queueDecl = 2;
WorkflowDslParser.RULE_fileDecl = 3;
WorkflowDslParser.RULE_apiDecl = 4;
WorkflowDslParser.RULE_workflowDecl = 5;
WorkflowDslParser.RULE_workflowStmt = 6;
WorkflowDslParser.RULE_cobeginStmt = 7;
WorkflowDslParser.RULE_cobeginMode = 8;
WorkflowDslParser.RULE_subflowDecl = 9;
WorkflowDslParser.RULE_tryStmt = 10;
WorkflowDslParser.RULE_stepStmt = 11;
WorkflowDslParser.RULE_stepBody = 12;
WorkflowDslParser.RULE_stepToken = 13;
WorkflowDslParser.RULE_ifStmt = 14;
WorkflowDslParser.RULE_branch = 15;
WorkflowDslParser.RULE_quotedList = 16;
WorkflowDslParser.RULE_quotedString = 17;

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

	cobeginStmt() {
	    return this.getTypedRuleContext(CobeginStmtContext,0);
	};

	tryStmt() {
	    return this.getTypedRuleContext(TryStmtContext,0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitWorkflowStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CobeginStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_cobeginStmt;
    }

	COBEGIN() {
	    return this.getToken(WorkflowDslParser.COBEGIN, 0);
	};

	cobeginMode() {
	    return this.getTypedRuleContext(CobeginModeContext,0);
	};

	BEGIN() {
	    return this.getToken(WorkflowDslParser.BEGIN, 0);
	};

	COEND() {
	    return this.getToken(WorkflowDslParser.COEND, 0);
	};

	SEMICOLON() {
	    return this.getToken(WorkflowDslParser.SEMICOLON, 0);
	};

	ON() {
	    return this.getToken(WorkflowDslParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(WorkflowDslParser.ERROR, 0);
	};

	BACKOUT() {
	    return this.getToken(WorkflowDslParser.BACKOUT, 0);
	};

	subflowDecl = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SubflowDeclContext);
	    } else {
	        return this.getTypedRuleContext(SubflowDeclContext,i);
	    }
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitCobeginStmt(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class CobeginModeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_cobeginMode;
    }

	SYNC() {
	    return this.getToken(WorkflowDslParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(WorkflowDslParser.ASYNC, 0);
	};

	WAIT() {
	    return this.getToken(WorkflowDslParser.WAIT, 0);
	};

	NUMBER() {
	    return this.getToken(WorkflowDslParser.NUMBER, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitCobeginMode(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class SubflowDeclContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_subflowDecl;
    }

	SUBFLOW() {
	    return this.getToken(WorkflowDslParser.SUBFLOW, 0);
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
	        return visitor.visitSubflowDecl(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class TryStmtContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = WorkflowDslParser.RULE_tryStmt;
    }

	TRY() {
	    return this.getToken(WorkflowDslParser.TRY, 0);
	};

	BEGIN = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.BEGIN);
	    } else {
	        return this.getToken(WorkflowDslParser.BEGIN, i);
	    }
	};


	END = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(WorkflowDslParser.END);
	    } else {
	        return this.getToken(WorkflowDslParser.END, i);
	    }
	};


	ENDTRY() {
	    return this.getToken(WorkflowDslParser.ENDTRY, 0);
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

	CATCH() {
	    return this.getToken(WorkflowDslParser.CATCH, 0);
	};

	accept(visitor) {
	    if ( visitor instanceof WorkflowDslVisitor ) {
	        return visitor.visitTryStmt(this);
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

	COBEGIN() {
	    return this.getToken(WorkflowDslParser.COBEGIN, 0);
	};

	COEND() {
	    return this.getToken(WorkflowDslParser.COEND, 0);
	};

	SUBFLOW() {
	    return this.getToken(WorkflowDslParser.SUBFLOW, 0);
	};

	SYNC() {
	    return this.getToken(WorkflowDslParser.SYNC, 0);
	};

	ASYNC() {
	    return this.getToken(WorkflowDslParser.ASYNC, 0);
	};

	ON() {
	    return this.getToken(WorkflowDslParser.ON, 0);
	};

	ERROR() {
	    return this.getToken(WorkflowDslParser.ERROR, 0);
	};

	BACKOUT() {
	    return this.getToken(WorkflowDslParser.BACKOUT, 0);
	};

	TRY() {
	    return this.getToken(WorkflowDslParser.TRY, 0);
	};

	CATCH() {
	    return this.getToken(WorkflowDslParser.CATCH, 0);
	};

	ENDTRY() {
	    return this.getToken(WorkflowDslParser.ENDTRY, 0);
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
WorkflowDslParser.CobeginStmtContext = CobeginStmtContext; 
WorkflowDslParser.CobeginModeContext = CobeginModeContext; 
WorkflowDslParser.SubflowDeclContext = SubflowDeclContext; 
WorkflowDslParser.TryStmtContext = TryStmtContext; 
WorkflowDslParser.StepStmtContext = StepStmtContext; 
WorkflowDslParser.StepBodyContext = StepBodyContext; 
WorkflowDslParser.StepTokenContext = StepTokenContext; 
WorkflowDslParser.IfStmtContext = IfStmtContext; 
WorkflowDslParser.BranchContext = BranchContext; 
WorkflowDslParser.QuotedListContext = QuotedListContext; 
WorkflowDslParser.QuotedStringContext = QuotedStringContext; 
