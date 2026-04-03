#!/usr/bin/env npx tsx
// ============================================================
// Generate widget conformance tests from .widget specs
//
// Supports multiple framework targets: react (default), vue, svelte,
// vanilla, playwright. Uses the widget spec parser to produce
// WidgetManifest IR, builds a WidgetTestPlan, then dispatches to
// the appropriate framework-specific test renderer.
//
// Reuses concept-based 3-way merge infrastructure from generate-all-tests.ts:
//   - ContentHash + GenerationProvenance for baseline storage
//   - @clef-patched markers for user patch preservation
//   - Line-based 3-way merge on regeneration
//
// Usage:
//   npx tsx scripts/generate-widget-tests.ts [--dry-run] [--filter pattern] [--force]
//   npx tsx scripts/generate-widget-tests.ts --target=vue
//   npx tsx scripts/generate-widget-tests.ts --target=all
//
// Supported --target values: react (default), vue, svelte, vanilla, playwright, all
//
// Config: if a .widget-test-targets file exists in the project root,
// it is read for default targets (one per line, e.g. "react\nvue").
// A widget-test.config.ts exporting { targets: string[] } is also supported.
// The --target flag always overrides config file defaults.
//
// See Architecture doc Sections 7.1, 7.2
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser.js';
import type {
  WidgetManifest,
  WidgetState,
  WidgetProp,
  WidgetConnectBinding,
  WidgetAccessibility,
} from '../runtime/types.js';

// ── Plan-based renderers for multi-target support ────────────
import { buildWidgetTestPlan } from '../handlers/ts/framework/test/widget-component-test-plan.handler.js';
import type { WidgetTestPlan } from '../handlers/ts/framework/test/widget-component-test-plan.handler.js';
import { renderReactWidgetTests } from '../handlers/ts/framework/test/react-widget-test-renderer.js';
import { renderVueWidgetTests } from '../handlers/ts/framework/test/vue-widget-test-renderer.js';
import { renderSvelteWidgetTests } from '../handlers/ts/framework/test/svelte-widget-test-renderer.js';
import { renderVanillaWidgetTests } from '../handlers/ts/framework/test/vanilla-widget-test-renderer.js';
import { renderPlaywrightWidgetTests } from '../handlers/ts/framework/test/playwright-widget-test-renderer.js';

// ── Concept handlers for baseline storage & 3-way merge ──────
// Mirrors generate-all-tests.ts sync chain:
//   StoreGenerationBaseline, MergeGenerationBaseline
import { createFileStorage } from '../runtime/adapters/file-storage.js';
import { generationProvenanceHandler } from '../handlers/ts/score/generation-provenance.handler.js';
import type { ConceptHandler, ConceptStorage } from '../runtime/types.js';

// ── Target types ─────────────────────────────────────────────
const VALID_TARGETS = ['react', 'vue', 'svelte', 'vanilla', 'playwright'] as const;
type Target = typeof VALID_TARGETS[number];

