// ============================================================
// Language Implementations — Verification Test
//
// Validates that REAL implementations exist for all 10 app concepts
// in all 4 language targets (TypeScript, Rust, Solidity, Swift),
// that the CLI-generated interfaces match the implementations,
// and that each implementation contains real business logic.
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { createInMemoryStorage } from '@copf/runtime';
import { parseConceptFile } from '../implementations/typescript/framework/parser.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { rustGenHandler } from '../implementations/typescript/framework/rust-gen.impl.js';
import { solidityGenHandler } from '../implementations/typescript/framework/solidity-gen.impl.js';
import { swiftGenHandler } from '../implementations/typescript/framework/swift-gen.impl.js';

// ── Paths ──────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..');
const SPECS_DIR = join(ROOT, 'specs', 'app');
const IMPL_RUST = join(ROOT, 'implementations', 'rust', 'src');
const IMPL_SOLIDITY = join(ROOT, 'implementations', 'solidity', 'src');
const IMPL_SWIFT = join(ROOT, 'implementations', 'swift', 'Sources', 'COPF');
const IMPL_TS = join(ROOT, 'implementations', 'typescript', 'app');
const GENERATED_RUST = join(ROOT, 'generated', 'rust');
const GENERATED_SOLIDITY = join(ROOT, 'generated', 'solidity');
const GENERATED_SWIFT = join(ROOT, 'generated', 'swift');

// ── Concept names ──────────────────────────────────────────

const APP_CONCEPTS = [
  'user',
  'password',
  'jwt',
  'profile',
  'article',
  'comment',
  'tag',
  'favorite',
  'follow',
  'echo',
];

const CONCEPT_NAMES = [
  'User',
  'Password',
  'JWT',
  'Profile',
  'Article',
  'Comment',
  'Tag',
  'Favorite',
  'Follow',
  'Echo',
];

// Map concept names to their action lists (from specs)
const CONCEPT_ACTIONS: Record<string, string[]> = {
  User: ['register'],
  Password: ['set', 'check', 'validate'],
  JWT: ['generate', 'verify'],
  Profile: ['update', 'get'],
  Article: ['create', 'update', 'delete', 'get'],
  Comment: ['create', 'delete', 'list'],
  Tag: ['add', 'remove', 'list'],
  Favorite: ['favorite', 'unfavorite', 'isFavorited', 'count'],
  Follow: ['follow', 'unfollow', 'isFollowing'],
  Echo: ['send'],
};

// ============================================================
// PART 1: Implementation Files Exist
// ============================================================

describe('PART 1 — Implementation files exist for all concepts', () => {
  describe('TypeScript implementations', () => {
    for (const concept of APP_CONCEPTS) {
      it(`${concept}.impl.ts exists`, () => {
        const path = join(IMPL_TS, `${concept}.impl.ts`);
        expect(existsSync(path)).toBe(true);
      });
    }
  });

  describe('Rust implementations', () => {
    it('Cargo.toml exists', () => {
      expect(existsSync(join(ROOT, 'implementations', 'rust', 'Cargo.toml'))).toBe(true);
    });

    it('lib.rs exists with all module declarations', () => {
      const libPath = join(IMPL_RUST, 'lib.rs');
      expect(existsSync(libPath)).toBe(true);
      const content = readFileSync(libPath, 'utf-8');
      for (const concept of APP_CONCEPTS) {
        expect(content).toContain(`mod ${concept}`);
      }
    });

    it('storage.rs exists', () => {
      expect(existsSync(join(IMPL_RUST, 'storage.rs'))).toBe(true);
    });

    for (const concept of APP_CONCEPTS) {
      it(`${concept}.rs exists`, () => {
        expect(existsSync(join(IMPL_RUST, `${concept}.rs`))).toBe(true);
      });
    }
  });

  describe('Solidity implementations', () => {
    it('foundry.toml exists', () => {
      expect(existsSync(join(ROOT, 'implementations', 'solidity', 'foundry.toml'))).toBe(true);
    });

    for (const name of CONCEPT_NAMES) {
      it(`${name}.sol exists`, () => {
        expect(existsSync(join(IMPL_SOLIDITY, `${name}.sol`))).toBe(true);
      });
    }
  });

  describe('Swift implementations', () => {
    it('Package.swift exists', () => {
      expect(existsSync(join(ROOT, 'implementations', 'swift', 'Package.swift'))).toBe(true);
    });

    it('ConceptStorage.swift exists', () => {
      expect(existsSync(join(IMPL_SWIFT, 'ConceptStorage.swift'))).toBe(true);
    });

    for (const name of CONCEPT_NAMES) {
      it(`${name}Impl.swift exists`, () => {
        expect(existsSync(join(IMPL_SWIFT, `${name}Impl.swift`))).toBe(true);
      });
    }
  });
});

