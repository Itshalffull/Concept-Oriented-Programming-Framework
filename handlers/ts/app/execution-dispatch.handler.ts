// @clef-handler style=functional
// ============================================================
// ExecutionDispatch Handler
//
// Resolve how a process step actually executes based on actor
// type, permissions, process configuration, and user preference.
// Resolution logic: human+human -> work_item,
// ai_conversational -> chat, ai_autonomous -> agent_loop,
// ai_triggered -> llm_call, else fall through to spec_mode.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, mergeFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_RESOLVED_MODES = new Set([
  'work_item', 'llm_call', 'agent_loop', 'chat',
  'approval', 'subprocess', 'automation', 'webhook_wait',
]);

const VALID_ACTOR_TYPES = new Set([
  'human', 'ai_autonomous', 'ai_triggered', 'ai_conversational',
]);

let idCounter = 0;
function nextId(): string {
  return `ed-${++idCounter}`;
}

/**
 * Resolve the execution mode for a step given the actor type and spec mode.
 *
 * Resolution logic (per PRD Section 3.4):
 * 1. human + human spec_mode -> work_item
 * 2. ai_conversational -> chat
 * 3. ai_autonomous -> agent_loop
 * 4. ai_triggered -> llm_call
 * 5. Otherwise, fall through to spec_mode default
 */
function resolveMode(actorType: string, specMode: string): string {
  if (actorType === 'human' && specMode === 'human') return 'work_item';
  if (actorType === 'ai_conversational') return 'chat';
  if (actorType === 'ai_autonomous') return 'agent_loop';
  if (actorType === 'ai_triggered') return 'llm_call';
  return specMode;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'execution-dispatch', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ExecutionDispatch' }),
      (b) => {
        let b2 = put(b, 'execution-dispatch', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ExecutionDispatch' });
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const step = input.step as string;
    const actor = input.actor as string;
    const specMode = input.spec_mode as string;
    const actorType = input.actor_type as string;

    if (!step || step.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'step reference is required',
      }) as StorageProgram<Result>;
    }
    if (!actor || actor.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'actor reference is required',
      }) as StorageProgram<Result>;
    }
    if (!specMode) {
      return complete(createProgram(), 'error', {
        message: 'spec_mode is required',
      }) as StorageProgram<Result>;
    }
    if (!actorType || !VALID_ACTOR_TYPES.has(actorType)) {
      return complete(createProgram(), 'error', {
        message: `invalid actor_type: ${actorType}`,
      }) as StorageProgram<Result>;
    }

    const resolvedMode = resolveMode(actorType, specMode);
    const edId = nextId();

    let p = createProgram();
    p = put(p, 'dispatch', edId, {
      id: edId,
      step_ref: step,
      spec_mode: specMode,
      actor_type: actorType,
      resolved_mode: resolvedMode,
      actor_ref: actor,
    });
    return complete(p, 'ok', {
      ed: edId,
      resolved_mode: resolvedMode,
    }) as StorageProgram<Result>;
  },

  override(input: Record<string, unknown>) {
    const ed = input.ed as string;
    const newMode = input.new_mode as string;
    const justification = input.justification as string;

    if (!newMode || !VALID_RESOLVED_MODES.has(newMode)) {
      return complete(createProgram(), 'error', {
        message: `invalid resolved mode: ${newMode}`,
      }) as StorageProgram<Result>;
    }

    if (!justification || justification.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'justification is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'dispatch', ed, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'dispatch', ed, () => ({
          resolved_mode: newMode,
          override_justification: justification,
        }));
        return complete(b2, 'ok', { ed }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {
        message: `no dispatch record found for: ${ed}`,
      }),
    ) as StorageProgram<Result>;
  },
};

export const executionDispatchHandler = autoInterpret(_handler);
