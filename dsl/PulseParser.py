# Generated from Pulse.g4 by ANTLR 4.13.2
# encoding: utf-8
from antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO

def serializedATN():
    return [
        4,1,41,46,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,1,0,5,
        0,14,8,0,10,0,12,0,17,9,0,1,0,1,0,1,1,1,1,3,1,23,8,1,1,1,1,1,1,1,
        3,1,28,8,1,1,2,1,2,3,2,32,8,2,1,3,1,3,1,3,5,3,37,8,3,10,3,12,3,40,
        9,3,1,4,1,4,1,5,1,5,1,5,0,0,6,0,2,4,6,8,10,0,2,1,0,35,38,1,0,2,34,
        44,0,15,1,0,0,0,2,27,1,0,0,0,4,29,1,0,0,0,6,33,1,0,0,0,8,41,1,0,
        0,0,10,43,1,0,0,0,12,14,3,2,1,0,13,12,1,0,0,0,14,17,1,0,0,0,15,13,
        1,0,0,0,15,16,1,0,0,0,16,18,1,0,0,0,17,15,1,0,0,0,18,19,5,0,0,1,
        19,1,1,0,0,0,20,22,3,4,2,0,21,23,5,39,0,0,22,21,1,0,0,0,22,23,1,
        0,0,0,23,24,1,0,0,0,24,25,5,40,0,0,25,28,1,0,0,0,26,28,5,40,0,0,
        27,20,1,0,0,0,27,26,1,0,0,0,28,3,1,0,0,0,29,31,3,10,5,0,30,32,3,
        6,3,0,31,30,1,0,0,0,31,32,1,0,0,0,32,5,1,0,0,0,33,38,3,8,4,0,34,
        35,5,1,0,0,35,37,3,8,4,0,36,34,1,0,0,0,37,40,1,0,0,0,38,36,1,0,0,
        0,38,39,1,0,0,0,39,7,1,0,0,0,40,38,1,0,0,0,41,42,7,0,0,0,42,9,1,
        0,0,0,43,44,7,1,0,0,44,11,1,0,0,0,5,15,22,27,31,38
    ]

