// generated/tests/agent-library.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\agent-library.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: agent-library', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "agent-library-dataSource", {"name":"agent-library-dataSource","kind":"concept-action","config":"{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"AgentPersona\"}}"});
    await storage.put("presentation", "agent-library-presentation", {"name":"agent-library-presentation","displayType":"card-grid","hints":"{}"});
    await storage.put("filter", "agent-library-filter", {"name":"agent-library-filter","node":"{\"type\":\"eq\",\"field\":\"capability\",\"value\":\"all\"}"});
    await storage.put("sort", "agent-library-sort", {"name":"agent-library-sort","keys":"[{\"field\":\"name\",\"direction\":\"asc\"}]"});
    await storage.put("projection", "agent-library-projection", {"name":"agent-library-projection","fields":"[{\"key\":\"node\",\"label\":\"Agent\"},{\"key\":\"name\",\"label\":\"Name\"},{\"key\":\"capability\",\"label\":\"Capability\"},{\"key\":\"status\",\"label\":\"Status\"}]"});
    await storage.put("interaction", "agent-library-interaction", {"name":"agent-library-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ContentNode\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "agent-library", {"name":"agent-library","title":"agent-library","description":"","dataSource":"agent-library-dataSource","filter":"agent-library-filter","sort":"agent-library-sort","group":"","projection":"agent-library-projection","presentation":"agent-library-presentation","interaction":"agent-library-interaction","features":"[\"filter\",\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("agent-library", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ContentNode actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ContentNode/")).toBe(true);
    }
  });

  it("always: all invoke variants covered", () => {
    expect(analysis.uncoveredVariants).toEqual([]);
  });

  it("always: filter fields exist in source", () => {
    for (const f of analysis.filterFields) {
      expect(analysis.sourceFields).toContain(f);
    }
  });
  });
});
