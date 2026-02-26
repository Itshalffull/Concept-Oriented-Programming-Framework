// DesignToken Concept Implementation
// Stores design tokens with alias resolution chain.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'token';

export const designtokenHandler: ConceptHandler = {
  /**
   * define(token, name, value, type, tier) -> ok(token) | duplicate(message)
   * Registers a new concrete design token. Checks name uniqueness via find.
   */
  async define(input, storage) {
    const token = input.token as string;
    const name = input.name as string;
    const value = input.value as string;
    const type = input.type as string;
    const tier = input.tier as string;

    // Check name uniqueness across all tokens
    const existing = await storage.find(RELATION, { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Token with name "${name}" already exists` };
    }

    await storage.put(RELATION, token, {
      token,
      name,
      value,
      type,
      tier,
      description: '',
      reference: null,
      group: '',
      extensions: '{}',
    });

    return { variant: 'ok', token };
  },

  /**
   * alias(token, name, reference, tier) -> ok(token) | notfound(message) | cycle(message)
   * Creates an alias token that references another token.
   * Validates that the reference target exists and that no cycle is formed.
   */
  async alias(input, storage) {
    const token = input.token as string;
    const name = input.name as string;
    const reference = input.reference as string;
    const tier = input.tier as string;

    // Check that the referenced token exists
    const refEntry = await storage.get(RELATION, reference);
    if (!refEntry) {
      return { variant: 'notfound', message: `Referenced token "${reference}" does not exist` };
    }

    // Walk the reference chain to detect cycles
    const visited = new Set<string>();
    visited.add(token); // the alias being created
    let current: string | null = reference;
    while (current !== null) {
      if (visited.has(current)) {
        return { variant: 'cycle', message: `Alias would create a cycle through "${current}"` };
      }
      visited.add(current);
      const entry = await storage.get(RELATION, current);
      if (!entry) {
        break;
      }
      current = (entry.reference as string | null) ?? null;
    }

    await storage.put(RELATION, token, {
      token,
      name,
      value: null,
      type: 'alias',
      tier,
      description: '',
      reference,
      group: '',
      extensions: '{}',
    });

    return { variant: 'ok', token };
  },

  /**
   * resolve(token) -> ok(token, resolvedValue) | notfound(message) | broken(message, brokenAt)
   * Walks the alias reference chain until a concrete value is found.
   */
  async resolve(input, storage) {
    const token = input.token as string;

    const entry = await storage.get(RELATION, token);
    if (!entry) {
      return { variant: 'notfound', message: `Token "${token}" does not exist` };
    }

    // Walk reference chain
    const visited = new Set<string>();
    let current = entry;
    let currentKey = token;

    while (current.reference !== null && current.reference !== undefined) {
      if (visited.has(currentKey)) {
        return {
          variant: 'broken',
          message: `Cycle detected at "${currentKey}"`,
          brokenAt: currentKey,
        };
      }
      visited.add(currentKey);

      const refKey = current.reference as string;
      const refEntry = await storage.get(RELATION, refKey);
      if (!refEntry) {
        return {
          variant: 'broken',
          message: `Broken reference: "${refKey}" does not exist`,
          brokenAt: refKey,
        };
      }
      current = refEntry;
      currentKey = refKey;
    }

    const resolvedValue = current.value as string;
    return { variant: 'ok', token, resolvedValue };
  },

  /**
   * update(token, value) -> ok(token) | notfound(message)
   * Updates the value of an existing token (read-modify-write).
   */
  async update(input, storage) {
    const token = input.token as string;
    const value = input.value as string;

    const existing = await storage.get(RELATION, token);
    if (!existing) {
      return { variant: 'notfound', message: `Token "${token}" does not exist` };
    }

    await storage.put(RELATION, token, {
      ...existing,
      value,
    });

    return { variant: 'ok', token };
  },

  /**
   * remove(token) -> ok(token) | notfound(message)
   * Deletes a token after verifying it exists.
   */
  async remove(input, storage) {
    const token = input.token as string;

    const existing = await storage.get(RELATION, token);
    if (!existing) {
      return { variant: 'notfound', message: `Token "${token}" does not exist` };
    }

    await storage.del(RELATION, token);
    return { variant: 'ok', token };
  },

  /**
   * export(format) -> ok(output) | unsupported(message)
   * Exports all tokens in the requested format (json or css).
   */
  async export(input, storage) {
    const format = input.format as string;
    const supportedFormats = ['json', 'css'];

    if (!supportedFormats.includes(format.toLowerCase())) {
      return {
        variant: 'unsupported',
        message: `Format "${format}" is not supported. Supported formats: ${supportedFormats.join(', ')}`,
      };
    }

    const allTokens = await storage.find(RELATION);

    if (format.toLowerCase() === 'json') {
      const tokenMap: Record<string, unknown> = {};
      for (const t of allTokens) {
        tokenMap[t.name as string] = {
          value: t.value,
          type: t.type,
          tier: t.tier,
          ...(t.reference ? { reference: t.reference } : {}),
          ...(t.description ? { description: t.description } : {}),
          ...(t.group ? { group: t.group } : {}),
        };
      }
      return { variant: 'ok', output: JSON.stringify(tokenMap, null, 2) };
    }

    // CSS custom properties format
    if (format.toLowerCase() === 'css') {
      const lines = [':root {'];
      for (const t of allTokens) {
        const name = (t.name as string).replace(/\./g, '-');
        const value = t.value ?? `var(--${(t.reference as string ?? '').replace(/\./g, '-')})`;
        lines.push(`  --${name}: ${value};`);
      }
      lines.push('}');
      return { variant: 'ok', output: lines.join('\n') };
    }

    return { variant: 'unsupported', message: `Format "${format}" is not supported` };
  },
};
