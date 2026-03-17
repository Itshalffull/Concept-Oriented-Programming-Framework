// ============================================================
// Functorial Render Transform Tests
//
// Tests for RenderTransform (the functor over RenderPrograms),
// TransformExtractionProvider, and the composable transformation
// pipeline for theme switching and a11y variants.
//
// See Architecture doc — Functorial Mapping for Widget Render Programs
// ============================================================

import { describe, it, expect } from 'vitest';
import type { RenderInstruction } from '../handlers/ts/surface/render-program-builder.js';
import {
  renderTransformHandler,
  applyTransformSpec,
  matchesInstruction,
  type TransformKind,
  type TokenRemapSpec,
  type A11yAdaptSpec,
  type BindRewriteSpec,
  type CustomSpec,
} from '../handlers/ts/surface/render-transform.handler.js';
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
// Core Transform Functions — Unit Tests
// ============================================================

describe('applyTransformSpec', () => {
  describe('token-remap', () => {
    it('remaps matching token paths', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
        { tag: 'token', path: 'palette.surface', fallback: '#fff' },
        { tag: 'token', path: 'spacing.md', fallback: '16px' },
      ];
      const spec: TokenRemapSpec = {
        mappings: {
          'palette.primary': 'palette.primary-dark',
          'palette.surface': 'palette.surface-dark',
        },
      };

      const result = applyTransformSpec(instructions, 'token-remap', spec);
      expect(result[0]).toEqual({ tag: 'token', path: 'palette.primary-dark', fallback: '#000' });
      expect(result[1]).toEqual({ tag: 'token', path: 'palette.surface-dark', fallback: '#fff' });
      expect(result[2]).toEqual({ tag: 'token', path: 'spacing.md', fallback: '16px' }); // unchanged
    });

    it('leaves non-token instructions unchanged', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'element', part: 'root', role: 'container' },
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
        { tag: 'aria', part: 'root', attr: 'role', value: 'article' },
      ];
      const spec: TokenRemapSpec = { mappings: { 'palette.primary': 'palette.primary-dark' } };

      const result = applyTransformSpec(instructions, 'token-remap', spec);
      expect(result[0]).toEqual({ tag: 'element', part: 'root', role: 'container' });
      expect(result[1]).toEqual({ tag: 'token', path: 'palette.primary-dark', fallback: '#000' });
      expect(result[2]).toEqual({ tag: 'aria', part: 'root', attr: 'role', value: 'article' });
    });

    it('identity: empty mappings returns same instructions', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'token', path: 'palette.primary', fallback: '#000' },
      ];
      const spec: TokenRemapSpec = { mappings: {} };

      const result = applyTransformSpec(instructions, 'token-remap', spec);
      expect(result).toEqual(instructions);
    });
  });

  describe('a11y-adapt', () => {
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

      const result = applyTransformSpec(instructions, 'a11y-adapt', spec);
      expect(result[0]).toEqual({ tag: 'aria', part: 'root', attr: 'role', value: 'article' });
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-label', value: 'Accessible Card' });
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

      const result = applyTransformSpec(instructions, 'a11y-adapt', spec);
      expect(result.length).toBe(3);
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' });
      expect(result[2]).toEqual({ tag: 'pure', output: 'TestWidget' });
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

      const result = applyTransformSpec(instructions, 'a11y-adapt', spec);
      expect(result.length).toBe(2);
      expect(result[1]).toEqual({ tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' });
    });
  });

  describe('bind-rewrite', () => {
    it('rewrites matching binding expressions', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'bind', part: 'root', attr: 'data-variant', expr: '?variant' },
        { tag: 'bind', part: 'header', attr: 'data-part', expr: '"header"' },
      ];
      const spec: BindRewriteSpec = {
        rewrites: { '?variant': '?customVariant' },
      };

      const result = applyTransformSpec(instructions, 'bind-rewrite', spec);
      expect(result[0]).toEqual({ tag: 'bind', part: 'root', attr: 'data-variant', expr: '?customVariant' });
      expect(result[1]).toEqual({ tag: 'bind', part: 'header', attr: 'data-part', expr: '"header"' }); // unchanged
    });
  });

  describe('custom', () => {
    it('replaces matching instructions by pattern', () => {
      const instructions: RenderInstruction[] = [
        { tag: 'focus', strategy: 'roving', initialPart: 'root' },
        { tag: 'element', part: 'root', role: 'container' },
      ];
      const spec: CustomSpec = {
        match: { tag: 'focus', strategy: 'roving' },
        replace: { strategy: 'trap' },
      };

      const result = applyTransformSpec(instructions, 'custom', spec);
      expect(result[0]).toEqual({ tag: 'focus', strategy: 'trap', initialPart: 'root' });
      expect(result[1]).toEqual({ tag: 'element', part: 'root', role: 'container' }); // unchanged
    });
  });
});

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

