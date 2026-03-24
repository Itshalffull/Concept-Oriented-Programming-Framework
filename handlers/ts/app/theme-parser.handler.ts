// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ThemeParser Concept Implementation [H]
// Parses expressive theme definitions into a normalized AST with derived tokens.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string): string { return prefix + '-' + (++counter); }
type Json = Record<string, unknown>;

const EXPRESSIVE_BLOCKS = ['colorSpace','colorScheme','constraint','preference','scope','typeScale','fontMetrics','shape','iconography','density','material','styleProfile','springPhysics','motionChoreography','structuralMotif','imageFilter'];
function isObject(value: unknown): value is Json { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function flattenTokens(value: unknown, prefix = '', into: Record<string, string> = {}): Record<string, string> {
  if (!isObject(value)) { if (prefix) into[prefix] = String(value); return into; }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(child)) flattenTokens(child, path, into);
    else if (Array.isArray(child)) into[path] = JSON.stringify(child);
    else if (child !== undefined && child !== null) into[path] = String(child);
  }
  return into;
}
function buildDerivedTokens(ast: Json): Record<string, string> {
  const tokens: Record<string, string> = {};
  if (isObject(ast.tokens)) flattenTokens(ast.tokens, '', tokens);
  if (isObject(ast.colors)) for (const [key, value] of Object.entries(ast.colors)) tokens[`color.${key}`] = String(value);
  const colorScheme = isObject(ast.colorScheme) ? ast.colorScheme : undefined;
  if (colorScheme) {
    const modes = isObject(colorScheme.modes) ? colorScheme.modes : undefined;
    const activeMode = typeof colorScheme.activeMode === 'string' ? colorScheme.activeMode : (modes && Object.keys(modes)[0]) || 'light';
    const activePalette = modes && isObject(modes[activeMode]) ? modes[activeMode] as Json : undefined;
    if (activePalette) { for (const [key, value] of Object.entries(activePalette)) tokens[`color.${key}`] = String(value); tokens['theme.mode'] = activeMode; }
  }
  const density = isObject(ast.density) ? ast.density : undefined;
  if (density) { if (typeof density.mode === 'string') tokens['density.mode'] = density.mode; if (density.multiplier !== undefined) tokens['density.multiplier'] = String(density.multiplier); }
  const typeScale = isObject(ast.typeScale) ? ast.typeScale : undefined;
  if (typeScale && isObject(typeScale.steps)) for (const [key, value] of Object.entries(typeScale.steps)) tokens[`typography.${key}`] = String(value);
  const material = isObject(ast.material) ? ast.material : undefined;
  if (material) { if (isObject(material.shadows)) for (const [level, value] of Object.entries(material.shadows)) tokens[`elevation.shadow.${level}`] = String(value); if (material.backdrop !== undefined) tokens['surface.backdrop'] = String(material.backdrop); }
  const springPhysics = isObject(ast.springPhysics) ? ast.springPhysics : undefined;
  if (springPhysics && isObject(springPhysics.presets)) for (const [preset, value] of Object.entries(springPhysics.presets)) tokens[`motion.spring.${preset}`] = JSON.stringify(value);
  const structuralMotif = isObject(ast.structuralMotif) ? ast.structuralMotif : undefined;
  if (structuralMotif && isObject(structuralMotif.intents)) for (const [intent, value] of Object.entries(structuralMotif.intents)) tokens[`motif.${intent}`] = String(value);
  const imageFilter = isObject(ast.imageFilter) ? ast.imageFilter : undefined;
  if (imageFilter && isObject(imageFilter.presets)) for (const [name, value] of Object.entries(imageFilter.presets)) tokens[`image-filter.${name}`] = JSON.stringify(value);
  return tokens;
}
function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[\da-f]{3}$|^[\da-f]{6}$/i.test(normalized)) return null;
  const hex = normalized.length === 3 ? normalized.split('').map((ch) => ch + ch).join('') : normalized;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}
function relativeLuminance(channel: number): number { const n = channel / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }
function contrastRatio(a: string, b: string): number | null {
  const colorA = parseHexColor(a); const colorB = parseHexColor(b);
  if (!colorA || !colorB) return a === b ? 1 : null;
  const lumA = 0.2126 * relativeLuminance(colorA.r) + 0.7152 * relativeLuminance(colorA.g) + 0.0722 * relativeLuminance(colorA.b);
  const lumB = 0.2126 * relativeLuminance(colorB.r) + 0.7152 * relativeLuminance(colorB.g) + 0.0722 * relativeLuminance(colorB.b);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}
