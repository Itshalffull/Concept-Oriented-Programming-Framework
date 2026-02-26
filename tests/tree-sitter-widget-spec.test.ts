// ============================================================
// TreeSitterWidgetSpec Handler Tests
//
// Tree-sitter grammar provider for COIF widget spec files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterWidgetSpecHandler,
  resetTreeSitterWidgetSpecCounter,
} from '../handlers/ts/tree-sitter-widget-spec.handler.js';

describe('TreeSitterWidgetSpec', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterWidgetSpecCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for widget-spec language', async () => {
      const result = await treeSitterWidgetSpecHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterWidgetSpecHandler.initialize!({}, storage);
      const second = await treeSitterWidgetSpecHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses a widget declaration with anatomy section', async () => {
      const source = `widget Button {
  anatomy {
    part Root {
      role: "button"
    }
    part Label {
      role: "label"
    }
  }
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      const widgetDecl = tree.children.find((c: any) => c.type === 'widget_declaration');
      expect(widgetDecl).toBeDefined();
      const widgetName = widgetDecl.children.find((c: any) => c.type === 'widget_name');
      expect(widgetName.text).toBe('Button');
      const anatomySection = widgetDecl.children.find((c: any) => c.type === 'anatomy_section');
      expect(anatomySection).toBeDefined();
      const parts = anatomySection.children.filter((c: any) => c.type === 'part_definition');
      expect(parts.length).toBe(2);
    });

    it('parses states section with FSM transitions', async () => {
      const source = `widget Toggle {
  states {
    initial state Off {
      on Press -> On
    }
    state On {
      on Press -> Off
    }
  }
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const widgetDecl = tree.children.find((c: any) => c.type === 'widget_declaration');
      const statesSection = widgetDecl.children.find((c: any) => c.type === 'states_section');
      expect(statesSection).toBeDefined();
      const stateDefs = statesSection.children.filter((c: any) => c.type === 'state_definition');
      expect(stateDefs.length).toBe(2);
      // Check initial modifier
      const offState = stateDefs[0];
      const initialMod = offState.children.find((c: any) => c.type === 'initial_modifier');
      expect(initialMod).toBeDefined();
      // Check transition
      const transition = offState.children.find((c: any) => c.type === 'transition');
      expect(transition).toBeDefined();
    });

    it('parses props section with default values', async () => {
      const source = `widget Input {
  props {
    label: String
    maxLength: Int = 100
    disabled: Boolean = false
  }
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const widgetDecl = tree.children.find((c: any) => c.type === 'widget_declaration');
      const propsSection = widgetDecl.children.find((c: any) => c.type === 'props_section');
      expect(propsSection).toBeDefined();
      const propDefs = propsSection.children.filter((c: any) => c.type === 'prop_definition');
      expect(propDefs.length).toBe(3);
      // Check default value on maxLength
      const maxLengthProp = propDefs[1];
      const defaultVal = maxLengthProp.children.find((c: any) => c.type === 'default_value');
      expect(defaultVal).toBeDefined();
      expect(defaultVal.text).toBe('100');
    });

    it('parses accessibility section', async () => {
      const source = `widget Dialog {
  accessibility {
    role: "dialog"
    aria-modal: "true"
    label: "Confirmation dialog"
  }
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const widgetDecl = tree.children.find((c: any) => c.type === 'widget_declaration');
      const a11ySection = widgetDecl.children.find((c: any) => c.type === 'accessibility_section');
      expect(a11ySection).toBeDefined();
      const attrs = a11ySection.children.filter((c: any) => c.type === 'accessibility_attribute');
      expect(attrs.length).toBe(3);
    });

    it('parses connect section with direction arrows', async () => {
      const source = `widget TodoItem {
  connect {
    checked <-> Todo.completed
    label <- Todo.title
    onRemove -> Todo.remove
  }
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const widgetDecl = tree.children.find((c: any) => c.type === 'widget_declaration');
      const connectSection = widgetDecl.children.find((c: any) => c.type === 'connect_section');
      expect(connectSection).toBeDefined();
      const connections = connectSection.children.filter((c: any) => c.type === 'connection');
      expect(connections.length).toBe(3);
    });

    it('parses annotations on widgets', async () => {
      const source = `@version(1)
widget MyWidget {
}`;
      const result = await treeSitterWidgetSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const annotations = tree.children.filter((c: any) => c.type === 'annotation');
      expect(annotations.length).toBe(1);
    });
  });

  describe('highlight', () => {
    it('identifies widget keywords', async () => {
      const source = `widget Button {
  anatomy {
    part Root {
    }
  }
}`;
      const result = await treeSitterWidgetSpecHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const keywords = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('identifies operator arrow highlights', async () => {
      const source = `widget W {
  connect {
    a <-> b
    c -> d
    e <- f
  }
}`;
      const result = await treeSitterWidgetSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const operators = highlights.filter((h: any) => h.tokenType === 'operator');
      expect(operators.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for widget declarations', async () => {
      const source = `widget A {
}
widget B {
}`;
      const result = await treeSitterWidgetSpecHandler.query!(
        { pattern: '(widget_declaration)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });

    it('queries for part definitions', async () => {
      const source = `widget Card {
  anatomy {
    part Header {
    }
    part Body {
    }
    part Footer {
    }
  }
}`;
      const result = await treeSitterWidgetSpecHandler.query!(
        { pattern: '(part_definition)', source },
        storage,
      );
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(3);
    });
  });

  describe('register', () => {
    it('returns widget-spec language registration info', async () => {
      const result = await treeSitterWidgetSpecHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('widget-spec');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.widget');
    });
  });
});
