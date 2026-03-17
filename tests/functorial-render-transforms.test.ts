// ============================================================
// Functorial Render Transform Tests — Provider Architecture
//
// Tests for the transform provider pattern where RenderTransform
// dispatches to independent providers (TokenRemapProvider,
// A11yAdaptProvider, BindRewriteProvider, CustomTransformProvider)
// through sync wiring.
//
// See Architecture doc — Functorial Mapping for Widget Render Programs
// ============================================================

import { describe, it, expect } from 'vitest';
import type { RenderInstruction } from '../handlers/ts/surface/render-program-builder.js';
import { renderTransformHandler } from '../handlers/ts/surface/render-transform.handler.js';
import {
  tokenRemapProviderHandler,
  applyTokenRemap,
} from '../handlers/ts/surface/providers/token-remap-provider.handler.js';
import {
  a11yAdaptProviderHandler,
  applyA11yAdapt,
  matchesInstruction,
  type A11yAdaptSpec,
} from '../handlers/ts/surface/providers/a11y-adapt-provider.handler.js';
import {
  bindRewriteProviderHandler,
  applyBindRewrite,
} from '../handlers/ts/surface/providers/bind-rewrite-provider.handler.js';
import {
  customTransformProviderHandler,
  applyCustomTransform,
} from '../handlers/ts/surface/providers/custom-transform-provider.handler.js';
import { transformExtractionProviderHandler } from '../handlers/ts/surface/providers/transform-extraction-provider.handler.js';
import type { StorageProgram } from '../runtime/storage-program.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
 */
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
  }
  return null;
}

/**
 * Helper: create a sample render program with token, aria, bind, and element instructions.
 */
function sampleProgram(overrides?: Partial<{ appliedTransforms: string[] }>): string {
  return JSON.stringify({
    name: 'TestWidget',
    instructions: [
      { tag: 'prop', name: 'variant', propType: 'string', defaultValue: 'default' },
      { tag: 'element', part: 'root', role: 'container' },
      { tag: 'element', part: 'header', role: 'text' },
      { tag: 'element', part: 'body', role: 'container' },
      { tag: 'token', path: 'palette.primary', fallback: '#000' },
      { tag: 'token', path: 'palette.surface', fallback: '#fff' },
      { tag: 'token', path: 'spacing.md', fallback: '16px' },
      { tag: 'aria', part: 'root', attr: 'role', value: 'article' },
      { tag: 'aria', part: 'root', attr: 'aria-label', value: 'Card' },
      { tag: 'bind', part: 'root', attr: 'data-variant', expr: '?variant' },
      { tag: 'bind', part: 'header', attr: 'data-part', expr: '"header"' },
      { tag: 'stateDef', name: 'idle', initial: true },
      { tag: 'stateDef', name: 'hovered', initial: false },
      { tag: 'transition', fromState: 'idle', event: 'HOVER', toState: 'hovered' },
      { tag: 'keyboard', key: 'Enter', event: 'ACTIVATE' },
      { tag: 'focus', strategy: 'roving', initialPart: 'root' },
      { tag: 'pure', output: 'TestWidget' },
    ],
    parts: ['root', 'header', 'body'],
    tokens: ['palette.primary', 'palette.surface', 'spacing.md'],
    props: ['variant'],
    ...(overrides || {}),
  });
}

// ============================================================
// TokenRemapProvider — Unit Tests
// ============================================================

