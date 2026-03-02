// ============================================================
// Ink Widgets Framework Components Tests
//
// Verifies the 14 framework Ink components can be dynamically
// imported, are valid React function components, set displayName,
// and export expected utility hooks. Also verifies the barrel
// index re-exports everything.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.resolve(
  PROJECT_ROOT,
  'surface/widgets/ink/components',
);

// --------------- Framework Component Metadata ---------------

interface ComponentMeta {
  /** PascalCase component name. */
  name: string;
  /** Additional named exports that should be functions (hooks, helpers). */
  utilityExports: string[];
}

const FRAMEWORK_COMPONENTS: ComponentMeta[] = [
  {
    name: 'DesignTokenProvider',
    utilityExports: ['useDesignTokens'],
  },
  {
    name: 'ThemeSwitch',
    utilityExports: [],
  },
  {
    name: 'TypographyText',
    utilityExports: [],
  },
  {
    name: 'PalettePreview',
    utilityExports: [],
  },
  {
    name: 'ElevationBox',
    utilityExports: [],
  },
  {
    name: 'MotionBox',
    utilityExports: [],
  },
  {
    name: 'LayoutContainer',
    utilityExports: [],
  },
  {
    name: 'ViewportProvider',
    utilityExports: ['useViewport', 'useBreakpoint'],
  },
  {
    name: 'ElementRenderer',
    utilityExports: [],
  },
  {
    name: 'WidgetMachine',
    utilityExports: [],
  },
  {
    name: 'SlotOutlet',
    utilityExports: ['useSlotFill'],
  },
  {
    name: 'BindingProvider',
    utilityExports: ['useBinding', 'useBoundSignal'],
  },
  {
    name: 'UISchemaForm',
    utilityExports: [],
  },
  {
    name: 'SurfaceRoot',
    utilityExports: ['useSurface', 'useSurfaceSize'],
  },
];

// --------------- Barrel Exports Expected ---------------

/**
 * All named exports that must appear in the framework barrel index.tsx.
 * Gathered from the individual component files.
 */
const BARREL_EXPECTED_COMPONENT_EXPORTS = FRAMEWORK_COMPONENTS.map(
  (c) => c.name,
);

const BARREL_EXPECTED_HOOK_EXPORTS = FRAMEWORK_COMPONENTS.flatMap(
  (c) => c.utilityExports,
);

/**
 * Additional component exports from SlotOutlet that are re-exported
 * through the barrel (SlotProvider, SlotFromConfig).
 */
const BARREL_EXTRA_COMPONENT_EXPORTS = ['SlotProvider', 'SlotFromConfig'];

// ============================================================
// Tests
// ============================================================