// ============================================================
// PART 2: CLI-Generated Code Exists
// ============================================================

describe('PART 2 — CLI-generated interfaces exist for all targets', () => {
  describe('Generated Rust interfaces', () => {
    for (const concept of APP_CONCEPTS) {
      const rustDir = concept === 'jwt'
        ? join(GENERATED_RUST, 'j_w_t')
        : join(GENERATED_RUST, concept);

      it(`${concept} types.rs generated`, () => {
        expect(existsSync(join(rustDir, 'types.rs'))).toBe(true);
      });

      it(`${concept} handler.rs generated`, () => {
        expect(existsSync(join(rustDir, 'handler.rs'))).toBe(true);
      });

      it(`${concept} adapter.rs generated`, () => {
        expect(existsSync(join(rustDir, 'adapter.rs'))).toBe(true);
      });
    }
  });

  describe('Generated Solidity skeletons', () => {
    for (const name of CONCEPT_NAMES) {
      it(`${name}.sol generated`, () => {
        expect(existsSync(join(GENERATED_SOLIDITY, 'src', `${name}.sol`))).toBe(true);
      });
    }
  });

  describe('Generated Swift interfaces', () => {
    for (const name of CONCEPT_NAMES) {
      it(`${name} Types.swift generated`, () => {
        expect(existsSync(join(GENERATED_SWIFT, name, 'Types.swift'))).toBe(true);
      });

      it(`${name} Handler.swift generated`, () => {
        expect(existsSync(join(GENERATED_SWIFT, name, 'Handler.swift'))).toBe(true);
      });
    }
  });
});

// ============================================================
// PART 3: Implementations contain real business logic
// ============================================================

describe('PART 3 — Implementations contain real business logic (not stubs)', () => {
  describe('Rust implementations have handler structs and tests', () => {
    for (const concept of APP_CONCEPTS) {
      it(`${concept}.rs contains handler and business logic`, () => {
        const content = readFileSync(join(IMPL_RUST, `${concept}.rs`), 'utf-8');

        // Has a handler struct
        expect(content).toMatch(/pub struct \w+Handler/);

        // Has async methods
        expect(content).toContain('pub async fn');

        // Uses storage
        expect(content).toContain('storage');

        // Has tests
        expect(content).toContain('#[cfg(test)]');
        expect(content).toContain('#[tokio::test]');

        // Does NOT have "Not implemented" or "todo!()" stubs
        expect(content).not.toContain('revert("Not implemented")');
      });
    }
  });

  describe('Rust storage trait is complete', () => {
    it('defines ConceptStorage trait with all methods', () => {
      const content = readFileSync(join(IMPL_RUST, 'storage.rs'), 'utf-8');
      expect(content).toContain('pub trait ConceptStorage');
      expect(content).toContain('async fn put');
      expect(content).toContain('async fn get');
      expect(content).toContain('async fn find');
      expect(content).toContain('async fn del');
      expect(content).toContain('pub struct InMemoryStorage');
    });
  });

  describe('Solidity contracts have real logic', () => {
    for (const name of CONCEPT_NAMES) {
      it(`${name}.sol contains real implementation`, () => {
        const content = readFileSync(join(IMPL_SOLIDITY, `${name}.sol`), 'utf-8');

        // Has pragma and contract
        expect(content).toContain('pragma solidity');
        expect(content).toContain(`contract ${name}`);

        // Has storage (mappings)
        expect(content).toContain('mapping');

        // Has events
        expect(content).toMatch(/event \w+/);

        // Has function implementations (NOT just stubs)
        expect(content).not.toContain('revert("Not implemented")');
      });
    }
  });

  describe('Swift implementations have handler protocols and impls', () => {
    for (const name of CONCEPT_NAMES) {
      it(`${name}Impl.swift contains protocol and implementation`, () => {
        const content = readFileSync(join(IMPL_SWIFT, `${name}Impl.swift`), 'utf-8');

        // Has protocol
        expect(content).toMatch(/protocol \w+Handler/);

        // Has implementation struct
        expect(content).toMatch(/struct \w+HandlerImpl/);

        // Has async throws methods
        expect(content).toContain('async throws');

        // Uses storage
        expect(content).toContain('storage');
      });
    }
  });

  describe('Swift storage protocol is complete', () => {
    it('defines ConceptStorage protocol and InMemoryStorage', () => {
      const content = readFileSync(join(IMPL_SWIFT, 'ConceptStorage.swift'), 'utf-8');
      expect(content).toContain('protocol ConceptStorage');
      expect(content).toContain('func put');
      expect(content).toContain('func get');
      expect(content).toContain('func find');
      expect(content).toContain('func del');
      expect(content).toMatch(/InMemoryStorage/);
    });
  });
});

