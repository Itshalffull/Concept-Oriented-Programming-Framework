// generated/tests/entity-same-schema.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\entity-same-schema.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: entity-same-schema', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "entity-same-schema-dataSource", {"name":"entity-same-schema-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"{{entityPrimarySchema}}\"}}"});
    await storage.put("presentation", "entity-same-schema-presentation", {"name":"entity-same-schema-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "entity-same-schema-filter", {"name":"entity-same-schema-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "entity-same-schema-sort", {"name":"entity-same-schema-sort","keys":"[]"});
    await storage.put("projection", "entity-same-schema-projection", {"name":"entity-same-schema-projection","fields":"[{\"key\":\"node\",\"label\":\"Entity\"},{\"key\":\"schemas\",\"label\":\"Schemas\"},{\"key\":\"createdBy\",\"label\":\"Source\"}]"});
    await storage.put("pagination", "entity-same-schema-pagination", {"name":"entity-same-schema-pagination","mode":"offset","pageSize":"25"});
    await storage.put('view', "entity-same-schema", {"name":"entity-same-schema","title":"entity-same-schema","description":"","dataSource":"entity-same-schema-dataSource","filter":"entity-same-schema-filter","sort":"entity-same-schema-sort","group":"","projection":"entity-same-schema-projection","presentation":"entity-same-schema-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\",\"pagination\"]","pagination":"entity-same-schema-pagination"});
    analysis = await compileAndAnalyze("entity-same-schema", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: has pagination", () => {
    expect(analysis.enabledFeatures).toContain("pagination");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
