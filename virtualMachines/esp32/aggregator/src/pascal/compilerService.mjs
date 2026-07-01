/**
 * Pascal Compiler Service
 * 
 * Provides REST API for compiling Pascal code to p-code using ANTLR-based PulseSys grammar.
 * Supports symbol table extraction and autocomplete suggestions.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PascalCompilerService {
  constructor(options = {}) {
    this.grammarPath = options.grammarPath || path.join(__dirname, '../../../dsl/languages/PulseSys');
    this.antlrJar = options.antlrJar || path.join(__dirname, '../../../dsl/services/Pulse0Compiler/antlr-4.9.2-complete.jar');
    this.timeout = options.timeout || 30000;
  }

  /**
   * Compile Pascal source code to p-code
   * 
   * This is a simplified implementation that validates syntax and extracts symbols.
   * Full p-code generation would require a complete code generator.
   */
  async compile(source, options = {}) {
    try {
      // Validate syntax
      const validation = await this.validate(source);
      
      if (!validation.valid) {
        return {
          status: 'error',
          errors: validation.errors,
          pcode: null
        };
      }

      // Extract symbols
      const symbolResult = await this.extractSymbols(source);

      // Generate placeholder p-code
      // In a full implementation, this would use a code generator
      const pcode = this.generatePlaceholderPCode(source, symbolResult.symbols);

      return {
        status: 'ok',
        pcode,
        symbols: symbolResult.symbols,
        errors: [],
        warnings: []
      };
    } catch (err) {
      console.error('[PascalCompiler] Compilation error:', err);
      return {
        status: 'error',
        error: err.message,
        errors: [{ line: 0, column: 0, message: err.message }]
      };
    }
  }

  /**
   * Validate Pascal syntax
   */
  async validate(source) {
    try {
      const errors = [];

      // Basic syntax validation using regex patterns
      // Check for program declaration
      if (!source.match(/program\s+\w+\s*;/i)) {
        errors.push({
          line: 1,
          column: 1,
          message: 'Missing program declaration'
        });
      }

      // Check for begin/end pairs
      const beginCount = (source.match(/\bbegin\b/gi) || []).length;
      const endCount = (source.match(/\bend\b/gi) || []).length;
      if (beginCount !== endCount) {
        errors.push({
          line: 0,
          column: 0,
          message: `Mismatched begin/end blocks (${beginCount} begin, ${endCount} end)`
        });
      }

      // Check for final period
      if (!source.trim().endsWith('.')) {
        errors.push({
          line: source.split('\n').length,
          column: 1,
          message: 'Program must end with a period'
        });
      }

      return {
        status: 'ok',
        valid: errors.length === 0,
        errors
      };
    } catch (err) {
      return {
        status: 'error',
        valid: false,
        errors: [{ line: 0, column: 0, message: err.message }]
      };
    }
  }

  /**
   * Extract symbols from Pascal source
   */
  async extractSymbols(source) {
    try {
      const symbols = [];
      
      // Extract program name
      const programMatch = source.match(/program\s+(\w+)/i);
      if (programMatch) {
        symbols.push({
          name: programMatch[1],
          type: 'program',
          kind: 'program',
          line: this.getLineNumber(source, programMatch.index),
          detail: 'Program entry point'
        });
      }

      // Extract variables
      const varMatches = source.matchAll(/var\s+(\w+(?:\s*,\s*\w+)*)\s*:\s*(\w+)/gi);
      for (const match of varMatches) {
        const varNames = match[1].split(',').map(v => v.trim());
        const varType = match[2];
        for (const varName of varNames) {
          symbols.push({
            name: varName,
            type: 'variable',
            kind: 'variable',
            dataType: varType,
            line: this.getLineNumber(source, match.index),
            detail: `Variable of type ${varType}`
          });
        }
      }

      // Extract procedures
      const procMatches = source.matchAll(/procedure\s+(\w+)/gi);
      for (const match of procMatches) {
        symbols.push({
          name: match[1],
          type: 'procedure',
          kind: 'function',
          line: this.getLineNumber(source, match.index),
          detail: 'Procedure'
        });
      }

      // Extract functions
      const funcMatches = source.matchAll(/function\s+(\w+)/gi);
      for (const match of funcMatches) {
        symbols.push({
          name: match[1],
          type: 'function',
          kind: 'function',
          line: this.getLineNumber(source, match.index),
          detail: 'Function'
        });
      }

      return {
        status: 'ok',
        symbols
      };
    } catch (err) {
      console.error('[PascalCompiler] Symbol extraction error:', err);
      return {
        status: 'error',
        error: err.message,
        symbols: []
      };
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async getCompletions(source, position) {
    try {
      // Extract symbols for autocomplete
      const symbolResult = await this.extractSymbols(source);
      const symbols = symbolResult.symbols || [];

      // Pascal keywords based on PulseSys grammar
      const keywords = [
        'program', 'begin', 'end', 'var', 'const', 'type',
        'procedure', 'function', 'if', 'then', 'else',
        'while', 'do', 'for', 'to', 'downto', 'repeat', 'until',
        'case', 'of', 'array', 'record', 'integer', 'boolean', 'real',
        'true', 'false', 'and', 'or', 'not', 'div', 'mod',
        'spawn', 'send', 'receive' // PulseSys extensions
      ];

      const completions = [
        ...keywords.map(kw => ({
          label: kw,
          kind: 'keyword',
          detail: 'Pascal keyword',
          insertText: kw
        })),
        ...symbols.map(sym => ({
          label: sym.name,
          kind: sym.kind || sym.type,
          detail: sym.detail || sym.dataType || sym.type,
          insertText: sym.name
        }))
      ];

      return {
        status: 'ok',
        completions
      };
    } catch (err) {
      console.error('[PascalCompiler] Autocomplete error:', err);
      return {
        status: 'error',
        error: err.message,
        completions: []
      };
    }
  }

  /**
   * Generate placeholder p-code
   * In a full implementation, this would use a proper code generator
   */
  generatePlaceholderPCode(source, symbols) {
    const lines = [];
    lines.push('; Generated p-code');
    lines.push('; Source: Pascal program');
    lines.push('');
    
    // Add symbol declarations
    for (const sym of symbols) {
      if (sym.type === 'variable') {
        lines.push(`DECL ${sym.name} ${sym.dataType || 'INTEGER'}`);
      }
    }
    
    lines.push('');
    lines.push('START:');
    lines.push('  ; Program logic would go here');
    lines.push('  HALT');
    
    return lines.join('\n');
  }

  /**
   * Get line number from string index
   */
  getLineNumber(source, index) {
    return source.substring(0, index).split('\n').length;
  }
}

// Singleton instance
let compilerInstance = null;

export function createPascalCompiler(options) {
  if (!compilerInstance) {
    compilerInstance = new PascalCompilerService(options);
  }
  return compilerInstance;
}

export function getPascalCompiler() {
  if (!compilerInstance) {
    throw new Error('Pascal compiler not initialized. Call createPascalCompiler() first.');
  }
  return compilerInstance;
}

// Made with Bob
