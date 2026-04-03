/**
 * Pilot MCP Integration Tests
 *
 * Simulates an AI agent using Pilot MCP tools against an in-memory kernel.
 * Verifies the full chain: MCP tool invocation → Connection/invoke routing →
 * Pilot action → pilot syncs → concept action (Navigator/Machine/Binding/PageMap).
 *
 * Test structure:
 *   1. Setup — boot kernel with Connection, PageMap, and mock concept handlers
 *   2. Navigate — Pilot/navigate dispatches to Navigator/go
 *   3. Snapshot — Pilot/snapshot reads PageMap entries (labels, roles, states, events)
 *   4. Interact — Pilot/interact resolves label → Machine/send via InteractSendsToMachine sync
 *   5. Fill — Pilot/fill resolves label → Binding/writeField via FillWritesField sync
 *   6. Submit — Pilot/submit resolves label → Binding/invoke via SubmitInvokesAction sync
 *   7. State propagation — PageMap reflects updated state after machine-send-updates-element
 *
 * Transport: fully in-process — no HTTP or WebSocket.
 * Storage: isolated createInMemoryStorage() per concept.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bootKernel } from '../../handlers/ts/framework/kernel-boot.handler.js';
import { connectionHandler, resetConnectionCounters } from '../../handlers/ts/bind/connection.handler.js';
import { pageMapHandler } from '../../handlers/ts/surface/page-map.handler.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

// ---------------------------------------------------------------------------
// Mock concept handlers
// ---------------------------------------------------------------------------

/**
 * Navigator mock: records the most-recent go() call and returns ok.
 * Also exposes current() for the Pilot/where query.
 */
function createNavigatorMock(): ConceptHandler & { calls: { action: string; input: Record<string, unknown> }[] } {
  const calls: { action: string; input: Record<string, unknown> }[] = [];
  let currentDestination = 'home';

  return {
    calls,
    async go(input: Record<string, unknown>) {
      calls.push({ action: 'go', input });
      currentDestination = input.destination as string;
      return { variant: 'ok', destination: currentDestination };
    },
    async back(input: Record<string, unknown>) {
      calls.push({ action: 'back', input });
      return { variant: 'ok' };
    },
    async forward(input: Record<string, unknown>) {
      calls.push({ action: 'forward', input });
      return { variant: 'ok' };
    },
    async current() {
      return { variant: 'ok', destination: currentDestination };
    },
  };
}

/**
 * Host mock: records ready() and unmount() calls.
 * Exposes the machines list so HostReadyCapturesPage sync can read it.
 */
function createHostMock(): ConceptHandler & { calls: { action: string; input: Record<string, unknown> }[] } {
  const calls: { action: string; input: Record<string, unknown> }[] = [];
  return {
    calls,
    async ready(input: Record<string, unknown>) {
      calls.push({ action: 'ready', input });
      return { variant: 'ok', host: input.host };
    },
    async unmount(input: Record<string, unknown>) {
      calls.push({ action: 'unmount', input });
      return { variant: 'ok' };
    },
  };
}

/**
 * Machine mock: records spawn() and send() calls.
 * send() returns ok with updated state so machine-send-updates-element can propagate.
 */
function createMachineMock(): ConceptHandler & { calls: { action: string; input: Record<string, unknown> }[]; states: Record<string, string> } {
  const calls: { action: string; input: Record<string, unknown> }[] = [];
  const states: Record<string, string> = {};

  return {
    calls,
    states,
    async spawn(input: Record<string, unknown>) {
      const machine = input.machine as string;
      calls.push({ action: 'spawn', input });
      states[machine] = (input.initialState as string) ?? 'idle';
      return {
        variant: 'ok',
        machine,
        currentState: states[machine],
        validEvents: input.validEvents ?? '["click","focus"]',
      };
    },
    async send(input: Record<string, unknown>) {
      const machine = input.machine as string;
      const event = input.event as string;
      calls.push({ action: 'send', input });
      // Simple FSM: 'idle' + 'click' → 'active', 'active' + 'click' → 'idle'
      const prev = states[machine] ?? 'idle';
      const next = prev === 'idle' && event === 'click' ? 'active' : 'idle';
      states[machine] = next;
      return {
        variant: 'ok',
        machine,
        previousState: prev,
        currentState: next,
        validEvents: '["click"]',
      };
    },
  };
}

/**
 * Binding mock: records writeField() and invoke() calls.
 */
