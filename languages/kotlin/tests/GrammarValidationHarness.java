import java.nio.file.Path;
import org.antlr.v4.runtime.BaseErrorListener;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.Recognizer;
import org.antlr.v4.runtime.RecognitionException;
import org.antlr.v4.runtime.Lexer;

public final class GrammarValidationHarness {
    private static BaseErrorListener errorsFor(String file) {
        return new BaseErrorListener() {
            @Override
            public void syntaxError(
                    Recognizer<?, ?> recognizer,
                    Object offendingSymbol,
                    int line,
                    int charPositionInLine,
                    String message,
                    RecognitionException exception) {
                System.err.println(file + ":" + line + ":" + charPositionInLine + ": " + message);
            }
        };
    }

    public static void main(String[] files) throws Exception {
        for (String file : files) {
            String name = Path.of(file).getFileName().toString();
            Lexer lexer = new KotlinLexer(CharStreams.fromPath(Path.of(file)));
            lexer.removeErrorListeners();
            lexer.addErrorListener(errorsFor(name));
            KotlinParser parser = new KotlinParser(new CommonTokenStream(lexer));
            parser.removeErrorListeners();
            parser.addErrorListener(errorsFor(name));
            parser.kotlinFile();
        }
    }
}
