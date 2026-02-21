// Namespace Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const namespaceHandler: ConceptHandler = {
  async createNamespacedPage(input, storage) {
    const node = input.node as string;
    const path = input.path as string;

    const existing = await storage.get('namespace', node);
    if (existing) {
      return { variant: 'exists', message: 'A node already exists at this path' };
    }

    const segments = path.split('/');
    const parentPath = segments.length > 1
      ? segments.slice(0, -1).join('/')
      : '';

    await storage.put('namespace', node, {
      node,
      path,
      separator: '/',
      parent: parentPath,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async getChildren(input, storage) {
    const node = input.node as string;

    const existing = await storage.get('namespace', node);
    if (!existing) {
      return { variant: 'notfound', message: 'Node does not exist' };
    }

    const nodePath = existing.path as string;
    const allNodes = await storage.find('namespace');
    const children: string[] = [];

    for (const record of allNodes) {
      if (record.parent === nodePath && record.node !== node) {
        children.push(record.node as string);
      }
    }

    return { variant: 'ok', children: JSON.stringify(children) };
  },

  async getHierarchy(input, storage) {
    const node = input.node as string;

    const existing = await storage.get('namespace', node);
    if (!existing) {
      return { variant: 'notfound', message: 'Node does not exist' };
    }

    const nodePath = existing.path as string;
    const allNodes = await storage.find('namespace');
    const hierarchy: string[] = [node];

    const collectDescendants = (parentPath: string) => {
      for (const record of allNodes) {
        if (record.parent === parentPath && !hierarchy.includes(record.node as string)) {
          hierarchy.push(record.node as string);
          collectDescendants(record.path as string);
        }
      }
    };

    collectDescendants(nodePath);

    return { variant: 'ok', hierarchy: JSON.stringify(hierarchy) };
  },

  async move(input, storage) {
    const node = input.node as string;
    const newPath = input.newPath as string;

    const existing = await storage.get('namespace', node);
    if (!existing) {
      return { variant: 'notfound', message: 'Node does not exist' };
    }

    const segments = newPath.split('/');
    const parentPath = segments.length > 1
      ? segments.slice(0, -1).join('/')
      : '';

    await storage.put('namespace', node, {
      ...existing,
      path: newPath,
      parent: parentPath,
    });

    return { variant: 'ok' };
  },
};
