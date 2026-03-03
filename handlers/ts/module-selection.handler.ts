// ModuleSelection Concept Implementation
// Interactive module selection session: start from a template and/or target profile,
// then add/remove concepts, choose handler implementations, add widgets, themes,
// and derived concepts before finalizing into a flat module list.
import type { ConceptHandler } from '@clef/runtime';

let nextId = 1;
function makeId(): string {
  return `sel-${nextId++}`;
}

export function resetModuleSelectionIds() {
  nextId = 1;
}

export const moduleSelectionHandler: ConceptHandler = {
  async begin(input, storage) {
    const templateName = input.template_name as string | undefined;
    const profileName = input.profile_name as string | undefined;

    const id = makeId();
    const now = new Date().toISOString();

    // Pre-populate concepts from template if provided
    let concepts: Array<{ module_id: string; features: string[] }> = [];
    let syncs: string[] = [];

    if (templateName) {
      const templates = await storage.find('appTemplate');
      const tpl = templates.find(t => t.name === templateName);
      if (tpl) {
        const modules = JSON.parse(tpl.modules as string) as string[];
        concepts = modules.map(m => ({ module_id: m, features: [] }));
        syncs = JSON.parse(tpl.syncs as string) as string[];
      }
    }

    // Pre-populate infrastructure modules from profile if provided
    let infraModules: string[] = [];
    if (profileName) {
      const profiles = await storage.find('targetProfile');
      const prof = profiles.find(p => p.name === profileName);
      if (prof) {
        // Collect all profile-derived modules inline
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

        // Deduplicate
        infraModules = Array.from(new Set(infraModules));
      }
    }

    await storage.put('moduleSelection', id, {
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
    });

    return {
      variant: 'ok',
      selectionId: id,
      conceptCount: concepts.length,
      infraCount: infraModules.length,
    };
  },

  async addConcept(input, storage) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;
    const features = JSON.parse((input.features as string) || '[]') as string[];

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;

    // Check for duplicate
    if (concepts.some(c => c.module_id === moduleId)) {
      return { variant: 'exists', message: `Module "${moduleId}" already in selection` };
    }

    concepts.push({ module_id: moduleId, features });

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      concepts: JSON.stringify(concepts),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', conceptCount: concepts.length };
  },

  async removeConcept(input, storage) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
    const syncs = JSON.parse(sel.syncs as string) as string[];
    const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

    // Check if any derived concept depends on this module
    const dependentDerived = derived.filter(d => d.composes.includes(moduleId));
    if (dependentDerived.length > 0) {
      return {
        variant: 'hasDependents',
        message: `Module "${moduleId}" is used by derived concepts: ${dependentDerived.map(d => d.name).join(', ')}`,
      };
    }

    // Check if any sync references this module
    const dependentSyncs = syncs.filter(s => {
      const parts = s.split('->');
      return parts.includes(moduleId);
    });

    const filtered = concepts.filter(c => c.module_id !== moduleId);
    if (filtered.length === concepts.length) {
      return { variant: 'notfound', message: `Module "${moduleId}" not in selection` };
    }

    // Also remove syncs that reference this module
    const filteredSyncs = syncs.filter(s => {
      const parts = s.split('->');
      return !parts.includes(moduleId);
    });

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      concepts: JSON.stringify(filtered),
      syncs: JSON.stringify(filteredSyncs),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', conceptCount: filtered.length, removedSyncs: dependentSyncs.length };
  },

  async chooseHandler(input, storage) {
    const selectionId = input.selection as string;
    const conceptModule = input.concept_module as string;
    const handlerModule = input.handler_module as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
    if (!concepts.some(c => c.module_id === conceptModule)) {
      return { variant: 'notfound', message: `Concept "${conceptModule}" not in selection` };
    }

    const choices = JSON.parse(sel.handlerChoices as string) as Record<string, string>;
    choices[conceptModule] = handlerModule;

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      handlerChoices: JSON.stringify(choices),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async addWidget(input, storage) {
    const selectionId = input.selection as string;
    const moduleId = input.module_id as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const widgets = JSON.parse(sel.widgets as string) as string[];

    if (widgets.includes(moduleId)) {
      return { variant: 'exists', message: `Widget "${moduleId}" already added` };
    }

    widgets.push(moduleId);

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      widgets: JSON.stringify(widgets),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', widgetCount: widgets.length };
  },

  async selectTheme(input, storage) {
    const selectionId = input.selection as string;
    const themeModule = input.theme_module as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      theme: themeModule,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', theme: themeModule };
  },

  async addDerived(input, storage) {
    const selectionId = input.selection as string;
    const name = input.name as string;
    const composes = JSON.parse(input.composes as string) as string[];

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string }>;
    const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;

    // Verify all composed concepts are in the selection
    const missing = composes.filter(c => !concepts.some(con => con.module_id === c));
    if (missing.length > 0) {
      return {
        variant: 'missingConcepts',
        message: `Composed concepts not in selection: ${missing.join(', ')}`,
      };
    }

    // Check duplicate name
    if (derived.some(d => d.name === name)) {
      return { variant: 'duplicate', message: `Derived concept "${name}" already exists` };
    }

    derived.push({ name, composes });

    await storage.put('moduleSelection', selectionId, {
      ...sel,
      derived: JSON.stringify(derived),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', derivedCount: derived.length };
  },

  async finalize(input, storage) {
    const selectionId = input.selection as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

    const concepts = JSON.parse(sel.concepts as string) as Array<{ module_id: string; features: string[] }>;
    const infraModules = JSON.parse(sel.infraModules as string) as string[];
    const widgets = JSON.parse(sel.widgets as string) as string[];
    const theme = sel.theme as string;
    const derived = JSON.parse(sel.derived as string) as Array<{ name: string; composes: string[] }>;
    const handlerChoices = JSON.parse(sel.handlerChoices as string) as Record<string, string>;

    // Flatten all selections into a single module list
    const allModules: string[] = [];

    // Add concept modules
    for (const c of concepts) {
      allModules.push(c.module_id);
    }

    // Add handler modules
    for (const handler of Object.values(handlerChoices)) {
      if (!allModules.includes(handler)) {
        allModules.push(handler);
      }
    }

    // Add infrastructure modules
    for (const infra of infraModules) {
      if (!allModules.includes(infra)) {
        allModules.push(infra);
      }
    }

    // Add widget modules
    for (const w of widgets) {
      if (!allModules.includes(w)) {
        allModules.push(w);
      }
    }

    // Add theme module
    if (theme && !allModules.includes(theme)) {
      allModules.push(theme);
    }

    // Add derived concept references
    for (const d of derived) {
      const derivedId = `derived:${d.name}`;
      if (!allModules.includes(derivedId)) {
        allModules.push(derivedId);
      }
    }

    return {
      variant: 'ok',
      modules: JSON.stringify(allModules),
      totalCount: allModules.length,
    };
  },

  async preview(input, storage) {
    const selectionId = input.selection as string;

    const sel = await storage.get('moduleSelection', selectionId);
    if (!sel) {
      return { variant: 'notfound', message: `Selection "${selectionId}" not found` };
    }

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

    return { variant: 'ok', summary: JSON.stringify(summary) };
  },
};
