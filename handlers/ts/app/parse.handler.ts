// @clef-handler style=functional
// Parse handler — functional StorageProgram style
// Dispatch text to language-specific parse providers that convert raw source
// text into abstract syntax tree bytes. Each language has exactly one
// registered provider; applications install providers for the languages they
// need and call parse to obtain a portable AST representation.
//
// See Architecture doc Section 2.5 (block-editor-loose-ends-prd §2.5).
//
// NOTE: The concept action `register` matches the handler lifecycle method name.
// The `register` method here implements the concept action. The conformance
// test generator detects this case and skips lifecycle introspection gracefully.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `parse-provider-${++idCounter}`;
}

/** Reset the ID counter (for testing). */
export function resetParseIds(): void {
  idCounter = 0;
}

// -------------------------------------------------------------------------
// Module-level provider registry
//
// The Parse concept's state records (provider: String, language: String)
// pairs, but the actual parser function lives in a provider module (e.g.,
// handlers/ts/providers/micromark-parse.provider.ts). Provider modules
// self-register their implementation function here as an import-time
// side-effect; Parse/parse looks up the function by the provider name
// stored in state and invokes it during completeFrom at interpret time.
//
// See docs/plans/block-editor-loose-ends-prd.md §LE-05 and
// specs/app/parse.concept.
// -------------------------------------------------------------------------

export type ParseProviderFn = (text: string, config?: string) => string;

const providerRegistry: Map<string, ParseProviderFn> = new Map();

/** Register a parse provider implementation by its registered id string. */
export function registerParseProvider(name: string, fn: ParseProviderFn): void {
  providerRegistry.set(name, fn);
}

/** Look up a registered parse provider implementation. */
export function getParseProvider(name: string): ParseProviderFn | undefined {
  return providerRegistry.get(name);
}

/** Clear the provider registry (for testing). */
export function clearParseProviders(): void {
  providerRegistry.clear();
}

export const parseHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const provider = input.provider != null ? String(input.provider) : '';
    const language = input.language != null ? String(input.language) : '';

    // Validate required non-empty fields
    if (!provider || provider.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'provider is required',
      }) as StorageProgram<Result>;
    }
    if (!language || language.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'language is required',
      }) as StorageProgram<Result>;
    }

    // Check for an existing provider registered for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { language }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        const config = input.config != null ? String(input.config) : '';
        let b2 = put(b, 'byLanguage', language, { id });
        b2 = put(b2, 'providers', id, { id, provider, language, config });
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const language = input.language != null ? String(input.language) : '';
    const text     = input.text     != null ? String(input.text)     : '';

    // Two-step lookup: byLanguage -> providers[id] to obtain the provider
    // name, then dispatch to the module-level provider registry. The
    // dispatch happens at interpret time via completeFrom so the program
    // remains pure data during construction.
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'byLangEntry');
    return branch(p,
      (b) => b.byLangEntry != null,
      (b) => {
        const entry = b.byLangEntry as { id?: string } | null;
        const id = entry?.id ?? '';
        let q = createProgram();
        q = get(q, 'providers', id, 'providerRec');
        return completeFrom(q, 'ok', (bindings) => {
          const rec = bindings.providerRec as
            | { provider?: string; config?: string }
            | null;
          const providerName = rec?.provider ?? '';
          const config = rec?.config ?? '';
          const fn = providerRegistry.get(providerName);
          if (fn == null) {
            // Provider registered in state but no implementation is loaded —
            // fall back to a stable placeholder encoding so callers still get
            // bytes back. This preserves the ok variant per the concept spec.
            const ast = Buffer.from(
              JSON.stringify({ language, text, provider: providerName, unbound: true }),
            ).toString('base64');
            return { variant: 'ok', ast };
          }
          try {
            const ast = fn(text, config);
            return { variant: 'ok', ast };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { variant: 'error', message };
          }
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'no_provider', { language }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const language = input.language != null ? String(input.language) : '';

    if (!language || language.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'language is required',
      }) as StorageProgram<Result>;
    }

    // Look up the index entry for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => {
        const entry = b.existing as { id?: string } | null;
        const id = entry?.id ?? String(b.existing);
        let b2 = del(b, 'byLanguage', language);
        b2 = del(b2, 'providers', id);
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'not_found', { language }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listLanguages(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'providers', {}, 'allProviders');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allProviders ?? []) as Array<Record<string, unknown>>;
      const languages = all
        .map((entry) => entry.language as string)
        .sort();
      return { variant: 'ok', languages };
    }) as StorageProgram<Result>;
  },

};

export const handler = autoInterpret(parseHandler);
export default handler;
