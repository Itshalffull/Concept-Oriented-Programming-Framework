// Element Concept Implementation
// Abstract interaction units for UI composition.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'element';

const VALID_KINDS = [
  'input-text',
  'input-number',
  'input-date',
  'input-bool',
  'selection-single',
  'selection-multi',
  'trigger',
  'navigation',
  'output-text',
  'output-number',
  'output-date',
  'output-bool',
  'group',
  'container',
  'rich-text',
  'file-upload',
  'media-display',
] as const;

const NESTABLE_KINDS = new Set(['group', 'container']);

export const elementHandler: ConceptHandler = {
  /**
   * create(element, kind, label, dataType) -> ok(element) | invalid(message)
   * Creates a new element after validating that the kind is recognized.
   */
  async create(input, storage) {
    const element = input.element as string;
    const kind = input.kind as string;
    const label = input.label as string;
    const dataType = input.dataType as string;

    if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) {
      return {
        variant: 'invalid',
        message: `Invalid element kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}`,
      };
    }

    await storage.put(RELATION, element, {
      element,
      kind,
      label,
      description: '',
      dataType,
      required: false,
      constraints: '{}',
      children: '[]',
      parent: null,
    });

    return { variant: 'ok', element };
  },

  /**
   * nest(parent, child) -> ok(parent) | invalid(message)
   * Adds a child element under a parent. Parent must be a group or container.
   */
  async nest(input, storage) {
    const parentId = input.parent as string;
    const childId = input.child as string;

    const parentEntry = await storage.get(RELATION, parentId);
    if (!parentEntry) {
      return { variant: 'invalid', message: `Parent element "${parentId}" does not exist` };
    }

    const parentKind = parentEntry.kind as string;
    if (!NESTABLE_KINDS.has(parentKind)) {
      return {
        variant: 'invalid',
        message: `Element "${parentId}" has kind "${parentKind}" which cannot contain children. Only group and container elements support nesting.`,
      };
    }

    const childEntry = await storage.get(RELATION, childId);
    if (!childEntry) {
      return { variant: 'invalid', message: `Child element "${childId}" does not exist` };
    }

    // Add child to parent's children list
    const children: string[] = JSON.parse((parentEntry.children as string) || '[]');
    if (!children.includes(childId)) {
      children.push(childId);
    }
    await storage.put(RELATION, parentId, {
      ...parentEntry,
      children: JSON.stringify(children),
    });

    // Set child's parent reference
    await storage.put(RELATION, childId, {
      ...childEntry,
      parent: parentId,
    });

    return { variant: 'ok', parent: parentId };
  },

  /**
   * setConstraints(element, constraints) -> ok(element) | notfound(message)
   * Assigns constraint metadata (e.g. maxLength, pattern) to an element.
   */
  async setConstraints(input, storage) {
    const element = input.element as string;
    const constraints = input.constraints as string;

    const existing = await storage.get(RELATION, element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" does not exist` };
    }

    await storage.put(RELATION, element, {
      ...existing,
      constraints,
    });

    return { variant: 'ok', element };
  },

  /**
   * remove(element) -> ok(element) | notfound(message)
   * Deletes an element after verifying it exists.
   */
  async remove(input, storage) {
    const element = input.element as string;

    const existing = await storage.get(RELATION, element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" does not exist` };
    }

    // If this element has a parent, remove it from the parent's children list
    const parentId = existing.parent as string | null;
    if (parentId) {
      const parentEntry = await storage.get(RELATION, parentId);
      if (parentEntry) {
        const children: string[] = JSON.parse((parentEntry.children as string) || '[]');
        const updated = children.filter(c => c !== element);
        await storage.put(RELATION, parentId, {
          ...parentEntry,
          children: JSON.stringify(updated),
        });
      }
    }

    await storage.del(RELATION, element);
    return { variant: 'ok', element };
  },
};
