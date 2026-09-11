import antlr4 from 'antlr4';
import Cobolish85Lexer from '../grammar/generated-modern/Cobolish85Lexer.js';
import Cobolish85Parser from '../grammar/generated-modern/Cobolish85Parser.js';
import Cobolish85Visitor from '../grammar/generated-modern/Cobolish85Visitor.js';
import { parsePicture } from './cobol-picture.mjs';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg) {
    this.errors.push(`line ${line}:${column} ${msg}`);
  }
}

function text(ctx) {
  return ctx ? ctx.getText() : '';
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// COBOL names are case-insensitive and hyphenated; pcode names are neither.
function storageName(name) {
  return String(name || '').trim().toUpperCase().replace(/-/g, '_');
}

const COMPARATORS = {
  '=': 'EQ',
  '<>': 'NEQ',
  'NOT=': 'NEQ',
  '<': 'LT',
  '<=': 'LE',
  '>': 'GT',
  '>=': 'GE'
};

/**
 * Walks a Cobolish parse tree and emits pcode. Numeric data items are compiled as
 * fixed-point decimals whose scale comes from their PICTURE, so arithmetic follows
 * COBOL rules: the receiving field decides truncation, and ROUNDED is half-up.
 */
class CobolishCodegen extends Cobolish85Visitor {
  constructor() {
    super();
    this.lines = [];
    this.labelId = 0;
    this.fields = new Map();
    this.paragraphs = new Map();
    this.sizeErrorDepth = 0;
  }

  emit(line) {
    this.lines.push(line);
  }

  nextLabel(prefix) {
    this.labelId += 1;
    return `${prefix}_${this.labelId}`;
  }

  fieldOf(name) {
    return this.fields.get(storageName(name)) || null;
  }

  collectDataItems(tree) {
    const entries = [];
    const walk = node => {
      if (!node) return;
      if (node.constructor?.name === 'DataDescriptionEntryContext') entries.push(node);
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);

    for (const entry of entries) {
      const name = storageName(entry.IDENTIFIER()?.getText());
      if (!name) continue;
      let picture = null;
      for (const clause of entry.dataClause() || []) {
        const pictureCtx = clause.pictureClause && clause.pictureClause();
        if (pictureCtx) picture = parsePicture(text(pictureCtx));
      }
      this.fields.set(name, picture || { kind: 'decimal', precision: 18, scale: 0 });
    }
  }

  // Every numeric value on the stack is a decimal, so mixed-scale arithmetic is exact.
  emitLiteral(ctx) {
    const raw = text(ctx);
    if (ctx.stringLiteral && ctx.stringLiteral()) {
      this.emit(`PUSH_STR ${JSON.stringify(raw.slice(1, -1))}`);
      return;
    }
    if (/^(SPACE|SPACES|QUOTES)$/i.test(raw)) {
      this.emit('PUSH_STR ""');
      return;
    }
    if (/^(ZERO|ZEROS|ZEROES)$/i.test(raw)) {
      this.emit('PUSH_DEC 0 0');
      return;
    }
    if (/^TRUE$/i.test(raw)) {
      this.emit('PUSH_INT 1');
      return;
    }
    if (/^FALSE$/i.test(raw)) {
      this.emit('PUSH_INT 0');
      return;
    }
    const [whole, fraction = ''] = raw.replace(/^\+/, '').split('.');
    this.emit(`PUSH_DEC ${whole}${fraction} ${fraction.length}`);
  }

  emitFactor(ctx) {
    if (ctx.literal && ctx.literal()) {
      this.emitLiteral(ctx.literal());
      return;
    }
    if (ctx.expression && ctx.expression()) {
      this.emitExpression(ctx.expression());
      return;
    }
    if (ctx.IDENTIFIER && ctx.IDENTIFIER()) {
      this.emit(`LOAD ${storageName(ctx.IDENTIFIER().getText())}`);
      return;
    }
    this.emit('PUSH_DEC 0 0');
  }

  emitTerm(ctx) {
    const factors = asArray(ctx.factor());
    if (factors.length === 0) return;
    this.emitFactor(factors[0]);
    for (let index = 1; index < factors.length; index += 1) {
      this.emitFactor(factors[index]);
      const operator = text(ctx.getChild((2 * index) - 1)).toUpperCase();
      this.emit(operator === '*' ? 'MUL' : operator === '/' ? 'DIV' : 'AND');
    }
  }

  emitExpression(ctx) {
    const terms = asArray(ctx.term());
    if (terms.length === 0) return;
    this.emitTerm(terms[0]);
    for (let index = 1; index < terms.length; index += 1) {
      this.emitTerm(terms[index]);
      const operator = text(ctx.getChild((2 * index) - 1)).toUpperCase();
      this.emit(operator === '+' ? 'ADD' : operator === '-' ? 'SUB' : 'OR');
    }
  }

  emitRelation(ctx) {
    const expressions = asArray(ctx.expression());
    if (expressions.length === 0) return;
    this.emitExpression(expressions[0]);
    if (expressions.length < 2) return;
    this.emitExpression(expressions[1]);
    const symbol = text(ctx.comparator()).toUpperCase();
    this.emit(COMPARATORS[symbol] || 'EQ');
  }

  emitCondition(ctx) {
    if (ctx.relation && ctx.relation()) {
      this.emitRelation(ctx.relation());
      return;
    }
    const conditions = asArray(ctx.condition());
    if (text(ctx.getChild(0)).toUpperCase() === 'NOT') {
      this.emitCondition(conditions[0]);
      this.emit('NOT');
      return;
    }
    if (text(ctx.getChild(0)) === '(') {
      this.emitCondition(conditions[0]);
      return;
    }
    if (conditions.length === 2) {
      this.emitCondition(conditions[0]);
      this.emitCondition(conditions[1]);
      this.emit(text(ctx.getChild(1)).toUpperCase() === 'OR' ? 'OR' : 'AND');
      return;
    }
    this.emit('PUSH_INT 0');
  }

  // The receiving field's PICTURE fixes the stored scale, as COBOL requires.
  storeInto(name, rounded) {
    const target = storageName(name);
    const field = this.fieldOf(target);
    if (field && field.kind === 'decimal') {
      this.emit(`DEC_QUANT ${field.scale}${rounded ? ' ROUNDED' : ''}`);
    }
    this.emit(`STORE ${target}`);
  }

  emitSizeGuardedStore(name, rounded, sizeErrorCtx) {
    const target = storageName(name);
    const field = this.fieldOf(target);
    if (!sizeErrorCtx || !field || field.kind !== 'decimal') {
      this.storeInto(target, rounded);
      return;
    }

    // ON SIZE ERROR: keep the old value and run the handler when the result overflows.
    const handlerLabel = this.nextLabel('SIZEERR');
    const endLabel = this.nextLabel('SIZEEND');
    this.emit(`DEC_QUANT ${field.scale}${rounded ? ' ROUNDED' : ''}`);
    this.emit(`STORE __size_tmp_${target}`);
    this.emit(`LOAD __size_tmp_${target}`);
    this.emit(`DEC_FITS ${field.precision}`);
    this.emit(`JZ ${handlerLabel}`);
    this.emit(`LOAD __size_tmp_${target}`);
    this.emit(`STORE ${target}`);
    this.emit(`JMP ${endLabel}`);
    this.emit(`${handlerLabel}:`);
    for (const sentence of sizeErrorCtx.sentence() || []) this.visitSentenceNode(sentence);
    this.emit(`${endLabel}:`);
  }

  visitSentenceNode(ctx) {
    const statement = ctx.statement ? ctx.statement() : null;
    if (statement) this.emitStatement(statement);
  }

  emitStatement(ctx) {
    if (ctx.moveStatement && ctx.moveStatement()) return this.emitMove(ctx.moveStatement());
    if (ctx.computeStatement && ctx.computeStatement()) return this.emitCompute(ctx.computeStatement());
    if (ctx.addStatement && ctx.addStatement()) return this.emitArithmetic(ctx.addStatement(), 'ADD');
    if (ctx.subtractStatement && ctx.subtractStatement()) return this.emitArithmetic(ctx.subtractStatement(), 'SUB');
    if (ctx.multiplyStatement && ctx.multiplyStatement()) return this.emitArithmetic(ctx.multiplyStatement(), 'MUL');
    if (ctx.divideStatement && ctx.divideStatement()) return this.emitArithmetic(ctx.divideStatement(), 'DIV');
    if (ctx.ifStatement && ctx.ifStatement()) return this.emitIf(ctx.ifStatement());
    if (ctx.evaluateStatement && ctx.evaluateStatement()) return this.emitEvaluate(ctx.evaluateStatement());
    if (ctx.performStatement && ctx.performStatement()) return this.emitPerform(ctx.performStatement());
    if (ctx.displayStatement && ctx.displayStatement()) return this.emitDisplay(ctx.displayStatement());
    if (ctx.acceptStatement && ctx.acceptStatement()) return this.emitAccept(ctx.acceptStatement());
    if (ctx.stopRunStatement && ctx.stopRunStatement()) return this.emit('HALT');
    // GOBACK, CONTINUE and the I/O verbs are accepted but emit nothing.
    return undefined;
  }

  emitMove(ctx) {
    const source = ctx.moveSource();
    if (source.literal && source.literal()) this.emitLiteral(source.literal());
    else this.emit(`LOAD ${storageName(text(source))}`);

    const targets = ctx.identifierList().IDENTIFIER() || [];
    targets.forEach((target, index) => {
      if (index < targets.length - 1) this.emit('DUP');
      this.storeInto(target.getText(), false);
    });
  }

  emitCompute(ctx) {
    this.emitExpression(ctx.expression());
    const rounded = Boolean(ctx.ROUNDED && ctx.ROUNDED());
    const sizeError = ctx.sizeErrorClause && ctx.sizeErrorClause();
    this.emitSizeGuardedStore(ctx.IDENTIFIER().getText(), rounded, sizeError);
  }

  // ADD x TO y is `y := y + x`; SUBTRACT/MULTIPLY/DIVIDE follow the same shape.
  emitArithmetic(ctx, opcode) {
    const rounded = Boolean(ctx.ROUNDED && ctx.ROUNDED());
    const sizeError = ctx.sizeErrorClause && ctx.sizeErrorClause();
    for (const target of ctx.identifierList().IDENTIFIER() || []) {
      const name = storageName(target.getText());
      this.emit(`LOAD ${name}`);
      this.emitExpression(ctx.expression());
      this.emit(opcode);
      this.emitSizeGuardedStore(name, rounded, sizeError);
    }
  }

  emitIf(ctx) {
    const elseLabel = this.nextLabel('COB_ELSE');
    const endLabel = this.nextLabel('COB_ENDIF');
    this.emitCondition(ctx.condition());
    this.emit(`JZ ${elseLabel}`);
    for (const sentence of ctx.sentence() || []) this.visitSentenceNode(sentence);
    this.emit(`JMP ${endLabel}`);
    this.emit(`${elseLabel}:`);
    const elseClause = ctx.elseClause && ctx.elseClause();
    if (elseClause) {
      for (const sentence of elseClause.sentence() || []) this.visitSentenceNode(sentence);
    }
    this.emit(`${endLabel}:`);
  }

  emitEvaluate(ctx) {
    const endLabel = this.nextLabel('COB_ENDEVAL');
    const subjects = ctx.evaluateSubject() || [];
    for (const whenClause of ctx.whenClause() || []) {
      const nextLabel = this.nextLabel('COB_WHEN');
      const conditions = whenClause.whenCondition() || [];
      if (conditions.length === 0) {
        // WHEN OTHER
        for (const sentence of whenClause.sentence() || []) this.visitSentenceNode(sentence);
        this.emit(`JMP ${endLabel}`);
        this.emit(`${nextLabel}:`);
        continue;
      }
      this.emitWhenCondition(conditions[0], subjects[0]);
      this.emit(`JZ ${nextLabel}`);
      for (const sentence of whenClause.sentence() || []) this.visitSentenceNode(sentence);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${nextLabel}:`);
    }
    this.emit(`${endLabel}:`);
  }

  emitWhenCondition(ctx, subject) {
    const expressions = ctx.expression() || [];
    if (expressions.length === 2) {
      this.emitExpression(expressions[0]);
      this.emitExpression(expressions[1]);
      this.emit(COMPARATORS[text(ctx.comparator()).toUpperCase()] || 'EQ');
      return;
    }
    // A bare value is compared against the EVALUATE subject.
    if (subject?.expression && subject.expression()) this.emitExpression(subject.expression());
    else this.emit('PUSH_INT 0');

    if (ctx.literal && ctx.literal()) this.emitLiteral(ctx.literal());
    else if (ctx.IDENTIFIER && ctx.IDENTIFIER()) this.emit(`LOAD ${storageName(ctx.IDENTIFIER().getText())}`);
    else if (expressions.length === 1) this.emitExpression(expressions[0]);
    else this.emit('PUSH_INT 0');
    this.emit('EQ');
  }

  emitPerform(ctx) {
    const target = ctx.performTarget();
    const inline = target.inlinePerform && target.inlinePerform();
    if (inline) {
      const startLabel = this.nextLabel('COB_PERF');
      const endLabel = this.nextLabel('COB_PERFEND');
      this.emit(`${startLabel}:`);
      this.emitCondition(inline.condition());
      this.emit(`JZ ${endLabel}`);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${endLabel}:`);
      return;
    }

    const untilClause = (ctx.performClause() || []).find(clause => clause.condition && clause.condition());
    const paragraph = storageName(text(target));
    if (untilClause) {
      // PERFORM <para> UNTIL <cond>: loop until the condition becomes true.
      const startLabel = this.nextLabel('COB_UNTIL');
      const endLabel = this.nextLabel('COB_UNTILEND');
      this.emit(`${startLabel}:`);
      this.emitCondition(untilClause.condition());
      this.emit(`JZ ${this.nextLabelPeek('COB_BODY')}`);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${this.lastPeekedLabel}:`);
      this.emit(`CALL PARA_${paragraph} 0`);
      this.emit(`JMP ${startLabel}`);
      this.emit(`${endLabel}:`);
      return;
    }
    this.emit(`CALL PARA_${paragraph} 0`);
  }

  nextLabelPeek(prefix) {
    this.lastPeekedLabel = this.nextLabel(prefix);
    return this.lastPeekedLabel;
  }

  emitDisplay(ctx) {
    for (const item of ctx.displayItem() || []) {
      if (item.literal && item.literal()) this.emitLiteral(item.literal());
      else this.emit(`LOAD ${storageName(text(item))}`);
      this.emit('PRINT');
    }
    this.emit('PRINT_NL');
  }

  emitAccept(ctx) {
    for (const target of ctx.identifierList().IDENTIFIER() || []) {
      this.emit('LOAD_NAME src');
      this.emit(`STORE ${storageName(target.getText())}`);
    }
  }

  build(tree) {
    this.collectDataItems(tree);

    const paragraphs = [];
    const topLevel = [];
    const walk = node => {
      if (!node) return;
      const kind = node.constructor?.name;
      if (kind === 'ParagraphContext') {
        paragraphs.push(node);
        return;
      }
      if (kind === 'ProcedureDivisionContext') {
        for (let index = 0; index < node.getChildCount(); index += 1) {
          const child = node.getChild(index);
          if (child.constructor?.name === 'SentenceContext') topLevel.push(child);
          else walk(child);
        }
        return;
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);

    this.emit('# Auto-generated from ANTLR Cobolish grammar');
    this.emit('JMP MAIN');

    const procedures = {};
    for (const paragraph of paragraphs) {
      const label = `PARA_${storageName(text(paragraph.paragraphName()))}`;
      this.emit(`${label}:`);
      for (const sentence of paragraph.sentence() || []) this.visitSentenceNode(sentence);
      this.emit('RET');
      procedures[label] = { name: label, params: [], locals: [] };
    }

    this.emit('MAIN:');
    for (const [name, field] of this.fields) {
      if (field.kind === 'decimal') this.emit(`PUSH_DEC 0 ${field.scale}`);
      else this.emit('PUSH_STR ""');
      this.emit(`STORE ${name}`);
    }
    for (const sentence of topLevel) this.visitSentenceNode(sentence);
    this.emit('HALT');

    return {
      pcodeText: `${this.lines.join('\n')}\n`,
      globals: [...this.fields.keys()],
      fields: Object.fromEntries(this.fields),
      procedures
    };
  }
}

export function compileCobolishToPcode(sourceText) {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new Cobolish85Lexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new Cobolish85Parser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.compilationUnit();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (errors.length > 0) {
    throw new Error(`[COBOLISH] Parse failed:\n${errors.join('\n')}`);
  }

  const codegen = new CobolishCodegen();
  const built = codegen.build(tree);

  return {
    pcodeText: built.pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceLanguage: 'cobolish',
      executionModel: 'cobolish-program',
      globals: built.globals,
      fields: built.fields,
      procedures: built.procedures,
      entryLabel: 'MAIN'
    }
  };
}
