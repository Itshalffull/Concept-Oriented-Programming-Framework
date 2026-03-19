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
    let p = createProgram();
    const name = input.name as string;
    const extensions = input.extensions as string;
    const parserWasmPath = input.parserWasmPath as string;
    const nodeTypes = (input.nodeTypes as string) ?? '{}';
    const mimeTypes = (input.mimeTypes as string) ?? '[]';

    // Check for duplicate name
    p = find(p, 'grammar', { name }, 'existing');
    if (existing.length > 0) {
      return complete(p, 'alreadyRegistered', { existing: existing[0].id }) as StorageProgram<Result>;
    }

    const id = nextGrammarId();
    p = put(p, 'grammar', id, {
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
      p = put(p, 'ext_map', ext, { grammarId: id });
    }

    // Register MIME type → grammar mappings
    const mimeList: string[] = JSON.parse(mimeTypes);
    for (const mime of mimeList) {
      p = put(p, 'mime_map', mime, { grammarId: id });
    }

    return complete(p, 'ok', { grammar: id }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    let p = createProgram();
    const fileExtension = input.fileExtension as string;
    p = get(p, 'ext_map', fileExtension, 'mapping');
    if (!mapping) {
      return complete(p, 'noGrammar', { extension: fileExtension }) as StorageProgram<Result>;
    }
    return complete(p, 'ok', { grammar: mapping.grammarId as string }) as StorageProgram<Result>;
  },

  resolveByMime(input: Record<string, unknown>) {
    let p = createProgram();
    const mimeType = input.mimeType as string;
    p = get(p, 'mime_map', mimeType, 'mapping');
    if (!mapping) {
      return complete(p, 'noGrammar', { mimeType }) as StorageProgram<Result>;
    }
    return complete(p, 'ok', { grammar: mapping.grammarId as string }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const grammarId = input.grammar as string;
    p = get(p, 'grammar', grammarId, 'data');
    if (!data) {
      return complete(p, 'notfound', { message: `Grammar ${grammarId} not found` }) as StorageProgram<Result>;
    }
    return complete(p, 'ok', {
      grammar: grammarId,
      name: data.name as string,
      extensions: data.extensions as string,
      parserWasmPath: data.parserWasmPath as string,
    }) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'grammar', 'all');
    const grammars = all.map((g) => ({
      id: g.id,
      name: g.name,
      extensions: g.extensions,
      parserWasmPath: g.parserWasmPath,
    }));
    return complete(p, 'ok', { grammars: JSON.stringify(grammars) }) as StorageProgram<Result>;
  },
};

export const languageGrammarHandler = autoInterpret(_handler);
