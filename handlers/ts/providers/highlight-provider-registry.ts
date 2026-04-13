// Shared module-level registry for Highlight providers keyed by provider id.
//
// Each Highlight provider (shiki-highlight, katex-highlight, ...) registers a
// text->annotations function here at import/boot time. The Highlight concept
// handler dispatches through this registry when handling highlight actions,
// keeping concept state (the byLanguage/providers relations) independent from
// the concrete syntax-coloring implementations.
//
// Mirrors handlers/ts/providers/parse-provider-registry.ts (LE-05/07/08).
//
// Contract:
//   - Input: raw source text, language key, optional config bytes (UTF-8 string).
//   - Output: JSON-encoded annotations as Bytes (UTF-8 string). Each annotation
//     has shape { range: { start, end }, kind: string, meta: string }.
//   - On highlight failure: providers MUST NOT throw. They return a structured
//     error envelope `{ ok: false, error: { message } }` so the Highlight
//     handler can surface an `error` variant without a second pass.

export type HighlightProviderFn = (
  text: string,
  language: string,
  config?: string,
) => string;

const registry = new Map<string, HighlightProviderFn>();

export function registerHighlightProvider(id: string, fn: HighlightProviderFn): void {
  registry.set(id, fn);
}

export function getHighlightProvider(id: string): HighlightProviderFn | undefined {
  return registry.get(id);
}

export function listHighlightProviders(): string[] {
  return [...registry.keys()].sort();
}

export function clearHighlightProviders(): void {
  registry.clear();
}
