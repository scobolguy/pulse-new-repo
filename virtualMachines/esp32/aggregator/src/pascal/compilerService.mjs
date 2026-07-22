/**
 * Pascal Compiler Service
 *
 * Wraps the ANTLR-based StandardPascal compiler for use via REST API.
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPILER_URL = pathToFileURL(
  path.resolve(__dirname, '../../scripts/compile-standard-pascal-antlr-to-pcode.mjs')
).href;

export class PascalCompilerService {
  constructor(_options = {}) {}

  /**
   * Compile Pascal source to pcode using the real ANTLR compiler.
   * Returns { status, pcode, pcodeText, programMap, symbols, errors, warnings }
   */
  async compile(source, _options = {}) {
    try {
      const { compileStandardPascalWithAntlr } = await import(COMPILER_URL);
      const result = compileStandardPascalWithAntlr(String(source));

      const symbols = this._extractSymbols(source);

      return {
        status: 'ok',
        pcode: result.pcodeText,
        pcodeText: result.pcodeText,
        programMap: result.programMap,
        symbols,
        errors: [],
        warnings: []
      };
    } catch (err) {
      const errors = err.message.startsWith('[STD-PASCAL]')
        ? err.message.split('\n').map((msg, i) => ({ line: i, column: 0, message: msg }))
        : [{ line: 0, column: 0, message: err.message }];
      return { status: 'error', error: err.message, errors, pcode: null };
    }
  }

  /**
   * Validate by attempting compilation — errors are real ANTLR parse errors.
   */
  async validate(source) {
    const result = await this.compile(source);
    return {
      status: 'ok',
      valid: result.status === 'ok',
      errors: result.errors || []
    };
  }

  /**
   * Extract symbols via regex (fast path; no full compile needed).
   */
  async extractSymbols(source) {
    return { status: 'ok', symbols: this._extractSymbols(source) };
  }

  _extractSymbols(source) {
    const symbols = [];
    const programMatch = source.match(/program\s+(\w+)/i);
    if (programMatch) {
      symbols.push({ name: programMatch[1], kind: 'program', type: 'program',
        line: this._lineOf(source, programMatch.index), detail: 'Program entry point' });
    }
    for (const m of source.matchAll(/var\s+(\w+(?:\s*,\s*\w+)*)\s*:\s*(\w+)/gi)) {
      for (const v of m[1].split(',').map(s => s.trim())) {
        symbols.push({ name: v, kind: 'variable', type: 'variable', dataType: m[2],
          line: this._lineOf(source, m.index), detail: `Variable of type ${m[2]}` });
      }
    }
    for (const m of source.matchAll(/procedure\s+(\w+)/gi)) {
      symbols.push({ name: m[1], kind: 'function', type: 'procedure',
        line: this._lineOf(source, m.index), detail: 'Procedure' });
    }
    return symbols;
  }

  async getCompletions(source, _position) {
    const { symbols } = await this.extractSymbols(source);
    const keywords = [
      'program', 'begin', 'end', 'var', 'procedure', 'if', 'then', 'else',
      'while', 'do', 'for', 'to', 'repeat', 'until', 'integer', 'boolean',
      'and', 'or', 'not', 'div', 'mod', 'writeln'
    ];
    return {
      status: 'ok',
      completions: [
        ...keywords.map(kw => ({ label: kw, kind: 'keyword', detail: 'Pascal keyword', insertText: kw })),
        ...symbols.map(s => ({ label: s.name, kind: s.kind, detail: s.detail, insertText: s.name }))
      ]
    };
  }

  _lineOf(source, index) {
    return source.substring(0, index).split('\n').length;
  }
}

let compilerInstance = null;

export function createPascalCompiler(options) {
  if (!compilerInstance) compilerInstance = new PascalCompilerService(options);
  return compilerInstance;
}

export function getPascalCompiler() {
  if (!compilerInstance) throw new Error('Pascal compiler not initialized. Call createPascalCompiler() first.');
  return compilerInstance;
}

// Made with Bob
