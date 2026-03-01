// DesignToken Concept Implementation [T]
// Hierarchical design tokens with alias chains, tier classification, and multi-format export.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number', 'shadow', 'strokeStyle', 'border', 'transition', 'gradient', 'typography', 'opacity', 'lineHeight', 'letterSpacing'];
const VALID_TIERS = ['primitive', 'semantic', 'component'];
const VALID_EXPORT_FORMATS = ['css', 'dtcg', 'scss', 'json', 'tailwind'];

export const designTokenHandler: ConceptHandler = {
  async define(input, storage) {
    const token = input.token as string;
    const name = input.name as string;
    const value = input.value as string;
    const type = input.type as string;
    const tier = input.tier as string;

    const existing = await storage.get('token', token);
    if (existing) {
      return { variant: 'duplicate', message: `Token "${token}" already exists` };
    }

    await storage.put('token', token, {
      name,
      value,
      type,
      tier,
      description: '',
      reference: '',
      group: '',
    });

    return { variant: 'ok', token };
  },

  async alias(input, storage) {
    const token = input.token as string;
    const name = input.name as string;
    const reference = input.reference as string;
    const tier = input.tier as string;

    // Verify referenced token exists
    const refToken = await storage.get('token', reference);
    if (!refToken) {
      return { variant: 'notfound', message: `Referenced token "${reference}" not found` };
    }

    // Check for alias cycles: walk the chain from reference
    let current = reference;
    const visited = new Set<string>([token]);
    while (current) {
      if (visited.has(current)) {
        return { variant: 'cycle', message: `Alias cycle detected involving "${current}"` };
      }
      visited.add(current);
      const node = await storage.get('token', current);
      if (!node || !(node.reference as string)) break;
      current = node.reference as string;
    }

    await storage.put('token', token, {
      name,
      value: '',
      type: refToken.type as string,
      tier,
      description: '',
      reference,
      group: '',
    });

    return { variant: 'ok', token };
  },

  async resolve(input, storage) {
    const token = input.token as string;

    const existing = await storage.get('token', token);
    if (!existing) {
      return { variant: 'notfound', message: `Token "${token}" not found` };
    }

    // Walk alias chain to resolve final value
    let current = token;
    const visited = new Set<string>();
    while (true) {
      if (visited.has(current)) {
        return { variant: 'broken', message: `Circular alias chain detected at "${current}"` };
      }
      visited.add(current);

      const node = await storage.get('token', current);
      if (!node) {
        return { variant: 'broken', message: `Broken alias chain: token "${current}" not found` };
      }

      const ref = node.reference as string;
      if (!ref) {
        // Reached a concrete value
        return { variant: 'ok', resolvedValue: node.value as string, type: node.type as string, tier: node.tier as string };
      }
      current = ref;
    }
  },

  async update(input, storage) {
    const token = input.token as string;
    const value = input.value as string;

    const existing = await storage.get('token', token);
    if (!existing) {
      return { variant: 'notfound', message: `Token "${token}" not found` };
    }

    await storage.put('token', token, {
      ...existing,
      value,
    });

    return { variant: 'ok' };
  },

  async remove(input, storage) {
    const token = input.token as string;

    const existing = await storage.get('token', token);
    if (!existing) {
      return { variant: 'notfound', message: `Token "${token}" not found` };
    }

    await storage.put('token', token, {
      ...existing,
      value: '',
      name: '',
      type: '',
      tier: '',
      reference: '',
      group: '',
      _deleted: true,
    });

    return { variant: 'ok' };
  },

  async export(input, storage) {
    const format = input.format as string;

    if (!VALID_EXPORT_FORMATS.includes(format)) {
      return { variant: 'unsupported', message: `Unsupported export format "${format}". Supported: ${VALID_EXPORT_FORMATS.join(', ')}` };
    }

    // Generate format-specific output placeholder
    let output: string;
    switch (format) {
      case 'css':
        output = ':root { /* CSS custom properties */ }';
        break;
      case 'dtcg':
        output = JSON.stringify({ $type: 'design-tokens', tokens: {} });
        break;
      case 'scss':
        output = '// SCSS token variables';
        break;
      case 'tailwind':
        output = JSON.stringify({ theme: { extend: {} } });
        break;
      case 'json':
        output = JSON.stringify({ tokens: {} });
        break;
      default:
        output = '';
    }

    return { variant: 'ok', output, format };
  },
};
