# Pascalish Grammar (BNF)

## Overview
Pascalish is a Pascal-based language with extensions for services, daemons, placement directives, queues, and concurrent execution. It compiles to p-code for execution on pmachine virtual machines.

## Syntax

### Compilation Unit
```
<compilation_unit> ::= <decl>* EOF

<decl> ::= <program_decl>
         | <service_decl>
         | <daemon_decl>
         | <type_decl>
         | <class_decl>
         | <var_decl>
         | <queue_decl>
         | <file_decl>
```

### Declarations

#### Program Declaration
```
<program_decl> ::= 'program' <ident> <placement>? ';' <block> '.'
```

#### Service Declaration
```
<service_decl> ::= 'service' <ident> <placement>? ';'? <block> '.'
```

#### Daemon Declaration
```
<daemon_decl> ::= 'daemon' <ident> <placement>? <daemon_schedule> ';'? <block> '.'
<daemon_schedule> ::= 'refresh' <expr> 'ms'
                    | 'every' <expr> ('ms' | 'second' | 'seconds')
```

#### Placement Directive
```
<placement> ::= 'on' ('local' | 'parent' | 'child' | 'sibling' | 'alternate')
```

#### Type Declaration
```
<type_decl> ::= 'type' <ident> <generic_type_params>? '=' <type_ref> ';'
```

#### Class Declaration
```
<class_decl> ::= 'class' <ident> <generic_type_params>? <class_inheritance>? ';' <class_member>* 'end' ';'
<class_inheritance> ::= 'extends' <type_ref>
<class_member> ::= <class_field_decl> | <class_method_decl>
<class_field_decl> ::= <ident> ':' <type_ref> ';'
<class_method_decl> ::= ('procedure' | 'function') <ident> <generic_type_params>? '(' <method_param_list>? ')' (':' <type_ref>)? ';' <block> ';'
<method_param_list> ::= <method_param_decl> (';' <method_param_decl>)*
<method_param_decl> ::= <ident_list> ':' <type_ref>
```

#### Variable Declaration
```
<var_decl> ::= 'var' <ident> ':' <type_ref> <placement>? ';'
```

#### Queue Declaration
```
<queue_decl> ::= 'queue' <ident> <queue_type> <placement>? ';'
<queue_type> ::= 'queue' '[' <expr> '..' <expr> ']' 'of' <type_ref>
               | 'queue' '<' <type_ref> '>'
```

#### File Declaration
```
<file_decl> ::= 'file' <ident> 'of' <type_ref> <placement>? ';'
```

### Types

#### Type References
```
<type_ref> ::= <simple_type>
             | <record_type>
             | <queue_type>
             | <stack_type>
             | <priority_queue_type>
             | <fixed_array_type>
             | <dynamic_array_type>
             | <user_type>

<simple_type> ::= 'integer' | 'real' | 'boolean' | 'string'

<record_type> ::= 'record' <record_field>* 'end'
<record_field> ::= <ident> ':' <type_ref> ';'

<stack_type> ::= 'stack' '[' <expr> '..' <expr> ']' 'of' <type_ref>
               | 'stack' '<' <type_ref> '>'

<priority_queue_type> ::= 'priorityqueue' '[' <expr> '..' <expr> ']' 'of' <type_ref>
                        | 'priorityqueue' '<' <type_ref> '>'

<fixed_array_type> ::= 'array' '[' <expr> '..' <expr> ']' 'of' <type_ref>

<dynamic_array_type> ::= 'array' '<' <type_ref> '>' 'of' <type_ref>

<user_type> ::= <ident> <generic_type_args>?

<generic_type_params> ::= '<' <ident> (',' <ident>)* '>'
<generic_type_args> ::= '<' <type_ref> (',' <type_ref>)* '>'

<ident_list> ::= <ident> (',' <ident>)*
```

### Blocks and Statements

#### Block
```
<block> ::= 'begin' <statement>* 'end'
```

#### Statements
```
<statement> ::= <assign_stmt>
              | <call_stmt>
              | <if_stmt>
              | <while_stmt>
              | <for_stmt>
              | <repeat_stmt>
              | <block>
              | <enqueue_stmt>
              | <dequeue_stmt>
              | <peek_stmt>
              | <push_stmt>
              | <pop_stmt>
              | <concurrent_stmt>
              | <file_stmt>

<assign_stmt> ::= <lvalue> ':=' <expr> ';'

<call_stmt> ::= 'call' <qualified_name> '(' <expr_list>? ')' ';'

<if_stmt> ::= 'if' <expr> 'then' <statement>* ('else' <statement>*)? 'end' ';'

<while_stmt> ::= 'while' <expr> 'do' <statement>

<for_stmt> ::= 'for' <ident> ':=' <expr> 'to' <expr> 'do' <statement>

<repeat_stmt> ::= 'repeat' <statement>* 'until' <expr> ';'

<enqueue_stmt> ::= 'enqueue' <ident> 'with' <expr> ';'

<dequeue_stmt> ::= 'dequeue' <ident> 'into' <ident> ';'

<peek_stmt> ::= 'peek' <ident> 'into' <ident> ';'

<push_stmt> ::= 'push' <ident> 'with' <expr> ';'

<pop_stmt> ::= 'pop' <ident> 'into' <ident> ';'

<file_stmt> ::= 'open' <ident> 'for' ('read' | 'write') ';'
              | 'read' <ident> 'into' <ident> ';'
              | 'write' <ident> 'with' <expr> ';'
              | 'close' <ident> ';'

<concurrent_stmt> ::= <cobegin_stmt>
                    | <async_stmt>
                    | <wait_stmt>
                    | <sync_stmt>
                    | <subflow_stmt>

<cobegin_stmt> ::= 'cobegin' <statement>* 'coend' ';'

<async_stmt> ::= 'async' <statement>

<wait_stmt> ::= 'wait' 'all' ';'
              | 'wait' <ident> ';'

<sync_stmt> ::= 'sync' <ident> ';'

<subflow_stmt> ::= 'subflow' <string> ('with' <expr_list>)? ';'
```

### Expressions

#### General Expression Rules
```
<lvalue> ::= <ident> ('.' <ident>)*

<qualified_name> ::= <ident> ('.' <ident>)*

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
                 | <qualified_name> '(' <expr_list>? ')'
                 | <lvalue>
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

## Key Language Features

### Services
Services are long-running components that respond to messages:
```
service ProcessPayment on child;
  if amount > 1000 then
    call ApprovalQueue(txId);
  else
    call ProcessingQueue(txId);
  end;
.
```

### Daemons
Daemons execute periodically:
```
daemon HealthCheck refresh 5000 ms;
begin
  call MonitorQueues();
end.
```

### Placement
Control where code executes:
- `local`: Current node
- `parent`: Parent in hierarchy
- `child`: One of children
- `sibling`: Peer node
- `alternate`: Failover node

### Concurrent Execution
- `cobegin...coend`: Parallel blocks
- `async`: Background execution
- `wait all`: Wait for completion
- `sync`: Synchronize threads

### Data Structures
- **Queues**: FIFO containers with dynamic bounds
- **Stacks**: LIFO containers
- **Priority Queues**: Priority-ordered queues
- **Arrays**: Fixed or dynamic
- **Records**: Structured types

### Type System
- **Built-in**: integer, real, boolean, string
- **Generic Types**: `<T>` syntax
- **User-defined**: Custom types and classes