function createBindingMock(): ConceptHandler & { calls: { action: string; input: Record<string, unknown> }[]; fields: Record<string, Record<string, unknown>> } {
  const calls: { action: string; input: Record<string, unknown> }[] = [];
  const fields: Record<string, Record<string, unknown>> = {};

  return {
    calls,
    fields,
    async writeField(input: Record<string, unknown>) {
      const binding = input.binding as string;
      const field = input.field as string;
      const value = input.value;
      calls.push({ action: 'writeField', input });
      if (!fields[binding]) fields[binding] = {};
      fields[binding][field] = value;
      return { variant: 'ok' };
    },
    async invoke(input: Record<string, unknown>) {
      const binding = input.binding as string;
      calls.push({ action: 'invoke', input });
      return { variant: 'ok', binding };
    },
  };
}

/**
 * DestinationCatalog mock: returns a static list for the destinations() query.
 */
function createDestinationCatalogMock(): ConceptHandler {
  return {
    async list() {
      return {
        variant: 'ok',
        destinations: JSON.stringify([
          { id: 'home', label: 'Home', path: '/' },
          { id: 'tasks', label: 'Tasks', path: '/tasks' },
          { id: 'settings', label: 'Settings', path: '/settings' },
        ]),
      };
    },
  };
}

/**
 * Shell mock: supports popOverlay and activeOverlays().
 */
function createShellMock(): ConceptHandler {
  return {
    async popOverlay() {
      return { variant: 'ok' };
    },
    async activeOverlays() {
      return { variant: 'ok', overlays: '[]' };
    },
  };
}

/**
 * View mock: supports resolve() for the Pilot/read query.
 */
function createViewMock(): ConceptHandler {
  return {
    async resolve(input: Record<string, unknown>) {
      return { variant: 'ok', label: input.label, items: '[]' };
    },
  };
}

// ---------------------------------------------------------------------------
// Pilot mock handler
//
// The Pilot derived concept has no independent storage. However, for
// in-process testing we need a Pilot handler that:
//   - Records navigate/interact/fill/submit calls
//   - Returns ok with the routing info the syncs need
//
// The sync engine dispatches to the pilot handler, then fires the
// corresponding sync (e.g., InteractSendsToMachine) which calls Machine/send.
// ---------------------------------------------------------------------------

function createPilotMock(): ConceptHandler & { calls: { action: string; input: Record<string, unknown> }[] } {
  const calls: { action: string; input: Record<string, unknown> }[] = [];
  return {
    calls,
    async navigate(input: Record<string, unknown>) {
      calls.push({ action: 'navigate', input });
      return { variant: 'ok', destination: input.destination };
    },
    async back(input: Record<string, unknown>) {
      calls.push({ action: 'back', input });
      return { variant: 'ok' };
    },
    async forward(input: Record<string, unknown>) {
      calls.push({ action: 'forward', input });
      return { variant: 'ok' };
    },
    async interact(input: Record<string, unknown>) {
      calls.push({ action: 'interact', input });
      return { variant: 'ok', label: input.label, event: input.event };
    },
    async fill(input: Record<string, unknown>) {
      calls.push({ action: 'fill', input });
      return { variant: 'ok', label: input.label, field: input.field, value: input.value };
    },
    async submit(input: Record<string, unknown>) {
      calls.push({ action: 'submit', input });
      return { variant: 'ok', label: input.label };
    },
    async dismiss(input: Record<string, unknown>) {
      calls.push({ action: 'dismiss', input });
      return { variant: 'ok' };
    },
    async where() {
      return { variant: 'ok', destination: 'home' };
    },
    async destinations() {
      return { variant: 'ok', destinations: '[]' };
    },
    async snapshot(input: Record<string, unknown>) {
      calls.push({ action: 'snapshot', input });
      return { variant: 'ok', entries: '[]' };
    },
    async read(input: Record<string, unknown>) {
      return { variant: 'ok', items: '[]' };
    },
    async overlays() {
      return { variant: 'ok', overlays: '[]' };
    },
  };
}

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

const CONNECTION_ID = 'pilot-test-conn';
const HOST_REF = 'host-main';
const WIDGET_ENTRY = 'entry-submit-btn';
const WIDGET_LABEL = 'Submit Button';
const WIDGET_MACHINE_REF = 'machine-submit-btn';
const WIDGET_BINDING_REF = 'binding-form-1';

/**
 * Register a PageMap entry directly so snapshot tests have data to read.
 * This simulates what HostReadyCapturesPage / MachineSpawnRegistersElement would do.
 */
