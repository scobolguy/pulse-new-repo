// Generated from c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Vbish.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link VbishParser}.
 */
public interface VbishListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link VbishParser#compilationUnit}.
	 * @param ctx the parse tree
	 */
	void enterCompilationUnit(VbishParser.CompilationUnitContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#compilationUnit}.
	 * @param ctx the parse tree
	 */
	void exitCompilationUnit(VbishParser.CompilationUnitContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#optionExplicit}.
	 * @param ctx the parse tree
	 */
	void enterOptionExplicit(VbishParser.OptionExplicitContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#optionExplicit}.
	 * @param ctx the parse tree
	 */
	void exitOptionExplicit(VbishParser.OptionExplicitContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#runtimeDecl}.
	 * @param ctx the parse tree
	 */
	void enterRuntimeDecl(VbishParser.RuntimeDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#runtimeDecl}.
	 * @param ctx the parse tree
	 */
	void exitRuntimeDecl(VbishParser.RuntimeDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#placement}.
	 * @param ctx the parse tree
	 */
	void enterPlacement(VbishParser.PlacementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#placement}.
	 * @param ctx the parse tree
	 */
	void exitPlacement(VbishParser.PlacementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#intervalUnit}.
	 * @param ctx the parse tree
	 */
	void enterIntervalUnit(VbishParser.IntervalUnitContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#intervalUnit}.
	 * @param ctx the parse tree
	 */
	void exitIntervalUnit(VbishParser.IntervalUnitContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#interopDecl}.
	 * @param ctx the parse tree
	 */
	void enterInteropDecl(VbishParser.InteropDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#interopDecl}.
	 * @param ctx the parse tree
	 */
	void exitInteropDecl(VbishParser.InteropDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#interopKind}.
	 * @param ctx the parse tree
	 */
	void enterInteropKind(VbishParser.InteropKindContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#interopKind}.
	 * @param ctx the parse tree
	 */
	void exitInteropKind(VbishParser.InteropKindContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#topLevelDecl}.
	 * @param ctx the parse tree
	 */
	void enterTopLevelDecl(VbishParser.TopLevelDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#topLevelDecl}.
	 * @param ctx the parse tree
	 */
	void exitTopLevelDecl(VbishParser.TopLevelDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#roleDecl}.
	 * @param ctx the parse tree
	 */
	void enterRoleDecl(VbishParser.RoleDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#roleDecl}.
	 * @param ctx the parse tree
	 */
	void exitRoleDecl(VbishParser.RoleDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#roleName}.
	 * @param ctx the parse tree
	 */
	void enterRoleName(VbishParser.RoleNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#roleName}.
	 * @param ctx the parse tree
	 */
	void exitRoleName(VbishParser.RoleNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#libraryDecl}.
	 * @param ctx the parse tree
	 */
	void enterLibraryDecl(VbishParser.LibraryDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#libraryDecl}.
	 * @param ctx the parse tree
	 */
	void exitLibraryDecl(VbishParser.LibraryDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#librarySource}.
	 * @param ctx the parse tree
	 */
	void enterLibrarySource(VbishParser.LibrarySourceContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#librarySource}.
	 * @param ctx the parse tree
	 */
	void exitLibrarySource(VbishParser.LibrarySourceContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#useDecl}.
	 * @param ctx the parse tree
	 */
	void enterUseDecl(VbishParser.UseDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#useDecl}.
	 * @param ctx the parse tree
	 */
	void exitUseDecl(VbishParser.UseDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#importDecl}.
	 * @param ctx the parse tree
	 */
	void enterImportDecl(VbishParser.ImportDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#importDecl}.
	 * @param ctx the parse tree
	 */
	void exitImportDecl(VbishParser.ImportDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#routeDecl}.
	 * @param ctx the parse tree
	 */
	void enterRouteDecl(VbishParser.RouteDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#routeDecl}.
	 * @param ctx the parse tree
	 */
	void exitRouteDecl(VbishParser.RouteDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#systemDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemDecl(VbishParser.SystemDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#systemDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemDecl(VbishParser.SystemDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#databaseDecl}.
	 * @param ctx the parse tree
	 */
	void enterDatabaseDecl(VbishParser.DatabaseDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#databaseDecl}.
	 * @param ctx the parse tree
	 */
	void exitDatabaseDecl(VbishParser.DatabaseDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#systemMember}.
	 * @param ctx the parse tree
	 */
	void enterSystemMember(VbishParser.SystemMemberContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#systemMember}.
	 * @param ctx the parse tree
	 */
	void exitSystemMember(VbishParser.SystemMemberContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#systemQueueDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemQueueDecl(VbishParser.SystemQueueDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#systemQueueDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemQueueDecl(VbishParser.SystemQueueDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#systemServiceDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemServiceDecl(VbishParser.SystemServiceDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#systemServiceDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemServiceDecl(VbishParser.SystemServiceDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#systemVisibilityClause}.
	 * @param ctx the parse tree
	 */
	void enterSystemVisibilityClause(VbishParser.SystemVisibilityClauseContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#systemVisibilityClause}.
	 * @param ctx the parse tree
	 */
	void exitSystemVisibilityClause(VbishParser.SystemVisibilityClauseContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#variableDecl}.
	 * @param ctx the parse tree
	 */
	void enterVariableDecl(VbishParser.VariableDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#variableDecl}.
	 * @param ctx the parse tree
	 */
	void exitVariableDecl(VbishParser.VariableDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#subDecl}.
	 * @param ctx the parse tree
	 */
	void enterSubDecl(VbishParser.SubDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#subDecl}.
	 * @param ctx the parse tree
	 */
	void exitSubDecl(VbishParser.SubDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#functionDecl}.
	 * @param ctx the parse tree
	 */
	void enterFunctionDecl(VbishParser.FunctionDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#functionDecl}.
	 * @param ctx the parse tree
	 */
	void exitFunctionDecl(VbishParser.FunctionDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#parameterList}.
	 * @param ctx the parse tree
	 */
	void enterParameterList(VbishParser.ParameterListContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#parameterList}.
	 * @param ctx the parse tree
	 */
	void exitParameterList(VbishParser.ParameterListContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#parameter}.
	 * @param ctx the parse tree
	 */
	void enterParameter(VbishParser.ParameterContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#parameter}.
	 * @param ctx the parse tree
	 */
	void exitParameter(VbishParser.ParameterContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#statement}.
	 * @param ctx the parse tree
	 */
	void enterStatement(VbishParser.StatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#statement}.
	 * @param ctx the parse tree
	 */
	void exitStatement(VbishParser.StatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#ifStatement}.
	 * @param ctx the parse tree
	 */
	void enterIfStatement(VbishParser.IfStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#ifStatement}.
	 * @param ctx the parse tree
	 */
	void exitIfStatement(VbishParser.IfStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#forStatement}.
	 * @param ctx the parse tree
	 */
	void enterForStatement(VbishParser.ForStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#forStatement}.
	 * @param ctx the parse tree
	 */
	void exitForStatement(VbishParser.ForStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#whileStatement}.
	 * @param ctx the parse tree
	 */
	void enterWhileStatement(VbishParser.WhileStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#whileStatement}.
	 * @param ctx the parse tree
	 */
	void exitWhileStatement(VbishParser.WhileStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#printStatement}.
	 * @param ctx the parse tree
	 */
	void enterPrintStatement(VbishParser.PrintStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#printStatement}.
	 * @param ctx the parse tree
	 */
	void exitPrintStatement(VbishParser.PrintStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#assignment}.
	 * @param ctx the parse tree
	 */
	void enterAssignment(VbishParser.AssignmentContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#assignment}.
	 * @param ctx the parse tree
	 */
	void exitAssignment(VbishParser.AssignmentContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#callStatement}.
	 * @param ctx the parse tree
	 */
	void enterCallStatement(VbishParser.CallStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#callStatement}.
	 * @param ctx the parse tree
	 */
	void exitCallStatement(VbishParser.CallStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#returnStatement}.
	 * @param ctx the parse tree
	 */
	void enterReturnStatement(VbishParser.ReturnStatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#returnStatement}.
	 * @param ctx the parse tree
	 */
	void exitReturnStatement(VbishParser.ReturnStatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterExpression(VbishParser.ExpressionContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitExpression(VbishParser.ExpressionContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#logicalOr}.
	 * @param ctx the parse tree
	 */
	void enterLogicalOr(VbishParser.LogicalOrContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#logicalOr}.
	 * @param ctx the parse tree
	 */
	void exitLogicalOr(VbishParser.LogicalOrContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#logicalAnd}.
	 * @param ctx the parse tree
	 */
	void enterLogicalAnd(VbishParser.LogicalAndContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#logicalAnd}.
	 * @param ctx the parse tree
	 */
	void exitLogicalAnd(VbishParser.LogicalAndContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#equality}.
	 * @param ctx the parse tree
	 */
	void enterEquality(VbishParser.EqualityContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#equality}.
	 * @param ctx the parse tree
	 */
	void exitEquality(VbishParser.EqualityContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#relational}.
	 * @param ctx the parse tree
	 */
	void enterRelational(VbishParser.RelationalContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#relational}.
	 * @param ctx the parse tree
	 */
	void exitRelational(VbishParser.RelationalContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#additive}.
	 * @param ctx the parse tree
	 */
	void enterAdditive(VbishParser.AdditiveContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#additive}.
	 * @param ctx the parse tree
	 */
	void exitAdditive(VbishParser.AdditiveContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#multiplicative}.
	 * @param ctx the parse tree
	 */
	void enterMultiplicative(VbishParser.MultiplicativeContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#multiplicative}.
	 * @param ctx the parse tree
	 */
	void exitMultiplicative(VbishParser.MultiplicativeContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#primary}.
	 * @param ctx the parse tree
	 */
	void enterPrimary(VbishParser.PrimaryContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#primary}.
	 * @param ctx the parse tree
	 */
	void exitPrimary(VbishParser.PrimaryContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#concatenation}.
	 * @param ctx the parse tree
	 */
	void enterConcatenation(VbishParser.ConcatenationContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#concatenation}.
	 * @param ctx the parse tree
	 */
	void exitConcatenation(VbishParser.ConcatenationContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#addOp}.
	 * @param ctx the parse tree
	 */
	void enterAddOp(VbishParser.AddOpContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#addOp}.
	 * @param ctx the parse tree
	 */
	void exitAddOp(VbishParser.AddOpContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#mulOp}.
	 * @param ctx the parse tree
	 */
	void enterMulOp(VbishParser.MulOpContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#mulOp}.
	 * @param ctx the parse tree
	 */
	void exitMulOp(VbishParser.MulOpContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#relOp}.
	 * @param ctx the parse tree
	 */
	void enterRelOp(VbishParser.RelOpContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#relOp}.
	 * @param ctx the parse tree
	 */
	void exitRelOp(VbishParser.RelOpContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#typeName}.
	 * @param ctx the parse tree
	 */
	void enterTypeName(VbishParser.TypeNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#typeName}.
	 * @param ctx the parse tree
	 */
	void exitTypeName(VbishParser.TypeNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link VbishParser#stringOrIdentifier}.
	 * @param ctx the parse tree
	 */
	void enterStringOrIdentifier(VbishParser.StringOrIdentifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link VbishParser#stringOrIdentifier}.
	 * @param ctx the parse tree
	 */
	void exitStringOrIdentifier(VbishParser.StringOrIdentifierContext ctx);
}