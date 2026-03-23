// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ScoreIndex Concept Implementation
//
// Materialized index backing ScoreApi queries. Maintains
// denormalized views of the five Score layers optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in
// concept in every Clef runtime.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, get, find, put, del, delMany, branch, mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  upsertConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `concept:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'concepts', id, {
      conceptName: name,
      purpose: (input.purpose as string) || '',
      actions: (input.actions as string[]) || [],
      stateFields: (input.stateFields as string[]) || [],
      file: (input.file as string) || '',
    });

    p = put(p, 'meta', 'concepts', {
      kind: 'concepts',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertSync(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `sync:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'syncs', id, {
      syncName: name,
      annotation: (input.annotation as string) || 'eager',
      triggers: (input.triggers as string[]) || [],
      effects: (input.effects as string[]) || [],
      file: (input.file as string) || '',
    });

    p = put(p, 'meta', 'syncs', {
      kind: 'syncs',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertSymbol(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const file = input.file as string;
    const line = input.line as number;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `symbol:${name}:${file}:${line}`;
    const now = new Date().toISOString();

    p = put(p, 'symbols', id, {
      symbolName: name,
      symbolKind: (input.kind as string) || 'unknown',
      file: file || '',
      line: line || 0,
      scope: (input.scope as string) || '',
    });

    p = put(p, 'meta', 'symbols', {
      kind: 'symbols',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertFile(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }

    const id = `file:${path}`;
    const now = new Date().toISOString();

    p = put(p, 'files', id, {
      filePath: path,
      language: (input.language as string) || 'unknown',
      role: (input.role as string) || 'source',
      definitions: (input.definitions as string[]) || [],
    });

    p = put(p, 'meta', 'files', {
      kind: 'files',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertHandler(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    if (!concept) {
      return complete(p, 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }

    const id = `handler:${concept}`;
    const now = new Date().toISOString();

    p = put(p, 'handlers', id, {
      handlerConcept: concept,
      handlerLanguage: (input.language as string) || 'typescript',
      handlerFile: (input.file as string) || '',
      handlerActions: (input.actions as string[]) || [],
      handlerLineCount: (input.lineCount as number) || 0,
    });

    p = put(p, 'meta', 'handlers', {
      kind: 'handlers',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertWidgetImpl(input: Record<string, unknown>) {
    let p = createProgram();
    const widget = input.widget as string;
    if (!widget) {
      return complete(p, 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }

    const id = `widgetImpl:${widget}`;
    const now = new Date().toISOString();

    p = put(p, 'widgetImpls', id, {
      widgetImplWidget: widget,
      widgetImplFramework: (input.framework as string) || '',
      widgetImplFile: (input.file as string) || '',
      widgetImplComponent: (input.component as string) || '',
    });

    p = put(p, 'meta', 'widgetImpls', {
      kind: 'widgetImpls',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertThemeImpl(input: Record<string, unknown>) {
    let p = createProgram();
    const theme = input.theme as string;
    if (!theme) {
      return complete(p, 'error', { message: 'theme is required' }) as StorageProgram<Result>;
    }

    const id = `themeImpl:${theme}`;
    const now = new Date().toISOString();

    p = put(p, 'themeImpls', id, {
      themeImplTheme: theme,
      themeImplPlatform: (input.platform as string) || '',
      themeImplFile: (input.file as string) || '',
      themeImplTokenCount: (input.tokenCount as number) || 0,
    });

    p = put(p, 'meta', 'themeImpls', {
      kind: 'themeImpls',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertDeployment(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `deployment:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'deployments', id, {
      deploymentName: name,
      deploymentApp: (input.app as string) || '',
      deploymentRuntimes: (input.runtimes as string[]) || [],
      deploymentFile: (input.file as string) || '',
    });

    p = put(p, 'meta', 'deployments', {
      kind: 'deployments',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertSuiteManifest(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `suite:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'suiteManifests', id, {
      suiteName: name,
      suiteVersion: (input.version as string) || '',
      suiteConcepts: (input.concepts as string[]) || [],
      suiteSyncs: (input.syncs as string[]) || [],
      suiteFile: (input.file as string) || '',
    });

    p = put(p, 'meta', 'suiteManifests', {
      kind: 'suiteManifests',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  upsertInterface(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = `interface:${name}`;
    const now = new Date().toISOString();

    p = put(p, 'interfaces', id, {
      interfaceName: name,
      interfaceTargets: (input.targets as string[]) || [],
      interfaceEndpointCount: (input.endpointCount as number) || 0,
      interfaceFile: (input.file as string) || '',
    });

    p = put(p, 'meta', 'interfaces', {
      kind: 'interfaces',
      lastUpdated: now,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  removeByFile(input: Record<string, unknown>) {
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'ok', { removed: 0 }) as StorageProgram<Result>;
    }

    const fileId = `file:${path}`;

    // Check if the file entry exists
    p = get(p, 'files', fileId, 'existing');

    // Delete related records from all relations matching this file
    p = delMany(p, 'symbols', { file: path }, 'deletedSymbols');
    p = delMany(p, 'concepts', { file: path }, 'deletedConcepts');
    p = delMany(p, 'syncs', { file: path }, 'deletedSyncs');

    // Remove file entry if it exists
    return branch(p, 'existing',
      (thenP) => {
        thenP = del(thenP, 'files', fileId);
        return completeFrom(thenP, 'ok', (bindings) => ({
          removed: 1 +
            (bindings.deletedSymbols as number) +
            (bindings.deletedConcepts as number) +
            (bindings.deletedSyncs as number),
        }));
      },
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => ({
          removed:
            (bindings.deletedSymbols as number) +
            (bindings.deletedConcepts as number) +
            (bindings.deletedSyncs as number),
        }));
      },
    ) as StorageProgram<Result>;
  },

  clear(_input: Record<string, unknown>) {
    let p = createProgram();

    // Delete all records from each relation
    p = delMany(p, 'concepts', {}, 'deletedConcepts');
    p = delMany(p, 'syncs', {}, 'deletedSyncs');
    p = delMany(p, 'symbols', {}, 'deletedSymbols');
    p = delMany(p, 'files', {}, 'deletedFiles');
    p = delMany(p, 'handlers', {}, 'deletedHandlers');
    p = delMany(p, 'widgetImpls', {}, 'deletedWidgetImpls');
    p = delMany(p, 'themeImpls', {}, 'deletedThemeImpls');
    p = delMany(p, 'deployments', {}, 'deletedDeployments');
    p = delMany(p, 'suiteManifests', {}, 'deletedSuiteManifests');
    p = delMany(p, 'interfaces', {}, 'deletedInterfaces');

    return completeFrom(p, 'ok', (bindings) => ({
      cleared:
        (bindings.deletedConcepts as number) +
        (bindings.deletedSyncs as number) +
        (bindings.deletedSymbols as number) +
        (bindings.deletedFiles as number) +
        (bindings.deletedHandlers as number) +
        (bindings.deletedWidgetImpls as number) +
        (bindings.deletedThemeImpls as number) +
        (bindings.deletedDeployments as number) +
        (bindings.deletedSuiteManifests as number) +
        (bindings.deletedInterfaces as number),
    })) as StorageProgram<Result>;
  },

  stats(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'allConcepts');
    p = find(p, 'syncs', {}, 'allSyncs');
    p = find(p, 'symbols', {}, 'allSymbols');
    p = find(p, 'files', {}, 'allFiles');
    p = find(p, 'handlers', {}, 'allHandlers');
    p = find(p, 'widgetImpls', {}, 'allWidgetImpls');
    p = find(p, 'themeImpls', {}, 'allThemeImpls');
    p = find(p, 'suiteManifests', {}, 'allSuiteManifests');
    p = find(p, 'deployments', {}, 'allDeployments');
    p = find(p, 'interfaces', {}, 'allInterfaces');
    p = get(p, 'meta', 'concepts', 'metaRecord');

    return completeFrom(p, 'ok', (bindings) => ({
      conceptCount: ((bindings.allConcepts as unknown[]) || []).length,
      syncCount: ((bindings.allSyncs as unknown[]) || []).length,
      symbolCount: ((bindings.allSymbols as unknown[]) || []).length,
      fileCount: ((bindings.allFiles as unknown[]) || []).length,
      handlerCount: ((bindings.allHandlers as unknown[]) || []).length,
      widgetImplCount: ((bindings.allWidgetImpls as unknown[]) || []).length,
      themeImplCount: ((bindings.allThemeImpls as unknown[]) || []).length,
      suiteCount: ((bindings.allSuiteManifests as unknown[]) || []).length,
      deploymentCount: ((bindings.allDeployments as unknown[]) || []).length,
      interfaceCount: ((bindings.allInterfaces as unknown[]) || []).length,
      lastUpdated: (bindings.metaRecord as Record<string, unknown>)?.lastUpdated || new Date().toISOString(),
    })) as StorageProgram<Result>;
  },
};

export const scoreIndexHandler = autoInterpret(_handler);
