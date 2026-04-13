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
import { getHighlightProvider } from '../providers/highlight-provider-registry.ts';

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
        b2 = put(b2, 'byLanguage', language, { id, provider, config });
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

    // Look up the registered provider record for this language
    let p = createProgram();
    p = get(p, 'byLanguage', language, 'providerRec');
    return branch(p,
      (b) => !b.providerRec,
      (b) => complete(b, 'no_provider', { language }) as StorageProgram<Result>,
      (b) => {
        // Provider exists — dispatch through the module-level provider
        // registry (shared with LE-12 katex-highlight). If no implementation
        // is registered under the provider name, fall back to a valid empty
        // annotation list so renderers always receive well-formed bytes.
        const rec = (b.providerRec ?? {}) as { id?: string; provider?: string; config?: string } | string;
        const providerName = typeof rec === 'string' ? '' : (rec.provider ?? '');
        const providerId = typeof rec === 'string' ? rec : (rec.id ?? '');
        const providerConfig = typeof rec === 'string' ? undefined : rec.config;
        const fn = providerName ? getHighlightProvider(providerName) : undefined;
        let annotations: string;
        try {
          if (fn) {
            annotations = fn(text, language, providerConfig);
          } else {
            annotations = JSON.stringify({
              providerId, language, textLength: text.length, annotations: [],
            });
          }
        } catch (err: any) {
          return complete(b, 'error', {
            message: err?.message ?? 'provider dispatch failed',
          }) as StorageProgram<Result>;
        }
        // Detect structured error envelope from the provider.
        try {
          const parsed = JSON.parse(annotations);
          if (parsed && parsed.ok === false && parsed.error) {
            return complete(b, 'error', {
              message: String(parsed.error?.message ?? 'provider error'),
            }) as StorageProgram<Result>;
          }
        } catch {
          // Non-JSON is still valid Bytes — pass through as-is.
        }
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
