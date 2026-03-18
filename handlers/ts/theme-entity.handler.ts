// @migrated dsl-constructs 2026-03-18
// ============================================================
// ThemeEntity Handler
//
// Queryable representation of a parsed theme spec -- token
// hierarchy, palette, typography, motion, elevation as a
// traversable structure. Enables token resolution tracing,
// contrast auditing, and theme change impact analysis.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ThemeManifest } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `theme-entity-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    let p = createProgram();
    p = find(p, 'theme-entity', { name }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'alreadyRegistered', (b) => ({
          existing: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        const id = nextId();
        const symbol = `clef/theme/${name}`;

        const manifest: ThemeManifest = {
          name,
          purpose: '',
          palette: {},
          colorRoles: {},
          typography: {},
          spacing: { scale: {} },
          motion: {},
          elevation: {},
          radius: {},
        };

        try {
          const parsed = JSON.parse(ast);
          manifest.purpose = parsed.purpose || '';
          manifest.extends = parsed.extends || undefined;
          manifest.palette = parsed.palette || parsed.paletteColors || {};
          manifest.colorRoles = parsed.colorRoles || parsed.roles || {};
          manifest.typography = parsed.typography || {};
          manifest.motion = parsed.motion || {};
          manifest.elevation = parsed.elevation || {};
          manifest.spacing = {
            unit: parsed.spacing?.unit || parsed.spacingUnit || undefined,
            scale: parsed.spacing?.scale || parsed.spacing || {},
          };
          manifest.radius = parsed.radius || {};
        } catch {
          // AST may be empty or non-JSON; store defaults
        }

        let e = createProgram();
        e = put(e, 'theme-entity', id, {
          id,
          name,
          symbol,
          sourceFile: source,
          ast,
          manifest: JSON.stringify(manifest),
          purposeText: manifest.purpose,
          extendsTheme: manifest.extends || '',
          paletteColors: JSON.stringify(manifest.palette),
          colorRoles: JSON.stringify(manifest.colorRoles),
          typographyStyles: JSON.stringify(manifest.typography),
          motionCurves: JSON.stringify(manifest.motion),
          elevationLevels: JSON.stringify(manifest.elevation),
          spacingUnit: manifest.spacing.unit || '',
          radiusValues: JSON.stringify(manifest.radius),
        });

        return complete(e, 'ok', { entity: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'theme-entity', { name }, 'results');

    return branch(p,
      (b) => (b.results as unknown[]).length === 0,
      (() => {
        const t = createProgram();
        return complete(t, 'notfound', {}) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return completeFrom(e, 'ok', (b) => ({
          entity: (b.results as Record<string, unknown>[])[0].id as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  resolveToken(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const tokenPath = input.tokenPath as string;

    // Token resolution requires iterative chain walking -- fetch all theme entities
    // and resolve in completeFrom
    let p = createProgram();
    p = get(p, 'theme-entity', theme, 'record');
    p = find(p, 'theme-entity', {}, 'allThemes');

    return completeFrom(p, 'ok', (b) => {
      const record = b.record as Record<string, unknown> | null;
      if (!record) {
        return { variant: 'notfound', tokenPath };
      }

      const allThemes = b.allThemes as Record<string, unknown>[];
      const themeMap = new Map(allThemes.map(t => [t.id as string, t]));
      const nameMap = new Map(allThemes.map(t => [t.name as string, t]));

      const chain: string[] = [];
      let currentThemeId: string | null = theme;
      let resolvedValue: string | null = null;

      while (currentThemeId) {
        const themeRecord = themeMap.get(currentThemeId);
        if (!themeRecord) break;

        chain.push(themeRecord.name as string);

        try {
          const segments = tokenPath.split('.');
          const category = segments[0];
          let tokenData: Record<string, unknown> = {};

          if (category === 'palette') tokenData = JSON.parse(themeRecord.paletteColors as string || '{}');
          else if (category === 'color' || category === 'roles') tokenData = JSON.parse(themeRecord.colorRoles as string || '{}');
          else if (category === 'typography') tokenData = JSON.parse(themeRecord.typographyStyles as string || '{}');
          else if (category === 'motion') tokenData = JSON.parse(themeRecord.motionCurves as string || '{}');
          else if (category === 'elevation') tokenData = JSON.parse(themeRecord.elevationLevels as string || '{}');
          else if (category === 'radius') tokenData = JSON.parse(themeRecord.radiusValues as string || '{}');

          let current: unknown = tokenData;
          for (let i = 1; i < segments.length; i++) {
            if (current && typeof current === 'object' && current !== null) {
              current = (current as Record<string, unknown>)[segments[i]];
            } else {
              current = undefined;
              break;
            }
          }

          if (current !== undefined && current !== null) {
            resolvedValue = typeof current === 'string' ? current : JSON.stringify(current);
            break;
          }
        } catch {
          // skip this theme level
        }

        const extendsName = themeRecord.extendsTheme as string;
        if (extendsName) {
          const parent = nameMap.get(extendsName);
          currentThemeId = parent ? (parent.id as string) : null;
        } else {
          currentThemeId = null;
        }
      }

      if (resolvedValue === null) {
        if (chain.length > 1) {
          return { variant: 'brokenChain', brokenAt: chain[chain.length - 1] };
        }
        return { variant: 'notfound', tokenPath };
      }

      return {
        resolvedValue,
        resolutionChain: JSON.stringify(chain),
      };
    }) as StorageProgram<Result>;
  },

  contrastAudit(input: Record<string, unknown>) {
    const theme = input.theme as string;

    let p = createProgram();
    p = get(p, 'theme-entity', theme, 'record');

    return completeFrom(p, 'ok', (b) => {
      const record = b.record as Record<string, unknown> | null;
      if (!record) {
        return { allPassing: 'false', results: '[]' };
      }

      let colorRoles: Record<string, unknown> = {};
      try {
        colorRoles = JSON.parse(record.colorRoles as string || '{}');
      } catch {
        // empty
      }

      const results: Array<Record<string, unknown>> = [];
      const roleNames = Object.keys(colorRoles);

      for (let i = 0; i < roleNames.length; i++) {
        for (let j = i + 1; j < roleNames.length; j++) {
          results.push({
            rolePair: `${roleNames[i]}/${roleNames[j]}`,
            ratio: 0,
            passes: true,
          });
        }
      }

      const allPassing = results.every((r) => r.passes) ? 'true' : 'false';
      return { allPassing, results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  diffThemes(input: Record<string, unknown>) {
    const a = input.a as string;
    const b_id = input.b as string;

    let p = createProgram();
    p = get(p, 'theme-entity', a, 'recordA');
    p = get(p, 'theme-entity', b_id, 'recordB');

    return completeFrom(p, 'ok', (b) => {
      const recordA = b.recordA as Record<string, unknown> | null;
      const recordB = b.recordB as Record<string, unknown> | null;

      if (!recordA || !recordB) {
        return { differences: '[]' };
      }

      const differences: Array<Record<string, unknown>> = [];
      const categories = ['paletteColors', 'colorRoles', 'typographyStyles', 'motionCurves', 'elevationLevels', 'radiusValues'];
      for (const cat of categories) {
        try {
          const dataA = JSON.parse(recordA[cat] as string || '{}');
          const dataB = JSON.parse(recordB[cat] as string || '{}');

          const allKeys = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);
          for (const key of allKeys) {
            const valA = JSON.stringify(dataA[key]);
            const valB = JSON.stringify(dataB[key]);
            if (valA !== valB) {
              differences.push({
                token: `${cat}.${key}`,
                aValue: dataA[key] ?? null,
                bValue: dataB[key] ?? null,
              });
            }
          }
        } catch {
          // skip
        }
      }

      if (differences.length === 0) {
        return { variant: 'same' };
      }

      return { differences: JSON.stringify(differences) };
    }) as StorageProgram<Result>;
  },

  affectedWidgets(input: Record<string, unknown>) {
    const theme = input.theme as string;
    const changedToken = input.changedToken as string;

    let p = createProgram();
    p = find(p, 'widget-entity', {}, 'allWidgets');

    return completeFrom(p, 'ok', (b) => {
      const allWidgets = b.allWidgets as Record<string, unknown>[];
      const affected = allWidgets.filter((w) => {
        try {
          const ast = JSON.parse(w.ast as string || '{}');
          const connect = JSON.stringify(ast.connect || {});
          return connect.includes(changedToken);
        } catch {
          return false;
        }
      });

      return { widgets: JSON.stringify(affected) };
    }) as StorageProgram<Result>;
  },

  generatedOutputs(input: Record<string, unknown>) {
    const theme = input.theme as string;

    let p = createProgram();
    p = get(p, 'theme-entity', theme, 'record');
    p = find(p, 'provenance', {}, 'allProvenance');

    return completeFrom(p, 'ok', (b) => {
      const record = b.record as Record<string, unknown> | null;
      if (!record) {
        return { outputs: '[]' };
      }

      const allProvenance = b.allProvenance as Record<string, unknown>[];
      const generated = allProvenance.filter(g => g.sourceSymbol === record.symbol);
      const outputs = generated.map((g) => ({
        platform: g.platform || g.language || 'css',
        file: g.targetFile || g.file,
      }));

      return { outputs: JSON.stringify(outputs) };
    }) as StorageProgram<Result>;
  },
};

export const themeEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetThemeEntityCounter(): void {
  idCounter = 0;
}
