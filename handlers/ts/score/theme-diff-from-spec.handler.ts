// ThemeImplementationEntity diffFromSpec — Functional (Monadic) Implementation
//
// Compares a generated theme implementation against its theme spec to find
// drift: missing tokens, stale token values, extra tokens not in spec,
// extends-chain inheritance gaps, and spacing token coverage.
// Returns a StorageProgram for full traceability through the monadic
// analysis pipeline.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, branch, pure, pureFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

type Difference = {
  kind: 'missing_token' | 'stale_value' | 'extra_token' | 'missing_inherited_token';
  token: string;
  specValue: string;
  implValue: string;
};

export const themeDiffFromSpecHandler: FunctionalConceptHandler = {
  diffFromSpec(input) {
    const implId = input.impl as string;

    let p = createProgram();

    // Find the implementation
    p = find(p, 'theme-implementations', {}, 'allImpls');

    p = branch(
      p,
      (bindings) => {
        const impls = bindings.allImpls as Record<string, unknown>[];
        return !impls || !impls.find(i => i.id === implId);
      },
      pure(createProgram(), { variant: 'inSync' }),
      (() => {
        // Implementation found — look up the theme entity and all themes for extends
        let inner = createProgram();
        inner = find(inner, 'theme-entity', {}, 'allThemes');

        return pureFrom(inner, (bindings) => {
          const impls = bindings.allImpls as Record<string, unknown>[];
          const impl = impls.find(i => i.id === implId)!;
          const themeName = impl.theme as string;

          const themes = bindings.allThemes as Record<string, unknown>[];
          const themeEntity = themes?.find(t => t.name === themeName);

          if (!themeEntity) {
            return { variant: 'inSync' };
          }

          const differences: Difference[] = [];

          // Collect all spec tokens from the theme entity's stored fields
          const specTokens = new Map<string, string>();

          const addTokens = (raw: string, prefix: string) => {
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === 'object' && parsed !== null) {
                for (const [key, value] of Object.entries(parsed)) {
                  specTokens.set(`${prefix}.${key}`, String(value));
                }
              }
            } catch { /* skip unparseable */ }
          };

          addTokens(themeEntity.paletteColors as string || '{}', 'palette');
          addTokens(themeEntity.colorRoles as string || '{}', 'color');
          addTokens(themeEntity.typographyStyles as string || '{}', 'typography');
          addTokens(themeEntity.motionCurves as string || '{}', 'motion');
          addTokens(themeEntity.elevationLevels as string || '{}', 'elevation');
          addTokens(themeEntity.radiusValues as string || '{}', 'radius');
          addTokens(themeEntity.spacingValues as string || '{}', 'spacing');

          // --- Extends chain: collect inherited tokens from parent theme ---
          const inheritedTokens = new Map<string, string>();
          const extendsName = themeEntity.extendsTheme as string;
          if (extendsName) {
            const parentTheme = themes?.find(t => t.name === extendsName);
            if (parentTheme) {
              const addParentTokens = (raw: string, prefix: string) => {
                try {
                  const parsed = JSON.parse(raw);
                  if (typeof parsed === 'object' && parsed !== null) {
                    for (const [key, value] of Object.entries(parsed)) {
                      const path = `${prefix}.${key}`;
                      // Only inherit tokens that the child hasn't overridden
                      if (!specTokens.has(path)) {
                        inheritedTokens.set(path, String(value));
                      }
                    }
                  }
                } catch { /* skip */ }
              };

              addParentTokens(parentTheme.paletteColors as string || '{}', 'palette');
              addParentTokens(parentTheme.colorRoles as string || '{}', 'color');
              addParentTokens(parentTheme.typographyStyles as string || '{}', 'typography');
              addParentTokens(parentTheme.motionCurves as string || '{}', 'motion');
              addParentTokens(parentTheme.elevationLevels as string || '{}', 'elevation');
              addParentTokens(parentTheme.radiusValues as string || '{}', 'radius');
              addParentTokens(parentTheme.spacingValues as string || '{}', 'spacing');
            }
          }

          // Parse implementation's token paths
          const implTokens = new Map<string, string>();
          try {
            const tokenPaths: Array<{ path: string; resolvedValue?: string }> =
              JSON.parse(impl.tokenPaths as string || '[]');
            for (const token of tokenPaths) {
              implTokens.set(token.path, token.resolvedValue || '');
            }
          } catch { /* skip */ }

          // Missing tokens: in spec but not in impl
          for (const [path, specValue] of specTokens) {
            if (!implTokens.has(path)) {
              differences.push({
                kind: 'missing_token',
                token: path,
                specValue,
                implValue: '',
              });
            } else {
              // Check for stale values
              const implValue = implTokens.get(path)!;
              if (implValue && specValue && implValue !== specValue) {
                differences.push({
                  kind: 'stale_value',
                  token: path,
                  specValue,
                  implValue,
                });
              }
            }
          }

          // Missing inherited tokens: in parent spec but not in impl
          for (const [path, parentValue] of inheritedTokens) {
            if (!implTokens.has(path)) {
              differences.push({
                kind: 'missing_inherited_token',
                token: path,
                specValue: `inherited(${parentValue})`,
                implValue: '',
              });
            }
          }

          // Extra tokens: in impl but not in spec (or inherited)
          for (const [path, implValue] of implTokens) {
            if (!specTokens.has(path) && !inheritedTokens.has(path)) {
              differences.push({
                kind: 'extra_token',
                token: path,
                specValue: '',
                implValue,
              });
            }
          }

          if (differences.length === 0) {
            return { variant: 'inSync' };
          }

          return {
            variant: 'ok',
            differences: JSON.stringify(differences),
            missing_tokens: differences.filter(d => d.kind === 'missing_token').length,
            stale_values: differences.filter(d => d.kind === 'stale_value').length,
            extra_tokens: differences.filter(d => d.kind === 'extra_token').length,
            missing_inherited: differences.filter(d => d.kind === 'missing_inherited_token').length,
            total_differences: differences.length,
          };
        }) as StorageProgram<Result>;
      })(),
    );

    return p as StorageProgram<Result>;
  },
};
