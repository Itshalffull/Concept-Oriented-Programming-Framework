import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { frameworkadapterHandler } from "./frameworkadapter.impl";

describe("FrameworkAdapter Concept", () => {
  // ---------------------------------------------------------------
  // register
  // ---------------------------------------------------------------

  describe("register", () => {
    it("registers a valid framework and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "react", version: "19", normalizer: "reactNorm", mountFn: "reactMount" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).renderer).toBe("r-1");
    });

    it("returns duplicate for an invalid framework name", async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "ember", version: "5", normalizer: "emberNorm", mountFn: "emberMount" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("ember");
    });

    it("returns duplicate when registering the same framework twice", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "react", version: "19", normalizer: "norm1", mountFn: "mount1" },
        storage,
      );
      const result = await frameworkadapterHandler.register(
        { renderer: "r-2", framework: "react", version: "18", normalizer: "norm2", mountFn: "mount2" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("react");
    });

    it("registers two different frameworks successfully", async () => {
      const storage = createInMemoryStorage();
      const r1 = await frameworkadapterHandler.register(
        { renderer: "r-react", framework: "react", version: "19", normalizer: "reactNorm", mountFn: "reactMount" },
        storage,
      );
      const r2 = await frameworkadapterHandler.register(
        { renderer: "r-vue", framework: "vue", version: "3", normalizer: "vueNorm", mountFn: "vueMount" },
        storage,
      );
      expect(r1.variant).toBe("ok");
      expect((r1 as any).renderer).toBe("r-react");
      expect(r2.variant).toBe("ok");
      expect((r2 as any).renderer).toBe("r-vue");
    });
  });

  // ---------------------------------------------------------------
  // normalize
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("wraps valid JSON props with normalizer and framework metadata", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "react", version: "19", normalizer: "reactNorm", mountFn: "reactMount" },
        storage,
      );

      const result = await frameworkadapterHandler.normalize(
        { renderer: "r-1", props: '{"onClick":"handler_1","className":"btn"}' },
        storage,
      );
      expect(result.variant).toBe("ok");

      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.normalizer).toBe("reactNorm");
      expect(normalized.framework).toBe("react");
      expect(normalized.props).toEqual({ onClick: "handler_1", className: "btn" });
    });

    it("wraps non-JSON props string as {raw: props}", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "solid", version: "1", normalizer: "solidNorm", mountFn: "solidMount" },
        storage,
      );

      const result = await frameworkadapterHandler.normalize(
        { renderer: "r-1", props: "not-valid-json" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.normalizer).toBe("solidNorm");
      expect(normalized.framework).toBe("solid");
      expect(normalized.props).toEqual({ raw: "not-valid-json" });
    });

    it("returns notfound for a nonexistent renderer", async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.normalize(
        { renderer: "r-missing", props: '{"a":1}' },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("r-missing");
    });
  });

  // ---------------------------------------------------------------
  // mount
  // ---------------------------------------------------------------

  describe("mount", () => {
    it("stores target-to-machine mapping and sets status to mounted", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "react", version: "19", normalizer: "norm", mountFn: "mount" },
        storage,
      );

      const result = await frameworkadapterHandler.mount(
        { renderer: "r-1", machine: "machine-a", target: "target-1" },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Verify stored state
      const record = await storage.get("adapter", "r-1");
      expect(record).not.toBeNull();
      expect(record!.status).toBe("mounted");
      const mounts = JSON.parse(record!.mounts as string);
      expect(mounts["target-1"]).toBe("machine-a");
    });

    it("returns error for a nonexistent renderer", async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.mount(
        { renderer: "r-missing", machine: "m-1", target: "t-1" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("r-missing");
    });

    it("adds a second target to the same renderer without removing the first", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "svelte", version: "4", normalizer: "norm", mountFn: "mount" },
        storage,
      );

      await frameworkadapterHandler.mount(
        { renderer: "r-1", machine: "machine-a", target: "target-1" },
        storage,
      );
      await frameworkadapterHandler.mount(
        { renderer: "r-1", machine: "machine-b", target: "target-2" },
        storage,
      );

      const record = await storage.get("adapter", "r-1");
      const mounts = JSON.parse(record!.mounts as string);
      expect(mounts["target-1"]).toBe("machine-a");
      expect(mounts["target-2"]).toBe("machine-b");
      expect(record!.status).toBe("mounted");
    });
  });

  // ---------------------------------------------------------------
  // unmount
  // ---------------------------------------------------------------

  describe("unmount", () => {
    it("removes a target from mounts", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "vue", version: "3", normalizer: "norm", mountFn: "mount" },
        storage,
      );
      await frameworkadapterHandler.mount(
        { renderer: "r-1", machine: "m-1", target: "t-1" },
        storage,
      );

      const result = await frameworkadapterHandler.unmount(
        { renderer: "r-1", target: "t-1" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("adapter", "r-1");
      const mounts = JSON.parse(record!.mounts as string);
      expect(mounts).not.toHaveProperty("t-1");
    });

    it("returns notfound for a nonexistent renderer", async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.unmount(
        { renderer: "r-missing", target: "t-1" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent target", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "ink", version: "4", normalizer: "norm", mountFn: "mount" },
        storage,
      );

      const result = await frameworkadapterHandler.unmount(
        { renderer: "r-1", target: "t-nonexistent" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("t-nonexistent");
    });

    it("reverts status to registered when the last mount is removed", async () => {
      const storage = createInMemoryStorage();
      await frameworkadapterHandler.register(
        { renderer: "r-1", framework: "angular", version: "17", normalizer: "norm", mountFn: "mount" },
        storage,
      );
      await frameworkadapterHandler.mount(
        { renderer: "r-1", machine: "m-1", target: "t-1" },
        storage,
      );

      await frameworkadapterHandler.unmount({ renderer: "r-1", target: "t-1" }, storage);

      const record = await storage.get("adapter", "r-1");
      expect(record!.status).toBe("registered");
      const mounts = JSON.parse(record!.mounts as string);
      expect(Object.keys(mounts)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("register -> mount two targets -> unmount first -> verify mounted -> unmount second -> verify registered", async () => {
      const storage = createInMemoryStorage();

      // Step 1: register react
      const reg = await frameworkadapterHandler.register(
        { renderer: "r-react", framework: "react", version: "19", normalizer: "reactNorm", mountFn: "reactMount" },
        storage,
      );
      expect(reg.variant).toBe("ok");

      // Step 2: mount target-1 with machine-a
      const m1 = await frameworkadapterHandler.mount(
        { renderer: "r-react", machine: "machine-a", target: "target-1" },
        storage,
      );
      expect(m1.variant).toBe("ok");

      // Step 3: mount target-2 with machine-b
      const m2 = await frameworkadapterHandler.mount(
        { renderer: "r-react", machine: "machine-b", target: "target-2" },
        storage,
      );
      expect(m2.variant).toBe("ok");

      // Verify both targets exist
      let record = await storage.get("adapter", "r-react");
      let mounts = JSON.parse(record!.mounts as string);
      expect(Object.keys(mounts)).toHaveLength(2);
      expect(record!.status).toBe("mounted");

      // Step 4: unmount target-1
      const u1 = await frameworkadapterHandler.unmount(
        { renderer: "r-react", target: "target-1" },
        storage,
      );
      expect(u1.variant).toBe("ok");

      // Verify still mounted (target-2 remains)
      record = await storage.get("adapter", "r-react");
      expect(record!.status).toBe("mounted");
      mounts = JSON.parse(record!.mounts as string);
      expect(mounts).not.toHaveProperty("target-1");
      expect(mounts["target-2"]).toBe("machine-b");

      // Step 5: unmount target-2
      const u2 = await frameworkadapterHandler.unmount(
        { renderer: "r-react", target: "target-2" },
        storage,
      );
      expect(u2.variant).toBe("ok");

      // Verify status reverted to registered
      record = await storage.get("adapter", "r-react");
      expect(record!.status).toBe("registered");
      mounts = JSON.parse(record!.mounts as string);
      expect(Object.keys(mounts)).toHaveLength(0);
    });
  });
});