describe('TokenRemapProvider', () => {
  describe('applyTokenRemap (pure function)', () => {
    it('remaps matching token paths', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
        { tag: 'token', path: 'palette.surface', fallback: '#fff' },
        { tag: 'token', path: 'spacing.md', fallback: '16px' },
      ];
      const { instructions: result, remapCount } = applyTokenRemap(instructions, {
        'palette.primary': 'palette.primary-dark',
        'palette.surface': 'palette.surface-dark',
      });
      expect(result[0]).toEqual({ tag: 'token', path: 'palette.primary-dark', fallback: '#000' });
      expect(result[1]).toEqual({ tag: 'token', path: 'palette.surface-dark', fallback: '#fff' });
      expect(result[2]).toEqual({ tag: 'token', path: 'spacing.md', fallback: '16px' });
      expect(remapCount).toBe(2);
    });

    it('leaves non-token instructions unchanged', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
        { tag: 'aria', part: 'root', attr: 'role', value: 'article' },
      ];
      const { instructions: result } = applyTokenRemap(instructions, {
        'palette.primary': 'palette.primary-dark',
      });
      expect(result[0]).toEqual({ tag: 'element', part: 'root', role: 'container' });
      expect(result[1]).toEqual({ tag: 'token', path: 'palette.primary-dark', fallback: '#000' });
      expect(result[2]).toEqual({ tag: 'aria', part: 'root', attr: 'role', value: 'article' });
    });

    it('identity: empty mappings returns same instructions', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
      ];
      const { instructions: result, remapCount } = applyTokenRemap(instructions, {});
      expect(result).toEqual(instructions);
      expect(remapCount).toBe(0);
    });
  });

  describe('handler', () => {
    it('applies token-remap to program', () => {
      const result = tokenRemapProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const transformed = JSON.parse(val?.transformed as string);
      const tokens = transformed.instructions.filter((i: RenderInstruction) => i.tag === 'token');
      expect(tokens[0].path).toBe('palette.primary-dark');
    });

    it('tracks applied transforms in output', () => {
      const result = tokenRemapProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ mappings: {} }),
      });
      const val = getPureValue(result);
      const applied = JSON.parse(val?.appliedTransforms as string);
      expect(applied.length).toBe(1);
      expect(JSON.parse(applied[0]).kind).toBe('token-remap');
    });

    it('handles invalid JSON gracefully', () => {
      const result = tokenRemapProviderHandler.apply({
        program: 'not json{{{',
        spec: '{}',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });

    it('uses complete() (dogfooding)', () => {
      const result = tokenRemapProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ mappings: {} }),
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });
});

// ============================================================
// A11yAdaptProvider — Unit Tests
// ============================================================

describe('A11yAdaptProvider', () => {
  describe('matchesInstruction', () => {
    it('matches when all pattern fields are present and equal', () => {
      const instr = { tag: 'token', path: 'palette.primary', fallback: '#000' };
      expect(matchesInstruction(instr, { tag: 'token', path: 'palette.primary' })).toBe(true);
    });

    it('does not match when a pattern field differs', () => {
      const instr = { tag: 'token', path: 'palette.primary', fallback: '#000' };
      expect(matchesInstruction(instr, { tag: 'token', path: 'palette.secondary' })).toBe(false);
    });

    it('matches empty pattern against any instruction', () => {
      const instr = { tag: 'element', part: 'root', role: 'container' };
      expect(matchesInstruction(instr, {})).toBe(true);
    });
  });

  describe('applyA11yAdapt (pure function)', () => {
    it('modifies matching ARIA instructions', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'aria', part: 'root', attr: 'role', value: 'article' },
        { tag: 'aria', part: 'root', attr: 'aria-label', value: 'Card' },
      ];
      const spec: A11yAdaptSpec = {
        modifications: [
          { match: { tag: 'aria', attr: 'aria-label' }, set: { value: 'Accessible Card' } },
        ],
      };
      const { instructions: result, modificationCount } = applyA11yAdapt(instructions, spec);
      expect(result[0]).toEqual({ tag: 'aria', part: 'root', attr: 'role', value: 'article' });
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-label', value: 'Accessible Card' });
      expect(modificationCount).toBe(1);
    });

    it('adds new instructions before pure', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'pure', output: 'TestWidget' },
      ];
      const spec: A11yAdaptSpec = {
        additions: [
          { tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' },
        ],
      };
      const { instructions: result, additionCount } = applyA11yAdapt(instructions, spec);
      expect(result.length).toBe(3);
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' });
      expect(result[2]).toEqual({ tag: 'pure', output: 'TestWidget' });
      expect(additionCount).toBe(1);
    });

    it('appends additions when no pure exists', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'element', part: 'root', role: 'container' },
      ];
      const spec: A11yAdaptSpec = {
        additions: [
          { tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' },
        ],
      };
      const { instructions: result } = applyA11yAdapt(instructions, spec);
      expect(result.length).toBe(2);
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' });
    });
  });

  describe('handler', () => {
    it('applies a11y-adapt to program', () => {
      const result = a11yAdaptProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({
          modifications: [
            { match: { tag: 'aria', attr: 'aria-label' }, set: { value: 'High Contrast Card' } },
          ],
          additions: [
            { tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' },
          ],
        }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const transformed = JSON.parse(val?.transformed as string);
      const ariaInstrs = transformed.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
      expect(ariaInstrs.some((a: RenderInstruction) => a.value === 'High Contrast Card')).toBe(true);
      expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'aria-live')).toBe(true);
    });

    it('uses complete() (dogfooding)', () => {
      const result = a11yAdaptProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({}),
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });
});

