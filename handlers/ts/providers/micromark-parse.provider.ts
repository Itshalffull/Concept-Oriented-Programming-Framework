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

export interface MicromarkConfig {
  // Reserved for future knobs (extensions, etc.). Parsed from the config
  // Bytes string as JSON if non-empty.
  extensions?: unknown[];
  htmlExtensions?: unknown[];
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

  const parser = parse({
    extensions: (options.extensions as never[] | undefined) ?? undefined,
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
