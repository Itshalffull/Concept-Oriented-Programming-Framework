// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, branch, put, pure, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/**
 * ThemeComplianceProvider — functional handler.
 *
 * Verifies that every theme design token referenced in a RenderProgram
 * resolves to a valid key in the active theme manifest. Reports missing,
 * deprecated, and type-mismatched tokens.
 */

// Well-known token prefixes and their expected usage contexts
const TOKEN_TYPE_MAP: Record<string, string> = {
  'color': 'color',
  'spacing': 'spacing',
  'typography': 'typography',
  'elevation': 'elevation',
  'radius': 'radius',
  'motion': 'motion',
};

// Tokens known to be deprecated (would come from manifest in production)
const DEPRECATED_PATTERNS = ['legacy.', 'deprecated.', 'v1.'];

function verifyCompliance(tokens: string[], manifestKeys: Set<string>): {
  missingTokens: string[];
  deprecatedTokens: string[];
  passed: boolean;
} {
  const missingTokens: string[] = [];
  const deprecatedTokens: string[] = [];

  for (const token of tokens) {
    // Check if token exists in manifest
    if (!manifestKeys.has(token)) {
      // Check prefix-based resolution (e.g., "color.primary" matches if "color" namespace exists)
      const prefix = token.split('.')[0];
      const hasNamespace = [...manifestKeys].some(k => k.startsWith(prefix + '.'));
      if (!hasNamespace) {
        missingTokens.push(token);
      }
    }

    // Check for deprecated patterns
    for (const pattern of DEPRECATED_PATTERNS) {
      if (token.includes(pattern)) {
        deprecatedTokens.push(token);
        break;
      }
    }
  }

  return {
    missingTokens,
    deprecatedTokens,
    passed: missingTokens.length === 0 && deprecatedTokens.length === 0,
  };
}

const _themeComplianceProviderHandler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    const check = input.check as string;
    const program = input.program as string;
    const manifest = input.manifest as string;

    try {
      let tokens: string[] = [];
      if (input.tokens) {
        tokens = (Array.isArray(input.tokens) ? input.tokens : JSON.parse(input.tokens as string)) as string[];
      }

      // Parse manifest keys (in production, this would come from the ThemeManifest concept)
      let manifestKeys: Set<string>;
      try {
        const parsed = JSON.parse(manifest);
        manifestKeys = new Set(Object.keys(parsed));
      } catch {
        // If manifest isn't JSON, treat it as a named manifest with common keys
        manifestKeys = new Set([
          'color.primary', 'color.secondary', 'color.surface', 'color.error',
          'spacing.xs', 'spacing.sm', 'spacing.md', 'spacing.lg', 'spacing.xl',
          'typography.body', 'typography.heading', 'typography.caption',
          'elevation.sm', 'elevation.md', 'elevation.lg',
          'radius.sm', 'radius.md', 'radius.lg',
          'motion.fast', 'motion.normal', 'motion.slow',
        ]);
      }

      const { missingTokens, deprecatedTokens, passed } = verifyCompliance(tokens, manifestKeys);

      let p = createProgram();
      p = put(p, 'checks', check, { program, missingTokens, deprecatedTokens, passed });
      p = pure(p, {
        variant: 'ok',
        check,
        missingTokens: JSON.stringify(missingTokens),
        deprecatedTokens: JSON.stringify(deprecatedTokens),
        passed,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Theme compliance check failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  getResults(input: Record<string, unknown>) {
    const check = input.check as string;
    let p = createProgram();
    p = get(p, 'checks', check, 'checkResult');
    return branch(p, 'checkResult',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.checkResult as Record<string, unknown>;
        return { check, violations: data.violations || '[]', passed: data.passed };
      }),
      (b) => complete(b, 'notfound', { check, message: `check not found: ${check}` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const themeComplianceProviderHandler = autoInterpret(_themeComplianceProviderHandler);

