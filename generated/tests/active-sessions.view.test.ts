// generated/tests/active-sessions.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\active-sessions.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: active-sessions', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "active-sessions-dataSource", {"name":"active-sessions-dataSource","kind":"concept-action","config":"{\"concept\":\"AgentSession\",\"action\":\"list\",\"params\":{\"status\":\"active\"}}"});
    await storage.put("presentation", "active-sessions-presentation", {"name":"active-sessions-presentation","displayType":"table","hints":"{}"});
    await storage.put("filter", "active-sessions-filter", {"name":"active-sessions-filter","node":"{\"type\":\"eq\",\"field\":\"status\",\"value\":\"active\"}"});
    await storage.put("sort", "active-sessions-sort", {"name":"active-sessions-sort","keys":"[{\"field\":\"startedAt\",\"direction\":\"desc\"}]"});
    await storage.put("projection", "active-sessions-projection", {"name":"active-sessions-projection","fields":"[{\"key\":\"session\",\"label\":\"Session\"},{\"key\":\"agent\",\"label\":\"Agent\"},{\"key\":\"status\",\"label\":\"Status\"},{\"key\":\"startedAt\",\"label\":\"Started\"},{\"key\":\"duration\",\"label\":\"Duration\"}]"});
    await storage.put('view', "active-sessions", {"name":"active-sessions","title":"active-sessions","description":"","dataSource":"active-sessions-dataSource","filter":"active-sessions-filter","sort":"active-sessions-sort","group":"","projection":"active-sessions-projection","presentation":"active-sessions-presentation","interaction":"","features":"[\"filter\",\"sort\",\"projection\"]","pagination":""});
    analysis = await compileAndAnalyze("active-sessions", storage);
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
