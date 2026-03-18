// @migrated dsl-constructs 2026-03-18
// ModuleSelection Concept Implementation
// Interactive module selection session: start from a template and/or target profile,
// then add/remove concepts, choose handler implementations, add widgets, themes,
// and derived concepts before finalizing into a flat module list.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
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
    const templateName = input.template_name as string | undefined;
    const profileName = input.profile_name as string | undefined;

    let p = createProgram();
    p = find(p, 'appTemplate', {}, 'templates');
    p = find(p, 'targetProfile', {}, 'profiles');

    return completeFrom(p, 'ok', (bindings) => {
      const templates = bindings.templates as Record<string, unknown>[];
      const profiles = bindings.profiles as Record<string, unknown>[];

      const id = makeId();
      const now = new Date().toISOString();

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

      return {
        _puts: [{ relation: 'moduleSelection', key: id, value: {
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
        }}],
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;

        if (concepts.some(c => c.module_id === moduleId)) {
          return { variant: 'exists', message: `Module "${moduleId}" already in selection` };
        }

        concepts.push({ module_id: moduleId, features });
        return { conceptCount: concepts.length };
      }),
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
        const syncs = JSON.parse(sel.syncs as string) as string[];
        const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

        const dependentDerived = derived.filter(d => d.composes.includes(moduleId));
        if (dependentDerived.length > 0) {
          return {
            variant: 'hasDependents',
            message: `Module "${moduleId}" is used by derived concepts: ${dependentDerived.map(d => d.name).join(', ')}`,
          };
        }

        const dependentSyncs = syncs.filter(s => {
          const parts = s.split('->');
          return parts.includes(moduleId);
        });

        const filtered = concepts.filter(c => c.module_id !== moduleId);
        if (filtered.length === concepts.length) {
          return { variant: 'notfound', message: `Module "${moduleId}" not in selection` };
        }

        return { conceptCount: filtered.length, removedSyncs: dependentSyncs.length };
      }),
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
        if (!concepts.some(c => c.module_id === conceptModule)) {
          return { variant: 'notfound', message: `Concept "${conceptModule}" not in selection` };
        }
        return {};
      }),
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const widgets = JSON.parse(sel.widgets as string) as string[];

        if (widgets.includes(moduleId)) {
          return { variant: 'exists', message: `Widget "${moduleId}" already added` };
        }

        widgets.push(moduleId);
        return { widgetCount: widgets.length };
      }),
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
      (bp) => complete(bp, 'ok', { theme: themeModule }),
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
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const sel = bindings.sel as Record<string, unknown>;
        const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
        const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

        const missing = composes.filter(c => !concepts.some(con => con.module_id === c));
        if (missing.length > 0) {
          return {
            variant: 'missingConcepts',
            message: `Composed concepts not in selection: ${missing.join(', ')}`,
          };
        }

        if (derived.some(d => d.name === name)) {
          return { variant: 'duplicate', message: `Derived concept "${name}" already exists` };
        }

        derived.push({ name, composes });
        return { derivedCount: derived.length };
      }),
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
