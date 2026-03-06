// ============================================================
// SurfaceThemeScaffoldGen — Clef Surface theme scaffold generator
//
// Generates theme scaffolds including palette config, typography
// scale, motion definitions, elevation scale, and theme manifest.
// Follows WCAG accessibility guidelines for contrast ratios.
//
// See Clef Surface architecture:
//   - surface-theme suite: Theme, Palette, Typography, Motion, Elevation
//   - surface-core suite: DesignToken concept
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface ThemeConfig {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  baseSize?: number;
  scale?: number;
  borderRadius?: string;
  mode?: 'light' | 'dark' | 'both';
}

function generateColorScale(hue: string): Record<string, string> {
  // Generate a 50-950 color scale using HSL approximation
  // Real implementation would use OKLCH perceptual color space
  const shades: Record<string, string> = {};
  const levels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const lightnesses = [97, 93, 86, 75, 62, 50, 40, 32, 24, 18, 12];

  for (let i = 0; i < levels.length; i++) {
    shades[String(levels[i])] = `hsl(${hue}, 65%, ${lightnesses[i]}%)`;
  }
  return shades;
}

function buildThemeJson(config: ThemeConfig, mode: 'light' | 'dark'): string {
  const name = `${config.name}-${mode}`;

  const tokens: Record<string, unknown> = {
    name,
    mode,
    tokens: {
      colors: {
        primary: config.primaryColor || (mode === 'light' ? '#3b82f6' : '#60a5fa'),
        secondary: config.secondaryColor || (mode === 'light' ? '#6b7280' : '#9ca3af'),
        background: mode === 'light' ? '#ffffff' : '#111827',
        surface: mode === 'light' ? '#f9fafb' : '#1f2937',
        'on-primary': mode === 'light' ? '#ffffff' : '#000000',
        'on-background': mode === 'light' ? '#111827' : '#f9fafb',
        'on-surface': mode === 'light' ? '#1f2937' : '#f3f4f6',
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
      },
      borderRadius: {
        sm: '0.25rem',
        md: config.borderRadius || '0.375rem',
        lg: '0.5rem',
        full: '9999px',
      },
    },
  };

  return JSON.stringify(tokens, null, 2) + '\n';
}

function buildPaletteConfig(config: ThemeConfig): string {
  const primaryHue = config.primaryColor || '220';

  return JSON.stringify({
    palettes: {
      primary: {
        seed: primaryHue,
        scale: generateColorScale(primaryHue),
        roles: {
          default: '500',
          hover: '600',
          active: '700',
          subtle: '100',
          muted: '200',
        },
      },
      neutral: {
        seed: '220',
        scale: generateColorScale('220'),
        roles: {
          background: '50',
          surface: '100',
          border: '200',
          text: '900',
          'text-muted': '500',
        },
      },
      error: {
        seed: '0',
        scale: generateColorScale('0'),
      },
      warning: {
        seed: '38',
        scale: generateColorScale('38'),
      },
      success: {
        seed: '160',
        scale: generateColorScale('160'),
      },
    },
    contrast: {
      standard: 'AA',
      minimumRatio: 4.5,
      largeTextRatio: 3.0,
    },
  }, null, 2) + '\n';
}

