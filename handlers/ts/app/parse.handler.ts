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
  createProgram, find, get, put, branch, complete, completeFrom,
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

const parseHandler: FunctionalConceptHandler = {

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
        let b2 = put(b, 'byLanguage', language, id);
        b2 = put(b2, 'providers', id, { id, provider, language, config });
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const language = input.language != null ? String(input.language) : '';
    const text     = input.text     != null ? String(input.text)     : '';

    // Look up the registered provider id for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'providerId');
    return branch(p,
      (b) => b.providerId != null,
      (b) => {
        // Provider found — produce a portable AST encoding.
        // Real dispatch to the provider implementation happens at runtime
        // via PluginRegistry; the handler layer returns a stable serialisation.
        const ast = Buffer.from(JSON.stringify({ language, text })).toString('base64');
        return complete(b, 'ok', { ast }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'no_provider', { language }) as StorageProgram<Result>,
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

  concept() {
    return 'Parse';
  },
};

export const handler = autoInterpret(parseHandler);
export default handler;
