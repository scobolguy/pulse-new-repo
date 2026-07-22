/**
 * Pascal Compiler REST API Routes
 * 
 * Provides HTTP endpoints for Pascal compilation, symbol extraction, and autocomplete.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import { getPascalCompiler } from './compilerService.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPCODE_MANIFEST = path.resolve(__dirname, '../../../pcode/pcode-opcodes.manifest.json');
const ANTLR_COMPILER_URL = pathToFileURL(path.resolve(__dirname, '../../scripts/compile-standard-pascal-antlr-to-pcode.mjs')).href;
const PMACHINE_URL = pathToFileURL(path.resolve(__dirname, '../../scripts/run-js-pmachine.mjs')).href;

const router = express.Router();

/**
 * POST /api/pascal/compile
 * 
 * Compile Pascal source code to p-code
 * 
 * Request body:
 * {
 *   "source": "program Hello;\nbegin\n  writeln('Hello');\nend.",
 *   "options": {
 *     "optimize": true,
 *     "target": "esp32"
 *   }
 * }
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "pcode": "; Generated p-code...",
 *   "symbols": [...],
 *   "errors": [],
 *   "warnings": []
 * }
 */
router.post('/compile', async (req, res) => {
  try {
    const { source, options = {} } = req.body;

    if (!source) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: source'
      });
    }

    const compiler = getPascalCompiler();
    const result = await compiler.compile(source, options);

    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[PascalRoutes] Compile error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * POST /api/pascal/validate
 * 
 * Validate Pascal syntax without compilation
 * 
 * Request body:
 * {
 *   "source": "program Hello;\nbegin\nend."
 * }
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "valid": true,
 *   "errors": []
 * }
 */
