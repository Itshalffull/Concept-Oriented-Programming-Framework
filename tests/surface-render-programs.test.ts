import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import type { ConceptStorage } from '../runtime/types.js';
import { renderProgramHandler } from '../handlers/ts/surface/render-program.handler.js';
import { renderInterpreterHandler } from '../handlers/ts/surface/render-interpreter.handler.js';
import { renderInterpreterReactHandler, resetRenderInterpreterReactCounter } from '../handlers/ts/surface/providers/render-interpreter-react.handler.js';
import { renderInterpreterSvelteHandler, resetRenderInterpreterSvelteCounter } from '../handlers/ts/surface/providers/render-interpreter-svelte.handler.js';
import { a11yAuditProviderHandler } from '../handlers/ts/surface/providers/a11y-audit-provider.handler.js';
import { deadPartProviderHandler } from '../handlers/ts/surface/providers/dead-part-provider.handler.js';
import { themeComplianceProviderHandler } from '../handlers/ts/surface/providers/theme-compliance-provider.handler.js';
import { buildRenderProgram } from '../handlers/ts/surface/render-program-builder.js';
import { extractReadSet, extractWriteSet, classifyPurity, type StorageProgram } from '../runtime/storage-program.js';

// Helper to extract the pure terminator value from a StorageProgram
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
    if (instr.tag === 'branch') {
      const thenVal = getPureValue(instr.thenBranch as StorageProgram<unknown>);
      const elseVal = getPureValue(instr.elseBranch as StorageProgram<unknown>);
      return thenVal || elseVal;
    }
  }
  return null;
}

