// @clef-handler style=functional
// ============================================================
// ThemeEntity Concept Implementation (Functional)
//
// Queryable representation of a parsed theme spec — token
// hierarchy, palette, typography, motion, elevation as a
// traversable structure. Independent concept — widget impact
// analysis populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const themeEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;
    const id = crypto.randomUUID();
    const key = `theme:${name}`;
    const parsed = ast ? JSON.parse(ast) : {};

    let p = createProgram();
    p = get(p, 'theme', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'alreadyRegistered', { existing: key }),
      complete(
        put(createProgram(), 'theme', key, {
          id, name,
          symbol: `clef/theme/${name}`,
          sourceFile: source,
          purposeText: parsed.purpose || '',
          extendsTheme: parsed.extends || '',
          paletteColors: JSON.stringify(parsed.palette || []),
          colorRoles: JSON.stringify(parsed.colorRoles || []),
          typographyStyles: JSON.stringify(parsed.typography || []),
          motionCurves: JSON.stringify(parsed.motion || []),
          elevationLevels: JSON.stringify(parsed.elevation || []),
          spacingUnit: parsed.spacingUnit || '',
          radiusValues: JSON.stringify(parsed.radius || []),
          // Populated by syncs from ThemeImplementationEntity
          generatedOutputsCache: '[]',
        }),
        'ok', { entity: id },
      ),
    );
  },

  get(input) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'theme', `theme:${name}`, 'existing');

    return branch(p,
      (b) => b.existing != null,
      completeFrom(createProgram(), 'ok', (b) => ({
        entity: (b.existing as Record<string, unknown>).id,
      })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  resolveToken(input) {
    const themeId = input.theme as string;
    const tokenPath = input.tokenPath as string;

    let p = createProgram();
    p = find(p, 'theme', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const chain: string[] = [];
      let currentTheme = all.find(t => t.id === themeId) || null;
      let resolved: string | null = null;

      while (currentTheme) {
        chain.push(currentTheme.name as string);
        const categories = ['paletteColors', 'colorRoles', 'typographyStyles',
          'motionCurves', 'elevationLevels', 'radiusValues'];

        for (const cat of categories) {
          const tokens: Array<{ path?: string; name?: string; value?: unknown }> =
            JSON.parse(currentTheme[cat] as string || '[]');
          const found = tokens.find(t => t.path === tokenPath || t.name === tokenPath);
          if (found) { resolved = JSON.stringify(found.value || found); break; }
        }
        if (resolved) break;

        const extendsName = currentTheme.extendsTheme as string;
        if (!extendsName) break;
        currentTheme = all.find(t => t.name === extendsName) || null;
      }

      return { resolved, chain, tokenPath };
    }, 'resolution');

    return branch(p,
      (b) => (b.resolution as Record<string, unknown>).resolved != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const r = b.resolution as Record<string, unknown>;
        return { resolvedValue: r.resolved, resolutionChain: JSON.stringify(r.chain) };
      }),
      pureFrom(createProgram(), (b) => ({
        variant: 'notfound',
        tokenPath: (b.resolution as Record<string, unknown>).tokenPath,
      })),
    );
  },

  contrastAudit(input) {
    const themeId = input.theme as string;

    let p = createProgram();
    p = find(p, 'theme', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(t => t.id === themeId);
      if (!entry) return { allPassing: false, results: [] };

      const colorRoles: Array<Record<string, unknown>> =
        JSON.parse(entry.colorRoles as string || '[]');
      const results = colorRoles.map(role => ({
        rolePair: `${role.name || 'unknown'}/background`,
        ratio: 0, passes: false,
      }));

      return { allPassing: results.every(r => r.passes), results };
    }, 'audit');

    return completeFrom(p, 'ok', (b) => {
      const a = b.audit as Record<string, unknown>;
      return {
        allPassing: String(a.allPassing),
        results: JSON.stringify(a.results),
      };
    });
  },

  diffThemes(input) {
    const aId = input.a as string;
    const bId = input.b as string;

    let p = createProgram();
    p = find(p, 'theme', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const a = all.find(t => t.id === aId);
      const bEntry = all.find(t => t.id === bId);
      if (!a || !bEntry) return [];

      const tokenFields = ['paletteColors', 'colorRoles', 'typographyStyles',
        'motionCurves', 'elevationLevels', 'radiusValues'];
      const diffs: Array<Record<string, unknown>> = [];
      for (const f of tokenFields) {
        const aVal = a[f] as string || '[]';
        const bVal = bEntry[f] as string || '[]';
        if (aVal !== bVal) diffs.push({ token: f, aValue: aVal, bValue: bVal });
      }
      return diffs;
    }, 'differences');

    return branch(p,
      (b) => (b.differences as unknown[]).length === 0,
      complete(createProgram(), 'same', {}),
      completeFrom(createProgram(), 'ok', (b) => ({
        differences: JSON.stringify(b.differences),
      })),
    );
  },

  affectedWidgets(input) {
    // Cross-concept query — populated by syncs, returns own cache
    return completeFrom(createProgram(), 'ok', () => ({ widgets: '[]' }));
  },

  generatedOutputs(input) {
    const themeId = input.theme as string;

    let p = createProgram();
    p = find(p, 'theme', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(t => t.id === themeId);
      return entry ? (entry.generatedOutputsCache as string || '[]') : '[]';
    }, 'outputs');

    return completeFrom(p, 'ok', (b) => ({ outputs: b.outputs }));
  },
};