describe('Ink Framework Components', () => {
  describe('Dynamic import and React.FC validation', () => {
    for (const meta of FRAMEWORK_COMPONENTS) {
      it(`${meta.name} can be imported and is a function`, async () => {
        const modulePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        expect(
          fs.existsSync(modulePath),
          `Module file missing: ${modulePath}`,
        ).toBe(true);

        const mod = await import(modulePath);
        expect(
          typeof mod[meta.name],
          `${meta.name} should be exported as a function (React.FC)`,
        ).toBe('function');
      });
    }
  });

  describe('displayName is set on each component', () => {
    for (const meta of FRAMEWORK_COMPONENTS) {
      it(`${meta.name}.displayName equals "${meta.name}"`, async () => {
        const modulePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        const mod = await import(modulePath);
        const component = mod[meta.name];
        expect(component.displayName).toBe(meta.name);
      });
    }
  });

  describe('Utility hook exports are functions', () => {
    for (const meta of FRAMEWORK_COMPONENTS) {
      for (const hookName of meta.utilityExports) {
        it(`${meta.name} exports ${hookName} as a function`, async () => {
          const modulePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
          const mod = await import(modulePath);
          expect(
            typeof mod[hookName],
            `${hookName} from ${meta.name} should be a function`,
          ).toBe('function');
        });
      }
    }
  });

  describe('Barrel index re-exports (content analysis)', () => {
    // The barrel index.tsx uses .js extensions for ESM compatibility,
    // which may not resolve during Vitest dynamic import. We verify
    // the barrel content contains the expected export statements.
    const barrelPath = path.join(COMPONENTS_DIR, 'index.tsx');

    it('barrel index.tsx exists', () => {
      expect(
        fs.existsSync(barrelPath),
        `Barrel index missing: ${barrelPath}`,
      ).toBe(true);
    });

    describe('re-exports all framework components', () => {
      for (const name of BARREL_EXPECTED_COMPONENT_EXPORTS) {
        it(`barrel re-exports ${name}`, () => {
          const content = fs.readFileSync(barrelPath, 'utf-8');
          const hasExport =
            content.includes(`{ ${name}`) ||
            content.includes(`{ ${name},`) ||
            content.includes(`, ${name} }`) ||
            content.includes(`, ${name},`);
          expect(
            hasExport,
            `Barrel should re-export ${name}`,
          ).toBe(true);
        });
      }
    });

    describe('re-exports all hooks', () => {
      for (const name of BARREL_EXPECTED_HOOK_EXPORTS) {
        it(`barrel re-exports ${name}`, () => {
          const content = fs.readFileSync(barrelPath, 'utf-8');
          const hasExport =
            content.includes(`${name}`) &&
            content.includes('export');
          expect(
            hasExport,
            `Barrel should re-export ${name}`,
          ).toBe(true);
        });
      }
    });

    describe('re-exports additional composition components', () => {
      for (const name of BARREL_EXTRA_COMPONENT_EXPORTS) {
        it(`barrel re-exports ${name}`, () => {
          const content = fs.readFileSync(barrelPath, 'utf-8');
          expect(
            content.includes(name),
            `Barrel should re-export ${name}`,
          ).toBe(true);
        });
      }
    });

    it('re-exports repertoire widgets namespace', () => {
      const content = fs.readFileSync(barrelPath, 'utf-8');
      expect(
        content.includes('widgets'),
        'Barrel should reference widgets namespace',
      ).toBe(true);
      // Verify it uses a namespace import/re-export pattern
      expect(
        content.includes("export * as widgets from") ||
          content.includes("export { widgets"),
        'Barrel should use namespace export for widgets',
      ).toBe(true);
    });
  });

  describe('Component Props interface is exported as a type', () => {
    for (const meta of FRAMEWORK_COMPONENTS) {
      it(`${meta.name} file exports ${meta.name}Props interface`, () => {
        const filePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const propsInterfaceName = `${meta.name}Props`;
        expect(
          content.includes(`export interface ${propsInterfaceName}`) ||
            content.includes(`export type ${propsInterfaceName}`),
          `${meta.name}.tsx should export ${propsInterfaceName}`,
        ).toBe(true);
      });
    }
  });

  describe('Component file structure conventions', () => {
    for (const meta of FRAMEWORK_COMPONENTS) {
      it(`${meta.name}.tsx has the standard Clef file header`, () => {
        const filePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(
          content.startsWith('// ==='),
          `${meta.name}.tsx should start with the Clef banner comment`,
        ).toBe(true);
        expect(
          content.includes('Clef Surface Ink Widget'),
          `${meta.name}.tsx header should mention "Clef Surface Ink Widget"`,
        ).toBe(true);
      });

      it(`${meta.name}.tsx imports from React`, () => {
        const filePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(
          content.includes("from 'react'"),
          `${meta.name}.tsx should import from 'react'`,
        ).toBe(true);
      });

      it(`${meta.name}.tsx has a default export`, () => {
        const filePath = path.join(COMPONENTS_DIR, `${meta.name}.tsx`);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(
          content.includes(`export default ${meta.name}`),
          `${meta.name}.tsx should have a default export`,
        ).toBe(true);
      });
    }
  });
});
