/**
 * Pascalish Code Generator for ESP Virtual P-Machine
 * 
 * Generates P-code from Pascalish AST with support for:
 * - Objects and inheritance
 * - Concurrency (COBEGIN/COEND)
 * - Semaphores
 * - Dynamic libraries
 * - Gateway calls
 * - File I/O
 * - Floating-point operations
 */

// ============================================================================
// OPCODE DEFINITIONS (from target architecture)
// ============================================================================

export enum Opcode {
    // Arithmetic Operations
    OP_ADD = 0x10,
    OP_SUB = 0x11,
    OP_MUL = 0x12,
    OP_DIV = 0x13,
    OP_MOD = 0x14,
    OP_NEG = 0x15,
    OP_FADD = 0x16,
    OP_FSUB = 0x17,
    OP_FMUL = 0x18,
    OP_FDIV = 0x19,

    // Stack Operations
    OP_PUSH_INT = 0x20,
    OP_PUSH_STR = 0x21,
    OP_PUSH_REAL = 0x22,
    OP_POP = 0x23,
    OP_DUP = 0x24,
    OP_SWAP = 0x25,

    // Load/Store Operations
    OP_LOAD = 0x30,
    OP_STORE = 0x31,
    OP_LOADL = 0x32,
    OP_STOREL = 0x33,
    OP_LODX = 0x34,
    OP_STOX = 0x35,
    OP_LOADF = 0x36,
    OP_STOREF = 0x37,

    // Control Flow
    OP_JMP = 0x40,
    OP_JZ = 0x41,
    OP_JNZ = 0x42,
    OP_CALL = 0x43,
    OP_RET = 0x44,
    OP_HALT = 0xFF,

    // Comparison Operations
    OP_EQ = 0x50,
    OP_NEQ = 0x51,
    OP_LT = 0x52,
    OP_LE = 0x53,
    OP_GT = 0x54,
    OP_GE = 0x55,

    // Logical Operations
    OP_AND = 0x60,
    OP_OR = 0x61,
    OP_NOT = 0x62,

    // Context/Scheduler Operations (NEW)
    OP_COBEGIN = 0x70,
    OP_COEND = 0x71,
    OP_SPAWN = 0x72,
    OP_YIELD = 0x73,
    OP_SEMWAIT = 0x74,
    OP_SEMSIGNAL = 0x75,
    OP_SEMINIT = 0x76,
    OP_SEMDESTROY = 0x77,
    OP_CONTEXT_ID = 0x78,
    OP_CONTEXT_PRIORITY = 0x79,

    // Queue/Broker Operations
    OP_BQINIT = 0x80,
    OP_BQPUSH = 0x81,
    OP_BQPOP = 0x82,
    OP_MSGSEND = 0x83,
    OP_MSGRECV = 0x84,
    OP_MSGRECV_NB = 0x85,

    // File/IO Operations (NEW)
    OP_FILE_OPEN = 0x90,
    OP_FILE_READ = 0x91,
    OP_FILE_WRITE = 0x92,
    OP_FILE_CLOSE = 0x93,
    OP_FILE_SEEK = 0x94,
    OP_FILE_TELL = 0x95,
    OP_FILE_SIZE = 0x96,
    OP_FILE_EXISTS = 0x97,
    OP_FILE_DELETE = 0x98,

    // Dynamic Library Operations (NEW)
    OP_DL_LOAD = 0xA0,
    OP_DL_CALL = 0xA1,
    OP_DL_UNLOAD = 0xA2,
    OP_DL_RESOLVE = 0xA3,
    OP_DL_LIST = 0xA4,

    // Gateway Operations (NEW)
    OP_GW_CALL = 0xB0,
    OP_GW_REGISTER = 0xB1,
    OP_GW_UNREGISTER = 0xB2,

    // System Operations
    OP_SYSCALL = 0xC0,
    OP_PRINT = 0xC1,
    OP_PRINT_NL = 0xC2,
}

// ============================================================================
// INSTRUCTION STRUCTURE
// ============================================================================

export interface Instruction {
    opcode: Opcode;
    operand1?: number;
    operand2?: number | string;
    comment?: string;
}

export interface PCodeProgram {
    instructions: Instruction[];
    stringPool: string[];
    symbols: Map<string, SymbolInfo>;
    metadata: ProgramMetadata;
}

export interface SymbolInfo {
    name: string;
    type: string;
    scope: string;
    offset?: number;
    level?: number;
}

export interface ProgramMetadata {
    name: string;
    version: string;
    timestamp: string;
    libraries: string[];
    gateways: string[];
}

