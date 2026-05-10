// codegen.js
// Walks the Pulse0 AST and emits PL/0-style pcode

const Pulse0Visitor = require('./parser/Pulse0Visitor').Pulse0Visitor;

class CodeGen extends Pulse0Visitor {
    constructor() {
        super();
        this.output = [];
        this.labelCount = 0;
    }

    emit(line) {
        this.output.push(line);
    }

    // Example: visit a program node
    visitProgram(ctx) {
        // ...visit children, emit code...
        ctx.block().accept(this);
        this.emit('HALT');
        return this.output.join('\n');
    }

    // Example: visit a block node
    visitBlock(ctx) {
        // ...handle declarations, statements...
        ctx.statement().forEach(stmt => stmt.accept(this));
    }

    // Example: visit an assignment statement
    visitAssignment(ctx) {
        // ctx.ID().getText() = ctx.expr()
        ctx.expr().accept(this);
        this.emit(`STO ${ctx.ID().getText()}`);
    }

    // Example: visit a literal expression
    visitNumber(ctx) {
        this.emit(`LIT ${ctx.getText()}`);
    }

    // Add more visit methods for other AST nodes as needed
}

module.exports = CodeGen;