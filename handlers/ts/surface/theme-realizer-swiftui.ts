/**
 * SwiftUI realizer — native target feasibility spike (MAG-663)
 *
 * Demonstrates that the same shared contract IR used by the web CSS realizer
 * (generateContractCSS / generateContractManifest) can be compiled to
 * SwiftUI ViewModifiers. See docs/research/surface-contract-swiftui-mapping.md
 * for a detailed analysis of where the IR is sufficient and where target
 * escapes are needed.
 *
 * Architecture reference: PRD §6.4, §15.6
 */

// ============================================================
// Shared IR types (mirrors theme-realizer.handler.ts)
// ============================================================

/**
 * Minimal contract descriptor — same shape as ContractSpec in the web handler.
 * Keeping this interface local avoids a coupling dependency on the web handler
 * module while preserving identical wire-level shape.
 */
export interface SwiftContractSpec {
  id: string;
  states?: string[];
  variants?: string[];
  resources?: Record<string, string>;
}

/**
 * Minimal theme descriptor — same shape as ThemeSpec in the web handler.
 */
export interface SwiftThemeSpec {
  id: string;
  tokens?: Record<string, string>;
}

// ============================================================
// Token resolution helpers
// ============================================================

/**
 * Maps a semantic palette token name to a Swift Color expression.
 *
 * Web CSS uses CSS custom properties (--palette-*).
 * SwiftUI uses Color(…) constructors, .accentColor, Color(.systemBackground),
 * or Environment-backed design tokens injected at the app root.
 *
 * The mapping here is intentionally simple — it shows the translation shape.
 * A production realizer would resolve against the active theme's token set.
 */
function resolveSwiftColor(semanticRole: string, _themeId: string): string {
  const colorMap: Record<string, string> = {
    'surface':            'Color(.systemBackground)',
    'surface-muted':      'Color(.secondarySystemBackground)',
    'foreground':         'Color(.label)',
    'foreground-muted':   'Color(.secondaryLabel)',
    'border':             'Color(.separator)',
    'border-focus':       '.accentColor',
    'border-invalid':     'Color.red',
    'accent':             '.accentColor',
    'accent-selected':    'Color.accentColor.opacity(0.15)',
  };
  return colorMap[semanticRole] ?? 'Color(.label)';
}

/**
 * Maps a semantic spacing/radius token to a Swift numeric literal (points).
 * CSS uses px units; SwiftUI uses plain CGFloat/Double.
 */
function resolveSwiftSpacing(token: string): number {
  const spacingMap: Record<string, number> = {
    'spacing-2':       8,
    'spacing-3':       12,
    'radius-control':  6,
    'radius-overlay':  10,
  };
  return spacingMap[token] ?? 8;
}

// ============================================================
// Per-contract Swift code generators
// ============================================================

/**
 * Builds the state enum declaration for a contract.
 *
 * SwiftUI has no equivalent to CSS data-attributes. States are modeled as
 * typed Swift enums consumed by the ViewModifier, which is the idiomatic
 * SwiftUI approach.
 */
function generateStateEnum(contractId: string, states: string[]): string {
  const typeName = toPascalCase(contractId);
  const stateTypeName = `${typeName}State`;

  // Always include 'normal' as the base state, then add declared states
  const allCases = ['normal', ...states.filter((s) => s !== 'normal' && s !== 'idle')];

  const caseLines = allCases.map((s) => `  case ${toSwiftCaseId(s)}`).join('\n');

  return [
    `public enum ${stateTypeName}: Equatable {`,
    caseLines,
    '}',
  ].join('\n');
}

/**
 * Builds the ViewModifier struct for a contract.
 *
 * Each contract becomes one ViewModifier. State branching is expressed through
 * a switch/ternary within body(content:), or via private computed properties
 * for readability (matching the PRD §3.9 example shape).
 *
 * Target escapes required (see mapping doc):
 * - CSS `::before`/`::after` pseudo-elements → overlay ViewBuilders
 * - CSS `outline` (focus ring) → `.overlay(RoundedRectangle.stroke(…))`
 * - CSS `box-shadow` → `.shadow(…)` modifier
 * - CSS multi-value border shorthand → `.overlay(shape.stroke(…))`
 */
