// compiler.js
// Main entry point for compiling Pulse0 source to pcode using the ANTLR4-generated parser.

const antlr4 = require('antlr4');
const Pulse0Lexer = require('./parser/Pulse0Lexer').Pulse0Lexer;
const Pulse0Parser = require('./parser/Pulse0Parser').Pulse0Parser;
const Pulse0Visitor = require('./parser/Pulse0Visitor').Pulse0Visitor;
const CodeGen = require('./codegen');
const fs = require('fs');

function compile(source) {
    const chars = new antlr4.InputStream(source);
    const lexer = new Pulse0Lexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new Pulse0Parser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.program();
    const codegen = new CodeGen();
    return codegen.visit(tree);
}

if (require.main === module) {
    const inputFile = process.argv[2];
    if (!inputFile) {
        console.error('Usage: node compiler.js <source.pulse0>');
        process.exit(1);
    }
    const source = fs.readFileSync(inputFile, 'utf8');
    const pcode = compile(source);
    console.log(pcode);
}

module.exports = { compile };