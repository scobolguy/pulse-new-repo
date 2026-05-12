# PL/0 Interpreter with String Support

## Overview

This is a full PL/0 interpreter implementation with extended String support for data transformation rules in the mapping system. The interpreter uses a tokenizer → parser → tree-walk evaluator architecture for fast iteration and easy extension.

## Grammar

### Program Structure
```
program = { statement }
statement = assignment | ifStatement | whileStatement | forStatement | procCall | blockStatement
```

### Statements

#### Assignment
```
identifier := expression
```
Sets a variable to the result of an expression.

**Examples:**
```
output := trim(src);
x := y + 10;
name := upper(firstname) || " " || upper(lastname);
```

#### If-Then-Else
```
IF expression THEN statement [ELSE statement]
```
Conditional execution.

**Examples:**
```
IF length(src) > 0 THEN output := trim(src) ELSE output := "N/A";
IF x = 5 THEN y := 100;
```

#### While Loop
```
WHILE expression DO statement
```
Loops while condition is true.

**Examples:**
```
WHILE i < 10 DO i := i + 1;
```

#### For Loop
```
FOR identifier := expression TO expression DO statement
```
Loops from start to end (inclusive).

**Examples:**
```
FOR i := 1 TO 5 DO output := output || str[i];
```

#### Procedure Call
```
CALL identifier
```
Calls a named procedure (for future extension).

#### Block Statement
```
BEGIN { statement ; } END
```
Groups multiple statements.

**Examples:**
```
BEGIN
  x := 10;
  y := 20;
  output := x + y
END
```

### Expressions

#### Binary Operators
- **Arithmetic**: `+` (addition), `-` (subtraction), `*` (multiplication), `/` (integer division)
- **Comparison**: `=` (equal), `<` (less than), `>` (greater than), `<=`, `>=`, `<>` (not equal)
- **String**: `||` (concatenation)

#### Unary Operators
- **Arithmetic**: `-` (negation)
- **Logical**: `NOT` (logical negation, returns 1 for false, 0 for true)

#### Literals
- **Numbers**: `123`, `0`, `-45`
- **Strings**: `"hello"`, `'world'`, with escape sequences: `\"`, `\'`, `\n`, `\t`

#### Variable References
- Any identifier defined in the program

#### Function Calls
```
functionName(arg1, arg2, ...)
```

## Built-in Functions

### String Functions

#### `trim(str)`
Removes leading and trailing whitespace.
```
output := trim("  hello  ");  // "hello"
```

#### `upper(str)`
Converts string to uppercase.
```
output := upper("hello");  // "HELLO"
```

#### `lower(str)`
Converts string to lowercase.
```
output := lower("HELLO");  // "hello"
```

#### `substr(str, start, [length])`
Extracts substring (1-based indexing).
```
output := substr("hello", 2, 3);  // "ell"
output := substr("hello", 2);     // "ello"
```

#### `length(str)`
Returns string length.
```
len := length("hello");  // 5
```

#### `index(str, searchStr)`
Returns 1-based position of searchStr in str (0 if not found).
```
pos := index("hello", "ll");  // 3
```

#### `replace(str, from, to)`
Replaces all occurrences (supports regex patterns).
```
output := replace("hello", "l", "L");  // "heLLo"
```

#### `startswith(str, prefix)`
Returns 1 if str starts with prefix, 0 otherwise.
```
if startswith(src, "ABC") then output := "starts" else output := "no" end
```

#### `endswith(str, suffix)`
Returns 1 if str ends with suffix, 0 otherwise.

#### `reverse(str)`
Reverses string.
```
output := reverse("hello");  // "olleh"
```

#### `padleft(str, width, [padChar])`
Pads string on left to width (default pad character is space).
```
output := padleft("5", 3, "0");  // "005"
```

#### `padright(str, width, [padChar])`
Pads string on right to width.
```
output := padright("5", 3, "0");  // "500"
```

### Numeric Functions

#### `abs(n)`
Absolute value.
```
x := abs(-5);  // 5
```

#### `min(n1, n2, ...)`
Minimum of arguments.
```
x := min(3, 1, 4);  // 1
```

#### `max(n1, n2, ...)`
Maximum of arguments.
```
x := max(3, 1, 4);  // 4
```

#### `round(n)`
Rounds to nearest integer.

