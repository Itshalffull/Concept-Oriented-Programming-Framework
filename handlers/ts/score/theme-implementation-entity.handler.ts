// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ThemeImplementationEntity Concept Implementation
//
// Queryable representation of generated theme implementation files.
// Covers CSS custom properties, React Native StyleSheet, DTCG JSON,
// and other platform-specific outputs generated from .theme specs.
// Links generated output back to ThemeEntity source and enables
// token resolution tracing from component styling to theme spec
// declarations.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    if (!input.theme || (typeof input.theme === 'string' && (input.theme as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'theme is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const theme = input.theme as string;
    const platform = input.platform as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `theme-impl:${theme}:${platform}`;
    p = get(p, 'theme-implementations', key, 'existing');

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    return branch(p,
      (bindings) => bindings.existing != null,
      (bp) => completeFrom(bp, 'ok', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>).id,
      })),
      (bp) => {
        let bp2 = put(bp, 'theme-implementations', key, {
          id,
          theme,
          platform,
          sourceFile,
          ast,
          symbol: `${theme}-${platform}`,
          tokenCount: parsedAst.tokenCount || 0,
          tokenPaths: JSON.stringify(parsedAst.tokenPaths || []),
          generatedFrom: parsedAst.generatedFrom || '',
          lastModified: new Date().toISOString(),
        });
        return complete(bp2, 'ok', { impl: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const theme = input.theme as string;
    const platform = input.platform as string;

    p = get(p, 'theme-implementations', `theme-impl:${theme}:${platform}`, 'entry');

    return branch(p,
      (bindings) => bindings.entry == null,
      (bp) => complete(bp, 'notfound', {}),
      (bp) => completeFrom(bp, 'ok', (bindings) => ({
        impl: (bindings.entry as Record<string, unknown>).id,
      })),
    ) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'theme-implementations', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const items = bindings.all as Record<string, unknown>[];
      const found = items.find(i => i.sourceFile === sourceFile);
      return found || null;
    }, 'entry');

    return branch(p,
      (bindings) => bindings.entry == null,
      (bp) => complete(bp, 'notfound', {}),
      (bp) => completeFrom(bp, 'ok', (bindings) => ({
        impl: (bindings.entry as Record<string, unknown>).id,
      })),
    ) as StorageProgram<Result>;
  },

  findByTheme(input: Record<string, unknown>) {
    if (!input.theme || (typeof input.theme === 'string' && (input.theme as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'theme is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const theme = input.theme as string;
    p = find(p, 'theme-implementations', { theme }, 'all');

    return completeFrom(p, 'ok', (bindings) => ({
      implementations: JSON.stringify(bindings.all),
    })) as StorageProgram<Result>;
  },

  findByPlatform(input: Record<string, unknown>) {
    let p = createProgram();
    const platform = input.platform as string;
    p = find(p, 'theme-implementations', { platform }, 'all');

    return completeFrom(p, 'ok', (bindings) => ({
      implementations: JSON.stringify(bindings.all),
    })) as StorageProgram<Result>;
  },

  resolveToken(input: Record<string, unknown>) {
    if (!input.tokenPath || (typeof input.tokenPath === 'string' && (input.tokenPath as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tokenPath is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const implId = input.impl as string;
    const tokenPath = input.tokenPath as string;

    p = find(p, 'theme-implementations', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const items = bindings.all as Record<string, unknown>[];
      const found = items.find(i => i.id === implId);
      return found || null;
    }, 'entry');

    return branch(p,
      (bindings) => bindings.entry == null,
      (bp) => complete(bp, 'notfound', { tokenPath }),
      (bp) => {
        const bp2 = mapBindings(bp, (bindings) => {
          const entry = bindings.entry as Record<string, unknown>;
          const tokenPaths = JSON.parse(entry.tokenPaths as string || '[]');
          const token = tokenPaths.find((t: { path: string }) => t.path === tokenPath);
          return token || null;
        }, 'token');

        return branch(bp2,
          (bindings) => bindings.token == null,
          (bp3) => complete(bp3, 'notfound', { tokenPath }),
          (bp3) => completeFrom(bp3, 'ok', (bindings) => {
            const token = bindings.token as Record<string, unknown>;
            return {
              resolvedValue: token.resolvedValue || '',
              specTokenPath: token.specPath || tokenPath,
              platformSyntax: token.platformSyntax || '',
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  diffFromSpec(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'theme-implementations', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const items = bindings.all as Record<string, unknown>[];
      const found = items.find(i => i.id === implId);
      return found || null;
    }, 'entry');

    // TODO: Compare generated implementation against theme spec
    // Currently always returns inSync regardless of whether entry is found
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },
};

export const themeImplementationEntityHandler = autoInterpret(_handler);