// ============================================================
// RenderTransform Handler — Concept Tests
// ============================================================

describe('RenderTransform handler', () => {
  describe('register', () => {
    it('registers a token-remap transform', () => {
      const result = renderTransformHandler.register({
        name: 'dark-theme',
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.transform).toBe('rt-dark-theme');
    });

    it('registers an a11y-adapt transform', () => {
      const result = renderTransformHandler.register({
        name: 'high-contrast',
        kind: 'a11y-adapt',
        spec: JSON.stringify({
          additions: [{ tag: 'aria', part: 'root', attr: 'aria-live', value: 'assertive' }],
        }),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
    });

    it('rejects invalid JSON spec', () => {
      const result = renderTransformHandler.register({
        name: 'bad',
        kind: 'token-remap',
        spec: 'not json{{{',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
      expect(val?.message).toContain('Invalid transform spec');
    });

    it('uses complete() (dogfooding)', () => {
      const result = renderTransformHandler.register({
        name: 'test',
        kind: 'custom',
        spec: '{}',
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });

  describe('apply', () => {
    it('applies token-remap transform to program', () => {
      const program = sampleProgram();
      const inlineTransform = JSON.stringify({
        kind: 'token-remap',
        spec: JSON.stringify({
          mappings: {
            'palette.primary': 'palette.primary-dark',
            'palette.surface': 'palette.surface-dark',
          },
        }),
      });

      const result = renderTransformHandler.apply({
        program,
        transform: inlineTransform,
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');

      const resultProgram = JSON.parse(val?.result as string);
      const tokens = resultProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
      expect(tokens[0].path).toBe('palette.primary-dark');
      expect(tokens[1].path).toBe('palette.surface-dark');
      expect(tokens[2].path).toBe('spacing.md'); // unchanged
    });

    it('applies a11y-adapt transform to program', () => {
      const program = sampleProgram();
      const inlineTransform = JSON.stringify({
        kind: 'a11y-adapt',
        spec: JSON.stringify({
          modifications: [
            { match: { tag: 'aria', attr: 'aria-label' }, set: { value: 'High Contrast Card' } },
          ],
          additions: [
            { tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' },
          ],
        }),
      });

      const result = renderTransformHandler.apply({
        program,
        transform: inlineTransform,
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');

      const resultProgram = JSON.parse(val?.result as string);
      const ariaInstrs = resultProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
      expect(ariaInstrs.some((a: RenderInstruction) => a.value === 'High Contrast Card')).toBe(true);
      expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'aria-live')).toBe(true);
    });

    it('applies bind-rewrite transform', () => {
      const program = sampleProgram();
      const inlineTransform = JSON.stringify({
        kind: 'bind-rewrite',
        spec: JSON.stringify({
          rewrites: { '?variant': '?overrideVariant' },
        }),
      });

      const result = renderTransformHandler.apply({
        program,
        transform: inlineTransform,
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');

      const resultProgram = JSON.parse(val?.result as string);
      const binds = resultProgram.instructions.filter((i: RenderInstruction) => i.tag === 'bind');
      expect(binds[0].expr).toBe('?overrideVariant');
    });

    it('tracks applied transforms in output program', () => {
      const program = sampleProgram();
      const inlineTransform = JSON.stringify({
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: {} }),
      });

      const result = renderTransformHandler.apply({
        program,
        transform: inlineTransform,
      });
      const val = getPureValue(result);
      const appliedTransforms = JSON.parse(val?.appliedTransforms as string);
      expect(appliedTransforms.length).toBe(1);
    });

    it('accumulates transforms across multiple applications', () => {
      // First transform
      const inlineTransform1 = JSON.stringify({
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.primary-dark' } }),
      });
      const result1 = renderTransformHandler.apply({
        program: sampleProgram(),
        transform: inlineTransform1,
      });
      const val1 = getPureValue(result1);
      const intermediateProgram = val1?.result as string;

      // Second transform on the result
      const inlineTransform2 = JSON.stringify({
        kind: 'a11y-adapt',
        spec: JSON.stringify({
          additions: [{ tag: 'aria', part: 'root', attr: 'aria-live', value: 'polite' }],
        }),
      });
      const result2 = renderTransformHandler.apply({
        program: intermediateProgram,
        transform: inlineTransform2,
      });
      const val2 = getPureValue(result2);
      const appliedTransforms = JSON.parse(val2?.appliedTransforms as string);
      expect(appliedTransforms.length).toBe(2);
    });

    it('returns error for invalid program JSON', () => {
      const result = renderTransformHandler.apply({
        program: 'not json{{{',
        transform: '{}',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });

    it('returns notfound for non-inline transform name', () => {
      const result = renderTransformHandler.apply({
        program: sampleProgram(),
        transform: 'nonexistent-transform',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('notfound');
    });

    it('uses complete() (dogfooding)', () => {
      const inlineTransform = JSON.stringify({
        kind: 'token-remap',
        spec: JSON.stringify({ mappings: {} }),
      });
      const result = renderTransformHandler.apply({
        program: sampleProgram(),
        transform: inlineTransform,
      });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
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

    it('rejects invalid JSON', () => {
      const result = renderTransformHandler.compose({ transforms: 'not json' });
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
      const transforms = JSON.parse(val?.appliedTransforms as string);
      expect(transforms).toEqual([]);
      expect(val?.transformCount).toBe(0);
    });

    it('handles invalid JSON gracefully', () => {
      const result = transformExtractionProviderHandler.analyze({ program: 'not json{{{' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
    });

    it('uses complete() (dogfooding)', () => {
      const program = sampleProgram();
      const result = transformExtractionProviderHandler.analyze({ program });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });
  });
});

// ============================================================
// Functor Laws
// ============================================================

describe('Functor Laws', () => {
  it('identity: applying empty transform returns equivalent program', () => {
    const program = sampleProgram();
    const identityTransform = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({ mappings: {} }),
    });

    const result = renderTransformHandler.apply({
      program,
      transform: identityTransform,
    });
    const val = getPureValue(result);
    const resultProgram = JSON.parse(val?.result as string);
    const originalProgram = JSON.parse(program);

    // Instructions should be structurally equal (ignoring appliedTransforms metadata)
    expect(resultProgram.instructions).toEqual(originalProgram.instructions);
    expect(resultProgram.parts).toEqual(originalProgram.parts);
    expect(resultProgram.tokens).toEqual(originalProgram.tokens);
    expect(resultProgram.props).toEqual(originalProgram.props);
  });

  it('composition: apply(apply(p, f), g) ≡ sequential application', () => {
    const program = sampleProgram();

    // Transform f: remap palette.primary
    const f = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.brand' } }),
    });

    // Transform g: remap palette.surface
    const g = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({ mappings: { 'palette.surface': 'palette.bg' } }),
    });

    // apply(apply(p, f), g)
    const afterF = renderTransformHandler.apply({ program, transform: f });
    const afterFProgram = (getPureValue(afterF) as Record<string, unknown>).result as string;
    const afterFG = renderTransformHandler.apply({ program: afterFProgram, transform: g });
    const afterFGProgram = JSON.parse((getPureValue(afterFG) as Record<string, unknown>).result as string);

    // Verify both transforms applied correctly
    const tokens = afterFGProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.brand');     // f applied
    expect(tokens[1].path).toBe('palette.bg');          // g applied
    expect(tokens[2].path).toBe('spacing.md');          // unchanged

    // Verify transform provenance tracked
    expect(afterFGProgram.appliedTransforms.length).toBe(2);
  });
});

// ============================================================
// Integration — Theme Switching as Functorial Mapping
// ============================================================

describe('Theme Switching Integration', () => {
  it('dark theme = fmap(tokenRemap, renderProgram)', () => {
    const lightProgram = sampleProgram();
    const darkThemeTransform = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({
        mappings: {
          'palette.primary': 'palette.primary-dark',
          'palette.surface': 'palette.surface-dark',
        },
      }),
    });

    const result = renderTransformHandler.apply({
      program: lightProgram,
      transform: darkThemeTransform,
    });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');

    const darkProgram = JSON.parse(val?.result as string);
    const tokens = darkProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.primary-dark');
    expect(tokens[1].path).toBe('palette.surface-dark');
    expect(tokens[2].path).toBe('spacing.md'); // spacing unchanged across themes
  });

  it('high-contrast = fmap(a11yTransform, renderProgram)', () => {
    const program = sampleProgram();
    const highContrastTransform = JSON.stringify({
      kind: 'a11y-adapt',
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

    const result = renderTransformHandler.apply({
      program,
      transform: highContrastTransform,
    });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');

    const hcProgram = JSON.parse(val?.result as string);
    const ariaInstrs = hcProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
    expect(ariaInstrs.some((a: RenderInstruction) => a.value === 'High Contrast Card — Press Enter to activate')).toBe(true);
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'aria-live')).toBe(true);
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'data-contrast')).toBe(true);
  });

  it('dark + high-contrast = compose then apply', () => {
    const program = sampleProgram();

    // Apply dark theme first
    const darkTransform = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({
        mappings: { 'palette.primary': 'palette.primary-dark' },
      }),
    });
    const afterDark = renderTransformHandler.apply({ program, transform: darkTransform });
    const darkProgram = (getPureValue(afterDark) as Record<string, unknown>).result as string;

    // Then apply high-contrast
    const hcTransform = JSON.stringify({
      kind: 'a11y-adapt',
      spec: JSON.stringify({
        additions: [{ tag: 'aria', part: 'root', attr: 'data-contrast', value: 'high' }],
      }),
    });
    const afterHC = renderTransformHandler.apply({ program: darkProgram, transform: hcTransform });
    const finalVal = getPureValue(afterHC);
    const finalProgram = JSON.parse(finalVal?.result as string);

    // Token remapped AND a11y added
    const tokens = finalProgram.instructions.filter((i: RenderInstruction) => i.tag === 'token');
    expect(tokens[0].path).toBe('palette.primary-dark');

    const ariaInstrs = finalProgram.instructions.filter((i: RenderInstruction) => i.tag === 'aria');
    expect(ariaInstrs.some((a: RenderInstruction) => a.attr === 'data-contrast')).toBe(true);

    // Both transforms recorded
    expect(finalProgram.appliedTransforms.length).toBe(2);

    // TransformExtractionProvider can extract provenance
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
    const identity = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({ mappings: {} }),
    });

    const result = renderTransformHandler.apply({ program, transform: identity });
    const val = getPureValue(result);
    const resultProgram = JSON.parse(val?.result as string);
    const original = JSON.parse(program);

    // Every instruction tag type preserved
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
    const remap = JSON.stringify({
      kind: 'token-remap',
      spec: JSON.stringify({ mappings: { 'palette.primary': 'palette.dark' } }),
    });

    const result = renderTransformHandler.apply({ program, transform: remap });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const resultProgram = JSON.parse(val?.result as string);
    expect(resultProgram.instructions.length).toBe(2);
  });
});
