// @clef-handler style=functional
// Meeting Concept Implementation
// Structures synchronous collective discussion with formal procedure,
// agenda management, and motion handling.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `meeting-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Meeting' }) as StorageProgram<Result>;
  },

  schedule(input: Record<string, unknown>) {
    const title = input.title as string;
    const agenda = input.agenda as string[];

    if (!title || title.trim() === '') {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const agendaItems = (agenda || []).map((itemTitle: string) => ({
      itemTitle,
      itemType: 'general',
      presenter: null,
    }));

    let p = createProgram();
    p = put(p, 'meeting', id, {
      id,
      title,
      agenda: agendaItems,
      attendees: [],
      phase: 'Scheduled',
      motionStack: [],
      minutes: [],
    });
    return complete(p, 'ok', { meeting: id }) as StorageProgram<Result>;
  },

  callToOrder(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;
    const chair = input.chair as string;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'meeting', meetingId, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          return { ...rec, phase: 'Called', chair };
        });
        return complete(b2, 'ok', { meeting: meetingId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  makeMotion(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;
    const mover = input.mover as string;
    const motionType = input.motionType as string;
    const text = input.text as string;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          return (rec.motionStack as unknown[]).length;
        }, '_motionIndex');

        b2 = putFrom(b2, 'meeting', meetingId, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          const motionStack = [...(rec.motionStack as unknown[])];
          motionStack.push({
            motionText: text,
            motionType,
            mover,
            seconder: null,
            motionStatus: 'Pending',
          });
          return { ...rec, motionStack };
        });

        return completeFrom(b2, 'ok', (b) => ({
          meeting: meetingId,
          motionIndex: b._motionIndex,
        })) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  secondMotion(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;
    const seconder = input.seconder as string;
    const motionIndex = input.motionIndex as number;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          const stack = rec.motionStack as unknown[];
          return motionIndex >= 0 && motionIndex < stack.length ? stack[motionIndex] : null;
        }, '_motion');

        return branch(
          b2,
          (b) => !b._motion,
          complete(createProgram(), 'error', { message: 'Motion not found at given index' }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'meeting', meetingId, (b) => {
              const rec = b.meetingRecord as Record<string, unknown>;
              const stack = [...(rec.motionStack as Record<string, unknown>[])];
              stack[motionIndex] = { ...stack[motionIndex], seconder, motionStatus: 'Seconded' };
              return { ...rec, motionStack: stack };
            });
            return complete(b3, 'ok', { meeting: meetingId, motionIndex }) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  callQuestion(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'meeting', meetingId, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          const stack = [...(rec.motionStack as Record<string, unknown>[])];
          if (stack.length > 0) {
            stack[stack.length - 1] = { ...stack[stack.length - 1], motionStatus: 'ProceedingToVote' };
          }
          return { ...rec, motionStack: stack };
        });
        return complete(b2, 'ok', { meeting: meetingId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  recordMinute(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;
    const record = input.record as string;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'meeting', meetingId, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          const minutes = [...(rec.minutes as unknown[])];
          minutes.push({ record, timestamp: new Date().toISOString() });
          return { ...rec, minutes };
        });
        return complete(b2, 'ok', { meeting: meetingId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  adjourn(input: Record<string, unknown>) {
    const meetingId = input.meeting as string;

    if (!meetingId) {
      return complete(createProgram(), 'error', { message: 'meeting is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'meeting', meetingId, 'meetingRecord');

    return branch(
      p,
      (b) => !b.meetingRecord,
      complete(createProgram(), 'error', { message: 'Meeting not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'meeting', meetingId, (b) => {
          const rec = b.meetingRecord as Record<string, unknown>;
          return { ...rec, phase: 'Adjourned' };
        });
        return complete(b2, 'ok', { meeting: meetingId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const meetingHandler = autoInterpret(_handler);