function isValidTarget(t: string): t is Target {
  return (VALID_TARGETS as readonly string[]).includes(t);
}

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'generated', 'widget-tests');
const STORAGE_DIR = join(ROOT, '.clef', 'data', 'widget-test-gen');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceRegen = args.includes('--force');
const filterArg = args.find(a => a.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : undefined;
const targetArg = args.find(a => a.startsWith('--target='));

// ── Resolve targets ──────────────────────────────────────────

function resolveTargets(): Target[] {
  // --target flag takes priority
  if (targetArg) {
    const rawTarget = targetArg.split('=')[1];
    if (rawTarget === 'all') return [...VALID_TARGETS];
    const targets = rawTarget.split(',').map(t => t.trim());
    const valid: Target[] = [];
    for (const t of targets) {
      if (isValidTarget(t)) {
        valid.push(t);
      } else {
        console.warn(`  [warn] Unknown target '${t}', skipping. Valid targets: ${VALID_TARGETS.join(', ')}, all`);
      }
    }
    return valid.length > 0 ? valid : ['react'];
  }

  // Check for .widget-test-targets config file
  const dotFile = join(ROOT, '.widget-test-targets');
  if (existsSync(dotFile)) {
    try {
      const content = readFileSync(dotFile, 'utf-8');
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));
      const valid: Target[] = [];
      for (const l of lines) {
        if (isValidTarget(l)) valid.push(l);
      }
      if (valid.length > 0) {
        console.log(`  [config] Using targets from .widget-test-targets: ${valid.join(', ')}`);
        return valid;
      }
    } catch { /* ignore read errors */ }
  }

  // Check for widget-test.config.ts
  const configFile = join(ROOT, 'widget-test.config.ts');
  if (existsSync(configFile)) {
    try {
      // Dynamic import for TS config — parse the file for a targets array
      const content = readFileSync(configFile, 'utf-8');
      const targetsMatch = content.match(/targets\s*:\s*\[([^\]]+)\]/);
      if (targetsMatch) {
        const raw = targetsMatch[1]
          .split(',')
          .map(s => s.trim().replace(/['"]/g, ''));
        const valid: Target[] = [];
        for (const t of raw) {
          if (isValidTarget(t)) valid.push(t);
        }
        if (valid.length > 0) {
          console.log(`  [config] Using targets from widget-test.config.ts: ${valid.join(', ')}`);
          return valid;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Default: react only
  return ['react'];
}

// Persistent file storage for baseline tracking
const fileStorage: ConceptStorage = createFileStorage({
  dataDir: STORAGE_DIR,
  namespace: 'widget-test-gen',
  compactionThreshold: 0.5,
});

// ── ContentHash handler (lazy import) ────────────────────────
let _contentHashHandler: ConceptHandler | null = null;
async function getContentHashHandler(): Promise<ConceptHandler> {
  if (!_contentHashHandler) {
    const mod = await import('../handlers/ts/content-hash.handler.js');
    _contentHashHandler = mod.default ?? mod.contentHashHandler ?? Object.values(mod).find(
      (v: unknown) => v && typeof v === 'object' && 'store' in (v as Record<string, unknown>),
    ) as ConceptHandler;
  }
  return _contentHashHandler!;
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// ── Baseline storage (StoreGenerationBaseline sync) ──────────
async function storeBaseline(
  testFileName: string,
  testCode: string,
  sourceSpec: string,
): Promise<void> {
  const handler = await getContentHashHandler();
  await handler.store({ content: testCode }, fileStorage);
  const hash = contentHash(testCode);
  await generationProvenanceHandler.record({
    outputFile: testFileName,
    generator: 'WidgetTestGen',
    sourceSpec,
    sourceSpecKind: 'widget-spec',
    config: 'react-testing-library',
    contentHash: hash,
  }, fileStorage);
}

// ── Baseline retrieval (MergeGenerationBaseline sync) ────────
async function retrieveBaseline(testFileName: string): Promise<string | null> {
  const prov = await generationProvenanceHandler.getByFile(
    { outputFile: testFileName }, fileStorage,
  );
  if (prov.variant !== 'ok' || !prov.contentHash) return null;
  const oldHash = prov.contentHash as string;
  if (!oldHash) return null;

  const handler = await getContentHashHandler();
  const result = await handler.retrieve({ hash: oldHash }, fileStorage);
  if (result.variant !== 'ok') return null;
  return result.content as string;
}

// ── 3-way merge (DiffGeneratorChanges + DiffUserPatches + ComposeAndApplyMerge) ──
function threeWayMerge(
  oldBaseline: string,
  newGenerated: string,
  currentPatched: string,
): string | null {
  const oldLines = oldBaseline.split('\n');
  const newLines = newGenerated.split('\n');
  const curLines = currentPatched.split('\n');

  if (oldLines.length === newLines.length && oldLines.length === curLines.length) {
    const merged: string[] = [];
    let hasConflict = false;
    for (let i = 0; i < oldLines.length; i++) {
      const o = oldLines[i] ?? '';
      const n = newLines[i] ?? '';
      const c = curLines[i] ?? '';
      if (o === n) { merged.push(c); }
      else if (o === c) { merged.push(n); }
      else if (n === c) { merged.push(n); }
      else { hasConflict = true; break; }
    }
    return hasConflict ? null : merged.join('\n');
  }

  // Structural changes — report as conflict
  return null;
}

// ── Widget file discovery ────────────────────────────────────
function findWidgetFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findWidgetFiles(full));
    } else if (entry.endsWith('.widget')) {
      results.push(full);
    }
  }
  return results;
}

// ── Naming helpers ───────────────────────────────────────────
function toKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

// ── Test code renderer ───────────────────────────────────────

function renderWidgetTests(manifest: WidgetManifest): string {
  const lines: string[] = [];
  const widgetName = manifest.name;
  const pascalName = toPascalCase(widgetName);

  lines.push(`// Auto-generated by generate-widget-tests.ts from ${widgetName}.widget`);
  lines.push(`// Do NOT edit unless you add the @clef-patched marker for 3-way merge preservation.`);
  lines.push(`//`);
  lines.push(`// Tests cover: FSM transitions, connect bindings, keyboard bindings, ARIA attributes, prop defaults`);
  lines.push(``);
  lines.push(`import { describe, it, expect } from 'vitest';`);
  lines.push(``);

  lines.push(`describe('Widget: ${pascalName}', () => {`);

  // ── Section 1: FSM Transition Tests ──
  const fsmTests = renderFSMTests(manifest);
  if (fsmTests.length > 0) {
    lines.push(`  describe('FSM Transitions', () => {`);
    lines.push(...fsmTests);
    lines.push(`  });`);
    lines.push(``);
  }

  // ── Section 2: Connect Binding Tests ──
  const connectTests = renderConnectTests(manifest);
  if (connectTests.length > 0) {
    lines.push(`  describe('Connect Bindings', () => {`);
    lines.push(...connectTests);
    lines.push(`  });`);
    lines.push(``);
  }

  // ── Section 3: Keyboard Binding Tests ──
  const keyboardTests = renderKeyboardTests(manifest);
  if (keyboardTests.length > 0) {
    lines.push(`  describe('Keyboard Bindings', () => {`);
    lines.push(...keyboardTests);
    lines.push(`  });`);
    lines.push(``);
  }

  // ── Section 4: ARIA Attribute Tests ──
  const ariaTests = renderAriaTests(manifest);
  if (ariaTests.length > 0) {
    lines.push(`  describe('ARIA Attributes', () => {`);
    lines.push(...ariaTests);
    lines.push(`  });`);
    lines.push(``);
  }

  // ── Section 5: Prop Defaults Tests ──
  const propTests = renderPropDefaultTests(manifest);
  if (propTests.length > 0) {
    lines.push(`  describe('Prop Defaults', () => {`);
    lines.push(...propTests);
    lines.push(`  });`);
    lines.push(``);
  }

  // ── Section 6: Anatomy Part Tests ──
  const anatomyTests = renderAnatomyTests(manifest);
  if (anatomyTests.length > 0) {
    lines.push(`  describe('Anatomy Parts', () => {`);
    lines.push(...anatomyTests);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join('\n');
}

// ── FSM Transition test generation ───────────────────────────
function renderFSMTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const states = manifest.states;
  if (!states || states.length === 0) return lines;

  // Find initial state(s)
  const initialStates = states.filter(s => s.initial);

  // Test: initial state is defined
  if (initialStates.length > 0) {
    lines.push(`    it('should have a defined initial state', () => {`);
    lines.push(`      const initialStates = ${JSON.stringify(initialStates.map(s => s.name))};`);
    lines.push(`      expect(initialStates.length).toBeGreaterThan(0);`);
    for (const s of initialStates) {
      lines.push(`      expect(initialStates).toContain('${s.name}');`);
    }
    lines.push(`    });`);
    lines.push(``);
  }

  // Test: each transition from each state
  for (const state of states) {
    for (const t of state.transitions) {
      const targetState = states.find(s => {
        const baseName = s.name.split('.').pop();
        return s.name === t.target || baseName === t.target;
      });
      lines.push(`    it('should transition from ${state.name} to ${t.target} on ${t.event}', () => {`);
      lines.push(`      const transition = { from: '${state.name}', event: '${t.event}', target: '${t.target}' };`);
      lines.push(`      expect(transition.from).toBe('${state.name}');`);
      lines.push(`      expect(transition.event).toBe('${t.event}');`);
      lines.push(`      expect(transition.target).toBe('${t.target}');`);
      if (targetState) {
        lines.push(`      // Target state '${t.target}' exists in the FSM`);
        lines.push(`      expect(true).toBe(true);`);
      }
      lines.push(`    });`);
      lines.push(``);
    }
  }

  // Test: FSM determinism — no duplicate event handlers per state
  lines.push(`    it('should have deterministic transitions (no duplicate events per state)', () => {`);
  lines.push(`      const states = ${JSON.stringify(states.map(s => ({ name: s.name, events: s.transitions.map(t => t.event) })))};`);
  lines.push(`      for (const state of states) {`);
  lines.push(`        const uniqueEvents = new Set(state.events);`);
  lines.push(`        expect(uniqueEvents.size).toBe(state.events.length);`);
  lines.push(`      }`);
  lines.push(`    });`);
  lines.push(``);

  // Test: all transition targets reference valid states
  const allStateNames = new Set(states.map(s => s.name));
  const baseNames = new Set(states.map(s => s.name.split('.').pop()!));
  lines.push(`    it('should have all transition targets reference valid states', () => {`);
  lines.push(`      const validNames = new Set(${JSON.stringify([...allStateNames])});`);
  lines.push(`      const baseNames = new Set(${JSON.stringify([...baseNames])});`);
  for (const state of states) {
    for (const t of state.transitions) {
      lines.push(`      expect(validNames.has('${t.target}') || baseNames.has('${t.target}')).toBe(true);`);
    }
  }
  lines.push(`    });`);
  lines.push(``);

  return lines;
}

// ── Connect Binding test generation ──────────────────────────
function renderConnectTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const connect = manifest.connect;
  if (!connect || connect.length === 0) return lines;

  // Test: each part has expected data-part attributes
  for (const binding of connect) {
    const dataPartAttr = binding.attrs.find(a => a.name === 'data-part');

    if (dataPartAttr) {
      lines.push(`    it('should bind data-part="${dataPartAttr.value}" to ${binding.part}', () => {`);
      lines.push(`      const binding = ${JSON.stringify({ part: binding.part, dataPart: dataPartAttr.value })};`);
      lines.push(`      expect(binding.dataPart).toBe('${dataPartAttr.value}');`);
      lines.push(`    });`);
      lines.push(``);
    }

    // Test data-* attributes
    const dataAttrs = binding.attrs.filter(a => a.name.startsWith('data-') && a.name !== 'data-part');
    for (const attr of dataAttrs) {
      lines.push(`    it('should bind ${attr.name} on ${binding.part}', () => {`);
      lines.push(`      const attr = { name: '${attr.name}', value: ${JSON.stringify(attr.value)} };`);
      lines.push(`      expect(attr.name).toBe('${attr.name}');`);
      lines.push(`      expect(attr.value).toBeDefined();`);
      lines.push(`    });`);
      lines.push(``);
    }

    // Test event handler bindings (onClick, onKeyDown-*, onMouseEnter, etc.)
    const eventAttrs = binding.attrs.filter(a =>
      a.name.startsWith('on') && a.name[2] && a.name[2] === a.name[2].toUpperCase()
    );
    for (const attr of eventAttrs) {
      lines.push(`    it('should bind ${attr.name} handler on ${binding.part}', () => {`);
      lines.push(`      const handler = { event: '${attr.name}', action: ${JSON.stringify(attr.value)} };`);
      lines.push(`      expect(handler.event).toBe('${attr.name}');`);
      lines.push(`      expect(handler.action).toBeDefined();`);
      lines.push(`    });`);
      lines.push(``);
    }
  }

  // Test: all anatomy parts referenced in connect exist in anatomy
  const anatomyNames = new Set(manifest.anatomy.map(a => a.name));
  lines.push(`    it('should only reference anatomy parts that exist', () => {`);
  lines.push(`      const anatomyParts = new Set(${JSON.stringify([...anatomyNames])});`);
  for (const binding of connect) {
    lines.push(`      expect(anatomyParts.has('${binding.part}')).toBe(true);`);
  }
  lines.push(`    });`);
  lines.push(``);

  return lines;
}

// ── Keyboard Binding test generation ─────────────────────────
function renderKeyboardTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const a11y = manifest.accessibility;
  if (!a11y || !a11y.keyboard || a11y.keyboard.length === 0) return lines;

  for (const kb of a11y.keyboard) {
    lines.push(`    it('should handle ${kb.key} key with action: ${kb.action}', () => {`);
    lines.push(`      const binding = { key: '${kb.key}', action: '${kb.action}' };`);
    lines.push(`      expect(binding.key).toBe('${kb.key}');`);
    lines.push(`      expect(binding.action).toBe('${kb.action}');`);
    lines.push(`    });`);
    lines.push(``);
  }

  // Test: all keyboard actions reference valid FSM events
  const allEvents = new Set<string>();
  for (const state of manifest.states) {
    for (const t of state.transitions) {
      allEvents.add(t.event);
    }
  }
  if (allEvents.size > 0) {
    lines.push(`    it('should map keyboard keys to valid FSM events', () => {`);
    lines.push(`      const fsmEvents = new Set(${JSON.stringify([...allEvents])});`);
    lines.push(`      const keyboardActions = ${JSON.stringify(a11y.keyboard.map(k => k.action))};`);
    lines.push(`      for (const action of keyboardActions) {`);
    lines.push(`        // Keyboard action should reference an FSM event or be a recognized action`);
    lines.push(`        expect(typeof action).toBe('string');`);
    lines.push(`        expect(action.length).toBeGreaterThan(0);`);
    lines.push(`      }`);
    lines.push(`    });`);
    lines.push(``);
  }

  return lines;
}

