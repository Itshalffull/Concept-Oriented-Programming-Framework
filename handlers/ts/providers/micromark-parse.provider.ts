// Micromark-backed Parse provider.
//
// Implements the `micromark-parse` provider for language="markdown" as
// registered via the Parse concept (specs/app/parse.concept). See
// docs/plans/block-editor-loose-ends-prd.md §LE-05.
//
// Exposes parseMarkdown(text, config?) -> Bytes returning the micromark
// events array as JSON-encoded base64 bytes. The serialised form contains
// only the event tag (`enter`/`exit`), the token type, and token position
// ranges — micromark's raw tokenizer state is dropped because it contains
// functions and cyclic references.
//
// Registration with the module-level Parse provider registry happens as a
// side-effect of importing this module: see registerParseProvider()
// in handlers/ts/app/parse.handler.ts.
import { parse, postprocess, preprocess } from 'micromark';
import { registerParseProvider } from '../app/parse.handler.ts';
import githubCallout from './micromark-extension-github-callout.ts';
import mkdocsCallout from './micromark-extension-mkdocs-callout.ts';
import obsidianCallout from './micromark-extension-obsidian-callout.ts';

export interface MicromarkConfig {
  // Named extension modules to compose into the micromark parse call, e.g.
  //   { "extensions": ["micromark-extension-github-callout",
  //                    "micromark-extension-obsidian-callout"] }
  // Each name is dynamic-imported and its default export invoked to obtain
  // a micromark `Extension` object. See
  // docs/plans/virtual-provider-registry-prd.md §4.8.
  extensions?: string[];
  // Raw micromark extension objects (escape hatch — bypasses dynamic
  // import). Primarily used by tests and programmatic callers.
  rawExtensions?: unknown[];
  htmlExtensions?: unknown[];
}

// Module-relative registry of known micromark syntax extensions. Eagerly
// imported so `parseMarkdown` can remain synchronous while still honoring
// the `options.extensions: string[]` PRD §4.8 contract. New callout /
// syntax dialects add one entry here plus an `extensions:` entry in the
// provider manifest — no change to the Parse concept or smart-paste call
// sites.
const KNOWN_EXTENSIONS: Record<string, () => unknown> = {
  'micromark-extension-github-callout': githubCallout,
  'micromark-extension-mkdocs-callout': mkdocsCallout,
  'micromark-extension-obsidian-callout': obsidianCallout,
};

function resolveExtensions(names: string[]): unknown[] {
  const resolved: unknown[] = [];
  for (const name of names) {
    const factory = KNOWN_EXTENSIONS[name];
    if (!factory) continue; // Unknown names ignored per PRD §4.8 non-opt-in semantics.
    resolved.push(factory());
  }
  return resolved;
}

interface SerializablePoint {
  line: number;
  column: number;
  offset: number;
}

interface SerializableToken {
  type: string;
  start: SerializablePoint;
  end: SerializablePoint;
}

interface SerializableEvent {
  kind: 'enter' | 'exit';
  token: SerializableToken;
}

interface SerializableAst {
  language: 'markdown';
  provider: 'micromark-parse';
  events: SerializableEvent[];
}

function toPoint(p: { line: number; column: number; offset: number }): SerializablePoint {
  return { line: p.line, column: p.column, offset: p.offset };
}

/**
 * Parse markdown `text` with micromark and return the events array
 * as base64-encoded JSON bytes. `config` is an opaque Bytes payload;
 * when non-empty it is parsed as JSON and merged into the micromark
 * parse options.
 */
export function parseMarkdown(text: string, config?: string): string {
  let options: MicromarkConfig = {};
  if (config && config.length > 0) {
    try {
      const parsed = JSON.parse(config);
      if (parsed && typeof parsed === 'object') options = parsed as MicromarkConfig;
    } catch {
      // Ignore malformed config — fall back to defaults.
    }
  }

  const named = Array.isArray(options.extensions)
    ? resolveExtensions(options.extensions)
    : [];
  const raw = Array.isArray(options.rawExtensions) ? options.rawExtensions : [];
  const composed = [...named, ...raw];

  const parser = parse({
    extensions: composed.length > 0 ? (composed as never[]) : undefined,
  });
  const rawEvents = postprocess(
    parser.document().write(preprocess()(text, null, true)),
  );

  const events: SerializableEvent[] = [];
  for (const event of rawEvents) {
    const [kind, token] = event as unknown as [
      'enter' | 'exit',
      { type: string; start: SerializablePoint; end: SerializablePoint },
      unknown,
    ];
    events.push({
      kind,
      token: {
        type: token.type,
        start: toPoint(token.start),
        end: toPoint(token.end),
      },
    });
  }

  const ast: SerializableAst = {
    language: 'markdown',
    provider: 'micromark-parse',
    events,
  };

  return Buffer.from(JSON.stringify(ast)).toString('base64');
}

// Self-register with the Parse handler's module-level provider registry
// so that Parse/parse(language: "markdown", ...) can dispatch here once
// Parse/register has recorded the provider/language binding in state.
registerParseProvider('micromark-parse', (text, config) => parseMarkdown(text, config));

export default parseMarkdown;
