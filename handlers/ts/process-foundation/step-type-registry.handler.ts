// @clef-handler style=functional
// StepTypeRegistry Concept Implementation
// Authoritative registry mapping process step kind identifiers to their
// UI descriptor records, consumed by FlowBuilder and ProcessRunView.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/** Storage relation name for this concept. */
const RELATION = 'step-type-registry';

/** Sentinel key used to record PluginRegistry self-registration. */
const REGISTERED_SENTINEL = '__registered';

/** Required fields every descriptor must supply. */
const REQUIRED_FIELDS = [
  'kind', 'label', 'icon', 'description', 'paletteSection', 'interactionWidget',
] as const;

/**
 * Parse and validate a descriptor JSON string.
 * Returns the parsed object on success, or an error message string on failure.
 */
function parseDescriptor(raw: string): Record<string, unknown> | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'Descriptor must be valid JSON';
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'Descriptor must be a JSON object';
  }
  const obj = parsed as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (!obj[field] || typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
      return `Descriptor is missing required field: ${field}`;
    }
  }
  return obj;
}

/**
 * Filter stored records to exclude internal sentinel entries.
 * A real descriptor record always has a 'kind' field that is a non-empty string.
 */
function isDescriptorRecord(rec: Record<string, unknown>): boolean {
  return typeof rec.kind === 'string' && rec.kind !== '' && rec.kind !== REGISTERED_SENTINEL;
}

const stepTypeRegistryHandler: FunctionalConceptHandler = {
  /**
   * PluginRegistry self-registration action (no concept-action params).
   * The runtime dispatch table reserves the name 'register' for this purpose.
   */
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, RELATION, REGISTERED_SENTINEL, 'existing');
    return branch(
      p,
      'existing',
      (b) => complete(b, 'already_registered', { name: 'StepTypeRegistry' }),
      (b) => {
        const b2 = put(b, RELATION, REGISTERED_SENTINEL, { value: true });
        return complete(b2, 'ok', { name: 'StepTypeRegistry' });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * registerType(descriptor: String) — store a step type descriptor.
   * Concept-spec action name: registerType.
   */
  registerType(input: Record<string, unknown>) {
    const raw = input.descriptor as string;
    const parsed = parseDescriptor(raw);
    if (typeof parsed === 'string') {
      return complete(createProgram(), 'error', { message: parsed }) as StorageProgram<Result>;
    }
    const kind = parsed.kind as string;

    let p = createProgram();
    p = get(p, RELATION, kind, 'existing');
    return branch(
      p,
      'existing',
      (b) => complete(b, 'duplicate', { kind }),
      (b) => {
        const b2 = put(b, RELATION, kind, { kind, ...parsed });
        return complete(b2, 'ok', { kind });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * update(kind: String, descriptor: String) — replace an existing descriptor.
   */
  update(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const raw = input.descriptor as string;

    const parsed = parseDescriptor(raw);
    if (typeof parsed === 'string') {
      return complete(createProgram(), 'error', { message: parsed }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, kind, 'existing');
    return branch(
      p,
      'existing',
      (b) => {
        const b2 = put(b, RELATION, kind, { kind, ...parsed });
        return complete(b2, 'ok', { kind });
      },
      (b) => complete(b, 'not_found', { kind }),
    ) as StorageProgram<Result>;
  },

  /**
   * unregister(kind: String) — remove a descriptor from the registry.
   */
  unregister(input: Record<string, unknown>) {
    const kind = input.kind as string;
    let p = createProgram();
    p = get(p, RELATION, kind, 'existing');
    return branch(
      p,
      'existing',
      (b) => {
        const b2 = del(b, RELATION, kind);
        return complete(b2, 'ok', { kind });
      },
      (b) => complete(b, 'not_found', { kind }),
    ) as StorageProgram<Result>;
  },

  /**
   * get(kind: String) — look up a descriptor by kind identifier.
   */
  get(input: Record<string, unknown>) {
    const kind = input.kind as string;
    let p = createProgram();
    p = get(p, RELATION, kind, 'existing');
    return branch(
      p,
      'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return { kind, descriptor: JSON.stringify(rec) };
      }),
      (b) => complete(b, 'not_found', { kind }),
    ) as StorageProgram<Result>;
  },

  /**
   * list() — return all registered descriptors.
   */
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, RELATION, {}, '_allEntries');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries as Array<Record<string, unknown>>) ?? [];
      const descriptors = all.filter(isDescriptorRecord);
      return { descriptors: JSON.stringify(descriptors) };
    }) as StorageProgram<Result>;
  },

  /**
   * listBySection(section: String) — return descriptors matching paletteSection.
   */
  listBySection(input: Record<string, unknown>) {
    const section = input.section as string;
    let p = createProgram();
    p = find(p, RELATION, {}, '_allEntries');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allEntries as Array<Record<string, unknown>>) ?? [];
      const matching = all.filter(
        (rec) => isDescriptorRecord(rec) && rec.paletteSection === section,
      );
      return { descriptors: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },
};

export { stepTypeRegistryHandler };
export default stepTypeRegistryHandler;
