import antlr4 from 'antlr4';
import Fortran77Lexer from '../grammar/generated/Fortran77Lexer.js';
import Fortran77Parser from '../grammar/generated/Fortran77Parser.js';
import Fortran77Visitor from '../grammar/generated/Fortran77Visitor.js';
import F77FormatLexer from '../grammar/generated/F77FormatLexer.js';
import F77FormatParser from '../grammar/generated/F77FormatParser.js';
import F77FormatVisitor from '../grammar/generated/F77FormatVisitor.js';
import { FortranError, logicalSource, readFixedForm } from './fixed-form.mjs';
import { parseFormatSpecification } from './format-spec.mjs';

const P = Fortran77Parser;

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(_recognizer, symbol, line, column, message) {
    this.errors.push({ symbol, line, column, message });
  }
}

const isTerminal = node => node && node.symbol !== undefined;
const children = ctx => ctx?.children ?? [];
const ruleOf = (node, parser) => (isTerminal(node) || !node ? null : parser.ruleNames[node.ruleIndex]);
const rules = (ctx, name) => children(ctx).filter(child => ruleOf(child, P) === name);
const rule = (ctx, name) => rules(ctx, name)[0] ?? null;
const tokens = (ctx, type) => children(ctx).filter(child => isTerminal(child) && child.symbol.type === type);
const has = (ctx, type) => tokens(ctx, type).length > 0;
const firstToken = node => (isTerminal(node) ? node.symbol : node.start);

function describeToken(symbol) {
  if (!symbol || symbol.type === antlr4.Token.EOF) return 'end of file';
  if (symbol.type === P.EOL) return 'end of statement';
  return `'${symbol.text}'`;
}

function friendlySyntaxMessage(error) {
  const text = error.symbol?.text ?? '';
  if (error.symbol?.type === P.UNTERMINATED_SCON) return 'Unterminated character constant';
  if (/token recognition error at: '(.)/.test(error.message)) {
    const character = /token recognition error at: '(.*)'/.exec(error.message)[1];
    return `Character ${JSON.stringify(character)} is not in the FORTRAN character set`;
  }
  if (/^mismatched input|^extraneous input|^no viable alternative|^missing/.test(error.message)) {
    const message = error.message
      .replace(/'\n'|'\\n'|'<EOF>'/g, 'end of statement')
      .replace(/ expecting \{([^}]*)\}/, (match, list) => (list.split(',').length > 6 ? '' : match));
    return `Syntax error at ${describeToken(error.symbol)}${text === '\n' ? '' : ''}: ${message}`;
  }
  return error.message;
}

export function parseFortran(source, { fileName = 'program.ftn' } = {}) {
  const statements = readFixedForm(source, { fileName });
  const { text, locate } = logicalSource(statements);
  const lexer = new Fortran77Lexer(new antlr4.InputStream(text));
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);
  const parser = new Fortran77Parser(new antlr4.CommonTokenStream(lexer));
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  const tree = parser.executableProgram();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];
  if (!statements.length) throw new FortranError(fileName, 1, 1, 'Program requires END');
  if (errors.length) {
    const error = errors.sort((a, b) => a.line - b.line || a.column - b.column)[0];
    const at = locate(error.line, error.column);
    if (error.symbol?.type === antlr4.Token.EOF && /expecting|missing/.test(error.message))
      throw new FortranError(fileName, at.line, at.column, 'Program unit requires END');
    throw new FortranError(fileName, at.line, at.column, friendlySyntaxMessage(error));
  }
  const builder = new AstBuilder(fileName, locate);
  return { units: builder.visit(tree), statements };
}

class AstBuilder extends Fortran77Visitor {
  constructor(fileName, locate) {
    super();
    this.fileName = fileName;
    this.locate = locate;
  }

  pos(node) {
    const token = firstToken(node);
    return this.locate(token.line, token.column);
  }

  fail(node, message) {
    const at = this.pos(node);
    throw new FortranError(this.fileName, at.line, at.column, message);
  }

