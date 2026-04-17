// UIEventBinding handler — functional StorageProgram style
// Records and validates surface UI-event binding configuration.
// The handler does NOT dispatch UI effects — platform-specific surface
// adapters listen to UIEventBinding/invoke(ok) completions via syncs
// and perform the actual operation (navigate, open-modal, etc.).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_KINDS = new Set([
  'navigate',
  'open-modal',
  'close-modal',
  'dismiss',
  'focus',
  'scroll-to',
  'set-local-state',
  'emit-event',
  'toast',
]);

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'UIEventBinding' };
  },

  bind(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const kind    = input.kind    as string;
    const target  = input.target  as string;
    const params  = (input.params as string) ?? '{}';

    // Validate kind first
    if (!kind || !VALID_KINDS.has(kind.trim())) {
      return complete(createProgram(), 'invalid_kind', {
        message: `kind must be one of: ${[...VALID_KINDS].join(', ')}`,
      });
    }

    // Validate params is valid JSON
    try {
      JSON.parse(params);
    } catch {
      return complete(createProgram(), 'invalid_kind', {
        message: 'params must be valid JSON',
      });
    }

    // Check for duplicate
    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', {
        message: `UIEventBinding '${binding}' already exists`,
      }),
      (b) => {
        const b2 = put(b, 'bindings', binding, {
          binding,
          kind: kind.trim(),
          target,
          params,
        });
        return complete(b2, 'ok', { binding });
      },
    );
  },

  get(input: Record<string, unknown>) {
    const binding = input.binding as string;

    if (!binding) {
      return complete(createProgram(), 'notfound', { message: 'binding is required' });
    }

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    p = mapBindings(p, (bindings) => bindings.existing != null, '_found');
    return branch(p,
      '_found',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          binding: rec.binding ?? binding,
          kind:    rec.kind    as string,
          target:  rec.target  as string,
          params:  rec.params  as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {
        message: `UIEventBinding '${binding}' not found`,
      }),
    );
  },

  unbind(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', {
        message: `UIEventBinding '${binding}' not found`,
      }),
      (b) => {
        const dp = del(b, 'bindings', binding);
        return complete(dp, 'ok', {});
      },
    );
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'bindings', {}, 'all');
    return completeFrom(p, 'ok', (b) => {
      const items = (b.all || []) as Record<string, unknown>[];
      return { bindings: JSON.stringify(items) };
    });
  },

  invoke(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const context = (input.context as string) ?? '{}';

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', {
        message: `UIEventBinding '${binding}' not found`,
      }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          binding,
          kind:    rec.kind    as string,
          target:  rec.target  as string,
          params:  rec.params  as string,
          context,
        };
      }),
    );
  },

};

export const uiEventBindingHandler = autoInterpret(_handler);
