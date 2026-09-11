import antlr4 from 'antlr4';
import Cobolish85Lexer from './grammar/generated-modern/Cobolish85Lexer.js';
import Cobolish85Parser from './grammar/generated-modern/Cobolish85Parser.js';

const source = `IDENTIFICATION DIVISION.
PROGRAM-ID. FEES.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 PRICE PIC S9(7)V99.
01 QTY PIC 9(3).
01 GROSS PIC S9(9)V99.
PROCEDURE DIVISION.
    COMPUTE GROSS = PRICE * QTY.
    STOP RUN.`;

const input = new antlr4.InputStream(source);
const lexer = new Cobolish85Lexer(input);
const tokens = new antlr4.CommonTokenStream(lexer);
tokens.fill();
console.log('TOKENS');
console.log(tokens.tokens.slice(0, 80).map(t => ({type: t.type, text: t.text})));
const parser = new Cobolish85Parser(tokens);
parser.buildParseTrees = true;
const tree = parser.compilationUnit();
function walk(node, depth = 0) {
  const name = node && node.constructor && node.constructor.name;
  if (name && /(ComputeStatementContext|ExpressionContext|TermContext|FactorContext|RelationContext|StatementContext)/.test(name)) {
    console.log(' '.repeat(depth) + name + ': ' + node.getText());
  }
  for (let i = 0; i < (node && typeof node.getChildCount === 'function' ? node.getChildCount() : 0); i++) {
    const child = node.getChild(i);
    if (child && typeof child.getChildCount === 'function') walk(child, depth + 2);
  }
}
walk(tree);
