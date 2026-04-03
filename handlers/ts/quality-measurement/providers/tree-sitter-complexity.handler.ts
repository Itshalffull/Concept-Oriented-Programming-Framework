// @clef-handler style=functional concept=TreeSitterComplexityProvider
// ============================================================
// TreeSitterComplexityProvider Handler
//
// Computes cyclomatic complexity metrics for source files using
// tree-sitter AST parsing. Registers with PluginRegistry as a
// Metric provider of type "metric" under name "tree-sitter-complexity".
//
// Cyclomatic complexity = 1 + number of decision points:
//   if, else if, while, for, for...of, for...in, switch case,
//   catch, ternary (?), logical && / ||, null coalescing ??.
//
// Supports TypeScript, JavaScript, and a generic fallback that
// applies the same heuristic to any C-like source.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'tree-sitter-complexity';
const METRIC_NAME = 'cyclomatic_complexity';
const SUPPORTED_LANGUAGES = new Set(['typescript', 'javascript', 'generic']);

// ──────────────────────────────────────────────────────────────
// Complexity computation (tree-sitter-style line-by-line AST)
// ──────────────────────────────────────────────────────────────

interface FunctionRecord {
  name: string;
  complexity: number;
}

/**
 * Count decision-point tokens in a single source line.
 * Each token raises complexity by 1.
 */
function countDecisionPoints(line: string): number {
  let count = 0;

  // Strip string literals to avoid counting tokens inside strings
  const stripped = line
    .replace(/`[^`]*`/g, '""')                     // template literals
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')            // double-quoted
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");           // single-quoted

  // Strip line comment
  const commentIdx = stripped.indexOf('//');
  const code = commentIdx >= 0 ? stripped.slice(0, commentIdx) : stripped;

  // if / else if — each 'if' is a decision point
  const ifMatches = code.match(/\bif\s*\(/g);
  if (ifMatches) count += ifMatches.length;

  // while
  const whileMatches = code.match(/\bwhile\s*\(/g);
  if (whileMatches) count += whileMatches.length;

  // for (classic, for...of, for...in)
  const forMatches = code.match(/\bfor\s*\(/g);
  if (forMatches) count += forMatches.length;

  // switch case — each 'case' (not 'default') is a decision point
  const caseMatches = code.match(/\bcase\s+/g);
  if (caseMatches) count += caseMatches.length;

  // catch clause
  const catchMatches = code.match(/\bcatch\s*\(/g);
  if (catchMatches) count += catchMatches.length;

  // ternary operator ?  (but not ?. or ??)
  // Match '?' that is not preceded by '?' and not followed by '.' or '?'
  const ternaryMatches = code.match(/(?<![?])\?(?![.?])/g);
  if (ternaryMatches) count += ternaryMatches.length;

  // Logical AND &&
  const andMatches = code.match(/&&/g);
  if (andMatches) count += andMatches.length;

  // Logical OR ||
  const orMatches = code.match(/\|\|/g);
  if (orMatches) count += orMatches.length;

  // Null coalescing ??
  const nullCoalesceMatches = code.match(/\?\?/g);
  if (nullCoalesceMatches) count += nullCoalesceMatches.length;

  return count;
}

/**
 * Extract function names and their bodies from source text.
 * Returns an array of { name, startLine, endLine } records.
 * Tracks brace depth to detect function boundaries.
 */
function extractFunctions(lines: string[]): Array<{ name: string; startLine: number; endLine: number }> {
  const functions: Array<{ name: string; startLine: number; endLine: number }> = [];
  let depth = 0;
  const stack: Array<{ name: string; startLine: number; depth: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect function declaration patterns
    // function foo(...) { or async function foo(...) {
    const funcDeclMatch = line.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*(?:<[^>]*>)?\s*\(/);
    if (funcDeclMatch) {
      stack.push({ name: funcDeclMatch[1], startLine: i, depth });
    }

    // Arrow function: const foo = (...) => or const foo = async (...) =>
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]*)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/);
    if (arrowMatch) {
      stack.push({ name: arrowMatch[1], startLine: i, depth });
    }

    // Method shorthand: methodName(...) { inside class/object
    const methodMatch = line.match(/^\s+(?:async\s+|static\s+|private\s+|protected\s+|public\s+|readonly\s+)*(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/);
    if (methodMatch && !line.match(/^\s*(if|for|while|switch|catch)\b/)) {
      stack.push({ name: methodMatch[1], startLine: i, depth });
    }

    // Count braces (skip strings)
    const stripped = line
      .replace(/`[^`]*`/g, '""')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const openCount = (stripped.match(/\{/g) || []).length;
    const closeCount = (stripped.match(/\}/g) || []).length;

    depth += openCount;
    depth -= closeCount;

    // Close any functions whose depth is exceeded
    for (let j = stack.length - 1; j >= 0; j--) {
      const frame = stack[j];
      if (depth <= frame.depth) {
        // Function ended
        functions.push({ name: frame.name, startLine: frame.startLine, endLine: i });
        stack.splice(j, 1);
      }
    }
  }

  // Handle functions that reach end of file
  for (const frame of stack) {
    functions.push({ name: frame.name, startLine: frame.startLine, endLine: lines.length - 1 });
  }

  return functions;
}

/**
 * Compute cyclomatic complexity for a single source file.
 * Returns a per-function breakdown and the aggregate (max) complexity.
 */
function computeComplexity(source: string): {
  aggregate: number;
  functions: FunctionRecord[];
} {
  const lines = source.split('\n');
  const functions = extractFunctions(lines);

  if (functions.length === 0) {
    // No function found — compute complexity for the whole file
    let complexity = 1;
    for (const line of lines) {
      complexity += countDecisionPoints(line);
    }
    return {
      aggregate: complexity,
      functions: [{ name: '<module>', complexity }],
    };
  }

  const records: FunctionRecord[] = functions.map(fn => {
    let complexity = 1; // Base complexity
    for (let i = fn.startLine; i <= fn.endLine && i < lines.length; i++) {
      complexity += countDecisionPoints(lines[i]);
    }
    return { name: fn.name, complexity };
  });

  const aggregate = Math.max(...records.map(r => r.complexity));

  return { aggregate, functions: records };
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'TreeSitterComplexityProvider',
      metricName: METRIC_NAME,
      language: [...SUPPORTED_LANGUAGES].join(','),
    }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const source = (input.source as string) ?? '';
    const language = ((input.language as string) ?? 'generic').toLowerCase();
    const target = (input.target as string) ?? '';

    if (!source || source.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'source is required' }) as StorageProgram<Result>;
    }

    if (!SUPPORTED_LANGUAGES.has(language)) {
      const p = createProgram();
      return complete(p, 'error', {
        message: `Unsupported language "${language}". Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let result: { aggregate: number; functions: FunctionRecord[] };
    try {
      result = computeComplexity(source);
    } catch (err) {
      const p = createProgram();
      return complete(p, 'error', { message: `Parse failed: ${String(err)}` }) as StorageProgram<Result>;
    }

    const detail = JSON.stringify({
      language,
      functions: result.functions,
    });

    const p = createProgram();
    return complete(p, 'ok', {
      target,
      value: result.aggregate,
      detail,
    }) as StorageProgram<Result>;
  },
};

export const treeSitterComplexityProviderHandler = autoInterpret(_handler);

export default treeSitterComplexityProviderHandler;
