# Language Reference for Code Generation

## Quick Syntax Reference

### PASCALISH - Key Patterns

#### Service Definition
```pascalish
service ServiceName on placement;
begin
  // Service body - responds to messages
  if condition then
    call OtherService(...);
  end;
.
```

#### Variable Declaration
```pascalish
var myVar : integer;
var myString : string;
var myQueue : queue<integer>;
var myRecord : record
  field1 : integer;
  field2 : string;
end;
```

#### Control Flow
```pascalish
if expr then
  statement*
else
  statement*
end;

while expr do
  statement
  
for i := 1 to 10 do
  statement

repeat
  statement*
until expr;
```

#### Queue Operations
```pascalish
enqueue myQueue with value;
dequeue myQueue into variable;
peek myQueue into variable;
```

#### Stack Operations
```pascalish
push myStack with value;
pop myStack into variable;
```

#### File Operations
```pascalish
open fileHandle for read;
read fileHandle into variable;
write fileHandle with value;
close fileHandle;
```

#### Concurrent Execution
```pascalish
cobegin
  statement1;
  statement2;
coend;

async statement;
wait all;
```

#### Expression Operators
```
Arithmetic: +, -, *, /, mod
Comparison: =, <>, <, <=, >, >=
Logical: and, or, not
```

#### Type References
```
Simple types: integer, real, boolean, string
Collection: array, queue, stack, priorityqueue
Records: record ... end
Generic: Type<ElementType>
Fixed array: array[1..100] of integer
Dynamic: array<integer> of Type
```

---

## MAPL - Key Patterns

#### Basic Map Definition
```mapl
map MapName from SourceSchema to TargetSchema;
  targetField := sourceField;
end;
```

#### Field Mapping with Default
```mapl
map MapName from SourceSchema to TargetSchema;
  targetField := sourceField default defaultValue;
end;
```

#### Function-based Mapping
```mapl
map MapName from SourceSchema to TargetSchema;
  targetField := FunctionName(sourceField);
  targetField2 := AnotherFunction(field1, field2);
end;
```

#### Conditional Mapping
```mapl
map MapName from SourceSchema to TargetSchema;
  if sourceField = "value1" then
    target1 := "result1";
  else
    target1 := "result2";
  end;
end;
```

#### Nested Conditionals
```mapl
if condition1 then
  if condition2 then
    target := value1;
  else
    target := value2;
  end;
else
  target := value3;
end;
```

#### Iteration
```mapl
for each sourceArray as item
  targetItem := item;
  targetField := item.field;
end;
```

#### Validation
```mapl
validate sourceField > 0;
validate sourceField in ("val1", "val2");
validate length(sourceField) <= 100;
```

#### Nested Field Access
```mapl
Person.Address.Street := Source.AddressInfo.StreetName;
Invoice.LineItems[0].Amount := Amount;
```

#### Complex Expression
```mapl
targetField := if Amount > 1000 then "HIGH" else "NORMAL" end;
targetField := Amount + (Amount * 0.1);
targetField := Amount > 1000 and Status = "ACTIVE";
```

#### Common Built-in Functions
```
FormatAmount(value)
ResolveCurrency(code)
ValidateAmount(amount, currency)
CalculateFee(amount)
GenerateId(value)
ParseDate(dateString)
FormatDate(date)
Upper(string)
Lower(string)
Trim(string)
Length(string)
Substring(string, start, end)
Contains(string, substring)
```

---

## PLACEMENT DIRECTIVES (Pascalish)

```pascalish
on local      // Execute on same node
on parent     // Execute on parent node
on child      // Execute on one of child nodes
on sibling    // Execute on peer/sibling node
on alternate  // Execute on failover/alternate node
```

---

## DAEMON SCHEDULING (Pascalish)

```pascalish
daemon MonitorTask refresh 5000 ms;
  // Executes every 5000 milliseconds
  
daemon HealthCheck every 30 seconds;
  // Executes every 30 seconds
```

---

## EXPRESSION EVALUATION RULES

### Operator Precedence (Pascalish & MAPL)
1. Unary: `not`, `-`
2. Multiplicative: `*`, `/`, `mod`
3. Additive: `+`, `-`
4. Relational: `<`, `<=`, `>`, `>=`
5. Equality: `=`, `<>`
6. Logical AND: `and`
7. Logical OR: `or`

### Short-circuit Evaluation
- `and`: Evaluates right side only if left is true
- `or`: Evaluates right side only if left is false

---

## COMPILATION NOTES FOR CODE GENERATION

### Pascalish Compilation
1. Parses declaration and statement rules
2. Generates p-code instructions
3. Produces program map with symbol table
4. Supports recursive functions and procedures
5. Type checking at compile time

### MAPL Compilation
1. Parses mapping declarations
2. Generates transformation instructions
3. Builds schema dependency graph
4. Validates field existence in schemas
5. Optimizes nested field access

### Symbol Resolution
- All identifiers must be declared before use
- Field paths must exist in source/target schemas
- Function names must be registered in runtime
- Type mismatches caught at compile or runtime

### Common Pitfalls
- String literals only allowed in specific contexts (writeArg, defaults, validation)
- Cannot use string comparisons directly in if-expressions without workarounds
- Logical operators (and/or) not fully supported in if-expressions
- Named variables (like 'src') must be injected by runtime before execution
- PARSE_INT returns 0 on error, TRIM removes leading/trailing whitespace
