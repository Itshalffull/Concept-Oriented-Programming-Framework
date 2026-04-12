// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  branch,
  complete,
  completeFrom,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// ============================================================
// CSS Generator
// ============================================================

/**
 * A minimal contract descriptor parsed from the contracts JSON payload.
 */
interface ContractSpec {
  id: string;
  states?: string[];
  variants?: string[];
  resources?: Record<string, string>;
}

/**
 * A parsed theme descriptor.
 */
interface ThemeSpec {
  id: string;
  tokens?: Record<string, string>;
}

/**
 * Given a list of contracts and a theme, generate a CSS string following
 * the data-attribute convention from PRD §3.8:
 *
 *   [data-contract="field-control"]           — base rule
 *   [data-contract="field-control"][data-contract-state~="invalid"]  — state rule
 *   [data-contract="field-control"][data-contract-variant="compact"] — variant rule
 *
 * CSS variables are scoped under the theme id selector.
 */
export function generateContractCSS(contracts: ContractSpec[], theme: ThemeSpec): string {
  const lines: string[] = [];

  // Theme-scoped semantic variables block
  lines.push(`/* Theme: ${theme.id} */`);
  lines.push(`[data-theme="${theme.id}"] {`);

  const tokens = theme.tokens ?? {};
  // Emit placeholder token variables if none provided
  if (Object.keys(tokens).length === 0) {
    lines.push('  --palette-surface: #ffffff;');
    lines.push('  --palette-surface-muted: #f5f5f5;');
    lines.push('  --palette-foreground: #111111;');
    lines.push('  --palette-foreground-muted: #666666;');
    lines.push('  --palette-border: #d1d5db;');
    lines.push('  --palette-border-focus: #3b82f6;');
    lines.push('  --palette-border-invalid: #ef4444;');
    lines.push('  --palette-accent: #3b82f6;');
    lines.push('  --palette-accent-selected: #dbeafe;');
    lines.push('  --radius-control: 4px;');
    lines.push('  --spacing-2: 8px;');
    lines.push('  --spacing-3: 12px;');
    lines.push('  --elevation-panel: 0 4px 16px rgba(0,0,0,0.12);');
  } else {
    for (const [k, v] of Object.entries(tokens)) {
      lines.push(`  --${k}: ${v};`);
    }
  }
  lines.push('}');
  lines.push('');

  // Contract base and state/variant rules
  for (const contract of contracts) {
    const id = contract.id;
    const cssVarPrefix = `--sc-${id.replace(/[^a-z0-9-]/g, '-')}`;

    // Derive semantic variable defaults per contract role
    const contractVarBlock = buildContractVars(id, cssVarPrefix);

    // Base rule
    lines.push(`/* Contract: ${id} */`);
    lines.push(`[data-contract="${id}"] {`);
    for (const line of contractVarBlock) {
      lines.push(`  ${line}`);
    }
    lines.push('}');
    lines.push('');

    // State rules
    const states = contract.states ?? defaultStatesForContract(id);
    for (const state of states) {
      const stateVarBlock = buildStateVars(id, cssVarPrefix, state);
      if (stateVarBlock.length > 0) {
        lines.push(`[data-contract="${id}"][data-contract-state~="${state}"] {`);
        for (const line of stateVarBlock) {
          lines.push(`  ${line}`);
        }
        lines.push('}');
        lines.push('');
      }
    }

    // Variant rules (density/style-profile/motif stubs)
    const variants = contract.variants ?? [];
    for (const variant of variants) {
      lines.push(`[data-contract="${id}"][data-contract-variant="${variant}"] {`);
      lines.push(`  /* ${id} variant: ${variant} — stub for density/motif override */`);
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildContractVars(id: string, prefix: string): string[] {
  // Map well-known contract IDs to semantic variable declarations.
  // Unknown contracts get a generic set.
  const known: Record<string, string[]> = {
    'field-control': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `color: var(${prefix}-foreground, var(--palette-foreground));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `border-radius: var(${prefix}-radius, var(--radius-control));`,
    ],
    'field-label': [
      `color: var(${prefix}-color, var(--palette-foreground-muted));`,
      `font-size: var(${prefix}-font-size, 0.875rem);`,
    ],
    'field-help': [
      `color: var(${prefix}-color, var(--palette-foreground-muted));`,
      `font-size: var(${prefix}-font-size, 0.8125rem);`,
    ],
    'floating-panel': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `border-radius: var(${prefix}-radius, var(--radius-control));`,
      `box-shadow: var(${prefix}-shadow, var(--elevation-panel));`,
    ],
    'floating-trigger': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `border-radius: var(${prefix}-radius, var(--radius-control));`,
      `cursor: pointer;`,
    ],
    'menu-item': [
      `background: var(${prefix}-background, transparent);`,
      `color: var(${prefix}-color, var(--palette-foreground));`,
      `padding: var(${prefix}-padding, var(--spacing-2));`,
    ],
    'page-shell': [
      `background: var(${prefix}-background, var(--palette-surface-muted));`,
      `color: var(${prefix}-color, var(--palette-foreground));`,
    ],
    'page-header': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border-bottom: 1px solid var(${prefix}-border, var(--palette-border));`,
      `padding: var(${prefix}-padding, var(--spacing-3));`,
    ],
    'page-section': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `padding: var(${prefix}-padding, var(--spacing-3));`,
    ],
    'toolbar': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border-bottom: 1px solid var(${prefix}-border, var(--palette-border));`,
      `padding: var(${prefix}-padding, var(--spacing-2));`,
    ],
    'detail-grid': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
    ],
    'detail-label': [
      `color: var(${prefix}-color, var(--palette-foreground-muted));`,
      `font-size: var(${prefix}-font-size, 0.875rem);`,
    ],
    'detail-value': [
      `color: var(${prefix}-color, var(--palette-foreground));`,
    ],
    'inline-editor': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `border-radius: var(${prefix}-radius, var(--radius-control));`,
    ],
    'alert-surface': [
      `background: var(${prefix}-background, var(--palette-surface));`,
      `border: 1px solid var(${prefix}-border, var(--palette-border));`,
      `border-radius: var(${prefix}-radius, var(--radius-control));`,
      `padding: var(${prefix}-padding, var(--spacing-3));`,
    ],
    'empty-state': [
      `color: var(${prefix}-color, var(--palette-foreground-muted));`,
      `padding: var(${prefix}-padding, var(--spacing-3));`,
    ],
  };

  return known[id] ?? [
    `background: var(${prefix}-background, var(--palette-surface));`,
    `color: var(${prefix}-color, var(--palette-foreground));`,
  ];
}

function buildStateVars(id: string, prefix: string, state: string): string[] {
  const stateMap: Record<string, Record<string, string[]>> = {
    'field-control': {
      focus: [
        `border-color: var(${prefix}-border-focus, var(--palette-border-focus));`,
        `outline: 2px solid var(${prefix}-focus-ring, var(--palette-border-focus));`,
        `outline-offset: 1px;`,
      ],
      invalid: [
        `border-color: var(${prefix}-border-invalid, var(--palette-border-invalid));`,
      ],
      disabled: [
        `opacity: 0.5;`,
        `cursor: not-allowed;`,
      ],
    },
    'floating-trigger': {
      hover: [`background: var(${prefix}-background-hover, var(--palette-surface-muted));`],
      focus: [
        `border-color: var(${prefix}-border-focus, var(--palette-border-focus));`,
        `outline: 2px solid var(${prefix}-focus-ring, var(--palette-border-focus));`,
      ],
      disabled: [`opacity: 0.5;`, `cursor: not-allowed;`],
    },
    'menu-item': {
      hover: [`background: var(${prefix}-background-hover, var(--palette-surface-muted));`],
      selected: [`background: var(${prefix}-background-selected, var(--palette-accent-selected));`],
      disabled: [`opacity: 0.5;`, `cursor: not-allowed;`],
    },
    'inline-editor': {
      focus: [
        `border-color: var(${prefix}-border-focus, var(--palette-border-focus));`,
        `outline: 2px solid var(${prefix}-focus-ring, var(--palette-border-focus));`,
      ],
      invalid: [`border-color: var(${prefix}-border-invalid, var(--palette-border-invalid));`],
      saving: [`opacity: 0.7;`],
    },
    'floating-panel': {
      focus: [
        `outline: 2px solid var(${prefix}-focus-ring, var(--palette-border-focus));`,
      ],
    },
  };

  return (stateMap[id] ?? {})[state] ?? [];
}

function defaultStatesForContract(id: string): string[] {
  const defaults: Record<string, string[]> = {
    'field-control': ['focus', 'invalid', 'disabled'],
    'floating-panel': ['focus'],
    'floating-trigger': ['hover', 'focus', 'disabled'],
    'menu-item': ['hover', 'selected', 'disabled'],
    'page-section': [],
    'inline-editor': ['focus', 'invalid', 'saving'],
    'field-label': [],
    'field-help': [],
    'page-shell': [],
    'page-header': [],
    'toolbar': [],
    'detail-grid': [],
    'detail-label': [],
    'detail-value': [],
    'alert-surface': [],
    'empty-state': [],
  };
  return defaults[id] ?? [];
}

// ============================================================
// Manifest Generator
// ============================================================

interface ManifestContract {
  id: string;
  states: string[];
  variants: string[];
  resources: Record<string, string>;
  selectors: {
    base: string;
    states: Record<string, string>;
    variants: Record<string, string>;
  };
}

interface ContractManifest {
  themeId: string;
  realizerId: string;
  target: string;
  generatedAt: string;
  contracts: ManifestContract[];
}

export function generateContractManifest(
  realizerId: string,
  target: string,
  contracts: ContractSpec[],
  theme: ThemeSpec,
): ContractManifest {
  const manifestContracts: ManifestContract[] = contracts.map((contract) => {
    const id = contract.id;
    const states = contract.states ?? defaultStatesForContract(id);
    const variants = contract.variants ?? [];

    // Semantic resource bindings (stub — maps to CSS variable names)
    const resources: Record<string, string> = contract.resources ?? buildDefaultResources(id);

    // Selector names per contract/state/variant
    const stateSelectors: Record<string, string> = {};
    for (const state of states) {
      stateSelectors[state] = `[data-contract="${id}"][data-contract-state~="${state}"]`;
    }

    const variantSelectors: Record<string, string> = {};
    for (const variant of variants) {
      variantSelectors[variant] = `[data-contract="${id}"][data-contract-variant="${variant}"]`;
    }

    return {
      id,
      states,
      variants,
      resources,
      selectors: {
        base: `[data-contract="${id}"]`,
        states: stateSelectors,
        variants: variantSelectors,
      },
    };
  });

  return {
    themeId: theme.id,
    realizerId,
    target,
    generatedAt: new Date().toISOString(),
    contracts: manifestContracts,
  };
}

function buildDefaultResources(id: string): Record<string, string> {
  const resourceMap: Record<string, Record<string, string>> = {
    'field-control': {
      background: 'surface.control',
      foreground: 'text.default',
      border: 'border.control',
      focusRing: 'border.focus',
      errorBorder: 'status.error',
      radius: 'shape.control',
      typography: 'type.body-md',
    },
    'floating-panel': {
      background: 'surface.overlay',
      border: 'border.overlay',
      radius: 'shape.overlay',
      shadow: 'elevation.panel',
    },
    'menu-item': {
      background: 'surface.transparent',
      backgroundHover: 'surface.hover',
      backgroundSelected: 'surface.selected',
      foreground: 'text.default',
      spacing: 'spacing.row',
    },
    'field-label': {
      color: 'text.muted',
      typography: 'type.label-sm',
    },
    'page-section': {
      background: 'surface.card',
      border: 'border.subtle',
      spacing: 'spacing.section',
    },
  };

  return resourceMap[id] ?? { background: 'surface.default', foreground: 'text.default' };
}

// ============================================================
// Handler
// ============================================================

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const realizer = input.realizer as string;
    const target = input.target as string;
    const outputKinds = input.outputKinds as string[];
    const contractSupport = input.contractSupport as string[];
    const capabilities = input.capabilities as string[];
    const description = input.description as string;

    // Introspection call: register({}) with fully empty input returns concept metadata
    const hasAnyField = Object.values(input).some((v) => v !== undefined && v !== null && v !== '');
    if (!hasAnyField) {
      return complete(createProgram(), 'ok', { name: 'ThemeRealizer' });
    }

    // Validate required fields before any storage operations
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', { message: 'target is required' });
    }
    if (!outputKinds || (outputKinds as unknown[]).length === 0) {
      return complete(createProgram(), 'error', { message: 'outputKinds must not be empty' });
    }
    if (!description || description.trim() === '') {
      return complete(createProgram(), 'error', { message: 'description is required' });
    }

    let p = createProgram();
    p = get(p, 'entries', realizer, 'existing');
    return branch(
      p,
      (b) => b.existing != null,
      complete(createProgram(), 'duplicate', { realizer }),
      (() => {
        let q = createProgram();
        q = put(q, 'entries', realizer, {
          realizer,
          target,
          outputKinds,
          contractSupport: contractSupport ?? [],
          capabilities: capabilities ?? [],
          description,
        });
        return complete(q, 'ok', { realizer });
      })(),
    );
  },

  realize(input: Record<string, unknown>) {
    const realizer = input.realizer as string;
    const themeRaw = input.theme as string;
    const contractsRaw = input.contracts as string;

    // Validate theme — empty string is an explicit error
    if (!themeRaw || themeRaw.trim() === '') {
      return complete(createProgram(), 'error', { message: 'theme is required' });
    }

    // Parse theme JSON — if not valid JSON treat as an opaque theme id
    let theme: ThemeSpec;
    try {
      const parsed = JSON.parse(themeRaw) as Record<string, unknown>;
      theme = {
        id: (parsed.id as string) || 'default',
        tokens: (parsed.tokens as Record<string, string>) || undefined,
      };
    } catch {
      // Non-JSON theme value — treat as a theme identifier string (opaque id)
      theme = { id: themeRaw };
    }

    // Parse contracts JSON — if not valid JSON treat as empty contracts list
    let contracts: ContractSpec[];
    try {
      const parsed = JSON.parse(contractsRaw || '{"contracts":[]}') as Record<string, unknown>;
      // Accept either { contracts: [...] } or a plain array
      const raw = Array.isArray(parsed)
        ? (parsed as Array<Record<string, unknown>>)
        : (parsed.contracts as Array<Record<string, unknown>> | undefined) ?? [];
      contracts = raw.map((c) => ({
        id: c.id as string,
        states: c.states as string[] | undefined,
        variants: c.variants as string[] | undefined,
        resources: c.resources as Record<string, string> | undefined,
      }));
    } catch {
      // Non-JSON contracts value — treat as empty contracts list for graceful degradation
      contracts = [];
    }

    // Look up the realizer
    let p = createProgram();
    p = get(p, 'entries', realizer, 'entry');
    return branch(
      p,
      (b) => b.entry == null,
      complete(createProgram(), 'notfound', { message: `No realizer registered with id: ${realizer}` }),
      (() => {
        let q = createProgram();
        q = get(q, 'entries', realizer, 'entry');
        return completeFrom(q, 'ok', (b) => {
          const entry = b.entry as Record<string, unknown>;
          const target = entry.target as string;

          const css = generateContractCSS(contracts, theme);
          const manifest = generateContractManifest(realizer, target, contracts, theme);

          return {
            realizer,
            output: css,
            manifest: JSON.stringify(manifest),
          };
        });
      })(),
    );
  },

  get(input: Record<string, unknown>) {
    const realizer = typeof input.realizer === 'string' ? input.realizer : '';

    if (!realizer || realizer.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'realizer id is required' });
    }

    let p = createProgram();
    p = get(p, 'entries', realizer, 'entry');
    return branch(
      p,
      (b) => b.entry == null,
      complete(createProgram(), 'notfound', { message: `No realizer found: ${realizer}` }),
      (() => {
        let q = createProgram();
        q = get(q, 'entries', realizer, 'entry');
        return completeFrom(q, 'ok', (b) => {
          const entry = b.entry as Record<string, unknown>;
          return {
            realizer: entry.realizer as string,
            target: entry.target as string,
            outputKinds: entry.outputKinds as string[],
            contractSupport: entry.contractSupport as string[],
            capabilities: entry.capabilities as string[],
            description: entry.description as string,
          };
        });
      })(),
    );
  },

  listTargets(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entries', {}, 'allEntries');
    return completeFrom(p, 'ok', (b) => {
      const entries = (b.allEntries as Array<Record<string, unknown>>) ?? [];
      const targets = entries.map((e) => e.target as string);
      return { targets };
    });
  },

};

export const themeRealizerHandler = autoInterpret(_handler);
