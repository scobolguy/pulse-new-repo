# Generated from Pulse.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .PulseParser import PulseParser
else:
    from PulseParser import PulseParser

# This class defines a complete generic visitor for a parse tree produced by PulseParser.

class PulseVisitor(ParseTreeVisitor):

    # Visit a parse tree produced by PulseParser#program.
    def visitProgram(self, ctx:PulseParser.ProgramContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PulseParser#line.
    def visitLine(self, ctx:PulseParser.LineContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PulseParser#instruction.
    def visitInstruction(self, ctx:PulseParser.InstructionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PulseParser#operandList.
    def visitOperandList(self, ctx:PulseParser.OperandListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PulseParser#operand.
    def visitOperand(self, ctx:PulseParser.OperandContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PulseParser#mnemonic.
    def visitMnemonic(self, ctx:PulseParser.MnemonicContext):
        return self.visitChildren(ctx)



del PulseParser