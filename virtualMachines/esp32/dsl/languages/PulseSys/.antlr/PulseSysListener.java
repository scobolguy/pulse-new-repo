// Generated from c:/Users/scobo/OneDrive/Documents/GitHub/pulse-new-repo/virtualMachines/esp32/dsl/languages/PulseSys/PulseSys.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link PulseSysParser}.
 */
public interface PulseSysListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#program}.
	 * @param ctx the parse tree
	 */
	void enterProgram(PulseSysParser.ProgramContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#program}.
	 * @param ctx the parse tree
	 */
	void exitProgram(PulseSysParser.ProgramContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#declaration}.
	 * @param ctx the parse tree
	 */
	void enterDeclaration(PulseSysParser.DeclarationContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#declaration}.
	 * @param ctx the parse tree
	 */
	void exitDeclaration(PulseSysParser.DeclarationContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#var_decl}.
	 * @param ctx the parse tree
	 */
	void enterVar_decl(PulseSysParser.Var_declContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#var_decl}.
	 * @param ctx the parse tree
	 */
	void exitVar_decl(PulseSysParser.Var_declContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#var_list}.
	 * @param ctx the parse tree
	 */
	void enterVar_list(PulseSysParser.Var_listContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#var_list}.
	 * @param ctx the parse tree
	 */
	void exitVar_list(PulseSysParser.Var_listContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#type}.
	 * @param ctx the parse tree
	 */
	void enterType(PulseSysParser.TypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#type}.
	 * @param ctx the parse tree
	 */
	void exitType(PulseSysParser.TypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#array_type}.
	 * @param ctx the parse tree
	 */
	void enterArray_type(PulseSysParser.Array_typeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#array_type}.
	 * @param ctx the parse tree
	 */
	void exitArray_type(PulseSysParser.Array_typeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#record_type}.
	 * @param ctx the parse tree
	 */
	void enterRecord_type(PulseSysParser.Record_typeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#record_type}.
	 * @param ctx the parse tree
	 */
	void exitRecord_type(PulseSysParser.Record_typeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#proc_decl}.
	 * @param ctx the parse tree
	 */
	void enterProc_decl(PulseSysParser.Proc_declContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#proc_decl}.
	 * @param ctx the parse tree
	 */
	void exitProc_decl(PulseSysParser.Proc_declContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#param_list}.
	 * @param ctx the parse tree
	 */
	void enterParam_list(PulseSysParser.Param_listContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#param_list}.
	 * @param ctx the parse tree
	 */
	void exitParam_list(PulseSysParser.Param_listContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#param}.
	 * @param ctx the parse tree
	 */
	void enterParam(PulseSysParser.ParamContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#param}.
	 * @param ctx the parse tree
	 */
	void exitParam(PulseSysParser.ParamContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#statement}.
	 * @param ctx the parse tree
	 */
	void enterStatement(PulseSysParser.StatementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#statement}.
	 * @param ctx the parse tree
	 */
	void exitStatement(PulseSysParser.StatementContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#assign_stmt}.
	 * @param ctx the parse tree
	 */
	void enterAssign_stmt(PulseSysParser.Assign_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#assign_stmt}.
	 * @param ctx the parse tree
	 */
	void exitAssign_stmt(PulseSysParser.Assign_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#if_stmt}.
	 * @param ctx the parse tree
	 */
	void enterIf_stmt(PulseSysParser.If_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#if_stmt}.
	 * @param ctx the parse tree
	 */
	void exitIf_stmt(PulseSysParser.If_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#while_stmt}.
	 * @param ctx the parse tree
	 */
	void enterWhile_stmt(PulseSysParser.While_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#while_stmt}.
	 * @param ctx the parse tree
	 */
	void exitWhile_stmt(PulseSysParser.While_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#for_stmt}.
	 * @param ctx the parse tree
	 */
	void enterFor_stmt(PulseSysParser.For_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#for_stmt}.
	 * @param ctx the parse tree
	 */
	void exitFor_stmt(PulseSysParser.For_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#proc_call}.
	 * @param ctx the parse tree
	 */
	void enterProc_call(PulseSysParser.Proc_callContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#proc_call}.
	 * @param ctx the parse tree
	 */
	void exitProc_call(PulseSysParser.Proc_callContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#spawn_stmt}.
	 * @param ctx the parse tree
	 */
	void enterSpawn_stmt(PulseSysParser.Spawn_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#spawn_stmt}.
	 * @param ctx the parse tree
	 */
	void exitSpawn_stmt(PulseSysParser.Spawn_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#send_stmt}.
	 * @param ctx the parse tree
	 */
	void enterSend_stmt(PulseSysParser.Send_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#send_stmt}.
	 * @param ctx the parse tree
	 */
	void exitSend_stmt(PulseSysParser.Send_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#recv_stmt}.
	 * @param ctx the parse tree
	 */
	void enterRecv_stmt(PulseSysParser.Recv_stmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#recv_stmt}.
	 * @param ctx the parse tree
	 */
	void exitRecv_stmt(PulseSysParser.Recv_stmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#expr}.
	 * @param ctx the parse tree
	 */
	void enterExpr(PulseSysParser.ExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#expr}.
	 * @param ctx the parse tree
	 */
	void exitExpr(PulseSysParser.ExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#simple_expr}.
	 * @param ctx the parse tree
	 */
	void enterSimple_expr(PulseSysParser.Simple_exprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#simple_expr}.
	 * @param ctx the parse tree
	 */
	void exitSimple_expr(PulseSysParser.Simple_exprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#term}.
	 * @param ctx the parse tree
	 */
	void enterTerm(PulseSysParser.TermContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#term}.
	 * @param ctx the parse tree
	 */
	void exitTerm(PulseSysParser.TermContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#factor}.
	 * @param ctx the parse tree
	 */
	void enterFactor(PulseSysParser.FactorContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#factor}.
	 * @param ctx the parse tree
	 */
	void exitFactor(PulseSysParser.FactorContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#relop}.
	 * @param ctx the parse tree
	 */
	void enterRelop(PulseSysParser.RelopContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#relop}.
	 * @param ctx the parse tree
	 */
	void exitRelop(PulseSysParser.RelopContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#addop}.
	 * @param ctx the parse tree
	 */
	void enterAddop(PulseSysParser.AddopContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#addop}.
	 * @param ctx the parse tree
	 */
	void exitAddop(PulseSysParser.AddopContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#mulop}.
	 * @param ctx the parse tree
	 */
	void enterMulop(PulseSysParser.MulopContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#mulop}.
	 * @param ctx the parse tree
	 */
	void exitMulop(PulseSysParser.MulopContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#identifier}.
	 * @param ctx the parse tree
	 */
	void enterIdentifier(PulseSysParser.IdentifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#identifier}.
	 * @param ctx the parse tree
	 */
	void exitIdentifier(PulseSysParser.IdentifierContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#int_lit}.
	 * @param ctx the parse tree
	 */
	void enterInt_lit(PulseSysParser.Int_litContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#int_lit}.
	 * @param ctx the parse tree
	 */
	void exitInt_lit(PulseSysParser.Int_litContext ctx);
	/**
	 * Enter a parse tree produced by {@link PulseSysParser#bool_lit}.
	 * @param ctx the parse tree
	 */
	void enterBool_lit(PulseSysParser.Bool_litContext ctx);
	/**
	 * Exit a parse tree produced by {@link PulseSysParser#bool_lit}.
	 * @param ctx the parse tree
	 */
	void exitBool_lit(PulseSysParser.Bool_litContext ctx);
}