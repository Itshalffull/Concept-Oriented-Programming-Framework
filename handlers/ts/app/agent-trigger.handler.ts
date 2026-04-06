// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
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
   *
   * Uses mapBindings to derive _enabled and _cooldownStatus from the stored
   * record, then uses nested branch() calls to select the correct variant.
   */
  fire(input: Record<string, unknown>) {
    const triggerId = toStr(input.trigger);
    const eventPayload = toStr(input.eventPayload);
    const now = new Date().toISOString();
    const sessionId = `session:${triggerId}:${Date.now()}`;

    let p = createProgram();
    p = spGet(p, 'trigger', triggerId, 'existing');

    // Derive enabled flag from the stored record
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.enabled as boolean) : null;
    }, '_enabled');

    // Derive cooldown status: null = no cooldown, number = retryAfterMs
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      if (!rec) return null;
      const cooldownMs = (rec.cooldownMs as number) || 0;
      const lastFiredAt = rec.lastFiredAt as string | null;
      if (cooldownMs > 0 && lastFiredAt) {
        const lastFiredTime = new Date(lastFiredAt).getTime();
        const elapsed = Date.now() - lastFiredTime;
        if (elapsed < cooldownMs) {
          return cooldownMs - elapsed;
        }
      }
      return 0;
    }, '_retryAfterMs');

    p = branch(p, 'existing',
      (b) => {
        // Trigger found — check enabled
        return branch(b,
          (bindings) => bindings._enabled === false,
          (_disabled) => complete(_disabled, 'disabled', {
            message: 'Trigger is disabled and will not spawn a session until re-enabled.',
          }) as StorageProgram<Result>,
          (enabled) => {
            // Enabled — check cooldown
            return branch(enabled,
              (bindings) => (bindings._retryAfterMs as number) > 0,
              (cooldown) => completeFrom(cooldown, 'cooldown', (bindings) => ({
                message: `Trigger fired too recently. Retry after ${bindings._retryAfterMs as number}ms.`,
                retryAfterMs: bindings._retryAfterMs as number,
              })) as StorageProgram<Result>,
              (ok) => {
                // Ready to fire — update record
                let b2 = putFrom(ok, 'trigger', triggerId, (bindings) => {
                  const existing = bindings.existing as Record<string, unknown>;
                  const fireCount = ((existing.fireCount as number) || 0) + 1;
                  let history: Array<Record<string, unknown>> = [];
                  try {
                    history = JSON.parse((existing.history as string) || '[]') as Array<Record<string, unknown>>;
                  } catch {
                    history = [];
                  }
                  history.unshift({ timestamp: now, sessionId, eventPayload });
                  return {
                    ...existing,
                    fireCount,
                    lastFiredAt: now,
                    history: JSON.stringify(history),
                  };
                });
                return complete(b2, 'ok', { trigger: triggerId, sessionId }) as StorageProgram<Result>;
              },
            );
          },
        );
      },
      (b) => complete(b, 'notfound', { message: `No trigger found: ${triggerId}` }) as StorageProgram<Result>,
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
