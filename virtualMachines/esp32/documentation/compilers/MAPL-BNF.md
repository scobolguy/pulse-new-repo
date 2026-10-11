# MAPL Grammar (BNF)

## Overview
MAPL (Mapping Language) is a domain-specific language for defining data transformations and field mappings between source and target schemas. It provides a declarative approach to complex data transformations with conditional logic and validation.

## Syntax

### Compilation Unit
```
<map_unit> ::= <map_decl>* EOF
```

### Map Declaration
```
<map_decl> ::= 'map' <name_ref> 'from' <name_ref> 'to' <name_ref> ';' <map_directive>* <map_body> 'end' ';'

<name_ref> ::= <ident> | <string>

<map_directive> ::= '@' <ident> <directive_value> ';'

<directive_value> ::= <string> | <number> | 'true' | 'false'

<map_body> ::= <map_stmt>*
```

The header names are the map ID, the source type ID and the target type ID.
Names that are not plain identifiers (for example `'pay-to-transfer'`) are quoted.

#### Directives
Directives carry map metadata. They are not executable statements; the compiler
emits them as the program map entry's `metadata` object. Recognized directives:

| Directive | Meaning |
|-----------|---------|
| `@name 'text'` | Display name (defaults to the map ID) |
| `@description 'text'` | Description |
| `@enabled false` | Disable the map (enabled by default) |
| `@sourceSchema 'path'` | Librarian schema path for the source structure |
| `@targetSchema 'path'` | Librarian schema path for the target structure |

Unknown directives are kept as metadata and preserved by the designer.

### Map Statements

#### Assignment Statements
```
<map_stmt> ::= <assign_stmt>
             | <assign_default_stmt>
             | <function_assign_stmt>
             | <if_stmt>
             | <for_stmt>
             | <validate_stmt>

<assign_stmt> ::= <field_path> ':=' <field_path> ('using' <string>)? ';'

<assign_default_stmt> ::= <field_path> ':=' <field_path> 'default' <expr> ';'

<function_assign_stmt> ::= <field_path> ':=' <function_call> ';'

<function_call> ::= <ident> '(' <expr_list>? ')'
```

#### Conditional Mapping
```
<if_stmt> ::= 'if' <expr> 'then' <map_body> ('else' <map_body>)? 'end' ';'
```

#### Iteration
```
<for_stmt> ::= 'for' 'each' <field_path> 'as' <ident> <map_body> 'end' ';'
```

#### Validation
```
<validate_stmt> ::= 'validate' <expr> ';'
```

### Field References

#### Field Path
```
<field_path> ::= <ident> ('.' <path_segment>)*

<path_segment> ::= <ident> | <string>
```

This allows nested field access like `Person.Address.Street`. Segments after the
first may be quoted when a field name is not an identifier or is a keyword, for
example `target.'first name' := source.'end';`.

`using` attaches a Pascalish conversion routine to a direct assignment; inside
the routine `src` is the source value and `output` receives the result:

```
target.amount := source.amount using 'output := round(src, 2);';
```

### Expression Language

#### General Expressions
```
<expr_list> ::= <expr> (',' <expr>)*

<expr> ::= <logical_or_expr>

<logical_or_expr> ::= <logical_and_expr> ('or' <logical_and_expr>)*

<logical_and_expr> ::= <equality_expr> ('and' <equality_expr>)*

<equality_expr> ::= <relational_expr> (('=' | '<>') <relational_expr>)*

<relational_expr> ::= <additive_expr> (('<' | '<=' | '>' | '>=') <additive_expr>)*

<additive_expr> ::= <multiplicative_expr> (('+' | '-') <multiplicative_expr>)*

<multiplicative_expr> ::= <unary_expr> (('*' | '/' | 'mod') <unary_expr>)*

<unary_expr> ::= ('not' | '-') <unary_expr>
               | <primary_expr>

<primary_expr> ::= <number>
                 | <string>
                 | 'true'
                 | 'false'
                 | <function_call>
                 | <field_path>
                 | '(' <expr> ')'
```

### Terminals

```
<ident> ::= [a-zA-Z_][a-zA-Z_0-9]*

<number> ::= [0-9]+ ('.' [0-9]+)?

<string> ::= '"' (~["\\] | '\\' .)* '"'
           | '\'' (~['\\] | '\\' .)* '\''

<comment> ::= '//' ~[\r\n]*
            | '/*' .*? '*/'

<whitespace> ::= [ \t\r\n\f]+
```

## Examples

