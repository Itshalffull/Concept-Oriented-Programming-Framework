// Pathauto Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const pathautoHandler: ConceptHandler = {
  async generateAlias(input, storage) {
    const pattern = input.pattern as string;
    const entity = input.entity as string;

    const patternEntry = await storage.get('pattern', pattern);
    if (!patternEntry) {
      return { variant: 'notfound' };
    }

    const template = patternEntry.template as string;

    // Replace tokens in template with entity-derived values
    let alias = template.replace(/\[entity\]/g, entity);
    alias = slugify(alias);

    // Store the generated alias
    await storage.put('alias', `${pattern}:${entity}`, {
      pattern,
      entity,
      alias,
    });

    return { variant: 'ok', alias };
  },

  async bulkGenerate(input, storage) {
    const pattern = input.pattern as string;
    const entities = input.entities as string;

    const patternEntry = await storage.get('pattern', pattern);
    if (!patternEntry) {
      return { variant: 'notfound' };
    }

    const template = patternEntry.template as string;
    const entityList = JSON.parse(entities) as string[];
    const aliases: Record<string, string> = {};

    for (const entity of entityList) {
      let alias = template.replace(/\[entity\]/g, entity);
      alias = slugify(alias);

      await storage.put('alias', `${pattern}:${entity}`, {
        pattern,
        entity,
        alias,
      });

      aliases[entity] = alias;
    }

    return { variant: 'ok', aliases: JSON.stringify(aliases) };
  },

  async cleanString(input) {
    const rawInput = input.input as string;

    const cleaned = slugify(rawInput);

    return { variant: 'ok', cleaned };
  },
};