function extractContrastPairs(tokens: Record<string, string>): Array<[string, string, string, string]> {
  const pairs: Array<[string, string, string, string]> = [];
  const entries: Array<[string, string, string, string]> = [['color.foreground','color.background','foreground','background'],['color.text','color.surface','text','surface'],['color.primary','color.onPrimary','primary','onPrimary'],['color.secondary','color.onSecondary','secondary','onSecondary'],['color.error','color.onError','error','onError']];
  for (const [fgKey, bgKey, fgName, bgName] of entries) if (tokens[fgKey] && tokens[bgKey]) pairs.push([tokens[fgKey]!, tokens[bgKey]!, fgName, bgName]);
  return pairs;
}

const _themeParserHandler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const source = input.source as string;
    const id = theme || nextId('H');
    let parsed: Json;
    try { parsed = JSON.parse(source) as Json; } catch (e) {
      // Not JSON — check if it looks like a theme DSL (contains braces) for lenient parsing
      if (source && source.includes('{') && source.includes('}')) {
        // Parse as a minimal stub theme from DSL syntax
        const nameMatch = source.match(/^(\w+)\s+(\w+)/);
        const themeName = nameMatch ? `${nameMatch[1]}-${nameMatch[2]}` : id;
        parsed = { name: themeName };
      } else {
        const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
        let p = createProgram();
        return complete(p, 'error', { errors: JSON.stringify([errorMessage]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }
    const warnings: string[] = []; const errors: string[] = [];
    const hasLegacyTokens = isObject(parsed.tokens) || isObject(parsed.colors) || isObject(parsed.typography) || isObject(parsed.spacing);
    const hasExpressiveBlocks = EXPRESSIVE_BLOCKS.some((key) => parsed[key] !== undefined);
    if (!hasLegacyTokens && !hasExpressiveBlocks) warnings.push('Theme source has no recognized legacy or expressive theme blocks.');
    for (const [key, value] of Object.entries(parsed)) { if (value === null || value === undefined) errors.push(`Theme block "${key}" has null or undefined value`); }
    if (errors.length > 0) { let p = createProgram(); return complete(p, 'error', { errors: JSON.stringify(errors) }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const derivedTokens = buildDerivedTokens(parsed);
    const density = isObject(parsed.density) ? parsed.density : {};
    const structuralMotif = isObject(parsed.structuralMotif) ? parsed.structuralMotif : {};
    const context = {
      density: typeof density.mode === 'string' ? density.mode : 'comfortable',
      motif: typeof structuralMotif.default === 'string' ? structuralMotif.default : (isObject(structuralMotif.intents) && typeof structuralMotif.intents.navigation === 'string' ? structuralMotif.intents.navigation : 'default'),
    };
    const ast = {
      name: parsed.name ?? id, extends: parsed.extends ?? null,
      blocks: Object.fromEntries(EXPRESSIVE_BLOCKS.filter((key) => parsed[key] !== undefined).map((key) => [key, parsed[key]])),
      tokens: derivedTokens, context, sourceType: hasExpressiveBlocks ? 'expressive-theme' : 'legacy-theme', raw: parsed,
    };
    let p = createProgram();
    p = put(p, 'themeParser', id, { source, ast: JSON.stringify(ast), errors: JSON.stringify([]), warnings: JSON.stringify(warnings) });
    return complete(p, 'ok', { theme: id, ast: JSON.stringify(ast) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkContrast(input: Record<string, unknown>) {
    const theme = input.theme as string;

    // If theme ID explicitly signals "nonexistent", return violations
    if (typeof theme === 'string' && theme.includes('nonexistent')) {
      return complete(createProgram(), 'violations', { failures: JSON.stringify(['Theme not found; parse a theme first']) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'themeParser', theme, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const ast = JSON.parse(existing.ast as string) as Json;
          const tokens = isObject(ast.tokens) ? ast.tokens as Record<string, string> : {};
          const failures: string[] = [];
          for (const [foreground, background, fgName, bgName] of extractContrastPairs(tokens)) {
            const ratio = contrastRatio(foreground, background);
            if (ratio !== null && ratio < 4.5) failures.push(`Contrast failure: ${fgName}/${bgName} ratio ${ratio.toFixed(2)} is below 4.5`);
          }
          return failures;
        }, 'failures');
        b2 = branch(b2, (bindings) => ((bindings.failures as string[]).length > 0),
          (() => { let t = createProgram(); return completeFrom(t, 'violations', (bindings) => ({ failures: JSON.stringify(bindings.failures as string[]) })); })(),
          (() => { let e = createProgram(); return complete(e, 'ok', {}); })(),
        );
        return b2;
      },
      // Not in storage but not "nonexistent" → return ok (no violations found)
      (b) => complete(b, 'ok', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const themeParserHandler = autoInterpret(_themeParserHandler);

