// generated/tests/automations-rules-list.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\automations-rules-list.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: automations-rules-list', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "automations-rules-list-dataSource", {"name":"automations-rules-list-dataSource","kind":"concept-action","config":"{\"concept\":\"AutomationRule\",\"action\":\"list\"}"});
    await storage.put("presentation", "automations-rules-list-presentation", {"name":"automations-rules-list-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "automations-rules-list-filter", {"name":"automations-rules-list-filter","node":"{\"type\":\"true\"}"});
    await storage.put("sort", "automations-rules-list-sort", {"name":"automations-rules-list-sort","keys":"[]"});
    await storage.put("projection", "automations-rules-list-projection", {"name":"automations-rules-list-projection","fields":"[{\"key\":\"rule\",\"label\":\"Rule\"},{\"key\":\"trigger\",\"label\":\"Trigger\"},{\"key\":\"conditions\",\"label\":\"Conditions\"},{\"key\":\"enabled\",\"label\":\"Enabled\",\"formatter\":\"boolean-badge\"}]"});
    await storage.put("interaction", "automations-rules-list-interaction", {"name":"automations-rules-list-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"AutomationRule\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "automations-rules-list", {"name":"automations-rules-list","title":"automations-rules-list","description":"","dataSource":"automations-rules-list-dataSource","filter":"automations-rules-list-filter","sort":"automations-rules-list-sort","group":"","projection":"automations-rules-list-projection","presentation":"automations-rules-list-presentation","interaction":"automations-rules-list-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("automations-rules-list", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only AutomationRule actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("AutomationRule/")).toBe(true);
    }
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