// ============================================================
// RenderProgram — imperative handler tests
// ============================================================
describe('RenderProgram handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a new empty render program', async () => {
      const result = await renderProgramHandler.create({ program: 'rp1' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect(stored).not.toBeNull();
      expect(stored!.instructions).toEqual([]);
      expect(stored!.parts).toEqual([]);
      expect(stored!.tokens).toEqual([]);
      expect(stored!.props).toEqual([]);
      expect(stored!.terminated).toBe(false);
    });

    it('returns exists for duplicate program', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.create({ program: 'rp1' }, storage);
      expect(result.variant).toBe('exists');
    });
  });

  describe('element', () => {
    it('appends an anatomy part element', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.element({ program: 'rp1', part: 'root', role: 'container' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.program).toBe('rp1');

      const stored = await storage.get('programs', 'rp1');
      expect(stored!.instructions).toHaveLength(1);
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'element', part: 'root', role: 'container' });
      expect(stored!.parts).toContain('root');
    });

    it('returns notfound for missing program', async () => {
      const result = await renderProgramHandler.element({ program: 'missing', part: 'x', role: 'text' }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      await renderProgramHandler.pure({ program: 'rp1', output: 'done' }, storage);
      const result = await renderProgramHandler.element({ program: 'rp1', part: 'x', role: 'text' }, storage);
      expect(result.variant).toBe('sealed');
    });
  });

  describe('text', () => {
    it('appends a text content instruction', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.text({ program: 'rp1', part: 'header', content: 'Hello' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'text', part: 'header', content: 'Hello' });
    });
  });

  describe('prop', () => {
    it('declares a typed component prop', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.prop({ program: 'rp1', name: 'label', propType: 'String', defaultValue: '' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect(stored!.props).toContain('label');
    });
  });

  describe('bind', () => {
    it('wires a data attribute', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.bind({ program: 'rp1', part: 'root', attr: 'className', expr: 'props.class' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'bind', part: 'root', attr: 'className', expr: 'props.class' });
    });
  });

  describe('stateDef', () => {
    it('declares an FSM state', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.stateDef({ program: 'rp1', name: 'idle', initial: true }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'stateDef', name: 'idle', initial: true });
    });
  });

  describe('transition', () => {
    it('adds an FSM transition', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.transition({ program: 'rp1', fromState: 'idle', event: 'click', toState: 'active' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'transition', fromState: 'idle', event: 'click', toState: 'active' });
    });
  });

  describe('aria', () => {
    it('attaches an ARIA attribute', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.aria({ program: 'rp1', part: 'root', attr: 'role', value: 'dialog' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'aria', part: 'root', attr: 'role', value: 'dialog' });
    });
  });

  describe('keyboard', () => {
    it('maps a key to an event', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.keyboard({ program: 'rp1', key: 'Escape', event: 'close' }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('focus', () => {
    it('configures focus management', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.focus({ program: 'rp1', strategy: 'trap', initialPart: 'root' }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('compose', () => {
    it('nests a widget at a slot', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.compose({ program: 'rp1', widget: 'Button', slot: 'action' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect((stored!.instructions as unknown[])[0]).toEqual({ tag: 'compose', widget: 'Button', slot: 'action' });
    });
  });

  describe('token', () => {
    it('references a theme design token', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.token({ program: 'rp1', path: 'color.primary', fallback: '#000' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect(stored!.tokens).toContain('color.primary');
    });
  });

  describe('pure', () => {
    it('terminates the program', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      const result = await renderProgramHandler.pure({ program: 'rp1', output: 'done' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect(stored!.terminated).toBe(true);
    });

    it('returns sealed on double termination', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      await renderProgramHandler.pure({ program: 'rp1', output: 'done' }, storage);
      const result = await renderProgramHandler.pure({ program: 'rp1', output: 'again' }, storage);
      expect(result.variant).toBe('sealed');
    });
  });

  describe('invariant: create then element then pure', () => {
    it('builds a complete program lifecycle', async () => {
      await renderProgramHandler.create({ program: 'rp1' }, storage);
      await renderProgramHandler.element({ program: 'rp1', part: 'root', role: 'container' }, storage);
      await renderProgramHandler.aria({ program: 'rp1', part: 'root', attr: 'role', value: 'dialog' }, storage);
      await renderProgramHandler.keyboard({ program: 'rp1', key: 'Escape', event: 'close' }, storage);
      await renderProgramHandler.token({ program: 'rp1', path: 'color.primary', fallback: '#000' }, storage);
      const result = await renderProgramHandler.pure({ program: 'rp1', output: 'complete' }, storage);
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'rp1');
      expect(stored!.terminated).toBe(true);
      expect((stored!.instructions as unknown[]).length).toBe(5);
      expect(stored!.parts).toContain('root');
      expect(stored!.tokens).toContain('color.primary');
    });
  });
});

// ============================================================
// RenderInterpreter — dispatcher with provider delegation
// ============================================================
describe('RenderInterpreter handler (provider delegation)', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new interpreter for a target', async () => {
      const result = await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.interpreter).toBe('react-i');
    });

    it('returns exists for duplicate registration', async () => {
      await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);
      const result = await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'svelte' }, storage);
      expect(result.variant).toBe('exists');
    });
  });

  describe('execute with provider discovery', () => {
    it('delegates to the matching provider via plugin-registry', async () => {
      // Register interpreter
      await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);

      // Simulate provider self-registration in plugin-registry
      await storage.put('plugin-registry', 'render-interpreter-provider:react', {
        pluginKind: 'render-interpreter-provider',
        target: 'react',
        providerRef: 'render-interpreter-provider:react',
      });

      const program = JSON.stringify([
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'pure', output: 'done' },
      ]);

      const result = await renderInterpreterHandler.execute({
        interpreter: 'react-i',
        program,
        snapshot: 'current',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.delegateTo).toBeDefined();
      expect((result.delegateTo as Record<string, unknown>).concept).toBe('RenderInterpreterReact');
      expect((result.delegateTo as Record<string, unknown>).action).toBe('interpret');
    });

    it('returns notfound for missing interpreter', async () => {
      const result = await renderInterpreterHandler.execute({
        interpreter: 'missing',
        program: '{}',
        snapshot: 'current',
      }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('returns error when no provider is registered for target', async () => {
      await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);

      const result = await renderInterpreterHandler.execute({
        interpreter: 'react-i',
        program: '[]',
        snapshot: 'current',
      }, storage);
      expect(result.variant).toBe('error');
      expect((result.message as string)).toContain('No render-interpreter-provider');
    });
  });

  describe('dryRun with provider discovery', () => {
    it('returns delegation record without persisting execution', async () => {
      await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);
      await storage.put('plugin-registry', 'render-interpreter-provider:react', {
        pluginKind: 'render-interpreter-provider',
        target: 'react',
        providerRef: 'render-interpreter-provider:react',
      });

      const result = await renderInterpreterHandler.dryRun({
        interpreter: 'react-i',
        program: '[]',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.delegateTo).toBeDefined();
      const delegation = result.delegateTo as Record<string, unknown>;
      expect(delegation.concept).toBe('RenderInterpreterReact');
      expect((delegation.input as Record<string, unknown>).dryRun).toBe(true);

      // No execution persisted
      const executions = await storage.find('executions', {});
      expect(executions).toHaveLength(0);
    });
  });

  describe('listTargets', () => {
    it('returns all registered provider targets', async () => {
      await storage.put('plugin-registry', 'rip:react', {
        pluginKind: 'render-interpreter-provider',
        target: 'react',
      });
      await storage.put('plugin-registry', 'rip:svelte', {
        pluginKind: 'render-interpreter-provider',
        target: 'svelte',
      });

      const result = await renderInterpreterHandler.listTargets({}, storage);
      expect(result.variant).toBe('ok');
      const targets = JSON.parse(result.targets as string);
      expect(targets).toContain('react');
      expect(targets).toContain('svelte');
    });
  });
});