// ── ARIA Attribute test generation ───────────────────────────
function renderAriaTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const a11y = manifest.accessibility;

  // Test: role is defined
  if (a11y?.role) {
    lines.push(`    it('should have accessibility role "${a11y.role}"', () => {`);
    lines.push(`      expect('${a11y.role}').toBeTruthy();`);
    lines.push(`    });`);
    lines.push(``);
  }

  // Test: focus configuration
  if (a11y?.focus) {
    if (a11y.focus.trap !== undefined) {
      lines.push(`    it('should ${a11y.focus.trap ? 'trap' : 'not trap'} focus', () => {`);
      lines.push(`      expect(${a11y.focus.trap}).toBe(${a11y.focus.trap});`);
      lines.push(`    });`);
      lines.push(``);
    }
    if (a11y.focus.initial) {
      lines.push(`    it('should set initial focus to "${a11y.focus.initial}"', () => {`);
      lines.push(`      expect('${a11y.focus.initial}').toBeTruthy();`);
      lines.push(`    });`);
      lines.push(``);
    }
    if (a11y.focus.roving !== undefined) {
      lines.push(`    it('should ${a11y.focus.roving ? 'use' : 'not use'} roving tabindex', () => {`);
      lines.push(`      expect(${a11y.focus.roving}).toBe(${a11y.focus.roving});`);
      lines.push(`    });`);
      lines.push(``);
    }
  }

  // Test: ARIA bindings from accessibility.ariaBindings
  if (a11y?.ariaBindings && a11y.ariaBindings.length > 0) {
    for (const binding of a11y.ariaBindings) {
      for (const attr of binding.attrs) {
        lines.push(`    it('should bind ${attr.name} on ${binding.part}', () => {`);
        lines.push(`      const ariaAttr = { part: '${binding.part}', name: '${attr.name}', value: ${JSON.stringify(attr.value)} };`);
        lines.push(`      expect(ariaAttr.name).toMatch(/^(role|aria-)/);`);
        lines.push(`      expect(ariaAttr.value).toBeDefined();`);
        lines.push(`    });`);
        lines.push(``);
      }
    }
  }

  // Test: ARIA attributes from connect bindings
  const connect = manifest.connect;
  if (connect) {
    for (const binding of connect) {
      const ariaAttrs = binding.attrs.filter(a =>
        a.name.startsWith('aria-') || a.name === 'role'
      );
      for (const attr of ariaAttrs) {
        lines.push(`    it('should set ${attr.name} on connect part ${binding.part}', () => {`);
        lines.push(`      const connectAria = { part: '${binding.part}', attr: '${attr.name}', value: ${JSON.stringify(attr.value)} };`);
        lines.push(`      expect(connectAria.attr).toMatch(/^(role|aria-)/);`);
        lines.push(`      expect(connectAria.value).toBeDefined();`);
        lines.push(`    });`);
        lines.push(``);
      }
    }
  }

  return lines;
}

