// Shared PMachine conformance cases. Each case is executed by every runtime target
// (JS and ESP32) so results can be asserted individually or diffed against each other.
//
// Case shape:
//   id          unique kebab-case identifier
//   family      grouping label used for filtering and gap reporting
//   pcode       lines of pcode text
//   programMap  program map object (signed automatically by the ESP32 target)
//   inputQueue  routing input queue name
//   message     source message text
//   expect      optional (result) => void assertions run against the normalised result
//   diffIgnore  optional list of normalised field paths excluded from cross-runtime diff

function line(...parts) {
  return parts.join('\n');
}

export const CASES = [
  {
    id: 'arith-int',
    family: 'arithmetic',
    pcode: line(
      'START:',
      'PUSH_INT 7',
      'PUSH_INT 5',
      'ADD',
      'STORE sum',
      'PUSH_INT 7',
      'PUSH_INT 5',
      'SUB',
      'STORE diff',
      'PUSH_INT 7',
      'PUSH_INT 5',
      'MUL',
      'STORE prod',
      'PUSH_INT 7',
      'PUSH_INT 5',
      'DIV',
      'STORE quot',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'ArithInt' },
      globals: ['sum', 'diff', 'prod', 'quot'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.arith',
    message: '',
    expect(result) {
      return [
        ['sum', result.globals.sum, 12],
        ['diff', result.globals.diff, 2],
        ['prod', result.globals.prod, 35],
        ['quot', result.globals.quot, 1]
      ];
    }
  },
  {
    id: 'arith-div-by-zero',
    family: 'arithmetic',
    pcode: line(
      'START:',
      'PUSH_INT 9',
      'PUSH_INT 0',
      'DIV',
      'STORE zeroDiv',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'ArithDivZero' },
      globals: ['zeroDiv'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.arith',
    message: '',
    expect(result) {
      return [['zeroDiv', result.globals.zeroDiv, 0]];
    }
  },
  {
    id: 'compare-int',
    family: 'comparison',
    pcode: line(
      'START:',
      'PUSH_INT 3',
      'PUSH_INT 3',
      'EQ',
      'STORE eq',
      'PUSH_INT 3',
      'PUSH_INT 4',
      'NEQ',
      'STORE neq',
      'PUSH_INT 3',
      'PUSH_INT 4',
      'LT',
      'STORE lt',
      'PUSH_INT 4',
      'PUSH_INT 3',
      'GT',
      'STORE gt',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CompareInt' },
      globals: ['eq', 'neq', 'lt', 'gt'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.compare',
    message: '',
    expect(result) {
      return [
        ['eq', result.globals.eq, 1],
        ['neq', result.globals.neq, 1],
        ['lt', result.globals.lt, 1],
        ['gt', result.globals.gt, 1]
      ];
    }
  },
  {
    id: 'compare-string',
    family: 'comparison',
    pcode: line(
      'START:',
      'PUSH_STR "hello"',
      'PUSH_STR "hello"',
      'STREQ',
      'STORE same',
      'PUSH_STR "hello"',
      'PUSH_STR "world"',
      'STRNEQ',
      'STORE different',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CompareString' },
      globals: ['same', 'different'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.compare',
    message: '',
    expect(result) {
      return [
        ['same', result.globals.same, 1],
        ['different', result.globals.different, 1]
      ];
    }
  },
  {
    id: 'string-trim-parse-int',
    family: 'strings',
    pcode: line(
      'START:',
      'PUSH_STR "  hello world  "',
      'TRIM',
      'STORE trimmedResult',
      'PUSH_STR "  12345  "',
      'TRIM',
      'PARSE_INT',
      'STORE parsedInt',
      'PUSH_STR "hello"',
      'PARSE_INT',
      'STORE parseError',
      'PUSH_STR " -999 "',
      'TRIM',
      'PARSE_INT',
      'STORE negativeInt',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'TrimParseInt' },
      globals: ['trimmedResult', 'parsedInt', 'parseError', 'negativeInt'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.strings',
    message: '',
    expect(result) {
      return [
        ['trimmedResult', result.globals.trimmedResult, 'hello world'],
        ['parsedInt', result.globals.parsedInt, 12345],
        ['parseError', result.globals.parseError, 0],
        ['negativeInt', result.globals.negativeInt, -999]
      ];
    }
  },
  {
    id: 'src-variable',
    family: 'strings',
    pcode: line(
      'START:',
      'LOAD_NAME src',
      'PRINT',
      'PRINT_NL',
      'LOAD_NAME src',
      'TRIM',
      'PARSE_INT',
      'STORE parsedSrc',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'SrcVariable' },
      globals: ['parsedSrc'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.strings',
    message: '  123  ',
    expect(result) {
      return [
        ['stdout[0]', result.stdout[0], '  123  '],
        ['parsedSrc', result.globals.parsedSrc, 123]
      ];
    }
  },
  {
    id: 'print-output',
    family: 'output',
    pcode: line(
      'START:',
      'PUSH_STR "line one"',
      'PRINT',
      'PRINT_NL',
      'PUSH_INT 42',
      'PRINT_INT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'PrintOutput' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.output',
    message: '',
    expect(result) {
      return [
        ['stdout.length', result.stdout.length, 2],
        ['stdout[0]', result.stdout[0], 'line one'],
        ['stdout[1]', result.stdout[1], '42']
      ];
    }
  },
  {
    id: 'control-flow-jump',
    family: 'control-flow',
    pcode: line(
      'START:',
      'PUSH_INT 0',
      'JZ TAKEN',
      'PUSH_INT 100',
      'STORE branch',
      'JMP DONE',
      'TAKEN:',
      'PUSH_INT 200',
      'STORE branch',
      'DONE:',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'ControlFlowJump' },
      globals: ['branch'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.control',
    message: '',
    expect(result) {
      return [['branch', result.globals.branch, 200]];
    }
  },
  {
    id: 'collections-happy-path',
    family: 'collections',
    pcode: line(
      'START:',
      'BQ_NEW_DYNAMIC q',
      'BQ_ENQ q, 42',
      'BQ_PEEK q, peekQ',
      'BQ_DEQ q, deqQ',
      'STK_NEW_DYNAMIC s',
      'STK_PUSH s, 7',
      'STK_PEEK s, peekS',
      'STK_POP s, popS',
      'PQ_NEW_DYNAMIC p',
      'PQ_ENQ p, 3',
      'PQ_ENQ p, 10',
      'PQ_PEEK p, peekP',
      'PQ_DEQ p, deqP',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CollectionsHappy' },
      globals: ['peekQ', 'deqQ', 'peekS', 'popS', 'peekP', 'deqP'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.collections',
    message: '',
    expect(result) {
      return [
        ['peekQ', result.globals.peekQ, 42],
        ['deqQ', result.globals.deqQ, 42],
        ['peekS', result.globals.peekS, 7],
        ['popS', result.globals.popS, 7],
        ['peekP', result.globals.peekP, 10],
        ['deqP', result.globals.deqP, 10]
      ];
    }
  },
  {
    id: 'collections-underflow',
    family: 'collections',
    pcode: line(
      'START:',
      'BQ_NEW_DYNAMIC qneg',
      'BQ_DEQ qneg, qOut',
      'STK_NEW_DYNAMIC sneg',
      'STK_POP sneg, sOut',
      'PQ_NEW_DYNAMIC pneg',
      'PQ_DEQ pneg, pOut',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CollectionsUnderflow' },
      globals: ['qOut', 'sOut', 'pOut'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.collections',
    message: '',
    expect(result) {
      return [
        ['__queue_underflow', result.state.__queue_underflow, 'queue:qneg'],
        ['__stack_underflow', result.state.__stack_underflow, 'stack:sneg'],
        ['__pqueue_underflow', result.state.__pqueue_underflow, 'pqueue:pneg'],
        ['qOut', result.globals.qOut, 0],
        ['sOut', result.globals.sOut, 0],
        ['pOut', result.globals.pOut, 0]
      ];
    }
  },
  {
    id: 'file-round-trip',
    family: 'file-io',
    pcode: line(
      'START:',
      'FILE_OPEN "sample.dat", "write"',
      'STORE fh',
      'FILE_WRITE fh, "row1"',
      'FILE_READ fh, fileVal',
      'FILE_CLOSE fh',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'FileRoundTrip' },
      globals: ['fh', 'fileVal'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.file',
    message: '',
    expect(result) {
      return [['fileVal', result.globals.fileVal, 'row1']];
    }
  },
  {
    id: 'file-invalid-handle',
    family: 'file-io',
    pcode: line(
      'START:',
      'FILE_READ 999, badRead',
      'FILE_CLOSE 999',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'FileInvalidHandle' },
      globals: ['badRead'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.file',
    message: '',
    expect(result) {
      return [['badRead', result.globals.badRead, '']];
    }
  },
  {
    id: 'mapper-op-map',
    family: 'mapping',
    pcode: line(
      'START:',
      'OP_MAP SRC, "map-1", mappedPayload',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'MapperOpMap' },
      globals: ['mappedPayload'],
      entries: [
        {
          kind: 'mapper',
          id: 'map-1',
          items: [
            {
              sourcePath: 'input.value',
              targetPath: 'out.value',
              conversionRule: 'OUTPUT := SRC;'
            }
          ]
        }
      ],
      procedures: {}
    },
    inputQueue: 'conformance.mapping',
    message: '{"input":{"value":"abc"}}',
    expect(result) {
      let mapped = {};
      try {
        mapped = JSON.parse(String(result.globals.mappedPayload || '{}'));
      } catch {
        mapped = {};
      }
      return [['mapped.out.value', mapped.out?.value, 'abc']];
    }
  },
  {
    id: 'routing-emit',
    family: 'routing',
    pcode: line(
      'START:',
      'PUSH_STR "payload-one"',
      'ROUTE_SET_MESSAGE',
      'ROUTE_EMIT "conformance.out"',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RoutingEmit' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.routing',
    message: 'ignored',
    expect(result) {
      return [
        ['publishedCount', result.publishedCount, 1],
        ['deliveries[0].queueName', result.deliveries[0]?.queueName, 'conformance.out'],
        ['deliveries[0].message', result.deliveries[0]?.message, 'payload-one']
      ];
    }
  },
  {
    id: 'routing-match-queue',
    family: 'routing',
    pcode: line(
      'START:',
      'ROUTE_MATCH_QUEUE "conformance.routing"',
      'STORE matched',
      'ROUTE_MATCH_QUEUE "other.queue"',
      'STORE notMatched',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RoutingMatchQueue' },
      globals: ['matched', 'notMatched'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.routing',
    message: '',
    expect(result) {
      return [
        ['matched', result.globals.matched, 1],
        ['notMatched', result.globals.notMatched, 0]
      ];
    }
  },
  {
    id: 'operand-escaped-quotes',
    family: 'parsing',
    pcode: line(
      'START:',
      'PUSH_STR "say \\"hi\\" now"',
      'STORE quoted',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'OperandEscapedQuotes' },
      globals: ['quoted'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.parsing',
    message: '',
    expect(result) {
      return [['quoted', result.globals.quoted, 'say "hi" now']];
    }
  },
  {
    id: 'empty-string-variable',
    family: 'strings',
    pcode: line(
      'START:',
      'PUSH_STR ""',
      'STORE blank',
      'LOAD_NAME blank',
      'PRINT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'EmptyStringVariable' },
      globals: ['blank'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.strings',
    message: '',
    expect(result) {
      return [
        ['blank', result.globals.blank, ''],
        ['stdout.length', result.stdout.length, 1],
        ['stdout[0]', result.stdout[0], '']
      ];
    }
  },
  {
    id: 'call-ret-with-args',
    family: 'procedures',
    pcode: line(
      'START:',
      'PUSH_INT 6',
      'PUSH_INT 7',
      'CALL PROC_MULTIPLY 2',
      'STORE product',
      'HALT',
      'PROC_MULTIPLY:',
      'LOAD_NAME a',
      'LOAD_NAME b',
      'MUL',
      'RET'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CallRetWithArgs' },
      globals: ['product'],
      entries: [],
      procedures: { PROC_MULTIPLY: { params: ['a', 'b'], locals: [] } }
    },
    inputQueue: 'conformance.procedures',
    message: '',
    expect(result) {
      return [['product', result.globals.product, 42]];
    }
  },
  {
    id: 'call-ret-recursive',
    family: 'procedures',
    pcode: line(
      'START:',
      'PUSH_INT 5',
      'CALL PROC_FACT 1',
      'STORE fact5',
      'HALT',
      'PROC_FACT:',
      'LOAD_NAME n',
      'PUSH_INT 2',
      'LT',
      'JZ RECURSE',
      'PUSH_INT 1',
      'RET',
      'RECURSE:',
      'LOAD_NAME n',
      'LOAD_NAME n',
      'PUSH_INT 1',
      'SUB',
      'CALL PROC_FACT 1',
      'MUL',
      'RET'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CallRetRecursive' },
      globals: ['fact5'],
      entries: [],
      procedures: { PROC_FACT: { params: ['n'], locals: [] } }
    },
    inputQueue: 'conformance.procedures',
    message: '',
    expect(result) {
      return [['fact5', result.globals.fact5, 120]];
    }
  },
  {
    id: 'concurrency-fork-join',
    family: 'concurrency',
    pcode: line(
      'START:',
      'FORK worker',
      'STORE tid',
      'JOIN tid',
      'STORE joinOne',
      'SYNC tid',
      'STORE syncOne',
      'FORK_SUBFLOW "subflow-a", "arg0"',
      'STORE sfid',
      'JOIN sfid',
      'STORE joinSub',
      'JOIN_ALL',
      'STORE joinAll',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'ConcurrencyForkJoin' },
      globals: ['tid', 'joinOne', 'syncOne', 'sfid', 'joinSub', 'joinAll'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.concurrency',
    message: '',
    expect(result) {
      return [
        ['joinOne', result.globals.joinOne, 1],
        ['syncOne', result.globals.syncOne, 1],
        ['joinSub', result.globals.joinSub, 1],
        ['joinAll', result.globals.joinAll, 1]
      ];
    }
  },
  {
    id: 'parse-fin-text',
    family: 'swift',
    pcode: line(
      'START:',
      'PARSE_FIN_TEXT',
      'ROUTE_EMIT "conformance.fin.out"',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'ParseFinText' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.swift',
    message: ':20:REF-123\n:32A:260705USD12500,\n:59:BENEFICIARY LTD',
    expect(result) {
      let parsed = {};
      try {
        parsed = JSON.parse(String(result.deliveries[0]?.message || '{}'));
      } catch {
        parsed = {};
      }
      const block4 = parsed?.block4 || parsed?.finEnvelope?.block4?.fields || parsed;
      return [
        ['publishedCount', result.publishedCount, 1],
        ['field 20', block4?.['20'], 'REF-123'],
        ['field 32A currency', block4?.['32A']?.currency, 'USD']
      ];
    }
  },
  {
    id: 'logical-operators',
    family: 'comparison',
    pcode: line(
      'START:',
      'PUSH_INT 1',
      'PUSH_INT 0',
      'OR',
      'STORE orResult',
      'PUSH_INT 1',
      'PUSH_INT 0',
      'AND',
      'STORE andResult',
      'PUSH_INT 0',
      'NOT',
      'STORE notResult',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'LogicalOperators' },
      globals: ['orResult', 'andResult', 'notResult'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.compare',
    message: '',
    expect(result) {
      return [
        ['orResult', result.globals.orResult, 1],
        ['andResult', result.globals.andResult, 0],
        ['notResult', result.globals.notResult, 1]
      ];
    }
  },
  {
    id: 'mixed-stack-store-order',
    family: 'typing',
    pcode: line(
      'START:',
      'PUSH_INT 11',
      'PUSH_STR "text"',
      'STORE first',
      'STORE second',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'MixedStackStoreOrder' },
      globals: ['first', 'second'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.typing',
    message: '',
    expect(result) {
      return [
        ['first', result.globals.first, 'text'],
        ['second', result.globals.second, 11]
      ];
    }
  },
  {
    id: 'mixed-stack-print-order',
    family: 'typing',
    pcode: line(
      'START:',
      'PUSH_INT 11',
      'PUSH_STR "text"',
      'PRINT',
      'PRINT_NL',
      'PRINT_INT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'MixedStackPrintOrder' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.typing',
    message: '',
    expect(result) {
      return [
        ['stdout.length', result.stdout.length, 2],
        ['stdout[0]', result.stdout[0], 'text'],
        ['stdout[1]', result.stdout[1], '11']
      ];
    }
  },
  {
    id: 'call-ret-deep-recursion',
    family: 'procedures',
    pcode: line(
      'START:',
      'PUSH_INT 14',
      'CALL PROC_FIB 1',
      'STORE fib14',
      'HALT',
      'PROC_FIB:',
      'LOAD_NAME n',
      'PUSH_INT 2',
      'LT',
      'JZ FIB_RECURSE',
      'LOAD_NAME n',
      'RET',
      'FIB_RECURSE:',
      'LOAD_NAME n',
      'PUSH_INT 1',
      'SUB',
      'CALL PROC_FIB 1',
      'LOAD_NAME n',
      'PUSH_INT 2',
      'SUB',
      'CALL PROC_FIB 1',
      'ADD',
      'RET'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'CallRetDeepRecursion' },
      globals: ['fib14'],
      entries: [],
      procedures: { PROC_FIB: { params: ['n'], locals: [] } }
    },
    inputQueue: 'conformance.procedures',
    message: '',
    expect(result) {
      return [['fib14', result.globals.fib14, 377]];
    }
  },
  {
    id: 'stack-depth-headroom',
    family: 'procedures',
    // Kept at 50 operands: the device ceiling here is heap (PInstruction holds three
    // std::strings), not stack depth, and ~200 instructions exhausts free heap.
    pcode: line(
      'START:',
      ...Array.from({ length: 50 }, () => 'PUSH_INT 3'),
      ...Array.from({ length: 49 }, () => 'ADD'),
      'STORE deepSum',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'StackDepthHeadroom' },
      globals: ['deepSum'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.procedures',
    message: '',
    expect(result) {
      return [['deepSum', result.globals.deepSum, 150]];
    }
  },
  {
    id: 'real-literal-and-print',
    family: 'reals',
    pcode: line(
      'START:',
      'PUSH_REAL 2.5',
      'STORE r',
      'PUSH_REAL 1.0',
      'PRINT',
      'PRINT_NL',
      'PUSH_REAL -0.125',
      'PRINT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RealLiteralAndPrint' },
      globals: ['r'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.reals',
    message: '',
    expect(result) {
      return [
        ['r', result.globals.r, 2.5],
        ['stdout[0]', result.stdout[0], '1.000000E+00'],
        ['stdout[1]', result.stdout[1], '-1.250000E-01']
      ];
    }
  },
  {
    id: 'real-arithmetic-promotion',
    family: 'reals',
    pcode: line(
      'START:',
      'PUSH_REAL 2.5',
      'PUSH_INT 2',
      'MUL',
      'STORE promoted',
      'PUSH_INT 7',
      'PUSH_REAL 0.5',
      'ADD',
      'STORE mixedSum',
      'PUSH_REAL 1.5',
      'PUSH_REAL 0.25',
      'SUB',
      'STORE realDiff',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RealArithmeticPromotion' },
      globals: ['promoted', 'mixedSum', 'realDiff'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.reals',
    message: '',
    expect(result) {
      return [
        ['promoted', result.globals.promoted, 5],
        ['mixedSum', result.globals.mixedSum, 7.5],
        ['realDiff', result.globals.realDiff, 1.25]
      ];
    }
  },
  {
    id: 'real-division',
    family: 'reals',
    pcode: line(
      'START:',
      'PUSH_INT 7',
      'PUSH_INT 2',
      'RDIV',
      'STORE realQuotient',
      'PUSH_INT 7',
      'PUSH_INT 2',
      'DIV',
      'STORE intQuotient',
      'PUSH_INT 1',
      'PUSH_INT 0',
      'RDIV',
      'STORE zeroQuotient',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RealDivision' },
      globals: ['realQuotient', 'intQuotient', 'zeroQuotient'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.reals',
    message: '',
    expect(result) {
      return [
        ['realQuotient', result.globals.realQuotient, 3.5],
        ['intQuotient', result.globals.intQuotient, 3],
        ['zeroQuotient', result.globals.zeroQuotient, 0]
      ];
    }
  },
  {
    id: 'real-precision-boundary',
    family: 'reals',
    pcode: line(
      'START:',
      'PUSH_INT 1',
      'PUSH_INT 3',
      'RDIV',
      'PRINT',
      'PRINT_NL',
      'PUSH_INT 1',
      'PUSH_INT 3',
      'RDIV',
      'STORE third',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RealPrecisionBoundary' },
      globals: ['third'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.reals',
    message: '',
    expect(result) {
      return [['stdout[0]', result.stdout[0], '3.333333E-01']];
    }
  },
  {
    id: 'real-comparison',
    family: 'reals',
    pcode: line(
      'START:',
      'PUSH_REAL 2.5',
      'PUSH_INT 2',
      'GT',
      'STORE realGtInt',
      'PUSH_REAL 2.0',
      'PUSH_INT 2',
      'EQ',
      'STORE realEqInt',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RealComparison' },
      globals: ['realGtInt', 'realEqInt'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.reals',
    message: '',
    expect(result) {
      return [
        ['realGtInt', result.globals.realGtInt, 1],
        ['realEqInt', result.globals.realEqInt, 1]
      ];
    }
  },
  {
    id: 'enum-literal-and-print',
    family: 'enums',
    pcode: line(
      'START:',
      'PUSH_ENUM Colour green',
      'STORE chosen',
      'PUSH_ENUM Colour red',
      'PRINT_ENUM',
      'PRINT_NL',
      'PUSH_ENUM Colour blue',
      'PRINT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'EnumLiteralAndPrint' },
      globals: ['chosen'],
      enums: { Colour: ['red', 'green', 'blue'] },
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.enums',
    message: '',
    expect(result) {
      return [
        ['chosen', result.globals.chosen, 'green'],
        ['stdout[0]', result.stdout[0], 'red'],
        ['stdout[1]', result.stdout[1], 'blue']
      ];
    }
  },
  {
    id: 'enum-ordinal-and-compare',
    family: 'enums',
    pcode: line(
      'START:',
      'PUSH_ENUM Colour blue',
      'ORD',
      'STORE blueOrd',
      'PUSH_ENUM Colour green',
      'PUSH_ENUM Colour red',
      'GT',
      'STORE greenAfterRed',
      'PUSH_ENUM Colour red',
      'PUSH_ENUM Colour red',
      'EQ',
      'STORE sameColour',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'EnumOrdinalAndCompare' },
      globals: ['blueOrd', 'greenAfterRed', 'sameColour'],
      enums: { Colour: ['red', 'green', 'blue'] },
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.enums',
    message: '',
    expect(result) {
      return [
        ['blueOrd', result.globals.blueOrd, 2],
        ['greenAfterRed', result.globals.greenAfterRed, 1],
        ['sameColour', result.globals.sameColour, 1]
      ];
    }
  },
  {
    id: 'enum-unknown-value',
    family: 'enums',
    pcode: line(
      'START:',
      'PUSH_ENUM Colour purple',
      'STORE missing',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'EnumUnknownValue' },
      globals: ['missing'],
      enums: { Colour: ['red', 'green', 'blue'] },
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.enums',
    message: '',
    expect(result) {
      return [
        ['missing', result.globals.missing, -1],
        ['__enum_error', result.state.__enum_error, 'Unknown enum value: Colour.purple']
      ];
    }
  },
  {
    id: 'record-mixed-fields',
    family: 'records',
    pcode: line(
      'START:',
      'REC_NEW acct',
      'PUSH_INT 42',
      'REC_SET acct, "id"',
      'PUSH_STR "ACME LTD"',
      'REC_SET acct, "name"',
      'PUSH_REAL 1250.5',
      'REC_SET acct, "balance"',
      'PUSH_ENUM Colour green',
      'REC_SET acct, "flag"',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RecordMixedFields' },
      globals: [],
      enums: { Colour: ['red', 'green', 'blue'] },
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.records',
    message: '',
    expect(result) {
      const acct = result.globals.acct || {};
      return [
        ['acct.id', acct.id, 42],
        ['acct.name', acct.name, 'ACME LTD'],
        ['acct.balance', acct.balance, 1250.5],
        ['acct.flag', acct.flag, 'green']
      ];
    }
  },
  {
    id: 'record-field-read-back',
    family: 'records',
    pcode: line(
      'START:',
      'REC_NEW pt',
      'PUSH_INT 3',
      'REC_SET pt, "x"',
      'PUSH_INT 4',
      'REC_SET pt, "y"',
      'REC_GET pt, "x"',
      'REC_GET pt, "y"',
      'ADD',
      'STORE sum',
      'REC_GET pt, "missing"',
      'STORE absent',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RecordFieldReadBack' },
      globals: ['sum', 'absent'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.records',
    message: '',
    expect(result) {
      return [
        ['sum', result.globals.sum, 7],
        ['absent', result.globals.absent, 0]
      ];
    }
  },
  {
    id: 'record-string-field-print',
    family: 'records',
    pcode: line(
      'START:',
      'REC_NEW msg',
      'PUSH_STR "hello record"',
      'REC_SET msg, "text"',
      'REC_GET msg, "text"',
      'PRINT',
      'PRINT_NL',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'RecordStringFieldPrint' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.records',
    message: '',
    expect(result) {
      return [['stdout[0]', result.stdout[0], 'hello record']];
    }
  },
  {
    id: 'set-membership',
    family: 'sets',
    pcode: line(
      'START:',
      'SET_NEW s',
      'SET_ADD s, 3',
      'SET_ADD s, 1',
      'SET_ADD s, 3',
      'SET_ADD s, 7',
      'SET_IN s, 3',
      'STORE hasThree',
      'SET_IN s, 5',
      'STORE hasFive',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'SetMembership' },
      globals: ['hasThree', 'hasFive'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.sets',
    message: '',
    expect(result) {
      return [
        ['hasThree', result.globals.hasThree, 1],
        ['hasFive', result.globals.hasFive, 0],
        ['s', JSON.stringify(result.globals.s), '[1,3,7]']
      ];
    }
  },
  {
    id: 'set-algebra',
    family: 'sets',
    pcode: line(
      'START:',
      'SET_NEW a',
      'SET_ADD a, 1',
      'SET_ADD a, 2',
      'SET_ADD a, 3',
      'SET_NEW b',
      'SET_ADD b, 3',
      'SET_ADD b, 4',
      'SET_UNION a, b, u',
      'SET_INTERSECT a, b, i',
      'SET_DIFF a, b, d',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'SetAlgebra' },
      globals: [],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.sets',
    message: '',
    expect(result) {
      return [
        ['union', JSON.stringify(result.globals.u), '[1,2,3,4]'],
        ['intersection', JSON.stringify(result.globals.i), '[3]'],
        ['difference', JSON.stringify(result.globals.d), '[1,2]']
      ];
    }
  },
  {
    id: 'set-of-enum-ordinals',
    family: 'sets',
    pcode: line(
      'START:',
      'SET_NEW palette',
      'PUSH_ENUM Colour red',
      'ORD',
      'SET_ADD palette',
      'PUSH_ENUM Colour blue',
      'ORD',
      'SET_ADD palette',
      'PUSH_ENUM Colour blue',
      'ORD',
      'SET_IN palette',
      'STORE blueMember',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'SetOfEnumOrdinals' },
      globals: ['blueMember'],
      enums: { Colour: ['red', 'green', 'blue'] },
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.sets',
    message: '',
    expect(result) {
      return [
        ['blueMember', result.globals.blueMember, 1],
        ['palette', JSON.stringify(result.globals.palette), '[0,2]']
      ];
    }
  },
  {
    id: 'step-limit-runaway-loop',
    family: 'limits',
    // Deliberately exceeds MAX_RUN_STEPS so both runtimes must truncate at the same point.
    pcode: line(
      'START:',
      'PUSH_INT 30000',
      'STORE n',
      'LOOP:',
      'LOAD_NAME n',
      'PUSH_INT 0',
      'GT',
      'JZ DONE',
      'LOAD_NAME n',
      'PUSH_INT 1',
      'SUB',
      'STORE n',
      'JMP LOOP',
      'DONE:',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'StepLimitRunawayLoop' },
      globals: ['n'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.limits',
    message: '',
    expect(result) {
      return [['stepLimitHit', result.stepLimitHit, true]];
    }
  },
  {
    id: 'string-equality-via-eq',
    family: 'typing',
    pcode: line(
      'START:',
      'PUSH_STR "same"',
      'PUSH_STR "same"',
      'EQ',
      'STORE eqSame',
      'HALT'
    ),
    programMap: {
      runtimeUnit: { kind: 'program', id: 'StringEqualityViaEq' },
      globals: ['eqSame'],
      entries: [],
      procedures: {}
    },
    inputQueue: 'conformance.typing',
    message: '',
    expect(result) {
      return [['eqSame', result.globals.eqSame, 1]];
    }
  }
];

export function selectCases({ caseId = '', family = '' } = {}) {
  return CASES.filter((testCase) => {
    if (caseId && testCase.id !== caseId) return false;
    if (family && testCase.family !== family) return false;
    return true;
  });
}
