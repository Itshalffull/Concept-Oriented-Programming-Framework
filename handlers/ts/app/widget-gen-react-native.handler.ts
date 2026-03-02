// WidgetGenReactNative — React Native widget generation provider
// Produces TypeScript/JSX components using View and Text from react-native.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-react-native-${++idCounter}`; }

export const widgetGenReactNativeHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:react-native';

    const existing = await storage.find('widget-gen-react-native', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-react-native', id, { id, providerRef, target: 'react-native' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'react-native',
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
    const propsSignature = props.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');

    const output = `import { View, Text } from 'react-native';\n\nexport function ${componentName}({${props.map(p => p.name).join(', ')}}: {${propsSignature}}) {\n  return <View><Text>${componentName}</Text></View>;\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenReactNativeCounter(): void { idCounter = 0; }
