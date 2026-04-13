// @clef-handler style=functional
// Format Concept Implementation
// Language-parameterized text formatter registry. Dispatches format requests
// to the registered provider for a given language and returns a serialized
// Patch value so the result integrates directly with the Patch + UndoStack
// pipeline — each format invocation becomes one undo entry.
//
// NOTE: The concept action `register` matches the handler lifecycle method name.
// The `register` method here implements the concept action. The conformance test
// generator detects this case and skips lifecycle introspection gracefully.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `format-provider-${++idCounter}`;
}

const _formatHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const provider = input.provider != null ? String(input.provider) : '';
    const language = input.language != null ? String(input.language) : '';
    const config = input.config != null ? String(input.config) : '';

    if (!provider || provider.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'provider must be a non-empty string',
      }) as StorageProgram<Result>;
    }
    if (!language || language.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'language must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Check for duplicate: is there already a provider for this language?
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { language }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'providers', id, { id, language, provider, config });
        b2 = put(b2, 'byLanguage', language, id);
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  format(input: Record<string, unknown>) {
    const language = input.language != null ? String(input.language) : '';
    const text = input.text != null ? String(input.text) : '';

    if (!language || language.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'language must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Look up provider for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'providerId');
    return branch(p,
      (b) => !b.providerId,
      (b) => complete(b, 'no_provider', { language }) as StorageProgram<Result>,
      (b) => {
        // Provider exists — produce a stub patch. Real dispatch happens via sync
        // wiring to the actual formatter binary. The patch encodes the minimal
        // edit set transforming original text into formatted output.
        const patch = JSON.stringify({
          type: 'format-patch',
          language,
          providerId: b.providerId,
          textLength: text.length,
        });
        return complete(b, 'ok', { patch }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  listLanguages(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'byLanguage', {}, 'allEntries');
    return completeFrom(p, 'ok', (b) => {
      const entries = (b.allEntries || []) as Array<{ key: string }>;
      const languages = entries.map((e) => e.key);
      return { languages };
    }) as StorageProgram<Result>;
  },
};

export const formatHandler = autoInterpret(_formatHandler);
