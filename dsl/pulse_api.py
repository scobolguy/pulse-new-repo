from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, PlainTextResponse
from antlr4 import *
from PulseLexer import PulseLexer
from PulseParser import PulseParser
from PulseParserVisitor import PulseParserVisitor
import tempfile
import os

app = FastAPI()

class PcodeGenerator(PulseParserVisitor):
    def __init__(self):
        self.instructions = []

    def visitProgram(self, ctx):
        for line in ctx.line():
            self.visit(line)
        return self.instructions

    def visitLine(self, ctx):
        if ctx.instruction():
            self.visit(ctx.instruction())

    def visitInstruction(self, ctx):
        mnemonic = ctx.mnemonic().getText()
        operands = []
        if ctx.operandList():
            for op in ctx.operandList().operand():
                operands.append(op.getText())
        self.instructions.append((mnemonic, operands))

@app.post("/compile", response_class=FileResponse)
async def compile_pulse(file: UploadFile = File(...)):
    # Save uploaded file to a temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pulse") as temp_in:
        temp_in.write(await file.read())
        temp_in_path = temp_in.name

    # Parse and generate pcode
    input_stream = FileStream(temp_in_path)
    lexer = PulseLexer(input_stream)
    stream = CommonTokenStream(lexer)
    parser = PulseParser(stream)
    tree = parser.program()
    generator = PcodeGenerator()
    pcode = generator.visit(tree)

    # Write pcode to temp output file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pcode", mode="w") as temp_out:
        for instr in pcode:
            temp_out.write(f"{instr[0]} {' '.join(instr[1])}\n")
        temp_out_path = temp_out.name

    os.remove(temp_in_path)
    return FileResponse(temp_out_path, filename="output.pcode")

@app.get("/")
def root():
    return PlainTextResponse("Pulse Compiler API. POST /compile with a .pulse file.")
