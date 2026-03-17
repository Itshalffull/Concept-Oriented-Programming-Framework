// ============================================================
// RenderProgram Builder
// ============================================================
//
// Walks a WidgetManifest and produces a sequence of RenderProgram
// instructions capturing the full behavioral contract: anatomy,
// state machines, accessibility (ARIA, keyboard, focus), props,
// data bindings (connect), composition, and tokens.
//
// Visual layout (actual HTML structure, CSS) stays as stubs —
// the spec doesn't prescribe it.

import type {
  WidgetManifest,
  WidgetAnatomyPart,
} from '../../../runtime/types.js';

/** A single RenderProgram instruction — pure data. */
export interface RenderInstruction {
  tag: string;
  [key: string]: unknown;
}

/** The output of buildRenderProgram: a sealed instruction sequence. */
export interface BuiltRenderProgram {
  name: string;
  instructions: RenderInstruction[];
  parts: string[];
  tokens: string[];
  props: string[];
}

/**
 * Walk a WidgetManifest and emit RenderProgram instructions for
 * every behavioral aspect the spec declares.
 */
export function buildRenderProgram(manifest: WidgetManifest): BuiltRenderProgram {
  const instructions: RenderInstruction[] = [];
  const parts: string[] = [];
  const tokens: string[] = [];
  const props: string[] = [];

  // --- Props ---
  for (const prop of manifest.props) {
    instructions.push({
      tag: 'prop',
      name: prop.name,
      propType: prop.type,
      defaultValue: prop.defaultValue ?? '',
    });
    props.push(prop.name);
  }

  // --- Anatomy (recursive) ---
  function walkAnatomy(part: WidgetAnatomyPart) {
    instructions.push({
      tag: 'element',
      part: part.name,
      role: part.role ?? 'container',
    });
    parts.push(part.name);
    if (part.children) {
      for (const child of part.children) {
        walkAnatomy(child);
      }
    }
  }
  for (const part of manifest.anatomy) {
    walkAnatomy(part);
  }

  // --- State machines ---
  for (const state of manifest.states) {
    instructions.push({
      tag: 'stateDef',
      name: state.name,
      initial: state.initial,
    });
  }
  for (const state of manifest.states) {
    for (const t of state.transitions) {
      instructions.push({
        tag: 'transition',
        fromState: state.name,
        event: t.event,
        toState: t.target,
      });
    }
  }

  // --- Accessibility: role on root ---
  if (manifest.accessibility.role) {
    const rootPart = parts[0] ?? 'root';
    instructions.push({
      tag: 'aria',
      part: rootPart,
      attr: 'role',
      value: manifest.accessibility.role,
    });
  }

  // --- Accessibility: per-part ARIA bindings ---
  if (manifest.accessibility.ariaBindings) {
    for (const binding of manifest.accessibility.ariaBindings) {
      for (const attr of binding.attrs) {
        instructions.push({
          tag: 'aria',
          part: binding.part,
          attr: attr.name,
          value: attr.value,
        });
      }
    }
  }

  // --- Accessibility: flat ariaAttrs (legacy) ---
  if (manifest.accessibility.ariaAttrs) {
    for (const attr of manifest.accessibility.ariaAttrs) {
      instructions.push({
        tag: 'aria',
        part: parts[0] ?? 'root',
        attr: attr.name,
        value: attr.value,
      });
    }
  }

  // --- Accessibility: keyboard ---
  for (const kb of manifest.accessibility.keyboard) {
    instructions.push({
      tag: 'keyboard',
      key: kb.key,
      event: kb.action,
    });
  }

  // --- Accessibility: focus ---
  const focus = manifest.accessibility.focus;
  if (focus.trap != null || focus.initial || focus.roving != null) {
    const strategy = focus.trap ? 'trap' : focus.roving ? 'roving' : 'manual';
    instructions.push({
      tag: 'focus',
      strategy,
      initialPart: focus.initial ?? parts[0] ?? 'root',
    });
  }

  // --- Connect: per-part data bindings ---
  if (manifest.connect) {
    for (const binding of manifest.connect) {
      for (const attr of binding.attrs) {
        instructions.push({
          tag: 'bind',
          part: binding.part,
          attr: attr.name,
          expr: attr.value,
        });
      }
    }
  }

  // --- Composition ---
  for (const widget of manifest.composedWidgets) {
    instructions.push({
      tag: 'compose',
      widget,
      slot: widget,
    });
  }

  // --- Terminate ---
  instructions.push({
    tag: 'pure',
    output: manifest.name,
  });

  return {
    name: manifest.name,
    instructions,
    parts,
    tokens,
    props,
  };
}