// ============================================================
// RenderInterpreterReact — self-registering provider tests
// ============================================================
describe('RenderInterpreterReact provider', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRenderInterpreterReactCounter();
  });

  describe('initialize', () => {
    it('self-registers in plugin-registry', async () => {
      const result = await renderInterpreterReactHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');

      const entries = await storage.find('plugin-registry', {
        pluginKind: 'render-interpreter-provider',
        target: 'react',
      });
      expect(entries.length).toBe(1);
      expect(entries[0].target).toBe('react');
    });

    it('is idempotent', async () => {
      await renderInterpreterReactHandler.initialize({}, storage);
      const result = await renderInterpreterReactHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');

      const entries = await storage.find('plugin-registry', {
        pluginKind: 'render-interpreter-provider',
        target: 'react',
      });
      expect(entries.length).toBe(1);
    });
  });

  describe('interpret', () => {
    it('produces a React functional component from instructions', async () => {
      const instructions = [
        { tag: 'prop', name: 'label', propType: 'String', defaultValue: 'Click' },
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'element', part: 'btn', role: 'action' },
        { tag: 'aria', part: 'root', attr: 'role', value: 'button' },
        { tag: 'stateDef', name: 'idle', initial: true },
        { tag: 'stateDef', name: 'pressed', initial: false },
        { tag: 'transition', fromState: 'idle', event: 'press', toState: 'pressed' },
        { tag: 'keyboard', key: 'Enter', event: 'press' },
        { tag: 'pure', output: 'Button' },
      ];

      const result = await renderInterpreterReactHandler.interpret({
        executionId: 'exec-1',
        instructions,
        componentName: 'MyButton',
      }, storage);

      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('export function MyButton');
      expect(output).toContain('useState');
      expect(output).toContain('data-part="root"');
      expect(output).toContain('data-part="btn"');
      expect(output).toContain('role="button"');
      expect(output).toContain('handleKeyDown');
      expect(output).toContain("case 'Enter'");

      // Execution persisted
      const exec = await storage.get('executions', 'exec-1');
      expect(exec).not.toBeNull();
      expect(exec!.status).toBe('completed');
      expect(exec!.target).toBe('react');
    });

    it('supports JSON-serialised instructions via program field', async () => {
      const instructions = [
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'pure', output: 'Widget' },
      ];

      const result = await renderInterpreterReactHandler.interpret({
        program: JSON.stringify(instructions),
        componentName: 'Widget',
      }, storage);

      expect(result.variant).toBe('ok');
      expect((result.output as string)).toContain('export function Widget');
    });

    it('supports dry run without persisting', async () => {
      const result = await renderInterpreterReactHandler.interpret({
        instructions: [{ tag: 'element', part: 'root', role: 'container' }],
        componentName: 'Widget',
        dryRun: true,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.dryRun).toBe(true);
      const executions = await storage.find('executions', {});
      expect(executions).toHaveLength(0);
    });

    it('returns error for missing instructions', async () => {
      const result = await renderInterpreterReactHandler.interpret({
        componentName: 'Widget',
      }, storage);
      expect(result.variant).toBe('error');
    });
  });
});

