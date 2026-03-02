// WidgetGenWear — Wear OS Compose widget generation provider
// Produces Kotlin @Composable functions using androidx.wear.compose.material.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-wear-${++idCounter}`; }

function toKotlinType(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Boolean';
    case 'int': case 'integer': return 'Int';
    default: return 'Any';
  }
}

export const widgetGenWearHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:wear';

    const existing = await storage.find('widget-gen-wear', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-wear', id, { id, providerRef, target: 'wear' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'wear',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },

  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetAst = input.widgetAst as string;

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const componentName = (ast.name as string) || 'Widget';
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const params = props.map(p => `    ${p.name}: ${toKotlinType(p.type)}`).join(',\n');
    const modifierParam = props.length > 0 ? ',\n    modifier: Modifier = Modifier' : '    modifier: Modifier = Modifier';

    const output = `import androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\nimport androidx.wear.compose.material.Text\nimport androidx.wear.compose.foundation.lazy.ScalingLazyColumn\n\n@Composable\nfun ${componentName}(\n${params}${modifierParam}\n) {\n    ScalingLazyColumn(modifier = modifier) {\n        item {\n            Text("${componentName}")\n        }\n    }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenWearCounter(): void { idCounter = 0; }
