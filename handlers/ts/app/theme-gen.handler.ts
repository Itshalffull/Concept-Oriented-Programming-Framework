// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ThemeGen Concept Implementation [G]
// Generates target output from a normalized expressive theme AST.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string): string { return prefix + '-' + (++counter); }
const VALID_TARGETS = ['css-variables', 'tailwind', 'react-native', 'terminal', 'w3c-dtcg'];
type Json = Record<string, unknown>;
function isObject(value: unknown): value is Json { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function camelize(path: string): string { return path.replace(/\.([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase()); }
function inferTokenType(path: string): string {
  if (path.startsWith('color.')) return 'color'; if (path.startsWith('elevation.')) return 'shadow';
  if (path.startsWith('motion.')) return 'transition'; if (path.startsWith('typography.')) return 'typography';
  if (path.startsWith('density.')) return 'number'; return 'string';
}
function readTokens(ast: Json): Record<string, string> { const tokens = isObject(ast.tokens) ? ast.tokens : {}; const result: Record<string, string> = {}; for (const [key, value] of Object.entries(tokens)) result[key] = String(value); return result; }
function readContext(ast: Json): Record<string, string> { const context = isObject(ast.context) ? ast.context : {}; const result: Record<string, string> = {}; for (const [key, value] of Object.entries(context)) result[key] = String(value); return result; }

const _themeGenHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const gen = input.gen as string;
    const target = input.target as string;
    const themeAst = input.themeAst as string;
    if (!VALID_TARGETS.includes(target)) { let p = createProgram(); return complete(p, 'error', { message: `Unsupported target "${target}". Valid targets: ${VALID_TARGETS.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let ast: Json;
    try { ast = JSON.parse(themeAst) as Json; } catch { let p = createProgram(); return complete(p, 'error', { message: 'Failed to parse theme AST as JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const id = gen || nextId('G');
    const tokens = readTokens(ast); const context = readContext(ast);
    let output = '';
    switch (target) {
      case 'css-variables': { const vars = Object.entries(tokens).map(([key, value]) => `  --${key.replace(/\./g, '-')}: ${value};`); const contextVars = Object.entries(context).map(([key, value]) => `  --theme-${key}: ${value};`); output = `:root {\n${[...vars, ...contextVars].join('\n')}\n}`; break; }
      case 'tailwind': { output = JSON.stringify({ theme: { extend: tokens }, clef: { context } }, null, 2); break; }
      case 'react-native': { const nativeTheme: Record<string, string> = {}; for (const [key, value] of Object.entries(tokens)) nativeTheme[camelize(key)] = value; output = `export const theme = ${JSON.stringify({ tokens: nativeTheme, context }, null, 2)};`; break; }
      case 'terminal': { output = [...Object.entries(context).map(([key, value]) => `context.${key}=${value}`), ...Object.entries(tokens).map(([key, value]) => `${key}=${value}`)].join('\n'); break; }
      case 'w3c-dtcg': { const dtcg: Record<string, unknown> = {}; for (const [key, value] of Object.entries(tokens)) dtcg[key] = { $value: value, $type: inferTokenType(key) }; output = JSON.stringify({ tokens: dtcg, extensions: { clef: { context } } }, null, 2); break; }
    }
    let p = createProgram();
    p = put(p, 'themeGen', id, { target, input: themeAst, output });
    return complete(p, 'ok', { output }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const themeGenHandler = autoInterpret(_themeGenHandler);