  visitExecutableProgram(ctx) {
    return rules(ctx, 'programUnit').map(unit => this.visit(children(unit)[0]));
  }

  unitBody(ctx, unit) {
    unit.body = this.visit(rule(ctx, 'body'));
    const end = rule(ctx, 'endLine');
    unit.end = { pos: this.pos(end.END ? end.END() : end), label: this.labelOf(end) };
    return unit;
  }

  visitMainProgram(ctx) {
    const name = rule(ctx, 'name');
    return this.unitBody(ctx, {
      kind: 'program', name: name ? this.name(name) : 'MAIN', pos: this.pos(ctx), params: [], explicit: Boolean(name)
    });
  }

  visitFunctionSubprogram(ctx) {
    const spec = rule(ctx, 'typeSpec');
    return this.unitBody(ctx, {
      kind: 'function', name: this.name(rule(ctx, 'name')), pos: this.pos(ctx),
      typeSpec: spec ? this.typeSpec(spec) : null, params: this.dummies(rule(ctx, 'dummyArgList'))
    });
  }

  visitSubroutineSubprogram(ctx) {
    return this.unitBody(ctx, {
      kind: 'subroutine', name: this.name(rule(ctx, 'name')), pos: this.pos(ctx),
      params: this.dummies(rule(ctx, 'dummyArgList'))
    });
  }

  visitBlockDataSubprogram(ctx) {
    const name = rule(ctx, 'name');
    return this.unitBody(ctx, {
      kind: 'blockdata', name: name ? this.name(name) : '_BLOCKDATA', pos: this.pos(ctx), params: []
    });
  }

  dummies(ctx) {
    if (!ctx) return [];
    return rules(ctx, 'dummyArg').map(arg => {
      const name = rule(arg, 'name');
      return name ? { name: this.name(name), pos: this.pos(arg) } : { star: true, pos: this.pos(arg) };
    });
  }

  visitBody(ctx) {
    return children(ctx).map(child => this.visit(child));
  }

  labelOf(ctx) {
    const label = rule(ctx, 'label');
    return label ? String(Number(label.getText())) : '';
  }

  visitIfConstruct(ctx) {
    const head = rule(ctx, 'ifThenLine');
    const branches = [{
      cond: this.visit(rule(head, 'expression')), body: this.visit(rules(ctx, 'body')[0]),
      pos: this.pos(head.IF()), label: this.labelOf(head)
    }];
    for (const part of rules(ctx, 'elseIfPart')) {
      branches.push({
        cond: this.visit(rule(part, 'expression')), body: this.visit(rule(part, 'body')),
        pos: this.pos(part.label() ? children(part)[1] : part), label: this.labelOf(part)
      });
    }
    const elsePart = rule(ctx, 'elsePart');
    const end = rule(ctx, 'endIfLine');
    return {
      kind: 'if', pos: branches[0].pos, label: branches[0].label, branches,
      elseBranch: elsePart ? {
        body: this.visit(rule(elsePart, 'body')), pos: this.pos(elsePart.ELSE()), label: this.labelOf(elsePart)
      } : null,
      end: { pos: this.pos(end.label() ? children(end)[1] : end), label: this.labelOf(end) }
    };
  }

  visitStatementLine(ctx) {
    const statementCtx = rule(ctx, 'statement');
    const statement = this.visit(statementCtx);
    statement.label = this.labelOf(ctx);
    return statement;
  }

  visitStatement(ctx) {
    return this.visit(children(ctx)[0]);
  }

  visitActionStatement(ctx) {
    return this.visit(children(ctx)[0]);
  }

  name(ctx) {
    return ctx.getText().toUpperCase();
  }

  node(ctx, kind, fields = {}) {
    return { kind, pos: this.pos(ctx), ...fields };
  }

  // ------------------------------------------------------------ specification statements

