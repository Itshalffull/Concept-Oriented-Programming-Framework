// generated/tests/dashboard-concepts.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\dashboard-concepts.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: dashboard-concepts', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "dashboard-concepts-dataSource", {"name":"dashboard-concepts-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Concept\"}}"});
    await storage.put("presentation", "dashboard-concepts-presentation", {"name":"dashboard-concepts-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "dashboard-concepts-sort", {"name":"dashboard-concepts-sort","keys":"[]"});
    await storage.put("projection", "dashboard-concepts-projection", {"name":"dashboard-concepts-projection","fields":"[{\"key\":\"node\",\"label\":\"Concept\"},{\"key\":\"schemas\",\"label\":\"Schemas\"},{\"key\":\"createdBy\",\"label\":\"Source\"}]"});
    await storage.put('view', "dashboard-concepts", {"name":"dashboard-concepts","title":"dashboard-concepts","description":"","dataSource":"dashboard-concepts-dataSource","filter":"","sort":"dashboard-concepts-sort","group":"","projection":"dashboard-concepts-projection","presentation":"dashboard-concepts-presentation","interaction":"","features":"[\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("dashboard-concepts", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });
  });
});
