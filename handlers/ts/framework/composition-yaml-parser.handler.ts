// @migrated dsl-constructs 2026-03-18
// ============================================================
// CompositionYamlParser — Provider on SpecParser concept
//
// Parses composition.yaml files that declare cross-suite
// auto-application rules. At install time, ConceptBrowser
// generates real sync files from these rules (Section 2.4.3).
//
// See Architecture doc Section 2.4.3
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

export interface CompositionRule {
  when: string;          // trigger schema name (e.g., "Article")
  apply: string[];       // schemas to auto-apply (e.g., ["Commentable"])
  default: boolean;      // whether auto-applied by default
  condition?: string;    // optional guard expression
}

export interface CompositionYamlParseResult {
  compositions: CompositionRule[];
  errors: Array<{ message: string; path: string }>;
}

/**
 * Parse a raw YAML object into validated CompositionRules.
 */
export function parseCompositionYaml(raw: Record<string, unknown>): CompositionYamlParseResult {
  const errors: Array<{ message: string; path: string }> = [];
  const compositions: CompositionRule[] = [];

  if (!raw || typeof raw !== 'object') {
    errors.push({ message: 'composition.yaml must be a YAML object', path: '' });
    return { compositions, errors };
  }

  const compsRaw = raw.compositions as unknown[] | undefined;
  if (!compsRaw || !Array.isArray(compsRaw)) {
    errors.push({ message: 'composition.yaml must have a top-level "compositions" array', path: '' });
    return { compositions, errors };
  }

  for (let i = 0; i < compsRaw.length; i++) {
    const rule = compsRaw[i] as Record<string, unknown>;
    const path = `compositions[${i}]`;

    if (!rule || typeof rule !== 'object') {
      errors.push({ message: `Rule at index ${i} must be an object`, path });
      continue;
    }

    // Validate 'when' — required, must be a string
    if (!rule.when || typeof rule.when !== 'string') {
      errors.push({ message: `Rule at index ${i} must have a "when" string (trigger schema name)`, path: `${path}.when` });
      continue;
    }

    // Validate 'apply' — required, must be a non-empty array of strings
    if (!rule.apply || !Array.isArray(rule.apply) || rule.apply.length === 0) {
      errors.push({ message: `Rule at index ${i} must have a non-empty "apply" array`, path: `${path}.apply` });
      continue;
    }
    for (let j = 0; j < rule.apply.length; j++) {
      if (typeof rule.apply[j] !== 'string') {
        errors.push({ message: `apply[${j}] must be a string`, path: `${path}.apply[${j}]` });
      }
    }

    // Validate 'default' — required, must be boolean
    if (rule.default === undefined || typeof rule.default !== 'boolean') {
      errors.push({ message: `Rule at index ${i} must have a boolean "default" field`, path: `${path}.default` });
      continue;
    }

    // Self-application check
    const whenSchema = rule.when as string;
    const applySchemas = rule.apply as string[];
    if (applySchemas.includes(whenSchema)) {
      errors.push({ message: `Rule at index ${i}: schema "${whenSchema}" cannot auto-apply itself`, path: `${path}.apply` });
    }

    compositions.push({
      when: whenSchema,
      apply: applySchemas,
      default: rule.default as boolean,
      condition: rule.condition as string | undefined,
    });
  }

  // Check for circular compositions: if A applies B and B applies A
  const applyMap = new Map<string, Set<string>>();
  for (const comp of compositions) {
    for (const target of comp.apply) {
      if (!applyMap.has(comp.when)) applyMap.set(comp.when, new Set());
      applyMap.get(comp.when)!.add(target);
    }
  }
  for (const [from, targets] of applyMap) {
    for (const target of targets) {
      if (applyMap.has(target) && applyMap.get(target)!.has(from)) {
        errors.push({
          message: `Circular composition detected: "${from}" applies "${target}" and "${target}" applies "${from}"`,
          path: `compositions`,
        });
      }
    }
  }

  return { compositions, errors };
}

/**
 * Generate sync file content from a composition rule.
 * Section 2.4.3: each rule becomes a standard sync.
 */
export function generateCompositionSync(rule: CompositionRule): string {
  const lines: string[] = [];
  for (const targetSchema of rule.apply) {
    const syncName = `Composition_${rule.when}_${targetSchema}`;
    lines.push(`sync ${syncName} [eager]`);
    lines.push(`when {`);
    lines.push(`  Schema/applyTo: [ entity_id: ?id; schema: "${rule.when}" ] => [ ok: _ ]`);
    lines.push(`}`);
    lines.push(`then {`);
    lines.push(`  Schema/applyTo: [ entity_id: ?id; schema: "${targetSchema}" ]`);
    lines.push(`}`);
    lines.push('');
  }
  return lines.join('\n');
}

let counter = 0;
export function resetCompositionYamlParserCounter(): void { counter = 0; }

const _handler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      let p = createProgram();
      p = complete(p, 'error', { message: 'source must be a parsed YAML object', errors: [] as any });
      return p;
    }

    const result = parseCompositionYaml(source);

    if (result.errors.length > 0) {
      let p = createProgram();
      p = complete(p, 'error', {
        message: `composition.yaml has ${result.errors.length} validation error(s)`,
        errors: result.errors as any,
      });
      return p;
    }

    const id = `composition-yaml-${++counter}`;
    let p = createProgram();
    p = put(p, 'parsed_compositions', id, {
      id,
      compositions: result.compositions as any,
    });
    p = complete(p, 'ok', { id, compositions: result.compositions as any });
    return p;
  },

  validate(input: Record<string, unknown>) {
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      let p = createProgram();
      p = complete(p, 'error', { message: 'source must be a parsed YAML object', errors: [] as any });
      return p;
    }

    const result = parseCompositionYaml(source);
    if (result.errors.length > 0) {
      let p = createProgram();
      p = complete(p, 'invalid', { errors: result.errors as any });
      return p;
    }
    let p = createProgram();
    p = complete(p, 'ok', { rule_count: result.compositions.length });
    return p;
  },

  generateSyncs(input: Record<string, unknown>) {
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      let p = createProgram();
      p = complete(p, 'error', { message: 'source must be a parsed YAML object' });
      return p;
    }

    const result = parseCompositionYaml(source);
    if (result.errors.length > 0) {
      let p = createProgram();
      p = complete(p, 'error', { message: 'Cannot generate syncs from invalid composition.yaml', errors: result.errors as any });
      return p;
    }

    const syncFiles: Array<{ name: string; content: string }> = [];
    for (const rule of result.compositions) {
      if (!rule.default) continue; // Only generate syncs for default rules
      for (const targetSchema of rule.apply) {
        const name = `Composition_${rule.when}_${targetSchema}`;
        syncFiles.push({
          name: `${name}.sync`,
          content: generateCompositionSync({ ...rule, apply: [targetSchema] }),
        });
      }
    }

    let p = createProgram();
    p = complete(p, 'ok', { sync_files: syncFiles as any });
    return p;
  },
};

export const compositionYamlParserHandler = autoInterpret(_handler);