// ============================================================
// RenderInterpreterSvelte — self-registering provider tests
// ============================================================
describe('RenderInterpreterSvelte provider', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRenderInterpreterSvelteCounter();
  });

  describe('initialize', () => {
    it('self-registers in plugin-registry', async () => {
      const result = await renderInterpreterSvelteHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');

      const entries = await storage.find('plugin-registry', {
        pluginKind: 'render-interpreter-provider',
        target: 'svelte',
      });
      expect(entries.length).toBe(1);
      expect(entries[0].target).toBe('svelte');
    });
  });

  describe('interpret', () => {
    it('produces a Svelte component from instructions', async () => {
      const instructions = [
        { tag: 'prop', name: 'title', propType: 'String', defaultValue: '' },
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'stateDef', name: 'open', initial: true },
        { tag: 'stateDef', name: 'closed', initial: false },
        { tag: 'transition', fromState: 'open', event: 'close', toState: 'closed' },
        { tag: 'keyboard', key: 'Escape', event: 'close' },
        { tag: 'pure', output: 'Dialog' },
      ];

      const result = await renderInterpreterSvelteHandler.interpret({
        executionId: 'exec-svelte-1',
        instructions,
        componentName: 'MyDialog',
      }, storage);

      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('<script lang="ts">');
      expect(output).toContain('export let title');
      expect(output).toContain('data-part="root"');
      expect(output).toContain("case 'Escape'");
      expect(output).toContain('function send');
    });

    it('returns error for missing instructions', async () => {
      const result = await renderInterpreterSvelteHandler.interpret({
        componentName: 'Widget',
      }, storage);
      expect(result.variant).toBe('error');
    });
  });
});

