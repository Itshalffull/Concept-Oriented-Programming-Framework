// generated/tests/deployment-overview.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\deployment-overview.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: deployment-overview', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "deployment-overview-dataSource", {"name":"deployment-overview-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"list\"}"});
    await storage.put("presentation", "deployment-overview-presentation", {"name":"deployment-overview-presentation","displayType":"table","hints":"{}"});
    await storage.put("projection", "deployment-overview-projection", {"name":"deployment-overview-projection","fields":"[]"});
    await storage.put('view', "deployment-overview", {"name":"deployment-overview","title":"deployment-overview","description":"","dataSource":"deployment-overview-dataSource","filter":"","sort":"","group":"","projection":"deployment-overview-projection","presentation":"deployment-overview-presentation","interaction":"","features":"[\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("deployment-overview", storage);
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
