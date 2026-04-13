// Clef DSL Highlight Provider (VPR-10)
//
// Meta-provider that emits syntax-coloring annotations for the 5 Clef
// framework DSLs (.concept, .sync, .derived, .widget, .theme) by walking
// the AST produced by the matching framework parser for structural
// validation and re-scanning the source text with a lightweight tokenizer
// for precise token ranges.
//
// The parsers (handlers/ts/framework/parser.ts, sync-parser.ts,
// derived-parser.ts and the widget/theme parser handlers) tokenize
// internally but do not preserve byte offsets on AST nodes, so we can't
// rely on the AST alone for `{start, end}` annotation spans. The parser
// is invoked purely to confirm the input is a well-formed DSL of the
// declared language; precise ranges come from the re-tokenizer below.
//
// Output shape matches shiki-highlight.provider.ts so downstream widgets
// consume both uniformly:
//
//   { annotations: [ { start, end, kind, scope, color } ... ] }
//
// Token kinds: keyword | identifier | string | number | operator |
// comment | type | attribute.
//
// Scope strings follow TextMate conventions so theme mapping is shared
// with shiki output, e.g.:
//   - "keyword.control.clef.<lang>"
//   - "string.quoted.clef"
//   - "constant.numeric.clef"
//   - "comment.line.clef"
//   - "entity.name.type.clef"
//   - "variable.other.clef"
//   - "keyword.operator.clef"
//   - "entity.other.attribute-name.clef"
//
// Registers under the provider id "clef-dsl-highlight".

import {
  registerHighlightProvider,
  type HighlightProviderFn,
} from './highlight-provider-registry.ts';
import { parseConceptFile } from '../framework/parser.ts';
import { parseSyncFile } from '../framework/sync-parser.ts';
import { parseDerivedFile } from '../framework/derived-parser.ts';

type TokenKind =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'comment'
  | 'type'
  | 'attribute';

type Annotation = {
  start: number;
  end: number;
  kind: TokenKind;
  scope: string;
  color?: string;
};

type ClefLanguage =
  | 'clef-concept'
  | 'clef-sync'
  | 'clef-derived'
  | 'clef-widget'
  | 'clef-theme';

const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set<ClefLanguage>([
  'clef-concept',
  'clef-sync',
  'clef-derived',
  'clef-widget',
  'clef-theme',
]);

// --- Keyword inventories ---
// These mirror the KEYWORDS sets in the matching parsers. When the parsers
// add new keywords, extend these sets to keep highlight coverage in sync.

const KEYWORDS_CONCEPT = new Set([
  'concept', 'purpose', 'state', 'actions', 'action',
  'invariant', 'capabilities', 'requires', 'after',
  'then', 'and', 'when', 'in', 'none',
  'example', 'forall', 'always', 'never', 'eventually',
  'given', 'exists', 'ensures', 'not', 'old', 'where',
  'fixture',
]);

const KEYWORDS_SYNC = new Set([
  'sync', 'when', 'where', 'then', 'bind', 'filter',
  'query', 'not',
]);

const KEYWORDS_DERIVED = new Set([
  'derived', 'purpose', 'composes', 'uses', 'syncs', 'surface',
  'action', 'query', 'principle', 'matches', 'required',
  'recommended', 'after', 'then', 'and', 'entry', 'triggers',
  'reads', 'on',
]);

const KEYWORDS_WIDGET = new Set([
  'widget', 'anatomy', 'state', 'states', 'transitions', 'on',
  'entry', 'exit', 'guard', 'a11y', 'role', 'keyboard',
  'focus', 'affordance', 'props', 'connect', 'compose',
  'invariant', 'part', 'parts', 'slot', 'slots',
  'purpose', 'when', 'then',
]);

const KEYWORDS_THEME = new Set([
  'theme', 'extends', 'palette', 'typography', 'spacing',
  'motion', 'elevation', 'radius', 'fonts', 'weights',
  'ratio', 'reduced-motion', 'scale', 'tokens', 'purpose',
]);

const CONTEXTUAL_TYPE_KEYWORDS = new Set(['set', 'list', 'option']);

const PRIMITIVE_TYPES = new Set([
  'String', 'Int', 'Float', 'Bool', 'Bytes', 'DateTime', 'ID',
]);

function keywordsFor(language: ClefLanguage): ReadonlySet<string> {
  switch (language) {
    case 'clef-concept': return KEYWORDS_CONCEPT;
    case 'clef-sync': return KEYWORDS_SYNC;
    case 'clef-derived': return KEYWORDS_DERIVED;
    case 'clef-widget': return KEYWORDS_WIDGET;
    case 'clef-theme': return KEYWORDS_THEME;
  }
}

function scopeForLang(language: ClefLanguage, suffix: string): string {
  // language already encodes the "clef-<dialect>" TextMate segment.
  return `${suffix}.${language}`;
}

/**
 * Re-scan `text` and emit precise `{start, end, kind, scope}` annotations.
 * The tokenizer recognises: `#` line comments, double-quoted strings,
 * numeric literals, identifiers (split into keyword / type / attribute /
 * identifier), and single-char punctuation treated as `operator`.
 */
