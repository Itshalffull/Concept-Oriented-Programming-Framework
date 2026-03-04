// ============================================================
// WidgetResolver Handler Tests
//
// Tests for widget-resolver: resolve, resolveAll, override,
// setWeights, and explain actions. Validates scoring logic,
// override precedence, weight customization, ambiguity
// detection, and explanation trace generation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { widgetResolverHandler } from '../../handlers/ts/app/widget-resolver.handler.js';
import type { ConceptStorage } from '@clef/runtime';

// ----------------------------------------------------------
// In-memory TestStorage
//
// The handler calls storage.find('affordance', element) where
// element is a string. The find() method returns ALL entries
// from the given relation -- handlers do their own filtering.
// ----------------------------------------------------------
function createTestStorage(): ConceptStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();

  function getRelation(name: string): Map<string, Record<string, unknown>> {
    let rel = data.get(name);
    if (!rel) {
      rel = new Map();
      data.set(name, rel);
    }
    return rel;
  }

  return {
    async put(relation: string, key: string, value: Record<string, unknown>) {
      getRelation(relation).set(key, { ...value });
    },
    async get(relation: string, key: string) {
      const entry = getRelation(relation).get(key);
      return entry ? { ...entry } : null;
    },
    async find(relation: string) {
      const rel = getRelation(relation);
      return Array.from(rel.values()).map(e => ({ ...e }));
    },
    async del(relation: string, key: string) {
      getRelation(relation).delete(key);
    },
    async delMany(relation: string, criteria: Record<string, unknown>) {
      const rel = getRelation(relation);
      let count = 0;
      for (const [key, entry] of rel.entries()) {
        if (Object.entries(criteria).every(([k, v]) => entry[k] === v)) {
          rel.delete(key);
          count++;
        }
      }
      return count;
    },
  };
}

// Helper to bind handler methods so `this` refers to widgetResolverHandler
const handler = {
  resolve: widgetResolverHandler.resolve!.bind(widgetResolverHandler),
  resolveAll: widgetResolverHandler.resolveAll!.bind(widgetResolverHandler),
  override: widgetResolverHandler.override!.bind(widgetResolverHandler),
  setWeights: widgetResolverHandler.setWeights!.bind(widgetResolverHandler),
  explain: widgetResolverHandler.explain!.bind(widgetResolverHandler),
};

