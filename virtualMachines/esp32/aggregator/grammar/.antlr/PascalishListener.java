// Generated from c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/Pascalish.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link PascalishParser}.
 */
public interface PascalishListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link PascalishParser#compilationUnit}.
	 * @param ctx the parse tree
	 */
	void enterCompilationUnit(PascalishParser.CompilationUnitContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#compilationUnit}.
	 * @param ctx the parse tree
	 */
	void exitCompilationUnit(PascalishParser.CompilationUnitContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#decl}.
	 * @param ctx the parse tree
	 */
	void enterDecl(PascalishParser.DeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#decl}.
	 * @param ctx the parse tree
	 */
	void exitDecl(PascalishParser.DeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#placement}.
	 * @param ctx the parse tree
	 */
	void enterPlacement(PascalishParser.PlacementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#placement}.
	 * @param ctx the parse tree
	 */
	void exitPlacement(PascalishParser.PlacementContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#programDecl}.
	 * @param ctx the parse tree
	 */
	void enterProgramDecl(PascalishParser.ProgramDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#programDecl}.
	 * @param ctx the parse tree
	 */
	void exitProgramDecl(PascalishParser.ProgramDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceDecl}.
	 * @param ctx the parse tree
	 */
	void enterServiceDecl(PascalishParser.ServiceDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceDecl}.
	 * @param ctx the parse tree
	 */
	void exitServiceDecl(PascalishParser.ServiceDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceBody}.
	 * @param ctx the parse tree
	 */
	void enterServiceBody(PascalishParser.ServiceBodyContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceBody}.
	 * @param ctx the parse tree
	 */
	void exitServiceBody(PascalishParser.ServiceBodyContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#daemonDecl}.
	 * @param ctx the parse tree
	 */
	void enterDaemonDecl(PascalishParser.DaemonDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#daemonDecl}.
	 * @param ctx the parse tree
	 */
	void exitDaemonDecl(PascalishParser.DaemonDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#daemonSchedule}.
	 * @param ctx the parse tree
	 */
	void enterDaemonSchedule(PascalishParser.DaemonScheduleContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#daemonSchedule}.
	 * @param ctx the parse tree
	 */
	void exitDaemonSchedule(PascalishParser.DaemonScheduleContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#typeDecl}.
	 * @param ctx the parse tree
	 */
	void enterTypeDecl(PascalishParser.TypeDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#typeDecl}.
	 * @param ctx the parse tree
	 */
	void exitTypeDecl(PascalishParser.TypeDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#varDecl}.
	 * @param ctx the parse tree
	 */
	void enterVarDecl(PascalishParser.VarDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#varDecl}.
	 * @param ctx the parse tree
	 */
	void exitVarDecl(PascalishParser.VarDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#fileDecl}.
	 * @param ctx the parse tree
	 */
	void enterFileDecl(PascalishParser.FileDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#fileDecl}.
	 * @param ctx the parse tree
	 */
	void exitFileDecl(PascalishParser.FileDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#queueDecl}.
	 * @param ctx the parse tree
	 */
	void enterQueueDecl(PascalishParser.QueueDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#queueDecl}.
	 * @param ctx the parse tree
	 */
	void exitQueueDecl(PascalishParser.QueueDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#queueType}.
	 * @param ctx the parse tree
	 */
	void enterQueueType(PascalishParser.QueueTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#queueType}.
	 * @param ctx the parse tree
	 */
	void exitQueueType(PascalishParser.QueueTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#stackType}.
	 * @param ctx the parse tree
	 */
	void enterStackType(PascalishParser.StackTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#stackType}.
	 * @param ctx the parse tree
	 */
	void exitStackType(PascalishParser.StackTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#priorityQueueType}.
	 * @param ctx the parse tree
	 */
	void enterPriorityQueueType(PascalishParser.PriorityQueueTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#priorityQueueType}.
	 * @param ctx the parse tree
	 */
	void exitPriorityQueueType(PascalishParser.PriorityQueueTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#recordType}.
	 * @param ctx the parse tree
	 */
	void enterRecordType(PascalishParser.RecordTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#recordType}.
	 * @param ctx the parse tree
	 */
	void exitRecordType(PascalishParser.RecordTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#recordField}.
	 * @param ctx the parse tree
	 */
	void enterRecordField(PascalishParser.RecordFieldContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#recordField}.
	 * @param ctx the parse tree
	 */
	void exitRecordField(PascalishParser.RecordFieldContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#typeRef}.
	 * @param ctx the parse tree
	 */
	void enterTypeRef(PascalishParser.TypeRefContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#typeRef}.
	 * @param ctx the parse tree
	 */
	void exitTypeRef(PascalishParser.TypeRefContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#simpleType}.
	 * @param ctx the parse tree
	 */
	void enterSimpleType(PascalishParser.SimpleTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#simpleType}.
	 * @param ctx the parse tree
	 */
	void exitSimpleType(PascalishParser.SimpleTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#userType}.
	 * @param ctx the parse tree
	 */
	void enterUserType(PascalishParser.UserTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#userType}.
	 * @param ctx the parse tree
	 */
	void exitUserType(PascalishParser.UserTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#fixedArrayType}.
	 * @param ctx the parse tree
	 */
	void enterFixedArrayType(PascalishParser.FixedArrayTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#fixedArrayType}.
	 * @param ctx the parse tree
	 */
	void exitFixedArrayType(PascalishParser.FixedArrayTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#dynamicArrayType}.
	 * @param ctx the parse tree
	 */
	void enterDynamicArrayType(PascalishParser.DynamicArrayTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#dynamicArrayType}.
	 * @param ctx the parse tree
	 */
	void exitDynamicArrayType(PascalishParser.DynamicArrayTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#block}.
	 * @param ctx the parse tree
	 */
	void enterBlock(PascalishParser.BlockContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#block}.
	 * @param ctx the parse tree
	 */
	void exitBlock(PascalishParser.BlockContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#statement}.
	 * @param ctx the parse tree
	 */
	void enterStatement(PascalishParser.StatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#statement}.
	 * @param ctx the parse tree
	 */
	void exitStatement(PascalishParser.StatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#assignStmt}.
	 * @param ctx the parse tree
	 */
	void enterAssignStmt(PascalishParser.AssignStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#assignStmt}.
	 * @param ctx the parse tree
	 */
	void exitAssignStmt(PascalishParser.AssignStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#callStmt}.
	 * @param ctx the parse tree
	 */
	void enterCallStmt(PascalishParser.CallStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#callStmt}.
	 * @param ctx the parse tree
	 */
	void exitCallStmt(PascalishParser.CallStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#ifStmt}.
	 * @param ctx the parse tree
	 */
	void enterIfStmt(PascalishParser.IfStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#ifStmt}.
	 * @param ctx the parse tree
	 */
	void exitIfStmt(PascalishParser.IfStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#whileStmt}.
	 * @param ctx the parse tree
	 */
	void enterWhileStmt(PascalishParser.WhileStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#whileStmt}.
	 * @param ctx the parse tree
	 */
	void exitWhileStmt(PascalishParser.WhileStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#forStmt}.
	 * @param ctx the parse tree
	 */
	void enterForStmt(PascalishParser.ForStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#forStmt}.
	 * @param ctx the parse tree
	 */
	void exitForStmt(PascalishParser.ForStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#repeatStmt}.
	 * @param ctx the parse tree
	 */
	void enterRepeatStmt(PascalishParser.RepeatStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#repeatStmt}.
	 * @param ctx the parse tree
	 */
	void exitRepeatStmt(PascalishParser.RepeatStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#enqueueStmt}.
	 * @param ctx the parse tree
	 */
	void enterEnqueueStmt(PascalishParser.EnqueueStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#enqueueStmt}.
	 * @param ctx the parse tree
	 */
	void exitEnqueueStmt(PascalishParser.EnqueueStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#dequeueStmt}.
	 * @param ctx the parse tree
	 */
	void enterDequeueStmt(PascalishParser.DequeueStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#dequeueStmt}.
	 * @param ctx the parse tree
	 */
	void exitDequeueStmt(PascalishParser.DequeueStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#peekStmt}.
	 * @param ctx the parse tree
	 */
	void enterPeekStmt(PascalishParser.PeekStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#peekStmt}.
	 * @param ctx the parse tree
	 */
	void exitPeekStmt(PascalishParser.PeekStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#pushStmt}.
	 * @param ctx the parse tree
	 */
	void enterPushStmt(PascalishParser.PushStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#pushStmt}.
	 * @param ctx the parse tree
	 */
	void exitPushStmt(PascalishParser.PushStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#popStmt}.
	 * @param ctx the parse tree
	 */
	void enterPopStmt(PascalishParser.PopStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#popStmt}.
	 * @param ctx the parse tree
	 */
	void exitPopStmt(PascalishParser.PopStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#concurrentStmt}.
	 * @param ctx the parse tree
	 */
	void enterConcurrentStmt(PascalishParser.ConcurrentStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#concurrentStmt}.
	 * @param ctx the parse tree
	 */
	void exitConcurrentStmt(PascalishParser.ConcurrentStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#cobeginStmt}.
	 * @param ctx the parse tree
	 */
	void enterCobeginStmt(PascalishParser.CobeginStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#cobeginStmt}.
	 * @param ctx the parse tree
	 */
	void exitCobeginStmt(PascalishParser.CobeginStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#asyncStmt}.
	 * @param ctx the parse tree
	 */
	void enterAsyncStmt(PascalishParser.AsyncStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#asyncStmt}.
	 * @param ctx the parse tree
	 */
	void exitAsyncStmt(PascalishParser.AsyncStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#waitStmt}.
	 * @param ctx the parse tree
	 */
	void enterWaitStmt(PascalishParser.WaitStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#waitStmt}.
	 * @param ctx the parse tree
	 */
	void exitWaitStmt(PascalishParser.WaitStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#syncStmt}.
	 * @param ctx the parse tree
	 */
	void enterSyncStmt(PascalishParser.SyncStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#syncStmt}.
	 * @param ctx the parse tree
	 */
	void exitSyncStmt(PascalishParser.SyncStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#subflowStmt}.
	 * @param ctx the parse tree
	 */
	void enterSubflowStmt(PascalishParser.SubflowStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#subflowStmt}.
	 * @param ctx the parse tree
	 */
	void exitSubflowStmt(PascalishParser.SubflowStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#fileStmt}.
	 * @param ctx the parse tree
	 */
	void enterFileStmt(PascalishParser.FileStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#fileStmt}.
	 * @param ctx the parse tree
	 */
	void exitFileStmt(PascalishParser.FileStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#lvalue}.
	 * @param ctx the parse tree
	 */
	void enterLvalue(PascalishParser.LvalueContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#lvalue}.
	 * @param ctx the parse tree
	 */
	void exitLvalue(PascalishParser.LvalueContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#qualifiedName}.
	 * @param ctx the parse tree
	 */
	void enterQualifiedName(PascalishParser.QualifiedNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#qualifiedName}.
	 * @param ctx the parse tree
	 */
	void exitQualifiedName(PascalishParser.QualifiedNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#exprList}.
	 * @param ctx the parse tree
	 */
	void enterExprList(PascalishParser.ExprListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#exprList}.
	 * @param ctx the parse tree
	 */
	void exitExprList(PascalishParser.ExprListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterExpr(PascalishParser.ExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitExpr(PascalishParser.ExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#logicalOrExpr}.
	 * @param ctx the parse tree
	 */
	void enterLogicalOrExpr(PascalishParser.LogicalOrExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#logicalOrExpr}.
	 * @param ctx the parse tree
	 */
	void exitLogicalOrExpr(PascalishParser.LogicalOrExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#logicalAndExpr}.
	 * @param ctx the parse tree
	 */
	void enterLogicalAndExpr(PascalishParser.LogicalAndExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#logicalAndExpr}.
	 * @param ctx the parse tree
	 */
	void exitLogicalAndExpr(PascalishParser.LogicalAndExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#equalityExpr}.
	 * @param ctx the parse tree
	 */
	void enterEqualityExpr(PascalishParser.EqualityExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#equalityExpr}.
	 * @param ctx the parse tree
	 */
	void exitEqualityExpr(PascalishParser.EqualityExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#relationalExpr}.
	 * @param ctx the parse tree
	 */
	void enterRelationalExpr(PascalishParser.RelationalExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#relationalExpr}.
	 * @param ctx the parse tree
	 */
	void exitRelationalExpr(PascalishParser.RelationalExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#additiveExpr}.
	 * @param ctx the parse tree
	 */
	void enterAdditiveExpr(PascalishParser.AdditiveExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#additiveExpr}.
	 * @param ctx the parse tree
	 */
	void exitAdditiveExpr(PascalishParser.AdditiveExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#multiplicativeExpr}.
	 * @param ctx the parse tree
	 */
	void enterMultiplicativeExpr(PascalishParser.MultiplicativeExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#multiplicativeExpr}.
	 * @param ctx the parse tree
	 */
	void exitMultiplicativeExpr(PascalishParser.MultiplicativeExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#unaryExpr}.
	 * @param ctx the parse tree
	 */
	void enterUnaryExpr(PascalishParser.UnaryExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#unaryExpr}.
	 * @param ctx the parse tree
	 */
	void exitUnaryExpr(PascalishParser.UnaryExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#primaryExpr}.
	 * @param ctx the parse tree
	 */
	void enterPrimaryExpr(PascalishParser.PrimaryExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#primaryExpr}.
	 * @param ctx the parse tree
	 */
	void exitPrimaryExpr(PascalishParser.PrimaryExprContext ctx);
}