#### `floor(n)`
Rounds down.

#### `ceil(n)`
Rounds up.

### MT/SWIFT-specific Functions

#### `yymmddtoiso(dateStr)`
Converts MT date format (YYMMDD) to ISO format (YYYY-MM-DD).
```
output := yymmddtoiso("250512");  // "2025-05-12"
```

#### `mtamounttodecimal(amountStr)`
Converts MT amount format (comma as decimal) to decimal format (dot).
```
output := mtamounttodecimal("12345,67");  // "12345.67"
```

#### `mtpartyname(partyStr)`
Extracts party name from MT party field (removes account lines starting with `/`).
```
output := mtpartyname("/DE123456789\nJOHN DOE");  // "JOHN DOE"
```

#### `mtchargebearertoiso(codeStr)`
Converts MT charge bearer codes to ISO codes.
- `OUR` → `DEBT`
- `BEN` → `CRED`
- `SHA` → `SHA` (passed through)

```
output := mtchargebearertoiso("OUR");  // "DEBT"
```

## Examples

### Simple Trimming
```
output := trim(src);
```

### Conditional Logic
```
IF length(trim(src)) > 0 THEN
  output := upper(trim(src))
ELSE
  output := "EMPTY"
END
```

### String Concatenation
```
output := "Date: " || yymmddtoiso(dateField) || " Amount: " || mtamounttodecimal(amountField);
```

### Complex Transformation
```
BEGIN
  VAR name;
  VAR amount;
  name := trim(mtpartyname(srcParty));
  amount := mtamounttodecimal(srcAmount);
  IF length(name) > 50 THEN
    output := substr(name, 1, 50)
  ELSE
    output := name
  END
END
```

### Loop Example
```
BEGIN
  VAR result;
  result := "";
  FOR i := 1 TO length(src) DO
    BEGIN
      IF i > 1 THEN result := result || ",";
      result := result || substr(src, i, 1)
    END;
  output := result
END
```

## Type System

- **Numbers**: Integers and floating-point
- **Strings**: Unicode strings with escape sequences
- **Type Coercion**: 
  - String to number: parsed as decimal; non-numeric strings become 0
  - Number to string: converted to decimal representation
  - Comparisons: numeric when both operands are numbers, otherwise string

## Usage in Mapping Rules

Conversion rules are stored in `data-mappings.json` as the `conversionRule` field:

```json
{
  "sourcePath": "finEnvelope.block4.fields.20",
  "targetPath": "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId",
  "conversionRule": "output := trim(src);"
}
```

The interpreter receives:
- **Input variables**: `src` (the source field value) and any other variables
- **Output variable**: The `output` variable is returned as the result

The execution result is accessed via `result.output`.

## API

### `runPL0(sourceCode, inputVariables = {})`

Executes PL/0 program and returns variables.

**Parameters:**
- `sourceCode` (string): PL/0 program text
- `inputVariables` (object): Initial variable bindings, e.g., `{ src: "value" }`

**Returns:**
- Object with all defined variables, including `output`

**Example:**
```javascript
import { runPL0 } from './pl0-interpreter.mjs';

const result = runPL0('output := upper(src);', { src: 'hello' });
console.log(result.output);  // "HELLO"
```

## Implementation Details

### Tokenizer
- Converts source code into tokens
- Handles keywords, identifiers, numbers, strings, operators
- Supports line comments (`//`)

### Parser
- Recursive descent parser
- Builds abstract syntax tree (AST)
- Validates syntax at parse time

### Interpreter
- Tree-walk evaluator
- Maintains variable state during execution
- Built-in function library

## Error Handling

Errors are thrown with descriptive messages:

```javascript
try {
  runPL0('invalid (( code', { src: 'test' });
} catch (e) {
  console.error(e.message);  // "PL/0 Runtime Error: ..."
}
```

## Performance

- Tree-walk interpreter: suitable for small transformation rules
- No JIT compilation; each rule interpreted fresh
- Good for data transformation (<1s typical for complex rules)

## Future Extensions

Possible enhancements:
- User-defined functions (procedures)
- Arrays and objects
- Regular expression support
- Bytecode compilation for better performance
- Debugging support (breakpoints, variable inspection)

## References

- Classic PL/0: https://en.wikipedia.org/wiki/PL/0
- ISO Pascal similarities
- Extended with modern string operations
