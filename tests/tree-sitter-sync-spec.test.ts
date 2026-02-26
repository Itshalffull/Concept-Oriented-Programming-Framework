// ============================================================
// TreeSitterSyncSpec Handler Tests
//
// Tree-sitter grammar provider for COPF sync spec files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterSyncSpecHandler,
  resetTreeSitterSyncSpecCounter,
} from '../implementations/typescript/tree-sitter-sync-spec.impl.js';

describe('TreeSitterSyncSpec', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterSyncSpecCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for sync-spec language', async () => {
      const result = await treeSitterSyncSpecHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterSyncSpecHandler.initialize!({}, storage);
      const second = await treeSitterSyncSpecHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses a sync declaration with when/then blocks', async () => {
      const source = `sync OrderPayment {
  when {
    Order.place(amount: $amount) -> ok(orderId: $id)
  }
  then {
    Payment.charge(amount: $amount, orderId: $id)
  }
}`;
      const result = await treeSitterSyncSpecHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      expect(tree.type).toBe('source_file');
      const syncDecl = tree.children.find((c: any) => c.type === 'sync_declaration');
      expect(syncDecl).toBeDefined();
      const syncName = syncDecl.children.find((c: any) => c.type === 'sync_name');
      expect(syncName.text).toBe('OrderPayment');
    });

    it('parses when clause with concept/action references', async () => {
      const source = `sync TestSync {
  when {
    Auth.login(email: $email) -> ok(token: $token)
  }
  then {
    Session.create(token: $token)
  }
}`;
      const result = await treeSitterSyncSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const syncDecl = tree.children.find((c: any) => c.type === 'sync_declaration');
      const whenBlock = syncDecl.children.find((c: any) => c.type === 'when_block');
      expect(whenBlock).toBeDefined();
      const whenClause = whenBlock.children.find((c: any) => c.type === 'when_clause');
      expect(whenClause).toBeDefined();
      const conceptRef = whenClause.children.find((c: any) => c.type === 'concept_ref');
      expect(conceptRef.text).toBe('Auth');
    });

    it('parses where block with let bindings and filters', async () => {
      const source = `sync EnrichedSync {
  when {
    Order.place(amount: $amount) -> ok(orderId: $id)
  }
  where {
    let $tax = $amount * 0.1
    filter $amount > 100
  }
  then {
    Invoice.create(orderId: $id, tax: $tax)
  }
}`;
      const result = await treeSitterSyncSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const syncDecl = tree.children.find((c: any) => c.type === 'sync_declaration');
      const whereBlock = syncDecl.children.find((c: any) => c.type === 'where_block');
      expect(whereBlock).toBeDefined();
      const letBind = whereBlock.children.find((c: any) => c.type === 'where_bind');
      expect(letBind).toBeDefined();
      const filterNode = whereBlock.children.find((c: any) => c.type === 'where_filter');
      expect(filterNode).toBeDefined();
    });

    it('parses annotations on sync specs', async () => {
      const source = `@priority(high)
@idempotent
sync CriticalSync {
  when {
    A.action() -> ok()
  }
  then {
    B.action()
  }
}`;
      const result = await treeSitterSyncSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const annotations = tree.children.filter((c: any) => c.type === 'annotation');
      expect(annotations.length).toBe(2);
    });

    it('parses then clause with field bindings', async () => {
      const source = `sync NotifySync {
  when {
    Order.complete(orderId: $id) -> ok()
  }
  then {
    Notification.send(recipient: $user, message: $msg)
  }
}`;
      const result = await treeSitterSyncSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const syncDecl = tree.children.find((c: any) => c.type === 'sync_declaration');
      const thenBlock = syncDecl.children.find((c: any) => c.type === 'then_block');
      expect(thenBlock).toBeDefined();
      const thenClause = thenBlock.children.find((c: any) => c.type === 'then_clause');
      expect(thenClause).toBeDefined();
    });
  });

  describe('highlight', () => {
    it('identifies sync keywords', async () => {
      const source = `sync Test {
  when {
  }
  then {
  }
}`;
      const result = await treeSitterSyncSpecHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const keywords = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('identifies variable highlights', async () => {
      const source = `sync Test {
  when {
    A.action(field: $value) -> ok()
  }
  then {
    B.action(field: $value)
  }
}`;
      const result = await treeSitterSyncSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const variables = highlights.filter((h: any) => h.tokenType === 'variable');
      expect(variables.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for sync declarations', async () => {
      const source = `sync A {
  when {
    X.action() -> ok()
  }
  then {
    Y.action()
  }
}
sync B {
  when {
    X.other() -> ok()
  }
  then {
    Z.action()
  }
}`;
      const result = await treeSitterSyncSpecHandler.query!(
        { pattern: '(sync_declaration)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });
  });

  describe('register', () => {
    it('returns sync-spec language registration info', async () => {
      const result = await treeSitterSyncSpecHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('sync-spec');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.sync');
    });
  });
});
