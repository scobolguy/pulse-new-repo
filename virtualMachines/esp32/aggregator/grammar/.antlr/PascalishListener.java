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
	 * Enter a parse tree produced by {@link PascalishParser#unitEnd}.
	 * @param ctx the parse tree
	 */
	void enterUnitEnd(PascalishParser.UnitEndContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#unitEnd}.
	 * @param ctx the parse tree
	 */
	void exitUnitEnd(PascalishParser.UnitEndContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#unitDecl}.
	 * @param ctx the parse tree
	 */
	void enterUnitDecl(PascalishParser.UnitDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#unitDecl}.
	 * @param ctx the parse tree
	 */
	void exitUnitDecl(PascalishParser.UnitDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#varSection}.
	 * @param ctx the parse tree
	 */
	void enterVarSection(PascalishParser.VarSectionContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#varSection}.
	 * @param ctx the parse tree
	 */
	void exitVarSection(PascalishParser.VarSectionContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#varLine}.
	 * @param ctx the parse tree
	 */
	void enterVarLine(PascalishParser.VarLineContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#varLine}.
	 * @param ctx the parse tree
	 */
	void exitVarLine(PascalishParser.VarLineContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#subprogramDecl}.
	 * @param ctx the parse tree
	 */
	void enterSubprogramDecl(PascalishParser.SubprogramDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#subprogramDecl}.
	 * @param ctx the parse tree
	 */
	void exitSubprogramDecl(PascalishParser.SubprogramDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#exportFlag}.
	 * @param ctx the parse tree
	 */
	void enterExportFlag(PascalishParser.ExportFlagContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#exportFlag}.
	 * @param ctx the parse tree
	 */
	void exitExportFlag(PascalishParser.ExportFlagContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#paramSection}.
	 * @param ctx the parse tree
	 */
	void enterParamSection(PascalishParser.ParamSectionContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#paramSection}.
	 * @param ctx the parse tree
	 */
	void exitParamSection(PascalishParser.ParamSectionContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#paramGroup}.
	 * @param ctx the parse tree
	 */
	void enterParamGroup(PascalishParser.ParamGroupContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#paramGroup}.
	 * @param ctx the parse tree
	 */
	void exitParamGroup(PascalishParser.ParamGroupContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#typeBinding}.
	 * @param ctx the parse tree
	 */
	void enterTypeBinding(PascalishParser.TypeBindingContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#typeBinding}.
	 * @param ctx the parse tree
	 */
	void exitTypeBinding(PascalishParser.TypeBindingContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#objectPascalClassType}.
	 * @param ctx the parse tree
	 */
	void enterObjectPascalClassType(PascalishParser.ObjectPascalClassTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#objectPascalClassType}.
	 * @param ctx the parse tree
	 */
	void exitObjectPascalClassType(PascalishParser.ObjectPascalClassTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classDecl}.
	 * @param ctx the parse tree
	 */
	void enterClassDecl(PascalishParser.ClassDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classDecl}.
	 * @param ctx the parse tree
	 */
	void exitClassDecl(PascalishParser.ClassDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classInheritance}.
	 * @param ctx the parse tree
	 */
	void enterClassInheritance(PascalishParser.ClassInheritanceContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classInheritance}.
	 * @param ctx the parse tree
	 */
	void exitClassInheritance(PascalishParser.ClassInheritanceContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classBodyItem}.
	 * @param ctx the parse tree
	 */
	void enterClassBodyItem(PascalishParser.ClassBodyItemContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classBodyItem}.
	 * @param ctx the parse tree
	 */
	void exitClassBodyItem(PascalishParser.ClassBodyItemContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classVisibility}.
	 * @param ctx the parse tree
	 */
	void enterClassVisibility(PascalishParser.ClassVisibilityContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classVisibility}.
	 * @param ctx the parse tree
	 */
	void exitClassVisibility(PascalishParser.ClassVisibilityContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classMember}.
	 * @param ctx the parse tree
	 */
	void enterClassMember(PascalishParser.ClassMemberContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classMember}.
	 * @param ctx the parse tree
	 */
	void exitClassMember(PascalishParser.ClassMemberContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classFieldDecl}.
	 * @param ctx the parse tree
	 */
	void enterClassFieldDecl(PascalishParser.ClassFieldDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classFieldDecl}.
	 * @param ctx the parse tree
	 */
	void exitClassFieldDecl(PascalishParser.ClassFieldDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classMethodKind}.
	 * @param ctx the parse tree
	 */
	void enterClassMethodKind(PascalishParser.ClassMethodKindContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classMethodKind}.
	 * @param ctx the parse tree
	 */
	void exitClassMethodKind(PascalishParser.ClassMethodKindContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classMethodDecl}.
	 * @param ctx the parse tree
	 */
	void enterClassMethodDecl(PascalishParser.ClassMethodDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classMethodDecl}.
	 * @param ctx the parse tree
	 */
	void exitClassMethodDecl(PascalishParser.ClassMethodDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#methodImplDecl}.
	 * @param ctx the parse tree
	 */
	void enterMethodImplDecl(PascalishParser.MethodImplDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#methodImplDecl}.
	 * @param ctx the parse tree
	 */
	void exitMethodImplDecl(PascalishParser.MethodImplDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#classOperatorDecl}.
	 * @param ctx the parse tree
	 */
	void enterClassOperatorDecl(PascalishParser.ClassOperatorDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#classOperatorDecl}.
	 * @param ctx the parse tree
	 */
	void exitClassOperatorDecl(PascalishParser.ClassOperatorDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#operatorTarget}.
	 * @param ctx the parse tree
	 */
	void enterOperatorTarget(PascalishParser.OperatorTargetContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#operatorTarget}.
	 * @param ctx the parse tree
	 */
	void exitOperatorTarget(PascalishParser.OperatorTargetContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#methodParamList}.
	 * @param ctx the parse tree
	 */
	void enterMethodParamList(PascalishParser.MethodParamListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#methodParamList}.
	 * @param ctx the parse tree
	 */
	void exitMethodParamList(PascalishParser.MethodParamListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#methodParamDecl}.
	 * @param ctx the parse tree
	 */
	void enterMethodParamDecl(PascalishParser.MethodParamDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#methodParamDecl}.
	 * @param ctx the parse tree
	 */
	void exitMethodParamDecl(PascalishParser.MethodParamDeclContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#varSource}.
	 * @param ctx the parse tree
	 */
	void enterVarSource(PascalishParser.VarSourceContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#varSource}.
	 * @param ctx the parse tree
	 */
	void exitVarSource(PascalishParser.VarSourceContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#identList}.
	 * @param ctx the parse tree
	 */
	void enterIdentList(PascalishParser.IdentListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#identList}.
	 * @param ctx the parse tree
	 */
	void exitIdentList(PascalishParser.IdentListContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#databaseDecl}.
	 * @param ctx the parse tree
	 */
	void enterDatabaseDecl(PascalishParser.DatabaseDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#databaseDecl}.
	 * @param ctx the parse tree
	 */
	void exitDatabaseDecl(PascalishParser.DatabaseDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#databaseBinding}.
	 * @param ctx the parse tree
	 */
	void enterDatabaseBinding(PascalishParser.DatabaseBindingContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#databaseBinding}.
	 * @param ctx the parse tree
	 */
	void exitDatabaseBinding(PascalishParser.DatabaseBindingContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#tableDecl}.
	 * @param ctx the parse tree
	 */
	void enterTableDecl(PascalishParser.TableDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#tableDecl}.
	 * @param ctx the parse tree
	 */
	void exitTableDecl(PascalishParser.TableDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#tableBinding}.
	 * @param ctx the parse tree
	 */
	void enterTableBinding(PascalishParser.TableBindingContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#tableBinding}.
	 * @param ctx the parse tree
	 */
	void exitTableBinding(PascalishParser.TableBindingContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#columnDecl}.
	 * @param ctx the parse tree
	 */
	void enterColumnDecl(PascalishParser.ColumnDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#columnDecl}.
	 * @param ctx the parse tree
	 */
	void exitColumnDecl(PascalishParser.ColumnDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#systemDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemDecl(PascalishParser.SystemDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#systemDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemDecl(PascalishParser.SystemDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#systemMember}.
	 * @param ctx the parse tree
	 */
	void enterSystemMember(PascalishParser.SystemMemberContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#systemMember}.
	 * @param ctx the parse tree
	 */
	void exitSystemMember(PascalishParser.SystemMemberContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#systemQueueDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemQueueDecl(PascalishParser.SystemQueueDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#systemQueueDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemQueueDecl(PascalishParser.SystemQueueDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#systemServiceDecl}.
	 * @param ctx the parse tree
	 */
	void enterSystemServiceDecl(PascalishParser.SystemServiceDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#systemServiceDecl}.
	 * @param ctx the parse tree
	 */
	void exitSystemServiceDecl(PascalishParser.SystemServiceDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#systemVisibilityClause}.
	 * @param ctx the parse tree
	 */
	void enterSystemVisibilityClause(PascalishParser.SystemVisibilityClauseContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#systemVisibilityClause}.
	 * @param ctx the parse tree
	 */
	void exitSystemVisibilityClause(PascalishParser.SystemVisibilityClauseContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#enumType}.
	 * @param ctx the parse tree
	 */
	void enterEnumType(PascalishParser.EnumTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#enumType}.
	 * @param ctx the parse tree
	 */
	void exitEnumType(PascalishParser.EnumTypeContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#listType}.
	 * @param ctx the parse tree
	 */
	void enterListType(PascalishParser.ListTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#listType}.
	 * @param ctx the parse tree
	 */
	void exitListType(PascalishParser.ListTypeContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#genericTypeParams}.
	 * @param ctx the parse tree
	 */
	void enterGenericTypeParams(PascalishParser.GenericTypeParamsContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#genericTypeParams}.
	 * @param ctx the parse tree
	 */
	void exitGenericTypeParams(PascalishParser.GenericTypeParamsContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#decimalType}.
	 * @param ctx the parse tree
	 */
	void enterDecimalType(PascalishParser.DecimalTypeContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#decimalType}.
	 * @param ctx the parse tree
	 */
	void exitDecimalType(PascalishParser.DecimalTypeContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#typeName}.
	 * @param ctx the parse tree
	 */
	void enterTypeName(PascalishParser.TypeNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#typeName}.
	 * @param ctx the parse tree
	 */
	void exitTypeName(PascalishParser.TypeNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#pascalIdentifier}.
	 * @param ctx the parse tree
	 */
	void enterPascalIdentifier(PascalishParser.PascalIdentifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#pascalIdentifier}.
	 * @param ctx the parse tree
	 */
	void exitPascalIdentifier(PascalishParser.PascalIdentifierContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#genericTypeArgs}.
	 * @param ctx the parse tree
	 */
	void enterGenericTypeArgs(PascalishParser.GenericTypeArgsContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#genericTypeArgs}.
	 * @param ctx the parse tree
	 */
	void exitGenericTypeArgs(PascalishParser.GenericTypeArgsContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#roleDecl}.
	 * @param ctx the parse tree
	 */
	void enterRoleDecl(PascalishParser.RoleDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#roleDecl}.
	 * @param ctx the parse tree
	 */
	void exitRoleDecl(PascalishParser.RoleDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#roleName}.
	 * @param ctx the parse tree
	 */
	void enterRoleName(PascalishParser.RoleNameContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#roleName}.
	 * @param ctx the parse tree
	 */
	void exitRoleName(PascalishParser.RoleNameContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#libraryDecl}.
	 * @param ctx the parse tree
	 */
	void enterLibraryDecl(PascalishParser.LibraryDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#libraryDecl}.
	 * @param ctx the parse tree
	 */
	void exitLibraryDecl(PascalishParser.LibraryDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#librarySource}.
	 * @param ctx the parse tree
	 */
	void enterLibrarySource(PascalishParser.LibrarySourceContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#librarySource}.
	 * @param ctx the parse tree
	 */
	void exitLibrarySource(PascalishParser.LibrarySourceContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#useDecl}.
	 * @param ctx the parse tree
	 */
	void enterUseDecl(PascalishParser.UseDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#useDecl}.
	 * @param ctx the parse tree
	 */
	void exitUseDecl(PascalishParser.UseDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#interopDecl}.
	 * @param ctx the parse tree
	 */
	void enterInteropDecl(PascalishParser.InteropDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#interopDecl}.
	 * @param ctx the parse tree
	 */
	void exitInteropDecl(PascalishParser.InteropDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#interopKind}.
	 * @param ctx the parse tree
	 */
	void enterInteropKind(PascalishParser.InteropKindContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#interopKind}.
	 * @param ctx the parse tree
	 */
	void exitInteropKind(PascalishParser.InteropKindContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#importDecl}.
	 * @param ctx the parse tree
	 */
	void enterImportDecl(PascalishParser.ImportDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#importDecl}.
	 * @param ctx the parse tree
	 */
	void exitImportDecl(PascalishParser.ImportDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#importTarget}.
	 * @param ctx the parse tree
	 */
	void enterImportTarget(PascalishParser.ImportTargetContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#importTarget}.
	 * @param ctx the parse tree
	 */
	void exitImportTarget(PascalishParser.ImportTargetContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceProvider}.
	 * @param ctx the parse tree
	 */
	void enterServiceProvider(PascalishParser.ServiceProviderContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceProvider}.
	 * @param ctx the parse tree
	 */
	void exitServiceProvider(PascalishParser.ServiceProviderContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#routerDecl}.
	 * @param ctx the parse tree
	 */
	void enterRouterDecl(PascalishParser.RouterDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#routerDecl}.
	 * @param ctx the parse tree
	 */
	void exitRouterDecl(PascalishParser.RouterDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#routerHeaderProp}.
	 * @param ctx the parse tree
	 */
	void enterRouterHeaderProp(PascalishParser.RouterHeaderPropContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#routerHeaderProp}.
	 * @param ctx the parse tree
	 */
	void exitRouterHeaderProp(PascalishParser.RouterHeaderPropContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#verbList}.
	 * @param ctx the parse tree
	 */
	void enterVerbList(PascalishParser.VerbListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#verbList}.
	 * @param ctx the parse tree
	 */
	void exitVerbList(PascalishParser.VerbListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#outputDecl}.
	 * @param ctx the parse tree
	 */
	void enterOutputDecl(PascalishParser.OutputDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#outputDecl}.
	 * @param ctx the parse tree
	 */
	void exitOutputDecl(PascalishParser.OutputDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#outputTypeMeta}.
	 * @param ctx the parse tree
	 */
	void enterOutputTypeMeta(PascalishParser.OutputTypeMetaContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#outputTypeMeta}.
	 * @param ctx the parse tree
	 */
	void exitOutputTypeMeta(PascalishParser.OutputTypeMetaContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#typeRefList}.
	 * @param ctx the parse tree
	 */
	void enterTypeRefList(PascalishParser.TypeRefListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#typeRefList}.
	 * @param ctx the parse tree
	 */
	void exitTypeRefList(PascalishParser.TypeRefListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#mapperDecl}.
	 * @param ctx the parse tree
	 */
	void enterMapperDecl(PascalishParser.MapperDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#mapperDecl}.
	 * @param ctx the parse tree
	 */
	void exitMapperDecl(PascalishParser.MapperDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#mapperHeaderProp}.
	 * @param ctx the parse tree
	 */
	void enterMapperHeaderProp(PascalishParser.MapperHeaderPropContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#mapperHeaderProp}.
	 * @param ctx the parse tree
	 */
	void exitMapperHeaderProp(PascalishParser.MapperHeaderPropContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#mapDecl}.
	 * @param ctx the parse tree
	 */
	void enterMapDecl(PascalishParser.MapDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#mapDecl}.
	 * @param ctx the parse tree
	 */
	void exitMapDecl(PascalishParser.MapDeclContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#serviceBodyElement}.
	 * @param ctx the parse tree
	 */
	void enterServiceBodyElement(PascalishParser.ServiceBodyElementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceBodyElement}.
	 * @param ctx the parse tree
	 */
	void exitServiceBodyElement(PascalishParser.ServiceBodyElementContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceLocalDecl}.
	 * @param ctx the parse tree
	 */
	void enterServiceLocalDecl(PascalishParser.ServiceLocalDeclContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceLocalDecl}.
	 * @param ctx the parse tree
	 */
	void exitServiceLocalDecl(PascalishParser.ServiceLocalDeclContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceEndpoint}.
	 * @param ctx the parse tree
	 */
	void enterServiceEndpoint(PascalishParser.ServiceEndpointContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceEndpoint}.
	 * @param ctx the parse tree
	 */
	void exitServiceEndpoint(PascalishParser.ServiceEndpointContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#httpVerb}.
	 * @param ctx the parse tree
	 */
	void enterHttpVerb(PascalishParser.HttpVerbContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#httpVerb}.
	 * @param ctx the parse tree
	 */
	void exitHttpVerb(PascalishParser.HttpVerbContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#endpointAccepts}.
	 * @param ctx the parse tree
	 */
	void enterEndpointAccepts(PascalishParser.EndpointAcceptsContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#endpointAccepts}.
	 * @param ctx the parse tree
	 */
	void exitEndpointAccepts(PascalishParser.EndpointAcceptsContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#endpointReturns}.
	 * @param ctx the parse tree
	 */
	void enterEndpointReturns(PascalishParser.EndpointReturnsContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#endpointReturns}.
	 * @param ctx the parse tree
	 */
	void exitEndpointReturns(PascalishParser.EndpointReturnsContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceStmt}.
	 * @param ctx the parse tree
	 */
	void enterServiceStmt(PascalishParser.ServiceStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceStmt}.
	 * @param ctx the parse tree
	 */
	void exitServiceStmt(PascalishParser.ServiceStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceRouteStmt}.
	 * @param ctx the parse tree
	 */
	void enterServiceRouteStmt(PascalishParser.ServiceRouteStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceRouteStmt}.
	 * @param ctx the parse tree
	 */
	void exitServiceRouteStmt(PascalishParser.ServiceRouteStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceCaseStmt}.
	 * @param ctx the parse tree
	 */
	void enterServiceCaseStmt(PascalishParser.ServiceCaseStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceCaseStmt}.
	 * @param ctx the parse tree
	 */
	void exitServiceCaseStmt(PascalishParser.ServiceCaseStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceCaseArm}.
	 * @param ctx the parse tree
	 */
	void enterServiceCaseArm(PascalishParser.ServiceCaseArmContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceCaseArm}.
	 * @param ctx the parse tree
	 */
	void exitServiceCaseArm(PascalishParser.ServiceCaseArmContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceReturnStmt}.
	 * @param ctx the parse tree
	 */
	void enterServiceReturnStmt(PascalishParser.ServiceReturnStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceReturnStmt}.
	 * @param ctx the parse tree
	 */
	void exitServiceReturnStmt(PascalishParser.ServiceReturnStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#serviceExpr}.
	 * @param ctx the parse tree
	 */
	void enterServiceExpr(PascalishParser.ServiceExprContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#serviceExpr}.
	 * @param ctx the parse tree
	 */
	void exitServiceExpr(PascalishParser.ServiceExprContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#pl0Snippet}.
	 * @param ctx the parse tree
	 */
	void enterPl0Snippet(PascalishParser.Pl0SnippetContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#pl0Snippet}.
	 * @param ctx the parse tree
	 */
	void exitPl0Snippet(PascalishParser.Pl0SnippetContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#pl0Block}.
	 * @param ctx the parse tree
	 */
	void enterPl0Block(PascalishParser.Pl0BlockContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#pl0Block}.
	 * @param ctx the parse tree
	 */
	void exitPl0Block(PascalishParser.Pl0BlockContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#pl0Element}.
	 * @param ctx the parse tree
	 */
	void enterPl0Element(PascalishParser.Pl0ElementContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#pl0Element}.
	 * @param ctx the parse tree
	 */
	void exitPl0Element(PascalishParser.Pl0ElementContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#statementList}.
	 * @param ctx the parse tree
	 */
	void enterStatementList(PascalishParser.StatementListContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#statementList}.
	 * @param ctx the parse tree
	 */
	void exitStatementList(PascalishParser.StatementListContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#blockStmt}.
	 * @param ctx the parse tree
	 */
	void enterBlockStmt(PascalishParser.BlockStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#blockStmt}.
	 * @param ctx the parse tree
	 */
	void exitBlockStmt(PascalishParser.BlockStmtContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#raiseStmt}.
	 * @param ctx the parse tree
	 */
	void enterRaiseStmt(PascalishParser.RaiseStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#raiseStmt}.
	 * @param ctx the parse tree
	 */
	void exitRaiseStmt(PascalishParser.RaiseStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#withStmt}.
	 * @param ctx the parse tree
	 */
	void enterWithStmt(PascalishParser.WithStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#withStmt}.
	 * @param ctx the parse tree
	 */
	void exitWithStmt(PascalishParser.WithStmtContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#insertStmt}.
	 * @param ctx the parse tree
	 */
	void enterInsertStmt(PascalishParser.InsertStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#insertStmt}.
	 * @param ctx the parse tree
	 */
	void exitInsertStmt(PascalishParser.InsertStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#selectStmt}.
	 * @param ctx the parse tree
	 */
	void enterSelectStmt(PascalishParser.SelectStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#selectStmt}.
	 * @param ctx the parse tree
	 */
	void exitSelectStmt(PascalishParser.SelectStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#selectColumns}.
	 * @param ctx the parse tree
	 */
	void enterSelectColumns(PascalishParser.SelectColumnsContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#selectColumns}.
	 * @param ctx the parse tree
	 */
	void exitSelectColumns(PascalishParser.SelectColumnsContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#updateStmt}.
	 * @param ctx the parse tree
	 */
	void enterUpdateStmt(PascalishParser.UpdateStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#updateStmt}.
	 * @param ctx the parse tree
	 */
	void exitUpdateStmt(PascalishParser.UpdateStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#columnAssign}.
	 * @param ctx the parse tree
	 */
	void enterColumnAssign(PascalishParser.ColumnAssignContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#columnAssign}.
	 * @param ctx the parse tree
	 */
	void exitColumnAssign(PascalishParser.ColumnAssignContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#deleteStmt}.
	 * @param ctx the parse tree
	 */
	void enterDeleteStmt(PascalishParser.DeleteStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#deleteStmt}.
	 * @param ctx the parse tree
	 */
	void exitDeleteStmt(PascalishParser.DeleteStmtContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#whereClause}.
	 * @param ctx the parse tree
	 */
	void enterWhereClause(PascalishParser.WhereClauseContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#whereClause}.
	 * @param ctx the parse tree
	 */
	void exitWhereClause(PascalishParser.WhereClauseContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#compareOp}.
	 * @param ctx the parse tree
	 */
	void enterCompareOp(PascalishParser.CompareOpContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#compareOp}.
	 * @param ctx the parse tree
	 */
	void exitCompareOp(PascalishParser.CompareOpContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#sendServiceStmt}.
	 * @param ctx the parse tree
	 */
	void enterSendServiceStmt(PascalishParser.SendServiceStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#sendServiceStmt}.
	 * @param ctx the parse tree
	 */
	void exitSendServiceStmt(PascalishParser.SendServiceStmtContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#identGroup}.
	 * @param ctx the parse tree
	 */
	void enterIdentGroup(PascalishParser.IdentGroupContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#identGroup}.
	 * @param ctx the parse tree
	 */
	void exitIdentGroup(PascalishParser.IdentGroupContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#waitErrorClause}.
	 * @param ctx the parse tree
	 */
	void enterWaitErrorClause(PascalishParser.WaitErrorClauseContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#waitErrorClause}.
	 * @param ctx the parse tree
	 */
	void exitWaitErrorClause(PascalishParser.WaitErrorClauseContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#timeUnit}.
	 * @param ctx the parse tree
	 */
	void enterTimeUnit(PascalishParser.TimeUnitContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#timeUnit}.
	 * @param ctx the parse tree
	 */
	void exitTimeUnit(PascalishParser.TimeUnitContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#subflowOption}.
	 * @param ctx the parse tree
	 */
	void enterSubflowOption(PascalishParser.SubflowOptionContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#subflowOption}.
	 * @param ctx the parse tree
	 */
	void exitSubflowOption(PascalishParser.SubflowOptionContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#returnStmt}.
	 * @param ctx the parse tree
	 */
	void enterReturnStmt(PascalishParser.ReturnStmtContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#returnStmt}.
	 * @param ctx the parse tree
	 */
	void exitReturnStmt(PascalishParser.ReturnStmtContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#lvalueSuffix}.
	 * @param ctx the parse tree
	 */
	void enterLvalueSuffix(PascalishParser.LvalueSuffixContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#lvalueSuffix}.
	 * @param ctx the parse tree
	 */
	void exitLvalueSuffix(PascalishParser.LvalueSuffixContext ctx);
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
	 * Enter a parse tree produced by {@link PascalishParser#qualifiedPart}.
	 * @param ctx the parse tree
	 */
	void enterQualifiedPart(PascalishParser.QualifiedPartContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#qualifiedPart}.
	 * @param ctx the parse tree
	 */
	void exitQualifiedPart(PascalishParser.QualifiedPartContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#stringOrIdent}.
	 * @param ctx the parse tree
	 */
	void enterStringOrIdent(PascalishParser.StringOrIdentContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#stringOrIdent}.
	 * @param ctx the parse tree
	 */
	void exitStringOrIdent(PascalishParser.StringOrIdentContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#stringValue}.
	 * @param ctx the parse tree
	 */
	void enterStringValue(PascalishParser.StringValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#stringValue}.
	 * @param ctx the parse tree
	 */
	void exitStringValue(PascalishParser.StringValueContext ctx);
	/**
	 * Enter a parse tree produced by {@link PascalishParser#booleanValue}.
	 * @param ctx the parse tree
	 */
	void enterBooleanValue(PascalishParser.BooleanValueContext ctx);
	/**
	 * Exit a parse tree produced by {@link PascalishParser#booleanValue}.
	 * @param ctx the parse tree
	 */
	void exitBooleanValue(PascalishParser.BooleanValueContext ctx);
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