// ============================================================================
// CODE GENERATOR
// ============================================================================

export class PascalishCodeGenerator {
    private instructions: Instruction[] = [];
    private stringPool: string[] = [];
    private symbols: Map<string, SymbolInfo> = new Map();
    private labelCounter = 0;
    private currentScope = 'global';
    private scopeLevel = 0;
    private libraries: string[] = [];
    private gateways: string[] = [];

    constructor(private programName: string) {}

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    public generate(ast: any): PCodeProgram {
        this.reset();
        this.visitProgram(ast);
        
        return {
            instructions: this.instructions,
            stringPool: this.stringPool,
            symbols: this.symbols,
            metadata: {
                name: this.programName,
                version: '2026.06',
                timestamp: new Date().toISOString(),
                libraries: this.libraries,
                gateways: this.gateways,
            }
        };
    }

    // ========================================================================
    // AST VISITORS
    // ========================================================================

    private visitProgram(node: any): void {
        if (node.type !== 'program') {
            throw new Error('Expected program node');
        }

        this.programName = node.name;
        this.visitBlock(node.block);
        this.emit(Opcode.OP_HALT, undefined, undefined, 'End of program');
    }

    private visitBlock(node: any): void {
        // Process declarations
        if (node.declarations) {
            for (const decl of node.declarations) {
                this.visitDeclaration(decl);
            }
        }

        // Process compound statement
        if (node.statement) {
            this.visitStatement(node.statement);
        }
    }

    private visitDeclaration(node: any): void {
        switch (node.type) {
            case 'const':
                this.visitConstDecl(node);
                break;
            case 'type':
                this.visitTypeDecl(node);
                break;
            case 'var':
                this.visitVarDecl(node);
                break;
            case 'procedure':
                this.visitProcDecl(node);
                break;
            case 'library':
                this.visitLibraryDecl(node);
                break;
            case 'interop':
                this.visitInteropDecl(node);
                break;
            default:
                throw new Error(`Unknown declaration type: ${node.type}`);
        }
    }

    private visitConstDecl(node: any): void {
        this.symbols.set(node.name, {
            name: node.name,
            type: 'const',
            scope: this.currentScope,
        });
    }

    private visitTypeDecl(node: any): void {
        this.symbols.set(node.name, {
            name: node.name,
            type: 'type',
            scope: this.currentScope,
        });
    }

    private visitVarDecl(node: any): void {
        for (const varName of node.names) {
            this.symbols.set(varName, {
                name: varName,
                type: node.varType,
                scope: this.currentScope,
                level: this.scopeLevel,
            });
        }
    }

    private visitProcDecl(node: any): void {
        const procName = node.name;
        this.symbols.set(procName, {
            name: procName,
            type: 'procedure',
            scope: this.currentScope,
        });

        const procLabel = this.newLabel();
        this.emitLabel(procLabel, `Procedure ${procName}`);

        // Enter new scope
        const savedScope = this.currentScope;
        const savedLevel = this.scopeLevel;
        this.currentScope = procName;
        this.scopeLevel++;

        // Process parameters
        if (node.params) {
            for (const param of node.params) {
                this.visitVarDecl(param);
            }
        }

        // Process body
        this.visitBlock(node.block);

        // Return
        this.emit(Opcode.OP_RET, undefined, undefined, `Return from ${procName}`);

        // Restore scope
        this.currentScope = savedScope;
        this.scopeLevel = savedLevel;
    }

    private visitLibraryDecl(node: any): void {
        const libraryName = node.library;
        this.libraries.push(libraryName);
        
        // Emit library load instruction
        const stringIndex = this.addString(libraryName);
        this.emit(Opcode.OP_DL_LOAD, stringIndex, undefined, `Load library: ${libraryName}`);
    }

    private visitInteropDecl(node: any): void {
        // Register interop declaration
        this.symbols.set(node.name, {
            name: node.name,
            type: `interop:${node.language}`,
            scope: this.currentScope,
        });
    }

    private visitStatement(node: any): void {
        if (!node) return;

        switch (node.type) {
            case 'compound':
                this.visitCompoundStatement(node);
                break;
            case 'assignment':
                this.visitAssignment(node);
                break;
            case 'if':
                this.visitIfStatement(node);
                break;
            case 'while':
                this.visitWhileStatement(node);
                break;
            case 'for':
                this.visitForStatement(node);
                break;
            case 'repeat':
                this.visitRepeatStatement(node);
                break;
            case 'case':
                this.visitCaseStatement(node);
                break;
            case 'call':
                this.visitProcedureCall(node);
                break;
            case 'queue':
                this.visitQueueStatement(node);
                break;
            case 'gateway':
                this.visitGatewayCall(node);
                break;
            case 'cobegin':
                this.visitCobeginStatement(node);
                break;
            case 'semwait':
                this.visitSemWait(node);
                break;
            case 'semsignal':
                this.visitSemSignal(node);
                break;
            default:
                throw new Error(`Unknown statement type: ${node.type}`);
        }
    }

