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
    const name = input.name as string;
    const extensions = input.extensions as string;
    const parserWasmPath = input.parserWasmPath as string;
    const nodeTypes = (input.nodeTypes as string) ?? '{}';
    const mimeTypes = (input.mimeTypes as string) ?? '[]';

    // Check for duplicate name
    const existing = await storage.find('grammar', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id };
    }

    const id = nextGrammarId();
    await storage.put('grammar', id, {
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
      await storage.put('ext_map', ext, { grammarId: id });
    }

    // Register MIME type → grammar mappings
    const mimeList: string[] = JSON.parse(mimeTypes);
    for (const mime of mimeList) {
      await storage.put('mime_map', mime, { grammarId: id });
    }

    return { variant: 'ok', grammar: id };
  },

  resolve(input: Record<string, unknown>) {
    const fileExtension = input.fileExtension as string;
    const mapping = await storage.get('ext_map', fileExtension);
    if (!mapping) {
      return { variant: 'noGrammar', extension: fileExtension };
    }
    return { variant: 'ok', grammar: mapping.grammarId as string };
  },

  resolveByMime(input: Record<string, unknown>) {
    const mimeType = input.mimeType as string;
    const mapping = await storage.get('mime_map', mimeType);
    if (!mapping) {
      return { variant: 'noGrammar', mimeType };
    }
    return { variant: 'ok', grammar: mapping.grammarId as string };
  },

  get(input: Record<string, unknown>) {
    const grammarId = input.grammar as string;
    const data = await storage.get('grammar', grammarId);
    if (!data) {
      return { variant: 'notfound', message: `Grammar ${grammarId} not found` };
    }
    return {
      variant: 'ok',
      grammar: grammarId,
      name: data.name as string,
      extensions: data.extensions as string,
      parserWasmPath: data.parserWasmPath as string,
    };
  },

  list(_input: Record<string, unknown>) {
    const all = await storage.find('grammar');
    const grammars = all.map((g) => ({
      id: g.id,
      name: g.name,
      extensions: g.extensions,
      parserWasmPath: g.parserWasmPath,
    }));
    return { variant: 'ok', grammars: JSON.stringify(grammars) };
  },
};

export const languageGrammarHandler = autoInterpret(_handler);