// ============================================================
// A11yAuditProvider — functional handler tests
// ============================================================
describe('A11yAuditProvider handler (functional)', () => {
  describe('audit', () => {
    it('returns a StorageProgram with audit results', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a1',
        program: 'rp1',
        instructions: [
          { tag: 'element', part: 'root', role: 'container' },
          { tag: 'element', part: 'btn', role: 'interactive' },
          { tag: 'aria', part: 'btn', attr: 'label', value: 'Submit' },
          { tag: 'keyboard', key: 'Enter', event: 'submit' },
          { tag: 'keyboard', key: 'Escape', event: 'cancel' },
          { tag: 'keyboard', key: 'Tab', event: 'next' },
        ],
        parts: ['root', 'btn'],
      });

      const pureVal = getPureValue(result);
      expect(pureVal).not.toBeNull();
      expect(pureVal!.variant).toBe('ok');
      expect(pureVal!.audit).toBe('a1');
    });

    it('detects missing ARIA on interactive parts', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a2',
        program: 'rp1',
        instructions: [
          { tag: 'element', part: 'btn', role: 'interactive' },
          // no aria attributes
        ],
        parts: ['btn'],
      });

      const pureVal = getPureValue(result);
      expect(pureVal!.variant).toBe('ok');
      const findings = JSON.parse(pureVal!.findings as string);
      expect(findings.some((f: string) => f.includes('btn') && f.includes('no ARIA'))).toBe(true);
      expect(pureVal!.passed).toBe(false);
    });

    it('detects missing keyboard mappings', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a3',
        program: 'rp1',
        instructions: [
          { tag: 'element', part: 'btn', role: 'action' },
          { tag: 'keyboard', key: 'Enter', event: 'submit' },
          // missing Escape and Tab
        ],
        parts: ['btn'],
      });

      const pureVal = getPureValue(result);
      const findings = JSON.parse(pureVal!.findings as string);
      expect(findings.some((f: string) => f.includes('Escape'))).toBe(true);
      expect(findings.some((f: string) => f.includes('Tab'))).toBe(true);
    });

    it('detects missing focus trap for dialog', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a4',
        program: 'rp1',
        instructions: [
          { tag: 'element', part: 'root', role: 'container' },
          { tag: 'aria', part: 'root', attr: 'role', value: 'dialog' },
          // no focus configuration
        ],
        parts: ['root'],
      });

      const pureVal = getPureValue(result);
      const findings = JSON.parse(pureVal!.findings as string);
      expect(findings.some((f: string) => f.includes('Dialog') && f.includes('focus'))).toBe(true);
    });

    it('passes for fully accessible program', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a5',
        program: 'rp1',
        instructions: [
          { tag: 'element', part: 'root', role: 'container' },
          { tag: 'element', part: 'btn', role: 'action' },
          { tag: 'aria', part: 'btn', attr: 'label', value: 'Submit' },
          { tag: 'keyboard', key: 'Enter', event: 'submit' },
          { tag: 'keyboard', key: 'Escape', event: 'cancel' },
          { tag: 'keyboard', key: 'Tab', event: 'next' },
        ],
        parts: ['root', 'btn'],
      });

      const pureVal = getPureValue(result);
      expect(pureVal!.passed).toBe(true);
    });

    it('produces a write-only StorageProgram', () => {
      const result = a11yAuditProviderHandler.audit({
        audit: 'a1',
        program: 'rp1',
        instructions: [],
        parts: [],
      });

      const reads = extractReadSet(result);
      const writes = extractWriteSet(result);
      expect(reads.size).toBe(0);
      expect(writes.size).toBeGreaterThan(0);
      expect(classifyPurity(result)).toBe('read-write');
    });
  });
});

// ============================================================
// DeadPartProvider — functional handler tests
// ============================================================
describe('DeadPartProvider handler (functional)', () => {
  describe('analyze', () => {
    it('detects dead parts with no references', () => {
      const result = deadPartProviderHandler.analyze({
        analysis: 'd1',
        program: 'rp1',
        parts: ['root', 'header', 'unused'],
        instructions: [
          { tag: 'element', part: 'root', role: 'container' },
          { tag: 'element', part: 'header', role: 'text' },
          { tag: 'element', part: 'unused', role: 'presentation' },
          { tag: 'text', part: 'root', content: 'Hello' },
          { tag: 'bind', part: 'header', attr: 'class', expr: 'styles.h1' },
        ],
      });

      const pureVal = getPureValue(result);
      expect(pureVal!.variant).toBe('ok');
      const deadParts = JSON.parse(pureVal!.deadParts as string);
      expect(deadParts).toContain('unused');
      expect(deadParts).not.toContain('root');
      expect(deadParts).not.toContain('header');
    });

    it('detects unreachable FSM states', () => {
      const result = deadPartProviderHandler.analyze({
        analysis: 'd2',
        program: 'rp1',
        parts: [],
        instructions: [
          { tag: 'stateDef', name: 'idle', initial: true },
          { tag: 'stateDef', name: 'active', initial: false },
          { tag: 'stateDef', name: 'orphan', initial: false },
          { tag: 'transition', fromState: 'idle', event: 'click', toState: 'active' },
          // orphan has no inbound transition
        ],
      });

      const pureVal = getPureValue(result);
      const unreachableStates = JSON.parse(pureVal!.unreachableStates as string);
      expect(unreachableStates).toContain('orphan');
      expect(unreachableStates).not.toContain('idle');
      expect(unreachableStates).not.toContain('active');
    });

    it('returns empty sets when everything is connected', () => {
      const result = deadPartProviderHandler.analyze({
        analysis: 'd3',
        program: 'rp1',
        parts: ['root'],
        instructions: [
          { tag: 'element', part: 'root', role: 'container' },
          { tag: 'text', part: 'root', content: 'Hello' },
        ],
      });

      const pureVal = getPureValue(result);
      expect(JSON.parse(pureVal!.deadParts as string)).toEqual([]);
      expect(JSON.parse(pureVal!.unreachableStates as string)).toEqual([]);
    });

    it('produces a write-only StorageProgram', () => {
      const result = deadPartProviderHandler.analyze({
        analysis: 'd1',
        program: 'rp1',
        parts: [],
        instructions: [],
      });

      expect(extractReadSet(result).size).toBe(0);
      expect(extractWriteSet(result).size).toBeGreaterThan(0);
      expect(classifyPurity(result)).toBe('read-write');
    });
  });
});

