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
    let p = createProgram();
    const theme = input.theme as string;
    const platform = input.platform as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `theme-impl:${theme}:${platform}`;
    p = get(p, 'theme-implementations', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    p = put(p, 'theme-implementations', key, {
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

    return complete(p, 'ok', { impl: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const theme = input.theme as string;
    const platform = input.platform as string;

    p = get(p, 'theme-implementations', `theme-impl:${theme}:${platform}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { impl: entry.id }) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'theme-implementations', 'all');
    const entry = all.find(i => i.sourceFile === sourceFile);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { impl: entry.id }) as StorageProgram<Result>;
  },

  findByTheme(input: Record<string, unknown>) {
    let p = createProgram();
    const theme = input.theme as string;
    p = find(p, 'theme-implementations', { theme }, 'all');

    return complete(p, 'ok', { implementations: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findByPlatform(input: Record<string, unknown>) {
    let p = createProgram();
    const platform = input.platform as string;
    p = find(p, 'theme-implementations', { platform }, 'all');

    return complete(p, 'ok', { implementations: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  resolveToken(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;
    const tokenPath = input.tokenPath as string;

    p = find(p, 'theme-implementations', 'all');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return complete(p, 'notfound', { tokenPath }) as StorageProgram<Result>;
    }

    const tokenPaths = JSON.parse(entry.tokenPaths as string || '[]');
    const token = tokenPaths.find((t: { path: string }) => t.path === tokenPath);
    if (!token) {
      return complete(p, 'notfound', { tokenPath }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      resolvedValue: token.resolvedValue || '',
      specTokenPath: token.specPath || tokenPath,
      platformSyntax: token.platformSyntax || '',
    }) as StorageProgram<Result>;
  },

  diffFromSpec(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'theme-implementations', 'all');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return complete(p, 'inSync', {}) as StorageProgram<Result>;
    }

    // TODO: Compare generated implementation against theme spec
    return complete(p, 'inSync', {}) as StorageProgram<Result>;
  },
};

export const themeImplementationEntityHandler = autoInterpret(_handler);
