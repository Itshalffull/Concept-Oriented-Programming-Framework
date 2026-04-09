// generated/tests/entity-content.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\entity-content.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: entity-content', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "entity-content-dataSource", {"name":"entity-content-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"get\",\"params\":{\"node\":\"{{entityId}}\"}}"});
    await storage.put("presentation", "entity-content-presentation", {"name":"entity-content-presentation","displayType":"content-body","hints":"{}"});
    await storage.put("projection", "entity-content-projection", {"name":"entity-content-projection","fields":"[{\"key\":\"content\",\"label\":\"Content\"}]"});
    await storage.put('view', "entity-content", {"name":"entity-content","title":"entity-content","description":"","dataSource":"entity-content-dataSource","filter":"","sort":"","group":"","projection":"entity-content-projection","presentation":"entity-content-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("entity-content", storage);
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
