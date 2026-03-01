// WidgetGen Concept Implementation [G]
// Generates framework-specific widget code from a widget AST for multiple UI targets.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_TARGETS = ['react', 'solid', 'vue', 'svelte', 'ink', 'react-native', 'swiftui'];

export const widgetGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const gen = input.gen as string;
    const target = input.target as string;
    const widgetAst = input.widgetAst as string;

    if (!VALID_TARGETS.includes(target)) {
      return { variant: 'error', message: `Unsupported target "${target}". Valid targets: ${VALID_TARGETS.join(', ')}` };
    }

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const id = gen || nextId('G');
    const componentName = (ast.name as string) || 'Widget';
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const propsSignature = props.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');

    let output: string;
    switch (target) {
      case 'react': {
        const propsType = props.length > 0
          ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}: ${p.type || 'any'};`).join('\n')}\n}`
          : '';
        output = `${propsType}\n\nexport function ${componentName}(${props.length > 0 ? `props: ${componentName}Props` : ''}) {\n  return <div>${componentName}</div>;\n}`;
        break;
      }
      case 'solid': {
        output = `import { Component } from 'solid-js';\n\nexport const ${componentName}: Component<{${propsSignature}}> = (props) => {\n  return <div>${componentName}</div>;\n};`;
        break;
      }
      case 'vue': {
        const propsBlock = props.map(p => `    ${p.name}: { type: ${p.type === 'string' ? 'String' : p.type === 'number' ? 'Number' : 'Object'} }`).join(',\n');
        output = `<template>\n  <div>${componentName}</div>\n</template>\n\n<script setup lang="ts">\ndefineProps<{${propsSignature}}>();\n</script>`;
        break;
      }
      case 'svelte': {
        const scriptProps = props.map(p => `  export let ${p.name}: ${p.type || 'any'};`).join('\n');
        output = `<script lang="ts">\n${scriptProps}\n</script>\n\n<div>${componentName}</div>`;
        break;
      }
      case 'ink': {
        output = `import { Box, Text } from 'ink';\n\nexport function ${componentName}({${props.map(p => p.name).join(', ')}}: {${propsSignature}}) {\n  return <Box><Text>${componentName}</Text></Box>;\n}`;
        break;
      }
      case 'react-native': {
        output = `import { View, Text } from 'react-native';\n\nexport function ${componentName}({${props.map(p => p.name).join(', ')}}: {${propsSignature}}) {\n  return <View><Text>${componentName}</Text></View>;\n}`;
        break;
      }
      case 'swiftui': {
        const swiftProps = props.map(p => `    var ${p.name}: ${p.type === 'string' ? 'String' : p.type === 'number' ? 'Int' : 'Any'}`).join('\n');
        output = `struct ${componentName}: View {\n${swiftProps}\n\n    var body: some View {\n        Text("${componentName}")\n    }\n}`;
        break;
      }
      default:
        output = '';
    }

    await storage.put('widgetGen', id, {
      target,
      input: widgetAst,
      output,
      status: 'generated',
    });

    return { variant: 'ok', output };
  },
};