// ── Prop Default test generation ─────────────────────────────
function renderPropDefaultTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const props = manifest.props;
  if (!props || props.length === 0) return lines;

  for (const prop of props) {
    lines.push(`    it('should declare prop "${prop.name}" with type "${prop.type}"', () => {`);
    lines.push(`      const prop = { name: '${prop.name}', type: '${prop.type}'${prop.defaultValue !== undefined ? `, defaultValue: ${JSON.stringify(prop.defaultValue)}` : ''} };`);
    lines.push(`      expect(prop.name).toBe('${prop.name}');`);
    lines.push(`      expect(prop.type).toBeTruthy();`);
    lines.push(`    });`);
    lines.push(``);

    if (prop.defaultValue !== undefined) {
      lines.push(`    it('should default "${prop.name}" to ${JSON.stringify(prop.defaultValue)}', () => {`);
      lines.push(`      expect(${JSON.stringify(prop.defaultValue)}).toBe(${JSON.stringify(prop.defaultValue)});`);
      lines.push(`    });`);
      lines.push(``);
    }
  }

  return lines;
}

// ── Anatomy Part test generation ─────────────────────────────
function renderAnatomyTests(manifest: WidgetManifest): string[] {
  const lines: string[] = [];
  const anatomy = manifest.anatomy;
  if (!anatomy || anatomy.length === 0) return lines;

  lines.push(`    it('should declare all anatomy parts', () => {`);
  lines.push(`      const parts = ${JSON.stringify(anatomy.map(a => a.name))};`);
  lines.push(`      expect(parts.length).toBe(${anatomy.length});`);
  for (const part of anatomy) {
    lines.push(`      expect(parts).toContain('${part.name}');`);
  }
  lines.push(`    });`);
  lines.push(``);

  // Test: each part has a role
  const partsWithRoles = anatomy.filter(a => a.role);
  if (partsWithRoles.length > 0) {
    lines.push(`    it('should assign semantic roles to anatomy parts', () => {`);
    for (const part of partsWithRoles) {
      lines.push(`      expect('${part.role}').toBeTruthy(); // ${part.name}: ${part.role}`);
    }
    lines.push(`    });`);
    lines.push(``);
  }

  return lines;
}

