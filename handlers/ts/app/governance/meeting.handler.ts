// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Meeting Concept Handler
// Synchronous governance meetings following Roberts Rules of Order.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _meetingHandler: FunctionalConceptHandler = {
  schedule(input: Record<string, unknown>) {
    if (!input.title || (typeof input.title === 'string' && (input.title as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }
    if (!input.agenda || (typeof input.agenda === 'string' && (input.agenda as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'agenda is required' }) as StorageProgram<Result>;
    }
    const id = `meeting-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'meeting', id, {
      id, title: input.title, scheduledAt: input.scheduledAt,
      circle: input.circle ?? null, status: 'Scheduled', agenda: input.agenda ?? [], minutes: [],
    });
    return complete(p, 'ok', { id, meeting: id }) as StorageProgram<Result>;
  },

  callToOrder(input: Record<string, unknown>) {
    const meeting = input.meeting as string;
    if (!meeting || (typeof meeting === 'string' && meeting.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }
    const { chair } = input;
    let p = createProgram();
    p = get(p, 'meeting', meeting, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'InSession', chair, startedAt: new Date().toISOString() };
        }, 'updated');
        b2 = putFrom(b2, 'meeting', meeting, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  makeMotion(input: Record<string, unknown>) {
    const meeting = input.meeting as string;
    if (!meeting || (typeof meeting === 'string' && meeting.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }
    const { mover, motionType, text } = input;
    const id = `motion-${Date.now()}`;
    let p = createProgram();
    p = get(p, 'meeting', meeting, 'meetingRecord');

    p = branch(p, 'meetingRecord',
      (b) => {
        let b2 = put(b, 'motion', id, {
          id, meeting, mover, motionType, text, status: 'Moved', movedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { motion: id });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  secondMotion(input: Record<string, unknown>) {
    const meeting = input.meeting as string;
    const motionIndex = input.motionIndex as string;
    const seconder = input.seconder as string;
    if (!meeting || (typeof meeting === 'string' && meeting.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'meeting', meeting, 'meetingRecord');

    p = branch(p, 'meetingRecord',
      (b) => {
        return complete(b, 'ok', { meeting, motionIndex });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  callQuestion(input: Record<string, unknown>) {
    const meeting = input.meeting as string;
    let p = createProgram();
    p = get(p, 'meeting', meeting, 'record');

    p = branch(p, 'record',
      (b) => {
        return complete(b, 'ok', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },

  recordMinute(input: Record<string, unknown>) {
    const meeting = input.meeting as string;
    const record = input.record as string;
    if (!meeting || (typeof meeting === 'string' && meeting.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'meeting', meeting, 'meetingRecord');

    p = branch(p, 'meetingRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.meetingRecord as Record<string, unknown>;
          const minutes = [...((rec.minutes as unknown[]) || [])];
          minutes.push({ content: record, recordedAt: new Date().toISOString() });
          return { ...rec, minutes };
        }, 'updated');
        b2 = putFrom(b2, 'meeting', meeting, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { meeting });
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
        b2 = putFrom(b2, 'meeting', meeting as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { meeting });
      },
      (b) => complete(b, 'not_found', { meeting }),
    );

    return p as StorageProgram<Result>;
  },
};

export const meetingHandler = autoInterpret(_meetingHandler);
