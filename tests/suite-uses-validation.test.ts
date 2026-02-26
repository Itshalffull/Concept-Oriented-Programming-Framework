// ============================================================
// Kit Uses Declaration — Parsing & Sync Reference Validation
//
// Tests:
// 1. parseUsesSection: parses uses entries from manifest YAML
// 2. parseUsesSection: handles empty and missing uses
// 3. parseLocalConceptNames: extracts concept names (list and map formats)
// 4. extractConceptRefs: extracts concept names from compiled syncs
// 5. Validation: syncs referencing only known concepts pass
// 6. Validation: syncs referencing undeclared concepts are caught
//
// See Architecture doc Section 9.1.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  parseUsesSection,
  parseLocalConceptNames,
  extractConceptRefs,
  getOptionalSyncPaths,
} from '../cli/src/commands/suite.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import type { CompiledSync } from '../runtime/types.js';

// ---- parseUsesSection ----

describe('parseUsesSection', () => {
  it('parses a single kit with multiple concepts', () => {
    const source = `
kit:
  name: test-kit
  version: 0.1.0

uses:
  - kit: auth
    concepts:
      - name: User
        params:
          U: { as: user-ref }
      - name: JWT

dependencies: []
`;
    const result = parseUsesSection(source);
    expect(result).toHaveLength(1);
    expect(result[0].kit).toBe('auth');
    expect(result[0].concepts).toHaveLength(2);
    expect(result[0].concepts[0].name).toBe('User');
    expect(result[0].concepts[0].params).toEqual({
      U: { as: 'user-ref' },
    });
    expect(result[0].concepts[1].name).toBe('JWT');
    expect(result[0].concepts[1].params).toBeUndefined();
  });

  it('parses multiple suites', () => {
    const source = `
uses:
  - kit: auth
    concepts:
      - name: User
  - kit: billing
    concepts:
      - name: Invoice
      - name: Payment

dependencies: []
`;
    const result = parseUsesSection(source);
    expect(result).toHaveLength(2);
    expect(result[0].kit).toBe('auth');
    expect(result[0].concepts).toHaveLength(1);
    expect(result[1].kit).toBe('billing');
    expect(result[1].concepts).toHaveLength(2);
    expect(result[1].concepts[0].name).toBe('Invoice');
    expect(result[1].concepts[1].name).toBe('Payment');
  });

  it('returns empty array when uses is missing', () => {
    const source = `
kit:
  name: test-kit
  version: 0.1.0

dependencies: []
`;
    expect(parseUsesSection(source)).toEqual([]);
  });

  it('returns empty array for uses: []', () => {
    const source = `
kit:
  name: test-kit

uses: []

dependencies: []
`;
    expect(parseUsesSection(source)).toEqual([]);
  });

  it('parses params with description', () => {
    const source = `
uses:
  - kit: content
    concepts:
      - name: Entity
        params:
          E: { as: entity-ref, description: "Reference to an entity" }
`;
    const result = parseUsesSection(source);
    expect(result[0].concepts[0].params).toEqual({
      E: { as: 'entity-ref', description: 'Reference to an entity' },
    });
  });

  it('parses optional flag', () => {
    const source = `
uses:
  - kit: auth
    optional: true
    concepts:
      - name: User
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: Ownership tracking
  - kit: billing
    concepts:
      - name: Invoice
`;
    const result = parseUsesSection(source);
    expect(result).toHaveLength(2);
    expect(result[0].optional).toBe(true);
    expect(result[0].syncs).toHaveLength(1);
    expect(result[0].syncs![0].path).toBe('./syncs/entity-ownership.sync');
    expect(result[1].optional).toBeUndefined();
    expect(result[1].syncs).toBeUndefined();
  });

  it('ignores comments within uses section', () => {
    const source = `
uses:
  # External auth concepts
  - kit: auth
    concepts:
      # The user concept
      - name: User
`;
    const result = parseUsesSection(source);
    expect(result).toHaveLength(1);
    expect(result[0].concepts[0].name).toBe('User');
  });
});

// ---- parseLocalConceptNames ----

describe('parseLocalConceptNames', () => {
  it('extracts names from list format', () => {
    const source = `
concepts:
  - name: Entity
    spec: entity.concept
  - name: Field
    spec: field.concept

syncs:
`;
    const names = parseLocalConceptNames(source);
    expect(names).toEqual(new Set(['Entity', 'Field']));
  });

  it('extracts names from map format', () => {
    const source = `
concepts:
  Entity:
    spec: ./entity.concept
    params:
      E: { as: entity-ref }
  Field:
    spec: ./field.concept

syncs:
`;
    const names = parseLocalConceptNames(source);
    expect(names.has('Entity')).toBe(true);
    expect(names.has('Field')).toBe(true);
    // Should not include sub-keys
    expect(names.has('spec')).toBe(false);
    expect(names.has('params')).toBe(false);
  });

  it('returns empty set when no concepts section', () => {
    const source = `
kit:
  name: empty
syncs:
`;
    expect(parseLocalConceptNames(source).size).toBe(0);
  });
});