// ============================================================
// ThemeComplianceProvider — functional handler tests
// ============================================================
describe('ThemeComplianceProvider handler (functional)', () => {
  describe('verify', () => {
    it('passes when all tokens resolve', () => {
      const result = themeComplianceProviderHandler.verify({
        check: 'tc1',
        program: 'rp1',
        tokens: ['color.primary', 'spacing.md'],
        manifest: 'default-theme',
      });

      const pureVal = getPureValue(result);
      expect(pureVal!.variant).toBe('ok');
      expect(pureVal!.passed).toBe(true);
      expect(JSON.parse(pureVal!.missingTokens as string)).toEqual([]);
    });

    it('detects missing tokens', () => {
      const result = themeComplianceProviderHandler.verify({
        check: 'tc2',
        program: 'rp1',
        tokens: ['color.primary', 'nonexistent.token'],
        manifest: 'default-theme',
      });

      const pureVal = getPureValue(result);
      const missingTokens = JSON.parse(pureVal!.missingTokens as string);
      expect(missingTokens).toContain('nonexistent.token');
      expect(missingTokens).not.toContain('color.primary');
    });

    it('detects deprecated tokens', () => {
      const result = themeComplianceProviderHandler.verify({
        check: 'tc3',
        program: 'rp1',
        tokens: ['color.primary', 'legacy.old-color'],
        manifest: 'default-theme',
      });

      const pureVal = getPureValue(result);
      const deprecatedTokens = JSON.parse(pureVal!.deprecatedTokens as string);
      expect(deprecatedTokens).toContain('legacy.old-color');
      expect(pureVal!.passed).toBe(false);
    });

    it('works with a JSON manifest', () => {
      const manifest = JSON.stringify({
        'brand.primary': '#ff0000',
        'brand.secondary': '#00ff00',
      });

      const result = themeComplianceProviderHandler.verify({
        check: 'tc4',
        program: 'rp1',
        tokens: ['brand.primary'],
        manifest,
      });

      const pureVal = getPureValue(result);
      expect(pureVal!.passed).toBe(true);
    });

    it('produces a write-only StorageProgram', () => {
      const result = themeComplianceProviderHandler.verify({
        check: 'tc1',
        program: 'rp1',
        tokens: [],
        manifest: 'default-theme',
      });

      expect(extractReadSet(result).size).toBe(0);
      expect(extractWriteSet(result).size).toBeGreaterThan(0);
      expect(classifyPurity(result)).toBe('read-write');
    });
  });
});

