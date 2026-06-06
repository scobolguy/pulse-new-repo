// Generated from c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/grammar/WorkflowDsl.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link WorkflowDslParser}.
 */
public interface WorkflowDslListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#program}.
	 * @param ctx the parse tree
	 */
	void enterProgram(WorkflowDslParser.ProgramContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#program}.
	 * @param ctx the parse tree
	 */
	void exitProgram(WorkflowDslParser.ProgramContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#item}.
	 * @param ctx the parse tree
	 */
	void enterItem(WorkflowDslParser.ItemContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#item}.
	 * @param ctx the parse tree
	 */
	void exitItem(WorkflowDslParser.ItemContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#queueDecl}.
	 * @param ctx the parse tree
	 */
	void enterQueueDecl(WorkflowDslParser.QueueDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#queueDecl}.
	 * @param ctx the parse tree
	 */
	void exitQueueDecl(WorkflowDslParser.QueueDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#fileDecl}.
	 * @param ctx the parse tree
	 */
	void enterFileDecl(WorkflowDslParser.FileDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#fileDecl}.
	 * @param ctx the parse tree
	 */
	void exitFileDecl(WorkflowDslParser.FileDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#apiDecl}.
	 * @param ctx the parse tree
	 */
	void enterApiDecl(WorkflowDslParser.ApiDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#apiDecl}.
	 * @param ctx the parse tree
	 */
	void exitApiDecl(WorkflowDslParser.ApiDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#workflowDecl}.
	 * @param ctx the parse tree
	 */
	void enterWorkflowDecl(WorkflowDslParser.WorkflowDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#workflowDecl}.
	 * @param ctx the parse tree
	 */
	void exitWorkflowDecl(WorkflowDslParser.WorkflowDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#workflowStmt}.
	 * @param ctx the parse tree
	 */
	void enterWorkflowStmt(WorkflowDslParser.WorkflowStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#workflowStmt}.
	 * @param ctx the parse tree
	 */
	void exitWorkflowStmt(WorkflowDslParser.WorkflowStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#stepStmt}.
	 * @param ctx the parse tree
	 */
	void enterStepStmt(WorkflowDslParser.StepStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#stepStmt}.
	 * @param ctx the parse tree
	 */
	void exitStepStmt(WorkflowDslParser.StepStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#stepBody}.
	 * @param ctx the parse tree
	 */
	void enterStepBody(WorkflowDslParser.StepBodyContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#stepBody}.
	 * @param ctx the parse tree
	 */
	void exitStepBody(WorkflowDslParser.StepBodyContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#stepToken}.
	 * @param ctx the parse tree
	 */
	void enterStepToken(WorkflowDslParser.StepTokenContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#stepToken}.
	 * @param ctx the parse tree
	 */
	void exitStepToken(WorkflowDslParser.StepTokenContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#ifStmt}.
	 * @param ctx the parse tree
	 */
	void enterIfStmt(WorkflowDslParser.IfStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#ifStmt}.
	 * @param ctx the parse tree
	 */
	void exitIfStmt(WorkflowDslParser.IfStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#branch}.
	 * @param ctx the parse tree
	 */
	void enterBranch(WorkflowDslParser.BranchContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#branch}.
	 * @param ctx the parse tree
	 */
	void exitBranch(WorkflowDslParser.BranchContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#quotedList}.
	 * @param ctx the parse tree
	 */
	void enterQuotedList(WorkflowDslParser.QuotedListContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#quotedList}.
	 * @param ctx the parse tree
	 */
	void exitQuotedList(WorkflowDslParser.QuotedListContext ctx);
	/**
	 * Enter a parse tree produced by {@link WorkflowDslParser#quotedString}.
	 * @param ctx the parse tree
	 */
	void enterQuotedString(WorkflowDslParser.QuotedStringContext ctx);
	/**
	 * Exit a parse tree produced by {@link WorkflowDslParser#quotedString}.
	 * @param ctx the parse tree
	 */
	void exitQuotedString(WorkflowDslParser.QuotedStringContext ctx);
}