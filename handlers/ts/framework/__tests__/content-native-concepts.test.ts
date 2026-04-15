import { describe, expect, it } from 'vitest';
import type { ConceptManifest } from '../../../../runtime/types';
import {
  isContentNative,
  listContentNativeConcepts,
} from '../content-native-concepts';

function mkConcept(name: string): ConceptManifest {
  return {
    uri: `concept://${name}`,
    name,
    typeParams: [],
    relations: [],
    actions: [],
    invariants: [],
    graphqlSchema: '',
    jsonSchemas: { invocations: {}, completions: {} },
    capabilities: [],
    purpose: '',
  } as ConceptManifest;
}

describe('listContentNativeConcepts', () => {
  it('returns concepts with matching schema names', () => {
    const concepts = [mkConcept('Canvas'), mkConcept('Workflow'), mkConcept('User')];
    const schemas = [{ schema: 'Canvas' }, { schema: 'Workflow' }];
    const result = listContentNativeConcepts(concepts, schemas);
    expect(result).toEqual(new Set(['Canvas', 'Workflow']));
  });

  it('returns empty set when no schemas match', () => {
    const concepts = [mkConcept('User')];
    const schemas = [{ schema: 'Canvas' }];
    expect(listContentNativeConcepts(concepts, schemas)).toEqual(new Set());
  });

  it('ignores schemas with no matching concept', () => {
    const concepts = [mkConcept('Canvas')];
    const schemas = [{ schema: 'Canvas' }, { schema: 'OrphanSchema' }];
    expect(listContentNativeConcepts(concepts, schemas)).toEqual(new Set(['Canvas']));
  });

  it('is case-sensitive', () => {
    const concepts = [mkConcept('Canvas')];
    const schemas = [{ schema: 'canvas' }];
    expect(listContentNativeConcepts(concepts, schemas)).toEqual(new Set());
  });

  it('handles empty inputs', () => {
    expect(listContentNativeConcepts([], [])).toEqual(new Set());
    expect(listContentNativeConcepts([mkConcept('X')], [])).toEqual(new Set());
    expect(listContentNativeConcepts([], [{ schema: 'X' }])).toEqual(new Set());
  });
});

describe('isContentNative', () => {
  it('returns true when a matching schema exists', () => {
    expect(isContentNative('Canvas', [{ schema: 'Canvas' }])).toBe(true);
  });

  it('returns false when no matching schema exists', () => {
    expect(isContentNative('Canvas', [{ schema: 'Workflow' }])).toBe(false);
  });

  it('returns false for empty schemas', () => {
    expect(isContentNative('Canvas', [])).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isContentNative('Canvas', [{ schema: 'canvas' }])).toBe(false);
  });

  it('matches among multiple schemas', () => {
    const schemas = [{ schema: 'A' }, { schema: 'B' }, { schema: 'Canvas' }];
    expect(isContentNative('Canvas', schemas)).toBe(true);
  });
});