  typeSpec(ctx) {
    const size = tokens(ctx, P.ICON)[0];
    if (has(ctx, P.INTEGER)) return { type: 'integer', size: size ? Number(size.getText()) : null };
    if (has(ctx, P.REAL)) return { type: size && Number(size.getText()) === 8 ? 'double' : 'real', size: size ? Number(size.getText()) : null };
    if (has(ctx, P.DOUBLE) || has(ctx, P.DOUBLEPRECISION)) return { type: 'double' };
    if (has(ctx, P.LOGICAL)) return { type: 'logical' };
    if (has(ctx, P.COMPLEX)) return { type: 'complex' };
    const length = rule(ctx, 'lengthSpec');
    return { type: 'character', len: length ? this.lengthSpec(length) : null };
  }

  lengthSpec(ctx) {
    const icon = tokens(ctx, P.ICON)[0];
    if (icon) return { expr: { k: 'int', value: Number(icon.getText()), pos: this.pos(icon) } };
    const expression = rule(ctx, 'expression');
    if (expression) return { expr: this.visit(expression) };
    return { assumed: true };
  }

  dims(ctx) {
    return rules(ctx, 'dimDecl').map(dim => {
      const expressions = rules(dim, 'expression').map(expression => this.visit(expression));
      const assumed = has(dim, P.STAR);
      if (has(dim, P.COLON)) return { lower: expressions[0], upper: assumed ? null : expressions[1], assumed, pos: this.pos(dim) };
      return { lower: null, upper: assumed ? null : expressions[0], assumed, pos: this.pos(dim) };
    });
  }

  visitTypeStatement(ctx) {
    return this.node(ctx, 'type', {
      typeSpec: this.typeSpec(rule(ctx, 'typeSpec')),
      entities: rules(ctx, 'entityDecl').map(entity => {
        const dims = rule(entity, 'arrayDims'), length = rule(entity, 'lengthSpec');
        return {
          name: this.name(rule(entity, 'name')), pos: this.pos(entity),
          dims: dims ? this.dims(dims) : null, len: length ? this.lengthSpec(length) : null
        };
      })
    });
  }

  visitImplicitStatement(ctx) {
    if (has(ctx, P.NONE)) return this.node(ctx, 'implicit', { none: true });
    return this.node(ctx, 'implicit', {
      specs: rules(ctx, 'implicitSpec').map(spec => ({
        typeSpec: this.typeSpec(rule(spec, 'typeSpec')),
        ranges: rules(spec, 'letterRange').map(range => {
          const letters = rules(range, 'name').map(name => this.name(name));
          if (letters.some(letter => !/^[A-Z]$/.test(letter))) this.fail(range, 'IMPLICIT letter ranges must be single letters');
          if (letters.length === 2 && letters[1] < letters[0]) this.fail(range, 'IMPLICIT letter range must be in alphabetical order');
          return [letters[0], letters[1] ?? letters[0]];
        })
      }))
    });
  }

  visitParameterStatement(ctx) {
    return this.node(ctx, 'parameter', {
      defs: rules(ctx, 'namedConstantDef').map(def => ({
        name: this.name(rule(def, 'name')), expr: this.visit(rule(def, 'expression')), pos: this.pos(def)
      }))
    });
  }

  visitDimensionStatement(ctx) {
    return this.node(ctx, 'dimension', {
      arrays: rules(ctx, 'arrayDeclarator').map(array => ({
        name: this.name(rule(array, 'name')), dims: this.dims(rule(array, 'arrayDims')), pos: this.pos(array)
      }))
    });
  }

  visitCommonStatement(ctx) {
    const blocks = [];
    let current = { name: '', pos: this.pos(ctx), items: [] };
    for (const child of children(ctx).slice(1)) {
      const kind = ruleOf(child, P);
      if (kind === 'commonBlockName') {
        if (current.items.length || blocks.length || current.name) blocks.push(current);
        const name = rule(child, 'name');
        current = { name: name ? this.name(name) : '', pos: this.pos(child), items: [] };
      } else if (kind === 'commonList') {
        current.items.push(...rules(child, 'commonItem').map(item => {
          const dims = rule(item, 'arrayDims');
          return { name: this.name(rule(item, 'name')), dims: dims ? this.dims(dims) : null, pos: this.pos(item) };
        }));
      }
    }
    blocks.push(current);
    return this.node(ctx, 'common', { blocks: blocks.filter(block => block.items.length) });
  }

