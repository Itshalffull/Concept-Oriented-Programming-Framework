// @clef-handler style=functional concept=KeyBinding export=keyBindingHandler
// KeyBinding handler — functional StorageProgram style
// Manages keyboard shortcut registrations, resolves key events to
// action-binding identifiers, and stores per-user/per-workspace chord overrides.
//
// NOTE: The concept action `register` matches the handler lifecycle method name.
// The `register` method here implements the concept action. The conformance test
// generator detects this case and skips lifecycle introspection gracefully.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// Hierarchical scope path: lowercase letter, then alphanumeric segments separated by dots.
const SCOPE_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

interface KeyStroke {
  mod: string[];
  key: string;
  code: string;
}

function strokesEqual(a: KeyStroke[], b: KeyStroke[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i], sb = b[i];
    if (!sa || !sb) return false;
    if (sa.key !== sb.key || sa.code !== sb.code) return false;
    const ma = [...(sa.mod ?? [])].sort();
    const mb = [...(sb.mod ?? [])].sort();
    if (ma.join(',') !== mb.join(',')) return false;
  }
  return true;
}

type Result = { variant: string; [key: string]: unknown };

// Resolve a key event against a list of registered bindings.
// Returns { type: 'match'|'partial'|'none', ... }.
function resolveAgainstBindings(
  all: Array<Record<string, unknown>>,
  scope: string,
  eventKey: string,
  eventCode: string,
  modifiers: string[],
  prefix: KeyStroke[],
): { type: 'match'; actionBinding: string; params: Uint8Array }
  | { type: 'partial'; prefix: KeyStroke[] }
  | { type: 'none' } {
  const scopeParts = scope.split('.');

  // Candidates: bindings whose scope equals or is an ancestor of the event scope
  const candidates = all.filter((rec) => {
    const bScope = String((rec as any).scope ?? '');
    const bParts = bScope.split('.');
    if (bParts.length > scopeParts.length) return false;
    return bParts.every((part: string, i: number) => part === scopeParts[i]);
  });

  // Most-specific scope first, then highest priority
  candidates.sort((a, c) => {
    const aLen = String((a as any).scope ?? '').split('.').length;
    const cLen = String((c as any).scope ?? '').split('.').length;
    if (cLen !== aLen) return cLen - aLen;
    return Number((c as any).priority ?? 0) - Number((a as any).priority ?? 0);
  });

  const modSorted = [...modifiers].sort();
  const currentStroke: KeyStroke = { mod: modSorted, key: eventKey, code: eventCode };

  for (const rec of candidates) {
    const chord = (rec as any).chord as KeyStroke[] | undefined;
    if (!Array.isArray(chord) || chord.length === 0) continue;

    // If we have a prefix, verify it matches the start of this chord
    if (Array.isArray(prefix) && prefix.length > 0) {
      if (!strokesEqual(chord.slice(0, prefix.length), prefix)) continue;
    }

    const nextStroke = chord[prefix.length];
    if (!nextStroke) continue;

    const strokeMatch =
      nextStroke.key === eventKey &&
      nextStroke.code === eventCode &&
      [...(nextStroke.mod ?? [])].sort().join(',') === modSorted.join(',');

    if (!strokeMatch) continue;

    const newPrefix = [...(Array.isArray(prefix) ? prefix : []), currentStroke];

    if (newPrefix.length === chord.length) {
      const paramsStr = (rec as any).params != null ? JSON.stringify((rec as any).params) : '{}';
      const paramsBytes = new TextEncoder().encode(paramsStr);
      return { type: 'match', actionBinding: String((rec as any).actionBinding ?? ''), params: paramsBytes };
    } else {
      return { type: 'partial', prefix: newPrefix };
    }
  }

  return { type: 'none' };
}