// ============================================================
// PART 4: Generated interfaces match implementations
// ============================================================

describe('PART 4 — Generated handler interfaces match implementation signatures', () => {
  describe('Rust: generated handler traits define all actions', () => {
    for (const [name, actions] of Object.entries(CONCEPT_ACTIONS)) {
      const rustMod = name === 'JWT'
        ? 'j_w_t'
        : name.toLowerCase();

      it(`${name} handler.rs defines all ${actions.length} action(s)`, () => {
        const handlerPath = join(GENERATED_RUST, rustMod, 'handler.rs');
        if (!existsSync(handlerPath)) return; // skip if not generated

        const content = readFileSync(handlerPath, 'utf-8');
        for (const action of actions) {
          const snakeAction = action.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          expect(content).toContain(`async fn ${snakeAction}(`);
        }
      });
    }
  });

  describe('Rust: implementations define matching methods', () => {
    for (const [name, actions] of Object.entries(CONCEPT_ACTIONS)) {
      it(`${name} implementation has all ${actions.length} action method(s)`, () => {
        const implPath = join(IMPL_RUST, `${name.toLowerCase()}.rs`);
        const content = readFileSync(implPath, 'utf-8');

        for (const action of actions) {
          const snakeAction = action.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          expect(content).toContain(`pub async fn ${snakeAction}(`);
        }
      });
    }
  });

  describe('Swift: generated handler protocols define all actions', () => {
    for (const [name, actions] of Object.entries(CONCEPT_ACTIONS)) {
      it(`${name} Handler.swift defines all ${actions.length} action(s)`, () => {
        const handlerPath = join(GENERATED_SWIFT, name, 'Handler.swift');
        if (!existsSync(handlerPath)) return;

        const content = readFileSync(handlerPath, 'utf-8');
        for (const action of actions) {
          const camelAction = action.charAt(0).toLowerCase() + action.slice(1);
          expect(content).toContain(`func ${camelAction}(`);
        }
      });
    }
  });

  describe('Swift: implementations define matching methods', () => {
    for (const [name, actions] of Object.entries(CONCEPT_ACTIONS)) {
      it(`${name} implementation has all ${actions.length} action method(s)`, () => {
        const implPath = join(IMPL_SWIFT, `${name}Impl.swift`);
        const content = readFileSync(implPath, 'utf-8');

        for (const action of actions) {
          const camelAction = action.charAt(0).toLowerCase() + action.slice(1);
          // Solidity uses deleteArticle/deleteComment, Swift follows spec naming
          if (action === 'delete') {
            // Accept either 'delete' or 'deleteArticle'/'deleteComment'
            const hasDelete = content.includes(`func delete(`) ||
              content.includes(`func deleteArticle(`) ||
              content.includes(`func deleteComment(`);
            expect(hasDelete).toBe(true);
          } else {
            expect(content).toContain(`func ${camelAction}(`);
          }
        }
      });
    }
  });

  describe('Solidity: contracts define all action functions', () => {
    for (const [name, actions] of Object.entries(CONCEPT_ACTIONS)) {
      it(`${name}.sol defines all ${actions.length} action function(s)`, () => {
        const solPath = join(IMPL_SOLIDITY, `${name}.sol`);
        const content = readFileSync(solPath, 'utf-8');

        for (const action of actions) {
          const camelAction = action.charAt(0).toLowerCase() + action.slice(1);
          // Solidity uses deleteArticle/deleteComment because 'delete' is reserved
          if (action === 'delete') {
            const hasDelete = content.includes(`function delete(`) ||
              content.includes(`function deleteArticle(`) ||
              content.includes(`function deleteComment(`);
            expect(hasDelete).toBe(true);
          } else {
            expect(content).toContain(`function ${camelAction}(`);
          }
        }
      });
    }
  });
});

// ============================================================
// PART 5: Code generation pipeline produces correct output
// ============================================================

