// generated/tests/entity-all-content.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\entity-all-content.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: entity-all-content', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "entity-all-content-dataSource", {"name":"entity-all-content-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "entity-all-content-presentation", {"name":"entity-all-content-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "entity-all-content-filter", {"name":"entity-all-content-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "entity-all-content-sort", {"name":"entity-all-content-sort","keys":"[]"});
    await storage.put("projection", "entity-all-content-projection", {"name":"entity-all-content-projection","fields":"[{\"key\":\"node\",\"label\":\"Entity\"},{\"key\":\"schemas\",\"label\":\"Schemas\"}]"});
    await storage.put("pagination", "entity-all-content-pagination", {"name":"entity-all-content-pagination","mode":"offset","pageSize":"25"});
    await storage.put('view', "entity-all-content", {"name":"entity-all-content","title":"entity-all-content","description":"","dataSource":"entity-all-content-dataSource","filter":"entity-all-content-filter","sort":"entity-all-content-sort","group":"","projection":"entity-all-content-projection","presentation":"entity-all-content-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\",\"pagination\"]","pagination":"entity-all-content-pagination"});
    analysis = await compileAndAnalyze("entity-all-content", storage);
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