const _handler: FunctionalConceptHandler = {

  // ─── Concept action: register ────────────────────────────────────────────
  // Validates label, scope, chord, phase; detects duplicates and conflicts.
  register(input: Record<string, unknown>) {
    const binding = String(input.binding ?? '');
    const label = String(input.label ?? '');
    const description = input.description != null && input.description !== 'none' && input.description !== false
      ? String(input.description) : null;
    const category = String(input.category ?? '');
    const scope = String(input.scope ?? '');
    const priority = Number(input.priority ?? 0);
    // Accept either a parsed array (from JS callers) or a JSON string (from YAML seed loader).
    const chord = (() => {
      if (Array.isArray(input.chord)) return input.chord as KeyStroke[];
      if (typeof input.chord === 'string' && input.chord.trim().startsWith('[')) {
        try { return JSON.parse(input.chord) as KeyStroke[]; } catch { /* fall through */ }
      }
      return [] as KeyStroke[];
    })();
    const phase = String(input.phase ?? '');
    const onlyOutsideTextInput = input.onlyOutsideTextInput === true || input.onlyOutsideTextInput === 'true';
    const overridesBrowser = input.overridesBrowser === true || input.overridesBrowser === 'true';
    const actionBinding = String(input.actionBinding ?? '');
    const params = input.params != null && input.params !== 'none' && input.params !== false ? input.params : null;

    if (!label || label.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'label is required',
      }) as StorageProgram<Result>;
    }
    if (!SCOPE_RE.test(scope)) {
      return complete(createProgram(), 'error', {
        message: 'scope must match /^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)*$/',
      }) as StorageProgram<Result>;
    }
    if (chord.length === 0) {
      return complete(createProgram(), 'error', {
        message: 'chord must be a non-empty list of KeyStroke',
      }) as StorageProgram<Result>;
    }
    if (phase !== 'capture' && phase !== 'bubble') {
      return complete(createProgram(), 'error', {
        message: 'phase must be "capture" or "bubble"',
      }) as StorageProgram<Result>;
    }

    // Duplicate check: is this exact binding id already registered?
    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'duplicate', {
        message: `A binding with id '${binding}' is already registered.`,
      }) as StorageProgram<Result>,
      (b) => {
        // Conflict check: find all bindings and look for scope+chord+priority collision
        let b2 = find(b, 'bindings', {}, 'allBindings');

        // Compute whether a conflict exists and which id it is
        b2 = mapBindings(b2, (bindings) => {
          const all = (bindings.allBindings as Array<Record<string, unknown>>) ?? [];
          const conflicting = all.find((rec) => {
            const r = rec as { id: string; scope: string; chord: KeyStroke[]; priority: number };
            return (
              r.id !== binding &&
              r.scope === scope &&
              Number(r.priority) === priority &&
              strokesEqual(r.chord as KeyStroke[], chord)
            );
          });
          return conflicting ? (conflicting as any).id : null;
        }, '_conflictId');

        return branch(b2,
          (bindings) => bindings._conflictId != null,
          (b3) => completeFrom(b3, 'conflict', (bindings) => ({
            binding: bindings._conflictId as string,
            message: `Binding '${bindings._conflictId as string}' already uses the same scope, chord, and priority.`,
          })) as StorageProgram<Result>,
          (b3) => {
            const stored = put(b3, 'bindings', binding, {
              id: binding,
              label,
              description,
              category,
              scope,
              priority,
              chord,
              phase,
              onlyOutsideTextInput,
              overridesBrowser,
              actionBinding,
              params,
            });
            return complete(stored, 'ok', { binding }) as StorageProgram<Result>;
          },
        ) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // ─── Concept action: deregister ──────────────────────────────────────────
  deregister(input: Record<string, unknown>) {
    const binding = String(input.binding ?? '');

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      'existing',
      (b) => {
        const removed = del(b, 'bindings', binding);
        const cleared1 = del(removed, 'userChord', binding);
        const cleared2 = del(cleared1, 'workspaceChord', binding);
        return complete(cleared2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'not_found', {
        message: `No binding '${binding}' is registered.`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // ─── Concept action: resolveKey ──────────────────────────────────────────
  // Walks the override chain per §3.6 of the PRD (KB-11):
  //   1. User override chord (userChord relation)
  //   2. Workspace override chord (workspaceChord relation)
  //   3. Seed default chord (bindings relation)
  // First non-null wins. Resolution uses the effective chord for matching.
  resolveKey(input: Record<string, unknown>) {
    const scope = String(input.scope ?? '');
    const eventKey = String(input.eventKey ?? '');
    const eventCode = String(input.eventCode ?? '');
    const modifiers = Array.isArray(input.modifiers)
      ? (input.modifiers as string[]) : [];
    // Accept null, undefined, false, 'none', or empty string as "no chord state".
    const chordStateRaw =
      input.chordState != null &&
      input.chordState !== false &&
      input.chordState !== 'none' &&
      input.chordState !== ''
        ? String(input.chordState) : null;

    let prefix: KeyStroke[] = [];
    if (chordStateRaw) {
      try {
        const parsed = JSON.parse(chordStateRaw);
        if (Array.isArray(parsed)) prefix = parsed as KeyStroke[];
      } catch { /* ignore */ }
    }

    let p = createProgram();
    p = find(p, 'bindings', {}, 'allBindings');
    p = find(p, 'userChord', {}, 'allUserOverrides');
    p = find(p, 'workspaceChord', {}, 'allWorkspaceOverrides');

    // Build effective bindings: override chain applied per record.
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allBindings as Array<Record<string, unknown>>) ?? [];
      const userChordMap = new Map(
        ((bindings.allUserOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      const workspaceChordMap = new Map(
        ((bindings.allWorkspaceOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      // Produce a copy of each binding with its effective chord substituted.
      return all.map((rec) => {
        const id = String((rec as any).id ?? '');
        const effectiveChord =
          userChordMap.get(id) ??
          workspaceChordMap.get(id) ??
          ((rec as any).chord as KeyStroke[]);
        return { ...(rec as object), chord: effectiveChord };
      });
    }, '_effectiveBindings');

    // Compute the resolution result from the effective bindings at runtime
    p = mapBindings(p, (bindings) => {
      const effective = (bindings._effectiveBindings as Array<Record<string, unknown>>) ?? [];
      return resolveAgainstBindings(effective, scope, eventKey, eventCode, modifiers, prefix);
    }, '_resolution');

    // Branch on the resolution type
    return branch(p,
      (bindings) => (bindings._resolution as any)?.type === 'match',
      (b) => completeFrom(b, 'match', (bindings) => {
        const res = bindings._resolution as { type: 'match'; actionBinding: string; params: Uint8Array };
        return { actionBinding: res.actionBinding, params: res.params };
      }) as StorageProgram<Result>,
      (b) => branch(b,
        (bindings) => (bindings._resolution as any)?.type === 'partial',
        (b2) => completeFrom(b2, 'partial', (bindings) => {
          const res = bindings._resolution as { type: 'partial'; prefix: KeyStroke[] };
          return { prefix: res.prefix };
        }) as StorageProgram<Result>,
        (b2) => complete(b2, 'none', {}) as StorageProgram<Result>,
      ) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // ─── Concept action: list ────────────────────────────────────────────────
  // Returns all registered bindings with override chain applied.
  // Satisfies admin routes that call KeyBinding/list without a scope argument.
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'bindings', {}, 'allBindings');
    p = find(p, 'userChord', {}, 'allUserOverrides');
    p = find(p, 'workspaceChord', {}, 'allWorkspaceOverrides');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allBindings as Array<Record<string, unknown>>) ?? [];
      const userChordMap = new Map(
        ((bindings.allUserOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      const workspaceChordMap = new Map(
        ((bindings.allWorkspaceOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      const listed = all
        .sort((a, c) => Number((c as any).priority ?? 0) - Number((a as any).priority ?? 0))
        .map((r) => {
          const id = String((r as any).id ?? '');
          const userChord = userChordMap.get(id) ?? null;
          const workspaceChord = workspaceChordMap.get(id) ?? null;
          return {
            ...(r as object),
            binding: id,
            userChord,
            workspaceChord,
            isModified: userChord !== null,
          };
        });
      return { bindings: listed };
    }) as StorageProgram<Result>;
  },

  // ─── Concept action: listByScope ─────────────────────────────────────────
  // Returns full binding records (not just ids) so callers can read
  // userChord / workspaceChord override fields for display (KB-11).
  listByScope(input: Record<string, unknown>) {
    const scope = String(input.scope ?? '');

    let p = createProgram();
    p = find(p, 'bindings', {}, 'allBindings');
    p = find(p, 'userChord', {}, 'allUserOverrides');
    p = find(p, 'workspaceChord', {}, 'allWorkspaceOverrides');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allBindings as Array<Record<string, unknown>>) ?? [];
      const userChordMap = new Map(
        ((bindings.allUserOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      const workspaceChordMap = new Map(
        ((bindings.allWorkspaceOverrides as Array<Record<string, unknown>>) ?? []).map(
          (o) => [String((o as any).id ?? ''), (o as any).chord as KeyStroke[] | undefined],
        ),
      );
      const scopeParts = scope ? scope.split('.') : null;
      const matched = all
        .filter((rec) => {
          // Empty scope means "all scopes" (used by KeybindingEditor to show all bindings)
          if (!scopeParts) return true;
          const bParts = String((rec as any).scope ?? '').split('.');
          if (scopeParts.length > bParts.length) return false;
          return scopeParts.every((part: string, i: number) => part === bParts[i]);
        })
        .sort((a, c) => Number((c as any).priority ?? 0) - Number((a as any).priority ?? 0))
        .map((r) => {
          const id = String((r as any).id ?? '');
          const userChord = userChordMap.get(id) ?? null;
          const workspaceChord = workspaceChordMap.get(id) ?? null;
          return {
            ...(r as object),
            binding: id,
            userChord,
            workspaceChord,
            // isModified: true when user has an active override
            isModified: userChord !== null,
          };
        });
      return { bindings: matched };
    }) as StorageProgram<Result>;
  },

  // ─── Concept action: listByCategory ──────────────────────────────────────
  listByCategory(input: Record<string, unknown>) {
    const category = String(input.category ?? '');

    let p = createProgram();
    p = find(p, 'bindings', {}, 'allBindings');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allBindings as Array<Record<string, unknown>>) ?? [];
      const matched = all
        .filter((rec) => (rec as any).category === category)
        .sort((a, c) => String((a as any).label ?? '').localeCompare(String((c as any).label ?? '')))
        .map((r) => String((r as any).id ?? ''));
      return { bindings: matched };
    }) as StorageProgram<Result>;
  },

  // ─── Concept action: setOverride ─────────────────────────────────────────
  // Writes the override to:
  //   1. Internal relation (userChord / workspaceChord) — used by
  //      resolveKey and listByScope for fast in-handler lookups.
  //   2. A cross-concept-readable propertyOverrides relation keyed by
  //      "keybinding-override:<binding-id>:<scope>" so that external concepts
  //      (e.g. a sync that calls Property/set) can observe override state
  //      without coupling directly to KeyBinding storage (KB-11 §3.6).
  setOverride(input: Record<string, unknown>) {
    const binding = String(input.binding ?? '');
    const scope = String(input.scope ?? '');
    const chord = Array.isArray(input.chord) ? (input.chord as KeyStroke[]) : [];

    if (scope !== 'user' && scope !== 'workspace') {
      return complete(createProgram(), 'error', {
        message: 'scope must be "user" or "workspace"',
      }) as StorageProgram<Result>;
    }
    if (chord.length === 0) {
      return complete(createProgram(), 'error', {
        message: 'chord must be non-empty',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      'existing',
      (b) => {
        const relation = scope === 'user' ? 'userChord' : 'workspaceChord';
        // Internal override storage — fast lookup for resolveKey / listByScope.
        let b2 = put(b, relation, binding, { id: binding, chord });
        // Cross-concept Property key: "keybinding-override:<binding-id>".
        // Scope is embedded in the relation key so user and workspace don't collide.
        const propertyKey = `keybinding-override:${binding}:${scope}`;
        // propertyOverrides side-channel omitted: relation not declared in
        // spec, and the userChord/workspaceChord relations are sufficient for
        // resolveKey + listByScope. Cross-concept Property observability is a
        // follow-up if needed.
        void propertyKey;
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'error', {
        message: `No binding '${binding}' is registered.`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // ─── Concept action: clearOverride ───────────────────────────────────────
  // Removes the override from both the internal relation and the cross-concept
  // propertyOverrides relation (keeping the two stores in sync with setOverride).
  clearOverride(input: Record<string, unknown>) {
    const binding = String(input.binding ?? '');
    const scope = String(input.scope ?? '');

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      'existing',
      (b) => {
        const relation = scope === 'user' ? 'userChord' : 'workspaceChord';
        let b2 = get(b, relation, binding, 'override');
        return branch(b2,
          'override',
          (b3) => {
            let cleared = del(b3, relation, binding);
            // propertyOverrides side-channel removed — see setOverride note.
            return complete(cleared, 'ok', {}) as StorageProgram<Result>;
          },
          (b3) => complete(b3, 'not_found', {
            message: `No ${scope} override exists for binding '${binding}'.`,
          }) as StorageProgram<Result>,
        ) as StorageProgram<Result>;
      },
      (b) => complete(b, 'not_found', {
        message: `No binding '${binding}' is registered.`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

};

export const keyBindingHandler = autoInterpret(_handler);
export default keyBindingHandler;
