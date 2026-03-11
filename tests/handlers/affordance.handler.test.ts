// ============================================================
// Affordance Handler Tests
//
// Tests for affordance mapping: declaration with conditions/
// bind/contractVersion, matching by interactor and contextual
// conditions (field-level and entity-level), explain output,
// and soft-delete removal.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';

// ----------------------------------------------------------
// In-memory TestStorage
//
// The find() method returns ALL entries in a relation so the
// handler's own filtering logic is exercised.
// ----------------------------------------------------------

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  del(relation: string, key: string): Promise<void>;
  find(relation: string, criteria?: unknown): Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
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
    async get(relation: string, key: string) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry } : null;
    },

    async put(relation: string, key: string, value: Record<string, unknown>) {
      const rel = getRelation(relation);
      rel.set(key, { ...value });
    },

    async del(relation: string, key: string) {
      const rel = getRelation(relation);
      rel.delete(key);
    },

    async find(relation: string, _criteria?: unknown) {
      const rel = getRelation(relation);
      return Array.from(rel.values()).map((e) => ({ ...e }));
    },
  };
}

// ----------------------------------------------------------
// Tests
// ----------------------------------------------------------

describe('Affordance Handler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  // ========================================================
  // declare
  // ========================================================

  describe('declare', () => {
    it('stores a new affordance and returns ok', async () => {
      const result = await affordanceHandler.declare(
        {
          affordance: 'select-dropdown',
          widget: 'Dropdown',
          interactor: 'selector',
          specificity: 10,
          conditions: JSON.stringify({ platform: 'web' }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const stored = await storage.get('affordance', 'select-dropdown');
      expect(stored).not.toBeNull();
      expect(stored!.affordance).toBe('select-dropdown');
      expect(stored!.widget).toBe('Dropdown');
      expect(stored!.interactor).toBe('selector');
      expect(stored!.specificity).toBe(10);
    });

    it('rejects duplicate affordance declarations', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'btn-primary',
          widget: 'PrimaryButton',
          interactor: 'trigger',
          specificity: 5,
          conditions: '{}',
        },
        storage as any,
      );

      const result = await affordanceHandler.declare(
        {
          affordance: 'btn-primary',
          widget: 'OtherButton',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('already exists');
    });

    it('defaults specificity to 0 when not provided', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'default-spec',
          widget: 'Widget',
          interactor: 'trigger',
          conditions: '{}',
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'default-spec');
      expect(stored).not.toBeNull();
      expect(stored!.specificity).toBe(0);
    });

    it('normalizes conditions to standard fields with null defaults', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'minimal-cond',
          widget: 'Widget',
          interactor: 'trigger',
          specificity: 1,
          conditions: JSON.stringify({ platform: 'ios' }),
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'minimal-cond');
      const conditions = JSON.parse(stored!.conditions as string);

      expect(conditions.platform).toBe('ios');
      expect(conditions.viewport).toBeNull();
      expect(conditions.density).toBeNull();
      expect(conditions.motif).toBeNull();
      expect(conditions.mutable).toBeNull();
      expect(conditions.minOptions).toBeNull();
      expect(conditions.maxOptions).toBeNull();
      expect(conditions.concept).toBeNull();
      expect(conditions.suite).toBeNull();
      expect(conditions.tags).toBeNull();
    });

    it('preserves all condition fields when provided', async () => {
      const fullConditions = {
        minOptions: 2,
        maxOptions: 10,
        platform: 'android',
        viewport: 'mobile',
        density: 'compact',
        motif: 'sidebar',
        mutable: true,
        concept: 'Todo',
        suite: 'core',
        tags: ['urgent', 'important'],
      };

      await affordanceHandler.declare(
        {
          affordance: 'full-cond',
          widget: 'ComplexWidget',
          interactor: 'selector',
          specificity: 20,
          conditions: JSON.stringify(fullConditions),
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'full-cond');
      const conditions = JSON.parse(stored!.conditions as string);

      expect(conditions.minOptions).toBe(2);
      expect(conditions.maxOptions).toBe(10);
      expect(conditions.platform).toBe('android');
      expect(conditions.viewport).toBe('mobile');
      expect(conditions.density).toBe('compact');
      expect(conditions.motif).toBe('sidebar');
      expect(conditions.mutable).toBe(true);
      expect(conditions.concept).toBe('Todo');
      expect(conditions.suite).toBe('core');
      expect(conditions.tags).toEqual(['urgent', 'important']);
    });

    it('stores bind as stringified JSON when provided', async () => {
      const bind = { title: 'label', description: 'hint' };
      await affordanceHandler.declare(
        {
          affordance: 'with-bind',
          widget: 'BoundWidget',
          interactor: 'trigger',
          specificity: 5,
          conditions: '{}',
          bind: JSON.stringify(bind),
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'with-bind');
      expect(stored!.bind).toBe(JSON.stringify(bind));
    });

    it('stores bind as null when not provided', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'no-bind',
          widget: 'Widget',
          interactor: 'trigger',
          specificity: 0,
          conditions: '{}',
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'no-bind');
      expect(stored!.bind).toBeNull();
    });

    it('stores contractVersion when provided', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'versioned',
          widget: 'VersionedWidget',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
          contractVersion: 3,
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'versioned');
      expect(stored!.contractVersion).toBe(3);
    });

    it('stores contractVersion as null when not provided', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'no-ver',
          widget: 'Widget',
          interactor: 'trigger',
          specificity: 0,
          conditions: '{}',
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'no-ver');
      expect(stored!.contractVersion).toBeNull();
    });

    it('stores a createdAt timestamp', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'timestamped',
          widget: 'W',
          interactor: 'trigger',
          specificity: 0,
          conditions: '{}',
        },
        storage as any,
      );

      const stored = await storage.get('affordance', 'timestamped');
      expect(stored!.createdAt).toBeDefined();
      expect(typeof stored!.createdAt).toBe('string');
    });

    it('handles empty conditions string gracefully', async () => {
      const result = await affordanceHandler.declare(
        {
          affordance: 'empty-cond',
          widget: 'Widget',
          interactor: 'trigger',
          specificity: 0,
          conditions: '',
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const stored = await storage.get('affordance', 'empty-cond');
      const conditions = JSON.parse(stored!.conditions as string);
      expect(conditions.platform).toBeNull();
      expect(conditions.maxOptions).toBeNull();
    });
  });

  // ========================================================
  // match
  // ========================================================

  describe('match', () => {
    beforeEach(async () => {
      // Seed several affordances for matching tests
      await affordanceHandler.declare(
        {
          affordance: 'web-dropdown',
          widget: 'Dropdown',
          interactor: 'selector',
          specificity: 10,
          conditions: JSON.stringify({ platform: 'web', maxOptions: 20 }),
        },
        storage as any,
      );
      await affordanceHandler.declare(
        {
          affordance: 'mobile-picker',
          widget: 'NativePicker',
          interactor: 'selector',
          specificity: 15,
          conditions: JSON.stringify({ platform: 'ios' }),
        },
        storage as any,
      );
      await affordanceHandler.declare(
        {
          affordance: 'radio-group',
          widget: 'RadioGroup',
          interactor: 'selector',
          specificity: 5,
          conditions: JSON.stringify({ maxOptions: 5 }),
        },
        storage as any,
      );
      await affordanceHandler.declare(
        {
          affordance: 'trigger-btn',
          widget: 'Button',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
        },
        storage as any,
      );
    });

    it('returns matching affordances filtered by interactor', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ platform: 'web', optionCount: 8 }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // web-dropdown (platform=web, maxOptions=20, optionCount 8 <= 20) matches
      // radio-group (maxOptions=5, optionCount 8 > 5) does NOT match
      // mobile-picker (platform=ios != web) does NOT match
      expect(matches).toHaveLength(1);
      expect(matches[0].widget).toBe('Dropdown');
    });

    it('sorts matches by specificity descending', async () => {
      // Add a generic selector affordance with no conditions
      await affordanceHandler.declare(
        {
          affordance: 'generic-selector',
          widget: 'GenericSelect',
          interactor: 'selector',
          specificity: 1,
          conditions: '{}',
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ platform: 'ios' }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // web-dropdown: platform=web, context has platform=ios => platform mismatch => out
      // mobile-picker: platform=ios matches
      // radio-group: no platform condition, no optionCount in context => passes
      // generic-selector: no conditions => passes
      // Sorted: mobile-picker(15), radio-group(5), generic-selector(1)
      expect(matches.length).toBe(3);
      expect(matches[0].specificity).toBe(15);
      expect(matches[1].specificity).toBe(5);
      expect(matches[2].specificity).toBe(1);
    });

    it('returns none when no affordances match the interactor', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'editor',
          context: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('none');
      expect(result.message).toContain('No affordances match');
    });

    it('returns none when all affordances are filtered out by conditions', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ platform: 'android', optionCount: 100 }),
        },
        storage as any,
      );

      // web-dropdown: platform=web != android => out
      // mobile-picker: platform=ios != android => out
      // radio-group: maxOptions=5, optionCount=100 > 5 => out
      expect(result.variant).toBe('none');
    });

    it('evaluates maxOptions condition correctly', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ optionCount: 3 }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // web-dropdown: no platform in context => passes, maxOptions=20, 3<=20 => passes
      // mobile-picker: no platform in context => passes (condition only checked if both set)
      // radio-group: maxOptions=5, optionCount=3, 3<=5 => passes
      // All three match
      const widgets = matches.map((m: any) => m.widget);
      expect(widgets).toContain('Dropdown');
      expect(widgets).toContain('NativePicker');
      expect(widgets).toContain('RadioGroup');
    });

    it('evaluates minOptions condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'multi-select',
          widget: 'MultiSelect',
          interactor: 'selector',
          specificity: 12,
          conditions: JSON.stringify({ minOptions: 5 }),
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ optionCount: 3 }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // multi-select: minOptions=5, optionCount=3, 3 < 5 => filtered out
      const widgets = matches.map((m: any) => m.widget);
      expect(widgets).not.toContain('MultiSelect');
    });

    it('evaluates viewport condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'desktop-selector',
          widget: 'DesktopComboBox',
          interactor: 'selector',
          specificity: 8,
          conditions: JSON.stringify({ viewport: 'desktop' }),
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ viewport: 'mobile' }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // desktop-selector: viewport=desktop != mobile => filtered out
      const widgets = matches.map((m: any) => m.widget);
      expect(widgets).not.toContain('DesktopComboBox');
    });

    it('evaluates density condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'compact-selector',
          widget: 'CompactList',
          interactor: 'selector',
          specificity: 7,
          conditions: JSON.stringify({ density: 'compact' }),
        },
        storage as any,
      );

      // Matching density
      const result1 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ density: 'compact' }),
        },
        storage as any,
      );
      const matches1 = JSON.parse(result1.matches as string);
      const widgets1 = matches1.map((m: any) => m.widget);
      expect(widgets1).toContain('CompactList');

      // Mismatched density
      const result2 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ density: 'comfortable' }),
        },
        storage as any,
      );
      const matches2 = JSON.parse(result2.matches as string);
      const widgets2 = matches2.map((m: any) => m.widget);
      expect(widgets2).not.toContain('CompactList');
    });

    it('evaluates motif condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'sidebar-nav',
          widget: 'SidebarNav',
          interactor: 'navigation',
          specificity: 12,
          conditions: JSON.stringify({ motif: 'sidebar' }),
          motifOptimized: 'sidebar',
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'navigation',
          context: JSON.stringify({ motif: 'sidebar' }),
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      const match = matches.find((m: any) => m.affordance === 'sidebar-nav');
      expect(match.widget).toBe('SidebarNav');
      expect(match.motifOptimized).toBe('sidebar');
    });

    it('evaluates mutable condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'readonly-display',
          widget: 'ReadonlyChips',
          interactor: 'selector',
          specificity: 6,
          conditions: JSON.stringify({ mutable: false }),
        },
        storage as any,
      );

      // mutable=true in context, condition says mutable=false => mismatch
      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ mutable: true }),
        },
        storage as any,
      );
      const matches = JSON.parse(result.matches as string);
      const widgets = matches.map((m: any) => m.widget);
      expect(widgets).not.toContain('ReadonlyChips');
    });

    it('evaluates concept condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'todo-selector',
          widget: 'TodoPicker',
          interactor: 'selector',
          specificity: 18,
          conditions: JSON.stringify({ concept: 'Todo' }),
        },
        storage as any,
      );

      // Matching concept
      const result1 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ concept: 'Todo' }),
        },
        storage as any,
      );
      const matches1 = JSON.parse(result1.matches as string);
      const widgets1 = matches1.map((m: any) => m.widget);
      expect(widgets1).toContain('TodoPicker');

      // Mismatched concept
      const result2 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ concept: 'User' }),
        },
        storage as any,
      );
      const matches2 = JSON.parse(result2.matches as string);
      const widgets2 = matches2.map((m: any) => m.widget);
      expect(widgets2).not.toContain('TodoPicker');
    });

    it('evaluates suite condition correctly', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'core-selector',
          widget: 'CorePicker',
          interactor: 'selector',
          specificity: 9,
          conditions: JSON.stringify({ suite: 'core' }),
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ suite: 'identity' }),
        },
        storage as any,
      );
      const matches = JSON.parse(result.matches as string);
      const widgets = matches.map((m: any) => m.widget);
      expect(widgets).not.toContain('CorePicker');
    });

    it('evaluates tags condition - requires all tags present', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'tagged-selector',
          widget: 'TaggedPicker',
          interactor: 'selector',
          specificity: 11,
          conditions: JSON.stringify({ tags: ['urgent', 'editable'] }),
        },
        storage as any,
      );

      // Context has both tags
      const result1 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ tags: ['urgent', 'editable', 'extra'] }),
        },
        storage as any,
      );
      const matches1 = JSON.parse(result1.matches as string);
      const widgets1 = matches1.map((m: any) => m.widget);
      expect(widgets1).toContain('TaggedPicker');

      // Context missing a required tag
      const result2 = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: JSON.stringify({ tags: ['urgent'] }),
        },
        storage as any,
      );
      const matches2 = JSON.parse(result2.matches as string);
      const widgets2 = matches2.map((m: any) => m.widget);
      expect(widgets2).not.toContain('TaggedPicker');
    });

    it('skips condition check when context does not provide the field', async () => {
      // mobile-picker has platform=ios, but context has no platform => passes
      const result = await affordanceHandler.match(
        {
          interactor: 'selector',
          context: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      const widgets = matches.map((m: any) => m.widget);
      // All selector affordances pass since no context fields to conflict
      expect(widgets).toContain('NativePicker');
      expect(widgets).toContain('Dropdown');
      expect(widgets).toContain('RadioGroup');
    });

    it('returns match objects with affordance, widget, specificity, bind, and contractVersion', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'trigger',
          context: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        affordance: 'trigger-btn',
        widget: 'Button',
        specificity: 1,
        bind: null,
        contractVersion: null,
        densityExempt: null,
        motifOptimized: null,
      });
    });

    it('includes parsed bind data in match results', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'bound-trigger',
          widget: 'BoundButton',
          interactor: 'trigger',
          specificity: 10,
          conditions: '{}',
          bind: JSON.stringify({ title: 'label' }),
          contractVersion: 2,
        },
        storage as any,
      );

      const result = await affordanceHandler.match(
        {
          interactor: 'trigger',
          context: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      const bound = matches.find((m: any) => m.affordance === 'bound-trigger');
      expect(bound.bind).toEqual({ title: 'label' });
      expect(bound.contractVersion).toBe(2);
    });

    it('handles empty context string gracefully', async () => {
      const result = await affordanceHandler.match(
        {
          interactor: 'trigger',
          context: '',
        },
        storage as any,
      );

      expect(result.variant).toBe('ok');
    });
  });

  // ========================================================
  // explain
  // ========================================================

  describe('explain', () => {
    it('returns a human-readable explanation for an existing affordance', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'web-dropdown',
          widget: 'Dropdown',
          interactor: 'selector',
          specificity: 10,
          conditions: JSON.stringify({ platform: 'web', maxOptions: 20 }),
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'web-dropdown' },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const reason = result.reason as string;
      expect(reason).toContain('Affordance "web-dropdown"');
      expect(reason).toContain('interactor "selector"');
      expect(reason).toContain('widget "Dropdown"');
      expect(reason).toContain('specificity 10');
      expect(reason).toContain('platform=web');
      expect(reason).toContain('maxOptions=20');
    });

    it('returns notfound for a non-existent affordance', async () => {
      const result = await affordanceHandler.explain(
        { affordance: 'does-not-exist' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('not found');
    });

    it('shows conditions: none when no conditions are set', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'no-cond',
          widget: 'SimpleWidget',
          interactor: 'trigger',
          specificity: 0,
          conditions: '{}',
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'no-cond' },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const reason = result.reason as string;
      expect(reason).toContain('conditions: none');
    });

    it('includes all condition types in explanation when present', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'full-explain',
          widget: 'FullWidget',
          interactor: 'editor',
          specificity: 25,
          conditions: JSON.stringify({
            platform: 'web',
            viewport: 'desktop',
            density: 'comfortable',
            motif: 'sidebar',
            mutable: true,
            minOptions: 1,
            maxOptions: 50,
            concept: 'Todo',
            suite: 'core',
            tags: ['priority'],
          }),
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'full-explain' },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const reason = result.reason as string;
      expect(reason).toContain('platform=web');
      expect(reason).toContain('viewport=desktop');
      expect(reason).toContain('density=comfortable');
      expect(reason).toContain('motif=sidebar');
      expect(reason).toContain('mutable=true');
      expect(reason).toContain('minOptions=1');
      expect(reason).toContain('maxOptions=50');
      expect(reason).toContain('concept=Todo');
      expect(reason).toContain('suite=core');
      expect(reason).toContain('tags=["priority"]');
    });

    it('includes bind info in explanation when present', async () => {
      const bind = { title: 'label', count: 'badge' };
      await affordanceHandler.declare(
        {
          affordance: 'explain-bind',
          widget: 'BoundWidget',
          interactor: 'trigger',
          specificity: 3,
          conditions: '{}',
          bind: JSON.stringify(bind),
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'explain-bind' },
        storage as any,
      );

      const reason = result.reason as string;
      expect(reason).toContain('bind:');
      expect(reason).toContain(JSON.stringify(bind));
    });

    it('includes contract version in explanation when present', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'explain-contract',
          widget: 'ContractWidget',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
          contractVersion: 5,
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'explain-contract' },
        storage as any,
      );

      const reason = result.reason as string;
      expect(reason).toContain('contract: @5');
    });

    it('includes motif and density metadata in explanation when present', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'motif-aware',
          widget: 'SidebarCard',
          interactor: 'display',
          specificity: 6,
          conditions: JSON.stringify({ motif: 'sidebar' }),
          densityExempt: true,
          motifOptimized: 'sidebar',
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'motif-aware' },
        storage as any,
      );

      const reason = result.reason as string;
      expect(reason).toContain('densityExempt: true');
      expect(reason).toContain('motifOptimized: sidebar');
    });

    it('formats the reason string with correct structure', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'fmt-test',
          widget: 'TestWidget',
          interactor: 'display',
          specificity: 3,
          conditions: JSON.stringify({ platform: 'ios' }),
        },
        storage as any,
      );

      const result = await affordanceHandler.explain(
        { affordance: 'fmt-test' },
        storage as any,
      );

      const reason = result.reason as string;
      expect(reason).toBe(
        'Affordance "fmt-test" maps interactor "display" to widget "TestWidget" at specificity 3 with conditions: platform=ios',
      );
    });
  });

  // ========================================================
  // remove
  // ========================================================

  describe('remove', () => {
    it('soft-deletes an existing affordance with __deleted flag', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'to-remove',
          widget: 'Widget',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
        },
        storage as any,
      );

      const result = await affordanceHandler.remove(
        { affordance: 'to-remove' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const stored = await storage.get('affordance', 'to-remove');
      expect(stored).not.toBeNull();
      expect(stored!.__deleted).toBe(true);
    });

    it('returns notfound when removing a non-existent affordance', async () => {
      const result = await affordanceHandler.remove(
        { affordance: 'nonexistent' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('not found');
    });

    it('overwrites original data on soft delete', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'overwrite-test',
          widget: 'BigWidget',
          interactor: 'editor',
          specificity: 99,
          conditions: JSON.stringify({ platform: 'web' }),
        },
        storage as any,
      );

      await affordanceHandler.remove(
        { affordance: 'overwrite-test' },
        storage as any,
      );

      const stored = await storage.get('affordance', 'overwrite-test');
      // put replaces with { __deleted: true } only
      expect(stored!.__deleted).toBe(true);
      expect(stored!.widget).toBeUndefined();
      expect(stored!.interactor).toBeUndefined();
      expect(stored!.specificity).toBeUndefined();
    });

    it('a removed affordance still exists in storage (soft delete blocks re-declare)', async () => {
      await affordanceHandler.declare(
        {
          affordance: 'soft-del',
          widget: 'W',
          interactor: 'trigger',
          specificity: 0,
          conditions: '{}',
        },
        storage as any,
      );

      await affordanceHandler.remove(
        { affordance: 'soft-del' },
        storage as any,
      );

      // The key still exists so re-declaring would hit 'duplicate'
      const result = await affordanceHandler.declare(
        {
          affordance: 'soft-del',
          widget: 'W2',
          interactor: 'trigger',
          specificity: 1,
          conditions: '{}',
        },
        storage as any,
      );

      expect(result.variant).toBe('duplicate');
    });
  });
});
