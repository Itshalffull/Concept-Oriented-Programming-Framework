// @clef-handler style=functional concept=Undo export=undoHandler
// Undo handler — functional StorageProgram style
// Manages ephemeral time-limited undo offers using the toast pattern.
// After a reversible action completes, an offer is created with a TTL.
// The user may execute, dismiss, or let the offer expire.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _handler: FunctionalConceptHandler = {

  // Framework registration — returns concept name for PluginRegistry discovery.
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'Undo' });
  },

  offer(input: Record<string, unknown>) {
    const undo = String(input.undo ?? '');
    const entry = String(input.entry ?? '');
    const ttl = Number(input.ttl);

    if (!undo || undo.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'undo identifier is required' });
    }
    if (!entry || entry.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'entry is required' });
    }
    if (!Number.isInteger(ttl) || ttl <= 0) {
      return complete(createProgram(), 'invalid', { message: 'ttl must be a positive integer' });
    }

    // Parse entry to check if it has a reversalAction
    let parsedEntry: Record<string, unknown>;
    try {
      parsedEntry = JSON.parse(entry);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'entry is not valid JSON' });
    }

    const reversalAction = parsedEntry.reversalAction as string | undefined;
    if (reversalAction === undefined || reversalAction === null || reversalAction.trim() === '') {
      return complete(createProgram(), 'irreversible', {
        message: 'action has no reversal — cannot create an undo offer',
      });
    }

    let p = createProgram();
    p = get(p, 'offers', undo, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { message: `offer '${undo}' already exists` }),
      (b) => {
        const newOffer = put(b, 'offers', undo, {
          entry,
          ttl,
          status: 'offered',
          createdAt: Date.now(),
        });
        return complete(newOffer, 'ok', { undo });
      },
    );
  },

  execute(input: Record<string, unknown>) {
    const undo = String(input.undo ?? '');

    if (!undo || undo.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'undo identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'offers', undo, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `offer '${undo}' not found` }),
      (b) => {
        let p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const createdAt = (rec.createdAt as number) || 0;
          const ttlMs = (rec.ttl as number) || 0;
          const elapsed = Date.now() - createdAt;
          return { isExpired: elapsed > ttlMs, status: rec.status as string };
        }, '_check');

        return branch(p2,
          (bindings) => {
            const check = bindings._check as Record<string, unknown>;
            return check.isExpired === true || check.status === 'expired';
          },
          (b2) => complete(b2, 'expired', { message: 'undo offer has expired' }),
          (b2) => {
            const p3 = putFrom(b2, 'offers', undo, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return { ...existing, status: 'executed' };
            });
            return complete(p3, 'ok', { undo });
          },
        );
      },
    );
  },

  dismiss(input: Record<string, unknown>) {
    const undo = String(input.undo ?? '');

    if (!undo || undo.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'undo identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'offers', undo, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `offer '${undo}' not found` }),
      (b) => {
        const p2 = putFrom(b, 'offers', undo, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'dismissed' };
        });
        return complete(p2, 'ok', {});
      },
    );
  },

  expire(input: Record<string, unknown>) {
    const undo = String(input.undo ?? '');

    if (!undo || undo.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'undo identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'offers', undo, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `offer '${undo}' not found` }),
      (b) => {
        const p2 = putFrom(b, 'offers', undo, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'expired' };
        });
        return complete(p2, 'ok', {});
      },
    );
  },

  get(input: Record<string, unknown>) {
    const undo = String(input.undo ?? '');

    if (!undo || undo.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'undo identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'offers', undo, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `offer '${undo}' not found` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            entry: rec.entry as string,
            ttl: rec.ttl as number,
            status: rec.status as string,
          };
        });
      },
    );
  },
};

export const undoHandler = autoInterpret(_handler);
