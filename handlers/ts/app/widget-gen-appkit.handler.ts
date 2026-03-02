// WidgetGenAppKit — macOS AppKit widget generation provider
// Produces NSView subclasses with configure methods, target-action wiring,
// accessibility roles, and anatomy factories using APPKIT_WIDGET_MAP.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import { APPKIT_WIDGET_MAP } from './appkit-adapter.handler';
import type { WidgetMapping } from './appkit-adapter.handler';

let idCounter = 0;
function nextId(): string { return `widget-gen-appkit-${++idCounter}`; }

function toSwiftType(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Bool';
    case 'int': case 'integer': return 'Int';
    default: return 'Any';
  }
}

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

  for (const p of props) {
    lines.push(`    var ${p.name}: ${toSwiftType(p.type)}`);
  }

  if (props.length > 0) lines.push('');

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

export const widgetGenAppKitHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:appkit';

    const existing = await storage.find('widget-gen-appkit', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-appkit', id, { id, providerRef, target: 'appkit' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'appkit',
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

    const widgetType = (ast.widget as string) || (ast.type as string) || '';
    const mapKey = widgetType.replace(/[-_\s]/g, '').toLowerCase();
    const mapping: WidgetMapping | undefined = mapKey ? APPKIT_WIDGET_MAP[mapKey] : undefined;

    const output = generateAppKit(componentName, props, mapping);

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenAppKitCounter(): void { idCounter = 0; }