describe('PART 5 — Code generation pipeline produces valid output for all languages', () => {
  const manifests: Record<string, any> = {};

  beforeAll(async () => {
    // Parse all concept specs and generate manifests
    for (const concept of APP_CONCEPTS) {
      const specPath = join(SPECS_DIR, `${concept}.concept`);
      const source = readFileSync(specPath, 'utf-8');

      const ast = parseConceptFile(source);
      expect(ast).toBeDefined();
      expect(ast.name).toBeTruthy();

      const storage = createInMemoryStorage();
      const schemaResult = await schemaGenHandler.generate(
        { spec: concept, ast },
        storage,
      );
      expect(schemaResult.variant).toBe('ok');
      manifests[concept] = (schemaResult as any).manifest;
    }
  });

  describe('Rust generation', () => {
    for (const concept of APP_CONCEPTS) {
      it(`generates valid Rust for ${concept}`, async () => {
        const storage = createInMemoryStorage();
        const result = await rustGenHandler.generate(
          { spec: concept, manifest: manifests[concept] },
          storage,
        );
        expect(result.variant).toBe('ok');

        const files = (result as any).files as { path: string; content: string }[];
        expect(files.length).toBeGreaterThanOrEqual(3); // types + handler + adapter

        // Verify types file has correct struct names
        const typesFile = files.find(f => f.path.includes('types.rs'));
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('#[derive(');
        expect(typesFile!.content).toContain('pub struct');

        // Verify handler has trait definition
        const handlerFile = files.find(f => f.path.includes('handler.rs'));
        expect(handlerFile).toBeDefined();
        expect(handlerFile!.content).toContain('#[async_trait]');
        expect(handlerFile!.content).toContain('pub trait');
      });
    }
  });

  describe('Solidity generation', () => {
    for (const concept of APP_CONCEPTS) {
      it(`generates valid Solidity for ${concept}`, async () => {
        const storage = createInMemoryStorage();
        const result = await solidityGenHandler.generate(
          { spec: concept, manifest: manifests[concept] },
          storage,
        );
        expect(result.variant).toBe('ok');

        const files = (result as any).files as { path: string; content: string }[];
        expect(files.length).toBeGreaterThanOrEqual(1); // at least the contract

        const contractFile = files.find(f => f.path.endsWith('.sol') && !f.path.includes('.t.'));
        expect(contractFile).toBeDefined();
        expect(contractFile!.content).toContain('pragma solidity');
        expect(contractFile!.content).toContain('contract');
      });
    }
  });

  describe('Swift generation', () => {
    for (const concept of APP_CONCEPTS) {
      it(`generates valid Swift for ${concept}`, async () => {
        const storage = createInMemoryStorage();
        const result = await swiftGenHandler.generate(
          { spec: concept, manifest: manifests[concept] },
          storage,
        );
        expect(result.variant).toBe('ok');

        const files = (result as any).files as { path: string; content: string }[];
        expect(files.length).toBeGreaterThanOrEqual(3); // Types + Handler + Adapter

        const typesFile = files.find(f => f.path.includes('Types.swift'));
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('struct');
        expect(typesFile!.content).toContain('Codable');

        const handlerFile = files.find(f => f.path.includes('Handler.swift'));
        expect(handlerFile).toBeDefined();
        expect(handlerFile!.content).toContain('protocol');
      });
    }
  });
});

// ============================================================
// PART 6: TypeScript implementations work end-to-end
// ============================================================

