// WidgetGenWatchKit — Apple WatchKit widget generation provider
// Produces Swift WKInterfaceObject subclasses for watchOS.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-watchkit-${++idCounter}`; }

function toSwiftType(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Bool';
    case 'int': case 'integer': return 'Int';
    default: return 'Any';
  }
}

export const widgetGenWatchKitHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:watchkit';

    const existing = await storage.find('widget-gen-watchkit', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-watchkit', id, { id, providerRef, target: 'watchkit' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'watchkit',
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
    const swiftProps = props.map(p => `    var ${p.name}: ${toSwiftType(p.type)}`).join('\n');
    const initParams = props.map(p => `${p.name}: ${toSwiftType(p.type)}`).join(', ');
    const initAssignments = props.map(p => `        self.${p.name} = ${p.name}`).join('\n');

    const output = `import WatchKit\n\nclass ${componentName}: WKInterfaceObject {\n${swiftProps}\n\n    init(${initParams}) {\n${initAssignments}\n        super.init()\n    }\n}`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenWatchKitCounter(): void { idCounter = 0; }
