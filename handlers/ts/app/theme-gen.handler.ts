// ThemeGen Concept Implementation [G]
// Generates platform-specific theme output from a theme AST for multiple targets.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_TARGETS = ['css-variables', 'tailwind', 'react-native', 'terminal', 'w3c-dtcg'];

export const themeGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const gen = input.gen as string;
    const target = input.target as string;
    const themeAst = input.themeAst as string;

    if (!VALID_TARGETS.includes(target)) {
      return { variant: 'error', message: `Unsupported target "${target}". Valid targets: ${VALID_TARGETS.join(', ')}` };
    }

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(themeAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse theme AST as JSON' };
    }

    const id = gen || nextId('G');

    let output: string;
    switch (target) {
      case 'css-variables': {
        const vars: string[] = [];
        for (const [key, value] of Object.entries(ast)) {
          vars.push(`  --${key}: ${value};`);
        }
        output = `:root {\n${vars.join('\n')}\n}`;
        break;
      }
      case 'tailwind': {
        const extend: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(ast)) {
          extend[key] = value;
        }
        output = JSON.stringify({ theme: { extend } }, null, 2);
        break;
      }
      case 'react-native': {
        const styles: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(ast)) {
          const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          styles[camelKey] = value;
        }
        output = `export const theme = ${JSON.stringify(styles, null, 2)};`;
        break;
      }
      case 'terminal': {
        const ansiMap: string[] = [];
        for (const [key, value] of Object.entries(ast)) {
          ansiMap.push(`${key}=${value}`);
        }
        output = ansiMap.join('\n');
        break;
      }
      case 'w3c-dtcg': {
        const tokens: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(ast)) {
          tokens[key] = { $value: value, $type: 'color' };
        }
        output = JSON.stringify(tokens, null, 2);
        break;
      }
      default:
        output = '';
    }

    await storage.put('themeGen', id, {
      target,
      input: themeAst,
      output,
    });

    return { variant: 'ok', output };
  },
};
