// WidgetGenVanilla — Vanilla Web Components widget generation provider
// Produces HTMLElement subclasses registered via customElements.define.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-vanilla-${++idCounter}`; }

function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

export const widgetGenVanillaHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:vanilla';

    const existing = await storage.find('widget-gen-vanilla', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-vanilla', id, { id, providerRef, target: 'vanilla' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'vanilla',
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
    const tagName = `x-${toKebabCase(componentName)}`;
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const observedAttrs = props.map(p => `'${p.name}'`).join(', ');
    const getters = props.map(p =>
      `  get ${p.name}(): ${p.type || 'string'} {\n    return this.getAttribute('${p.name}') ?? '';\n  }`
    ).join('\n\n');

    const output = `class ${componentName} extends HTMLElement {\n  static get observedAttributes() {\n    return [${observedAttrs}];\n  }\n\n  constructor() {\n    super();\n    this.attachShadow({ mode: 'open' });\n  }\n\n${getters}\n\n  connectedCallback() {\n    this.render();\n  }\n\n  attributeChangedCallback() {\n    this.render();\n  }\n\n  private render() {\n    this.shadowRoot!.innerHTML = \`<div>${componentName}</div>\`;\n  }\n}\n\ncustomElements.define('${tagName}', ${componentName});`;

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenVanillaCounter(): void { idCounter = 0; }