function buildTypographyConfig(config: ThemeConfig): string {
  const baseSize = config.baseSize || 16;
  const scale = config.scale || 1.25; // Major third
  const fontFamily = config.fontFamily || 'system-ui, -apple-system, sans-serif';

  const sizes: Record<string, string> = {};
  const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const baseIndex = 2;

  for (let i = 0; i < names.length; i++) {
    const factor = Math.pow(scale, i - baseIndex);
    sizes[names[i]!] = `${(baseSize * factor).toFixed(2)}px`;
  }

  return JSON.stringify({
    fontFamilies: {
      sans: fontFamily,
      serif: 'Georgia, Cambria, serif',
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    scale: {
      ratio: scale,
      base: `${baseSize}px`,
      sizes,
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    presets: {
      'heading-1': { size: sizes['4xl'], weight: 700, lineHeight: 1.25, family: 'sans' },
      'heading-2': { size: sizes['3xl'], weight: 700, lineHeight: 1.25, family: 'sans' },
      'heading-3': { size: sizes['2xl'], weight: 600, lineHeight: 1.3, family: 'sans' },
      body: { size: sizes['base'], weight: 400, lineHeight: 1.5, family: 'sans' },
      caption: { size: sizes['sm'], weight: 400, lineHeight: 1.5, family: 'sans' },
      label: { size: sizes['sm'], weight: 500, lineHeight: 1.25, family: 'sans' },
      code: { size: sizes['sm'], weight: 400, lineHeight: 1.6, family: 'mono' },
    },
  }, null, 2) + '\n';
}

function buildMotionConfig(): string {
  return JSON.stringify({
    durations: {
      instant: '0ms',
      fast: '100ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easings: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
      'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
    transitions: {
      fade: { property: 'opacity', duration: 'normal', easing: 'default' },
      scale: { property: 'transform', duration: 'normal', easing: 'spring' },
      slide: { property: 'transform', duration: 'slow', easing: 'ease-out' },
      color: { property: 'color, background-color', duration: 'fast', easing: 'default' },
    },
    reducedMotion: {
      respectPreference: true,
      fallbackDuration: '0ms',
    },
  }, null, 2) + '\n';
}

function buildElevationConfig(): string {
  return JSON.stringify({
    scale: {
      0: { shadow: 'none', description: 'Flat — no elevation' },
      1: {
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        description: 'Raised — subtle lift',
      },
      2: {
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        description: 'Floating — dropdown, card hover',
      },
      3: {
        shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        description: 'Overlay — popover, tooltip',
      },
      4: {
        shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        description: 'Modal — dialog, sheet',
      },
      5: {
        shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        description: 'Top — notification toast',
      },
    },
    darkMode: {
      strategy: 'ambient-glow',
      opacity: 0.8,
    },
  }, null, 2) + '\n';
}

function buildThemeSpec(config: ThemeConfig, mode: 'light' | 'dark'): string {
  const name = `${toKebab(config.name)}-${mode}`;
  const primaryHue = config.primaryColor || '220';
  const baseSize = config.baseSize || 16;
  const scale = config.scale || 1.25;
  const fontFamily = config.fontFamily || 'system-ui, -apple-system, sans-serif';
  const borderRadius = config.borderRadius || '0.375rem';
  const bgL = mode === 'light' ? '0.98' : '0.12';
  const fgL = mode === 'light' ? '0.15' : '0.95';

  const lines: string[] = [];

  lines.push(`@version(1)`);
  if (mode === 'dark') {
    lines.push(`theme ${name} extends ${toKebab(config.name)}-light {`);
  } else {
    lines.push(`theme ${name} {`);
  }
  lines.push('  purpose {');
  lines.push(`    ${mode === 'light' ? 'Light' : 'Dark'} theme for the ${config.name} design system.`);
  lines.push('  }');
  lines.push('');

  // Palette
  lines.push('  palette {');
  lines.push(`    primary: oklch(0.55 0.15 ${primaryHue})`);
  lines.push(`    primary-light: oklch(0.80 0.08 ${primaryHue})`);
  lines.push(`    primary-dark: oklch(0.35 0.12 ${primaryHue})`);
  lines.push(`    background: oklch(${bgL} 0.01 ${primaryHue})`);
  lines.push(`    foreground: oklch(${fgL} 0.01 ${primaryHue})`);
  lines.push(`    surface: oklch(${mode === 'light' ? '0.96' : '0.18'} 0.01 ${primaryHue})`);
  lines.push('    error: oklch(0.55 0.20 25)');
  lines.push('    warning: oklch(0.70 0.15 85)');
  lines.push('    success: oklch(0.60 0.15 160)');
  lines.push('  }');
  lines.push('');

  // Typography
  lines.push('  typography {');
  lines.push(`    sans: "${fontFamily}"`);
  lines.push('    serif: "Georgia, Cambria, serif"');
  lines.push('    mono: "JetBrains Mono, Fira Code, monospace"');
  lines.push(`    body: { size: ${baseSize}px; weight: 400; lineHeight: 1.5; family: sans }`);
  lines.push(`    heading-1: { size: ${(baseSize * Math.pow(scale, 4)).toFixed(1)}px; weight: 700; lineHeight: 1.25; family: sans }`);
  lines.push(`    heading-2: { size: ${(baseSize * Math.pow(scale, 3)).toFixed(1)}px; weight: 700; lineHeight: 1.25; family: sans }`);
  lines.push(`    heading-3: { size: ${(baseSize * Math.pow(scale, 2)).toFixed(1)}px; weight: 600; lineHeight: 1.3; family: sans }`);
  lines.push(`    caption: { size: ${(baseSize * Math.pow(scale, -1)).toFixed(1)}px; weight: 400; lineHeight: 1.5; family: sans }`);
  lines.push('  }');
  lines.push('');

  // Spacing
  lines.push('  spacing {');
  lines.push('    base: 4px');
  lines.push('    xs: 4px');
  lines.push('    sm: 8px');
  lines.push('    md: 16px');
  lines.push('    lg: 24px');
  lines.push('    xl: 32px');
  lines.push('    2xl: 48px');
  lines.push('  }');
  lines.push('');

  // Motion
  lines.push('  motion {');
  lines.push('    instant: 0ms');
  lines.push('    fast: 100ms');
  lines.push('    normal: 200ms');
  lines.push('    slow: 300ms');
  lines.push('    ease-default: cubic-bezier(0.4, 0, 0.2, 1)');
  lines.push('    ease-in: cubic-bezier(0.4, 0, 1, 1)');
  lines.push('    ease-out: cubic-bezier(0, 0, 0.2, 1)');
  lines.push('  }');
  lines.push('');

  // Elevation
  lines.push('  elevation {');
  lines.push('    0: none');
  lines.push('    1: 0 1px 2px 0 rgba(0, 0, 0, 0.05)');
  lines.push('    2: 0 4px 6px -1px rgba(0, 0, 0, 0.1)');
  lines.push('    3: 0 10px 15px -3px rgba(0, 0, 0, 0.1)');
  lines.push('    4: 0 20px 25px -5px rgba(0, 0, 0, 0.1)');
  lines.push('    5: 0 25px 50px -12px rgba(0, 0, 0, 0.25)');
  lines.push('  }');
  lines.push('');

  // Radius
  lines.push('  radius {');
  lines.push('    sm: 0.25rem');
  lines.push(`    md: ${borderRadius}`);
  lines.push('    lg: 0.5rem');
  lines.push('    full: 9999px');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function buildThemeSuiteYaml(config: ThemeConfig): string {
  const kebab = toKebab(config.name);

  return [
    'suite:',
    `  name: theme-${kebab}`,
    '  version: 0.1.0',
    '  description: >',
    `    ${config.name} design system theme — palette, typography,`,
    '    motion, and elevation tokens.',
    '',
    'concepts:',
    '  # Theme tokens are managed by the surface-theme suite concepts.',
    '  # This suite provides token overrides and configuration.',
    '',
    'syncs:',
    '  required: []',
    '  recommended: []',
    '',
    'dependencies:',
    '  - surface-core: ">=0.1.0"',
    '  - surface-theme: ">=0.1.0"',
    '',
    'infrastructure:',
    '  themes:',
    `    - path: ./themes/${kebab}-light.json`,
    `    - path: ./themes/${kebab}-dark.json`,
    '',
  ].join('\n');
}

export const surfaceThemeScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SurfaceThemeScaffoldGen',
      inputKind: 'ThemeConfig',
      outputKind: 'SurfaceTheme',
      capabilities: JSON.stringify(['palette', 'typography', 'spacing', 'motion', 'elevation', 'radius', 'extends', 'wcag']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'my-theme';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Theme name is required' };
    }

    try {
      const kebab = toKebab(name);
      const config: ThemeConfig = {
        name,
        primaryColor: input.primaryColor as string,
        secondaryColor: input.secondaryColor as string,
        fontFamily: input.fontFamily as string,
        baseSize: input.baseSize as number,
        scale: input.scale as number,
        borderRadius: input.borderRadius as string,
        mode: (input.mode as ThemeConfig['mode']) || 'both',
      };

      const files: { path: string; content: string }[] = [];

      // Suite manifest
      files.push({
        path: `theme-${kebab}/suite.stub.yaml`,
        content: buildThemeSuiteYaml(config),
      });

      // Theme spec files (.theme format)
      if (config.mode === 'both' || config.mode === 'light') {
        files.push({
          path: `theme-${kebab}/themes/${kebab}-light.stub.theme`,
          content: buildThemeSpec(config, 'light'),
        });
      }
      if (config.mode === 'both' || config.mode === 'dark') {
        files.push({
          path: `theme-${kebab}/themes/${kebab}-dark.stub.theme`,
          content: buildThemeSpec(config, 'dark'),
        });
      }

      // Design system tokens
      files.push({
        path: `theme-${kebab}/tokens/palette.stub.json`,
        content: buildPaletteConfig(config),
      });
      files.push({
        path: `theme-${kebab}/tokens/typography.stub.json`,
        content: buildTypographyConfig(config),
      });
      files.push({
        path: `theme-${kebab}/tokens/motion.stub.json`,
        content: buildMotionConfig(),
      });
      files.push({
        path: `theme-${kebab}/tokens/elevation.stub.json`,
        content: buildElevationConfig(),
      });

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return { variant: 'error', message, ...(stack ? { stack } : {}) };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await surfaceThemeScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
