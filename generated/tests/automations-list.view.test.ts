// generated/tests/automations-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\automations-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: automations-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "automations-list-dataSource", {"name":"automations-list-dataSource","kind":"concept-action","config":"{\"concept\":\"AutomationRule\",\"action\":\"list\"}"});
    await storage.put("presentation", "automations-list-presentation", {"name":"automations-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "automations-list-filter", {"name":"automations-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "automations-list-sort", {"name":"automations-list-sort","keys":"[]"});
    await storage.put("projection", "automations-list-projection", {"name":"automations-list-projection","fields":"[{\"key\":\"rule\",\"label\":\"Rule\"},{\"key\":\"trigger\",\"label\":\"Trigger\"},{\"key\":\"conditions\",\"label\":\"Conditions\"},{\"key\":\"enabled\",\"label\":\"Enabled\",\"formatter\":\"boolean-badge\"}]"});
    await storage.put("interaction", "automations-list-interaction", {"name":"automations-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"AutomationRule\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "automations-list", {"name":"automations-list","title":"automations-list","description":"","dataSource":"automations-list-dataSource","filter":"automations-list-filter","sort":"automations-list-sort","group":"","projection":"automations-list-projection","presentation":"automations-list-presentation","interaction":"automations-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("automations-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });
  });
});
