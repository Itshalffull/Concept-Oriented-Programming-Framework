// Element Concept Implementation [E]
// UI elements with kind classification, nesting, constraints, interactors, and widget assignment.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_KINDS = ['field', 'group', 'layout', 'action', 'display', 'container', 'slot'];

export const elementHandler: ConceptHandler = {
  async create(input, storage) {
    const element = input.element as string;
    const kind = input.kind as string;
    const label = input.label as string;
    const dataType = input.dataType as string;

    if (!VALID_KINDS.includes(kind)) {
      return { variant: 'invalid', message: `Invalid element kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` };
    }

    const id = element || nextId('E');

    await storage.put('element', id, {
      kind,
      label,
      description: '',
      dataType: dataType || '',
      required: false,
      constraints: JSON.stringify({}),
      children: JSON.stringify([]),
      parent: '',
      interactorType: '',
      interactorProps: JSON.stringify({}),
      resolvedWidget: '',
    });

    return { variant: 'ok', element: id };
  },

  async nest(input, storage) {
    const parent = input.parent as string;
    const child = input.child as string;

    const parentEl = await storage.get('element', parent);
    if (!parentEl) {
      return { variant: 'invalid', message: `Parent element "${parent}" not found` };
    }

    const childEl = await storage.get('element', child);
    if (!childEl) {
      return { variant: 'invalid', message: `Child element "${child}" not found` };
    }

    // Prevent nesting into non-container kinds
    const parentKind = parentEl.kind as string;
    if (parentKind === 'field' || parentKind === 'action') {
      return { variant: 'invalid', message: `Cannot nest children into element of kind "${parentKind}"` };
    }

    // Prevent circular nesting
    if (parent === child) {
      return { variant: 'invalid', message: 'Cannot nest an element into itself' };
    }

    const children: string[] = JSON.parse((parentEl.children as string) || '[]');
    if (!children.includes(child)) {
      children.push(child);
    }

    await storage.put('element', parent, {
      ...parentEl,
      children: JSON.stringify(children),
    });

    await storage.put('element', child, {
      ...childEl,
      parent,
    });

    return { variant: 'ok' };
  },

  async setConstraints(input, storage) {
    const element = input.element as string;
    const constraints = input.constraints as string;

    const existing = await storage.get('element', element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" not found` };
    }

    await storage.put('element', element, {
      ...existing,
      constraints: typeof constraints === 'string' ? constraints : JSON.stringify(constraints),
    });

    return { variant: 'ok' };
  },

  async enrich(input, storage) {
    const element = input.element as string;
    const interactorType = input.interactorType as string;
    const interactorProps = input.interactorProps as string;

    const existing = await storage.get('element', element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" not found` };
    }

    await storage.put('element', element, {
      ...existing,
      interactorType,
      interactorProps: typeof interactorProps === 'string' ? interactorProps : JSON.stringify(interactorProps),
    });

    return { variant: 'ok' };
  },

  async assignWidget(input, storage) {
    const element = input.element as string;
    const widget = input.widget as string;

    const existing = await storage.get('element', element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" not found` };
    }

    await storage.put('element', element, {
      ...existing,
      resolvedWidget: widget,
    });

    return { variant: 'ok' };
  },

  async remove(input, storage) {
    const element = input.element as string;

    const existing = await storage.get('element', element);
    if (!existing) {
      return { variant: 'notfound', message: `Element "${element}" not found` };
    }

    // If element has a parent, remove from parent's children list
    const parentId = existing.parent as string;
    if (parentId) {
      const parentEl = await storage.get('element', parentId);
      if (parentEl) {
        const children: string[] = JSON.parse((parentEl.children as string) || '[]');
        const updated = children.filter(c => c !== element);
        await storage.put('element', parentId, {
          ...parentEl,
          children: JSON.stringify(updated),
        });
      }
    }

    await storage.put('element', element, {
      ...existing,
      _deleted: true,
    });

    return { variant: 'ok' };
  },
};
