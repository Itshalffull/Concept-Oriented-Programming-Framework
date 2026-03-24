// @clef-handler style=functional
// ============================================================
// ProcessConversation Handler
//
// Bridge a Conversation to a ProcessRun so that chat messages
// drive step transitions and the conversation accumulates
// process context across steps. See PRD Section 3.3.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pc-${++idCounter}`;
}

let messageCounter = 0;
function nextMessageId(): string {
  return `msg-${++messageCounter}`;
}

let branchCounter = 0;
function nextBranchId(): string {
  return `branch-${++branchCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'process-conversation', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ProcessConversation' }),
      (b) => {
        let b2 = put(b, 'process-conversation', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ProcessConversation' });
      },
    );
  },

  bind(input: Record<string, unknown>) {
    const run = input.run as string;
    const conversation = input.conversation as string;
    const mode = input.mode as string;

    if (!run || !conversation) {
      return complete(createProgram(), 'fail', { reason: 'run and conversation are required' });
    }

    if (mode !== 'guided' && mode !== 'freeform') {
      return complete(createProgram(), 'fail', { reason: 'mode must be guided or freeform' });
    }

    // Check for duplicate binding on same run
    let p = createProgram();
    p = find(p, 'binding', { process_run: run }, 'existingBindings');

    return branch(p,
      (bindings) => {
        const existing = bindings.existingBindings as unknown[];
        return existing && existing.length > 0;
      },
      (b) => complete(b, 'fail', { reason: 'A binding already exists for this run' }),
      (b) => {
        const pc = nextId();
        let b2 = put(b, 'binding', pc, {
          id: pc,
          process_run: run,
          conversation,
          current_step: null,
          mode,
          delegate: `delegate-${pc}`,
          checkpoint_map: '{}',
        });
        return complete(b2, 'ok', { pc });
      },
    );
  },

  advance(input: Record<string, unknown>) {
    const pc = input.pc as string;
    const toStep = input.to_step as string;

    let p = createProgram();
    p = get(p, 'binding', pc, 'existing');

    return branch(p, 'existing',
      (b) => {
        const messageId = nextMessageId();
        // Update the binding with new step and checkpoint
        let b2 = putFrom(b, 'binding', pc, (bindings) => {
          const record = bindings.existing as Record<string, unknown>;
          const checkpointMap = JSON.parse((record.checkpoint_map as string) || '{}');
          checkpointMap[toStep] = `checkpoint-${messageId}`;
          return {
            ...record,
            current_step: toStep,
            checkpoint_map: JSON.stringify(checkpointMap),
          };
        });
        return complete(b2, 'ok', { pc, message_id: messageId });
      },
      (b) => complete(b, 'ok', { pc, message_id: '' }),
    );
  },

  rewind(input: Record<string, unknown>) {
    const pc = input.pc as string;
    const toStep = input.to_step as string;

    let p = createProgram();
    p = get(p, 'binding', pc, 'existing');

    return branch(p, 'existing',
      (b) => {
        const branchId = nextBranchId();
        let b2 = putFrom(b, 'binding', pc, (bindings) => {
          const record = bindings.existing as Record<string, unknown>;
          return {
            ...record,
            current_step: toStep,
          };
        });
        return complete(b2, 'ok', { pc, branch_id: branchId });
      },
      (b) => complete(b, 'ok', { pc, branch_id: '' }),
    );
  },

  delegate_edit(input: Record<string, unknown>) {
    const pc = input.pc as string;
    const actionRef = input.action_ref as string;
    const params = input.params as string;

    let p = createProgram();
    p = get(p, 'binding', pc, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Check delegate permissions — deny destructive actions by default
        const b2 = mapBindings(b, () => {
          const denied = actionRef.startsWith('delete') || actionRef.startsWith('destroy');
          return denied ? 'denied' : 'allowed';
        }, '_permission');
        return branch(b2, (bindings) => bindings._permission === 'denied',
          (b3) => complete(b3, 'denied', { pc, reason: 'Action is outside delegated permissions' }),
          (b3) => {
            let parsedParams: unknown;
            try {
              parsedParams = JSON.parse(params);
            } catch {
              parsedParams = params;
            }
            return complete(b3, 'ok', { pc, result: JSON.stringify(parsedParams) });
          },
        );
      },
      (b) => complete(b, 'denied', { pc, reason: 'Binding not found' }),
    );
  },

  complete_step(input: Record<string, unknown>) {
    const pc = input.pc as string;

    let p = createProgram();
    p = get(p, 'binding', pc, 'existing');

    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.existing as Record<string, unknown>;
          return { pc, step: (record.current_step as string) || '' };
        });
      },
      (b) => complete(b, 'fail', { pc, check_failures: 'Binding not found' }),
    );
  },
};

export const processConversationHandler = autoInterpret(_handler);
