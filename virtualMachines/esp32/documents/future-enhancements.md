# Future Enhancements

## String Parsing & Manipulation in pcode

### Trim Function
**Status**: Identified but not yet implemented  
**Scope**: pmachine opcodes  
**Details**:
- WHEN rules currently support `STARTSWITH(UPPER(SRC), "prefix")` but no `TRIM(SRC)` opcode
- ESP32 pmachine has `normalizeDslEscapes()` and `trimCopy()` helper functions
- Need: `OP_TRIM` opcode to remove leading/trailing whitespace from stack values
- Use case: Input validation when parsing user-provided numeric strings (e.g., factorial service `TRIM(SRC)` to handle "  5  ")

### String-to-Integer Conversion
**Status**: Identified but not yet implemented  
**Scope**: pmachine opcodes  
**Details**:
- Need: `OP_PARSE_INT` or `OP_STR_TO_INT` opcode to convert string values to integers
- Current workaround: pass numeric values directly as integers in JSON messages
- Use case: Factorial service needs to parse incoming message as numeric input for range check `[0..10]`
- Suggested implementation: Pop string from stack, parse as int, push result (with error handling for non-numeric)

### String Comparison Functions
**Status**: Partial (STARTSWITH exists)  
**Scope**: WHEN rule evaluator  
**Details**:
- `STARTSWITH(UPPER(SRC), "prefix")` works in C++ and JS pmachine
- Missing: `ENDSWITH`, `CONTAINS`, `REGEX_MATCH`, case-sensitive variants
- Would enable more flexible input routing without hardcoded prefixes

## Pascalish Compiler & Language Support

### Function Declarations
**Status**: Not yet implemented  
**Scope**: compile-standard-pascal-antlr-to-pcode.mjs  
**Details**:
- Current support: Procedures only (`procedure name(...); begin ... end;`)
- Missing: Functions with return values (`function name(...): type; begin ... name := value; end;`)
- Workaround: Use procedures with writeln() output instead of returning values
- Use case: Factorial service needs `function factorial(n: integer): integer` for elegant recursive implementation
- Impact: Forces imperative style (computed lookup tables) instead of functional style (recursive computation)
- Suggested implementation: Add function symbol table, handle `name := value` assignments as return statements, manage return value on stack

### Logical Operators & String Literal Syntax
**Status**: Not yet implemented  
**Scope**: compile-standard-pascal-antlr-to-pcode.mjs  
**Details**:
- Missing: `or` and `and` logical operators (only single condition per `if` supported)
- Current syntax: `if n < 0 then ... else if n > 10 then ...` (nested if-else chain)
- Needed syntax: `if n < 0 or n > 10 then ...` (single condition)
- String literals: Parser requires double quotes only (`"text"`) but rejects single quotes (`'text'`)
- Workaround: Chain multiple `if-else if` statements; always use double quotes for strings
- Use case: Factorial service range validation (`if n < 0 or n > 10 then`) requires nested conditions
- Impact: Code verbosity increases with complex boolean conditions
- Suggested implementation: Update ANTLR grammar to support `or`/`and` operators in expressions

## Caching & State Management

### Service-Local State Cache
**Status**: Conceptual  
**Scope**: Runtime service instances  
**Details**:
- Factorial service needs to cache computed values `{0: 1, 1: 1, 2: 2, 3: 6, ...}`
- Current pmachine state is per-invocation (not persistent across calls)
- Options:
  1. Implement `OP_CACHE_SET` / `OP_CACHE_GET` with LRU eviction
  2. Store state in named variables at service initialization
  3. Leverage Router/Mapper output queue as a side-channel state store
- Decision pending: cost/benefit of persistent runtime service state vs. message-driven state passing

## Input Handling Improvements

### Named Variable Pre-loading
**Status**: Exists but underdocumented  
**Scope**: pmachine frame setup  
**Details**:
- `message` and `inputQueue` are available via `FIELD_EQUALS` in WHEN rules
- Not clear if accessible via `LOAD` / `LOAD_NAME` in standard Pascal programs
- Should document: what named variables are pre-populated by `execute_file` endpoint
- Candidate names: `src`, `message`, `inputQueue`, `nodeId`, `timestamp`

### Message Parameter Access in Pascal Programs
**Status**: Not working (attempted but blocked by language limitations)  
**Scope**: compile-standard-pascal-antlr-to-pcode.mjs, pmachine frame initialization  
**Details**:
- Attempted: Access `src` variable directly in Pascal (e.g., `if src = "5" then n := 5`)
- Result: Parser rejects string literals in if-expressions ("mismatched input string expecting expression")
- Current workaround: Use hardcoded values in program; pass input via WHEN rules / router configuration
- Use case: Factorial service needs to read number from message and compute factorial [0..10]
- Implementation needed: Either:
  1. Extend Parser to allow string comparisons in expressions
  2. Pre-define `src` as global integer variable (not string) with parsed message value
  3. Implement `readln()` or parameter-passing mechanism for program inputs
  4. Require WHEN rules to pre-process message and route to separate program instances
- Deployed state: Factorial service works with hardcoded n=5; message parameter received but unused

## Performance Optimizations

### Ollama Mentor Pipeline
**Status**: Optimized (commit: optimize-ollama-mentor)  
**Completed**:
- Pascal program detection (skip repair pass)
- In-process coach execution (replace subprocess spawn)
- Golden cache hits (exact prompt matching)
- Fuzzy golden matching (numeric parameter substitution)

### Corpus Memoization
**Status**: Not yet implemented  
**Scope**: DSL corpus loading  
**Details**:
- Currently corpus is read/parsed fresh on every mentor invocation
- Opportunity: cache corpus in memory as a persistent server or worker process
- Could reduce latency for repeated calls in interactive scenarios

---

## Priority Sorting

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| `OP_TRIM` opcode | Enables robust input validation | Low | High |
| `OP_PARSE_INT` opcode | Enables numeric input services | Medium | High |
| Service-local cache | Enables optimized lookups | Medium-High | Medium |
| Named var pre-loading docs | Clarity/usability | Very Low | Medium |
| WHEN rule string functions | Flexible routing | Medium | Medium |
| Corpus memoization | Latency reduction | Medium | Low |
