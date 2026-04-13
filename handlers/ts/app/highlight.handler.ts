// @clef-handler style=functional
// Highlight Concept Implementation
// Language-keyed provider registry that returns InlineAnnotation-shaped bytes
// for a given text span. Each provider is registered by language; highlight()
// dispatches to the registered provider and returns a serialized annotation
// list. Real provider dispatch happens via sync wiring; the stub here produces
// a well-formed empty annotation list so renderers get a valid payload.
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
  return `highlight-provider-${++idCounter}`;
}

const _highlightHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const provider = input.provider != null ? String(input.provider) : '';
    const language = input.language != null ? String(input.language) : '';
    const config   = input.config   != null ? String(input.config)   : '';

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
      (b) => complete(b, 'duplicate', { provider, language }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'definition', id, { id, provider, language, config });
        b2 = put(b2, 'byLanguage', language, id);
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  highlight(input: Record<string, unknown>) {
    const language = input.language != null ? String(input.language) : '';
    const text     = input.text     != null ? String(input.text)     : '';

    if (!language || language.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'language must be a non-empty string',
      }) as StorageProgram<Result>;
    }

    // Look up the registered provider id for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'providerId');
    return branch(p,
      (b) => !b.providerId,
      (b) => complete(b, 'no_provider', { language }) as StorageProgram<Result>,
      (b) => {
        // Provider exists — produce a stub annotation list. Real dispatch happens
        // via sync wiring to the actual highlighter binary. The list encodes
        // zero ranges so renderers display unstyled text until a real provider
        // plugs in the actual decoration spans.
        const annotations = JSON.stringify({
          providerId: b.providerId,
          language,
          textLength: text.length,
          annotations: [] as Array<{ range: { start: number; end: number }; kind: string; meta: string }>,
        });
        return complete(b, 'ok', { annotations }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  listLanguages(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'byLanguage', {}, 'allEntries');
    return completeFrom(p, 'ok', (b) => {
      const entries = (b.allEntries || []) as Array<{ key: string }>;
      const languages = entries.map((e) => e.key).sort();
      return { languages };
    }) as StorageProgram<Result>;
  },
};

export const highlightHandler = autoInterpret(_highlightHandler);
