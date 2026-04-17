// @clef-handler style=functional concept=PilotMode export=pilotModeHandler
// PilotMode Concept Handler
// Governance-owned restriction profiles for Pilot sessions.
// Each mode encodes a JSON-encoded set of restricted verbs that
// Pilot consults via PilotMode/check before delegating any surface
// action. The check is a bounded-environment gate distinct from the
// principal's ambient Authorization grants (see agents-as-subjects
// refactor-plan §9.3).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function parseRestrictions(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    for (const v of parsed) {
      if (typeof v !== 'string') return null;
    }
    return parsed as string[];
  } catch {
    return null;
  }
}

const _pilotModeHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const restrictions = (input.restrictions as string) ?? '';

    if (!mode || (typeof mode === 'string' && mode.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'mode is required' }) as StorageProgram<Result>;
    }
    const parsed = parseRestrictions(restrictions);
    if (parsed === null) {
      return complete(createProgram(), 'error', {
        message: 'restrictions must be a JSON array of strings',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'pilot-mode', mode, { mode, restrictions });
    return complete(p, 'ok', { mode }) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const verb = input.verb as string;

    let p = createProgram();
    p = get(p, 'pilot-mode', mode, 'modeRecord');
    return branch(p, 'modeRecord',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.modeRecord as Record<string, unknown>;
        const parsed = parseRestrictions((record.restrictions as string) ?? '[]');
        const restricted = parsed ?? [];
        const allowed = !restricted.includes(verb);
        return { allowed };
      }),
      (elseP) => complete(elseP, 'notfound', { mode }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'pilot-mode', {}, 'allModes');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allModes as Array<Record<string, unknown>>) || [];
      const out = all.map((r) => ({
        mode: r.mode as string,
        restrictions: (r.restrictions as string) ?? '[]',
      }));
      return { modes: JSON.stringify(out) };
    }) as StorageProgram<Result>;
  },
};

export const pilotModeHandler = autoInterpret(_pilotModeHandler);