  visitEquivalenceStatement(ctx) {
    return this.node(ctx, 'equivalence', {
      sets: rules(ctx, 'equivalenceSet').map(set => ({
        pos: this.pos(set), items: rules(set, 'designator').map(designator => this.visit(designator))
      }))
    });
  }

  visitExternalStatement(ctx) {
    return this.node(ctx, 'external', { names: rules(ctx, 'name').map(name => this.name(name)) });
  }

  visitIntrinsicStatement(ctx) {
    return this.node(ctx, 'intrinsic', { names: rules(ctx, 'name').map(name => this.name(name)) });
  }

  visitSaveStatement(ctx) {
    return this.node(ctx, 'save', {
      items: rules(ctx, 'saveItem').map(item => ({ name: this.name(rule(item, 'name')), common: has(item, P.SLASH) }))
    });
  }

  visitDataStatement(ctx) {
    return this.node(ctx, 'data', {
      sets: rules(ctx, 'dataSet').map(set => ({
        pos: this.pos(set),
        objects: rules(set, 'dataObject').map(object => this.dataObject(object)),
        values: rules(set, 'dataValue').map(value => this.dataValue(value))
      }))
    });
  }

  dataObject(ctx) {
    const designator = rule(ctx, 'designator');
    if (designator) return this.visit(designator);
    const implied = rule(ctx, 'dataImpliedDo');
    const expressions = rules(implied, 'expression').map(expression => this.visit(expression));
    return {
      k: 'implied', pos: this.pos(implied), objects: rules(implied, 'dataObject').map(object => this.dataObject(object)),
      variable: this.name(rule(implied, 'name')), start: expressions[0], end: expressions[1], step: expressions[2] ?? null
    };
  }

  dataValue(ctx) {
    const repeat = rule(ctx, 'dataRepeat');
    const constant = rule(ctx, 'dataConstant');
    const negative = has(constant, P.MINUS);
    let value;
    const token = children(constant).find(child => isTerminal(child) && ![P.PLUS, P.MINUS].includes(child.symbol.type));
    const nameCtx = rule(constant, 'name');
    const parts = rules(constant, 'complexPart');
    if (parts.length) {
      const part = ctx => {
        const name = rule(ctx, 'name');
        const tok = children(ctx).find(child => isTerminal(child) && ![P.PLUS, P.MINUS].includes(child.symbol.type));
        let v = name ? { k: 'name', name: this.name(name), pos: this.pos(name) } : this.constantToken(tok.symbol, tok);
        if (has(ctx, P.MINUS)) v = { k: 'unary', op: '-', operand: v, pos: this.pos(ctx) };
        return v;
      };
      value = { k: 'complex', re: part(parts[0]), im: part(parts[1]), pos: this.pos(constant) };
    } else if (nameCtx) value = { k: 'name', name: this.name(nameCtx), pos: this.pos(nameCtx) };
    else value = this.constantToken(token.symbol, token);
    if (negative) value = { k: 'unary', op: '-', operand: value, pos: this.pos(constant) };
    let count = null;
    if (repeat) {
      const repeatName = rule(repeat, 'name');
      count = repeatName ? { k: 'name', name: this.name(repeatName), pos: this.pos(repeat) }
        : { k: 'int', value: Number(repeat.getText()), pos: this.pos(repeat) };
    }
    return { repeat: count, value, pos: this.pos(ctx) };
  }

  visitFormatStatement(ctx) {
    const text = ctx.getText();
    const open = text.indexOf('(');
    const at = this.pos(ctx);
    return this.node(ctx, 'format', {
      spec: parseFormatSpecification(text.slice(open), { fileName: this.fileName, ...at }),
      text: text.slice(open)
    });
  }

