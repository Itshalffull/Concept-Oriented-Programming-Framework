// AppTemplate Concept Implementation
// Manage starter templates that bundle Repertoire concepts into common application archetypes.
// Each template declares a set of concept modules, a category, and optional syncs between concepts.
import type { ConceptHandler } from '@clef/runtime';

/** Built-in templates seeded on first access. */
const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  category: string;
  modules: string[];
  required: string[];
  syncs: string[];
}> = [
  {
    name: 'social',
    description: 'Social network with articles, comments, follows, and user profiles',
    category: 'content',
    modules: [
      'User', 'Password', 'JWT', 'Profile', 'Article', 'Comment',
      'Tag', 'Follow', 'Favorite', 'ContentNode', 'Collection',
    ],
    required: ['User', 'Password', 'JWT'],
    syncs: ['User->Profile', 'Article->Comment', 'Article->Tag', 'User->Follow', 'Article->Favorite'],
  },
  {
    name: 'cms',
    description: 'Content management system with versioning, templates, and structured content',
    category: 'content',
    modules: [
      'User', 'Password', 'JWT', 'ContentNode', 'ContentStorage',
      'Template', 'Version', 'Comment', 'Tag', 'Collection', 'Outline', 'Canvas',
    ],
    required: ['User', 'Password', 'JWT', 'ContentNode', 'ContentStorage'],
    syncs: ['ContentNode->Version', 'ContentNode->Comment', 'ContentNode->Tag', 'ContentNode->Collection'],
  },
  {
    name: 'ecommerce',
    description: 'E-commerce platform with product data, collections, and data integration',
    category: 'data',
    modules: [
      'User', 'Password', 'JWT', 'Profile', 'Collection',
      'Tag', 'DataSource', 'FieldMapping', 'Transform',
    ],
    required: ['User', 'Password', 'JWT', 'DataSource'],
    syncs: ['Collection->Tag', 'DataSource->FieldMapping', 'FieldMapping->Transform'],
  },
  {
    name: 'api',
    description: 'API-first platform with content storage, type system, and data connectors',
    category: 'data',
    modules: [
      'User', 'Password', 'JWT', 'ContentNode', 'ContentStorage',
      'TypeSystem', 'Property', 'DataSource', 'Connector',
    ],
    required: ['User', 'Password', 'JWT', 'ContentNode'],
    syncs: ['ContentNode->ContentStorage', 'TypeSystem->Property', 'DataSource->Connector'],
  },
  {
    name: 'tool',
    description: 'Knowledge tool with collections, graph navigation, and intent-driven interaction',
    category: 'knowledge',
    modules: [
      'User', 'Password', 'JWT', 'ContentNode', 'Collection',
      'Graph', 'Intent', 'Property',
    ],
    required: ['User', 'Password', 'JWT', 'ContentNode'],
    syncs: ['ContentNode->Collection', 'Graph->ContentNode', 'Intent->ContentNode'],
  },
];

let nextId = 1;
function makeId(): string {
  return `tpl-${nextId++}`;
}

/** Seed built-in templates into storage if not already present. */
async function ensureBuiltIns(storage: Parameters<NonNullable<import('@clef/runtime').ConceptHandler['list']>>[1]) {
  const existing = await storage.find('appTemplate');
  if (existing.length > 0) return;

  for (const tpl of BUILT_IN_TEMPLATES) {
    const id = makeId();
    await storage.put('appTemplate', id, {
      id,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      modules: JSON.stringify(tpl.modules),
      required: JSON.stringify(tpl.required),
      syncs: JSON.stringify(tpl.syncs),
      builtIn: true,
      createdAt: new Date().toISOString(),
    });
  }
}

export function resetAppTemplateIds() {
  nextId = 1;
}

export const appTemplateHandler: ConceptHandler = {
  async list(input, storage) {
    await ensureBuiltIns(storage);

    const category = input.category as string | undefined;
    const all = await storage.find('appTemplate');

    const filtered = category
      ? all.filter(t => t.category === category)
      : all;

    const templates = filtered.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      moduleCount: (JSON.parse(t.modules as string) as string[]).length,
    }));

    return { variant: 'ok', templates: JSON.stringify(templates) };
  },

  async detail(input, storage) {
    await ensureBuiltIns(storage);

    const name = input.name as string;
    const all = await storage.find('appTemplate');
    const match = all.find(t => t.name === name);

    if (!match) {
      return { variant: 'notfound', message: `Template "${name}" not found` };
    }

    return {
      variant: 'ok',
      id: match.id as string,
      name: match.name as string,
      description: match.description as string,
      category: match.category as string,
      modules: match.modules as string,
      required: match.required as string,
      syncs: match.syncs as string,
      builtIn: match.builtIn as boolean,
    };
  },

  async customize(input, storage) {
    await ensureBuiltIns(storage);

    const templateName = input.template as string;
    const add = JSON.parse((input.add as string) || '[]') as string[];
    const remove = JSON.parse((input.remove as string) || '[]') as string[];
    const features = JSON.parse((input.features as string) || '{}') as Record<string, unknown>;

    const all = await storage.find('appTemplate');
    const source = all.find(t => t.name === templateName);

    if (!source) {
      return { variant: 'notfound', message: `Template "${templateName}" not found` };
    }

    const modules: string[] = JSON.parse(source.modules as string);
    const required: string[] = JSON.parse(source.required as string);
    const syncs: string[] = JSON.parse(source.syncs as string);

    // Validate that required modules are not being removed
    const errors: string[] = [];
    for (const mod of remove) {
      if (required.includes(mod)) {
        errors.push(`Cannot remove required module "${mod}"`);
      }
    }

    if (errors.length > 0) {
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    // Apply removals
    const afterRemove = modules.filter(m => !remove.includes(m));

    // Filter syncs that reference removed modules
    const afterSyncs = syncs.filter(s => {
      const parts = s.split('->');
      return parts.every(p => afterRemove.includes(p));
    });

    // Apply additions
    for (const mod of add) {
      if (!afterRemove.includes(mod)) {
        afterRemove.push(mod);
      }
    }

    const customized = {
      name: `${templateName}-custom`,
      description: `Customized from ${templateName}`,
      category: source.category as string,
      modules: afterRemove,
      syncs: afterSyncs,
      features,
    };

    return { variant: 'ok', customized: JSON.stringify(customized) };
  },

  async register(input, storage) {
    await ensureBuiltIns(storage);

    const name = input.name as string;
    const description = input.description as string;
    const category = input.category as string;
    const modules = JSON.parse(input.modules as string) as string[];
    const syncs = JSON.parse((input.syncs as string) || '[]') as string[];

    // Check name uniqueness
    const all = await storage.find('appTemplate');
    const duplicate = all.find(t => t.name === name);
    if (duplicate) {
      return { variant: 'duplicate', message: `Template "${name}" already exists` };
    }

    const id = makeId();
    const now = new Date().toISOString();

    await storage.put('appTemplate', id, {
      id,
      name,
      description,
      category,
      modules: JSON.stringify(modules),
      required: JSON.stringify([]),
      syncs: JSON.stringify(syncs),
      builtIn: false,
      createdAt: now,
    });

    return {
      variant: 'ok',
      template: JSON.stringify({ id, name, description, category, modules, syncs }),
    };
  },
};
