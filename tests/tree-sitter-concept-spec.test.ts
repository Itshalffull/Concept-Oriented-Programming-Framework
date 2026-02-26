// ============================================================
// TreeSitterConceptSpec Handler Tests
//
// Tree-sitter grammar provider for Clef concept spec files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterConceptSpecHandler,
  resetTreeSitterConceptSpecCounter,
} from '../handlers/ts/tree-sitter-concept-spec.handler.js';

describe('TreeSitterConceptSpec', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterConceptSpecCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for concept-spec language', async () => {
      const result = await treeSitterConceptSpecHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterConceptSpecHandler.initialize!({}, storage);
      const second = await treeSitterConceptSpecHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses a concept declaration', async () => {
      const source = `concept Todo {
  state {
    items: set String
  }
  actions {
    action add(title: String) {
      -> ok(item: String) {
    }
  }
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      expect(tree.type).toBe('source_file');
      const conceptDecl = tree.children.find((c: any) => c.type === 'concept_declaration');
      expect(conceptDecl).toBeDefined();
      const nameNode = conceptDecl.children.find((c: any) => c.type === 'concept_name');
      expect(nameNode.text).toBe('Todo');
    });

    it('parses annotations', async () => {
      const source = `@version(2)
@gate
concept Gated {
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const annotations = tree.children.filter((c: any) => c.type === 'annotation');
      expect(annotations.length).toBe(2);
      expect(annotations[0].text).toBe('@version(2)');
      expect(annotations[1].text).toBe('@gate');
    });

    it('parses state fields', async () => {
      const source = `concept Counter {
  state {
    count: Int
    label: String
  }
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const concept = tree.children.find((c: any) => c.type === 'concept_declaration');
      const stateSection = concept.children.find((c: any) => c.type === 'state_section');
      expect(stateSection).toBeDefined();
      expect(stateSection.children.length).toBe(2);
      expect(stateSection.children[0].type).toBe('state_field');
    });

    it('parses action declarations with parameters', async () => {
      const source = `concept Auth {
  actions {
    action login(email: String, password: String) {
      -> ok(token: String) {
      -> invalidCredentials() {
    }
  }
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const concept = tree.children.find((c: any) => c.type === 'concept_declaration');
      const actionsSection = concept.children.find((c: any) => c.type === 'actions_section');
      expect(actionsSection).toBeDefined();
      const actionDecl = actionsSection.children.find((c: any) => c.type === 'action_declaration');
      expect(actionDecl).toBeDefined();
      const actionName = actionDecl.children.find((c: any) => c.type === 'action_name');
      expect(actionName.text).toBe('login');
      // Check parameters
      const params = actionDecl.children.filter((c: any) => c.type === 'parameter');
      expect(params.length).toBe(2);
    });

    it('parses variant arrows', async () => {
      const source = `concept Auth {
  actions {
    action login(email: String) {
      -> ok(token: String) {
      -> denied(reason: String) {
    }
  }
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const concept = tree.children.find((c: any) => c.type === 'concept_declaration');
      const actions = concept.children.find((c: any) => c.type === 'actions_section');
      const action = actions.children.find((c: any) => c.type === 'action_declaration');
      const variants = action.children.filter((c: any) => c.type === 'variant');
      expect(variants.length).toBe(2);
    });

    it('parses type parameters on concept', async () => {
      const source = `concept Collection[T] {
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const concept = tree.children.find((c: any) => c.type === 'concept_declaration');
      const typeParams = concept.children.find((c: any) => c.type === 'type_params');
      expect(typeParams).toBeDefined();
      expect(typeParams.text).toBe('T');
    });

    it('parses capabilities section', async () => {
      const source = `concept SecureVault {
  capabilities {
    requires encryption
    requires authentication
  }
}`;
      const result = await treeSitterConceptSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const concept = tree.children.find((c: any) => c.type === 'concept_declaration');
      const caps = concept.children.find((c: any) => c.type === 'capabilities_section');
      expect(caps).toBeDefined();
      expect(caps.children.length).toBe(2);
      expect(caps.children[0].type).toBe('capability');
    });
  });

  describe('highlight', () => {
    it('identifies keyword highlights in concept spec source', async () => {
      const source = `concept Todo {
  state {
    items: set String
  }
}`;
      const result = await treeSitterConceptSpecHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      expect(highlights.length).toBeGreaterThan(0);
      const keywordHighlights = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(keywordHighlights.length).toBeGreaterThan(0);
    });

    it('identifies annotation highlights', async () => {
      const source = `@version(1)
concept Foo {
}`;
      const result = await treeSitterConceptSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const annoHighlights = highlights.filter((h: any) => h.tokenType === 'annotation');
      expect(annoHighlights.length).toBeGreaterThan(0);
    });

    it('identifies type name highlights', async () => {
      const source = `concept Foo {
  state {
    name: String
    count: Int
  }
}`;
      const result = await treeSitterConceptSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const typeHighlights = highlights.filter((h: any) => h.tokenType === 'type');
      expect(typeHighlights.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for concept declarations', async () => {
      const source = `concept A {
}
concept B {
}`;
      const result = await treeSitterConceptSpecHandler.query!(
        { pattern: '(concept_declaration)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });

    it('queries for action names', async () => {
      const source = `concept Todo {
  actions {
    action add(title: String) {
    }
    action remove(id: String) {
    }
  }
}`;
      const result = await treeSitterConceptSpecHandler.query!(
        { pattern: '(action_name)', source },
        storage,
      );
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
      expect(matches[0].text).toBe('add');
      expect(matches[1].text).toBe('remove');
    });
  });

  describe('register', () => {
    it('returns concept-spec language registration info', async () => {
      const result = await treeSitterConceptSpecHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('concept-spec');
      expect(result.grammarVersion).toBe('1.0.0');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.concept');
    });
  });
});