// ============================================================
// BindRewriteProvider — Unit Tests
// ============================================================

describe('BindRewriteProvider', () => {
  describe('applyBindRewrite (pure function)', () => {
    it('rewrites matching binding expressions', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'bind', part: 'root', attr: 'data-variant', expr: '?variant' },
        { tag: 'bind', part: 'header', attr: 'data-part', expr: '"header"' },
      ];
      const { instructions: result, rewriteCount } = applyBindRewrite(instructions, {
        '?variant': '?customVariant',
      });
      expect(result[0]).toEqual({ tag: 'bind', part: 'root', attr: 'data-variant', expr: '?customVariant' });
      expect(result[1]).toEqual({ tag: 'bind', part: 'header', attr: 'data-part', expr: '"header"' });
      expect(rewriteCount).toBe(1);
    });
  });

  describe('handler', () => {
    it('applies bind-rewrite to program', () => {
      const result = bindRewriteProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ rewrites: { '?variant': '?overrideVariant' } }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const transformed = JSON.parse(val?.transformed as string);
      const binds = transformed.instructions.filter((i: RenderInstruction) => i.tag === 'bind');
      expect(binds[0].expr).toBe('?overrideVariant');
    });

    it('uses complete() (dogfooding)', () => {
      const result = bindRewriteProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ rewrites: {} }),
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });
});

// ============================================================
// CustomTransformProvider — Unit Tests
// ============================================================

