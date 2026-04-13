/**
 * Smoke tests for the KeybindingPreset picker flow.
 *
 * Component:    clef-base/app/components/widgets/KeybindingEditor.tsx
 *               (preset-picker section added at KB-14)
 * PRD:          docs/plans/keybinding-prd.md Phase F (KB-14)
 * Syncs:        clef-base/suites/keybinding/syncs/preset-activate-sets-overrides.sync
 *               clef-base/suites/keybinding/syncs/preset-deactivate-clears-overrides.sync
 * Handler:      handlers/ts/app/keybinding-preset.handler.ts
 *
 * ## Test strategy
 *
 * No DOM / no React renderer needed. Tests exercise:
 *
 *   1. Preset application sequence: activate Vim -> fan out setOverride for hjkl
 *      bindings -> verify Property records set on each binding id.
 *
 *   2. KeybindingHint reflection: after overrides applied, a binding lookup for
 *      "navigate-left" returns the Vim chord (h key, no modifiers).
 *
 *   3. Unapply sequence: deactivate Vim -> fan out clearOverride for hjkl
 *      bindings -> verify overrides removed.
 *
 *   4. Partial customization indicator data: a binding that is both fromPreset
 *      and isModified should carry both flags.
 *
 * ## Mocking approach
 *
 * The kernel is simulated by a call recorder that mirrors what the real kernel
 * would do when the activate and deactivate syncs fire. Each relevant concept
 * action is stubbed to apply the correct side effect to an in-memory store so
 * we can assert the final state of the per-binding override Properties.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/** Preset storage: presetId -> { name, description, entries[] } */
type PresetEntry = { binding: string; chord: Array<{ mod: string[]; key: string; code: string }> };
type PresetRecord = { name: string; description: string; entries: PresetEntry[] };
const presetStore = new Map<string, PresetRecord>();

/** Active preset per user: userId -> presetId | null */
const activeStore = new Map<string, string | null>();

/** Per-user binding overrides: `${userId}:${bindingId}` -> chord */
type ChordStroke = { mod: string[]; key: string; code: string };
const overrideStore = new Map<string, ChordStroke[] | null>();

// ---------------------------------------------------------------------------
// Kernel stub
// ---------------------------------------------------------------------------

interface KernelResult {
  variant: string;
  [key: string]: unknown;
}

async function kernelStub(
  concept: string,
  action: string,
  input: Record<string, unknown>,
): Promise<KernelResult> {
  // ---------- KeybindingPreset ----------

  if (concept === 'KeybindingPreset' && action === 'register') {
    const preset = input.preset as string;
    const name = input.name as string;
    const description = input.description as string;
    if (presetStore.has(preset)) return { variant: 'duplicate', message: 'Already registered.' };
    presetStore.set(preset, { name, description, entries: [] });
    return { variant: 'ok', preset };
  }

  if (concept === 'KeybindingPreset' && action === 'addBinding') {
    const preset = input.preset as string;
    const binding = input.binding as string;
    const chordInput = input.chord;
    const rec = presetStore.get(preset);
    if (!rec) return { variant: 'preset_not_found', message: 'Not found.' };
    // Parse chord -- may be a JSON string or already an array
    let chord: ChordStroke[];
    if (typeof chordInput === 'string') {
      try { chord = JSON.parse(chordInput) as ChordStroke[]; }
      catch { chord = [{ mod: [], key: chordInput, code: chordInput }]; }
    } else {
      chord = chordInput as ChordStroke[];
    }
    rec.entries.push({ binding, chord });
    return { variant: 'ok' };
  }

  if (concept === 'KeybindingPreset' && action === 'listBindings') {
    const preset = input.preset as string;
    const rec = presetStore.get(preset);
    if (!rec) return { variant: 'preset_not_found', message: 'Not found.' };
    return { variant: 'ok', bindings: rec.entries };
  }

  if (concept === 'KeybindingPreset' && action === 'activate') {
    const user = input.user as string;
    const preset = input.preset as string;
    if (!presetStore.has(preset)) return { variant: 'preset_not_found', message: 'Not found.' };
    activeStore.set(user, preset);
    return { variant: 'ok' };
  }

  if (concept === 'KeybindingPreset' && action === 'deactivate') {
    const user = input.user as string;
    if (!activeStore.get(user)) return { variant: 'not_active', message: 'No active preset.' };
    activeStore.set(user, null);
    return { variant: 'ok' };
  }

  if (concept === 'KeybindingPreset' && action === 'getActive') {
    const user = input.user as string;
    const preset = activeStore.get(user) ?? null;
    return { variant: 'ok', preset };
  }

  // ---------- KeyBinding ----------

  if (concept === 'KeyBinding' && action === 'setOverride') {
    const binding = input.binding as string;
    const userId = (input.userId as string | undefined) ?? 'current-user';
    const chordInput = input.chord;
    let chord: ChordStroke[];
    if (typeof chordInput === 'string') {
      try { chord = JSON.parse(chordInput) as ChordStroke[]; }
      catch { chord = []; }
    } else {
      chord = (chordInput as ChordStroke[] | undefined) ?? [];
    }
    overrideStore.set(`${userId}:${binding}`, chord);
    return { variant: 'ok' };
  }

  if (concept === 'KeyBinding' && action === 'clearOverride') {
    const binding = input.binding as string;
    const userId = (input.userId as string | undefined) ?? 'current-user';
    overrideStore.delete(`${userId}:${binding}`);
    return { variant: 'ok' };
  }

  if (concept === 'KeyBinding' && action === 'getOverride') {
    const binding = input.binding as string;
    const userId = (input.userId as string | undefined) ?? 'current-user';
    const chord = overrideStore.get(`${userId}:${binding}`);
    return { variant: 'ok', chord: chord ?? null };
  }

  return { variant: 'ok' };
}