router.post('/validate', async (req, res) => {
  try {
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: source'
      });
    }

    const compiler = getPascalCompiler();
    const result = await compiler.validate(source);

    res.json(result);
  } catch (err) {
    console.error('[PascalRoutes] Validate error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * POST /api/pascal/symbols
 * 
 * Extract symbol table from Pascal source
 * 
 * Request body:
 * {
 *   "source": "program Hello;\nvar x: integer;\nbegin\nend."
 * }
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "symbols": [
 *     {
 *       "name": "Hello",
 *       "type": "program",
 *       "kind": "program",
 *       "line": 1,
 *       "detail": "Program entry point"
 *     },
 *     {
 *       "name": "x",
 *       "type": "variable",
 *       "kind": "variable",
 *       "dataType": "integer",
 *       "line": 2,
 *       "detail": "Variable of type integer"
 *     }
 *   ]
 * }
 */
router.post('/symbols', async (req, res) => {
  try {
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: source'
      });
    }

    const compiler = getPascalCompiler();
    const result = await compiler.extractSymbols(source);

    res.json(result);
  } catch (err) {
    console.error('[PascalRoutes] Symbols error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * POST /api/pascal/complete
 * 
 * Get autocomplete suggestions for Pascal code
 * 
 * Request body:
 * {
 *   "source": "program Hello;\nvar x: integer;\nbegin\n  x := ",
 *   "position": {
 *     "line": 4,
 *     "column": 8
 *   }
 * }
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "completions": [
 *     {
 *       "label": "x",
 *       "kind": "variable",
 *       "detail": "Variable of type integer",
 *       "insertText": "x"
 *     },
 *     {
 *       "label": "begin",
 *       "kind": "keyword",
 *       "detail": "Pascal keyword",
 *       "insertText": "begin"
 *     }
 *   ]
 * }
 */
router.post('/complete', async (req, res) => {
  try {
    const { source, position } = req.body;

    if (!source) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: source'
      });
    }

    const compiler = getPascalCompiler();
    const result = await compiler.getCompletions(source, position);

    res.json(result);
  } catch (err) {
    console.error('[PascalRoutes] Complete error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * GET /api/pascal/examples
 * 
 * Get example Pascal programs
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "examples": [
 *     {
 *       "name": "Hello World",
 *       "description": "Simple hello world program",
 *       "source": "program Hello;\nbegin\n  writeln('Hello, World!');\nend."
 *     }
 *   ]
 * }
 */
router.get('/examples', (req, res) => {
  const examples = [
    {
      name: 'Hello World',
      description: 'Simple hello world program',
      source: `program Hello;
begin
  writeln('Hello, World!');
end.`
    },
    {
      name: 'Variables and Math',
      description: 'Program demonstrating variables and arithmetic',
      source: `program MathDemo;
var
  x, y, sum: integer;
begin
  x := 10;
  y := 20;
  sum := x + y;
  writeln('Sum: ', sum);
end.`
    },
    {
      name: 'Procedure Example',
      description: 'Program with a procedure',
      source: `program ProcDemo;
var
  result: integer;

procedure Calculate(a, b: integer);
begin
  result := a * b;
end;

begin
  Calculate(5, 7);
  writeln('Result: ', result);
end.`
    },
    {
      name: 'Control Flow',
      description: 'If-then-else and loops',
      source: `program ControlFlow;
var
  i, n: integer;
begin
  n := 10;
  if n > 5 then
    writeln('n is greater than 5')
  else
    writeln('n is not greater than 5');
  
  for i := 1 to 5 do
    writeln('i = ', i);
end.`
    }
  ];

  res.json({
    status: 'ok',
    examples
  });
});

/**
 * GET /api/pascal/keywords
 * 
 * Get list of Pascal keywords for syntax highlighting
 * 
 * Response:
 * {
 *   "status": "ok",
 *   "keywords": ["program", "begin", "end", ...]
 * }
 */
router.get('/keywords', (req, res) => {
  const keywords = [
    'program', 'begin', 'end', 'var', 'const', 'type',
    'procedure', 'function', 'if', 'then', 'else',
    'while', 'do', 'for', 'to', 'downto', 'repeat', 'until',
    'case', 'of', 'array', 'record', 'integer', 'boolean', 'real',
    'true', 'false', 'and', 'or', 'not', 'div', 'mod',
    'spawn', 'send', 'receive', 'writeln', 'readln'
  ];

  res.json({
    status: 'ok',
    keywords
  });
});

/**
 * POST /api/pascal/execute
 *
 * Compile and run Pascal source code through the pmachine.
 *
 * Request body:
 * {
 *   "source": "program T; begin writeln(src) end.",
 *   "message": "hello"      // optional: injected as 'src' variable
 * }
 *
 * Response:
 * {
 *   "status": "ok",
 *   "output": ["hello"],
 *   "stdout": "hello\n",
 *   "elapsedMs": 12
 * }
 */
router.post('/execute', async (req, res) => {
  const t0 = Date.now();
  try {
    const { source, message = '' } = req.body;

    if (!source) {
      return res.status(400).json({ status: 'error', error: 'Missing required field: source' });
    }

    // Use the real ANTLR-based compiler directly
    const { compileStandardPascalWithAntlr } = await import(ANTLR_COMPILER_URL);
    const { executeProgram, parsePcode } = await import(PMACHINE_URL);

    let compiled;
    try {
      compiled = compileStandardPascalWithAntlr(String(source));
    } catch (compileErr) {
      return res.status(400).json({ status: 'error', error: `Compile error: ${compileErr.message}` });
    }

    const manifestText = await fs.readFile(OPCODE_MANIFEST, 'utf-8');
    const opcodeMap = new Map(Object.entries(JSON.parse(manifestText).opcodes || {}));

    const instructions = parsePcode(compiled.pcodeText);
    const programMap = compiled.programMap || {};

    const mappingsById = new Map();
    mappingsById.__globals = Array.isArray(programMap.globals) ? programMap.globals : [];
    mappingsById.__proceduresByLabel = programMap.procedures || {};

    const result = await executeProgram({
      instructions,
      opcodeMap,
      mappingsById,
      queueTypesByName: new Map(),
      isoTypeIds: new Set(),
      inputQueue: 'pascal.execute.in',
      sourceMessage: String(message),
      runtimeContext: {}
    });

    const output = result?.stdout || [];
    res.json({
      status: 'ok',
      output,
      stdout: output.join('\n'),
      elapsedMs: Date.now() - t0
    });
  } catch (err) {
    console.error('[PascalRoutes] Execute error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

export default router;

// Made with Bob
