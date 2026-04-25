# Generated from Pulse.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .PulseParser import PulseParser
else:
    from PulseParser import PulseParser

# This class defines a complete listener for a parse tree produced by PulseParser.
class PulseListener(ParseTreeListener):

    # Enter a parse tree produced by PulseParser#program.
    def enterProgram(self, ctx:PulseParser.ProgramContext):
        pass

    # Exit a parse tree produced by PulseParser#program.
    def exitProgram(self, ctx:PulseParser.ProgramContext):
        pass


    # Enter a parse tree produced by PulseParser#line.
    def enterLine(self, ctx:PulseParser.LineContext):
        pass

    # Exit a parse tree produced by PulseParser#line.
    def exitLine(self, ctx:PulseParser.LineContext):
        pass


    # Enter a parse tree produced by PulseParser#instruction.
    def enterInstruction(self, ctx:PulseParser.InstructionContext):
        pass

    # Exit a parse tree produced by PulseParser#instruction.
    def exitInstruction(self, ctx:PulseParser.InstructionContext):
        pass


    # Enter a parse tree produced by PulseParser#operandList.
    def enterOperandList(self, ctx:PulseParser.OperandListContext):
        pass

    # Exit a parse tree produced by PulseParser#operandList.
    def exitOperandList(self, ctx:PulseParser.OperandListContext):
        pass


    # Enter a parse tree produced by PulseParser#operand.
    def enterOperand(self, ctx:PulseParser.OperandContext):
        pass

    # Exit a parse tree produced by PulseParser#operand.
    def exitOperand(self, ctx:PulseParser.OperandContext):
        pass


    # Enter a parse tree produced by PulseParser#mnemonic.
    def enterMnemonic(self, ctx:PulseParser.MnemonicContext):
        pass

    # Exit a parse tree produced by PulseParser#mnemonic.
    def exitMnemonic(self, ctx:PulseParser.MnemonicContext):
        pass



del PulseParser