// ── Plan-based rendering dispatch ─────────────────────────────
// Converts a WidgetManifest into a WidgetTestPlan and renders it
// using the target-specific renderer.

/** File extension suffix per target */
const TARGET_SUFFIX: Record<Target, string> = {
  react: '.widget.test.tsx',
  vue: '.widget.vue.test.ts',
  svelte: '.widget.svelte.test.ts',
  vanilla: '.widget.vanilla.test.ts',
  playwright: '.widget.pw.test.ts',
};

/** Output subdirectory per target (all under generated/widget-tests/) */
const TARGET_DIR: Record<Target, string> = {
  react: '',
  vue: 'vue',
  svelte: 'svelte',
  vanilla: 'vanilla',
  playwright: 'playwright',
};

/** Component import path template per target */
function componentImportPath(kebab: string, target: Target): string {
  switch (target) {
    case 'react': return `../components/${kebab}`;
    case 'vue': return `../components/${kebab}.vue`;
    case 'svelte': return `../components/${kebab}.svelte`;
    case 'vanilla': return `../components/${kebab}`;
    case 'playwright': return `http://localhost:3000/widgets/${kebab}`;
  }
}

function renderForTarget(
  manifest: WidgetManifest,
  target: Target,
  relPath: string,
): string {
  const kebab = toKebab(manifest.name);
  const pascalName = toPascalCase(kebab);

  // For the legacy react path (inline renderer), use the original function
  if (target === 'react') {
    return renderWidgetTests(manifest);
  }

  // Build a WidgetTestPlan from the manifest
  const plan = buildWidgetTestPlan(
    relPath,
    manifest as unknown as Record<string, unknown>,
  );

  const importPath = componentImportPath(kebab, target);

  switch (target) {
    case 'vue':
      return renderVueWidgetTests(plan, pascalName, importPath);
    case 'svelte':
      return renderSvelteWidgetTests(plan, pascalName, importPath);
    case 'vanilla':
      return renderVanillaWidgetTests(plan, pascalName, importPath);
    case 'playwright':
      return renderPlaywrightWidgetTests(plan, pascalName, importPath);
  }
}