describe('CustomTransformProvider', () => {
  describe('applyCustomTransform (pure function)', () => {
    it('replaces matching instructions by pattern', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'focus', strategy: 'roving', initialPart: 'root' },
        { tag: 'element', part: 'root', role: 'container' },
      ];
      const { instructions: result, matchCount } = applyCustomTransform(
        instructions,
        { tag: 'focus', strategy: 'roving' },
        { strategy: 'trap' },
      );
      expect(result[0]).toEqual({ tag: 'focus', strategy: 'trap', initialPart: 'root' });
      expect(result[1]).toEqual({ tag: 'element', part: 'root', role: 'container' });
      expect(matchCount).toBe(1);
    });
  });

  describe('handler', () => {
    it('applies custom transform to program', () => {
      const result = customTransformProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({
          match: { tag: 'focus', strategy: 'roving' },
          replace: { strategy: 'trap' },
        }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const transformed = JSON.parse(val?.transformed as string);
      const focus = transformed.instructions.find((i: RenderInstruction) => i.tag === 'focus');
      expect(focus.strategy).toBe('trap');
    });

    it('uses complete() (dogfooding)', () => {
      const result = customTransformProviderHandler.apply({
        program: sampleProgram(),
        spec: JSON.stringify({ match: {}, replace: {} }),
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });
});

// ============================================================
// RenderTransform Handler — Registry & Dispatch Tests
// ============================================================

describe('RenderTransform handler (dispatcher)', () => {
  describe('registerKind', () => {
    it('registers a new kind', () => {
      const result = renderTransformHandler.registerKind({ kind: 'token-remap' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.kind).toBe('token-remap');
    });

    it('uses complete() (dogfooding)', () => {
      const result = renderTransformHandler.registerKind({ kind: 'test' });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });

  describe('register', () => {
    it('registers a named transform', () => {
      const result = renderTransformHandler.register({
        name: 'dark-theme',
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.transform).toBe('rt-dark-theme');
    });

    it('rejects invalid JSON spec', () => {
      const result = renderTransformHandler.register({
        name: 'bad',
        kind: 'token-remap',
        spec: 'not json{{{',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });
  });

  describe('apply (dispatch)', () => {
    it('produces dispatch output with kind and spec', () => {
      const result = renderTransformHandler.apply({
        program: sampleProgram(),
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: {} }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.kind).toBe('token-remap');
    });

    it('returns error for invalid program', () => {
      const result = renderTransformHandler.apply({
        program: 'not json{{{',
        kind: 'token-remap',
        spec: '{}',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });
  });

  describe('compose', () => {
    it('composes multiple transforms into one', () => {
      const transforms = JSON.stringify([
        { name: 'dark-theme', kind: 'token-remap', spec: '{}' },
        { name: 'high-contrast', kind: 'a11y-adapt', spec: '{}' },
      ]);
      const result = renderTransformHandler.compose({ transforms });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.name).toBe('dark-theme+high-contrast');
    });

    it('rejects empty transform list', () => {
      const result = renderTransformHandler.compose({ transforms: '[]' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });
  });

  describe('list', () => {
    it('returns ok variant', () => {
      const result = renderTransformHandler.list({});
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
    });
  });

  describe('get', () => {
    it('returns ok with transform id', () => {
      const result = renderTransformHandler.get({ name: 'dark-theme' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.transform).toBe('rt-dark-theme');
    });
  });
});

// ============================================================
// TransformExtractionProvider — Handler Tests
// ============================================================

describe('TransformExtractionProvider', () => {
  describe('analyze', () => {
    it('extracts applied transforms from program metadata', () => {
      const program = sampleProgram({ appliedTransforms: ['dark-theme', 'high-contrast'] });
      const result = transformExtractionProviderHandler.analyze({ program });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const transforms = JSON.parse(val?.appliedTransforms as string);
      expect(transforms).toEqual(['dark-theme', 'high-contrast']);
      expect(val?.transformCount).toBe(2);
    });

    it('returns empty list when no transforms applied', () => {
      const program = sampleProgram();
      const result = transformExtractionProviderHandler.analyze({ program });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.transformCount).toBe(0);
    });

    it('handles invalid JSON gracefully', () => {
      const result = transformExtractionProviderHandler.analyze({ program: 'not json{{{' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });
  });
});

// ============================================================
// Provider Self-Registration (PluginRegistry pattern)
// ============================================================

describe('Provider Self-Registration', () => {
  it('TokenRemapProvider returns static metadata', () => {
    const result = tokenRemapProviderHandler.register({});
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    expect(val?.name).toBe('TokenRemapProvider');
    expect(val?.kind).toBe('token-remap');
    expect(JSON.parse(val?.capabilities as string)).toContain('token-path-rewrite');
  });

  it('A11yAdaptProvider returns static metadata', () => {
    const result = a11yAdaptProviderHandler.register({});
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    expect(val?.name).toBe('A11yAdaptProvider');
    expect(val?.kind).toBe('a11y-adapt');
    expect(JSON.parse(val?.capabilities as string)).toContain('aria-modification');
  });

  it('BindRewriteProvider returns static metadata', () => {
    const result = bindRewriteProviderHandler.register({});
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    expect(val?.name).toBe('BindRewriteProvider');
    expect(val?.kind).toBe('bind-rewrite');
    expect(JSON.parse(val?.capabilities as string)).toContain('expression-rewrite');
  });

  it('CustomTransformProvider returns static metadata', () => {
    const result = customTransformProviderHandler.register({});
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    expect(val?.name).toBe('CustomTransformProvider');
    expect(val?.kind).toBe('custom');
    expect(JSON.parse(val?.capabilities as string)).toContain('pattern-match');
  });

  it('all providers use complete() for registration', () => {
    const providers = [
      tokenRemapProviderHandler,
      a11yAdaptProviderHandler,
      bindRewriteProviderHandler,
      customTransformProviderHandler,
    ];
    for (const provider of providers) {
      const result = provider.register({});
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    }
  });
});

// ============================================================
// Functor Laws — Tested via Providers Directly
// ============================================================

describe('Functor Laws', () => {
  it('identity: applying empty transform returns equivalent program', () => {
    const program = sampleProgram();
    const result = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: {} }),
    });
    const val = getPureValue(result);
    const resultProgram = JSON.parse(val?.transformed as string);
    const originalProgram = JSON.parse(program);

    // Instructions should be structurally equal (ignoring appliedTransforms metadata)
    expect(resultProgram.instructions).toEqual(originalProgram.instructions);
    expect(resultProgram.parts).toEqual(originalProgram.parts);
    expect(resultProgram.tokens).toEqual(originalProgram.tokens);
    expect(resultProgram.props).toEqual(originalProgram.props);
  });

  it('composition: apply(apply(p, f), g) ≡ sequential application', () => {
    const program = sampleProgram();

    // Transform f: remap palette.primary via TokenRemapProvider
    const afterF = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.brand' } }),
    });
    const afterFProgram = (getPureValue(afterF) as Record<string, unknown>).transformed as string;

    // Transform g: remap palette.surface via TokenRemapProvider
    const afterFG = tokenRemapProviderHandler.apply({
      program: afterFProgram,
      spec: JSON.stringify({ mappings: { 'palette.surface': 'palette.bg' } }),
    });
    const afterFGProgram = JSON.parse((getPureValue(afterFG) as Record<string, unknown>).transformed as string);

    // Verify both transforms applied correctly
    const tokens = afterFGProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.brand');
    expect(tokens[1].path).toBe('palette.bg');
    expect(tokens[2].path).toBe('spacing.md');

    // Verify transform provenance tracked
    expect(afterFGProgram.appliedTransforms.length).toBe(2);
  });

  it('cross-provider composition: token-remap then a11y-adapt', () => {
    const program = sampleProgram();

    // f: token remap
    const afterF = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
    });
    const afterFProgram = (getPureValue(afterF) as Record<string, unknown>).transformed as string;

    // g: a11y adapt
    const afterFG = a11yAdaptProviderHandler.apply({
      program: afterFProgram,
      spec: JSON.stringify({
        additions: [{ tag: 'aria', part: 'root', attr: 'data-contrast', value: 'high' }],
      }),
    });
    const afterFGProgram = JSON.parse((getPureValue(afterFG) as Record<string, unknown>).transformed as string);

    // Token remapped AND a11y added
    const tokens = afterFGProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.primary-dark');
    const ariaInstrs = afterFGProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'data-contrast')).toBe(true);

    // Both transforms recorded
    expect(afterFGProgram.appliedTransforms.length).toBe(2);
  });
});

// ============================================================
// Integration — Theme Switching as Functorial Mapping
// ============================================================

describe('Theme Switching Integration', () => {
  it('dark theme = fmap(tokenRemap, renderProgram)', () => {
    const lightProgram = sampleProgram();
    const result = tokenRemapProviderHandler.apply({
      program: lightProgram,
      spec: JSON.stringify({
        mappings: {
          'palette.primary': 'palette.primary-dark',
          'palette.surface': 'palette.surface-dark',
        },
      }),
    });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const darkProgram = JSON.parse(val?.transformed as string);
    const tokens = darkProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.primary-dark');
    expect(tokens[1].path).toBe('palette.surface-dark');
    expect(tokens[2].path).toBe('spacing.md');
  });

  it('high-contrast = fmap(a11yTransform, renderProgram)', () => {
    const program = sampleProgram();
    const result = a11yAdaptProviderHandler.apply({
      program,
      spec: JSON.stringify({
        modifications: [
          { match: { tag: 'aria', attr: 'aria-label' }, set: { value: 'High Contrast Card — Press Enter to activate' } },
        ],
        additions: [
          { tag: 'aria', part: 'root', attr: 'aria-live', value: 'assertive' },
          { tag: 'aria', part: 'root', attr: 'data-contrast', value: 'high' },
        ],
      }),
    });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const hcProgram = JSON.parse(val?.transformed as string);
    const ariaInstrs = hcProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
    expect(ariaInstrs.some((a: RenderInstruction) => a.value === 'High Contrast Card — Press Enter to activate')).toBe(true);
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'aria-live')).toBe(true);
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'data-contrast')).toBe(true);
  });

  it('dark + high-contrast = compose then apply via providers', () => {
    const program = sampleProgram();

    // Apply dark theme first (TokenRemapProvider)
    const afterDark = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
    });
    const darkProgram = (getPureValue(afterDark) as Record<string, unknown>).transformed as string;

    // Then apply high-contrast (A11yAdaptProvider)
    const afterHC = a11yAdaptProviderHandler.apply({
      program: darkProgram,
      spec: JSON.stringify({
        additions: [{ tag: 'aria', part: 'root', attr: 'data-contrast', value: 'high' }],
      }),
    });
    const finalVal = getPureValue(afterHC);
    const finalProgram = JSON.parse(finalVal?.transformed as string);

    // Token remapped AND a11y added
    const tokens = finalProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.primary-dark');
    const ariaInstrs = finalProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'data-contrast')).toBe(true);

    // Both transforms recorded — TransformExtractionProvider can extract provenance
    expect(finalProgram.appliedTransforms.length).toBe(2);
    const extractResult = transformExtractionProviderHandler.analyze({
      program: JSON.stringify(finalProgram),
    });
    const extractVal = getPureValue(extractResult);
    expect(extractVal?.transformCount).toBe(2);
  });
});

