// WidgetGen — generates framework-specific widget code from a widget AST.
//
// Uses the RenderProgram pipeline directly: parses AST into a
// WidgetManifest shape, builds RenderProgram instructions via
// buildRenderProgram(), then interprets through the target-specific
// interpreter function. No per-target provider handlers needed —
// the language-specific logic lives in interpreter-targets/*.ts.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import { buildRenderProgram } from '../../ts/surface/render-program-builder.js';
import { interpretReact } from '../../ts/surface/interpreter-targets/react.js';
import { interpretVue } from '../../ts/surface/interpreter-targets/vue.js';
import { interpretSolid } from '../../ts/surface/interpreter-targets/solid.js';
import { interpretSvelte } from '../../ts/surface/interpreter-targets/svelte.js';
import { interpretVanilla } from '../../ts/surface/interpreter-targets/vanilla.js';
import { interpretNextjs } from '../../ts/surface/interpreter-targets/nextjs.js';
import { interpretReactNative } from '../../ts/surface/interpreter-targets/react-native.js';
import { interpretInk } from '../../ts/surface/interpreter-targets/ink.js';
import { interpretNativescript } from '../../ts/surface/interpreter-targets/nativescript.js';
import { interpretCompose } from '../../ts/surface/interpreter-targets/compose.js';
import { interpretWear } from '../../ts/surface/interpreter-targets/wear.js';
import { interpretSwiftUI } from '../../ts/surface/interpreter-targets/swiftui.js';
import { interpretWatchKit } from '../../ts/surface/interpreter-targets/watchkit.js';
import { interpretAppKit } from '../../ts/surface/interpreter-targets/appkit.js';
import { interpretWinUI } from '../../ts/surface/interpreter-targets/winui.js';
import { interpretGtk } from '../../ts/surface/interpreter-targets/gtk.js';
import type { RenderInstruction } from '../../ts/surface/render-program-builder.js';

type InterpreterFn = (instructions: RenderInstruction[], componentName: string) => { output: string; trace: string[] };

const interpreters: Record<string, InterpreterFn> = {
  react: interpretReact,
  vue: interpretVue,
  solid: interpretSolid,
  svelte: interpretSvelte,
  vanilla: interpretVanilla,
  nextjs: interpretNextjs,
  'react-native': interpretReactNative,
  ink: interpretInk,
  nativescript: interpretNativescript,
  compose: interpretCompose,
  wear: interpretWear,
  swiftui: interpretSwiftUI,
  watchkit: interpretWatchKit,
  appkit: interpretAppKit,
  winui: interpretWinUI,
  gtk: interpretGtk,
};

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

function astToManifest(ast: Record<string, unknown>): Record<string, unknown> {
  const props = ((ast.props || []) as Array<Record<string, unknown>>).map(p => ({
    name: p.name as string,
    type: p.type as string || 'string',
    defaultValue: p.defaultValue as string || p.default as string || '',
  }));

  const anatomy = ((ast.anatomy || ast.parts || []) as Array<Record<string, unknown>>).map(
    function mapPart(p: Record<string, unknown>): Record<string, unknown> {
      return {
        name: p.name as string || p.part as string,
        role: p.role as string || 'container',
        children: ((p.children || []) as Array<Record<string, unknown>>).map(mapPart),
      };
    },
  );

  if (anatomy.length === 0) {
    anatomy.push({ name: 'root', role: 'container', children: [] });
  }

  const states = ((ast.states || []) as Array<Record<string, unknown>>).map(s => ({
    name: s.name as string,
    initial: s.initial as boolean || false,
    transitions: ((s.transitions || []) as Array<Record<string, unknown>>).map(t => ({
      event: t.event as string,
      target: t.target as string,
    })),
  }));

  const accessibility = ast.accessibility as Record<string, unknown> || {};

  return {
    name: ast.name as string || 'Widget',
    props,
    anatomy,
    states,
    accessibility: {
      role: accessibility.role as string || null,
      keyboard: (accessibility.keyboard || []) as Array<Record<string, unknown>>,
      focus: accessibility.focus as Record<string, unknown> || {},
      ariaBindings: accessibility.ariaBindings as Array<Record<string, unknown>> || [],
      ariaAttrs: accessibility.ariaAttrs as Array<Record<string, unknown>> || [],
    },
    connect: ast.connect as Array<Record<string, unknown>> || [],
    composedWidgets: ast.composedWidgets as string[] || [],
    invariants: ast.invariants as string[] || [],
  };
}

export const widgetGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const gen = input.gen as string;
    const target = input.target as string;
    const widgetAst = input.widgetAst as string;

    const interpret = interpreters[target];
    if (!interpret) {
      const available = Object.keys(interpreters).sort();
      return {
        variant: 'error',
        message: `No interpreter for target "${target}". Available: ${available.join(', ')}`,
      };
    }

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const id = gen || nextId('G');
    const componentName = (ast.name as string) || 'Widget';

    // Build RenderProgram from the widget AST
    const manifest = astToManifest(ast);
    const built = buildRenderProgram(manifest as any);

    // Interpret through the target-specific function
    const { output, trace } = interpret(built.instructions, componentName);

    // Store result
    await storage.put('widgetGen', id, {
      target,
      input: widgetAst,
      output,
      status: 'completed',
      parts: built.parts,
      props: built.props,
    });

    return {
      variant: 'ok',
      gen: id,
      output,
      parts: built.parts,
      props: built.props,
      trace: JSON.stringify(trace),
    };
  },

  async listTargets() {
    return {
      variant: 'ok',
      targets: JSON.stringify(Object.keys(interpreters).sort()),
    };
  },
};
