// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_TRIGGER_TYPES = ['schedule', 'webhook', 'content_event', 'process_event', 'manual'];

/**
 * Safely coerce an input value to a string, returning empty string for
 * non-string types (e.g. ref placeholder objects passed by structural tests).
 */
function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

const _agentTriggerHandler: FunctionalConceptHandler = {
  /**
   * Create a new trigger rule binding a persona page to a trigger condition.
   * Validates personaPageId (non-empty) and triggerType (must be one of the
   * five recognised values). Starts enabled with fireCount 0.
   */
  create(input: Record<string, unknown>) {
    const personaPageId = toStr(input.personaPageId);
    const triggerType = toStr(input.triggerType);
    const triggerConfig = toStr(input.triggerConfig);
    const strategy = toStr(input.strategy);
    const tools = toStr(input.tools);
    const cooldownMs = (input.cooldownMs as number) ?? 0;

    if (!personaPageId || personaPageId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'personaPageId is required' }) as StorageProgram<Result>;
    }

    if (!triggerType || !VALID_TRIGGER_TYPES.includes(triggerType)) {
      return complete(createProgram(), 'invalid', {
        message: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate triggerConfig is parseable JSON
    try {
      JSON.parse(triggerConfig || '{}');
    } catch {
      return complete(createProgram(), 'invalid', {
        message: 'triggerConfig must be valid JSON',
      }) as StorageProgram<Result>;
    }

    const triggerId = `trigger:${personaPageId}:${triggerType}:${Date.now()}`;

    let p = createProgram();
    p = put(p, 'trigger', triggerId, {
      triggerId,
      personaPageId,
      triggerType,
      triggerConfig,
      strategy,
      tools,
      cooldownMs,
      enabled: true,
      fireCount: 0,
      lastFiredAt: null,
      history: '[]',
    });
    return complete(p, 'ok', { trigger: triggerId }) as StorageProgram<Result>;
  },

  /**
   * Fire the trigger if enabled and not in cooldown. Increments fireCount,
   * records lastFiredAt, and appends to firing history. Returns a sessionId
   * placeholder — actual AgentSession/spawn is handled via syncs.
   */
  fire(input: Record<string, unknown>) {
    const triggerId = toStr(input.trigger);
    const eventPayload = toStr(input.eventPayload);

    let p = createProgram();
    p = spGet(p, 'trigger', triggerId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Check disabled
        const rec = (b as unknown as Record<string, unknown>).existing as Record<string, unknown>;
        if (!rec) return complete(b, 'notfound', { message: `No trigger found: ${triggerId}` });

        if (!rec.enabled) {
          return complete(b, 'disabled', { message: 'Trigger is disabled and will not spawn a session until re-enabled.' });
        }

        // Check cooldown
        const cooldownMs = (rec.cooldownMs as number) || 0;
        const lastFiredAt = rec.lastFiredAt as string | null;
        if (cooldownMs > 0 && lastFiredAt) {
          const lastFiredTime = new Date(lastFiredAt).getTime();
          const now = Date.now();
          const elapsed = now - lastFiredTime;
          if (elapsed < cooldownMs) {
            const retryAfterMs = cooldownMs - elapsed;
            return complete(b, 'cooldown', {
              message: `Trigger fired too recently. Retry after ${retryAfterMs}ms.`,
              retryAfterMs,
            });
          }
        }

        const now = new Date().toISOString();
        const sessionId = `session:${triggerId}:${Date.now()}`;
        const newFireCount = ((rec.fireCount as number) || 0) + 1;

        // Append to history
        let history: Array<Record<string, unknown>> = [];
        try {
          history = JSON.parse((rec.history as string) || '[]') as Array<Record<string, unknown>>;
        } catch {
          history = [];
        }
        history.unshift({ timestamp: now, sessionId, eventPayload });

        let b2 = putFrom(b, 'trigger', triggerId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            fireCount: newFireCount,
            lastFiredAt: now,
            history: JSON.stringify(history),
          };
        });
        return complete(b2, 'ok', { trigger: triggerId, sessionId });
      },
      (b) => complete(b, 'notfound', { message: `No trigger found: ${triggerId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Set the trigger's enabled flag to true.
   */
  enable(input: Record<string, unknown>) {
    const triggerId = toStr(input.trigger);

    let p = createProgram();
    p = spGet(p, 'trigger', triggerId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'trigger', triggerId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, enabled: true };
        });
        return complete(b2, 'ok', { trigger: triggerId });
      },
      (b) => complete(b, 'notfound', { message: `No trigger found: ${triggerId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Set the trigger's enabled flag to false. Subsequent fire() calls will
   * return the disabled variant until re-enabled.
   */
  disable(input: Record<string, unknown>) {
    const triggerId = toStr(input.trigger);

    let p = createProgram();
    p = spGet(p, 'trigger', triggerId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'trigger', triggerId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, enabled: false };
        });
        return complete(b2, 'ok', { trigger: triggerId });
      },
      (b) => complete(b, 'notfound', { message: `No trigger found: ${triggerId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return all triggers as a JSON array, optionally filtered by personaPageId
   * and/or triggerType. Empty string values mean "no filter".
   */
  list(input: Record<string, unknown>) {
    const personaPageId = toStr(input.personaPageId);
    const triggerType = toStr(input.triggerType);

    const criteria: Record<string, unknown> = {};
    if (personaPageId && personaPageId.trim() !== '') {
      criteria['personaPageId'] = personaPageId;
    }
    if (triggerType && triggerType.trim() !== '') {
      criteria['triggerType'] = triggerType;
    }

    let p = createProgram();
    p = find(p, 'trigger', criteria, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      triggers: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },

  /**
   * Return the firing history for the trigger as a JSON array sorted
   * most-recent-first. Returns at most `limit` entries.
   */
  getHistory(input: Record<string, unknown>) {
    const triggerId = toStr(input.trigger);
    const limit = (input.limit as number) ?? 10;

    let p = createProgram();
    p = spGet(p, 'trigger', triggerId, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        let history: Array<Record<string, unknown>> = [];
        try {
          history = JSON.parse((rec.history as string) || '[]') as Array<Record<string, unknown>>;
        } catch {
          history = [];
        }
        const limited = limit > 0 ? history.slice(0, limit) : history;
        return { history: JSON.stringify(limited) };
      }),
      (b) => complete(b, 'notfound', { message: `No trigger found: ${triggerId}` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const agentTriggerHandler = autoInterpret(_agentTriggerHandler);
