// Shared module-level registry for Parse providers keyed by provider id.
//
// Each Parse provider (katex-parse, micromark-parse, domparser-parse, etc.)
// registers a text->AST function here at import/boot time. The Parse
// concept handler dispatches through this registry when handling parse
// actions, keeping concept state (the byLanguage/providers relations)
// independent from the concrete parsing implementations.
//
// Contract:
//   - Input: raw source text, optional base64/UTF-8 config bytes.
//   - Output: JSON-encoded AST as Bytes (UTF-8 string).
//   - On parse error: providers MUST NOT throw. They return a structured
//     error envelope `{ ok: false, error: { message, markers? } }` so that
//     downstream consumers (e.g. katex highlight / LE-12) can surface
//     markers without needing a second pass.

export type ParseProviderFn = (text: string, config?: string) => string;

const registry = new Map<string, ParseProviderFn>();

export function registerParseProvider(id: string, fn: ParseProviderFn): void {
  registry.set(id, fn);
}

export function getParseProvider(id: string): ParseProviderFn | undefined {
  return registry.get(id);
}

export function listParseProviders(): string[] {
  return [...registry.keys()].sort();
}

export function clearParseProviders(): void {
  registry.clear();
}