### Designer-authored Map
The VS Code Data Mapper designer edits `.mapl` files directly (one map per file).
Each visual connection is a top-level `target... := source...` assignment;
other statements are preserved as written.
```
map 'pay-to-transfer' from payment to transfer;
  @name 'Payment to transfer';
  @sourceSchema 'schemas/payment.json';
  @targetSchema 'schemas/transfer.json';
  target.transfer.id := source.reference;
  target.transfer.amount := source.amount using 'output := round(src, 2);';
end;
```

### Simple Field Mapping
```
map TransformPayment from SWIFT_MT103 to ProcessingRecord;
  TransactionId := MessageId;
  Amount := Amount;
  Currency := Currency;
end;
```

### Mapping with Default Values
```
map ParsePayment from RawData to PaymentRecord;
  Amount := Amount default 0;
  Status := Status default "PENDING";
  Priority := Priority default 1;
end;
```

### Conditional Mapping
```
map ConditionalTransform from SourceData to TargetData;
  if Amount > 10000 then
    ApprovalRequired := "YES";
    ApprovalQueue := "HighValue";
  else
    ApprovalRequired := "NO";
    ApprovalQueue := "Standard";
  end;
end;
```

### Iteration Over Arrays
```
map MapLineItems from Invoice to InvoiceDocument;
  for each Items as Item
    LineItem := Item;
    Amount := Amount + Item.Price;
  end;
end;
```

### Function-based Mapping
```
map EnrichTransaction from Transaction to EnrichedTransaction;
  Amount := FormatAmount(Amount);
  Currency := ResolveCurrency(CurrencyCode);
  ValidatedAmount := ValidateAmount(Amount, Currency);
  ProcessingFee := CalculateFee(Amount);
end;
```

### Validation
```
map ValidateAndMap from RawTransaction to ValidatedTransaction;
  validate Amount > 0;
  validate Currency in ("USD", "EUR", "GBP");
  TransactionId := Id;
  Amount := Amount;
  Currency := Currency;
end;
```

### Complex Multi-condition Mapping
```
map ComplexMapping from Source to Target;
  if Amount > 50000 then
    if RiskRating = "HIGH" then
      Flag := "ESCALATE";
      Approvers := 3;
    else
      Flag := "REVIEW";
      Approvers := 1;
    end;
  else
    Flag := "STANDARD";
    Approvers := 0;
  end;
  
  TransactionId := GenerateId(Source.Id);
  Amount := Amount;
end;
```

## Key Features

### Field Mapping
Direct field-to-field transformation with dot notation for nested structures:
```
target.field := source.field;
```

### Default Values
Provide fallback values when source field is missing or empty:
```
target.field := source.field default defaultValue;
```

### Function Application
Transform fields using built-in or custom functions:
```
target.field := FunctionName(source.field);
```

### Conditional Logic
Map different fields based on conditions:
```
if source.field = "value" then
  target.field1 := ...;
else
  target.field2 := ...;
end;
```

### Iteration
Process arrays or repeated elements:
```
for each source.items as item
  target.items := item;
end;
```

### Validation
Assert conditions that data must satisfy:
```
validate source.field > 0;
validate source.status in ("ACTIVE", "PENDING");
```

### Nested Field Access
Access deeply nested structures with dot notation:
```
Person.Address.Street := PayerInfo.DeliveryLocation.StreetName;
```

### Operator Support
- **Logical**: `and`, `or`, `not`
- **Comparison**: `=`, `<>`, `<`, `<=`, `>`, `>=`
- **Arithmetic**: `+`, `-`, `*`, `/`, `mod`
- **Unary**: `-`, `not`

### Data Types
- **Numbers**: Integer or floating-point (e.g., 123, 45.67)
- **Strings**: Quoted text with escape sequences (e.g., "hello", 'world')
- **Booleans**: `true`, `false`
- **Field References**: Dot-separated paths
- **Functions**: Name with parentheses

## Execution Model

1. Maps define transformations between two schemas
2. Statements execute top-to-bottom within the map body
3. Conditional blocks execute based on expression evaluation
4. Iterations expand for each element in an array or collection
5. Validation statements assert constraints
6. Field assignments populate target structure

## Use Cases

- **SWIFT Message Processing**: Map MT103 fields to internal formats
- **EDI Transformation**: Convert EDI messages to structured data
- **XML-to-JSON**: Transform hierarchical formats
- **Schema Migration**: Update data to new schema versions
- **Data Enrichment**: Add computed or lookup fields
- **Compliance Mapping**: Ensure data meets regulatory requirements
- **API Response Normalization**: Standardize external API responses