// ============================================================
// Backward Compatibility
// ============================================================

describe('Backward Compatibility', () => {
  it('programs without appliedTransforms work with extraction provider', () => {
    const program = JSON.stringify({
      instructions: [{ tag: 'element', part: 'root', role: 'container' }],
    });
    const result = transformExtractionProviderHandler.analyze({ program });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    expect(val?.transformCount).toBe(0);
  });

  it('identity transform preserves all instruction types', () => {
    const program = sampleProgram();
    const result = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: {} }),
    });
    const val = getPureValue(result);
    const resultProgram = JSON.parse(val?.transformed as string);
    const original = JSON.parse(program);

    const originalTags = original.instructions.map((i: RenderInstruction) => i.tag);
    const resultTags = resultProgram.instructions.map((i: RenderInstruction) => i.tag);
    expect(resultTags).toEqual(originalTags);
  });

  it('existing render programs without tokens survive token-remap', () => {
    const program = JSON.stringify({
      name: 'SimpleWidget',
      instructions: [
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'pure', output: 'SimpleWidget' },
      ],
    });
    const result = tokenRemapProviderHandler.apply({
      program,
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.dark' } }),
    });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const resultProgram = JSON.parse(val?.transformed as string);
    expect(resultProgram.instructions.length).toBe(2);
  });

  it('all providers handle error variant with complete()', () => {
    const badProgram = 'not json{{{';
    const providers = [
      tokenRemapProviderHandler,
      a11yAdaptProviderHandler,
      bindRewriteProviderHandler,
      customTransformProviderHandler,
    ];
    for (const provider of providers) {
      const result = provider.apply({ program: badProgram, spec: '{}' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
      expect(result.effects.completionVariants.has('error')).toBe(true);
    }
  });
});
