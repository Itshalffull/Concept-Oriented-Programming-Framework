import type { ConceptHandler } from '@clef/runtime';

export const outlineHandler: ConceptHandler = {
  async create(input, storage) {
    const node = input.node as string;
    const parent = (input.parent as string) || '';
    const existing = await storage.get('outline', node);
    if (existing) return { variant: 'exists', message: 'already exists' };
    const now = new Date().toISOString();
    await storage.put('outline', node, {
      node,
      parent,
      children: JSON.stringify([]),
      isCollapsed: false,
      order: 0,
      createdAt: now,
    });
    if (parent) {
      const parentRecord = await storage.get('outline', parent);
      if (parentRecord) {
        const children: string[] = JSON.parse(parentRecord.children as string);
        children.push(node);
        await storage.put('outline', parent, {
          ...parentRecord,
          children: JSON.stringify(children),
        });
      }
    }
    return { variant: 'ok', node };
  },

  async indent(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const parentId = existing.parent as string;
    if (!parentId) return { variant: 'invalid', message: 'No previous sibling to indent under' };
    const parentRecord = await storage.get('outline', parentId);
    if (!parentRecord) return { variant: 'invalid', message: 'No previous sibling to indent under' };
    const siblings: string[] = JSON.parse(parentRecord.children as string);
    const idx = siblings.indexOf(node);
    if (idx <= 0) return { variant: 'invalid', message: 'No previous sibling to indent under' };
    const newParentId = siblings[idx - 1];
    const newParentRecord = await storage.get('outline', newParentId);
    if (!newParentRecord) return { variant: 'invalid', message: 'No previous sibling to indent under' };
    siblings.splice(idx, 1);
    await storage.put('outline', parentId, {
      ...parentRecord,
      children: JSON.stringify(siblings),
    });
    const newChildren: string[] = JSON.parse(newParentRecord.children as string);
    newChildren.push(node);
    await storage.put('outline', newParentId, {
      ...newParentRecord,
      children: JSON.stringify(newChildren),
    });
    await storage.put('outline', node, {
      ...existing,
      parent: newParentId,
    });
    return { variant: 'ok', node };
  },

  async outdent(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const parentId = existing.parent as string;
    if (!parentId) return { variant: 'invalid', message: 'Node is already at root level' };
    const parentRecord = await storage.get('outline', parentId);
    if (!parentRecord) return { variant: 'invalid', message: 'Node is already at root level' };
    const grandparentId = parentRecord.parent as string;
    if (!grandparentId) return { variant: 'invalid', message: 'Node is already at root level' };
    const parentChildren: string[] = JSON.parse(parentRecord.children as string);
    const idx = parentChildren.indexOf(node);
    parentChildren.splice(idx, 1);
    await storage.put('outline', parentId, {
      ...parentRecord,
      children: JSON.stringify(parentChildren),
    });
    const grandparentRecord = await storage.get('outline', grandparentId);
    if (grandparentRecord) {
      const gpChildren: string[] = JSON.parse(grandparentRecord.children as string);
      const parentIdx = gpChildren.indexOf(parentId);
      gpChildren.splice(parentIdx + 1, 0, node);
      await storage.put('outline', grandparentId, {
        ...grandparentRecord,
        children: JSON.stringify(gpChildren),
      });
    }
    await storage.put('outline', node, {
      ...existing,
      parent: grandparentId,
    });
    return { variant: 'ok', node };
  },

  async moveUp(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const parentId = existing.parent as string;
    if (!parentId) return { variant: 'ok', node };
    const parentRecord = await storage.get('outline', parentId);
    if (!parentRecord) return { variant: 'ok', node };
    const siblings: string[] = JSON.parse(parentRecord.children as string);
    const idx = siblings.indexOf(node);
    if (idx > 0) {
      [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
      await storage.put('outline', parentId, {
        ...parentRecord,
        children: JSON.stringify(siblings),
      });
    }
    return { variant: 'ok', node };
  },

  async moveDown(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const parentId = existing.parent as string;
    if (!parentId) return { variant: 'ok', node };
    const parentRecord = await storage.get('outline', parentId);
    if (!parentRecord) return { variant: 'ok', node };
    const siblings: string[] = JSON.parse(parentRecord.children as string);
    const idx = siblings.indexOf(node);
    if (idx < siblings.length - 1) {
      [siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]];
      await storage.put('outline', parentId, {
        ...parentRecord,
        children: JSON.stringify(siblings),
      });
    }
    return { variant: 'ok', node };
  },

  async collapse(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    await storage.put('outline', node, {
      ...existing,
      isCollapsed: true,
    });
    return { variant: 'ok', node };
  },

  async expand(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    await storage.put('outline', node, {
      ...existing,
      isCollapsed: false,
    });
    return { variant: 'ok', node };
  },

  async reparent(input, storage) {
    const node = input.node as string;
    const newParent = input.newParent as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const newParentRecord = await storage.get('outline', newParent);
    if (!newParentRecord) return { variant: 'notfound', message: 'Parent not found' };
    const oldParentId = existing.parent as string;
    if (oldParentId) {
      const oldParentRecord = await storage.get('outline', oldParentId);
      if (oldParentRecord) {
        const oldChildren: string[] = JSON.parse(oldParentRecord.children as string);
        const idx = oldChildren.indexOf(node);
        if (idx >= 0) oldChildren.splice(idx, 1);
        await storage.put('outline', oldParentId, {
          ...oldParentRecord,
          children: JSON.stringify(oldChildren),
        });
      }
    }
    const newChildren: string[] = JSON.parse(newParentRecord.children as string);
    newChildren.push(node);
    await storage.put('outline', newParent, {
      ...newParentRecord,
      children: JSON.stringify(newChildren),
    });
    await storage.put('outline', node, {
      ...existing,
      parent: newParent,
    });
    return { variant: 'ok', node };
  },

  async getChildren(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('outline', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    return { variant: 'ok', children: existing.children as string };
  },
};
