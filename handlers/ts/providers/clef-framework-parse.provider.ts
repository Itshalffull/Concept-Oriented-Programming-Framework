// Clef framework Parse meta-provider.
//
// A single Parse provider id (`clef-framework-parse`) that dispatches to
// the correct Clef DSL framework parser based on the `language` slot
// passed through the Parse concept. Wrapping all five framework parsers
// behind one provider id means the Virtual Provider Registry manifest
// only needs five rows (one per language slot) pointing at the same
// provider — see docs/plans/virtual-provider-registry-prd.md §VPR-09
// and §3.3.
//
// Slot → underlying framework parser:
//   clef-concept → handlers/ts/framework/parser.ts               parseConceptFile
//   clef-sync    → handlers/ts/framework/sync-parser.ts          parseSyncFile
//   clef-widget  → handlers/ts/framework/widget-spec-parser.ts   parseWidgetFile
//   clef-theme   → handlers/ts/framework/theme-spec-parser.ts    parseThemeFile
//   clef-derived → handlers/ts/framework/derived-parser.ts       parseDerivedFile
//
// Output contract: returns a JSON-encoded AST as a UTF-8 string (Bytes).
// On parse error, returns a structured `{ ok: false, error }` envelope
// instead of throwing, matching the Parse provider contract documented
// in handlers/ts/providers/parse-provider-registry.ts.
//
// Manifest entry template (add to `.clef/providers.yaml` once VPR-04
// (ProviderManifest) ships):
//
//   parse:
//     - slot: clef-concept
//       provider: clef-framework-parse
//     - slot: clef-sync
//       provider: clef-framework-parse
//     - slot: clef-widget
//       provider: clef-framework-parse
//     - slot: clef-theme
//       provider: clef-framework-parse
//     - slot: clef-derived
//       provider: clef-framework-parse
//
// Each row produces one PluginRegistry/register which the generic
// RegisterParseProviderFromPluginRegistry sync translates into
// Parse/register(provider: "clef-framework-parse", language: <slot>).
// When Parse/parse fires for that language, the handler dispatches to
// this module via the shared provider registry.

import { parseConceptFile } from '../framework/parser.ts';
import { parseSyncFile } from '../framework/sync-parser.ts';
import { parseWidgetFile } from '../framework/widget-spec-parser.ts';
import { parseThemeFile } from '../framework/theme-spec-parser.ts';
import { parseDerivedFile } from '../framework/derived-parser.ts';
import { registerParseProvider } from '../app/parse.handler.ts';

export const PARSE_PROVIDER_ID = 'clef-framework-parse';

export type ClefDslLanguage =
  | 'clef-concept'
  | 'clef-sync'
  | 'clef-widget'
  | 'clef-theme'
  | 'clef-derived';

const DISPATCH: Record<ClefDslLanguage, (text: string) => unknown> = {
  'clef-concept': parseConceptFile,
  'clef-sync': parseSyncFile,
  'clef-widget': parseWidgetFile,
  'clef-theme': parseThemeFile,
  'clef-derived': parseDerivedFile,
};

interface ParseOkEnvelope {
  ok: true;
  language: ClefDslLanguage;
  provider: typeof PARSE_PROVIDER_ID;
  ast: unknown;
}

interface ParseErrorEnvelope {
  ok: false;
  provider: typeof PARSE_PROVIDER_ID;
  language: string;
  error: { message: string };
}

/**
 * Parse a Clef DSL source string. `language` selects the underlying
 * framework parser; `options` is reserved for future per-parser
 * configuration and is currently ignored by all five wrapped parsers.
 *
 * Returns a JSON string (Bytes). On failure, returns a JSON-encoded
 * `{ ok: false, error: { message } }` envelope rather than throwing.
 */
export function parseClefDSL(
  text: string,
  language: string,
  _options?: string,
): string {
  const parser = DISPATCH[language as ClefDslLanguage];
  if (!parser) {
    const env: ParseErrorEnvelope = {
      ok: false,
      provider: PARSE_PROVIDER_ID,
      language,
      error: {
        message:
          `clef-framework-parse: unsupported language slot "${language}". ` +
          `Expected one of: ${Object.keys(DISPATCH).join(', ')}.`,
      },
    };
    return JSON.stringify(env);
  }

  try {
    const ast = parser(text);
    const env: ParseOkEnvelope = {
      ok: true,
      language: language as ClefDslLanguage,
      provider: PARSE_PROVIDER_ID,
      ast,
    };
    return JSON.stringify(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const env: ParseErrorEnvelope = {
      ok: false,
      provider: PARSE_PROVIDER_ID,
      language,
      error: { message },
    };
    return JSON.stringify(env);
  }
}

// Self-register with the Parse handler's module-level provider registry.
// The Parse concept handler (handlers/ts/app/parse.handler.ts) re-exports
// the same registry used by handlers/ts/providers/parse-provider-registry.ts;
// importing this module once at boot is sufficient to make the provider
// discoverable by id.
//
// The Parse concept stores (provider, language) pairs in its state — on
// parse dispatch it invokes the provider function with (text, config).
// We thread the caller's language through by reading it from the config
// envelope when present; when Parse/parse supplies language out-of-band
// (the current concept shape), callers that need multi-language dispatch
// should pass language via the config Bytes as `{"language": "..."}`.
//
// Until the Parse concept threads `language` into the provider call
// directly, the recommended wiring is: one Parse/register per language
// slot, all pointing at this provider id, and the concept handler's
// dispatch includes the language in the config payload. Pattern-matching
// here on the config JSON keeps the provider stateless.
registerParseProvider(PARSE_PROVIDER_ID, (text, config) => {
  // Expect config to carry `{"language": "<slot>"}`. If absent, fall back
  // to treating the provider as an error envelope producer so callers
  // get a clear diagnostic rather than a silent mis-parse.
  let language = '';
  let options: string | undefined;
  if (config && config.length > 0) {
    try {
      const parsed = JSON.parse(config);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.language === 'string') language = parsed.language;
        if (typeof parsed.options === 'string') options = parsed.options;
      }
    } catch {
      // Malformed config — surface as error envelope below.
    }
  }
  return parseClefDSL(text, language, options);
});

export default parseClefDSL;
