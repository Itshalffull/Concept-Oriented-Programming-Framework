// generated/tests/process-steps-editor.view.test.ts
// Auto-generated from C:\Users\Matt\OneDrive\buildamodule-resource-pack\Documents\GitHub\Concept-Oriented-Programming-Framework\specs\view\views\process-steps-editor.view — do not edit manually
import { describe, it, expect, beforeAll } from 'vitest';
import { compileAndAnalyze, type ViewAnalysis } from '../../handlers/ts/framework/view-analysis.js';
import { createMockStorage } from '../../tests/helpers/mock-storage.js';

describe('View: process-steps-editor', () => {
  let analysis: ViewAnalysis;

  beforeAll(async () => {
    const storage = createMockStorage();
    await storage.put("source", "process-steps-editor-dataSource", {"name":"process-steps-editor-dataSource","kind":"concept-action","config":"{\"concept\":\"ProcessSpec\",\"action\":\"get\",\"params\":{\"spec\":\"{{specId}}\"}}"});
    await storage.put("presentation", "process-steps-editor-presentation", {"name":"process-steps-editor-presentation","displayType":"table","hints":"{}"});
    await storage.put("sort", "process-steps-editor-sort", {"name":"process-steps-editor-sort","keys":"[]"});
    await storage.put("projection", "process-steps-editor-projection", {"name":"process-steps-editor-projection","fields":"[]"});
    await storage.put("interaction", "process-steps-editor-interaction", {"name":"process-steps-editor-interaction","rowActions":"[{\"key\":\"edit\",\"concept\":\"ProcessSpec\",\"action\":\"update\",\"label\":\"Edit\"}]"});
    await storage.put('view', "process-steps-editor", {"name":"process-steps-editor","title":"process-steps-editor","description":"","dataSource":"process-steps-editor-dataSource","filter":"","sort":"process-steps-editor-sort","group":"","projection":"process-steps-editor-projection","presentation":"process-steps-editor-presentation","interaction":"process-steps-editor-interaction","features":"[\"sort\",\"projection\",\"interaction\"]","pagination":""});
    analysis = await compileAndAnalyze("process-steps-editor", storage);
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
