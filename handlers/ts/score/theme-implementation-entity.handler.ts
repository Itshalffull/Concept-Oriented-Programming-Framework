// ThemeImplementationEntity Concept Implementation
//
// Queryable representation of generated theme implementation files.
// Covers CSS custom properties, React Native StyleSheet, DTCG JSON,
// and other platform-specific outputs generated from .theme specs.
// Links generated output back to ThemeEntity source and enables
// token resolution tracing from component styling to theme spec
// declarations.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const themeImplementationEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const theme = input.theme as string;
    const platform = input.platform as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `theme-impl:${theme}:${platform}`;
    const existing = await storage.get('theme-implementations', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    await storage.put('theme-implementations', key, {
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

    return { variant: 'ok', impl: id };
  },

  async get(input, storage) {
    const theme = input.theme as string;
    const platform = input.platform as string;

    const entry = await storage.get('theme-implementations', `theme-impl:${theme}:${platform}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', impl: entry.id };
  },

  async getByFile(input, storage) {
    const sourceFile = input.sourceFile as string;

    const all = await storage.find('theme-implementations');
    const entry = all.find(i => i.sourceFile === sourceFile);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', impl: entry.id };
  },

  async findByTheme(input, storage) {
    const theme = input.theme as string;
    const all = await storage.find('theme-implementations', { theme });

    return { variant: 'ok', implementations: JSON.stringify(all) };
  },

  async findByPlatform(input, storage) {
    const platform = input.platform as string;
    const all = await storage.find('theme-implementations', { platform });

    return { variant: 'ok', implementations: JSON.stringify(all) };
  },

  async resolveToken(input, storage) {
    const implId = input.impl as string;
    const tokenPath = input.tokenPath as string;

    const all = await storage.find('theme-implementations');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return { variant: 'notfound', tokenPath };
    }

    const tokenPaths = JSON.parse(entry.tokenPaths as string || '[]');
    const token = tokenPaths.find((t: { path: string }) => t.path === tokenPath);
    if (!token) {
      return { variant: 'notfound', tokenPath };
    }

    return {
      variant: 'ok',
      resolvedValue: token.resolvedValue || '',
      specTokenPath: token.specPath || tokenPath,
      platformSyntax: token.platformSyntax || '',
    };
  },

  async diffFromSpec(input, storage) {
    const implId = input.impl as string;

    const all = await storage.find('theme-implementations');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return { variant: 'inSync' };
    }

    // TODO: Compare generated implementation against theme spec
    return { variant: 'inSync' };
  },
};
