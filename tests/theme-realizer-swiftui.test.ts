/**
 * SwiftUI realizer tests — MAG-663 native target feasibility spike.
 *
 * Verifies that the shared contract IR drives valid SwiftUI output:
 * - Each contract produces a ViewModifier + State enum + View extension
 * - Theme tokens appear as Swift Color references (not CSS variables)
 * - State vocabulary maps to typed Swift enum cases
 * - The same 3 contracts used in the web CSS tests work here
 */

import { describe, it, expect } from 'vitest';
import {
  generateSwiftUIStyles,
  type SwiftContractSpec,
  type SwiftThemeSpec,
} from '../handlers/ts/surface/theme-realizer-swiftui.js';

const THEME_LIGHT: SwiftThemeSpec = { id: 'light' };
const THEME_DARK: SwiftThemeSpec = { id: 'dark' };

// The same three contracts used in the web CSS end-to-end tests
const PILOT_CONTRACTS: SwiftContractSpec[] = [
  { id: 'field-control',  states: ['focus', 'invalid', 'disabled'] },
  { id: 'floating-panel' },
  { id: 'page-section' },
];

// ---------------------------------------------------------------------------
// Structural output tests
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — structural output', () => {
  it('produces a non-empty Swift source string', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('starts with import SwiftUI', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    expect(output).toContain('import SwiftUI');
  });

  it('includes a theme comment referencing the active theme id', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    expect(output).toContain('// Theme: light');

    const darkOutput = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_DARK);
    expect(darkOutput).toContain('// Theme: dark');
  });

  it('emits a MARK section per contract', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    expect(output).toContain('// MARK: - FieldControl');
    expect(output).toContain('// MARK: - FloatingPanel');
    expect(output).toContain('// MARK: - PageSection');
  });
});

// ---------------------------------------------------------------------------
// ViewModifier tests
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — ViewModifier structs', () => {
  it('generates a ViewModifier for field-control', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('public struct FieldControl: ViewModifier');
    expect(output).toContain('public func body(content: Content) -> some View');
  });

  it('generates a ViewModifier for floating-panel', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).toContain('public struct FloatingPanel: ViewModifier');
  });

  it('generates a ViewModifier for page-section', () => {
    const output = generateSwiftUIStyles([{ id: 'page-section' }], THEME_LIGHT);
    expect(output).toContain('public struct PageSection: ViewModifier');
  });

  it('field-control modifier includes @Environment colorScheme for stateful contracts', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('@Environment(\\.colorScheme) var colorScheme');
  });

  it('field-control modifier has padding modifier', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('.padding(8)');
  });

  it('field-control modifier has background with invalid state branch', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    // Background switches on invalid state
    expect(output).toContain('state == .invalid');
    expect(output).toContain('Color.red.opacity(0.1)');
  });

  it('field-control modifier has overlay with RoundedRectangle stroke for border', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('RoundedRectangle(cornerRadius:');
    expect(output).toContain('.stroke(borderColor, lineWidth:');
  });

  it('floating-panel modifier includes shadow', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).toContain('.shadow(');
    expect(output).toContain('Color.black.opacity(0.12)');
  });

  it('floating-panel modifier includes clipShape with RoundedRectangle', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).toContain('.clipShape(RoundedRectangle(cornerRadius:');
  });

  it('disabled state appends .disabled() modifier', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('.disabled(state == .disabled)');
    expect(output).toContain('.opacity(state == .disabled ? 0.5 : 1.0)');
  });
});

// ---------------------------------------------------------------------------
// State enum tests
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — State enums', () => {
  it('generates a FieldControlState enum', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('public enum FieldControlState: Equatable');
  });

  it('FieldControlState includes normal case', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('case normal');
  });

  it('FieldControlState includes declared state cases', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('case focus');
    expect(output).toContain('case invalid');
    expect(output).toContain('case disabled');
  });

  it('floating-panel (no states) does not produce a FloatingPanelState enum', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).not.toContain('FloatingPanelState');
  });

  it('page-section (no states) does not produce a PageSectionState enum', () => {
    const output = generateSwiftUIStyles([{ id: 'page-section' }], THEME_LIGHT);
    expect(output).not.toContain('PageSectionState');
  });

  it('state enum uses Equatable conformance', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain(': Equatable');
  });
});