  visitEntryStatement(ctx) {
    return this.node(ctx, 'entry', { name: this.name(rule(ctx, 'name')), params: this.dummies(rule(ctx, 'dummyArgList')) });
  }

  // ------------------------------------------------------------ executable statements

  visitAssignmentStatement(ctx) {
    return this.node(ctx, 'assignment', {
      target: this.visit(rule(ctx, 'designator')), value: this.visit(rule(ctx, 'expression'))
    });
  }

  labelRef(ctx) {
    return { label: String(Number(ctx.getText())), pos: this.pos(ctx) };
  }

  visitAssignStatement(ctx) {
    return this.node(ctx, 'assignLabel', { target: this.labelRef(rule(ctx, 'labelRef')), name: this.name(rule(ctx, 'name')) });
  }

  visitGotoStatement(ctx) {
    return this.node(ctx, 'goto', { target: this.labelRef(rule(ctx, 'labelRef')) });
  }

  visitComputedGotoStatement(ctx) {
    return this.node(ctx, 'computedGoto', {
      targets: rules(ctx, 'labelRef').map(label => this.labelRef(label)), expr: this.visit(rule(ctx, 'expression'))
    });
  }

  visitAssignedGotoStatement(ctx) {
    return this.node(ctx, 'assignedGoto', {
      name: this.name(rule(ctx, 'name')), targets: rules(ctx, 'labelRef').map(label => this.labelRef(label))
    });
  }

  visitArithmeticIfStatement(ctx) {
    return this.node(ctx, 'arithmeticIf', {
      expr: this.visit(rule(ctx, 'expression')), targets: rules(ctx, 'labelRef').map(label => this.labelRef(label))
    });
  }

  visitLogicalIfStatement(ctx) {
    const statement = this.visit(rule(ctx, 'actionStatement'));
    statement.label = '';
    return this.node(ctx, 'logicalIf', { cond: this.visit(rule(ctx, 'expression')), statement });
  }

  visitDoStatement(ctx) {
    const expressions = rules(ctx, 'expression').map(expression => this.visit(expression));
    return this.node(ctx, 'do', {
      target: this.labelRef(rule(ctx, 'labelRef')), variable: this.name(rule(ctx, 'name')),
      variablePos: this.pos(rule(ctx, 'name')), start: expressions[0], end: expressions[1], step: expressions[2] ?? null
    });
  }

  visitContinueStatement(ctx) {
    return this.node(ctx, 'continue');
  }

  stopCode(ctx) {
    const code = rule(ctx, 'stopCode');
    if (!code) return null;
    const text = code.getText();
    if (/^\d+$/.test(text)) {
      if (text.length > 5) this.fail(code, 'STOP/PAUSE codes are limited to five digits');
      return text;
    }
    return text.slice(1, -1).replaceAll("''", "'");
  }

  visitStopStatement(ctx) {
    return this.node(ctx, 'stop', { code: this.stopCode(ctx) });
  }

  visitPauseStatement(ctx) {
    return this.node(ctx, 'pause', { code: this.stopCode(ctx) });
  }

  visitCallStatement(ctx) {
    return this.node(ctx, 'call', {
      name: this.name(rule(ctx, 'name')),
      args: rules(ctx, 'actualArg').map(arg => {
        const expression = rule(arg, 'expression');
        return expression ? this.visit(expression) : { k: 'altReturn', target: this.labelRef(rule(arg, 'labelRef')), pos: this.pos(arg) };
      })
    });
  }

  visitReturnStatement(ctx) {
    const expression = rule(ctx, 'expression');
    return this.node(ctx, 'return', { expr: expression ? this.visit(expression) : null });
  }

  formatIdentifier(ctx) {
    if (!ctx) return null;
    if (has(ctx, P.STAR)) return { star: true, pos: this.pos(ctx) };
    return { expr: this.visit(rule(ctx, 'expression')), pos: this.pos(ctx) };
  }