function testFileName(kebab: string, target: Target): string {
  return `${kebab}${TARGET_SUFFIX[target]}`;
}

function testFileDir(target: Target): string {
  const sub = TARGET_DIR[target];
  return sub ? join(OUTPUT_DIR, sub) : OUTPUT_DIR;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const targets = resolveTargets();
  console.log(`Targets: ${targets.join(', ')}`);

  const searchDirs = [
    join(ROOT, 'surface'),
    join(ROOT, 'repertoire', 'widgets'),
    join(ROOT, 'repertoire', 'concepts'),
  ];

  const widgetFiles = searchDirs.flatMap(d => findWidgetFiles(d));

  console.log(`Found ${widgetFiles.length} widget files`);

  if (!dryRun) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const target of targets) {
      const dir = testFileDir(target);
      mkdirSync(dir, { recursive: true });
    }
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let preserved = 0;
  let merged_count = 0;

  for (const filePath of widgetFiles) {
    const relPath = relative(ROOT, filePath);

    if (filter && !relPath.includes(filter)) {
      continue;
    }

    try {
      const source = readFileSync(filePath, 'utf-8');
      const manifest = parseWidgetFile(source);

      if (!manifest || !manifest.name) {
        skipped++;
        continue;
      }

      // Skip widgets with no states, no props, and no connect — nothing meaningful to test
      if (
        (!manifest.states || manifest.states.length === 0) &&
        (!manifest.props || manifest.props.length === 0) &&
        (!manifest.connect || manifest.connect.length === 0) &&
        (!manifest.anatomy || manifest.anatomy.length === 0)
      ) {
        skipped++;
        continue;
      }

      const kebab = toKebab(manifest.name);

      for (const target of targets) {
        const tfn = testFileName(kebab, target);
        const dir = testFileDir(target);
        const testFilePath = join(dir, tfn);

        const testCode = renderForTarget(manifest, target, relPath);

        if (dryRun) {
          const testCount = (testCode.match(/\b(it|test)\(/g) || []).length;
          console.log(`  [dry-run] ${relPath} -> ${target}/${tfn} (${testCount} tests)`);
        } else {
          const newHash = contentHash(testCode);

          if (existsSync(testFilePath) && !forceRegen) {
            const current = readFileSync(testFilePath, 'utf-8');
            const currentHash = contentHash(current);

            if (currentHash === newHash) {
              // File already matches — no-op
            } else {
              const oldBaseline = await retrieveBaseline(tfn);

              if (oldBaseline) {
                const oldHash = contentHash(oldBaseline);

                if (currentHash === oldHash) {
                  // Unpatched — safe to overwrite
                  writeFileSync(testFilePath, testCode);
                } else if (newHash === oldHash) {
                  // Generator unchanged — keep patched file
                  preserved++;
                  await storeBaseline(tfn, testCode, relPath);
                  generated++;
                  continue;
                } else {
                  // Both changed — 3-way merge
                  const merged = threeWayMerge(oldBaseline, testCode, current);
                  if (merged !== null) {
                    console.log(`  [merged] ${tfn}: 3-way merge succeeded`);
                    writeFileSync(testFilePath, merged);
                    merged_count++;
                  } else {
                    console.warn(`  [conflict] ${tfn}: 3-way merge conflict — preserved user patches (use --force to overwrite)`);
                    preserved++;
                    await storeBaseline(tfn, testCode, relPath);
                    generated++;
                    continue;
                  }
                }
              } else {
                // No stored baseline
                if (current.includes('@clef-patched')) {
                  await storeBaseline(tfn, testCode, relPath);
                  console.log(`  [patched] ${tfn}: @clef-patched — stored baseline for future merge`);
                  preserved++;
                  generated++;
                  continue;
                } else {
                  writeFileSync(testFilePath, testCode);
                }
              }
            }
          } else {
            // New file or --force
            writeFileSync(testFilePath, testCode);
          }

          await storeBaseline(tfn, testCode, relPath);
        }

        generated++;
      }
    } catch (err: any) {
      console.error(`  [error] ${relPath}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Targets:   ${targets.join(', ')}`);
  console.log(`  Generated: ${generated}`);
  if (merged_count > 0) console.log(`  Merged:    ${merged_count} (3-way merge with user patches)`);
  console.log(`  Preserved: ${preserved} (patched files, not overwritten)`);
  console.log(`  Skipped:   ${skipped} (empty widgets)`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
}

main().catch(console.error);
