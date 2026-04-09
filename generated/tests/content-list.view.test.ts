// generated/tests/content-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\content-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: content-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "content-list-dataSource", {"name":"content-list-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Concept\"}}"});
    await storage.put("presentation", "content-list-presentation", {"name":"content-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "content-list-filter", {"name":"content-list-filter","node":"{\"type\":\"eq\",\"field\":\"kind\",\"value\":\"concept\"}"});
    await storage.put("sort", "content-list-sort", {"name":"content-list-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "content-list-projection", {"name":"content-list-projection","fields":"[{\"key\":\"id\",\"label\":\"ID\"},{\"key\":\"node\",\"label\":\"Node\"},{\"key\":\"kind\",\"label\":\"Kind\"},{\"key\":\"name\",\"label\":\"Name\"}]"});
    await storage.put('view', "content-list", {"name":"content-list","title":"content-list","description":"","dataSource":"content-list-dataSource","filter":"content-list-filter","sort":"content-list-sort","group":"","projection":"content-list-projection","presentation":"content-list-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("content-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: projects only known fields", () => {
    for (const f of analysis.projectedFields) {
      expect(["id", "node", "kind", "name"]).toContain(f);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