describe('WidgetResolver Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  // ==========================================================
  // resolve
  // ==========================================================
  describe('resolve', () => {
    it('returns none when no affordances exist', async () => {
      const result = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('none');
      expect(result.message).toBe('No widgets found for element "title"');
    });

    it('returns ok with a single matching affordance', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'TextInput',
        specificity: 80,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'name', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('TextInput');
      expect(result.score).toBeGreaterThan(0);
    });

    it('scores specificity correctly with default weights', async () => {
      // Default weights: specificity=0.4, conditionMatch=0.3, popularity=0.2, recency=0.1
      // Specificity 50 => (50/100) * 0.4 = 0.2
      // No conditions => conditionMatch weight is added fully = 0.3
      // Total = 0.5
      await storage.put('affordance', 'aff1', {
        widget: 'Slider',
        specificity: 50,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'volume', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.5);
    });

    it('scores condition matching correctly', async () => {
      // 2 conditions, 1 matches => conditionMatch = (1/2) * 0.3 = 0.15
      // Specificity 0 => 0 * 0.4 = 0
      // Total = 0.15
      await storage.put('affordance', 'aff1', {
        widget: 'DatePicker',
        specificity: 0,
        conditions: JSON.stringify({ platform: 'web', locale: 'en' }),
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'date', context: JSON.stringify({ platform: 'web' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.15);
    });

    it('gives full conditionMatch score when no conditions defined', async () => {
      // No conditions => full conditionMatch weight (0.3) is added
      // Specificity 100 => (100/100) * 0.4 = 0.4
      // Total = 0.7
      await storage.put('affordance', 'aff1', {
        widget: 'Toggle',
        specificity: 100,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'enabled', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.7);
    });

    it('selects highest-scoring widget when multiple affordances exist', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'BasicInput',
        specificity: 20,
        conditions: '{}',
      });
      await storage.put('affordance', 'aff2', {
        widget: 'RichInput',
        specificity: 90,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'content', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('RichInput');
    });

    it('returns ambiguous when top candidates have equal scores', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'WidgetA',
        specificity: 50,
        conditions: '{}',
      });
      await storage.put('affordance', 'aff2', {
        widget: 'WidgetB',
        specificity: 50,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'field', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ambiguous');
      expect(result.candidates).toBeDefined();
      const candidates = JSON.parse(result.candidates as string);
      expect(candidates).toHaveLength(2);
      expect(candidates[0].score).toBe(candidates[1].score);
    });

    it('applies manual override when one exists', async () => {
      // Set up override via storage directly
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: JSON.stringify({ title: 'CustomTitleWidget' }),
        defaultContext: '{}',
        scoringWeights: '{}',
      });
      // Also add an affordance that would otherwise win
      await storage.put('affordance', 'aff1', {
        widget: 'DefaultTitle',
        specificity: 100,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('CustomTitleWidget');
      expect(result.score).toBe(1.0);
      expect(result.reason).toBe('Manual override applied');
    });

    it('uses custom scoring weights from resolver record', async () => {
      // Custom weights: specificity=0.8, conditionMatch=0.2
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: JSON.stringify({ specificity: 0.8, conditionMatch: 0.2 }),
      });
      await storage.put('affordance', 'aff1', {
        widget: 'HighSpecWidget',
        specificity: 100,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'field', context: '{}' },
        storage,
      );
      // specificity: (100/100)*0.8 = 0.8, conditionMatch: 0.2 (no conditions, full weight)
      // Total = 1.0
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(1.0);
    });

    it('handles missing context gracefully (empty JSON)', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'TextWidget',
        specificity: 60,
        conditions: JSON.stringify({ theme: 'dark' }),
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'label', context: '' },
        storage,
      );
      // context is '{}' after fallback; condition theme=dark not matched
      // conditionMatch = 0/1 * 0.3 = 0
      // specificity = 60/100 * 0.4 = 0.24
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.24);
    });

    it('gives correct reason string format', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'Widget1',
        specificity: 75,
        conditions: JSON.stringify({ mode: 'edit', role: 'admin' }),
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'field', context: JSON.stringify({ mode: 'edit' }) },
        storage,
      );
      expect(result.reason).toBe('specificity=75, conditionMatch=1/2');
    });

    it('matches all conditions when context has them all', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'FullMatch',
        specificity: 0,
        conditions: JSON.stringify({ a: '1', b: '2', c: '3' }),
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'f', context: JSON.stringify({ a: '1', b: '2', c: '3' }) },
        storage,
      );
      // conditionMatch = 3/3 * 0.3 = 0.3, specificity = 0
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.3);
      expect(result.reason).toBe('specificity=0, conditionMatch=3/3');
    });

    it('skips null-valued conditions in match calculation', async () => {
      // null conditions are not counted
      await storage.put('affordance', 'aff1', {
        widget: 'PartialCond',
        specificity: 0,
        conditions: JSON.stringify({ active: true, deprecated: null }),
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'f', context: JSON.stringify({ active: true }) },
        storage,
      );
      // Only 1 non-null condition (active), 1 match => 1/1 * 0.3 = 0.3
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.3);
      expect(result.reason).toBe('specificity=0, conditionMatch=1/1');
    });

    it('defaults specificity to 0 when not provided', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'NoSpec',
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'e', context: '{}' },
        storage,
      );
      // specificity 0 => 0, conditionMatch => 0.3
      // Total = 0.3
      expect(result.variant).toBe('ok');
      expect(result.score).toBe(0.3);
    });
  });

  // ==========================================================
  // resolveAll
  // ==========================================================
  describe('resolveAll', () => {
    it('returns ok when all elements resolve', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'TextWidget',
        specificity: 80,
        conditions: '{}',
      });

      const result = await handler.resolveAll(
        {
          resolver: 'r1',
          elements: JSON.stringify(['title', 'subtitle']),
          context: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const resolutions = JSON.parse(result.resolutions as string);
      expect(resolutions).toHaveLength(2);
      expect(resolutions[0].element).toBe('title');
      expect(resolutions[1].element).toBe('subtitle');
      expect(resolutions[0].widget).toBe('TextWidget');
    });

    it('returns partial when some elements cannot resolve', async () => {
      // No affordances at all -- all elements will be unresolved
      const result = await handler.resolveAll(
        {
          resolver: 'r1',
          elements: JSON.stringify(['header', 'footer']),
          context: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('partial');
      const unresolved = JSON.parse(result.unresolved as string);
      expect(unresolved).toContain('header');
      expect(unresolved).toContain('footer');
    });

    it('handles empty elements array', async () => {
      const result = await handler.resolveAll(
        { resolver: 'r1', elements: '[]', context: '{}' },
        storage,
      );
      // No elements means no unresolved, so variant is ok
      expect(result.variant).toBe('ok');
      const resolutions = JSON.parse(result.resolutions as string);
      expect(resolutions).toHaveLength(0);
    });

    it('uses overrides in resolveAll per-element resolution', async () => {
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: JSON.stringify({ title: 'OverriddenTitle' }),
        defaultContext: '{}',
        scoringWeights: '{}',
      });

      // No affordances, but title has an override so it resolves
      const result = await handler.resolveAll(
        {
          resolver: 'r1',
          elements: JSON.stringify(['title', 'body']),
          context: '{}',
        },
        storage,
      );
      // title resolves via override, body has no affordances
      expect(result.variant).toBe('partial');
      const resolved = JSON.parse(result.resolved as string);
      const unresolved = JSON.parse(result.unresolved as string);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].element).toBe('title');
      expect(resolved[0].widget).toBe('OverriddenTitle');
      expect(unresolved).toEqual(['body']);
    });

    it('treats ambiguous results as unresolved', async () => {
      // Two affordances with identical scores => ambiguous
      await storage.put('affordance', 'aff1', {
        widget: 'A',
        specificity: 50,
        conditions: '{}',
      });
      await storage.put('affordance', 'aff2', {
        widget: 'B',
        specificity: 50,
        conditions: '{}',
      });

      const result = await handler.resolveAll(
        {
          resolver: 'r1',
          elements: JSON.stringify(['field1']),
          context: '{}',
        },
        storage,
      );
      // ambiguous is not 'ok', so it goes to unresolved
      expect(result.variant).toBe('partial');
      const unresolved = JSON.parse(result.unresolved as string);
      expect(unresolved).toContain('field1');
    });
  });

  // ==========================================================
  // override
  // ==========================================================
  describe('override', () => {
    it('sets an override for an element', async () => {
      const result = await handler.override(
        { resolver: 'r1', element: 'title', widget: 'CustomTitle' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify via resolve
      const resolveResult = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(resolveResult.variant).toBe('ok');
      expect(resolveResult.widget).toBe('CustomTitle');
      expect(resolveResult.score).toBe(1.0);
    });

    it('returns invalid when element is missing', async () => {
      const result = await handler.override(
        { resolver: 'r1', element: '', widget: 'SomeWidget' },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toBe('Both element and widget are required for override');
    });

    it('returns invalid when widget is missing', async () => {
      const result = await handler.override(
        { resolver: 'r1', element: 'title', widget: '' },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });

    it('preserves existing overrides when adding a new one', async () => {
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'TitleWidget' },
        storage,
      );
      await handler.override(
        { resolver: 'r1', element: 'body', widget: 'BodyWidget' },
        storage,
      );

      // Both overrides should work
      const titleResult = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      const bodyResult = await handler.resolve(
        { resolver: 'r1', element: 'body', context: '{}' },
        storage,
      );
      expect(titleResult.widget).toBe('TitleWidget');
      expect(bodyResult.widget).toBe('BodyWidget');
    });

    it('overwrites an existing override for the same element', async () => {
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'OldTitle' },
        storage,
      );
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'NewTitle' },
        storage,
      );

      const result = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(result.widget).toBe('NewTitle');
    });

    it('preserves existing scoringWeights when setting override', async () => {
      // First set custom weights
      await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.5 }),
        },
        storage,
      );
      // Then add an override
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'T' },
        storage,
      );
      // Verify weights are preserved
      const record = await storage.get('resolver', 'r1');
      const weights = JSON.parse(record!.scoringWeights as string);
      expect(weights.specificity).toBe(0.5);
      expect(weights.conditionMatch).toBe(0.5);
    });
  });

  // ==========================================================
  // setWeights
  // ==========================================================
  describe('setWeights', () => {
    it('sets custom scoring weights that sum to 1.0', async () => {
      const result = await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 0.6, conditionMatch: 0.4 }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects weights that do not sum to 1.0', async () => {
      const result = await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.2 }),
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Weights must sum to 1.0');
      expect(result.message).toContain('0.7');
    });

    it('rejects invalid JSON', async () => {
      const result = await handler.setWeights(
        { resolver: 'r1', weights: 'not-json{' },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toBe('Weights must be valid JSON');
    });

    it('accepts weights summing to exactly 1.0 within tolerance', async () => {
      // 0.3 + 0.3 + 0.4 = 1.0 exactly
      const result = await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ a: 0.3, b: 0.3, c: 0.4 }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('accepts weights within 0.01 tolerance of 1.0', async () => {
      // 0.333 + 0.333 + 0.333 = 0.999, which is within 0.01 of 1.0
      const result = await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ a: 0.333, b: 0.333, c: 0.334 }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('applies set weights to subsequent resolve calls', async () => {
      // Heavily weight specificity
      await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 1.0, conditionMatch: 0.0 }),
        },
        storage,
      );

      await storage.put('affordance', 'aff1', {
        widget: 'LowSpec',
        specificity: 10,
        conditions: JSON.stringify({ theme: 'dark' }),
      });
      await storage.put('affordance', 'aff2', {
        widget: 'HighSpec',
        specificity: 90,
        conditions: '{}',
      });

      const result = await handler.resolve(
        { resolver: 'r1', element: 'field', context: JSON.stringify({ theme: 'dark' }) },
        storage,
      );
      // HighSpec: (90/100)*1.0 + 0*0.0 = 0.9
      // LowSpec: (10/100)*1.0 + (1/1)*0.0 = 0.1
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('HighSpec');
    });

    it('preserves existing overrides when setting weights', async () => {
      // First set an override
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'OverrideWidget' },
        storage,
      );
      // Then change weights
      await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.5 }),
        },
        storage,
      );
      // Override should still work
      const result = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(result.widget).toBe('OverrideWidget');
    });
  });

  // ==========================================================
  // explain
  // ==========================================================
  describe('explain', () => {
    it('returns notfound when resolver does not exist', async () => {
      const result = await handler.explain(
        { resolver: 'nonexistent', element: 'title', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toBe('Resolver "nonexistent" not found');
    });

    it('explains an override when one is set', async () => {
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'TitleOverride' },
        storage,
      );

      const result = await handler.explain(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.element).toBe('title');
      expect(explanation.steps).toContain(
        'Override found: element "title" -> widget "TitleOverride"',
      );
      expect(explanation.steps).toContain('Resolution short-circuited by manual override');
    });

    it('explains scoring when no override exists', async () => {
      // Create resolver record without overrides
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: JSON.stringify({ specificity: 0.4, conditionMatch: 0.3 }),
      });

      await storage.put('affordance', 'aff1', {
        widget: 'TextWidget',
        specificity: 75,
        conditions: '{}',
      });

      const result = await handler.explain(
        { resolver: 'r1', element: 'name', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.steps[0]).toBe('No override for element "name"');
      expect(explanation.steps[1]).toBe(
        `Scoring weights: ${JSON.stringify({ specificity: 0.4, conditionMatch: 0.3 })}`,
      );
      expect(explanation.steps[2]).toBe('Found 1 candidate affordance(s)');
      expect(explanation.steps[3]).toBe('  - widget="TextWidget", specificity=75');
    });

    it('shows zero candidates when no affordances exist', async () => {
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: '{}',
      });

      const result = await handler.explain(
        { resolver: 'r1', element: 'missing', context: '{}' },
        storage,
      );
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.steps).toContain('Found 0 candidate affordance(s)');
    });

    it('lists multiple affordance candidates in explanation', async () => {
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: '{}',
      });

      await storage.put('affordance', 'aff1', {
        widget: 'WidgetA',
        specificity: 30,
        conditions: '{}',
      });
      await storage.put('affordance', 'aff2', {
        widget: 'WidgetB',
        specificity: 70,
        conditions: '{}',
      });

      const result = await handler.explain(
        { resolver: 'r1', element: 'field', context: '{}' },
        storage,
      );
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.steps).toContain('Found 2 candidate affordance(s)');
      expect(explanation.steps).toContain('  - widget="WidgetA", specificity=30');
      expect(explanation.steps).toContain('  - widget="WidgetB", specificity=70');
    });

    it('includes context in explanation output', async () => {
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: '{}',
      });

      const ctx = JSON.stringify({ platform: 'ios', theme: 'dark' });
      const result = await handler.explain(
        { resolver: 'r1', element: 'e', context: ctx },
        storage,
      );
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.context).toEqual({ platform: 'ios', theme: 'dark' });
    });

    it('explains element correctly in the output', async () => {
      await storage.put('resolver', 'r1', {
        resolver: 'r1',
        overrides: '{}',
        defaultContext: '{}',
        scoringWeights: '{}',
      });

      const result = await handler.explain(
        { resolver: 'r1', element: 'myElement', context: '{}' },
        storage,
      );
      const explanation = JSON.parse(result.explanation as string);
      expect(explanation.element).toBe('myElement');
    });
  });

  // ==========================================================
  // Cross-action integration scenarios
  // ==========================================================
  describe('cross-action integration', () => {
    it('override takes precedence over high-scoring affordances', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'AutoWidget',
        specificity: 100,
        conditions: '{}',
      });

      // First resolve without override
      const before = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(before.widget).toBe('AutoWidget');

      // Set override
      await handler.override(
        { resolver: 'r1', element: 'title', widget: 'ManualWidget' },
        storage,
      );

      // Now override wins
      const after = await handler.resolve(
        { resolver: 'r1', element: 'title', context: '{}' },
        storage,
      );
      expect(after.widget).toBe('ManualWidget');
      expect(after.score).toBe(1.0);
    });

    it('changing weights changes which widget wins', async () => {
      // WidgetA: high specificity, no condition match
      // WidgetB: low specificity, perfect condition match
      await storage.put('affordance', 'aff1', {
        widget: 'WidgetA',
        specificity: 100,
        conditions: JSON.stringify({ env: 'staging' }),
      });
      await storage.put('affordance', 'aff2', {
        widget: 'WidgetB',
        specificity: 10,
        conditions: JSON.stringify({ env: 'prod' }),
      });

      const ctx = JSON.stringify({ env: 'prod' });

      // Default weights: specificity=0.4, conditionMatch=0.3
      // WidgetA: (100/100)*0.4 + (0/1)*0.3 = 0.4
      // WidgetB: (10/100)*0.4 + (1/1)*0.3 = 0.04 + 0.3 = 0.34
      const defaultResult = await handler.resolve(
        { resolver: 'r1', element: 'field', context: ctx },
        storage,
      );
      expect(defaultResult.widget).toBe('WidgetA');

      // Now weight conditionMatch much higher
      await handler.setWeights(
        {
          resolver: 'r1',
          weights: JSON.stringify({ specificity: 0.1, conditionMatch: 0.9 }),
        },
        storage,
      );

      // WidgetA: (100/100)*0.1 + (0/1)*0.9 = 0.1
      // WidgetB: (10/100)*0.1 + (1/1)*0.9 = 0.01 + 0.9 = 0.91
      const reweightedResult = await handler.resolve(
        { resolver: 'r1', element: 'field', context: ctx },
        storage,
      );
      expect(reweightedResult.widget).toBe('WidgetB');
    });

    it('resolveAll with mixed overrides and affordances', async () => {
      await storage.put('affordance', 'aff1', {
        widget: 'AutoWidget',
        specificity: 80,
        conditions: '{}',
      });

      await handler.override(
        { resolver: 'r1', element: 'header', widget: 'HeaderOverride' },
        storage,
      );

      const result = await handler.resolveAll(
        {
          resolver: 'r1',
          elements: JSON.stringify(['header', 'content']),
          context: '{}',
        },
        storage,
      );
      // header resolves via override, content via affordance scoring
      expect(result.variant).toBe('ok');
      const resolutions = JSON.parse(result.resolutions as string);
      expect(resolutions).toHaveLength(2);

      const headerRes = resolutions.find((r: { element: string }) => r.element === 'header');
      const contentRes = resolutions.find((r: { element: string }) => r.element === 'content');
      expect(headerRes.widget).toBe('HeaderOverride');
      expect(contentRes.widget).toBe('AutoWidget');
    });
  });
});
