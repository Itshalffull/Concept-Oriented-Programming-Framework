// @migrated dsl-constructs 2026-03-18
// Meeting Concept Handler
// Synchronous governance meetings following Roberts Rules of Order.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _meetingHandler: FunctionalConceptHandler = {
  schedule(input: Record<string, unknown>) {
    const id = `meeting-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'meeting', id, {
      id, title: input.title, scheduledAt: input.scheduledAt,
      circle: input.circle ?? null, status: 'Scheduled', agenda: [], minutes: [],
    });
    return complete(p, 'scheduled', { meeting: id }) as StorageProgram<Result>;
  },

  callToOrder(input: Record<string, unknown>) {
    const { meeting, chair } = input;
    let p = createProgram();
    p = get(p, 'meeting', meeting as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'InSession', chair, startedAt: new Date().toISOString() };
        }, 'updated');
        b2 = put(b2, 'meeting', meeting as string, {});
        return complete(b2, 'called_to_order', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  makeMotion(input: Record<string, unknown>) {
    const { meeting, mover, motion } = input;
    const id = `motion-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'motion', id, {
      id, meeting, mover, motion, status: 'Moved', movedAt: new Date().toISOString(),
    });
    return complete(p, 'motion_made', { motion: id }) as StorageProgram<Result>;
  },

  secondMotion(input: Record<string, unknown>) {
    const { motion, seconder } = input;
    let p = createProgram();
    p = get(p, 'motion', motion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Seconded', seconder };
        }, 'updated');
        b2 = put(b2, 'motion', motion as string, {});
        return complete(b2, 'seconded', { motion });
      },
      (b) => complete(b, 'not_found', { motion }),
    );

    return p as StorageProgram<Result>;
  },

  callQuestion(input: Record<string, unknown>) {
    const { motion } = input;
    let p = createProgram();
    p = get(p, 'motion', motion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Voting' };
        }, 'updated');
        b2 = put(b2, 'motion', motion as string, {});
        return complete(b2, 'question_called', { motion });
      },
      (b) => complete(b, 'not_found', { motion }),
    );

    return p as StorageProgram<Result>;
  },

  recordMinute(input: Record<string, unknown>) {
    const { meeting, content, recordedBy } = input;
    let p = createProgram();
    p = get(p, 'meeting', meeting as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          const minutes = [...(rec.minutes as unknown[])];
          minutes.push({ content, recordedBy, recordedAt: new Date().toISOString() });
          return { ...rec, minutes };
        }, 'updated');
        b2 = put(b2, 'meeting', meeting as string, {});
        return complete(b2, 'recorded', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  adjourn(input: Record<string, unknown>) {
    const { meeting } = input;
    let p = createProgram();
    p = get(p, 'meeting', meeting as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Adjourned', adjournedAt: new Date().toISOString() };
        }, 'updated');
        b2 = put(b2, 'meeting', meeting as string, {});
        return complete(b2, 'adjourned', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },
};

export const meetingHandler = autoInterpret(_meetingHandler);