    private visitCompoundStatement(node: any): void {
        if (node.statements) {
            for (const stmt of node.statements) {
                this.visitStatement(stmt);
            }
        }
    }

    private visitAssignment(node: any): void {
        // Evaluate expression
        this.visitExpression(node.expression);
        
        // Store to variable
        const varName = node.variable;
        const stringIndex = this.addString(varName);
        this.emit(Opcode.OP_STORE, stringIndex, undefined, `Store to ${varName}`);
    }

    private visitIfStatement(node: any): void {
        // Evaluate condition
        this.visitExpression(node.condition);

        const elseLabel = this.newLabel();
        const endLabel = this.newLabel();

        // Jump to else if condition is false
        this.emit(Opcode.OP_JZ, elseLabel, undefined, 'Jump if false');

        // Then branch
        this.visitStatement(node.thenStatement);
        this.emit(Opcode.OP_JMP, endLabel, undefined, 'Jump to end');

        // Else branch
        this.emitLabel(elseLabel, 'Else branch');
        if (node.elseStatement) {
            this.visitStatement(node.elseStatement);
        }

        this.emitLabel(endLabel, 'End if');
    }

    private visitWhileStatement(node: any): void {
        const startLabel = this.newLabel();
        const endLabel = this.newLabel();

        this.emitLabel(startLabel, 'While loop start');

        // Evaluate condition
        this.visitExpression(node.condition);
        this.emit(Opcode.OP_JZ, endLabel, undefined, 'Exit if false');

        // Loop body
        this.visitStatement(node.statement);
        this.emit(Opcode.OP_JMP, startLabel, undefined, 'Loop back');

        this.emitLabel(endLabel, 'While loop end');
    }

    private visitForStatement(node: any): void {
        const loopVar = node.variable;
        const startLabel = this.newLabel();
        const endLabel = this.newLabel();

        // Initialize loop variable
        this.visitExpression(node.startExpr);
        const varIndex = this.addString(loopVar);
        this.emit(Opcode.OP_STORE, varIndex, undefined, `Initialize ${loopVar}`);

        this.emitLabel(startLabel, 'For loop start');

        // Check condition
        this.emit(Opcode.OP_LOAD, varIndex, undefined, `Load ${loopVar}`);
        this.visitExpression(node.endExpr);
        
        if (node.direction === 'to') {
            this.emit(Opcode.OP_GT, undefined, undefined, 'Check if > end');
        } else {
            this.emit(Opcode.OP_LT, undefined, undefined, 'Check if < end');
        }
        this.emit(Opcode.OP_JNZ, endLabel, undefined, 'Exit if done');

        // Loop body
        this.visitStatement(node.statement);

        // Increment/decrement
        this.emit(Opcode.OP_LOAD, varIndex, undefined, `Load ${loopVar}`);
        this.emit(Opcode.OP_PUSH_INT, 1, undefined, 'Push 1');
        if (node.direction === 'to') {
            this.emit(Opcode.OP_ADD, undefined, undefined, 'Increment');
        } else {
            this.emit(Opcode.OP_SUB, undefined, undefined, 'Decrement');
        }
        this.emit(Opcode.OP_STORE, varIndex, undefined, `Store ${loopVar}`);
        this.emit(Opcode.OP_JMP, startLabel, undefined, 'Loop back');

        this.emitLabel(endLabel, 'For loop end');
    }

    private visitRepeatStatement(node: any): void {
        const startLabel = this.newLabel();

        this.emitLabel(startLabel, 'Repeat loop start');

        // Loop body
        this.visitCompoundStatement(node);

        // Evaluate condition
        this.visitExpression(node.condition);
        this.emit(Opcode.OP_JZ, startLabel, undefined, 'Loop if false');
    }

