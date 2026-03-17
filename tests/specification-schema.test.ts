// ============================================================
// SpecificationSchema Handler Tests
//
// Define, instantiate, validate, search, and manage reusable
// specification templates (Dwyer patterns, smart contract patterns,
// distributed system invariants) for generating formal properties
// from parameterized schemas.
// See Architecture doc Section 18.6
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { specificationSchemaHandler } from '../handlers/ts/suites/formal-verification/specification-schema.handler.js';

describe('SpecificationSchema Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  // Schema IDs captured during define
  let reentrancySchemaId: string;
  let overflowSchemaId: string;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----- run helper -----
  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // ----- helpers -----
  async function defineReentrancyGuard() {
    return run(
      specificationSchemaHandler.define!({
        name: 'reentrancy-guard',
        category: 'smart_contract',
        pattern_type: 'absence',
        template_text: 'always (call_depth(${function}) <= 1)',
        parameters: JSON.stringify([
          { name: 'function', type: 'String', description: 'Function to guard' },
        ]),
        formal_language: 'smtlib',
        description: 'Ensures a function cannot be re-entered during execution',
      }),
    );
  }

  async function defineOverflowCheck() {
    return run(
      specificationSchemaHandler.define!({
        name: 'overflow-check',
        category: 'smart_contract',
        pattern_type: 'safety',
        template_text: 'forall x: uint256 . (x + y <= MAX_UINT256)',
        parameters: JSON.stringify([]),
        formal_language: 'smtlib',
        description: 'Checks for arithmetic overflow conditions',
      }),
    );
  }

  // ----- define -----
  describe('define', () => {
    it('creates a schema with parameters and returns ok', async () => {
      const result = await defineReentrancyGuard();
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('reentrancy-guard');
      expect(result.category).toBe('smart_contract');
      expect(result.pattern_type).toBe('absence');
      expect(result.id).toBeDefined();
    });

    it('creates a schema without parameters', async () => {
      const result = await defineOverflowCheck();
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('overflow-check');
    });

    it('rejects an invalid category', async () => {
      const result = await run(
        specificationSchemaHandler.define!({
          name: 'bad-schema',
          category: 'not_a_valid_category',
          pattern_type: 'safety',
          template_text: 'some formula',
          parameters: JSON.stringify([]),
        }),
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Invalid category');
      expect(result.message).toContain('not_a_valid_category');
    });

    it('rejects missing required fields', async () => {
      const result = await run(
        specificationSchemaHandler.define!({
          name: '',
          category: 'smart_contract',
          pattern_type: 'safety',
          template_text: 'formula',
          parameters: JSON.stringify([]),
        }),
      );
      expect(result.variant).toBe('invalid');
    });
  });

  // ----- instantiate -----
  describe('instantiate', () => {
    it('fills template parameters and returns substituted text', async () => {
      const defined = await defineReentrancyGuard();
      reentrancySchemaId = defined.id as string;

      const result = await run(
        specificationSchemaHandler.instantiate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({ function: 'transfer' }),
        }),
      );
      expect(result.variant).toBe('ok');
      expect(result.instantiated_text).toBe('always (call_depth(transfer) <= 1)');
      expect(result.formal_language).toBe('smtlib');
      expect(result.fully_instantiated).toBe(true);
    });

    it('returns invalid when required parameter is absent', async () => {
      const defined = await defineReentrancyGuard();
      reentrancySchemaId = defined.id as string;

      const result = await run(
        specificationSchemaHandler.instantiate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({}),
        }),
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('function');
    });

    it('returns notfound for a non-existent schema_id', async () => {
      const result = await run(
        specificationSchemaHandler.instantiate!({
          schema_id: 'ss-does-not-exist',
          param_values: JSON.stringify({ function: 'foo' }),
        }),
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----- validate -----
  describe('validate', () => {
    it('validates correct parameters', async () => {
      const defined = await defineReentrancyGuard();
      reentrancySchemaId = defined.id as string;

      const result = await run(
        specificationSchemaHandler.validate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({ function: 'withdraw' }),
        }),
      );
      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(true);

      const missingParams = JSON.parse(result.missing_params as string);
      expect(missingParams).toHaveLength(0);

      const extraParams = JSON.parse(result.extra_params as string);
      expect(extraParams).toHaveLength(0);
    });

    it('detects missing parameters', async () => {
      const defined = await defineReentrancyGuard();
      reentrancySchemaId = defined.id as string;

      const result = await run(
        specificationSchemaHandler.validate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({}),
        }),
      );
      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(false);

      const missingParams = JSON.parse(result.missing_params as string);
      expect(missingParams.length).toBeGreaterThan(0);
      expect(missingParams).toContain('function');
    });

    it('detects unexpected extra parameters', async () => {
      const defined = await defineReentrancyGuard();
      reentrancySchemaId = defined.id as string;

      const result = await run(
        specificationSchemaHandler.validate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({ function: 'transfer', extra_param: 'bad' }),
        }),
      );
      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(false);

      const extraParams = JSON.parse(result.extra_params as string);
      expect(extraParams).toContain('extra_param');
    });

    it('returns notfound for a non-existent schema_id', async () => {
      const result = await run(
        specificationSchemaHandler.validate!({
          schema_id: 'ss-nonexistent',
          param_values: JSON.stringify({ function: 'foo' }),
        }),
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----- list_by_category -----
  describe('list_by_category', () => {
    it('returns schemas matching the specified category', async () => {
      await defineReentrancyGuard();
      await defineOverflowCheck();

      const result = await run(
        specificationSchemaHandler.list_by_category!({ category: 'smart_contract' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      expect(result.category).toBe('smart_contract');

      const items = JSON.parse(result.items as string);
      const names = items.map((i: any) => i.name);
      expect(names).toContain('reentrancy-guard');
      expect(names).toContain('overflow-check');
    });

    it('returns empty list for a category with no schemas', async () => {
      await defineReentrancyGuard();

      const result = await run(
        specificationSchemaHandler.list_by_category!({ category: 'dwyer_pattern' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);

      const items = JSON.parse(result.items as string);
      expect(items).toHaveLength(0);
    });
  });

  // ----- search -----
  describe('search', () => {
    it('finds schemas matching a name substring', async () => {
      await defineReentrancyGuard();
      await defineOverflowCheck();

      const result = await run(
        specificationSchemaHandler.search!({ query: 'reentrancy' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);

      const items = JSON.parse(result.items as string);
      expect(items[0].name).toBe('reentrancy-guard');
    });

    it('returns empty results for a query with no matches', async () => {
      await defineReentrancyGuard();
      await defineOverflowCheck();

      const result = await run(
        specificationSchemaHandler.search!({ query: 'nonexistent' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);

      const items = JSON.parse(result.items as string);
      expect(items).toHaveLength(0);
    });

    it('performs case-insensitive search', async () => {
      await defineReentrancyGuard();

      const result = await run(
        specificationSchemaHandler.search!({ query: 'REENTRANCY' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
    });

    it('searches across name, template, and description fields', async () => {
      await defineReentrancyGuard();

      // Search by description content
      const result = await run(
        specificationSchemaHandler.search!({ query: 're-entered' }),
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
    });

    it('rejects empty query string', async () => {
      const result = await run(
        specificationSchemaHandler.search!({ query: '' }),
      );
      expect(result.variant).toBe('invalid');
    });
  });

  // ----- integrated flow -----
  describe('end-to-end schema lifecycle', () => {
    it('define, instantiate, validate, list, search flow', async () => {
      // Define two schemas
      const r1 = await defineReentrancyGuard();
      const r2 = await defineOverflowCheck();
      reentrancySchemaId = r1.id as string;
      overflowSchemaId = r2.id as string;

      // Instantiate reentrancy-guard with function="transfer"
      const inst = await run(
        specificationSchemaHandler.instantiate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({ function: 'transfer' }),
        }),
      );
      expect(inst.variant).toBe('ok');
      expect(inst.instantiated_text).toBe('always (call_depth(transfer) <= 1)');

      // Validate with function="withdraw"
      const val = await run(
        specificationSchemaHandler.validate!({
          schema_id: reentrancySchemaId,
          param_values: JSON.stringify({ function: 'withdraw' }),
        }),
      );
      expect(val.variant).toBe('ok');
      expect(val.valid).toBe(true);

      // List by smart_contract category -> 2 schemas
      const listSc = await run(
        specificationSchemaHandler.list_by_category!({ category: 'smart_contract' }),
      );
      expect(listSc.count).toBe(2);

      // List by dwyer_pattern category -> 0 schemas
      const listDw = await run(
        specificationSchemaHandler.list_by_category!({ category: 'dwyer_pattern' }),
      );
      expect(listDw.count).toBe(0);

      // Search "reentrancy" -> 1 result
      const s1 = await run(
        specificationSchemaHandler.search!({ query: 'reentrancy' }),
      );
      expect(s1.count).toBe(1);

      // Search "nonexistent" -> 0 results
      const s2 = await run(
        specificationSchemaHandler.search!({ query: 'nonexistent' }),
      );
      expect(s2.count).toBe(0);
    });
  });
});
