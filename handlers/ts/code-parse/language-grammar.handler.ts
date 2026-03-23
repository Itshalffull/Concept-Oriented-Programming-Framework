// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// LanguageGrammar Handler
//
// Grammar registration and resolution. Each grammar maps file
// extensions to a Tree-sitter WASM parser. Provider plugins
// call register() to make their grammar available.
//
// See design doc Section 4.1 (LanguageGrammar).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let grammarCounter = 0;

function nextGrammarId(): string {
  return `grammar-${++grammarCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    const extensions = input.extensions as string;
    const parserWasmPath = input.parserWasmPath as string;
    const nodeTypes = (input.nodeTypes as string) ?? '{}';
    const mimeTypes = (input.mimeTypes as string) ?? '[]';

    // Check for duplicate name
    p = find(p, 'grammar', { name }, 'existing');
    p = branch(p,
      (bindings) => {
        const existing = bindings.existing as unknown[];
        return existing.length > 0;
      },
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Array<Record<string, unknown>>;
          return { grammar: existing[0].id };
        });
      },
      (b) => {
        const id = nextGrammarId();
        let b2 = put(b, 'grammar', id, {
          id,
          name,
          extensions,
          parserWasmPath,
          nodeTypes,
          mimeTypes,
        });

        // Register extension → grammar mappings for fast resolution
        const extList: string[] = JSON.parse(extensions);
        for (const ext of extList) {
          b2 = put(b2, 'ext_map', ext, { grammarId: id });
        }

        // Register MIME type → grammar mappings
        let mimeList: string[] = JSON.parse(mimeTypes);
        // Auto-add text/<name> if no mime types provided
        if (mimeList.length === 0) {
          mimeList = [`text/${name}`];
        }
        for (const mime of mimeList) {
          b2 = put(b2, 'mime_map', mime, { grammarId: id });
        }

        return complete(b2, 'ok', { grammar: id });
      },
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    let p = createProgram();
    const fileExtension = input.fileExtension as string;
    p = get(p, 'ext_map', fileExtension, 'mapping');
    p = branch(p, 'mapping',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const mapping = bindings.mapping as Record<string, unknown>;
          return { grammar: mapping.grammarId as string };
        });
      },
      (b) => complete(b, 'noGrammar', { extension: fileExtension }),
    );
    return p as StorageProgram<Result>;
  },

  resolveByMime(input: Record<string, unknown>) {
    let p = createProgram();
    const mimeType = input.mimeType as string;
    p = get(p, 'mime_map', mimeType, 'mapping');
    p = branch(p, 'mapping',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const mapping = bindings.mapping as Record<string, unknown>;
          return { grammar: mapping.grammarId as string };
        });
      },
      (b) => complete(b, 'noGrammar', { mimeType }),
    );
    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const grammarId = input.grammar as string;
    p = get(p, 'grammar', grammarId, 'data');
    p = branch(p, 'data',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.data as Record<string, unknown>;
          return {
            grammar: grammarId,
            name: data.name as string,
            extensions: data.extensions as string,
            parserWasmPath: data.parserWasmPath as string,
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `Grammar ${grammarId} not found` }),
    );
    return p as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'grammar', {} as Record<string, unknown>, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Array<Record<string, unknown>>;
      const grammars = all.map((g) => ({
        id: g.id,
        name: g.name,
        extensions: g.extensions,
        parserWasmPath: g.parserWasmPath,
      }));
      return { grammars: JSON.stringify(grammars) };
    }) as StorageProgram<Result>;
  },
};

export const languageGrammarHandler = autoInterpret(_handler);