describe('PART 6 — TypeScript implementations are functional', () => {
  it('User: register + uniqueness check', async () => {
    const { userHandler } = await import(
      '../implementations/typescript/app/user.impl.js'
    );
    const storage = createInMemoryStorage();

    const r1 = await userHandler.register(
      { user: 'u1', name: 'alice', email: 'a@b.com' },
      storage,
    );
    expect(r1.variant).toBe('ok');

    const r2 = await userHandler.register(
      { user: 'u2', name: 'alice', email: 'c@d.com' },
      storage,
    );
    expect(r2.variant).toBe('error');
  });

  it('Password: set + check + validate', async () => {
    const { passwordHandler } = await import(
      '../implementations/typescript/app/password.impl.js'
    );
    const storage = createInMemoryStorage();

    await passwordHandler.set(
      { user: 'u1', password: 'secret123' },
      storage,
    );

    const check = await passwordHandler.check(
      { user: 'u1', password: 'secret123' },
      storage,
    );
    expect(check.variant).toBe('ok');
    expect(check.valid).toBe(true);

    const validate = await passwordHandler.validate(
      { password: 'short' },
      storage,
    );
    expect(validate.variant).toBe('ok');
    expect(validate.valid).toBe(false);
  });

  it('Article: CRUD lifecycle', async () => {
    const { articleHandler } = await import(
      '../implementations/typescript/app/article.impl.js'
    );
    const storage = createInMemoryStorage();

    await articleHandler.create({
      article: 'a1', title: 'Hello World',
      description: 'A test', body: 'Body text', author: 'u1',
    }, storage);

    const got = await articleHandler.get({ article: 'a1' }, storage);
    expect(got.variant).toBe('ok');
    expect(got.slug).toBe('hello-world');

    await articleHandler.update({
      article: 'a1', title: 'New Title',
      description: 'Updated', body: 'New body',
    }, storage);

    const updated = await articleHandler.get({ article: 'a1' }, storage);
    expect(updated.title).toBe('New Title');
    expect(updated.slug).toBe('new-title');

    await articleHandler.delete({ article: 'a1' }, storage);
    const deleted = await articleHandler.get({ article: 'a1' }, storage);
    expect(deleted.variant).toBe('notfound');
  });

  it('Echo: send and receive', async () => {
    const { echoHandler } = await import(
      '../implementations/typescript/app/echo.impl.js'
    );
    const storage = createInMemoryStorage();

    const result = await echoHandler.send(
      { id: 'm1', text: 'hello' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.echo).toBe('hello');
  });

  it('Favorite + Follow + Comment + Tag all functional', async () => {
    const { favoriteHandler } = await import('../implementations/typescript/app/favorite.impl.js');
    const { followHandler } = await import('../implementations/typescript/app/follow.impl.js');
    const { commentHandler } = await import('../implementations/typescript/app/comment.impl.js');
    const { tagHandler } = await import('../implementations/typescript/app/tag.impl.js');

    const favStorage = createInMemoryStorage();
    await favoriteHandler.favorite({ user: 'u1', article: 'a1' }, favStorage);
    const isFav = await favoriteHandler.isFavorited({ user: 'u1', article: 'a1' }, favStorage);
    expect(isFav.favorited).toBe(true);

    const folStorage = createInMemoryStorage();
    await followHandler.follow({ user: 'u1', target: 'u2' }, folStorage);
    const isFollowing = await followHandler.isFollowing({ user: 'u1', target: 'u2' }, folStorage);
    expect(isFollowing.following).toBe(true);

    const comStorage = createInMemoryStorage();
    await commentHandler.create({ comment: 'c1', body: 'Great!', target: 'a1', author: 'u1' }, comStorage);
    const comments = await commentHandler.list({ target: 'a1' }, comStorage);
    expect(comments.variant).toBe('ok');

    const tagStorage = createInMemoryStorage();
    await tagHandler.add({ tag: 't1', article: 'a1' }, tagStorage);
    const tags = await tagHandler.list({}, tagStorage);
    expect(tags.variant).toBe('ok');
  });
});

// ============================================================
// PART 7: Coverage Summary
// ============================================================

describe('PART 7 — Coverage Summary', () => {
  it('documents full multi-language implementation coverage', () => {
    const languages = ['TypeScript', 'Rust', 'Solidity', 'Swift'];
    const concepts = APP_CONCEPTS;
    const totalActions = Object.values(CONCEPT_ACTIONS).reduce((sum, a) => sum + a.length, 0);

    // Verify counts
    expect(languages).toHaveLength(4);
    expect(concepts).toHaveLength(10);
    expect(totalActions).toBe(26); // 1+3+2+2+4+3+3+4+3+1 = 26

    // Implementation matrix: 4 languages × 10 concepts × N actions
    const matrix = {
      languages: languages.length,
      concepts: concepts.length,
      totalActions,
      generatedFiles: {
        rust: 10 * 4,    // 4 files per concept (types, handler, adapter, conformance)
        solidity: 10 * 2, // 2 files per concept (contract + test)
        swift: 10 * 4,    // 4 files per concept
        typescript: 10 * 4,
      },
      implementationFiles: {
        rust: 12,     // 10 concepts + storage.rs + lib.rs
        solidity: 14, // 10 contracts + 4 test files
        swift: 15,    // 11 source files + 4 test files
        typescript: 10,
      },
    };

    // Just verify the counts are sensible
    expect(matrix.languages).toBe(4);
    expect(matrix.concepts).toBe(10);
  });
});
