import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { signalHandler } from "./signal.impl";

describe("Signal Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

  describe("create", () => {
    it("creates a state signal and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.create(
        { signal: "s1", kind: "state", initialValue: "0" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).signal).toBe("s1");
    });

    it("returns invalid for an unrecognized kind", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.create(
        { signal: "s1", kind: "observable", initialValue: "0" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("observable");
    });

    it("accepts all 3 valid kinds (state, computed, effect)", async () => {
      const validKinds = ["state", "computed", "effect"];
      for (const kind of validKinds) {
        const storage = createInMemoryStorage();
        const result = await signalHandler.create(
          { signal: `sig-${kind}`, kind, initialValue: "initial" },
          storage,
        );
        expect(result.variant).toBe("ok");
      }
    });
  });

  // ──────────────────────────────────────────────
  // read
  // ──────────────────────────────────────────────

  describe("read", () => {
    it("returns the current value and version", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "s1", kind: "state", initialValue: "hello" },
        storage,
      );

      const result = await signalHandler.read({ signal: "s1" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).value).toBe("hello");
      expect((result as any).version).toBe(1);
    });

    it("returns notfound for a nonexistent signal", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.read({ signal: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // write
  // ──────────────────────────────────────────────

  describe("write", () => {
    it("updates value and increments version", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "s1", kind: "state", initialValue: "old" },
        storage,
      );

      const result = await signalHandler.write(
        { signal: "s1", value: "new" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).version).toBe(2);

      // Confirm via read
      const readResult = await signalHandler.read({ signal: "s1" }, storage);
      expect((readResult as any).value).toBe("new");
      expect((readResult as any).version).toBe(2);
    });

    it("returns readonly when writing to a computed signal", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "c1", kind: "computed", initialValue: "derived" },
        storage,
      );

      const result = await signalHandler.write(
        { signal: "c1", value: "attempt" },
        storage,
      );
      expect(result.variant).toBe("readonly");
      expect((result as any).message).toContain("computed");
    });

    it("returns notfound for a nonexistent signal", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.write(
        { signal: "ghost", value: "x" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("allows writing to an effect signal", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "eff", kind: "effect", initialValue: "idle" },
        storage,
      );

      const result = await signalHandler.write(
        { signal: "eff", value: "running" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).version).toBe(2);
    });

    it("increments version correctly across multiple writes (v1 -> v2 -> v3)", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "s1", kind: "state", initialValue: "v1-val" },
        storage,
      );

      const write1 = await signalHandler.write(
        { signal: "s1", value: "v2-val" },
        storage,
      );
      expect((write1 as any).version).toBe(2);

      const write2 = await signalHandler.write(
        { signal: "s1", value: "v3-val" },
        storage,
      );
      expect((write2 as any).version).toBe(3);

      const readResult = await signalHandler.read({ signal: "s1" }, storage);
      expect((readResult as any).value).toBe("v3-val");
      expect((readResult as any).version).toBe(3);
    });
  });

  // ──────────────────────────────────────────────
  // batch
  // ──────────────────────────────────────────────

  describe("batch", () => {
    it("updates multiple signals and returns ok with count", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create({ signal: "a", kind: "state", initialValue: "0" }, storage);
      await signalHandler.create({ signal: "b", kind: "state", initialValue: "0" }, storage);

      const result = await signalHandler.batch(
        { signals: JSON.stringify([{ signal: "a", value: "10" }, { signal: "b", value: "20" }]) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).count).toBe(2);

      // Verify values updated
      const readA = await signalHandler.read({ signal: "a" }, storage);
      expect((readA as any).value).toBe("10");
      const readB = await signalHandler.read({ signal: "b" }, storage);
      expect((readB as any).value).toBe("20");
    });

    it("returns partial for invalid JSON input", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.batch(
        { signals: "not json {{" },
        storage,
      );
      expect(result.variant).toBe("partial");
      expect((result as any).succeeded).toBe(0);
      expect((result as any).failed).toBe(1);
    });

    it("returns partial for non-array JSON input", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.batch(
        { signals: JSON.stringify({ signal: "a", value: "1" }) },
        storage,
      );
      expect(result.variant).toBe("partial");
      expect((result as any).succeeded).toBe(0);
      expect((result as any).failed).toBe(1);
    });

    it("returns partial when some signals exist and some do not", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create({ signal: "exists", kind: "state", initialValue: "0" }, storage);

      const result = await signalHandler.batch(
        {
          signals: JSON.stringify([
            { signal: "exists", value: "42" },
            { signal: "missing", value: "99" },
          ]),
        },
        storage,
      );
      expect(result.variant).toBe("partial");
      expect((result as any).succeeded).toBe(1);
      expect((result as any).failed).toBe(1);
    });

    it("skips computed signals in batch (counted as failed)", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create({ signal: "state1", kind: "state", initialValue: "0" }, storage);
      await signalHandler.create({ signal: "comp1", kind: "computed", initialValue: "0" }, storage);

      const result = await signalHandler.batch(
        {
          signals: JSON.stringify([
            { signal: "state1", value: "10" },
            { signal: "comp1", value: "20" },
          ]),
        },
        storage,
      );
      expect(result.variant).toBe("partial");
      expect((result as any).succeeded).toBe(1);
      expect((result as any).failed).toBe(1);
      expect((result as any).message).toContain("computed");
    });

    it("counts entries missing signal or value fields as failed", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create({ signal: "a", kind: "state", initialValue: "0" }, storage);

      const result = await signalHandler.batch(
        {
          signals: JSON.stringify([
            { signal: "a", value: "10" },
            { value: "20" },           // missing signal field
            { signal: "a" },            // missing value field — but value is undefined
          ]),
        },
        storage,
      );
      // First entry succeeds, second fails (no signal), third fails (value undefined)
      expect(result.variant).toBe("partial");
      expect((result as any).succeeded).toBe(1);
      expect((result as any).failed).toBe(2);
    });
  });

  // ──────────────────────────────────────────────
  // dispose
  // ──────────────────────────────────────────────

  describe("dispose", () => {
    it("removes a signal so subsequent read returns notfound", async () => {
      const storage = createInMemoryStorage();
      await signalHandler.create(
        { signal: "s1", kind: "state", initialValue: "alive" },
        storage,
      );

      const disposeResult = await signalHandler.dispose({ signal: "s1" }, storage);
      expect(disposeResult.variant).toBe("ok");
      expect((disposeResult as any).signal).toBe("s1");

      const readResult = await signalHandler.read({ signal: "s1" }, storage);
      expect(readResult.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent signal", async () => {
      const storage = createInMemoryStorage();
      const result = await signalHandler.dispose({ signal: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("create 3 signals -> batch update 2 -> read all -> verify versions", async () => {
      const storage = createInMemoryStorage();

      // Step 1: create 3 state signals
      await signalHandler.create({ signal: "x", kind: "state", initialValue: "0" }, storage);
      await signalHandler.create({ signal: "y", kind: "state", initialValue: "0" }, storage);
      await signalHandler.create({ signal: "z", kind: "state", initialValue: "0" }, storage);

      // Step 2: batch update x and y (not z)
      const batchResult = await signalHandler.batch(
        {
          signals: JSON.stringify([
            { signal: "x", value: "100" },
            { signal: "y", value: "200" },
          ]),
        },
        storage,
      );
      expect(batchResult.variant).toBe("ok");
      expect((batchResult as any).count).toBe(2);

      // Step 3: read all three and verify versions
      const readX = await signalHandler.read({ signal: "x" }, storage);
      expect((readX as any).value).toBe("100");
      expect((readX as any).version).toBe(2); // initial 1 + 1 batch write

      const readY = await signalHandler.read({ signal: "y" }, storage);
      expect((readY as any).value).toBe("200");
      expect((readY as any).version).toBe(2);

      const readZ = await signalHandler.read({ signal: "z" }, storage);
      expect((readZ as any).value).toBe("0"); // unchanged
      expect((readZ as any).version).toBe(1); // never written to
    });
  });
});
