// @clef-handler style=functional concept=PageMap export=pageMapHandler
// ============================================================
// PageMap Handler
//
// Maintain a labeled inventory of interactive elements within a hosted
// view, addressable by semantic label, role, or concept binding.
// Independently useful for accessibility auditing, integration testing,
// dev tools, and agent-driven UI navigation.
//
// Section 3.2 — Connected Bind and Surface Pilot
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, delMany, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  /**
   * register -- Add a new interactive element to the page map.
   *
   * Guard order:
   *   1. empty label   => error
   *   2. empty role    => error
   *   3. empty machineRef => error
   *   4. empty widgetName => error
   *   5. empty hostRef => error
   *   6. scan entries with matching hostRef; if any has same label => duplicate
   *   7. otherwise: write entry and return ok
   */
  register(input: Record<string, unknown>) {
    const entry = input.entry as string;
    const label = input.label as string;
    const role = input.role as string;
    const machineRef = input.machineRef as string;
    const widgetName = input.widgetName as string;
    const currentState = input.currentState as string;
    const validEvents = input.validEvents as string;
    const conceptBinding = (input.conceptBinding != null && input.conceptBinding !== 'none')
      ? input.conceptBinding as string
      : null;
    const affordanceServes = (input.affordanceServes != null && input.affordanceServes !== 'none')
      ? input.affordanceServes as string
      : null;
    const hostRef = input.hostRef as string;

    // Input validation guards
    if (!label || label.trim() === '') {
      return complete(createProgram(), 'error', { message: 'label is required' }) as StorageProgram<Result>;
    }
    if (!role || role.trim() === '') {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }
    if (!machineRef || machineRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'machineRef is required' }) as StorageProgram<Result>;
    }
    if (!widgetName || widgetName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'widgetName is required' }) as StorageProgram<Result>;
    }
    if (!hostRef || hostRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'hostRef is required' }) as StorageProgram<Result>;
    }

    // Scan all entries to check for duplicate label within the same host
    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');
    p = mapBindings(p, (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      return all.find(
        (e) => (e.hostRef as string) === hostRef && (e.label as string) === label,
      ) || null;
    }, '_existing');

    return branch(p,
      (bindings) => bindings._existing != null,
      (b) => complete(b, 'duplicate', {
        message: 'An entry with label "' + label + '" already exists in host "' + hostRef + '"',
      }),
      (b) => {
        let b2 = put(b, 'page_map_entry', entry, {
          entry,
          label,
          role,
          machineRef,
          widgetName,
          currentState,
          validEvents,
          conceptBinding,
          affordanceServes,
          hostRef,
        });
        return complete(b2, 'ok', { entry });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * update -- Overwrite the FSM state and valid event list for an existing entry.
   *
   * Returns notfound if no entry with the given id exists.
   */
  update(input: Record<string, unknown>) {
    const entry = input.entry as string;
    const currentState = input.currentState as string;
    const validEvents = input.validEvents as string;

    let p = createProgram();
    p = get(p, 'page_map_entry', entry, '_record');

    return branch(p,
      (bindings) => bindings._record == null,
      (b) => complete(b, 'notfound', {
        message: 'No entry exists with identifier "' + entry + '"',
      }),
      (b) => {
        let b2 = putFrom(b, 'page_map_entry', entry, (bindings) => {
          const existing = bindings._record as Record<string, unknown>;
          return {
            ...existing,
            currentState,
            validEvents,
          };
        });
        return complete(b2, 'ok', { entry });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * find -- Locate an element by label using case-insensitive substring matching.
   *
   * Scans all entries and returns the first whose label contains the input label
   * (case-insensitive). Returns notfound if no match is found.
   */
  find(input: Record<string, unknown>) {
    const label = input.label as string;

    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');
    p = mapBindings(p, (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      const needle = label.toLowerCase();
      return all.find((e) => (e.label as string).toLowerCase().includes(needle)) || null;
    }, '_found');

    return branch(p,
      (bindings) => bindings._found == null,
      (b) => complete(b, 'notfound', {
        message: 'No entry found matching label "' + label + '"',
      }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const found = bindings._found as Record<string, unknown>;
        return {
          entry: found.entry as string,
          machineRef: found.machineRef as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  /**
   * findByRole -- Return a JSON array of all entries whose role matches the given value.
   */
  findByRole(input: Record<string, unknown>) {
    const role = input.role as string;

    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      const matches = all.filter((e) => (e.role as string) === role);
      return { entries: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  /**
   * findByConcept -- Return a JSON array of all entries whose conceptBinding matches.
   */
  findByConcept(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      const matches = all.filter((e) => (e.conceptBinding as string | null) === concept);
      return { entries: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  /**
   * findByWidget -- Return a JSON array of all entries whose widgetName matches.
   */
  findByWidget(input: Record<string, unknown>) {
    const widgetName = input.widgetName as string;

    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      const matches = all.filter((e) => (e.widgetName as string) === widgetName);
      return { entries: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  /**
   * list -- Return a JSON array of all entries belonging to the given host.
   */
  list(input: Record<string, unknown>) {
    const hostRef = input.hostRef as string;

    let p = createProgram();
    p = find(p, 'page_map_entry', {}, '_allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries || []) as Array<Record<string, unknown>>;
      const matches = all.filter((e) => (e.hostRef as string) === hostRef);
      return { entries: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  /**
   * clear -- Remove all entries belonging to the given host.
   *
   * Uses delMany to atomically delete all entries matching hostRef.
   * Idempotent: returns ok even if the host has no entries.
   */
  clear(input: Record<string, unknown>) {
    const hostRef = input.hostRef as string;

    let p = createProgram();
    p = delMany(p, 'page_map_entry', { hostRef }, '_deletedCount');
    return complete(p, 'ok', { hostRef }) as StorageProgram<Result>;
  },

  /**
   * registerBinding -- Record a UIEventBinding reachable from the given host.
   *
   * Stores one row in the page_binding relation so that Pilot/snapshot can
   * surface the binding to agents. Called by widget handlers on mount.
   */
  registerBinding(input: Record<string, unknown>) {
    const entry   = input.entry   as string;
    const hostRef = input.hostRef as string;
    const binding = input.binding as string;
    const kind    = input.kind    as string;
    const target  = input.target  as string;
    const hint    = (input.hint != null && input.hint !== 'none')
      ? input.hint as string
      : null;

    if (!entry || entry.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entry is required' }) as StorageProgram<Result>;
    }
    if (!hostRef || hostRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'hostRef is required' }) as StorageProgram<Result>;
    }
    if (!binding || binding.trim() === '') {
      return complete(createProgram(), 'error', { message: 'binding is required' }) as StorageProgram<Result>;
    }
    if (!kind || kind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'page_binding', entry, '_existing');
    return branch(p,
      (b) => b._existing != null,
      (b) => complete(b, 'duplicate', {
        message: `A page binding with entry id "${entry}" already exists`,
      }),
      (b) => {
        const b2 = put(b, 'page_binding', entry, {
          entry,
          hostRef,
          binding,
          kind,
          target,
          hint,
        });
        return complete(b2, 'ok', { entry });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * bindingsForHost -- Return a JSON array of every UIEventBinding registered
   * against the given host.
   */
  bindingsForHost(input: Record<string, unknown>) {
    const hostRef = input.hostRef as string;

    let p = createProgram();
    p = find(p, 'page_binding', {}, '_allBindings');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allBindings || []) as Array<Record<string, unknown>>;
      const matches = all
        .filter((e) => (e.hostRef as string) === hostRef)
        .map((e) => ({
          binding: e.binding,
          kind:    e.kind,
          target:  e.target,
          hint:    e.hint,
        }));
      return { bindings: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  /**
   * clearBindings -- Remove all page bindings belonging to the given host.
   */
  clearBindings(input: Record<string, unknown>) {
    const hostRef = input.hostRef as string;

    let p = createProgram();
    p = delMany(p, 'page_binding', { hostRef }, '_deletedCount');
    return complete(p, 'ok', { hostRef }) as StorageProgram<Result>;
  },
};

export const pageMapHandler = autoInterpret(_handler);
