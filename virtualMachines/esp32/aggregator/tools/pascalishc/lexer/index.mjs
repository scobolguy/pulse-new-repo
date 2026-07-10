import antlr4 from 'antlr4';
import StandardPascalLexer from '../../../grammar/generated-modern/StandardPascalLexer.js';
import { locationFromToken } from '../ast/nodes.mjs';

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

export function lexPascalish(sourceText) {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new StandardPascalLexer(input);
  const errorListener = new CollectingErrorListener();

  lexer.removeErrorListeners();
  lexer.addErrorListener(errorListener);

  const tokenStream = new antlr4.CommonTokenStream(lexer);
  tokenStream.fill();

  const tokens = tokenStream.tokens
    .filter(token => token.type !== antlr4.Token.EOF)
    .map(token => ({
      type: StandardPascalLexer.symbolicNames[token.type] || String(token.type),
      text: token.text,
      location: locationFromToken(token)
    }));

  return {
    lexer,
    tokenStream,
    tokens,
    errors: errorListener.errors
  };
}