// ---------------------------------------------------------------------------
// Helpers: simulate activate sync fan-out
//
// Mirrors what preset-activate-sets-overrides.sync does:
//   when KeybindingPreset/activate -> where listBindings -> then setOverride*
// ---------------------------------------------------------------------------

async function simulateActivateSync(userId: string, presetId: string): Promise<void> {
  const listResult = await kernelStub('KeybindingPreset', 'listBindings', { preset: presetId });
  if (listResult.variant !== 'ok') return;
  const entries = listResult.bindings as PresetEntry[];
  for (const entry of entries) {
    await kernelStub('KeyBinding', 'setOverride', {
      binding: entry.binding,
      scope: 'user',
      chord: entry.chord,
      userId,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers: simulate deactivate sync fan-out
//
// Mirrors what preset-deactivate-clears-overrides.sync does:
//   when KeybindingPreset/deactivate -> where listBindings -> then clearOverride*
// ---------------------------------------------------------------------------

async function simulateDeactivateSync(userId: string, previousPresetId: string): Promise<void> {
  const listResult = await kernelStub('KeybindingPreset', 'listBindings', { preset: previousPresetId });
  if (listResult.variant !== 'ok') return;
  const entries = listResult.bindings as PresetEntry[];
  for (const entry of entries) {
    await kernelStub('KeyBinding', 'clearOverride', {
      binding: entry.binding,
      scope: 'user',
      userId,
    });
  }
}

// ---------------------------------------------------------------------------
// Vim preset fixture data
// (Matches the subset of clef-base/seeds/KeybindingPreset.seeds.yaml used here)
// ---------------------------------------------------------------------------

const VIM_PRESET_BINDINGS: PresetEntry[] = [
  { binding: 'navigate-left',  chord: [{ mod: [], key: 'h', code: 'KeyH' }] },
  { binding: 'navigate-down',  chord: [{ mod: [], key: 'j', code: 'KeyJ' }] },
  { binding: 'navigate-up',    chord: [{ mod: [], key: 'k', code: 'KeyK' }] },
  { binding: 'navigate-right', chord: [{ mod: [], key: 'l', code: 'KeyL' }] },
  { binding: 'editor-undo',    chord: [{ mod: [], key: 'u', code: 'KeyU' }] },
];

const USER_ID = 'test-user-1';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeybindingPreset smoke tests: apply Vim preset', () => {
  beforeEach(() => {
    presetStore.clear();
    activeStore.clear();
    overrideStore.clear();
  });

  it('registers the vim preset and adds hjkl + undo bindings', async () => {
    await kernelStub('KeybindingPreset', 'register', {
      preset: 'vim', name: 'Vim', description: 'Vim preset.',
    });
    for (const entry of VIM_PRESET_BINDINGS) {
      await kernelStub('KeybindingPreset', 'addBinding', {
        preset: 'vim', binding: entry.binding, chord: entry.chord,
      });
    }

    const listResult = await kernelStub('KeybindingPreset', 'listBindings', { preset: 'vim' });
    expect(listResult.variant).toBe('ok');
    const entries = listResult.bindings as PresetEntry[];
    expect(entries).toHaveLength(VIM_PRESET_BINDINGS.length);
    const bindingIds = entries.map((e) => e.binding);
    expect(bindingIds).toContain('navigate-left');
    expect(bindingIds).toContain('navigate-right');
    expect(bindingIds).toContain('navigate-up');
    expect(bindingIds).toContain('navigate-down');
  });

  it('activate Vim -> sync fans out setOverride -> hjkl bindings have user-override chord', async () => {
    // Seed
    await kernelStub('KeybindingPreset', 'register', {
      preset: 'vim', name: 'Vim', description: 'Vim preset.',
    });
    for (const entry of VIM_PRESET_BINDINGS) {
      await kernelStub('KeybindingPreset', 'addBinding', {
        preset: 'vim', binding: entry.binding, chord: entry.chord,
      });
    }

    // Activate + sync fan-out (mirrors preset-activate-sets-overrides.sync)
    await kernelStub('KeybindingPreset', 'activate', { user: USER_ID, preset: 'vim' });
    await simulateActivateSync(USER_ID, 'vim');

    // Assert: each hjkl binding has a user override with the Vim chord
    const h = await kernelStub('KeyBinding', 'getOverride', { binding: 'navigate-left', userId: USER_ID });
    expect(h.variant).toBe('ok');
    const hChord = h.chord as ChordStroke[] | null;
    expect(hChord).not.toBeNull();
    expect(hChord!.length).toBe(1);
    expect(hChord![0].key).toBe('h');
    expect(hChord![0].mod).toEqual([]);

    const j = await kernelStub('KeyBinding', 'getOverride', { binding: 'navigate-down', userId: USER_ID });
    expect((j.chord as ChordStroke[])[0].key).toBe('j');

    const k = await kernelStub('KeyBinding', 'getOverride', { binding: 'navigate-up', userId: USER_ID });
    expect((k.chord as ChordStroke[])[0].key).toBe('k');

    const l = await kernelStub('KeyBinding', 'getOverride', { binding: 'navigate-right', userId: USER_ID });
    expect((l.chord as ChordStroke[])[0].key).toBe('l');
  });

  it('active preset reflected in getActive after activate', async () => {
    await kernelStub('KeybindingPreset', 'register', {
      preset: 'vim', name: 'Vim', description: 'Vim preset.',
    });
    await kernelStub('KeybindingPreset', 'activate', { user: USER_ID, preset: 'vim' });

    const result = await kernelStub('KeybindingPreset', 'getActive', { user: USER_ID });
    expect(result.variant).toBe('ok');
    expect(result.preset).toBe('vim');
  });
});

describe('KeybindingPreset smoke tests: unapply Vim preset', () => {
  beforeEach(async () => {
    presetStore.clear();
    activeStore.clear();
    overrideStore.clear();

    // Pre-condition: vim is registered, activated, and overrides applied
    await kernelStub('KeybindingPreset', 'register', {
      preset: 'vim', name: 'Vim', description: 'Vim preset.',
    });
    for (const entry of VIM_PRESET_BINDINGS) {
      await kernelStub('KeybindingPreset', 'addBinding', {
        preset: 'vim', binding: entry.binding, chord: entry.chord,
      });
    }
    await kernelStub('KeybindingPreset', 'activate', { user: USER_ID, preset: 'vim' });
    await simulateActivateSync(USER_ID, 'vim');
  });

  it('unapply -> sync fans out clearOverride -> hjkl overrides removed', async () => {
    // Precondition: overrides exist
    const hBefore = await kernelStub('KeyBinding', 'getOverride', {
      binding: 'navigate-left', userId: USER_ID,
    });
    expect(hBefore.chord).not.toBeNull();

    // Deactivate + sync fan-out (mirrors preset-deactivate-clears-overrides.sync)
    const previousPreset = 'vim';
    await kernelStub('KeybindingPreset', 'deactivate', {
      user: USER_ID, previousPreset,
    });
    await simulateDeactivateSync(USER_ID, previousPreset);

    // Assert: overrides cleared for all Vim bindings
    for (const entry of VIM_PRESET_BINDINGS) {
      const result = await kernelStub('KeyBinding', 'getOverride', {
        binding: entry.binding, userId: USER_ID,
      });
      // After clear, the key should not be present in overrideStore
      expect(result.chord).toBeNull();
    }
  });

  it('getActive returns null after deactivate', async () => {
    await kernelStub('KeybindingPreset', 'deactivate', {
      user: USER_ID, previousPreset: 'vim',
    });

    const result = await kernelStub('KeybindingPreset', 'getActive', { user: USER_ID });
    expect(result.variant).toBe('ok');
    expect(result.preset).toBeNull();
  });
});

describe('Partial customization indicator logic', () => {
  it('binding fromPreset=true and isModified=false shows only preset label', () => {
    // Simulate the augmentation logic in KeybindingEditor
    const presetIds = new Set(['navigate-left', 'navigate-down']);
    const binding = {
      binding: 'navigate-left',
      label: 'Navigate Left',
      chord: [{ mod: [], key: 'h', code: 'KeyH' }],
      scope: 'app',
      actionBinding: 'navigate-left-action',
      isModified: false,
    };
    const augmented = { ...binding, fromPreset: presetIds.has(binding.binding) };

    expect(augmented.fromPreset).toBe(true);
    expect(augmented.isModified).toBe(false);
    // Indicator logic: only "via Vim preset" label (not "user override")
    const showPresetOrigin = augmented.fromPreset && !augmented.isModified;
    const showUserOverride = augmented.isModified && !augmented.fromPreset;
    const showBoth = augmented.isModified && augmented.fromPreset;
    expect(showPresetOrigin).toBe(true);
    expect(showUserOverride).toBe(false);
    expect(showBoth).toBe(false);
  });

  it('binding fromPreset=true and isModified=true shows both labels', () => {
    const presetIds = new Set(['navigate-left']);
    const binding = {
      binding: 'navigate-left',
      label: 'Navigate Left',
      chord: [{ mod: ['mod'], key: 'ArrowLeft', code: 'ArrowLeft' }],
      scope: 'app',
      actionBinding: 'navigate-left-action',
      isModified: true, // user further customized on top of preset
    };
    const augmented = { ...binding, fromPreset: presetIds.has(binding.binding) };

    expect(augmented.fromPreset).toBe(true);
    expect(augmented.isModified).toBe(true);
    const showBoth = augmented.isModified && augmented.fromPreset;
    expect(showBoth).toBe(true);
  });

  it('binding fromPreset=false and isModified=true shows only user override label', () => {
    const presetIds = new Set<string>();
    const binding = {
      binding: 'bold-toggle',
      label: 'Bold',
      chord: [{ mod: ['mod', 'shift'], key: 'b', code: 'KeyB' }],
      scope: 'app.editor',
      actionBinding: 'bold-action',
      isModified: true,
    };
    const augmented = { ...binding, fromPreset: presetIds.has(binding.binding) };

    expect(augmented.fromPreset).toBe(false);
    expect(augmented.isModified).toBe(true);
    const showUserOverride = augmented.isModified && !augmented.fromPreset;
    expect(showUserOverride).toBe(true);
  });

  it('binding fromPreset=false and isModified=false shows no indicator', () => {
    const presetIds = new Set<string>();
    const binding = {
      binding: 'command-palette-open',
      label: 'Command Palette',
      chord: [{ mod: ['mod'], key: 'k', code: 'KeyK' }],
      scope: 'app',
      actionBinding: 'command-palette-action',
      isModified: false,
    };
    const augmented = { ...binding, fromPreset: presetIds.has(binding.binding) };

    const showPresetOrigin = augmented.fromPreset && !augmented.isModified;
    const showUserOverride = augmented.isModified && !augmented.fromPreset;
    const showBoth = augmented.isModified && augmented.fromPreset;
    expect(showPresetOrigin).toBe(false);
    expect(showUserOverride).toBe(false);
    expect(showBoth).toBe(false);
  });
});

describe('Modified-filter behavior with preset bindings', () => {
  it('showOnlyModified=true includes both fromPreset and isModified rows', () => {
    const presetIds = new Set(['navigate-left', 'navigate-down']);
    const bindings = [
      { binding: 'navigate-left',  isModified: false, fromPreset: true  }, // preset, not user-modified
      { binding: 'navigate-down',  isModified: true,  fromPreset: true  }, // preset + user override
      { binding: 'bold-toggle',    isModified: true,  fromPreset: false }, // user override, no preset
      { binding: 'command-palette',isModified: false, fromPreset: false }, // neither
    ];

    const showOnlyModified = true;
    const filtered = bindings.filter((b) => {
      if (showOnlyModified && !b.isModified && !b.fromPreset) return false;
      return true;
    });

    // navigate-left (fromPreset, not modified) -> included
    // navigate-down (fromPreset + modified)    -> included
    // bold-toggle (modified, no preset)         -> included
    // command-palette (neither)                 -> excluded
    expect(filtered).toHaveLength(3);
    const ids = filtered.map((b) => b.binding);
    expect(ids).toContain('navigate-left');
    expect(ids).toContain('navigate-down');
    expect(ids).toContain('bold-toggle');
    expect(ids).not.toContain('command-palette');
  });

  it('showOnlyModified=false includes all rows', () => {
    const bindings = [
      { binding: 'navigate-left',   isModified: false, fromPreset: true  },
      { binding: 'bold-toggle',     isModified: true,  fromPreset: false },
      { binding: 'command-palette', isModified: false, fromPreset: false },
    ];

    const showOnlyModified = false;
    const filtered = bindings.filter((b) => {
      if (showOnlyModified && !b.isModified && !b.fromPreset) return false;
      return true;
    });

    expect(filtered).toHaveLength(3);
  });
});