function tokenize(text: string, language: ClefLanguage): Annotation[] {
  const keywords = keywordsFor(language);
  const annotations: Annotation[] = [];
  const len = text.length;
  let i = 0;

  const isIdentStart = (c: string) =>
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  const isIdentCont = (c: string) =>
    isIdentStart(c) || (c >= '0' && c <= '9') || c === '-';
  const isDigit = (c: string) => c >= '0' && c <= '9';

  // A punctuation character is treated as an operator when it's one of the
  // DSL's structural / operator characters. Braces/brackets/parens count
  // since themes often colour them.
  const OP_CHARS = '{}[]():,.|@=<>!&$-+*/?';

  while (i < len) {
    const c = text[i];

    // Whitespace
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }

    // Line comment: `#` to end of line.
    if (c === '#') {
      const start = i;
      while (i < len && text[i] !== '\n') i++;
      annotations.push({
        start,
        end: i,
        kind: 'comment',
        scope: scopeForLang(language, 'comment.line.number-sign'),
      });
      continue;
    }

    // Double-quoted string with `\` escapes.
    if (c === '"') {
      const start = i;
      i++;
      while (i < len) {
        const d = text[i];
        if (d === '\\' && i + 1 < len) { i += 2; continue; }
        if (d === '"') { i++; break; }
        if (d === '\n') break;
        i++;
      }
      annotations.push({
        start,
        end: i,
        kind: 'string',
        scope: scopeForLang(language, 'string.quoted.double'),
      });
      continue;
    }

    // Number (int / float, optional leading minus handled as operator).
    if (isDigit(c)) {
      const start = i;
      while (i < len && isDigit(text[i])) i++;
      if (i < len && text[i] === '.' && i + 1 < len && isDigit(text[i + 1])) {
        i++;
        while (i < len && isDigit(text[i])) i++;
      }
      annotations.push({
        start,
        end: i,
        kind: 'number',
        scope: scopeForLang(language, 'constant.numeric'),
      });
      continue;
    }

    // Identifier — later classified as keyword / type / attribute / ident.
    if (isIdentStart(c)) {
      const start = i;
      while (i < len && isIdentCont(text[i])) i++;
      const word = text.slice(start, i);

      let kind: TokenKind;
      let scope: string;
      if (keywords.has(word) || CONTEXTUAL_TYPE_KEYWORDS.has(word)) {
        kind = 'keyword';
        scope = scopeForLang(language, `keyword.control.${word}`);
      } else if (PRIMITIVE_TYPES.has(word)) {
        kind = 'type';
        scope = scopeForLang(language, 'support.type.primitive');
      } else if (/^[A-Z]/.test(word)) {
        // Conventionally PascalCase identifiers are concept / type names.
        kind = 'type';
        scope = scopeForLang(language, 'entity.name.type');
      } else if (text[i] === ':') {
        // Followed immediately by `:` — looks like a record/field attribute.
        kind = 'attribute';
        scope = scopeForLang(language, 'entity.other.attribute-name');
      } else {
        kind = 'identifier';
        scope = scopeForLang(language, 'variable.other');
      }
      annotations.push({ start, end: i, kind, scope });
      continue;
    }

    // Operator / punctuation.
    if (OP_CHARS.indexOf(c) >= 0) {
      const start = i;
      // Group a few common multi-char operators (->, =>, ==, !=, ..., <=, >=)
      if (
        (c === '-' || c === '=') && text[i + 1] === '>') { i += 2; }
      else if (c === '=' && text[i + 1] === '=') { i += 2; }
      else if (c === '!' && text[i + 1] === '=') { i += 2; }
      else if ((c === '<' || c === '>') && text[i + 1] === '=') { i += 2; }
      else if (c === '.' && text[i + 1] === '.' && text[i + 2] === '.') { i += 3; }
      else { i++; }
      annotations.push({
        start,
        end: i,
        kind: 'operator',
        scope: scopeForLang(language, 'keyword.operator'),
      });
      continue;
    }

    // Unknown — skip one char so we don't loop forever.
    i++;
  }

  return annotations;
}

/**
 * Invoke the matching framework parser for `language` purely to validate
 * structure. If the parser throws, we still emit annotations (highlighting
 * is best-effort), but we record a non-fatal `warning` in the envelope so
 * callers can surface a squiggle.
 */
function validateWithParser(
  text: string,
  language: ClefLanguage,
): string | null {
  try {
    switch (language) {
      case 'clef-concept': parseConceptFile(text); return null;
      case 'clef-sync': parseSyncFile(text); return null;
      case 'clef-derived': parseDerivedFile(text); return null;
      // The .widget and .theme parsers live as concept handlers and
      // operate on JSON-or-DSL text; for highlighting we skip structural
      // validation and rely entirely on the re-tokenizer.
      case 'clef-widget':
      case 'clef-theme':
        return null;
    }
  } catch (err: any) {
    return err?.message ?? String(err);
  }
}

/**
 * Highlight a Clef DSL source string. Returns a JSON-encoded annotation
 * envelope matching shiki-highlight.provider.ts shape.
 */
export function highlightClefDSL(
  text: string,
  language: string,
  _config?: string,
): string {
  if (!SUPPORTED_LANGUAGES.has(language)) {
    return JSON.stringify({
      ok: false,
      error: {
        message: `clef-dsl-highlight: unsupported language "${language}". ` +
          `Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`,
      },
    });
  }

  const lang = language as ClefLanguage;
  const warning = validateWithParser(text, lang);
  let annotations: Annotation[];
  try {
    annotations = tokenize(text, lang);
  } catch (err: any) {
    return JSON.stringify({
      ok: false,
      error: { message: err?.message ?? String(err) },
    });
  }

  const envelope: { annotations: Annotation[]; warning?: string } = {
    annotations,
  };
  if (warning) envelope.warning = warning;
  return JSON.stringify(envelope);
}

// Self-register under the provider id "clef-dsl-highlight" so the Highlight
// handler can dispatch here for any Clef DSL language registered against
// this provider via sync.
const providerFn: HighlightProviderFn = (text, language, config) =>
  highlightClefDSL(text, language, config);

registerHighlightProvider('clef-dsl-highlight', providerFn);
