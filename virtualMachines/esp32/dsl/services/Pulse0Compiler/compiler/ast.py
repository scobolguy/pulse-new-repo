# AST node definitions for Pulse0

class ASTNode:
    pass

class Program(ASTNode):
    def __init__(self, name, declarations, statements):
        self.name = name
        self.declarations = declarations
        self.statements = statements

# Add more AST node classes as needed for variables, procedures, statements, expressions, etc.