// ---- extractConceptRefs ----

describe('extractConceptRefs', () => {
  it('extracts concepts from when, where, and then clauses', () => {
    const syncSource = `
sync TestSync [eager]
when {
  User/register: [ user: ?user ] => [ user: ?user ]
}
where {
  Profile: { ?profile owner: ?user }
}
then {
  Notification/send: [ target: ?user ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);
    expect(refs).toEqual(new Set(['User', 'Profile', 'Notification']));
  });

  it('extracts concept from when clause only', () => {
    const syncSource = `
sync SimpleSync [eager]
when {
  Web/request: [ method: "test" ] => [ id: ?id ]
}
then {
  Example/create: [ id: ?id ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);
    expect(refs).toEqual(new Set(['Web', 'Example']));
  });

  it('deduplicates concepts referenced multiple times', () => {
    const syncSource = `
sync DedupeSync [eager]
when {
  Entity/create: [ entity: ?e ] => [ entity: ?e ]
}
where {
  Entity: { ?e2 parent: ?e }
}
then {
  Entity/update: [ entity: ?e2 ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);
    // Entity appears in all three clauses but should only be counted once
    expect(refs).toEqual(new Set(['Entity']));
  });
});

// ---- getOptionalSyncPaths ----

describe('getOptionalSyncPaths', () => {
  it('extracts sync paths from optional uses entries', () => {
    const uses = parseUsesSection(`
uses:
  - kit: auth
    optional: true
    concepts:
      - name: User
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: test
`);
    const paths = getOptionalSyncPaths(uses, '/test/kit');
    expect(paths.size).toBe(1);
    const pathArray = [...paths];
    expect(pathArray[0]).toContain('entity-ownership.sync');
  });

  it('ignores required uses entries', () => {
    const uses = parseUsesSection(`
uses:
  - kit: auth
    concepts:
      - name: User
    syncs:
      - path: ./syncs/auth-check.sync
`);
    // No optional entries, so no optional sync paths
    const paths = getOptionalSyncPaths(uses, '/test/kit');
    expect(paths.size).toBe(0);
  });

  it('returns empty set when no uses', () => {
    const paths = getOptionalSyncPaths([], '/test/kit');
    expect(paths.size).toBe(0);
  });
});

// ---- Integration: validation scenarios ----

describe('Kit uses validation scenarios', () => {
  it('known concepts set includes local + uses + builtins', () => {
    // Simulate building the known set as kitValidate does
    const manifestSource = `
kit:
  name: test-kit

concepts:
  - name: Entity
    spec: entity.concept
  - name: Field
    spec: field.concept

uses:
  - kit: auth
    concepts:
      - name: User
      - name: JWT

dependencies: []
`;

    const localNames = parseLocalConceptNames(manifestSource);
    const uses = parseUsesSection(manifestSource);
    const usesNames = new Set<string>();
    for (const entry of uses) {
      for (const c of entry.concepts) {
        usesNames.add(c.name);
      }
    }

    const knownConcepts = new Set([
      ...localNames,
      ...usesNames,
      'Web',
    ]);

    expect(knownConcepts).toEqual(
      new Set(['Entity', 'Field', 'User', 'JWT', 'Web']),
    );
  });

  it('detects sync referencing undeclared external concept', () => {
    // Sync references "Notification" which is not local or in uses
    const syncSource = `
sync NotifyOnCreate [eager]
when {
  Entity/create: [ entity: ?e ] => [ entity: ?e ]
}
then {
  Notification/send: [ target: ?e ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);

    const knownConcepts = new Set(['Entity', 'Field', 'Web']);
    const unknownRefs = [...refs].filter(r => !knownConcepts.has(r));

    expect(unknownRefs).toEqual(['Notification']);
  });

  it('sync with only known concepts produces no unknowns', () => {
    const syncSource = `
sync CascadeDelete [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Field: { ?field target: ?entity }
}
then {
  Field/detach: [ field: ?field ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);

    const knownConcepts = new Set(['Entity', 'Field', 'Web']);
    const unknownRefs = [...refs].filter(r => !knownConcepts.has(r));

    expect(unknownRefs).toEqual([]);
  });

  it('uses concept referenced by sync is tracked', () => {
    const syncSource = `
sync AuthCheck [eager]
when {
  Web/request: [ method: "protected" ] => [ token: ?token ]
}
then {
  JWT/verify: [ token: ?token ]
}
`;
    const syncs = parseSyncFile(syncSource);
    const refs = extractConceptRefs(syncs[0]);

    const usesConceptNames = new Set(['JWT', 'User']);
    const referencedUsesNames = new Set<string>();
    for (const ref of refs) {
      if (usesConceptNames.has(ref)) {
        referencedUsesNames.add(ref);
      }
    }

    // JWT was referenced, User was not
    expect(referencedUsesNames).toEqual(new Set(['JWT']));

    // User is declared but unreferenced — would produce a warning
    const unusedUses = [...usesConceptNames].filter(
      n => !referencedUsesNames.has(n),
    );
    expect(unusedUses).toEqual(['User']);
  });
});
