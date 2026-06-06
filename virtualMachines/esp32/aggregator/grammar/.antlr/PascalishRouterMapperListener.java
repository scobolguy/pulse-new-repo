// Generated from c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/PascalishRouterMapper.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link PascalishRouterMapperParser}.
 */
public interface PascalishRouterMapperListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#program}.
	 * @param ctx the parse tree
	 */
	void enterProgram(PascalishRouterMapperParser.ProgramContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#program}.
	 * @param ctx the parse tree
	 */
	void exitProgram(PascalishRouterMapperParser.ProgramContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#statement}.
	 * @param ctx the parse tree
	 */
	void enterStatement(PascalishRouterMapperParser.StatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#statement}.
	 * @param ctx the parse tree
	 */
	void exitStatement(PascalishRouterMapperParser.StatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#varDecl}.
	 * @param ctx the parse tree
	 */
	void enterVarDecl(PascalishRouterMapperParser.VarDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#varDecl}.
	 * @param ctx the parse tree
	 */
	void exitVarDecl(PascalishRouterMapperParser.VarDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#varSource}.
	 * @param ctx the parse tree
	 */
	void enterVarSource(PascalishRouterMapperParser.VarSourceContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#varSource}.
	 * @param ctx the parse tree
	 */
	void exitVarSource(PascalishRouterMapperParser.VarSourceContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#serviceDecl}.
	 * @param ctx the parse tree
	 */
	void enterServiceDecl(PascalishRouterMapperParser.ServiceDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#serviceDecl}.
	 * @param ctx the parse tree
	 */
	void exitServiceDecl(PascalishRouterMapperParser.ServiceDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#routerDecl}.
	 * @param ctx the parse tree
	 */
	void enterRouterDecl(PascalishRouterMapperParser.RouterDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#routerDecl}.
	 * @param ctx the parse tree
	 */
	void exitRouterDecl(PascalishRouterMapperParser.RouterDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#routerHeaderProp}.
	 * @param ctx the parse tree
	 */
	void enterRouterHeaderProp(PascalishRouterMapperParser.RouterHeaderPropContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#routerHeaderProp}.
	 * @param ctx the parse tree
	 */
	void exitRouterHeaderProp(PascalishRouterMapperParser.RouterHeaderPropContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#outputDecl}.
	 * @param ctx the parse tree
	 */
	void enterOutputDecl(PascalishRouterMapperParser.OutputDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#outputDecl}.
	 * @param ctx the parse tree
	 */
	void exitOutputDecl(PascalishRouterMapperParser.OutputDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#outputTypeMeta}.
	 * @param ctx the parse tree
	 */
	void enterOutputTypeMeta(PascalishRouterMapperParser.OutputTypeMetaContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#outputTypeMeta}.
	 * @param ctx the parse tree
	 */
	void exitOutputTypeMeta(PascalishRouterMapperParser.OutputTypeMetaContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#mapperDecl}.
	 * @param ctx the parse tree
	 */
	void enterMapperDecl(PascalishRouterMapperParser.MapperDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#mapperDecl}.
	 * @param ctx the parse tree
	 */
	void exitMapperDecl(PascalishRouterMapperParser.MapperDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#mapperHeaderProp}.
	 * @param ctx the parse tree
	 */
	void enterMapperHeaderProp(PascalishRouterMapperParser.MapperHeaderPropContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#mapperHeaderProp}.
	 * @param ctx the parse tree
	 */
	void exitMapperHeaderProp(PascalishRouterMapperParser.MapperHeaderPropContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#mapDecl}.
	 * @param ctx the parse tree
	 */
	void enterMapDecl(PascalishRouterMapperParser.MapDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#mapDecl}.
	 * @param ctx the parse tree
	 */
	void exitMapDecl(PascalishRouterMapperParser.MapDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#stringList}.
	 * @param ctx the parse tree
	 */
	void enterStringList(PascalishRouterMapperParser.StringListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#stringList}.
	 * @param ctx the parse tree
	 */
	void exitStringList(PascalishRouterMapperParser.StringListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#stringOrIdent}.
	 * @param ctx the parse tree
	 */
	void enterStringOrIdent(PascalishRouterMapperParser.StringOrIdentContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#stringOrIdent}.
	 * @param ctx the parse tree
	 */
	void exitStringOrIdent(PascalishRouterMapperParser.StringOrIdentContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#stringValue}.
	 * @param ctx the parse tree
	 */
	void enterStringValue(PascalishRouterMapperParser.StringValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#stringValue}.
	 * @param ctx the parse tree
	 */
	void exitStringValue(PascalishRouterMapperParser.StringValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#booleanValue}.
	 * @param ctx the parse tree
	 */
	void enterBooleanValue(PascalishRouterMapperParser.BooleanValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#booleanValue}.
	 * @param ctx the parse tree
	 */
	void exitBooleanValue(PascalishRouterMapperParser.BooleanValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#pl0Snippet}.
	 * @param ctx the parse tree
	 */
	void enterPl0Snippet(PascalishRouterMapperParser.Pl0SnippetContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#pl0Snippet}.
	 * @param ctx the parse tree
	 */
	void exitPl0Snippet(PascalishRouterMapperParser.Pl0SnippetContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#pl0Block}.
	 * @param ctx the parse tree
	 */
	void enterPl0Block(PascalishRouterMapperParser.Pl0BlockContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#pl0Block}.
	 * @param ctx the parse tree
	 */
	void exitPl0Block(PascalishRouterMapperParser.Pl0BlockContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishRouterMapperParser#pl0Element}.
	 * @param ctx the parse tree
	 */
	void enterPl0Element(PascalishRouterMapperParser.Pl0ElementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishRouterMapperParser#pl0Element}.
	 * @param ctx the parse tree
	 */
	void exitPl0Element(PascalishRouterMapperParser.Pl0ElementContext ctx);
}