// ============================================================
// Integration: Full render pipeline with provider delegation
// ============================================================
describe('Surface render pipeline integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRenderInterpreterReactCounter();
    resetRenderInterpreterSvelteCounter();
  });

  it('builds a render program, audits it, detects dead parts, checks compliance, and delegates to React provider', async () => {
    // Step 1: Build a render program imperatively
    await renderProgramHandler.create({ program: 'dialog' }, storage);
    await renderProgramHandler.element({ program: 'dialog', part: 'root', role: 'container' }, storage);
    await renderProgramHandler.element({ program: 'dialog', part: 'title', role: 'text' }, storage);
    await renderProgramHandler.element({ program: 'dialog', part: 'body', role: 'text' }, storage);
    await renderProgramHandler.element({ program: 'dialog', part: 'footer', role: 'presentation' }, storage);
    await renderProgramHandler.prop({ program: 'dialog', name: 'heading', propType: 'String', defaultValue: '' }, storage);
    await renderProgramHandler.text({ program: 'dialog', part: 'title', content: '{props.heading}' }, storage);
    await renderProgramHandler.bind({ program: 'dialog', part: 'body', attr: 'innerHTML', expr: 'props.content' }, storage);
    await renderProgramHandler.aria({ program: 'dialog', part: 'root', attr: 'role', value: 'dialog' }, storage);
    await renderProgramHandler.aria({ program: 'dialog', part: 'root', attr: 'label', value: 'Dialog' }, storage);
    await renderProgramHandler.keyboard({ program: 'dialog', key: 'Escape', event: 'close' }, storage);
    await renderProgramHandler.keyboard({ program: 'dialog', key: 'Enter', event: 'confirm' }, storage);
    await renderProgramHandler.keyboard({ program: 'dialog', key: 'Tab', event: 'next' }, storage);
    await renderProgramHandler.focus({ program: 'dialog', strategy: 'trap', initialPart: 'root' }, storage);
    await renderProgramHandler.stateDef({ program: 'dialog', name: 'open', initial: true }, storage);
    await renderProgramHandler.stateDef({ program: 'dialog', name: 'closed', initial: false }, storage);
    await renderProgramHandler.transition({ program: 'dialog', fromState: 'open', event: 'close', toState: 'closed' }, storage);
    await renderProgramHandler.token({ program: 'dialog', path: 'color.surface', fallback: '#fff' }, storage);
    await renderProgramHandler.token({ program: 'dialog', path: 'elevation.lg', fallback: '0 8px 16px rgba(0,0,0,0.2)' }, storage);
    await renderProgramHandler.compose({ program: 'dialog', widget: 'Button', slot: 'footer' }, storage);
    await renderProgramHandler.pure({ program: 'dialog', output: 'complete' }, storage);

    const prog = await storage.get('programs', 'dialog');
    expect(prog!.terminated).toBe(true);
    expect((prog!.parts as string[]).length).toBe(4);
    expect((prog!.tokens as string[]).length).toBe(2);

    // Step 2: A11y audit (functional — inspect program structure)
    const auditResult = a11yAuditProviderHandler.audit({
      audit: 'dialog-audit',
      program: 'dialog',
      instructions: prog!.instructions as unknown[],
      parts: prog!.parts as string[],
    });
    const auditVal = getPureValue(auditResult);
    expect(auditVal!.variant).toBe('ok');

    // Step 3: Dead part analysis
    const deadResult = deadPartProviderHandler.analyze({
      analysis: 'dialog-dead',
      program: 'dialog',
      parts: prog!.parts as string[],
      instructions: prog!.instructions as unknown[],
    });
    const deadVal = getPureValue(deadResult);
    expect(deadVal!.variant).toBe('ok');

    // Step 4: Theme compliance
    const complianceResult = themeComplianceProviderHandler.verify({
      check: 'dialog-theme',
      program: 'dialog',
      tokens: prog!.tokens as string[],
      manifest: 'default-theme',
    });
    const complianceVal = getPureValue(complianceResult);
    expect(complianceVal!.variant).toBe('ok');
    expect(complianceVal!.passed).toBe(true);

    // Step 5: React provider self-registers in plugin-registry
    await renderInterpreterReactHandler.initialize({}, storage);

    // Step 6: RenderInterpreter dispatches to the React provider
    await renderInterpreterHandler.register({ interpreter: 'react-i', target: 'react' }, storage);
    const dispatchResult = await renderInterpreterHandler.execute({
      interpreter: 'react-i',
      program: JSON.stringify(prog!.instructions),
      snapshot: 'current',
      componentName: 'Dialog',
    }, storage);
    expect(dispatchResult.variant).toBe('ok');
    expect(dispatchResult.delegateTo).toBeDefined();

    const delegation = dispatchResult.delegateTo as Record<string, unknown>;
    expect(delegation.concept).toBe('RenderInterpreterReact');

    // Step 7: React provider interprets the instructions (simulating sync delegation)
    const delegatedInput = delegation.input as Record<string, unknown>;
    const reactResult = await renderInterpreterReactHandler.interpret({
      executionId: delegatedInput.executionId,
      instructions: prog!.instructions,
      componentName: delegatedInput.componentName,
    }, storage);

    expect(reactResult.variant).toBe('ok');
    const output = reactResult.output as string;
    expect(output).toContain('export function Dialog');
    expect(output).toContain('useState');
    expect(output).toContain('data-part="root"');
    expect(output).toContain('role="dialog"');
    expect(output).toContain("case 'Escape'");
    expect(output).toContain('focus-trap');
  });

  it('end-to-end: buildRenderProgram from WidgetManifest then interpret via Svelte provider', async () => {
    // Build a WidgetManifest programmatically (mimicking what the parser produces)
    const manifest = {
      name: 'Toggle',
      props: [
        { name: 'checked', type: 'Bool', defaultValue: 'false' },
        { name: 'label', type: 'String', defaultValue: '' },
      ],
      anatomy: [
        { name: 'root', role: 'interactive', children: [
          { name: 'thumb', role: 'presentation', children: [] },
        ] },
      ],
      states: [
        { name: 'off', initial: true, transitions: [{ event: 'TOGGLE', target: 'on' }] },
        { name: 'on', initial: false, transitions: [{ event: 'TOGGLE', target: 'off' }] },
      ],
      accessibility: {
        role: 'switch',
        keyboard: [
          { key: 'Enter', action: 'TOGGLE' },
          { key: 'Space', action: 'TOGGLE' },
        ],
        focus: { initial: 'root' },
        ariaBindings: [
          { part: 'root', attrs: [{ name: 'aria-checked', value: 'state == on' }] },
        ],
      },
      connect: [
        { part: 'root', attrs: [{ name: 'onClick', value: 'send(TOGGLE)' }] },
      ],
      composedWidgets: [],
      invariants: [],
      affordance: [],
    };

    // Build RenderProgram from manifest
    const built = buildRenderProgram(manifest as any);
    expect(built.name).toBe('Toggle');
    expect(built.parts).toContain('root');
    expect(built.parts).toContain('thumb');
    expect(built.props).toContain('checked');
    expect(built.props).toContain('label');

    // Svelte provider self-registers and interprets
    await renderInterpreterSvelteHandler.initialize({}, storage);

    const svelteResult = await renderInterpreterSvelteHandler.interpret({
      executionId: 'toggle-svelte',
      instructions: built.instructions,
      componentName: 'Toggle',
    }, storage);

    expect(svelteResult.variant).toBe('ok');
    const svelteOutput = svelteResult.output as string;
    expect(svelteOutput).toContain('<script lang="ts">');
    expect(svelteOutput).toContain('export let checked');
    expect(svelteOutput).toContain('export let label');
    expect(svelteOutput).toContain('data-part="root"');
    expect(svelteOutput).toContain('data-part="thumb"');
    expect(svelteOutput).toContain('function send');
    expect(svelteOutput).toContain("case 'Enter'");
  });
});