// ---------------------------------------------------------------------------
// View extension tests
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — View extensions', () => {
  it('generates a fieldControl(state:) extension', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('public extension View');
    expect(output).toContain('func fieldControl(state: FieldControlState = .normal)');
  });

  it('fieldControl extension calls modifier(FieldControl(state:))', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('modifier(FieldControl(state: state))');
  });

  it('generates a floatingPanel() extension without state param', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).toContain('func floatingPanel()');
    expect(output).toContain('modifier(FloatingPanel())');
  });

  it('generates a pageSection() extension without state param', () => {
    const output = generateSwiftUIStyles([{ id: 'page-section' }], THEME_LIGHT);
    expect(output).toContain('func pageSection()');
    expect(output).toContain('modifier(PageSection())');
  });
});

// ---------------------------------------------------------------------------
// Token reference tests — Swift Color, not CSS variables
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — token references', () => {
  it('references Color(.systemBackground) not CSS --palette-surface', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    expect(output).toContain('Color(.systemBackground)');
    // Must not contain CSS custom property syntax
    expect(output).not.toContain('var(--');
    expect(output).not.toContain('--palette-');
  });

  it('references Color(.separator) for border color', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('Color(.separator)');
  });

  it('references .accentColor for focus ring / border-focus', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('.accentColor');
  });

  it('references Color.red for invalid border', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('Color.red');
  });

  it('uses numeric points for padding, not px strings', () => {
    const output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);
    // Padding should use integer point values
    expect(output).toContain('.padding(8)');
    // Must not contain CSS px values
    expect(output).not.toContain('px');
  });

  it('uses numeric cornerRadius, not CSS border-radius strings', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('cornerRadius: 6');
    expect(output).not.toContain('border-radius');
  });
});

// ---------------------------------------------------------------------------
// Multi-contract / full pilot set tests
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — all three pilot contracts', () => {
  let output: string;

  output = generateSwiftUIStyles(PILOT_CONTRACTS, THEME_LIGHT);

  it('produces output for all three pilot contracts', () => {
    expect(output).toContain('FieldControl');
    expect(output).toContain('FloatingPanel');
    expect(output).toContain('PageSection');
  });

  it('produces exactly one state enum for field-control (the only stateful contract)', () => {
    const enumMatches = (output.match(/public enum \w+State: Equatable/g) ?? []);
    expect(enumMatches.length).toBe(1);
    expect(enumMatches[0]).toBe('public enum FieldControlState: Equatable');
  });

  it('produces three View extensions', () => {
    const extensionMatches = (output.match(/public extension View/g) ?? []);
    expect(extensionMatches.length).toBe(3);
  });

  it('produces three MARK sections', () => {
    const markMatches = (output.match(/\/\/ MARK: - /g) ?? []);
    expect(markMatches.length).toBe(3);
  });

  it('empty contracts list produces only file header', () => {
    const emptyOutput = generateSwiftUIStyles([], THEME_LIGHT);
    expect(emptyOutput).toContain('import SwiftUI');
    expect(emptyOutput).not.toContain('ViewModifier');
    expect(emptyOutput).not.toContain('extension View');
  });
});

// ---------------------------------------------------------------------------
// Helper: borderColor property on field-control
// ---------------------------------------------------------------------------

describe('generateSwiftUIStyles — borderColor helper property', () => {
  it('generates a borderColor computed property for field-control', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('private var borderColor: Color');
    expect(output).toContain('switch state');
  });

  it('borderColor switch has a case for focus', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('case .focus:');
  });

  it('borderColor switch has a case for invalid', () => {
    const output = generateSwiftUIStyles(
      [{ id: 'field-control', states: ['focus', 'invalid'] }],
      THEME_LIGHT,
    );
    expect(output).toContain('case .invalid:');
  });

  it('floating-panel does not have a borderColor property', () => {
    const output = generateSwiftUIStyles([{ id: 'floating-panel' }], THEME_LIGHT);
    expect(output).not.toContain('borderColor');
  });
});
