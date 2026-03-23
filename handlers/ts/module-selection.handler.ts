// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ModuleSelection Concept Implementation
// Interactive module selection session: start from a template and/or target profile,
// then add/remove concepts, choose handler implementations, add widgets, themes,
// and derived concepts before finalizing into a flat module list.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextIdVal = 1;
function makeId(): string {
  return `sel-${nextIdVal++}`;
}

export function resetModuleSelectionIds() {
  nextIdVal = 1;
}

const _handler: FunctionalConceptHandler = {
  begin(input: Record<string, unknown>) {
    // At least one of template_name or profile_name must be provided (non-null, non-empty)
    const hasTemplate = input.template_name != null &&
      !(typeof input.template_name === 'string' && (input.template_name as string).trim() === '');
    const hasProfile = input.profile_name != null &&
      !(typeof input.profile_name === 'string' && (input.profile_name as string).trim() === '');
    if (!hasTemplate && !hasProfile) {
      return complete(createProgram(), 'error', { message: 'template_name or profile_name is required' }) as StorageProgram<Result>;
    }
    const templateName = hasTemplate ? (input.template_name as string) : undefined;
    const profileName = hasProfile ? (input.profile_name as string) : undefined;

    const id = makeId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = find(p, 'appTemplate', {}, 'templates');
    p = find(p, 'targetProfile', {}, 'profiles');
    p = mapBindings(p, (bindings) => {
      const templates = bindings.templates as Record<string, unknown>[];
      const profiles = bindings.profiles as Record<string, unknown>[];

      let concepts: Array<{ module_id: string; features: string[] }> = [];
      let syncs: string[] = [];

      if (templateName) {
        const tpl = templates.find(t => t.name === templateName);
        if (tpl) {
          const modules = JSON.parse(tpl.modules as string) as string[];
          concepts = modules.map(m => ({ module_id: m, features: [] }));
          syncs = JSON.parse(tpl.syncs as string) as string[];
        }
      }

      let infraModules: string[] = [];
      if (profileName) {
        const prof = profiles.find(p => p.name === profileName);
        if (prof) {
          const deployTargets = JSON.parse(prof.deploy_targets as string) as string[];
          const storageAdapters = JSON.parse(prof.storage_adapters as string) as string[];
          const apiInterfaces = JSON.parse(prof.api_interfaces as string) as string[];

          const moduleSets: Record<string, string[]> = {
            vercel: ['VercelRuntime'], lambda: ['LambdaRuntime'],
            cloudrun: ['CloudRunRuntime'], cloudflare: ['CloudflareRuntime'],
            k8s: ['K8sRuntime'], 'docker-compose': ['DockerComposeRuntime'],
            local: ['DockerComposeRuntime'],
          };
          for (const dt of deployTargets) {
            const mods = moduleSets[dt];
            if (mods) infraModules.push(...mods);
          }

          const storageSets: Record<string, string> = {
            postgres: 'PostgresAdapter', sqlite: 'SqliteAdapter',
            mongodb: 'MongoAdapter', dynamodb: 'DynamoAdapter',
            memory: 'MemoryAdapter', 'core-data': 'CoreDataAdapter',
            localstorage: 'LocalStorageAdapter',
          };
          for (const sa of storageAdapters) {
            if (storageSets[sa]) infraModules.push(storageSets[sa]);
          }

          const apiSets: Record<string, string[]> = {
            rest: ['RestTarget'], graphql: ['GraphqlTarget'],
            grpc: ['GrpcTarget'], cli: ['CliTarget'],
            mcp: ['McpTarget'], 'claude-skills': ['ClaudeSkillsTarget'],
          };
          for (const ai of apiInterfaces) {
            const mods = apiSets[ai];
            if (mods) infraModules.push(...mods);
          }

          infraModules = Array.from(new Set(infraModules));
        }
      }

      return { concepts, syncs, infraModules };
    }, 'computed');

    p = putFrom(p, 'moduleSelection', id, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      const concepts = computed.concepts as Array<{ module_id: string; features: string[] }>;
      const syncs = computed.syncs as string[];
      const infraModules = computed.infraModules as string[];
      return {
        id,
        templateName: templateName || '',
        profileName: profileName || '',
        concepts: JSON.stringify(concepts),
        syncs: JSON.stringify(syncs),
        infraModules: JSON.stringify(infraModules),
        handlerChoices: JSON.stringify({}),
        widgets: JSON.stringify([]),
        theme: '',
        derived: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      const concepts = computed.concepts as Array<unknown>;
      const infraModules = computed.infraModules as string[];
      return {
        selectionId: id,
        conceptCount: concepts.length,
        infraCount: infraModules.length,
      };
    }) as StorageProgram<Result>;
  },

  addConcept(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;
    const features = JSON.parse((input.features as string) || '[]') as string[];

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
          if (concepts.some(c => c.module_id === moduleId)) {
            return { error: 'exists' };
          }
          concepts.push({ module_id: moduleId, features });
          return { error: null, concepts, conceptCount: concepts.length };
        }, 'addResult');

        bp2 = putFrom(bp2, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const res = bindings.addResult as Record<string, unknown>;
          if (res.error) return sel;
          return {
            ...sel,
            concepts: JSON.stringify(res.concepts),
            updatedAt: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.addResult as Record<string, unknown>;
          if (res.error === 'exists') {
            return { variant: 'exists', message: `Module "${moduleId}" already in selection` };
          }
          return { conceptCount: res.conceptCount as number };
        });
      },
    ) as StorageProgram<Result>;
  },

  removeConcept(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
          const syncs = JSON.parse(sel.syncs as string) as string[];
          const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

          const dependentDerived = derived.filter(d => d.composes.includes(moduleId));
          if (dependentDerived.length > 0) {
            return {
              error: 'hasDependents',
              message: `Module "${moduleId}" is used by derived concepts: ${dependentDerived.map(d => d.name).join(', ')}`,
            };
          }

          const dependentSyncs = syncs.filter(s => s.split('->').includes(moduleId));
          const filtered = concepts.filter(c => c.module_id !== moduleId);
          if (filtered.length === concepts.length) {
            return { error: 'notfound', message: `Module "${moduleId}" not in selection` };
          }

          const filteredSyncs = syncs.filter(s => !s.split('->').includes(moduleId));
          return { error: null, concepts: filtered, syncs: filteredSyncs, conceptCount: filtered.length, removedSyncs: dependentSyncs.length };
        }, 'removeResult');

        bp2 = putFrom(bp2, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const res = bindings.removeResult as Record<string, unknown>;
          if (res.error) return sel;
          return {
            ...sel,
            concepts: JSON.stringify(res.concepts),
            syncs: JSON.stringify(res.syncs),
            updatedAt: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.removeResult as Record<string, unknown>;
          if (res.error === 'hasDependents') {
            return { variant: 'hasDependents', message: res.message as string };
          }
          if (res.error === 'notfound') {
            return { variant: 'notfound', message: res.message as string };
          }
          return { conceptCount: res.conceptCount as number, removedSyncs: res.removedSyncs as number };
        });
      },
    ) as StorageProgram<Result>;
  },

  chooseHandler(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const conceptModule = input.concept_module as string;
    const handlerModule = input.handler_module as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
          if (!concepts.some(c => c.module_id === conceptModule)) {
            return { error: 'notfound' };
          }
          const choices = JSON.parse(sel.handlerChoices as string) as Record<string, string>;
          choices[conceptModule] = handlerModule;
          return { error: null, choices };
        }, 'choiceResult');

        bp2 = putFrom(bp2, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const res = bindings.choiceResult as Record<string, unknown>;
          if (res.error) return sel;
          return {
            ...sel,
            handlerChoices: JSON.stringify(res.choices),
            updatedAt: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.choiceResult as Record<string, unknown>;
          if (res.error === 'notfound') {
            return { variant: 'notfound', message: `Concept "${conceptModule}" not in selection` };
          }
          return {};
        });
      },
    ) as StorageProgram<Result>;
  },

  addWidget(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const widgets = JSON.parse(sel.widgets as string) as string[];
          if (widgets.includes(moduleId)) {
            return { error: 'exists' };
          }
          widgets.push(moduleId);
          return { error: null, widgets, widgetCount: widgets.length };
        }, 'widgetResult');

        bp2 = putFrom(bp2, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const res = bindings.widgetResult as Record<string, unknown>;
          if (res.error) return sel;
          return {
            ...sel,
            widgets: JSON.stringify(res.widgets),
            updatedAt: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.widgetResult as Record<string, unknown>;
          if (res.error === 'exists') {
            return { variant: 'exists', message: `Widget "${moduleId}" already added` };
          }
          return { widgetCount: res.widgetCount as number };
        });
      },
    ) as StorageProgram<Result>;
  },

  selectTheme(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const themeModule = input.theme_module as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        const bp2 = putFrom(bp, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          return { ...sel, theme: themeModule, updatedAt: new Date().toISOString() };
        });
        return complete(bp2, 'ok', { theme: themeModule });
      },
    ) as StorageProgram<Result>;
  },

  addDerived(input: Record<string, unknown>) {
    const selectionId = input.selection as string;
    const name = input.name as string;
    const composes = JSON.parse(input.composes as string) as string[];

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
          const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

          const missing = composes.filter(c => !concepts.some(con => con.module_id === c));
          if (missing.length > 0) {
            return { error: 'missingConcepts', message: `Composed concepts not in selection: ${missing.join(', ')}` };
          }
          if (derived.some(d => d.name === name)) {
            return { error: 'duplicate', message: `Derived concept "${name}" already exists` };
          }
          derived.push({ name, composes });
          return { error: null, derived, derivedCount: derived.length };
        }, 'derivedResult');

        bp2 = putFrom(bp2, 'moduleSelection', selectionId, (bindings) => {
          const sel = bindings.sel as Record<string, unknown>;
          const res = bindings.derivedResult as Record<string, unknown>;
          if (res.error) return sel;
          return {
            ...sel,
            derived: JSON.stringify(res.derived),
            updatedAt: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.derivedResult as Record<string, unknown>;
          if (res.error === 'missingConcepts') {
            return { variant: 'missingConcepts', message: res.message as string };
          }
          if (res.error === 'duplicate') {
            return { variant: 'duplicate', message: res.message as string };
          }
          return { derivedCount: res.derivedCount as number };
        });
      },
    ) as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const selectionId = input.selection as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
        const infraModules = JSON.parse(sel.infraModules as string) as string[];
        const widgets = JSON.parse(sel.widgets as string) as string[];
        const theme = sel.theme as string;
        const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;
        const handlerChoices = JSON.parse(sel.handlerChoices as string) as Record<string, string>;

        const allModules: string[] = [];
        for (const c of concepts) allModules.push(c.module_id);
        for (const handler of Object.values(handlerChoices)) {
          if (!allModules.includes(handler)) allModules.push(handler);
        }
        for (const infra of infraModules) {
          if (!allModules.includes(infra)) allModules.push(infra);
        }
        for (const w of widgets) {
          if (!allModules.includes(w)) allModules.push(w);
        }
        if (theme && !allModules.includes(theme)) allModules.push(theme);
        for (const d of derived) {
          const derivedId = `derived:${d.name}`;
          if (!allModules.includes(derivedId)) allModules.push(derivedId);
        }

        return { modules: JSON.stringify(allModules), totalCount: allModules.length };
      }),
    ) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const selectionId = input.selection as string;

    let p = createProgram();
    p = get(p, 'moduleSelection', selectionId, 'sel');

    return branch(p,
      (bindings) => !bindings.sel,
      (bp) => complete(bp, 'notfound', { message: `Selection "${selectionId}" not found` }),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
        const infraModules = JSON.parse(sel.infraModules as string) as string[];
        const widgets = JSON.parse(sel.widgets as string) as string[];
        const theme = sel.theme as string;
        const derived = JSON.parse(sel.derived as string) as Array<{ name: string }>;
        const handlerChoices = JSON.parse(sel.handlerChoices as string) as Record<string, string>;

        const summary = {
          concepts: concepts.length,
          handlers: Object.keys(handlerChoices).length,
          infrastructure: infraModules.length,
          widgets: widgets.length,
          theme: theme ? 1 : 0,
          derived: derived.length,
          total: concepts.length + Object.keys(handlerChoices).length + infraModules.length
            + widgets.length + (theme ? 1 : 0) + derived.length,
        };

        return { summary: JSON.stringify(summary) };
      }),
    ) as StorageProgram<Result>;
  },
};

export const moduleSelectionHandler = autoInterpret(_handler);