class PulseParser ( Parser ):

    grammarFileName = "Pulse.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "','", "'LIT'", "'ADD'", "'SUB'", "'MUL'", 
                     "'DIV'", "'CALL'", "'RET'", "'JMP'", "'JPC'", "'DUP'", 
                     "'POP'", "'SWAP'", "'OVER'", "'PICK'", "'DROP'", "'ROT'", 
                     "'NIP'", "'TUCK'", "'SWAPN'", "'ROLL'", "'DEPTH'", 
                     "'CLEAR'", "'LITS'", "'WRITE'", "'PRINT'", "'SYS'", 
                     "'HALT'", "'LOAD'", "'STORE'", "'LOADL'", "'STOREL'", 
                     "'LOADH'", "'STOREH'" ]

    symbolicNames = [ "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "IDENTIFIER", 
                      "INT", "HEX", "STRING", "COMMENT", "NEWLINE", "WS" ]

    RULE_program = 0
    RULE_line = 1
    RULE_instruction = 2
    RULE_operandList = 3
    RULE_operand = 4
    RULE_mnemonic = 5

    ruleNames =  [ "program", "line", "instruction", "operandList", "operand", 
                   "mnemonic" ]

    EOF = Token.EOF
    T__0=1
    T__1=2
    T__2=3
    T__3=4
    T__4=5
    T__5=6
    T__6=7
    T__7=8
    T__8=9
    T__9=10
    T__10=11
    T__11=12
    T__12=13
    T__13=14
    T__14=15
    T__15=16
    T__16=17
    T__17=18
    T__18=19
    T__19=20
    T__20=21
    T__21=22
    T__22=23
    T__23=24
    T__24=25
    T__25=26
    T__26=27
    T__27=28
    T__28=29
    T__29=30
    T__30=31
    T__31=32
    T__32=33
    T__33=34
    IDENTIFIER=35
    INT=36
    HEX=37
    STRING=38
    COMMENT=39
    NEWLINE=40
    WS=41

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.13.2")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class ProgramContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def EOF(self):
            return self.getToken(PulseParser.EOF, 0)

        def line(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PulseParser.LineContext)
            else:
                return self.getTypedRuleContext(PulseParser.LineContext,i)


        def getRuleIndex(self):
            return PulseParser.RULE_program

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterProgram" ):
                listener.enterProgram(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitProgram" ):
                listener.exitProgram(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitProgram" ):
                return visitor.visitProgram(self)
            else:
                return visitor.visitChildren(self)




    def program(self):

        localctx = PulseParser.ProgramContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_program)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 15
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while (((_la) & ~0x3f) == 0 and ((1 << _la) & 1133871366140) != 0):
                self.state = 12
                self.line()
                self.state = 17
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 18
            self.match(PulseParser.EOF)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class LineContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def instruction(self):
            return self.getTypedRuleContext(PulseParser.InstructionContext,0)


        def NEWLINE(self):
            return self.getToken(PulseParser.NEWLINE, 0)

        def COMMENT(self):
            return self.getToken(PulseParser.COMMENT, 0)

        def getRuleIndex(self):
            return PulseParser.RULE_line

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterLine" ):
                listener.enterLine(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitLine" ):
                listener.exitLine(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitLine" ):
                return visitor.visitLine(self)
            else:
                return visitor.visitChildren(self)




    def line(self):

        localctx = PulseParser.LineContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_line)
        self._la = 0 # Token type
        try:
            self.state = 27
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]:
                self.enterOuterAlt(localctx, 1)
                self.state = 20
                self.instruction()
                self.state = 22
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==39:
                    self.state = 21
                    self.match(PulseParser.COMMENT)


                self.state = 24
                self.match(PulseParser.NEWLINE)
                pass
            elif token in [40]:
                self.enterOuterAlt(localctx, 2)
                self.state = 26
                self.match(PulseParser.NEWLINE)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class InstructionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def mnemonic(self):
            return self.getTypedRuleContext(PulseParser.MnemonicContext,0)


        def operandList(self):
            return self.getTypedRuleContext(PulseParser.OperandListContext,0)


        def getRuleIndex(self):
            return PulseParser.RULE_instruction

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterInstruction" ):
                listener.enterInstruction(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitInstruction" ):
                listener.exitInstruction(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitInstruction" ):
                return visitor.visitInstruction(self)
            else:
                return visitor.visitChildren(self)




    def instruction(self):

        localctx = PulseParser.InstructionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 4, self.RULE_instruction)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 29
            self.mnemonic()
            self.state = 31
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 515396075520) != 0):
                self.state = 30
                self.operandList()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class OperandListContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def operand(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PulseParser.OperandContext)
            else:
                return self.getTypedRuleContext(PulseParser.OperandContext,i)


        def getRuleIndex(self):
            return PulseParser.RULE_operandList

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterOperandList" ):
                listener.enterOperandList(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitOperandList" ):
                listener.exitOperandList(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitOperandList" ):
                return visitor.visitOperandList(self)
            else:
                return visitor.visitChildren(self)




    def operandList(self):

        localctx = PulseParser.OperandListContext(self, self._ctx, self.state)
        self.enterRule(localctx, 6, self.RULE_operandList)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 33
            self.operand()
            self.state = 38
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==1:
                self.state = 34
                self.match(PulseParser.T__0)
                self.state = 35
                self.operand()
                self.state = 40
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class OperandContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def INT(self):
            return self.getToken(PulseParser.INT, 0)

        def HEX(self):
            return self.getToken(PulseParser.HEX, 0)

        def STRING(self):
            return self.getToken(PulseParser.STRING, 0)

        def IDENTIFIER(self):
            return self.getToken(PulseParser.IDENTIFIER, 0)

        def getRuleIndex(self):
            return PulseParser.RULE_operand

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterOperand" ):
                listener.enterOperand(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitOperand" ):
                listener.exitOperand(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitOperand" ):
                return visitor.visitOperand(self)
            else:
                return visitor.visitChildren(self)




    def operand(self):

        localctx = PulseParser.OperandContext(self, self._ctx, self.state)
        self.enterRule(localctx, 8, self.RULE_operand)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 41
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 515396075520) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class MnemonicContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return PulseParser.RULE_mnemonic

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterMnemonic" ):
                listener.enterMnemonic(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitMnemonic" ):
                listener.exitMnemonic(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitMnemonic" ):
                return visitor.visitMnemonic(self)
            else:
                return visitor.visitChildren(self)




    def mnemonic(self):

        localctx = PulseParser.MnemonicContext(self, self._ctx, self.state)
        self.enterRule(localctx, 10, self.RULE_mnemonic)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 43
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 34359738364) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





