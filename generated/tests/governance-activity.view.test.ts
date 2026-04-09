// generated/tests/governance-activity.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\governance-activity.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: governance-activity', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "governance-activity-dataSource", {"name":"governance-activity-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"GovernanceEvent\"}}"});
    await storage.put("presentation", "governance-activity-presentation", {"name":"governance-activity-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "governance-activity-filter", {"name":"governance-activity-filter","node":"{\"type\":\"eq\",\"field\":\"eventType\",\"value\":\"all\"}"});
    await storage.put("sort", "governance-activity-sort", {"name":"governance-activity-sort","keys":"[{\"field\":\"timestamp\",\"direction\":\"desc\"}]"});
    await storage.put("projection", "governance-activity-projection", {"name":"governance-activity-projection","fields":"[{\"key\":\"node\",\"label\":\"Event\"},{\"key\":\"eventType\",\"label\":\"Type\"},{\"key\":\"actor\",\"label\":\"Actor\"},{\"key\":\"target\",\"label\":\"Target\"},{\"key\":\"timestamp\",\"label\":\"Time\"}]"});
    await storage.put('view', "governance-activity", {"name":"governance-activity","title":"governance-activity","description":"","dataSource":"governance-activity-dataSource","filter":"governance-activity-filter","sort":"governance-activity-sort","group":"","projection":"governance-activity-projection","presentation":"governance-activity-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("governance-activity", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-only", () => {
    expect(analysis.purity).toBe("read-only");
  });

  it("always: no invoke instructions", () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
