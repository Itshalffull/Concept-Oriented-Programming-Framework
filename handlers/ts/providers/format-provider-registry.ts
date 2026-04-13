// Shared module-level registry for Format providers keyed by provider id.
//
// Each Format provider (prettier, micromark-format, etc.) registers a
// text->Patch function here at import/boot time. The Format concept
// handler dispatches through this registry when handling format actions,
// keeping concept state (the byLanguage/providers relations) independent
// from the concrete formatter implementations.
//
// Contract:
//   - Input: raw source text, optional config bytes (provider-defined;
//     for prettier this is the parser name, for micromark-format it is
//     an optional JSON `{ from?, to? }` options object).
//   - Output: JSON-encoded EditOp[] as Bytes (UTF-8 string). The EditOp
//     shape matches handlers/ts/patch.handler.ts so the output is
//     directly consumable by Patch/create effect bytes.
//   - On format error: providers MAY throw; the Format handler / sync
//     dispatch is responsible for translating thrown errors to the
//     concept's format -> error variant.

export type FormatProviderFn = (text: string, config?: string) => string;

const registry = new Map<string, FormatProviderFn>();

export function registerFormatProvider(id: string, fn: FormatProviderFn): void {
  registry.set(id, fn);
}

export function getFormatProvider(id: string): FormatProviderFn | undefined {
  return registry.get(id);
}

export function listFormatProviders(): string[] {
  return [...registry.keys()].sort();
}

export function clearFormatProviders(): void {
  registry.clear();
}