  ioList(ctx) {
    if (!ctx) return [];
    return rules(ctx, 'ioItem').map(item => {
      const expression = rule(item, 'expression');
      if (expression) return this.visit(expression);
      const implied = rule(item, 'ioImpliedDo');
      const expressions = rules(implied, 'expression').map(child => this.visit(child));
      return {
        k: 'implied', pos: this.pos(implied), items: this.ioList(rule(implied, 'ioList')),
        variable: this.name(rule(implied, 'name')), start: expressions[0], end: expressions[1], step: expressions[2] ?? null
      };
    });
  }

  visitPrintStatement(ctx) {
    const format = this.formatIdentifier(rule(ctx, 'formatIdentifier'));
    return this.node(ctx, 'print', { legacy: !format, format, items: this.ioList(rule(ctx, 'ioList')) });
  }

  controlInfo(ctx) {
    return rules(ctx, 'controlItem').map(item => {
      const key = has(item, P.EQUALS) ? (rule(item, 'name') ? this.name(rule(item, 'name')) : 'END') : null;
      const expression = rule(item, 'expression');
      return { key, star: has(item, P.STAR), expr: expression ? this.visit(expression) : null, pos: this.pos(item) };
    });
  }

  visitWriteStatement(ctx) {
    return this.node(ctx, 'write', { control: this.controlInfo(rule(ctx, 'controlInfo')), items: this.ioList(rule(ctx, 'ioList')) });
  }

  visitReadStatement(ctx) {
    const info = rule(ctx, 'controlInfo');
    const control = info ? this.controlInfo(info) : [
      { key: 'UNIT', star: true, expr: null, pos: this.pos(ctx) },
      { key: 'FMT', ...this.formatControl(rule(ctx, 'formatIdentifier')) }
    ];
    return this.node(ctx, 'read', { control, items: this.ioList(rule(ctx, 'ioList')), short: !info });
  }

  formatControl(ctx) {
    const format = this.formatIdentifier(ctx);
    return { star: Boolean(format.star), expr: format.expr ?? null, pos: format.pos };
  }

  visitAuxiliaryIoStatement(ctx) {
    const verb = children(ctx)[0].getText().toUpperCase();
    const info = rule(ctx, 'controlInfo');
    const control = info ? this.controlInfo(info)
      : [{ key: 'UNIT', star: false, expr: this.visit(rule(ctx, 'expression')), pos: this.pos(ctx) }];
    return this.node(ctx, 'auxIo', { verb, control });
  }

  // ------------------------------------------------------------ expressions

  visitDesignator(ctx) {
    const sectionList = rule(ctx, 'sectionList');
    const parens = tokens(ctx, P.LPAREN).length;
    const substringCtx = rule(ctx, 'substringRange');
    let args = null;
    if (sectionList) args = rules(sectionList, 'section').map(section => {
      const expressions = children(section).filter(child => ruleOf(child, P) === 'expression');
      if (!has(section, P.COLON)) return this.visit(expressions[0]);
      let from = null, to = null;
      for (const child of children(section)) {
        if (isTerminal(child)) continue;
        const colonIndex = children(section).findIndex(node => isTerminal(node) && node.symbol.type === P.COLON);
        if (children(section).indexOf(child) < colonIndex) from = this.visit(child);
        else to = this.visit(child);
      }
      return { k: 'section', from, to, pos: this.pos(section) };
    });
    else if (parens > (substringCtx ? 1 : 0)) args = [];
    let substring = null;
    if (substringCtx) {
      let from = null, to = null;
      const colonIndex = children(substringCtx).findIndex(node => isTerminal(node) && node.symbol.type === P.COLON);
      children(substringCtx).forEach((child, index) => {
        if (isTerminal(child)) return;
        if (index < colonIndex) from = this.visit(child);
        else to = this.visit(child);
      });
      substring = { from, to, pos: this.pos(substringCtx) };
    }
    return { k: 'ref', name: this.name(rule(ctx, 'name')), args, substring, pos: this.pos(ctx) };
  }

