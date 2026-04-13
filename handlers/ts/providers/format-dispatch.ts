// Format Provider Dispatch Registry
// ============================================================
// Runtime table of format-provider implementations keyed by provider
// name, used to turn a Format/format stub patch into a real serialized
// Patch via an actual formatter binary.
//
// Why this lives outside the handler:
//   The Format concept's format() action is described as a StorageProgram
//   that is synchronously assembled. Prettier 3's format() is async-only.
//   Rather than make the entire handler action async (and break the
//   StorageProgram contract / existing conformance surface), we keep the
//   handler's behaviour — look up which provider is registered for the
//   language and emit a marker patch — and provide this registry for the
//   async dispatch side-channel. Callers (the sync pipeline, CLI, or UI
//   invoking format) resolve the real patch by calling
//   `formatWithRegisteredProvider` after Format/format completes.
//
// The provider names registered here MUST match the `provider` field
// stored by Format/register (see syncs/app/register-prettier-format.sync).
// The `config` value stored by Format/register is passed through as the
// parser identifier (for prettier) or as provider-specific options JSON.

import { formatWithPrettier } from './prettier-format.provider.ts';

/**
 * Signature for an async format provider. Takes the text to format, the
 * language (Format concept `language`), and the registered `config`
 * Bytes (prettier parser name, or provider-specific JSON config).
 * Returns a serialized Patch (JSON EditOp[]) compatible with
 * handlers/ts/patch.handler.ts.
 */
export type FormatProviderFn = (
  text: string,
  language: string,
  config?: string,
) => Promise<string>;

const providers = new Map<string, FormatProviderFn>();

/** Register a named format provider. Overwrites any prior registration. */
export function registerFormatProvider(name: string, fn: FormatProviderFn): void {
  providers.set(name, fn);
}

/** Look up a registered format provider by name. */
export function getFormatProvider(name: string): FormatProviderFn | undefined {
  return providers.get(name);
}

/** Clear all registered providers. Useful for testing. */
export function resetFormatProviders(): void {
  providers.clear();
  installDefaultProviders();
}

/**
 * Resolve a real Patch for the given (language, providerName, config)
 * tuple by invoking the registered async provider. Callers pass the
 * values that were stored in the Format concept at register() time
 * (available via Format state query) alongside the text that was sent
 * to Format/format.
 *
 * @throws if no provider is registered under `providerName`, or if the
 *   provider itself throws (e.g. prettier on syntax error). Callers
 *   should translate these to the Format/format -> error variant.
 */
export async function formatWithRegisteredProvider(
  providerName: string,
  language: string,
  text: string,
  config?: string,
): Promise<string> {
  const fn = providers.get(providerName);
  if (!fn) {
    throw new Error(`No format provider registered under name '${providerName}'`);
  }
  return fn(text, language, config);
}

function installDefaultProviders(): void {
  // Prettier: the `config` Bytes field carries either a bare parser name
  // (backwards-compatible path used by the js/ts/json/css/html syncs) or a
  // JSON object { parser, plugins, ...prettierOptions }. The JSON form is
  // used by providers like prettier-plugin-solidity that require declaring
  // plugin module names on the call. See syncs/app/register-prettier-format.sync.
  registerFormatProvider('prettier', async (text, _language, config) => {
    if (!config || config.length === 0) {
      return formatWithPrettier(text, 'babel');
    }
    // Try JSON first — if it parses to an object, extract parser and forward
    // the remaining keys (plugins, tabWidth, etc.) as config.
    try {
      const parsed = JSON.parse(config);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const parser = typeof parsed.parser === 'string' && parsed.parser.length > 0
          ? parsed.parser
          : 'babel';
        return formatWithPrettier(text, parser, config);
      }
    } catch {
      // Fall through — treat as plain parser-name string.
    }
    return formatWithPrettier(text, config);
  });
}

installDefaultProviders();
