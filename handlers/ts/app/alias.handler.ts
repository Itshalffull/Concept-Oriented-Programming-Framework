// Alias Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const aliasHandler: ConceptHandler = {
  async addAlias(input, storage) {
    const entity = input.entity as string;
    const name = input.name as string;

    const existing = await storage.get('alias', entity);
    const aliases: string[] = existing
      ? JSON.parse(existing.aliases as string)
      : [];

    if (aliases.includes(name)) {
      return { variant: 'exists', entity, name };
    }

    aliases.push(name);

    await storage.put('alias', entity, {
      entity,
      aliases: JSON.stringify(aliases),
    });

    return { variant: 'ok', entity, name };
  },

  async removeAlias(input, storage) {
    const entity = input.entity as string;
    const name = input.name as string;

    const existing = await storage.get('alias', entity);
    if (!existing) {
      return { variant: 'notfound', entity, name };
    }

    const aliases: string[] = JSON.parse(existing.aliases as string);

    if (!aliases.includes(name)) {
      return { variant: 'notfound', entity, name };
    }

    const updated = aliases.filter(a => a !== name);

    await storage.put('alias', entity, {
      entity,
      aliases: JSON.stringify(updated),
    });

    return { variant: 'ok', entity, name };
  },

  async resolve(input, storage) {
    const name = input.name as string;

    const allAliases = await storage.find('alias');

    for (const record of allAliases) {
      const aliases: string[] = JSON.parse(record.aliases as string);
      if (aliases.includes(name)) {
        return { variant: 'ok', entity: record.entity as string };
      }
    }

    return { variant: 'notfound', name };
  },
};
