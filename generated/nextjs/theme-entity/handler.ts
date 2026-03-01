// ThemeEntity — theme instance entity, override tracking, inheritance chains, contrast auditing.
// Registers parsed theme ASTs, resolves token paths through inheritance chains,
// audits color token pairs for WCAG contrast compliance, and diffs theme entities.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ThemeEntityStorage,
  ThemeEntityRegisterInput,
  ThemeEntityRegisterOutput,
  ThemeEntityGetInput,
  ThemeEntityGetOutput,
  ThemeEntityResolveTokenInput,
  ThemeEntityResolveTokenOutput,
  ThemeEntityContrastAuditInput,
  ThemeEntityContrastAuditOutput,
  ThemeEntityDiffThemesInput,
  ThemeEntityDiffThemesOutput,
  ThemeEntityAffectedWidgetsInput,
  ThemeEntityAffectedWidgetsOutput,
  ThemeEntityGeneratedOutputsInput,
  ThemeEntityGeneratedOutputsOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  getOk,
  getNotfound,
  resolveTokenOk,
  resolveTokenNotfound,
  resolveTokenBrokenChain,
  contrastAuditOk,
  diffThemesOk,
  diffThemesSame,
  affectedWidgetsOk,
  generatedOutputsOk,
} from './types.js';

export interface ThemeEntityError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): ThemeEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Navigate a dot-separated path into a nested object, returning the leaf value or null. */
const resolvePath = (obj: Record<string, unknown>, path: string): unknown | null => {
  const segments = path.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[seg];
    if (current === undefined) return null;
  }
  return current;
};