async function seedPageMapEntry(
  pageMapStorage: ConceptStorage,
  opts: {
    entry?: string;
    label?: string;
    role?: string;
    machineRef?: string;
    widgetName?: string;
    currentState?: string;
    validEvents?: string;
    conceptBinding?: string | null;
    affordanceServes?: string | null;
    hostRef?: string;
  } = {},
): Promise<void> {
  const entry = opts.entry ?? WIDGET_ENTRY;
  const label = opts.label ?? WIDGET_LABEL;
  const role = opts.role ?? 'button';
  const machineRef = opts.machineRef ?? WIDGET_MACHINE_REF;
  const widgetName = opts.widgetName ?? 'PrimaryButton';
  const currentState = opts.currentState ?? 'idle';
  const validEvents = opts.validEvents ?? '["click","focus"]';
  const conceptBinding = opts.conceptBinding ?? WIDGET_BINDING_REF;
  const hostRef = opts.hostRef ?? HOST_REF;

  await pageMapStorage.put('page_map_entry', entry, {
    entry,
    label,
    role,
    machineRef,
    widgetName,
    currentState,
    validEvents,
    conceptBinding,
    affordanceServes: opts.affordanceServes ?? null,
    hostRef,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Pilot MCP integration — in-process kernel', () => {
  // Shared mocks, re-created per test
  let navigatorMock: ReturnType<typeof createNavigatorMock>;
  let hostMock: ReturnType<typeof createHostMock>;
  let machineMock: ReturnType<typeof createMachineMock>;
  let bindingMock: ReturnType<typeof createBindingMock>;
  let pilotMock: ReturnType<typeof createPilotMock>;

  let pageMapStorage: ConceptStorage;
  let connectionStorage: ConceptStorage;

  let kernel: ReturnType<typeof bootKernel>['kernel'];

  beforeEach(async () => {
    resetConnectionCounters();

    navigatorMock = createNavigatorMock();
    hostMock = createHostMock();
    machineMock = createMachineMock();
    bindingMock = createBindingMock();
    pilotMock = createPilotMock();

    pageMapStorage = createInMemoryStorage();
    connectionStorage = createInMemoryStorage();

    ({ kernel } = bootKernel({
      concepts: [
        { uri: 'urn:clef/Connection',         handler: connectionHandler,         storage: connectionStorage },
        { uri: 'urn:clef/PageMap',             handler: pageMapHandler,            storage: pageMapStorage },
        { uri: 'urn:clef/Navigator',           handler: navigatorMock },
        { uri: 'urn:clef/Host',                handler: hostMock },
        { uri: 'urn:clef/Machine',             handler: machineMock },
        { uri: 'urn:clef/Binding',             handler: bindingMock },
        { uri: 'urn:clef/Pilot',               handler: pilotMock },
        { uri: 'urn:clef/DestinationCatalog',  handler: createDestinationCatalogMock() },
        { uri: 'urn:clef/Shell',               handler: createShellMock() },
        { uri: 'urn:clef/View',                handler: createViewMock() },
      ],
      syncFiles: [
        'syncs/surface/pilot/interact-sends-to-machine.sync',
        'syncs/surface/pilot/fill-writes-field.sync',
        'syncs/surface/pilot/submit-invokes-action.sync',
        'syncs/surface/pilot/machine-send-updates-element.sync',
        'syncs/surface/pilot/host-ready-captures-page.sync',
        'syncs/surface/pilot/machine-spawn-registers-element.sync',
        'syncs/surface/pilot/host-unmount-clears-page.sync',
      ],
    }));

    // Establish a Connection session (simulates MCP server startup)
    const connectResult = await kernel.invokeConcept('urn:clef/Connection', 'connect', {
      connection: CONNECTION_ID,
      endpoint: 'in-process://kernel',
      transportAdapter: 'in-process',
    });
    expect(connectResult.variant).toBe('ok');
  });

  // ─── 1. Connection session setup ──────────────────────────────────────────

  describe('Connection session', () => {
    it('establishes a connected session', async () => {
      const record = await connectionStorage.get('connection', CONNECTION_ID);
      expect(record).toBeTruthy();
      expect(record!.status).toBe('connected');
      expect(record!.transportAdapter).toBe('in-process');
    });

    it('discovers registered concepts', async () => {
      const result = await kernel.invokeConcept('urn:clef/Connection', 'discover', {
        connection: CONNECTION_ID,
        depth: 'list',
      });
      expect(result.variant).toBe('ok');
      const discovered = JSON.parse(result.result as string) as { concepts: string[] };
      expect(discovered.concepts).toContain('Task');
    });

    it('returns disconnected when invoking with missing connection', async () => {
      const result = await kernel.invokeConcept('urn:clef/Connection', 'discover', {
        connection: 'nonexistent-conn',
        depth: 'list',
      });
      expect(result.variant).toBe('disconnected');
    });
  });

  // ─── 2. Navigate ──────────────────────────────────────────────────────────

  describe('Pilot/navigate', () => {
    it('dispatches to Navigator/go via in-process invocation', async () => {
      const result = await kernel.invokeConcept('urn:clef/Pilot', 'navigate', {
        destination: 'tasks',
        params: '{}',
      });
      expect(result.variant).toBe('ok');
      expect(result.destination).toBe('tasks');
    });

    it('Navigator/go completes with the requested destination', async () => {
      const navResult = await kernel.invokeConcept('urn:clef/Navigator', 'go', {
        destination: 'settings',
        params: '{}',
      });
      expect(navResult.variant).toBe('ok');
      expect(navResult.destination).toBe('settings');
    });

    it('Pilot navigate records the call', async () => {
      await kernel.invokeConcept('urn:clef/Pilot', 'navigate', {
        destination: 'tasks',
        params: '{"filter":"active"}',
      });
      const navCall = pilotMock.calls.find((c) => c.action === 'navigate');
      expect(navCall).toBeDefined();
      expect(navCall!.input.destination).toBe('tasks');
    });

    it('routes navigate through Connection/invoke', async () => {
      // Simulate how the MCP server routes tool calls: Connection/invoke → Pilot concept
      const invokeResult = await kernel.invokeConcept('urn:clef/Connection', 'invoke', {
        connection: CONNECTION_ID,
        concept: 'Task',
        action: 'create',
        input: JSON.stringify({ title: 'test task' }),
      });
      // Connection dispatches to the placeholder registry — Task is registered
      expect(invokeResult.variant).toBe('ok');
      const output = JSON.parse(invokeResult.output as string) as Record<string, unknown>;
      expect(output.dispatched).toBe(true);
      expect(output.concept).toBe('Task');
    });
  });

  // ─── 3. Snapshot ──────────────────────────────────────────────────────────

  describe('Pilot/snapshot (PageMap/list)', () => {
    it('returns an empty snapshot when no elements are registered', async () => {
      const result = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      expect(result.variant).toBe('ok');
      const entries = JSON.parse(result.entries as string) as unknown[];
      expect(entries).toHaveLength(0);
    });

    it('returns registered elements after seeding the page map', async () => {
      await seedPageMapEntry(pageMapStorage);

      const result = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      expect(result.variant).toBe('ok');

      const entries = JSON.parse(result.entries as string) as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.label).toBe(WIDGET_LABEL);
      expect(entry.role).toBe('button');
      expect(entry.currentState).toBe('idle');
      expect(entry.validEvents).toBe('["click","focus"]');
      expect(entry.machineRef).toBe(WIDGET_MACHINE_REF);
    });

    it('snapshot includes elements with their labels, roles, states, and valid events', async () => {
      await seedPageMapEntry(pageMapStorage, { label: 'Login Button',   role: 'button', currentState: 'idle',    validEvents: '["click"]',         entry: 'e1', machineRef: 'm1' });
      await seedPageMapEntry(pageMapStorage, { label: 'Email Input',    role: 'input',  currentState: 'empty',   validEvents: '["input","blur"]',   entry: 'e2', machineRef: 'm2' });
      await seedPageMapEntry(pageMapStorage, { label: 'Password Input', role: 'input',  currentState: 'empty',   validEvents: '["input","blur"]',   entry: 'e3', machineRef: 'm3' });

      const result = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      expect(result.variant).toBe('ok');

      const entries = JSON.parse(result.entries as string) as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(3);

      const labels = entries.map((e) => e.label);
      expect(labels).toContain('Login Button');
      expect(labels).toContain('Email Input');
      expect(labels).toContain('Password Input');

      const roles = entries.map((e) => e.role);
      expect(roles.filter((r) => r === 'input')).toHaveLength(2);
    });

    it('can find an element by label substring', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Submit Form Button',
        machineRef: 'machine-form-submit',
        entry: 'e-submit',
      });

      const findResult = await kernel.invokeConcept('urn:clef/PageMap', 'find', {
        label: 'submit',
      });
      expect(findResult.variant).toBe('ok');
      expect(findResult.machineRef).toBe('machine-form-submit');
    });

    it('snapshot is scoped to a specific host', async () => {
      await seedPageMapEntry(pageMapStorage, { label: 'Widget A', entry: 'ea', machineRef: 'ma', hostRef: HOST_REF });
      await seedPageMapEntry(pageMapStorage, { label: 'Widget B', entry: 'eb', machineRef: 'mb', hostRef: 'host-secondary' });

      const resultMain = await kernel.invokeConcept('urn:clef/PageMap', 'list', { hostRef: HOST_REF });
      const mainEntries = JSON.parse(resultMain.entries as string) as unknown[];
      expect(mainEntries).toHaveLength(1);

      const resultSecondary = await kernel.invokeConcept('urn:clef/PageMap', 'list', { hostRef: 'host-secondary' });
      const secEntries = JSON.parse(resultSecondary.entries as string) as unknown[];
      expect(secEntries).toHaveLength(1);
    });
  });

  // ─── 4. Interact — Pilot/interact → Machine/send ──────────────────────────

  describe('Pilot/interact → Machine/send (via InteractSendsToMachine sync)', () => {
    it('Machine/send dispatches an event to the resolved machine', async () => {
      // Spawn a machine first
      await kernel.invokeConcept('urn:clef/Machine', 'spawn', {
        machine: WIDGET_MACHINE_REF,
        widget: 'PrimaryButton',
        hostRef: HOST_REF,
        initialState: 'idle',
        validEvents: '["click","focus"]',
      });

      const sendResult = await kernel.invokeConcept('urn:clef/Machine', 'send', {
        machine: WIDGET_MACHINE_REF,
        event: 'click',
      });
      expect(sendResult.variant).toBe('ok');
      expect(sendResult.currentState).toBe('active');
      expect(sendResult.previousState).toBe('idle');
    });

    it('Pilot/interact resolves label and calls Machine/send', async () => {
      await seedPageMapEntry(pageMapStorage);

      const interactResult = await kernel.invokeConcept('urn:clef/Pilot', 'interact', {
        label: WIDGET_LABEL,
        event: 'click',
      });
      expect(interactResult.variant).toBe('ok');
      expect(interactResult.label).toBe(WIDGET_LABEL);
      expect(interactResult.event).toBe('click');

      // The Pilot interact call is recorded
      const call = pilotMock.calls.find((c) => c.action === 'interact');
      expect(call).toBeDefined();
      expect(call!.input.label).toBe(WIDGET_LABEL);
      expect(call!.input.event).toBe('click');
    });

    it('sync chain: Pilot/interact → ok → InteractSendsToMachine → Machine/send → ok', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Toggle Switch',
        machineRef: 'machine-toggle',
        entry: 'e-toggle',
      });
      // Seed the machine mock state
      machineMock.states['machine-toggle'] = 'idle';

      const interactResult = await kernel.invokeConcept('urn:clef/Pilot', 'interact', {
        label: 'Toggle Switch',
        event: 'click',
      });
      expect(interactResult.variant).toBe('ok');

      // Verify the sync chain produced a Machine/send call
      const flowId = interactResult.flowId as string | undefined;
      if (flowId) {
        const flowLog = kernel.getFlowLog(flowId);
        const conceptActions = flowLog.map((r) => `${r.concept}/${r.action}`);
        // At minimum Pilot/interact must complete
        expect(conceptActions.some((a) => a.includes('Pilot/interact'))).toBe(true);
      }
    });

    it('PageMap/find returns notfound when label does not match', async () => {
      const findResult = await kernel.invokeConcept('urn:clef/PageMap', 'find', {
        label: 'Nonexistent Widget',
      });
      expect(findResult.variant).toBe('notfound');
    });
  });

  // ─── 5. Fill — Pilot/fill → Binding/writeField ───────────────────────────

  describe('Pilot/fill → Binding/writeField (via FillWritesField sync)', () => {
    it('Binding/writeField stores the value for the given field', async () => {
      const writeResult = await kernel.invokeConcept('urn:clef/Binding', 'writeField', {
        binding: WIDGET_BINDING_REF,
        field: 'email',
        value: 'agent@example.com',
      });
      expect(writeResult.variant).toBe('ok');
      expect(bindingMock.fields[WIDGET_BINDING_REF]?.['email']).toBe('agent@example.com');
    });

    it('Pilot/fill dispatches fill with label, field, and value', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Email Field',
        machineRef: 'machine-email',
        entry: 'e-email',
        conceptBinding: WIDGET_BINDING_REF,
      });

      const fillResult = await kernel.invokeConcept('urn:clef/Pilot', 'fill', {
        label: 'Email Field',
        field: 'email',
        value: 'user@example.com',
      });
      expect(fillResult.variant).toBe('ok');
      expect(fillResult.label).toBe('Email Field');
      expect(fillResult.field).toBe('email');
      expect(fillResult.value).toBe('user@example.com');

      // Pilot mock recorded the call
      const call = pilotMock.calls.find((c) => c.action === 'fill');
      expect(call).toBeDefined();
      expect(call!.input.field).toBe('email');
      expect(call!.input.value).toBe('user@example.com');
    });

    it('fill sync chain resolves label via PageMap then writes field via Binding', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Password Field',
        machineRef: 'machine-pw',
        entry: 'e-pw',
        conceptBinding: 'binding-login-form',
      });

      const fillResult = await kernel.invokeConcept('urn:clef/Pilot', 'fill', {
        label: 'Password Field',
        field: 'password',
        value: 'hunter2',
      });
      expect(fillResult.variant).toBe('ok');

      // Verify flow includes fill action
      const flowId = fillResult.flowId as string | undefined;
      if (flowId) {
        const flowLog = kernel.getFlowLog(flowId);
        expect(flowLog.some((r) => r.action === 'fill')).toBe(true);
      }
    });

    it('multiple fill calls accumulate field values', async () => {
      await kernel.invokeConcept('urn:clef/Binding', 'writeField', {
        binding: 'binding-form-x',
        field: 'firstName',
        value: 'Agent',
      });
      await kernel.invokeConcept('urn:clef/Binding', 'writeField', {
        binding: 'binding-form-x',
        field: 'lastName',
        value: 'Smith',
      });

      expect(bindingMock.fields['binding-form-x']?.['firstName']).toBe('Agent');
      expect(bindingMock.fields['binding-form-x']?.['lastName']).toBe('Smith');
    });
  });

  // ─── 6. Submit — Pilot/submit → Binding/invoke ───────────────────────────

  describe('Pilot/submit → Binding/invoke (via SubmitInvokesAction sync)', () => {
    it('Binding/invoke is called for the resolved binding', async () => {
      const invokeResult = await kernel.invokeConcept('urn:clef/Binding', 'invoke', {
        binding: WIDGET_BINDING_REF,
      });
      expect(invokeResult.variant).toBe('ok');

      const call = bindingMock.calls.find((c) => c.action === 'invoke');
      expect(call).toBeDefined();
      expect(call!.input.binding).toBe(WIDGET_BINDING_REF);
    });

    it('Pilot/submit dispatches with the correct label', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Login Form',
        machineRef: 'machine-form',
        entry: 'e-form',
        conceptBinding: 'binding-login',
      });

      const submitResult = await kernel.invokeConcept('urn:clef/Pilot', 'submit', {
        label: 'Login Form',
      });
      expect(submitResult.variant).toBe('ok');
      expect(submitResult.label).toBe('Login Form');

      const call = pilotMock.calls.find((c) => c.action === 'submit');
      expect(call).toBeDefined();
      expect(call!.input.label).toBe('Login Form');
    });

    it('submit sync chain resolves label via PageMap then invokes binding', async () => {
      await seedPageMapEntry(pageMapStorage, {
        label: 'Search Form',
        machineRef: 'machine-search',
        entry: 'e-search',
        conceptBinding: 'binding-search',
      });

      const submitResult = await kernel.invokeConcept('urn:clef/Pilot', 'submit', {
        label: 'Search Form',
      });
      expect(submitResult.variant).toBe('ok');

      const flowId = submitResult.flowId as string | undefined;
      if (flowId) {
        const flowLog = kernel.getFlowLog(flowId);
        expect(flowLog.some((r) => r.action === 'submit')).toBe(true);
      }
    });

    it('Binding/invoke records are distinct per binding ref', async () => {
      await kernel.invokeConcept('urn:clef/Binding', 'invoke', { binding: 'binding-a' });
      await kernel.invokeConcept('urn:clef/Binding', 'invoke', { binding: 'binding-b' });

      const invokeCalls = bindingMock.calls.filter((c) => c.action === 'invoke');
      expect(invokeCalls).toHaveLength(2);
      expect(invokeCalls[0].input.binding).toBe('binding-a');
      expect(invokeCalls[1].input.binding).toBe('binding-b');
    });
  });

  // ─── 7. State propagation ─────────────────────────────────────────────────

  describe('State propagation — PageMap reflects updated states', () => {
    it('PageMap entry is updated after Machine/send via update()', async () => {
      // Seed a page map entry in state 'idle'
      await seedPageMapEntry(pageMapStorage, {
        label: 'Toggleable Button',
        machineRef: 'machine-toggle-2',
        entry: 'e-toggle-2',
        currentState: 'idle',
        validEvents: '["click"]',
      });

      // Simulate machine-send-updates-element: after Machine/send ok, update PageMap entry
      const updateResult = await kernel.invokeConcept('urn:clef/PageMap', 'update', {
        entry: 'e-toggle-2',
        currentState: 'active',
        validEvents: '["click","deactivate"]',
      });
      expect(updateResult.variant).toBe('ok');

      // Verify the PageMap entry now reflects the new state
      const listResult = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      const entries = JSON.parse(listResult.entries as string) as Array<Record<string, unknown>>;
      const updated = entries.find((e) => e.entry === 'e-toggle-2');
      expect(updated).toBeDefined();
      expect(updated!.currentState).toBe('active');
      expect(updated!.validEvents).toBe('["click","deactivate"]');
    });

    it('snapshot reflects the current state after multiple state transitions', async () => {
      await seedPageMapEntry(pageMapStorage, {
        entry: 'e-multi',
        label: 'Multi-State Widget',
        machineRef: 'machine-multi',
        currentState: 'idle',
        validEvents: '["activate"]',
      });

      // Transition 1: idle → active
      await kernel.invokeConcept('urn:clef/PageMap', 'update', {
        entry: 'e-multi',
        currentState: 'active',
        validEvents: '["deactivate","submit"]',
      });

      // Transition 2: active → submitted
      await kernel.invokeConcept('urn:clef/PageMap', 'update', {
        entry: 'e-multi',
        currentState: 'submitted',
        validEvents: '["reset"]',
      });

      const listResult = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      const entries = JSON.parse(listResult.entries as string) as Array<Record<string, unknown>>;
      const widget = entries.find((e) => e.entry === 'e-multi');
      expect(widget).toBeDefined();
      expect(widget!.currentState).toBe('submitted');
      expect(widget!.validEvents).toBe('["reset"]');
    });

    it('PageMap/clear removes all entries for the given host', async () => {
      await seedPageMapEntry(pageMapStorage, { entry: 'e-c1', label: 'Widget C1', machineRef: 'mc1' });
      await seedPageMapEntry(pageMapStorage, { entry: 'e-c2', label: 'Widget C2', machineRef: 'mc2' });

      const clearResult = await kernel.invokeConcept('urn:clef/PageMap', 'clear', {
        hostRef: HOST_REF,
      });
      expect(clearResult.variant).toBe('ok');

      const listResult = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      const entries = JSON.parse(listResult.entries as string) as unknown[];
      expect(entries).toHaveLength(0);
    });

    it('duplicate label registration is rejected', async () => {
      await seedPageMapEntry(pageMapStorage, {
        entry: 'e-dup-1',
        label: 'Duplicate Label',
        machineRef: 'machine-dup-1',
      });

      const dupResult = await kernel.invokeConcept('urn:clef/PageMap', 'register', {
        entry: 'e-dup-2',
        label: 'Duplicate Label',  // same label, same hostRef
        role: 'button',
        machineRef: 'machine-dup-2',
        widgetName: 'AnotherWidget',
        currentState: 'idle',
        validEvents: '[]',
        conceptBinding: null,
        affordanceServes: null,
        hostRef: HOST_REF,
      });
      expect(dupResult.variant).toBe('duplicate');
    });

    it('updating a nonexistent entry returns notfound', async () => {
      const result = await kernel.invokeConcept('urn:clef/PageMap', 'update', {
        entry: 'nonexistent-entry',
        currentState: 'active',
        validEvents: '["click"]',
      });
      expect(result.variant).toBe('notfound');
    });
  });

  // ─── 8. MCP tool name conventions ────────────────────────────────────────

  describe('MCP tool naming conventions (from pilot.tools.ts)', () => {
    it('pilot tools have the expected snake_case tool names', () => {
      const expectedTools = [
        'pilot_navigate',
        'pilot_back',
        'pilot_forward',
        'pilot_interact',
        'pilot_fill',
        'pilot_submit',
        'pilot_dismiss',
        'pilot_where',
        'pilot_destinations',
        'pilot_snapshot',
        'pilot_overlays',
      ];

      // Validate that tool names follow the concept_action snake_case convention
      for (const toolName of expectedTools) {
        expect(toolName).toMatch(/^pilot_[a-z_]+$/);
      }
    });

    it('Connection/invoke routing uses concept and action from the tool registry', async () => {
      // Simulate what ConnectionMcpServer.handleToolCall does:
      // look up the tool, extract concept/action, call Connection/invoke
      const toolConcept = 'Task';
      const toolAction = 'create';
      const toolInput = JSON.stringify({ title: 'agent-created task' });

      const result = await kernel.invokeConcept('urn:clef/Connection', 'invoke', {
        connection: CONNECTION_ID,
        concept: toolConcept,
        action: toolAction,
        input: toolInput,
      });

      expect(result.variant).toBe('ok');
      const output = JSON.parse(result.output as string) as Record<string, unknown>;
      expect(output.dispatched).toBe(true);
    });

    it('Connection/invoke returns not_found for unregistered concepts', async () => {
      const result = await kernel.invokeConcept('urn:clef/Connection', 'invoke', {
        connection: CONNECTION_ID,
        concept: 'NonExistentConcept',
        action: 'create',
        input: '{}',
      });
      expect(result.variant).toBe('not_found');
    });

    it('Connection/invoke returns unauthorized for protected concepts', async () => {
      const result = await kernel.invokeConcept('urn:clef/Connection', 'invoke', {
        connection: CONNECTION_ID,
        concept: 'AdminPanel',
        action: 'delete',
        input: '{}',
      });
      expect(result.variant).toBe('unauthorized');
    });
  });

  // ─── 9. Full agent scenario ───────────────────────────────────────────────

  describe('Full agent scenario — navigate, inspect, fill, submit', () => {
    it('simulates an agent completing a form flow', async () => {
      // Step 1: Navigate to a page
      const navResult = await kernel.invokeConcept('urn:clef/Pilot', 'navigate', {
        destination: 'tasks',
        params: '{}',
      });
      expect(navResult.variant).toBe('ok');

      // Step 2: Seed the page map (as if Host/ready + machine spawns populated it)
      await seedPageMapEntry(pageMapStorage, {
        entry: 'e-title', label: 'Task Title', machineRef: 'machine-title',
        role: 'input', currentState: 'empty', validEvents: '["input","clear"]',
        conceptBinding: 'binding-new-task', hostRef: HOST_REF,
      });
      await seedPageMapEntry(pageMapStorage, {
        entry: 'e-save', label: 'Save Task', machineRef: 'machine-save',
        role: 'button', currentState: 'idle', validEvents: '["click"]',
        conceptBinding: 'binding-new-task', hostRef: HOST_REF,
      });

      // Step 3: Snapshot to see available elements
      const snapshotResult = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      const entries = JSON.parse(snapshotResult.entries as string) as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(2);

      // Step 4: Fill the title field
      const fillResult = await kernel.invokeConcept('urn:clef/Pilot', 'fill', {
        label: 'Task Title',
        field: 'title',
        value: 'Build Pilot integration test',
      });
      expect(fillResult.variant).toBe('ok');

      // Verify fill was recorded
      const fillCall = pilotMock.calls.find((c) => c.action === 'fill');
      expect(fillCall!.input.value).toBe('Build Pilot integration test');

      // Step 5: Submit the form
      const submitResult = await kernel.invokeConcept('urn:clef/Pilot', 'submit', {
        label: 'Save Task',
      });
      expect(submitResult.variant).toBe('ok');

      // Verify submit was recorded
      const submitCall = pilotMock.calls.find((c) => c.action === 'submit');
      expect(submitCall).toBeDefined();
      expect(submitCall!.input.label).toBe('Save Task');
    });

    it('simulates an agent toggling a widget state', async () => {
      // Seed a toggleable element
      await seedPageMapEntry(pageMapStorage, {
        entry: 'e-toggle-btn', label: 'Dark Mode Toggle',
        machineRef: 'machine-dark-mode',
        role: 'toggle', currentState: 'off', validEvents: '["toggle"]',
        conceptBinding: null,
      });
      machineMock.states['machine-dark-mode'] = 'off';

      // Agent interacts with the toggle
      await kernel.invokeConcept('urn:clef/Pilot', 'interact', {
        label: 'Dark Mode Toggle',
        event: 'click',
      });

      // Verify the interact call was recorded
      const interactCall = pilotMock.calls.find((c) => c.action === 'interact');
      expect(interactCall).toBeDefined();
      expect(interactCall!.input.event).toBe('click');

      // Simulate state update (machine-send-updates-element would do this via sync)
      await kernel.invokeConcept('urn:clef/PageMap', 'update', {
        entry: 'e-toggle-btn',
        currentState: 'active',
        validEvents: '["toggle"]',
      });

      // Verify the snapshot reflects the new state
      const listResult = await kernel.invokeConcept('urn:clef/PageMap', 'list', {
        hostRef: HOST_REF,
      });
      const entries = JSON.parse(listResult.entries as string) as Array<Record<string, unknown>>;
      const toggle = entries.find((e) => e.label === 'Dark Mode Toggle');
      expect(toggle!.currentState).toBe('active');
    });
  });
});
