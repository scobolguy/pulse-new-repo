// FORTRAN 77 intrinsic functions (ANSI X3.9-1978 section 15.10, table 5).
// `res` is the result type ('arg' = type of the first argument). `impl` names an inline
// generator in codegen.mjs or, with `rtl`, a function of the runtime library.

const spec = (res, impl, extra = {}) => ({ res, impl, ...extra });

export const INTRINSICS = {
  INT: spec('integer', 'int'), IFIX: spec('integer', 'int'), IDINT: spec('integer', 'int'),
  REAL: spec('real', 'real'), FLOAT: spec('real', 'real'), SNGL: spec('real', 'real'),
  DBLE: spec('double', 'real'), CMPLX: spec('complex', 'cmplx'),
  ICHAR: spec('integer', 'ichar'), CHAR: spec('character', 'char'),
  AINT: spec('arg', 'aint'), DINT: spec('arg', 'aint'),
  ANINT: spec('arg', 'anint'), DNINT: spec('arg', 'anint'),
  NINT: spec('integer', 'nint'), IDNINT: spec('integer', 'nint'),
  ABS: spec('arg', 'abs'), IABS: spec('integer', 'abs'), DABS: spec('double', 'abs'), CABS: spec('real', 'abs'),
  MOD: spec('arg', 'mod'), AMOD: spec('real', 'mod'), DMOD: spec('double', 'mod'),
  SIGN: spec('arg', 'sign'), ISIGN: spec('integer', 'sign'), DSIGN: spec('double', 'sign'),
  DIM: spec('arg', 'dim'), IDIM: spec('integer', 'dim'), DDIM: spec('double', 'dim'),
  DPROD: spec('double', 'dprod'),
  MAX: spec('arg', 'max'), MAX0: spec('integer', 'max'), AMAX1: spec('real', 'max'), DMAX1: spec('double', 'max'),
  AMAX0: spec('real', 'max'), MAX1: spec('integer', 'max'),
  MIN: spec('arg', 'min'), MIN0: spec('integer', 'min'), AMIN1: spec('real', 'min'), DMIN1: spec('double', 'min'),
  AMIN0: spec('real', 'min'), MIN1: spec('integer', 'min'),
  LEN: spec('integer', 'len'), INDEX: spec('integer', 'rtl', { rtl: 'FINDEX' }),
  AIMAG: spec('real', 'aimag'), CONJG: spec('complex', 'conjg'),
  SQRT: spec('arg', 'math', { rtl: 'FSQRT', crtl: 'FCSQRT' }), DSQRT: spec('double', 'math', { rtl: 'FSQRT' }),
  CSQRT: spec('complex', 'math', { crtl: 'FCSQRT' }),
  EXP: spec('arg', 'math', { rtl: 'FEXP', crtl: 'FCEXP' }), DEXP: spec('double', 'math', { rtl: 'FEXP' }),
  CEXP: spec('complex', 'math', { crtl: 'FCEXP' }),
  LOG: spec('arg', 'math', { rtl: 'FLOG', crtl: 'FCLOG' }), ALOG: spec('real', 'math', { rtl: 'FLOG' }),
  DLOG: spec('double', 'math', { rtl: 'FLOG' }), CLOG: spec('complex', 'math', { crtl: 'FCLOG' }),
  LOG10: spec('arg', 'math', { rtl: 'FLOG10' }), ALOG10: spec('real', 'math', { rtl: 'FLOG10' }),
  DLOG10: spec('double', 'math', { rtl: 'FLOG10' }),
  SIN: spec('arg', 'math', { rtl: 'FSIN', crtl: 'FCSIN' }), DSIN: spec('double', 'math', { rtl: 'FSIN' }),
  CSIN: spec('complex', 'math', { crtl: 'FCSIN' }),
  COS: spec('arg', 'math', { rtl: 'FCOS', crtl: 'FCCOS' }), DCOS: spec('double', 'math', { rtl: 'FCOS' }),
  CCOS: spec('complex', 'math', { crtl: 'FCCOS' }),
  TAN: spec('arg', 'math', { rtl: 'FTAN' }), DTAN: spec('double', 'math', { rtl: 'FTAN' }),
  ASIN: spec('arg', 'math', { rtl: 'FASIN' }), DASIN: spec('double', 'math', { rtl: 'FASIN' }),
  ACOS: spec('arg', 'math', { rtl: 'FACOS' }), DACOS: spec('double', 'math', { rtl: 'FACOS' }),
  ATAN: spec('arg', 'math', { rtl: 'FATAN' }), DATAN: spec('double', 'math', { rtl: 'FATAN' }),
  ATAN2: spec('arg', 'math', { rtl: 'FATAN2' }), DATAN2: spec('double', 'math', { rtl: 'FATAN2' }),
  SINH: spec('arg', 'math', { rtl: 'FSINH' }), DSINH: spec('double', 'math', { rtl: 'FSINH' }),
  COSH: spec('arg', 'math', { rtl: 'FCOSH' }), DCOSH: spec('double', 'math', { rtl: 'FCOSH' }),
  TANH: spec('arg', 'math', { rtl: 'FTANH' }), DTANH: spec('double', 'math', { rtl: 'FTANH' }),
  LGE: spec('logical', 'lexical', { op: 'GE' }), LGT: spec('logical', 'lexical', { op: 'GT' }),
  LLE: spec('logical', 'lexical', { op: 'LE' }), LLT: spec('logical', 'lexical', { op: 'LT' })
};

// Primitive p-machine operations available only to runtime-library program units.
export const LIBRARY_PRIMITIVES = {
  PFOPEN: { res: 'integer', args: 2 },   // (name, mode) -> handle, 0 on failure
  PFREAD: { res: 'logical', args: 2 },   // (handle, line) -> .TRUE. when a record was read into line
  PFWRIT: { res: null, args: 2 },        // CALL PFWRIT(handle, text)
  PFCLOS: { res: null, args: 1 },        // CALL PFCLOS(handle)
  PGETLN: { res: 'logical', args: 1 },   // (line) -> .TRUE. when a console line was read
  PPUTLN: { res: null, args: 1 },        // CALL PPUTLN(text): console record
  PPUT: { res: null, args: 1 }           // CALL PPUT(text): console text without ending the record
};

// Intrinsics that may be passed as actual arguments (section 15.10, specific names).
export const PASSABLE_INTRINSICS = new Set([
  'ABS', 'IABS', 'DABS', 'CABS', 'MOD', 'AMOD', 'DMOD', 'SIGN', 'ISIGN', 'DSIGN', 'DIM', 'IDIM', 'DDIM',
  'DPROD', 'LEN', 'INDEX', 'AIMAG', 'CONJG', 'SQRT', 'DSQRT', 'CSQRT', 'EXP', 'DEXP', 'CEXP', 'ALOG', 'DLOG',
  'CLOG', 'ALOG10', 'DLOG10', 'SIN', 'DSIN', 'CSIN', 'COS', 'DCOS', 'CCOS', 'TAN', 'DTAN', 'ASIN', 'DASIN',
  'ACOS', 'DACOS', 'ATAN', 'DATAN', 'ATAN2', 'DATAN2', 'SINH', 'DSINH', 'COSH', 'DCOSH', 'TANH', 'DTANH',
  'AINT', 'DINT', 'ANINT', 'DNINT', 'NINT', 'IDNINT'
]);