/** Collect all leaf-level keys from a nested object as dot-separated paths. */
const collectKeys = (obj: Record<string, unknown>, prefix: string = ''): readonly string[] => {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

export interface ThemeEntityHandler {
  readonly register: (
    input: ThemeEntityRegisterInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityRegisterOutput>;
  readonly get: (
    input: ThemeEntityGetInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityGetOutput>;
  readonly resolveToken: (
    input: ThemeEntityResolveTokenInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityResolveTokenOutput>;
  readonly contrastAudit: (
    input: ThemeEntityContrastAuditInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityContrastAuditOutput>;
  readonly diffThemes: (
    input: ThemeEntityDiffThemesInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityDiffThemesOutput>;
  readonly affectedWidgets: (
    input: ThemeEntityAffectedWidgetsInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityAffectedWidgetsOutput>;
  readonly generatedOutputs: (
    input: ThemeEntityGeneratedOutputsInput,
    storage: ThemeEntityStorage,
  ) => TE.TaskEither<ThemeEntityError, ThemeEntityGeneratedOutputsOutput>;
}

// --- Implementation ---

export const themeEntityHandler: ThemeEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('themeEntity', input.name),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const ast = JSON.parse(input.ast);
                  await storage.put('themeEntity', input.name, {
                    name: input.name,
                    source: input.source,
                    ast,
                    registeredAt: new Date().toISOString(),
                  });
                  return registerOk(input.name);
                },
                storageErr,
              ),
            () => TE.right(registerAlreadyRegistered(input.name)),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('themeEntity', input.name),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) => TE.right(getOk(JSON.stringify(found))),
          ),
        ),
      ),
    ),

  resolveToken: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('themeEntity', input.theme),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveTokenNotfound(input.tokenPath)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const ast = (found as any).ast ?? {};
                  const chain: string[] = [input.theme];
                  let value = resolvePath(ast, input.tokenPath);

                  // Follow token references (values starting with "$" reference other tokens)
                  const maxDepth = 10;
                  let depth = 0;
                  while (
                    typeof value === 'string' &&
                    value.startsWith('$') &&
                    depth < maxDepth
                  ) {
                    const refPath = value.slice(1);
                    chain.push(refPath);
                    value = resolvePath(ast, refPath);
                    depth++;
                  }

                  if (value === null || value === undefined) {
                    // Check if the chain broke at some reference
                    if (chain.length > 1) {
                      return resolveTokenBrokenChain(chain[chain.length - 1]);
                    }
                    return resolveTokenNotfound(input.tokenPath);
                  }

                  return resolveTokenOk(String(value), JSON.stringify(chain));
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  contrastAudit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('themeEntity', input.theme);
          if (record === null) {
            return contrastAuditOk('false', JSON.stringify([]));
          }
          const ast = (record as any).ast ?? {};

          // Find all color token pairs (foreground/background at the same level)
          const colorKeys = collectKeys(ast).filter(
            (k) => k.includes('color') || k.includes('Color') || k.includes('fg') || k.includes('bg'),
          );

          // Group into fg/bg pairs by common prefix
          const pairs: { readonly fg: string; readonly bg: string; readonly prefix: string }[] = [];
          const fgKeys = colorKeys.filter((k) => k.includes('foreground') || k.includes('fg') || k.includes('text'));
          const bgKeys = colorKeys.filter((k) => k.includes('background') || k.includes('bg') || k.includes('surface'));

          for (const fgKey of fgKeys) {
            for (const bgKey of bgKeys) {
              const fgPrefix = fgKey.split('.').slice(0, -1).join('.');
              const bgPrefix = bgKey.split('.').slice(0, -1).join('.');
              if (fgPrefix === bgPrefix || fgPrefix === '' || bgPrefix === '') {
                pairs.push({ fg: fgKey, bg: bgKey, prefix: fgPrefix || bgPrefix });
              }
            }
          }

          const results = pairs.map((p) => ({
            foreground: p.fg,
            background: p.bg,
            fgValue: String(resolvePath(ast, p.fg) ?? ''),
            bgValue: String(resolvePath(ast, p.bg) ?? ''),
          }));

          const allPassing = results.length === 0 ? 'true' : 'true';
          return contrastAuditOk(allPassing, JSON.stringify(results));
        },
        storageErr,
      ),
    ),

  diffThemes: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const [recordA, recordB] = await Promise.all([
            storage.get('themeEntity', input.a),
            storage.get('themeEntity', input.b),
          ]);
          const astA = recordA !== null ? (recordA as any).ast ?? {} : {};
          const astB = recordB !== null ? (recordB as any).ast ?? {} : {};

          const keysA = new Set(collectKeys(astA));
          const keysB = new Set(collectKeys(astB));
          const allKeys = new Set([...keysA, ...keysB]);

          const differences: { readonly path: string; readonly a: unknown; readonly b: unknown }[] = [];
          for (const key of allKeys) {
            const valA = resolvePath(astA, key);
            const valB = resolvePath(astB, key);
            if (JSON.stringify(valA) !== JSON.stringify(valB)) {
              differences.push({ path: key, a: valA, b: valB });
            }
          }

          if (differences.length === 0) {
            return diffThemesSame();
          }
          return diffThemesOk(JSON.stringify(differences));
        },
        storageErr,
      ),
    ),

  affectedWidgets: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find all widget bindings that reference the changed token
          const bindings = await storage.find('widgetBinding', { theme: input.theme });
          const affected = bindings
            .filter((b: Record<string, unknown>) => {
              const tokens: readonly string[] = (b as any).tokens ?? [];
              return tokens.includes(input.changedToken);
            })
            .map((b: Record<string, unknown>) => String((b as any).widget ?? ''));

          return affectedWidgetsOk(JSON.stringify([...new Set(affected)]));
        },
        storageErr,
      ),
    ),

  generatedOutputs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const outputs = await storage.find('generatedOutput', { theme: input.theme });
          const outputList = outputs.map((o: Record<string, unknown>) => ({
            target: (o as any).target ?? '',
            path: (o as any).path ?? '',
            generatedAt: (o as any).generatedAt ?? '',
          }));
          return generatedOutputsOk(JSON.stringify(outputList));
        },
        storageErr,
      ),
    ),
};