  binaryChain(ctx, operandRule, operatorFor) {
    const parts = children(ctx);
    let index = 0;
    let left = null;
    let sign = null;
    if (isTerminal(parts[0])) {
      sign = parts[0];
      index = 1;
    }
    left = this.visit(parts[index]);
    if (sign) left = { k: 'unary', op: sign.getText(), operand: left, pos: this.pos(sign) };
    for (index += 1; index < parts.length; index += 2) {
      const operator = parts[index];
      const right = this.visit(parts[index + 1]);
      left = { k: 'binary', op: operatorFor(operator), left, right, pos: this.pos(operator) };
    }
    return left;
  }

  visitExpression(ctx) {
    return this.binaryChain(ctx, 'equivOperand', operator => operator.getText().toUpperCase());
  }

  visitEquivOperand(ctx) {
    return this.binaryChain(ctx, 'orOperand', () => '.OR.');
  }

  visitOrOperand(ctx) {
    return this.binaryChain(ctx, 'andOperand', () => '.AND.');
  }

  visitAndOperand(ctx) {
    if (has(ctx, P.NOT)) return { k: 'unary', op: '.NOT.', operand: this.visit(rule(ctx, 'andOperand')), pos: this.pos(ctx) };
    return this.visit(children(ctx)[0]);
  }

  visitRelationalExpr(ctx) {
    const operands = rules(ctx, 'concatExpr').map(child => this.visit(child));
    if (operands.length === 1) return operands[0];
    const operator = rule(ctx, 'relOp');
    return { k: 'binary', op: operator.getText().toUpperCase(), left: operands[0], right: operands[1], pos: this.pos(operator) };
  }

  visitConcatExpr(ctx) {
    return this.binaryChain(ctx, 'arithExpr', () => '//');
  }

  visitArithExpr(ctx) {
    return this.binaryChain(ctx, 'term', operator => operator.getText());
  }

  visitTerm(ctx) {
    return this.binaryChain(ctx, 'factor', operator => operator.getText());
  }

  visitFactor(ctx) {
    const base = this.visit(rule(ctx, 'primary'));
    const exponent = rule(ctx, 'factor');
    if (!exponent) return base;
    return { k: 'binary', op: '**', left: base, right: this.visit(exponent), pos: this.pos(tokens(ctx, P.POWER)[0]) };
  }

  visitPrimary(ctx) {
    const constant = rule(ctx, 'constant');
    if (constant) return this.constantToken(children(constant)[0].symbol, constant);
    const designator = rule(ctx, 'designator');
    if (designator) return this.visit(designator);
    const expressions = rules(ctx, 'expression');
    if (expressions.length === 2)
      return { k: 'complex', re: this.visit(expressions[0]), im: this.visit(expressions[1]), pos: this.pos(ctx) };
    return { k: 'paren', expr: this.visit(rule(ctx, 'expression')), pos: this.pos(ctx) };
  }

  constantToken(symbol, node) {
    const text = symbol.text;
    const pos = this.pos(node);
    switch (symbol.type) {
      case P.ICON: {
        const value = Number(text);
        if (value > 2147483647) this.fail(node, `Integer constant ${text} exceeds the p-machine INTEGER range`);
        return { k: 'int', value, pos };
      }
      case P.RCON: return { k: 'real', value: Number(text), double: false, pos };
      case P.DCON: return { k: 'real', value: Number(text.replace(/d/i, 'E')), double: true, pos };
      case P.SCON: return { k: 'string', value: text.slice(1, -1).replaceAll("''", "'"), pos };
      case P.TRUE: return { k: 'logical', value: true, pos };
      case P.FALSE: return { k: 'logical', value: false, pos };
      default: return this.fail(node, `Unexpected constant ${text}`);
    }
  }
}
