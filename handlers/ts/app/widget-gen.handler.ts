// WidgetGen Concept Implementation [G]
// Generates framework-specific widget code from a widget AST for multiple UI targets.
import type { ConceptHandler } from '@clef/runtime';
import { APPKIT_WIDGET_MAP } from './appkit-adapter.handler';
import type { WidgetMapping } from './appkit-adapter.handler';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_TARGETS = ['react', 'solid', 'vue', 'svelte', 'ink', 'react-native', 'swiftui', 'appkit'];

// Map AST type strings to Swift type names
function toSwiftType(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Bool';
    case 'int': case 'integer': return 'Int';
    default: return 'Any';
  }
}

// Generate Swift AppKit code from a widget AST + optional WidgetMapping
function generateAppKit(
  componentName: string,
  props: Array<{ name: string; type: string }>,
  mapping: WidgetMapping | undefined,
): string {
  const viewClass = mapping?.viewClass ?? 'NSView';
  const accessRole = mapping?.accessibilityRole ?? 'AXGroup';
  const viewProps = mapping?.viewProperties ?? {};
  const eventMap = mapping?.eventMap ?? {};
  const anatomy = mapping?.anatomy ?? {};

  const lines: string[] = [];
  lines.push('import AppKit');
  lines.push('');
  lines.push(`class ${componentName}: ${viewClass} {`);

  // Properties from AST
  for (const p of props) {
    lines.push(`    var ${p.name}: ${toSwiftType(p.type)}`);
  }

  if (props.length > 0) lines.push('');

  // Initializer
  const initParams = props.map(p => `${p.name}: ${toSwiftType(p.type)}`).join(', ');
  lines.push(`    init(${initParams}) {`);
  for (const p of props) {
    lines.push(`        self.${p.name} = ${p.name}`);
  }
  lines.push('        super.init(frame: .zero)');
  lines.push('        configure()');
  lines.push('    }');
  lines.push('');
  lines.push('    required init?(coder: NSCoder) {');
  lines.push('        fatalError("init(coder:) has not been implemented")');
  lines.push('    }');
  lines.push('');

  // Configure method — applies viewProperties and accessibility
  lines.push('    private func configure() {');

  for (const [key, value] of Object.entries(viewProps)) {
    if (key.startsWith('layer.')) {
      const layerProp = key.slice(6);
      lines.push('        wantsLayer = true');
      if (typeof value === 'string') {
        lines.push(`        layer?.${layerProp} = ${value === 'half' ? 'bounds.height / 2' : `"${value}"`}`);
      } else {
        lines.push(`        layer?.${layerProp} = ${JSON.stringify(value)}`);
      }
    } else if (typeof value === 'string') {
      // Check for enum-like values (contain | for masks, or known enum patterns)
      if (value.includes('|')) {
        const parts = value.split('|').map(v => `.${v.trim()}`);
        lines.push(`        ${key} = [${parts.join(', ')}]`);
      } else {
        lines.push(`        ${key} = .${value}`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`        ${key} = ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`        ${key} = ${value}`);
    }
  }

  lines.push(`        setAccessibilityRole(.${accessRole.replace('AX', '').charAt(0).toLowerCase() + accessRole.replace('AX', '').slice(1)})`);
  lines.push('    }');

  // Event handler stubs from eventMap
  if (Object.keys(eventMap).length > 0) {
    lines.push('');
    lines.push('    // MARK: - Actions');
    for (const [event, selector] of Object.entries(eventMap)) {
      const methodName = selector.replace(/:/g, '');
      lines.push('');
      lines.push(`    @objc func ${methodName}(_ sender: Any?) {`);
      lines.push(`        // Handle ${event} event`);
      lines.push('    }');
    }
  }

  // Anatomy factory for composite widgets
  const anatomyParts = Object.entries(anatomy).filter(([k]) => k !== 'root');
  if (anatomyParts.length > 0) {
    lines.push('');
    lines.push('    // MARK: - Anatomy');
    for (const [part, partClass] of anatomyParts) {
      lines.push('');
      lines.push(`    private(set) lazy var ${part}: ${partClass} = {`);
      lines.push(`        let view = ${partClass}()`);
      lines.push('        return view');
      lines.push('    }()');
    }
  }

  lines.push('}');
  return lines.join('\n');
}

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
      case 'appkit': {
        // Look up widget mapping: ast.widget or ast.type → APPKIT_WIDGET_MAP key
        const widgetType = (ast.widget as string) || (ast.type as string) || '';
        const mapKey = widgetType.replace(/[-_\s]/g, '').toLowerCase();
        const mapping: WidgetMapping | undefined = mapKey ? APPKIT_WIDGET_MAP[mapKey] : undefined;
        output = generateAppKit(componentName, props, mapping);
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
