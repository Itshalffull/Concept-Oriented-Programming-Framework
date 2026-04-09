// generated/tests/process-edges-editor.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-edges-editor.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-edges-editor', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-edges-editor-dataSource", {"name":"process-edges-editor-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessSpec\",\"action\":\"get\",\"params\":{\"spec\":\"{{specId}}\"}}"});
    await storage.put("presentation", "process-edges-editor-presentation", {"name":"process-edges-editor-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "process-edges-editor-sort", {"name":"process-edges-editor-sort","keys":"[]"});
    await storage.put("projection", "process-edges-editor-projection", {"name":"process-edges-editor-projection","fields":"[]"});
    await storage.put("interaction", "process-edges-editor-interaction", {"name":"process-edges-editor-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ProcessSpec\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "process-edges-editor", {"name":"process-edges-editor","title":"process-edges-editor","description":"","dataSource":"process-edges-editor-dataSource","filter":"","sort":"process-edges-editor-sort","group":"","projection":"process-edges-editor-projection","presentation":"process-edges-editor-presentation","interaction":"process-edges-editor-interaction","features":"[\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("process-edges-editor", storage);
  });

  describe('invariants', () => {
  it("always: purity is read-write", () => {
    expect(analysis.purity).toBe("read-write");
  });

  it("always: invokes only ProcessSpec actions", () => {
    for (const ia of analysis.invokedActions) {
      expect(ia.startsWith("ProcessSpec/")).toBe(true);
    }
  });
  });
});