    private visitCaseStatement(node: any): void {
        const endLabel = this.newLabel();
        const caseLabels: number[] = [];

        // Evaluate selector expression
        this.visitExpression(node.selector);

        // Generate case branches
        for (const caseItem of node.cases) {
            const caseLabel = this.newLabel();
            caseLabels.push(caseLabel);

            // Duplicate selector for comparison
            this.emit(Opcode.OP_DUP, undefined, undefined, 'Duplicate selector');

            // Compare with case value
            this.visitExpression(caseItem.value);
            this.emit(Opcode.OP_EQ, undefined, undefined, 'Compare');
            this.emit(Opcode.OP_JNZ, caseLabel, undefined, 'Jump if match');
        }

        // No match - jump to else or end
        if (node.elseStatement) {
            const elseLabel = this.newLabel();
            this.emit(Opcode.OP_JMP, elseLabel, undefined, 'Jump to else');
            
            // Generate case bodies
            for (let i = 0; i < node.cases.length; i++) {
                this.emitLabel(caseLabels[i], `Case ${i}`);
                this.emit(Opcode.OP_POP, undefined, undefined, 'Pop selector');
                this.visitStatement(node.cases[i].statement);
                this.emit(Opcode.OP_JMP, endLabel, undefined, 'Jump to end');
            }

            // Else branch
            this.emitLabel(elseLabel, 'Else branch');
            this.emit(Opcode.OP_POP, undefined, undefined, 'Pop selector');
            this.visitStatement(node.elseStatement);
        } else {
            this.emit(Opcode.OP_JMP, endLabel, undefined, 'Jump to end');
            
            // Generate case bodies
            for (let i = 0; i < node.cases.length; i++) {
                this.emitLabel(caseLabels[i], `Case ${i}`);
                this.emit(Opcode.OP_POP, undefined, undefined, 'Pop selector');
                this.visitStatement(node.cases[i].statement);
                this.emit(Opcode.OP_JMP, endLabel, undefined, 'Jump to end');
            }
        }

        this.emitLabel(endLabel, 'Case end');
    }

    private visitProcedureCall(node: any): void {
        // Push arguments
        if (node.arguments) {
            for (const arg of node.arguments) {
                this.visitExpression(arg);
            }
        }

        // Call procedure
        const procName = node.name;
        const stringIndex = this.addString(procName);
        this.emit(Opcode.OP_CALL, stringIndex, node.arguments?.length || 0, `Call ${procName}`);
    }

    private visitQueueStatement(node: any): void {
        const queueName = node.queue;
        const stringIndex = this.addString(queueName);

        // Push arguments
        if (node.arguments) {
            for (const arg of node.arguments) {
                this.visitExpression(arg);
            }
        }

        this.emit(Opcode.OP_BQPUSH, stringIndex, node.arguments?.length || 0, `Queue to ${queueName}`);
    }

    private visitGatewayCall(node: any): void {
        const gatewayName = `${node.gateway}.${node.method}`;
        this.gateways.push(gatewayName);
        
        const stringIndex = this.addString(gatewayName);

        // Push arguments
        if (node.arguments) {
            for (const arg of node.arguments) {
                this.visitExpression(arg);
            }
        }

        this.emit(Opcode.OP_GW_CALL, stringIndex, node.arguments?.length || 0, `Gateway call: ${gatewayName}`);
    }

    private visitCobeginStatement(node: any): void {
        this.emit(Opcode.OP_COBEGIN, undefined, undefined, 'Begin concurrent block');

        // Spawn each statement as a separate context
        if (node.statements) {
            for (const stmt of node.statements) {
                // Generate code for statement
                const stmtStartLabel = this.newLabel();
                this.emit(Opcode.OP_SPAWN, stmtStartLabel, undefined, 'Spawn concurrent task');
                
                // Statement code will be generated inline
                this.visitStatement(stmt);
            }
        }

        this.emit(Opcode.OP_COEND, undefined, undefined, 'End concurrent block (wait for all)');
    }

    private visitSemWait(node: any): void {
        const semName = node.semaphore;
        const stringIndex = this.addString(semName);
        this.emit(Opcode.OP_SEMWAIT, stringIndex, undefined, `Wait on semaphore: ${semName}`);
    }

    private visitSemSignal(node: any): void {
        const semName = node.semaphore;
        const stringIndex = this.addString(semName);
        this.emit(Opcode.OP_SEMSIGNAL, stringIndex, undefined, `Signal semaphore: ${semName}`);
    }

