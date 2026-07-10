import antlr4 from 'antlr4';
import StandardPascalParser from '../../../grammar/generated-modern/StandardPascalParser.js';
import StandardPascalVisitor from '../../../grammar/generated-modern/StandardPascalVisitor.js';
import { createNode, locationFromToken } from '../ast/nodes.mjs';
import { lexPascalish } from '../lexer/index.mjs';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, message) {
    this.errors.push({
      line,
      column: column + 1,
      message
    });
  }
}

function unquote(text) {
  const raw = String(text || '');
  if (raw.length < 2) return raw;
  const first = raw[0];
  const last = raw[raw.length - 1];
  if ((first === '"' || first === '\'') && first === last) {
    return raw.slice(1, -1);
  }
  return raw;
}

class AstBuilder extends StandardPascalVisitor {
  visitProgram(ctx) {
    return createNode('Program', locationFromToken(ctx.start), {
      name: ctx.IDENT().getText(),
      block: this.visit(ctx.block())
    });
  }

  visitBlock(ctx) {
    return createNode('Block', locationFromToken(ctx.start), {
      declarations: ctx.varSection() ? this.visit(ctx.varSection()) : [],
      procedures: (ctx.procedureDecl() || []).map(item => this.visit(item)),
      body: this.visit(ctx.compoundStmt())
    });
  }

  visitVarSection(ctx) {
    return (ctx.varDecl() || []).flatMap(item => this.visit(item));
  }

  visitVarDecl(ctx) {
    const identifiers = ctx.identList().IDENT() || [];
    return identifiers.map(token => createNode('VariableDeclaration', locationFromToken(token.symbol), {
      name: token.getText(),
      dataType: 'integer'
    }));
  }

  visitProcedureDecl(ctx) {
    const params = ctx.paramList() ? this.visit(ctx.paramList()) : [];
    const localDeclarations = ctx.varSection() ? this.visit(ctx.varSection()) : [];
    return createNode('ProcedureDeclaration', locationFromToken(ctx.start), {
      name: ctx.IDENT().getText(),
      parameters: params,
      declarations: localDeclarations,
      body: this.visit(ctx.compoundStmt())
    });
  }

  visitParamList(ctx) {
    return (ctx.paramDecl() || []).flatMap(item => this.visit(item));
  }

  visitParamDecl(ctx) {
    const identifiers = ctx.identList().IDENT() || [];
    return identifiers.map(token => createNode('VariableDeclaration', locationFromToken(token.symbol), {
      name: token.getText(),
      dataType: 'integer',
      parameter: true
    }));
  }

  visitCompoundStmt(ctx) {
    const statements = ctx.statementList() ? this.visit(ctx.statementList()) : [];
    return createNode('Block', locationFromToken(ctx.start), {
      declarations: [],
      procedures: [],
      body: statements
    });
  }

  visitStatementList(ctx) {
    return (ctx.statement() || []).map(item => this.visit(item)).filter(Boolean);
  }

  visitStatement(ctx) {
    if (ctx.assignment()) return this.visit(ctx.assignment());
    if (ctx.procedureCall()) return this.visit(ctx.procedureCall());
    if (ctx.ifStmt()) return this.visit(ctx.ifStmt());
    if (ctx.writelnStmt()) return this.visit(ctx.writelnStmt());
    if (ctx.compoundStmt()) return this.visit(ctx.compoundStmt());
    return null;
  }

  visitAssignment(ctx) {
    const identifier = ctx.IDENT();
    return createNode('Assignment', locationFromToken(ctx.start), {
      target: createNode('Identifier', locationFromToken(identifier.symbol), {
        name: identifier.getText()
      }),
      expression: this.visit(ctx.expr())
    });
  }

  visitProcedureCall(ctx) {
    return createNode('FunctionCall', locationFromToken(ctx.start), {
      name: ctx.IDENT().getText(),
      arguments: ctx.argList() ? this.visit(ctx.argList()) : []
    });
  }

  visitArgList(ctx) {
    return (ctx.expr() || []).map(item => this.visit(item));
  }

  visitIfStmt(ctx) {
    return createNode('IfStatement', locationFromToken(ctx.start), {
      condition: this.visit(ctx.expr()),
      thenBranch: this.visit(ctx.statement(0)),
      elseBranch: ctx.statement(1) ? this.visit(ctx.statement(1)) : null
    });
  }

  visitWritelnStmt(ctx) {
    return createNode('FunctionCall', locationFromToken(ctx.start), {
      name: 'writeln',
      arguments: ctx.writeArgList() ? this.visit(ctx.writeArgList()) : []
    });
  }

  visitWriteArgList(ctx) {
    return (ctx.writeArg() || []).map(item => this.visit(item));
  }

  visitWriteArg(ctx) {
    if (ctx.STRING()) {
      return createNode('Literal', locationFromToken(ctx.start), {
        literalType: 'string',
        value: unquote(ctx.STRING().getText())
      });
    }
    return this.visit(ctx.expr());
  }

  visitExpr(ctx) {
    const additiveExpr = ctx.additiveExpr() || [];
    if (additiveExpr.length === 2) {
      return createNode('BinaryExpression', locationFromToken(ctx.start), {
        operator: ctx.getChild(1).getText(),
        left: this.visit(additiveExpr[0]),
        right: this.visit(additiveExpr[1])
      });
    }
    return this.visit(additiveExpr[0]);
  }

  visitAdditiveExpr(ctx) {
    const parts = ctx.multiplicativeExpr() || [];
    let current = this.visit(parts[0]);
    for (let index = 1; index < parts.length; index += 1) {
      current = createNode('BinaryExpression', locationFromToken(parts[index].start), {
        operator: ctx.getChild((2 * index) - 1).getText(),
        left: current,
        right: this.visit(parts[index])
      });
    }
    return current;
  }

  visitMultiplicativeExpr(ctx) {
    const parts = ctx.unaryExpr() || [];
    let current = this.visit(parts[0]);
    for (let index = 1; index < parts.length; index += 1) {
      current = createNode('BinaryExpression', locationFromToken(parts[index].start), {
        operator: ctx.getChild((2 * index) - 1).getText(),
        left: current,
        right: this.visit(parts[index])
      });
    }
    return current;
  }

  visitUnaryExpr(ctx) {
    if (ctx.MINUS()) {
      return createNode('UnaryExpression', locationFromToken(ctx.start), {
        operator: '-',
        argument: this.visit(ctx.unaryExpr())
      });
    }
    return this.visit(ctx.primary());
  }

  visitPrimary(ctx) {
    if (ctx.NUMBER()) {
      return createNode('Literal', locationFromToken(ctx.start), {
        literalType: 'integer',
        value: Number.parseInt(ctx.NUMBER().getText(), 10)
      });
    }

    if (ctx.IDENT()) {
      return createNode('Identifier', locationFromToken(ctx.start), {
        name: ctx.IDENT().getText()
      });
    }

    return this.visit(ctx.expr());
  }
}

export function parsePascalish(sourceText) {
  const lexed = lexPascalish(sourceText);
  const parser = new StandardPascalParser(lexed.tokenStream);
  const errorListener = new CollectingErrorListener();

  parser.removeErrorListeners();
  parser.addErrorListener(errorListener);
  parser.buildParseTrees = true;

  const tree = parser.program();
  const errors = [...lexed.errors, ...errorListener.errors];
  if (errors.length > 0) {
    return {
      tokens: lexed.tokens,
      ast: null,
      errors
    };
  }

  return {
    tokens: lexed.tokens,
    ast: new AstBuilder().visit(tree),
    errors: []
  };
}