function generateViewModifier(
  contract: SwiftContractSpec,
  _theme: SwiftThemeSpec,
): string {
  const id = contract.id;
  const typeName = toPascalCase(id);
  const stateTypeName = `${typeName}State`;
  const states = contract.states ?? defaultStates(id);
  const hasStates = states.length > 0;

  const lines: string[] = [];

  lines.push(`public struct ${typeName}: ViewModifier {`);
  if (hasStates) {
    lines.push(`  @Environment(\\.colorScheme) var colorScheme`);
    lines.push(`  public var state: ${stateTypeName} = .normal`);
    lines.push('');
  }

  lines.push('  public func body(content: Content) -> some View {');
  lines.push('    content');
  lines.push(...buildModifierChain(id, states, '      '));
  lines.push('  }');

  // Private helper properties for complex state logic (border color, etc.)
  const helpers = buildHelperProperties(id, states, stateTypeName);
  if (helpers.length > 0) {
    lines.push('');
    lines.push(...helpers);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Returns the `.modifier(…)` chain lines for a given contract.
 * Each semantic resource category maps to the closest SwiftUI modifier.
 */
function buildModifierChain(id: string, states: string[], indent: string): string[] {
  const chains: Record<string, string[]> = {
    'field-control': [
      `.padding(${resolveSwiftSpacing('spacing-2')})`,
      `.background(state == .invalid`,
      `  ? Color.red.opacity(0.1)`,
      `  : ${resolveSwiftColor('surface', 'default')})`,
      `.overlay(`,
      `  RoundedRectangle(cornerRadius: ${resolveSwiftSpacing('radius-control')})`,
      `    .stroke(borderColor, lineWidth: state == .focus ? 2 : 1)`,
      `)`,
    ],
    'floating-panel': [
      `.background(${resolveSwiftColor('surface', 'default')})`,
      `.clipShape(RoundedRectangle(cornerRadius: ${resolveSwiftSpacing('radius-overlay')}))`,
      `.shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)`,
      `.overlay(`,
      `  RoundedRectangle(cornerRadius: ${resolveSwiftSpacing('radius-overlay')})`,
      `    .stroke(${resolveSwiftColor('border', 'default')}, lineWidth: 1)`,
      `)`,
    ],
    'page-section': [
      `.background(${resolveSwiftColor('surface', 'default')})`,
      `.clipShape(RoundedRectangle(cornerRadius: ${resolveSwiftSpacing('radius-control')}))`,
      `.overlay(`,
      `  RoundedRectangle(cornerRadius: ${resolveSwiftSpacing('radius-control')})`,
      `    .stroke(${resolveSwiftColor('border', 'default')}, lineWidth: 1)`,
      `)`,
      `.padding(${resolveSwiftSpacing('spacing-3')})`,
    ],
  };

  const contractLines = chains[id] ?? [
    `.background(${resolveSwiftColor('surface', 'default')})`,
    `.foregroundColor(${resolveSwiftColor('foreground', 'default')})`,
  ];

  // For stateful contracts, wrap the disabled modifier at the end
  const result = contractLines.map((l) => `${indent}${l}`);
  if (states.includes('disabled')) {
    result.push(`${indent}.disabled(state == .disabled)`);
    result.push(`${indent}.opacity(state == .disabled ? 0.5 : 1.0)`);
  }

  return result;
}

/**
 * Builds private computed property helpers.
 * Used for complex state-dependent values (e.g., borderColor switch).
 */
function buildHelperProperties(id: string, states: string[], stateType: string): string[] {
  const perContract: Record<string, string[]> = {
    'field-control': [
      `  private var borderColor: Color {`,
      `    switch state {`,
      ...states.map((s) => {
        const colorForState: Record<string, string> = {
          focus:    resolveSwiftColor('border-focus', 'default'),
          invalid:  resolveSwiftColor('border-invalid', 'default'),
          disabled: resolveSwiftColor('border', 'default'),
        };
        const c = colorForState[s] ?? resolveSwiftColor('border', 'default');
        return `    case .${toSwiftCaseId(s)}: return ${c}`;
      }),
      `    default: return ${resolveSwiftColor('border', 'default')}`,
      `    }`,
      `  }`,
    ],
  };

  // Suppress unused parameter warning — stateType is baked into the case lines
  void stateType;

  return perContract[id] ?? [];
}

/**
 * Generates the View extension convenience method for a contract.
 *
 * This is the SwiftUI API surface users call from their views, matching
 * the camelCase contract id:
 *
 *   Text("…").fieldControl(state: .focus)
 *   VStack { … }.floatingPanel()
 */
function generateViewExtension(contract: SwiftContractSpec): string {
  const id = contract.id;
  const typeName = toPascalCase(id);
  const methodName = toCamelCase(id);
  const stateTypeName = `${typeName}State`;
  const states = contract.states ?? defaultStates(id);

  const lines: string[] = [
    `public extension View {`,
  ];

  if (states.length > 0) {
    lines.push(`  func ${methodName}(state: ${stateTypeName} = .normal) -> some View {`);
    lines.push(`    modifier(${typeName}(state: state))`);
  } else {
    lines.push(`  func ${methodName}() -> some View {`);
    lines.push(`    modifier(${typeName}())`);
  }

  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================
// Main export: generateSwiftUIStyles
// ============================================================

/**
 * Generates a Swift source file containing:
 * - A file-level comment referencing the active theme
 * - One ViewModifier struct per contract
 * - One State enum per stateful contract
 * - One View extension convenience method per contract
 *
 * The output is intentionally readable, not production-optimized Swift.
 * Its purpose is to validate that the shared contract IR maps coherently
 * to SwiftUI idioms — see the mapping notes doc for analysis.
 */
export function generateSwiftUIStyles(
  contracts: SwiftContractSpec[],
  theme: SwiftThemeSpec,
): string {
  const sections: string[] = [];

  sections.push('// Generated from contracts');
  sections.push(`// Theme: ${theme.id}`);
  sections.push('// Do not edit — regenerate via ThemeRealizer (swiftui target)');
  sections.push('');
  sections.push('import SwiftUI');
  sections.push('');

  for (const contract of contracts) {
    const id = contract.id;
    const states = contract.states ?? defaultStates(id);

    sections.push(`// MARK: - ${toPascalCase(id)}`);
    sections.push('');

    // 1. ViewModifier struct
    sections.push(generateViewModifier(contract, theme));
    sections.push('');

    // 2. State enum (only for contracts with states)
    if (states.length > 0) {
      sections.push(generateStateEnum(id, states));
      sections.push('');
    }

    // 3. View extension
    sections.push(generateViewExtension(contract));
    sections.push('');
  }

  return sections.join('\n');
}

// ============================================================
// Utility helpers
// ============================================================

function toPascalCase(id: string): string {
  return id
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(id: string): string {
  const pascal = toPascalCase(id);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Maps a state name to a valid Swift enum case identifier.
 * 'focus', 'invalid', 'disabled', 'hover', 'selected', 'saving' are all
 * already valid Swift identifiers, but this guard handles hyphenated names.
 */
function toSwiftCaseId(state: string): string {
  return state.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function defaultStates(id: string): string[] {
  const defaults: Record<string, string[]> = {
    'field-control':    ['focus', 'invalid', 'disabled'],
    'floating-panel':   [],
    'floating-trigger': ['hover', 'focus', 'disabled'],
    'menu-item':        ['hover', 'selected', 'disabled'],
    'page-section':     [],
    'inline-editor':    ['focus', 'invalid', 'saving'],
    'field-label':      [],
    'field-help':       [],
    'page-shell':       [],
    'page-header':      [],
    'toolbar':          [],
    'detail-grid':      [],
    'detail-label':     [],
    'detail-value':     [],
    'alert-surface':    [],
    'empty-state':      [],
  };
  return defaults[id] ?? [];
}