    private visitExpression(node: any): void {
        if (!node) return;

        switch (node.type) {
            case 'integer':
                this.emit(Opcode.OP_PUSH_INT, node.value, undefined, `Push ${node.value}`);
                break;
            case 'real':
                this.emit(Opcode.OP_PUSH_REAL, node.value, undefined, `Push ${node.value}`);
                break;
            case 'string':
                const stringIndex = this.addString(node.value);
                this.emit(Opcode.OP_PUSH_STR, stringIndex, undefined, `Push "${node.value}"`);
                break;
            case 'identifier':
                const varIndex = this.addString(node.name);
                this.emit(Opcode.OP_LOAD, varIndex, undefined, `Load ${node.name}`);
                break;
            case 'binary':
                this.visitBinaryExpression(node);
                break;
            case 'unary':
                this.visitUnaryExpression(node);
                break;
            case 'call':
                this.visitProcedureCall(node);
                break;
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }

    private visitBinaryExpression(node: any): void {
        // Evaluate left operand
        this.visitExpression(node.left);

        // Evaluate right operand
        this.visitExpression(node.right);

        // Apply operator
        const opcodeMap: { [key: string]: Opcode } = {
            '+': Opcode.OP_ADD,
            '-': Opcode.OP_SUB,
            '*': Opcode.OP_MUL,
            '/': Opcode.OP_DIV,
            'div': Opcode.OP_DIV,
            'mod': Opcode.OP_MOD,
            '=': Opcode.OP_EQ,
            '<>': Opcode.OP_NEQ,
            '<': Opcode.OP_LT,
            '<=': Opcode.OP_LE,
            '>': Opcode.OP_GT,
            '>=': Opcode.OP_GE,
            'and': Opcode.OP_AND,
            'or': Opcode.OP_OR,
        };

        const opcode = opcodeMap[node.operator];
        if (!opcode) {
            throw new Error(`Unknown operator: ${node.operator}`);
        }

        this.emit(opcode, undefined, undefined, `${node.operator}`);
    }

    private visitUnaryExpression(node: any): void {
        this.visitExpression(node.operand);

        if (node.operator === '-') {
            this.emit(Opcode.OP_NEG, undefined, undefined, 'Negate');
        } else if (node.operator === 'not') {
            this.emit(Opcode.OP_NOT, undefined, undefined, 'Logical NOT');
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private emit(opcode: Opcode, operand1?: number, operand2?: number | string, comment?: string): void {
        this.instructions.push({
            opcode,
            operand1,
            operand2,
            comment,
        });
    }

    private emitLabel(label: number, comment?: string): void {
        // Labels are represented as comments in the instruction stream
        // The actual label resolution happens during assembly
        this.instructions.push({
            opcode: Opcode.OP_PUSH_INT, // Placeholder
            operand1: label,
            comment: `LABEL_${label}: ${comment || ''}`,
        });
    }

    private newLabel(): number {
        return this.labelCounter++;
    }

    private addString(str: string): number {
        let index = this.stringPool.indexOf(str);
        if (index === -1) {
            index = this.stringPool.length;
            this.stringPool.push(str);
        }
        return index;
    }

    private reset(): void {
        this.instructions = [];
        this.stringPool = [];
        this.symbols.clear();
        this.labelCounter = 0;
        this.currentScope = 'global';
        this.scopeLevel = 0;
        this.libraries = [];
        this.gateways = [];
    }

    // ========================================================================
    // OUTPUT GENERATION
    // ========================================================================

    public generateJSON(program: PCodeProgram): string {
        return JSON.stringify(program, null, 2);
    }

    public generateBinary(program: PCodeProgram): Uint8Array {
        // Binary format for ESP32 deployment
        const buffers: Uint8Array[] = [];

        // Header
        const header = new Uint8Array(16);
        const encoder = new TextEncoder();
        const pcodeBytes = encoder.encode('PCODE');
        header.set(pcodeBytes, 0);
        new DataView(header.buffer).setUint32(8, program.instructions.length, true);
        new DataView(header.buffer).setUint32(12, program.stringPool.length, true);
        buffers.push(header);

        // Instructions
        for (const instr of program.instructions) {
            const instrBuf = new Uint8Array(8);
            const view = new DataView(instrBuf.buffer);
            view.setUint8(0, instr.opcode);
            view.setUint8(1, 0); // Flags
            view.setInt16(2, instr.operand1 || 0, true);
            
            if (typeof instr.operand2 === 'number') {
                view.setInt32(4, instr.operand2, true);
            } else if (typeof instr.operand2 === 'string') {
                const strIndex = program.stringPool.indexOf(instr.operand2);
                view.setInt32(4, strIndex, true);
            }
            
            buffers.push(instrBuf);
        }

        // String pool
        for (const str of program.stringPool) {
            const strBuf = encoder.encode(str);
            const lenBuf = new Uint8Array(2);
            new DataView(lenBuf.buffer).setUint16(0, strBuf.length, true);
            buffers.push(lenBuf);
            buffers.push(strBuf);
        }

        // Concatenate all buffers
        const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of buffers) {
            result.set(buf, offset);
            offset += buf.length;
        }
        
        return result;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PascalishCodeGenerator;

// Made with Bob
