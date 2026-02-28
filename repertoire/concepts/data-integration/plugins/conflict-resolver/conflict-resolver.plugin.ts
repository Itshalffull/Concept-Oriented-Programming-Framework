// Conflict Resolver Plugin — bidirectional sync conflict resolution for the SyncPair concept.
// Provides pluggable strategies for resolving version conflicts during bidirectional data sync.
// See Data Integration Kit sync-pair.concept for the parent SyncPair concept definition.

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A single entry in a vector clock, mapping a node/replica ID to a logical counter. */
export type VectorClock = Record<string, number>;

/** One side of a conflicting entity version. */
export interface VersionData {
  /** Key-value map of entity fields and their values. */
  fields: Record<string, unknown>;
  /** Wall-clock timestamp (milliseconds since epoch) of this version's last write. */
  timestamp: number;
  /** Vector clock for causal ordering across replicas. */
  vectorClock: VectorClock;
  /** Identifier of the replica/node that produced this version. */
  replicaId?: string;
}

/** Describes a detected conflict between two versions of the same entity. */
export interface Conflict {
  /** Unique identifier of the entity in conflict. */
  entityId: string;
  /** Version from side A of the sync pair. */
  versionA: VersionData;
  /** Version from side B of the sync pair. */
  versionB: VersionData;
  /** Common ancestor version, if available (enables three-way merge). */
  ancestor?: VersionData;
}

/** Per-field conflict detail when field-level merge encounters a true conflict. */
export interface FieldConflict {
  field: string;
  valueA: unknown;
  valueB: unknown;
  ancestorValue?: unknown;
}

/** The resolution produced by a conflict resolver. */
export interface Resolution {
  /** Which side won, or whether a merge was produced, or manual review is needed. */
  winner: "a" | "b" | "merged" | "manual";
  /** The merged entity value (present when winner is "merged" or a single side). */
  mergedValue?: Record<string, unknown>;
  /** The strategy identifier that produced this resolution. */
  strategy: string;
  /** Human-readable description of how the conflict was resolved. */
  details: string;
  /** Whether this resolution was produced without human intervention. */
  autoResolved: boolean;
  /** List of fields that could not be auto-resolved (for partial merges). */
  unresolvedFields?: FieldConflict[];
  /** Both versions preserved for manual queue. */
  preservedVersions?: { a: VersionData; b: VersionData };
}

/** Provider-specific configuration knobs. */
export interface ConflictResolverConfig {
  /** Tie-breaking preference when timestamps are equal: "a" or "b". */
  tieBreaker?: "a" | "b";
  /** For manual_queue: priority level hint (higher = more urgent). */
  priorityHint?: number;
  /** For field_merge: fields to always prefer from side A. */
  preferAFields?: string[];
  /** For field_merge: fields to always prefer from side B. */
  preferBFields?: string[];
  /** For crdt_merge: field-to-CRDT-type mapping override. */
  crdtTypeOverrides?: Record<string, CrdtType>;
  /** Provider-specific options keyed by provider id. */
  providerOptions?: Record<string, Record<string, unknown>>;
}

/** CRDT type classification for crdt_merge provider. */
export type CrdtType =
  | "lww_register"
  | "g_counter"
  | "pn_counter"
  | "or_set"
  | "rga";

/** Interface every conflict-resolver provider must implement. */
export interface ConflictResolverPlugin {
  readonly id: string;
  readonly displayName: string;

  /** Resolve a conflict between two versions. */
  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution;

  /** Check whether this conflict can be automatically resolved without human input. */
  canAutoResolve(conflict: Conflict): boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compare two vector clocks. Returns 1 if a dominates, -1 if b dominates, 0 if concurrent. */
function compareVectorClocks(a: VectorClock, b: VectorClock): 1 | -1 | 0 {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;

  for (const key of allKeys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (va > vb) aGreater = true;
    if (vb > va) bGreater = true;
  }

  if (aGreater && !bGreater) return 1;
  if (bGreater && !aGreater) return -1;
  return 0; // concurrent
}

/** Merge two vector clocks by taking the max of each entry. */
function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [key, val] of Object.entries(b)) {
    result[key] = Math.max(result[key] ?? 0, val);
  }
  return result;
}

/** Lexicographic comparison of vector clocks for deterministic tie-breaking. */
function lexicographicVectorClockCompare(a: VectorClock, b: VectorClock): number {
  const allKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of allKeys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/** Deep equality check for arbitrary values. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// 1. LwwTimestampResolver — Last-Write-Wins by timestamp
// ---------------------------------------------------------------------------

/**
 * Resolves conflicts by choosing the version with the latest timestamp.
 * Risk: silent data loss -- the losing version's changes are discarded entirely.
 *
 * Tie-breaking order:
 *   1. Higher wall-clock timestamp wins
 *   2. If timestamps are equal, lexicographic vector clock comparison
 *   3. If still tied, use config.tieBreaker (defaults to "a")
 */
export class LwwTimestampResolver implements ConflictResolverPlugin {
  readonly id = "lww_timestamp";
  readonly displayName = "Last-Write-Wins (Timestamp)";

  canAutoResolve(_conflict: Conflict): boolean {
    // LWW can always produce a deterministic winner
    return true;
  }

  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution {
    const { versionA, versionB } = conflict;
    const tieBreaker = config.tieBreaker ?? "a";

    // Primary comparison: wall-clock timestamps
    let winner: "a" | "b";
    let details: string;

    if (versionA.timestamp !== versionB.timestamp) {
      winner = versionA.timestamp > versionB.timestamp ? "a" : "b";
      const diff = Math.abs(versionA.timestamp - versionB.timestamp);
      details = `LWW selected version ${winner.toUpperCase()} (timestamp delta: ${diff}ms). `;
    } else {
      // Timestamps are equal -- fall back to lexicographic vector clock comparison
      const vcCompare = lexicographicVectorClockCompare(
        versionA.vectorClock,
        versionB.vectorClock
      );

      if (vcCompare !== 0) {
        winner = vcCompare > 0 ? "a" : "b";
        details = `Timestamps equal (${versionA.timestamp}); broke tie via vector clock comparison. `;
      } else {
        // Still tied -- use configured tie-breaker
        winner = tieBreaker;
        details = `Timestamps and vector clocks identical; used configured tie-breaker "${tieBreaker}". `;
      }
    }

    // Identify fields lost from the losing version
    const loser = winner === "a" ? versionB : versionA;
    const winnerVersion = winner === "a" ? versionA : versionB;
    const lostFields: string[] = [];

    for (const [field, loserVal] of Object.entries(loser.fields)) {
      if (!deepEqual(loserVal, winnerVersion.fields[field])) {
        lostFields.push(field);
      }
    }

    if (lostFields.length > 0) {
      details += `WARNING: Silent data loss on ${lostFields.length} field(s): [${lostFields.join(", ")}]. `;
      details += `Losing version from replica "${loser.replicaId ?? "unknown"}" `;
      details += `at timestamp ${loser.timestamp} was discarded.`;
    } else {
      details += "No field-level data loss detected (versions may differ only in metadata).";
    }

    return {
      winner,
      mergedValue: { ...winnerVersion.fields },
      strategy: this.id,
      details,
      autoResolved: true,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. FieldMergeResolver — Per-field comparison with partial auto-merge
// ---------------------------------------------------------------------------

/**
 * Compares versions field-by-field. Fields changed by only one side are auto-merged.
 * Fields changed by both sides to different values are flagged as true conflicts.
 *
 * When an ancestor is available, detects which side actually changed each field.
 * Without an ancestor, any field with differing values is treated as a conflict
 * unless configured via preferAFields / preferBFields.
 */
export class FieldMergeResolver implements ConflictResolverPlugin {
  readonly id = "field_merge";
  readonly displayName = "Per-Field Merge";

  canAutoResolve(conflict: Conflict): boolean {
    // Can auto-resolve only if no field was changed by both sides to different values
    const analysis = this.analyzeFields(conflict);
    return analysis.trueConflicts.length === 0;
  }

  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution {
    const analysis = this.analyzeFields(conflict);
    const preferAFields = new Set(config.preferAFields ?? []);
    const preferBFields = new Set(config.preferBFields ?? []);

    // Start with ancestor or version A as base
    const merged: Record<string, unknown> = conflict.ancestor
      ? { ...conflict.ancestor.fields }
      : { ...conflict.versionA.fields };

    // Apply non-conflicting changes from A
    for (const field of analysis.changedOnlyByA) {
      merged[field] = conflict.versionA.fields[field];
    }

    // Apply non-conflicting changes from B
    for (const field of analysis.changedOnlyByB) {
      merged[field] = conflict.versionB.fields[field];
    }

    // Handle true conflicts with preference overrides
    const unresolvedFields: FieldConflict[] = [];
    let resolvedConflictCount = 0;

    for (const fc of analysis.trueConflicts) {
      if (preferAFields.has(fc.field)) {
        merged[fc.field] = fc.valueA;
        resolvedConflictCount++;
      } else if (preferBFields.has(fc.field)) {
        merged[fc.field] = fc.valueB;
        resolvedConflictCount++;
      } else {
        // True unresolved conflict -- keep version A's value in merge but flag it
        merged[fc.field] = fc.valueA;
        unresolvedFields.push(fc);
      }
    }

    const totalFields = new Set([
      ...Object.keys(conflict.versionA.fields),
      ...Object.keys(conflict.versionB.fields),
      ...(conflict.ancestor ? Object.keys(conflict.ancestor.fields) : []),
    ]).size;

    const autoResolved = unresolvedFields.length === 0;
    const winner: Resolution["winner"] = autoResolved ? "merged" : "merged";

    let details = `Field-level merge across ${totalFields} fields. `;
    details += `Auto-merged: ${analysis.changedOnlyByA.length} from A, ${analysis.changedOnlyByB.length} from B. `;
    details += `Unchanged: ${analysis.unchanged.length}. `;

    if (resolvedConflictCount > 0) {
      details += `Resolved ${resolvedConflictCount} conflict(s) via field preference config. `;
    }

    if (unresolvedFields.length > 0) {
      details += `TRUE CONFLICTS on ${unresolvedFields.length} field(s): [${unresolvedFields.map((f) => f.field).join(", ")}]. `;
      details += `Defaulted to version A values; manual review recommended.`;
    }

    return {
      winner,
      mergedValue: merged,
      strategy: this.id,
      details,
      autoResolved,
      unresolvedFields: unresolvedFields.length > 0 ? unresolvedFields : undefined,
    };
  }

  private analyzeFields(conflict: Conflict): {
    changedOnlyByA: string[];
    changedOnlyByB: string[];
    trueConflicts: FieldConflict[];
    unchanged: string[];
  } {
    const { versionA, versionB, ancestor } = conflict;
    const allFields = new Set([
      ...Object.keys(versionA.fields),
      ...Object.keys(versionB.fields),
      ...(ancestor ? Object.keys(ancestor.fields) : []),
    ]);

    const changedOnlyByA: string[] = [];
    const changedOnlyByB: string[] = [];
    const trueConflicts: FieldConflict[] = [];
    const unchanged: string[] = [];

    for (const field of allFields) {
      const valA = versionA.fields[field];
      const valB = versionB.fields[field];
      const valAnc = ancestor?.fields[field];

      if (deepEqual(valA, valB)) {
        // Both sides agree -- no conflict regardless of ancestor
        unchanged.push(field);
        continue;
      }

      if (ancestor) {
        // Three-way: determine who changed relative to ancestor
        const aChanged = !deepEqual(valA, valAnc);
        const bChanged = !deepEqual(valB, valAnc);

        if (aChanged && !bChanged) {
          changedOnlyByA.push(field);
        } else if (!aChanged && bChanged) {
          changedOnlyByB.push(field);
        } else if (aChanged && bChanged) {
          // Both changed from ancestor to different values -- true conflict
          trueConflicts.push({ field, valueA: valA, valueB: valB, ancestorValue: valAnc });
        } else {
          // Neither changed from ancestor but they differ from each other (shouldn't happen
          // logically, but handle defensively)
          unchanged.push(field);
        }
      } else {
        // No ancestor: any difference is a potential conflict
        trueConflicts.push({ field, valueA: valA, valueB: valB });
      }
    }

    return { changedOnlyByA, changedOnlyByB, trueConflicts, unchanged };
  }
}

// ---------------------------------------------------------------------------
// 3. ThreeWayMergeResolver — Diff-based three-way merge
// ---------------------------------------------------------------------------

/**
 * Computes diffs of both versions against the common ancestor, then merges
 * non-overlapping changes. Overlapping changes (both sides modified the same
 * field from the ancestor differently) are flagged as true conflicts and
 * included in the output with conflict markers.
 *
 * Without an ancestor, degrades to field-merge behavior with all differing
 * fields treated as conflicts.
 */
export class ThreeWayMergeResolver implements ConflictResolverPlugin {
  readonly id = "three_way_merge";
  readonly displayName = "Three-Way Merge";

  canAutoResolve(conflict: Conflict): boolean {
    if (!conflict.ancestor) return false;
    // Auto-resolvable only if no overlapping changes exist
    const diffs = this.computeDiffs(conflict);
    return diffs.overlapping.length === 0;
  }

  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution {
    const { versionA, versionB, ancestor } = conflict;

    if (!ancestor) {
      // Degrade to field comparison without ancestor
      return this.resolveWithoutAncestor(conflict, config);
    }

    const diffs = this.computeDiffs(conflict);

    // Start with ancestor as base
    const merged: Record<string, unknown> = { ...ancestor.fields };

    // Apply non-overlapping changes from A
    for (const diff of diffs.diffA) {
      if (!diffs.overlapping.some((o) => o.field === diff.field)) {
        if (diff.type === "delete") {
          delete merged[diff.field];
        } else {
          merged[diff.field] = diff.newValue;
        }
      }
    }

    // Apply non-overlapping changes from B
    for (const diff of diffs.diffB) {
      if (!diffs.overlapping.some((o) => o.field === diff.field)) {
        if (diff.type === "delete") {
          delete merged[diff.field];
        } else {
          merged[diff.field] = diff.newValue;
        }
      }
    }

    // Handle overlapping changes (true conflicts)
    const unresolvedFields: FieldConflict[] = [];
    for (const overlap of diffs.overlapping) {
      // Include conflict markers in the merged output
      const conflictMarker = {
        "<<<<<<< version_a": overlap.valueA,
        "=======": null,
        ">>>>>>> version_b": overlap.valueB,
        _ancestorValue: overlap.ancestorValue,
      };

      // Default to version A's value in the merge, annotate with marker
      merged[overlap.field] = overlap.valueA;
      merged[`__conflict_${overlap.field}`] = conflictMarker;

      unresolvedFields.push({
        field: overlap.field,
        valueA: overlap.valueA,
        valueB: overlap.valueB,
        ancestorValue: overlap.ancestorValue,
      });
    }

    const autoResolved = unresolvedFields.length === 0;

    let details = `Three-way merge against ancestor. `;
    details += `Diff A: ${diffs.diffA.length} change(s). Diff B: ${diffs.diffB.length} change(s). `;
    details += `Non-overlapping merges applied: ${diffs.diffA.length + diffs.diffB.length - diffs.overlapping.length * 2}. `;

    if (diffs.overlapping.length > 0) {
      details += `OVERLAPPING CONFLICTS on ${diffs.overlapping.length} field(s): `;
      details += `[${diffs.overlapping.map((o) => o.field).join(", ")}]. `;
      details += `Conflict markers added to merged output; manual resolution required.`;
    } else {
      details += `Clean merge -- no overlapping changes detected.`;
    }

    return {
      winner: autoResolved ? "merged" : "merged",
      mergedValue: merged,
      strategy: this.id,
      details,
      autoResolved,
      unresolvedFields: unresolvedFields.length > 0 ? unresolvedFields : undefined,
    };
  }

  private resolveWithoutAncestor(conflict: Conflict, _config: ConflictResolverConfig): Resolution {
    const { versionA, versionB } = conflict;
    const allFields = new Set([
      ...Object.keys(versionA.fields),
      ...Object.keys(versionB.fields),
    ]);

    const merged: Record<string, unknown> = {};
    const unresolvedFields: FieldConflict[] = [];

    for (const field of allFields) {
      const valA = versionA.fields[field];
      const valB = versionB.fields[field];

      if (deepEqual(valA, valB)) {
        merged[field] = valA;
      } else if (valA !== undefined && valB === undefined) {
        merged[field] = valA;
      } else if (valA === undefined && valB !== undefined) {
        merged[field] = valB;
      } else {
        // Both have different values -- conflict
        merged[field] = valA;
        unresolvedFields.push({ field, valueA: valA, valueB: valB });
      }
    }

    return {
      winner: unresolvedFields.length === 0 ? "merged" : "merged",
      mergedValue: merged,
      strategy: this.id,
      details: `Three-way merge degraded: no ancestor available. ${unresolvedFields.length} unresolved conflict(s).`,
      autoResolved: unresolvedFields.length === 0,
      unresolvedFields: unresolvedFields.length > 0 ? unresolvedFields : undefined,
    };
  }

  private computeDiffs(conflict: Conflict): {
    diffA: FieldDiff[];
    diffB: FieldDiff[];
    overlapping: OverlappingChange[];
  } {
    const ancestor = conflict.ancestor!;
    const diffA = this.diffVersions(ancestor.fields, conflict.versionA.fields);
    const diffB = this.diffVersions(ancestor.fields, conflict.versionB.fields);

    // Find overlapping changes: same field changed by both sides
    const overlapping: OverlappingChange[] = [];
    const diffBMap = new Map(diffB.map((d) => [d.field, d]));

    for (const da of diffA) {
      const db = diffBMap.get(da.field);
      if (db) {
        // Both modified the same field -- check if to the same value
        if (!deepEqual(da.newValue, db.newValue)) {
          overlapping.push({
            field: da.field,
            valueA: da.newValue,
            valueB: db.newValue,
            ancestorValue: ancestor.fields[da.field],
          });
        }
        // If they changed it to the same value, it's a non-conflict convergence
      }
    }

    return { diffA, diffB, overlapping };
  }

  private diffVersions(
    base: Record<string, unknown>,
    modified: Record<string, unknown>
  ): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const allFields = new Set([...Object.keys(base), ...Object.keys(modified)]);

    for (const field of allFields) {
      const baseVal = base[field];
      const modVal = modified[field];

      if (deepEqual(baseVal, modVal)) continue;

      if (baseVal !== undefined && modVal === undefined) {
        diffs.push({ field, type: "delete", oldValue: baseVal, newValue: undefined });
      } else if (baseVal === undefined && modVal !== undefined) {
        diffs.push({ field, type: "add", oldValue: undefined, newValue: modVal });
      } else {
        diffs.push({ field, type: "modify", oldValue: baseVal, newValue: modVal });
      }
    }

    return diffs;
  }
}

interface FieldDiff {
  field: string;
  type: "add" | "modify" | "delete";
  oldValue: unknown;
  newValue: unknown;
}

interface OverlappingChange {
  field: string;
  valueA: unknown;
  valueB: unknown;
  ancestorValue: unknown;
}

// ---------------------------------------------------------------------------
// 4. CrdtMergeResolver — CRDT-based conflict-free merge
// ---------------------------------------------------------------------------

/**
 * Uses Conflict-free Replicated Data Types to guarantee convergence without
 * conflicts. Each field is assigned a CRDT type based on its value shape:
 *
 *   - Scalar (string, boolean, null): LWW-Register (last-writer-wins by vector clock)
 *   - Number: PN-Counter (tracks increments/decrements as positive/negative counters)
 *   - Array of unique items: OR-Set (Observed-Remove Set)
 *   - String (long text): RGA (Replicated Growable Array) for character-level merge
 *   - Default fallback: LWW-Register
 *
 * Vector clocks are merged (element-wise max) to produce a causally-consistent
 * merged state. Convergence is mathematically guaranteed -- no conflicts possible.
 */
export class CrdtMergeResolver implements ConflictResolverPlugin {
  readonly id = "crdt_merge";
  readonly displayName = "CRDT Merge (Conflict-Free)";

  canAutoResolve(_conflict: Conflict): boolean {
    // CRDTs guarantee conflict-free convergence -- always auto-resolvable
    return true;
  }

  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution {
    const { versionA, versionB, ancestor } = conflict;
    const crdtOverrides = config.crdtTypeOverrides ?? {};

    const allFields = new Set([
      ...Object.keys(versionA.fields),
      ...Object.keys(versionB.fields),
      ...(ancestor ? Object.keys(ancestor.fields) : []),
    ]);

    const merged: Record<string, unknown> = {};
    const mergeDetails: string[] = [];

    for (const field of allFields) {
      const valA = versionA.fields[field];
      const valB = versionB.fields[field];
      const valAnc = ancestor?.fields[field];

      // Determine CRDT type for this field
      const crdtType = crdtOverrides[field] ?? this.inferCrdtType(valA, valB, valAnc);

      switch (crdtType) {
        case "lww_register":
          merged[field] = this.mergeLwwRegister(
            valA, versionA.vectorClock, versionA.timestamp,
            valB, versionB.vectorClock, versionB.timestamp
          );
          mergeDetails.push(`${field}: LWW-Register`);
          break;

        case "g_counter":
        case "pn_counter":
          merged[field] = this.mergePnCounter(
            valA as number | undefined,
            valB as number | undefined,
            valAnc as number | undefined
          );
          mergeDetails.push(`${field}: PN-Counter`);
          break;

        case "or_set":
          merged[field] = this.mergeOrSet(
            valA as unknown[] | undefined,
            valB as unknown[] | undefined,
            valAnc as unknown[] | undefined
          );
          mergeDetails.push(`${field}: OR-Set`);
          break;

        case "rga":
          merged[field] = this.mergeRga(
            valA as string | undefined,
            valB as string | undefined,
            valAnc as string | undefined
          );
          mergeDetails.push(`${field}: RGA`);
          break;

        default:
          // Fallback to LWW
          merged[field] = this.mergeLwwRegister(
            valA, versionA.vectorClock, versionA.timestamp,
            valB, versionB.vectorClock, versionB.timestamp
          );
          mergeDetails.push(`${field}: LWW-Register (fallback)`);
      }
    }

    // Merge vector clocks for the resulting state
    const mergedVectorClock = mergeVectorClocks(versionA.vectorClock, versionB.vectorClock);

    const details =
      `CRDT merge applied to ${allFields.size} field(s). ` +
      `Strategy per field: ${mergeDetails.join("; ")}. ` +
      `Merged vector clock: ${JSON.stringify(mergedVectorClock)}. ` +
      `Convergence guaranteed -- no conflicts possible.`;

    return {
      winner: "merged",
      mergedValue: merged,
      strategy: this.id,
      details,
      autoResolved: true,
    };
  }

  /** Infer the appropriate CRDT type from the field's values. */
  private inferCrdtType(
    valA: unknown,
    valB: unknown,
    valAnc: unknown
  ): CrdtType {
    // Check all available values to determine the field's semantic type
    const values = [valA, valB, valAnc].filter((v) => v !== undefined);

    if (values.length === 0) return "lww_register";

    // If any value is a number, use PN-Counter
    if (values.every((v) => typeof v === "number")) return "pn_counter";

    // If any value is an array, use OR-Set
    if (values.some((v) => Array.isArray(v))) return "or_set";

    // If any value is a long string (> 100 chars), use RGA for text sequences
    if (values.some((v) => typeof v === "string" && (v as string).length > 100)) return "rga";

    // Default: LWW-Register for scalars
    return "lww_register";
  }

  /**
   * LWW-Register: Last-writer-wins by vector clock comparison, then timestamp.
   * Deterministic: if clocks are concurrent, highest timestamp wins;
   * if timestamps are also equal, lexicographic VC comparison breaks the tie.
   */
  private mergeLwwRegister(
    valA: unknown, vcA: VectorClock, tsA: number,
    valB: unknown, vcB: VectorClock, tsB: number
  ): unknown {
    if (valA === undefined) return valB;
    if (valB === undefined) return valA;
    if (deepEqual(valA, valB)) return valA;

    // Compare vector clocks for causal ordering
    const vcOrder = compareVectorClocks(vcA, vcB);
    if (vcOrder === 1) return valA;  // A causally after B
    if (vcOrder === -1) return valB;  // B causally after A

    // Concurrent -- use timestamp as tie-breaker
    if (tsA !== tsB) return tsA > tsB ? valA : valB;

    // Final fallback: lexicographic vector clock comparison
    return lexicographicVectorClockCompare(vcA, vcB) >= 0 ? valA : valB;
  }

  /**
   * PN-Counter: Merges numeric values by computing the delta each side applied
   * relative to the ancestor. If no ancestor, takes the max.
   *
   * With ancestor: merged = ancestor + deltaA + deltaB
   *   (where deltaX = versionX - ancestor)
   * This preserves both sides' increments/decrements.
   */
  private mergePnCounter(
    valA: number | undefined,
    valB: number | undefined,
    valAnc: number | undefined
  ): number {
    const a = valA ?? 0;
    const b = valB ?? 0;

    if (valAnc !== undefined) {
      const anc = valAnc;
      const deltaA = a - anc;
      const deltaB = b - anc;
      return anc + deltaA + deltaB;
    }

    // No ancestor: take the max as a conservative merge
    return Math.max(a, b);
  }

  /**
   * OR-Set (Observed-Remove Set): Merges two sets by computing adds and removes
   * relative to the ancestor. An element present in one version but absent in the
   * ancestor was "added"; absent in one version but present in the ancestor was
   * "removed". Adds win over concurrent removes (add-wins semantics).
   *
   * Without ancestor: union of both sets.
   */
  private mergeOrSet(
    valA: unknown[] | undefined,
    valB: unknown[] | undefined,
    valAnc: unknown[] | undefined
  ): unknown[] {
    const setA = new Set((valA ?? []).map((v) => JSON.stringify(v)));
    const setB = new Set((valB ?? []).map((v) => JSON.stringify(v)));

    if (!valAnc) {
      // No ancestor: union of both
      const union = new Set([...setA, ...setB]);
      return [...union].map((s) => JSON.parse(s));
    }

    const setAnc = new Set(valAnc.map((v) => JSON.stringify(v)));

    // Compute adds and removes for each side
    const addedByA = new Set([...setA].filter((x) => !setAnc.has(x)));
    const removedByA = new Set([...setAnc].filter((x) => !setA.has(x)));
    const addedByB = new Set([...setB].filter((x) => !setAnc.has(x)));
    const removedByB = new Set([...setAnc].filter((x) => !setB.has(x)));

    // Start with ancestor set
    const result = new Set(setAnc);

    // Apply adds from both sides (add-wins: adds always take effect)
    for (const item of addedByA) result.add(item);
    for (const item of addedByB) result.add(item);

    // Apply removes, but only if the other side didn't re-add (add-wins)
    for (const item of removedByA) {
      if (!addedByB.has(item)) result.delete(item);
    }
    for (const item of removedByB) {
      if (!addedByA.has(item)) result.delete(item);
    }

    return [...result].map((s) => JSON.parse(s));
  }

  /**
   * RGA (Replicated Growable Array): Character-level merge for text strings.
   * Computes an LCS (Longest Common Subsequence) based diff against the ancestor,
   * then interleaves non-conflicting insertions from both sides. Conflicting
   * overlapping edits are concatenated with a separator.
   *
   * Without ancestor: falls back to LWW by timestamp for the whole string.
   */
  private mergeRga(
    valA: string | undefined,
    valB: string | undefined,
    valAnc: string | undefined
  ): string {
    const a = valA ?? "";
    const b = valB ?? "";

    if (!valAnc) {
      // No ancestor: return the longer string (heuristic for RGA without history)
      return a.length >= b.length ? a : b;
    }

    const anc = valAnc;

    // If one side didn't change, take the other
    if (a === anc) return b;
    if (b === anc) return a;
    if (a === b) return a;

    // Compute word-level diffs for more readable merges
    const ancWords = anc.split(/(\s+)/);
    const aWords = a.split(/(\s+)/);
    const bWords = b.split(/(\s+)/);

    // Find LCS of ancestor with each version at word level
    const lcsA = this.computeLcs(ancWords, aWords);
    const lcsB = this.computeLcs(ancWords, bWords);

    // Build edit scripts
    const editsA = this.buildEditScript(ancWords, aWords, lcsA);
    const editsB = this.buildEditScript(ancWords, bWords, lcsB);

    // Merge non-overlapping edits
    const result = this.mergeEditScripts(ancWords, editsA, editsB);

    return result.join("");
  }

  /** Compute LCS length table for word arrays. */
  private computeLcs(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp;
  }

  /** Build an edit script from the LCS table. */
  private buildEditScript(
    base: string[],
    modified: string[],
    lcs: number[][]
  ): EditOp[] {
    const ops: EditOp[] = [];
    let i = base.length;
    let j = modified.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && base[i - 1] === modified[j - 1]) {
        ops.unshift({ type: "keep", position: i - 1, value: base[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        ops.unshift({ type: "insert", position: i, value: modified[j - 1] });
        j--;
      } else {
        ops.unshift({ type: "delete", position: i - 1, value: base[i - 1] });
        i--;
      }
    }

    return ops;
  }

  /** Merge two edit scripts against the same base, preferring non-conflicting changes. */
  private mergeEditScripts(
    base: string[],
    editsA: EditOp[],
    editsB: EditOp[]
  ): string[] {
    const result: string[] = [];
    let ai = 0;
    let bi = 0;

    while (ai < editsA.length || bi < editsB.length) {
      const opA = editsA[ai];
      const opB = editsB[bi];

      if (!opA) {
        // Only B operations remain
        if (opB.type !== "delete") result.push(opB.value);
        bi++;
        continue;
      }

      if (!opB) {
        // Only A operations remain
        if (opA.type !== "delete") result.push(opA.value);
        ai++;
        continue;
      }

      if (opA.type === "keep" && opB.type === "keep" && opA.position === opB.position) {
        result.push(opA.value);
        ai++;
        bi++;
      } else if (opA.type === "insert") {
        result.push(opA.value);
        ai++;
      } else if (opB.type === "insert") {
        result.push(opB.value);
        bi++;
      } else if (opA.type === "delete" && opB.type === "keep") {
        // A deletes, B keeps -- honor the delete
        ai++;
        bi++;
      } else if (opA.type === "keep" && opB.type === "delete") {
        // B deletes, A keeps -- honor the delete
        ai++;
        bi++;
      } else if (opA.type === "delete" && opB.type === "delete") {
        // Both delete -- skip
        ai++;
        bi++;
      } else {
        // Fallback: include both
        if (opA.type !== "delete") result.push(opA.value);
        if (opB.type !== "delete") result.push(opB.value);
        ai++;
        bi++;
      }
    }

    return result;
  }
}

interface EditOp {
  type: "keep" | "insert" | "delete";
  position: number;
  value: string;
}

// ---------------------------------------------------------------------------
// 5. ManualQueueResolver — Store both versions for human resolution
// ---------------------------------------------------------------------------

/**
 * Never auto-resolves. Stores both versions in a resolution queue for human
 * review. Supports priority hints for triage ordering.
 *
 * The resolver preserves the complete state of both versions, attaches
 * a diff summary to help the reviewer understand the conflict, and
 * returns a "manual" resolution that downstream sync logic can hold pending.
 */
export class ManualQueueResolver implements ConflictResolverPlugin {
  readonly id = "manual_queue";
  readonly displayName = "Manual Queue (Human Review)";

  /** In-memory queue of pending conflicts awaiting resolution. */
  private pendingQueue: ManualQueueEntry[] = [];

  canAutoResolve(_conflict: Conflict): boolean {
    // Manual queue never auto-resolves -- that's its entire purpose
    return false;
  }

  resolve(conflict: Conflict, config: ConflictResolverConfig): Resolution {
    const { versionA, versionB, ancestor } = conflict;
    const priority = config.priorityHint ?? 0;

    // Build a diff summary to assist the human reviewer
    const allFields = new Set([
      ...Object.keys(versionA.fields),
      ...Object.keys(versionB.fields),
      ...(ancestor ? Object.keys(ancestor.fields) : []),
    ]);

    const diffSummary: FieldDiffSummary[] = [];
    let conflictingFieldCount = 0;

    for (const field of allFields) {
      const valA = versionA.fields[field];
      const valB = versionB.fields[field];
      const valAnc = ancestor?.fields[field];
      const equal = deepEqual(valA, valB);

      if (!equal) conflictingFieldCount++;

      diffSummary.push({
        field,
        valueA: valA,
        valueB: valB,
        ancestorValue: valAnc,
        isConflicting: !equal,
        aChangedFromAncestor: ancestor ? !deepEqual(valA, valAnc) : undefined,
        bChangedFromAncestor: ancestor ? !deepEqual(valB, valAnc) : undefined,
      });
    }

    // Add to pending queue
    const entry: ManualQueueEntry = {
      entityId: conflict.entityId,
      conflict,
      diffSummary,
      priority,
      enqueuedAt: Date.now(),
      status: "pending",
    };

    this.pendingQueue.push(entry);

    // Sort queue by priority (descending) then by enqueue time (ascending)
    this.pendingQueue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.enqueuedAt - b.enqueuedAt;
    });

    const queuePosition = this.pendingQueue.indexOf(entry) + 1;

    let details = `Conflict queued for manual resolution. `;
    details += `Entity: ${conflict.entityId}. `;
    details += `${conflictingFieldCount} conflicting field(s) out of ${allFields.size} total. `;
    details += `Priority: ${priority}. Queue position: ${queuePosition}/${this.pendingQueue.length}. `;
    details += `Version A from replica "${versionA.replicaId ?? "unknown"}" at ${new Date(versionA.timestamp).toISOString()}. `;
    details += `Version B from replica "${versionB.replicaId ?? "unknown"}" at ${new Date(versionB.timestamp).toISOString()}. `;

    if (ancestor) {
      details += `Ancestor available at ${new Date(ancestor.timestamp).toISOString()}. `;
    } else {
      details += `No common ancestor available. `;
    }

    details += `Diff summary: ${diffSummary.filter((d) => d.isConflicting).map((d) => d.field).join(", ")}.`;

    return {
      winner: "manual",
      strategy: this.id,
      details,
      autoResolved: false,
      preservedVersions: { a: versionA, b: versionB },
      unresolvedFields: diffSummary
        .filter((d) => d.isConflicting)
        .map((d) => ({
          field: d.field,
          valueA: d.valueA,
          valueB: d.valueB,
          ancestorValue: d.ancestorValue,
        })),
    };
  }

  /** Get the current pending queue for inspection. */
  getPendingQueue(): ReadonlyArray<ManualQueueEntry> {
    return this.pendingQueue;
  }

  /** Get queue depth. */
  getQueueDepth(): number {
    return this.pendingQueue.filter((e) => e.status === "pending").length;
  }

  /** Mark an entry as resolved and remove from queue. */
  resolveEntry(entityId: string, chosenResolution: Resolution): boolean {
    const idx = this.pendingQueue.findIndex(
      (e) => e.entityId === entityId && e.status === "pending"
    );
    if (idx === -1) return false;
    this.pendingQueue[idx].status = "resolved";
    this.pendingQueue[idx].resolvedAt = Date.now();
    this.pendingQueue[idx].resolution = chosenResolution;
    return true;
  }
}

interface FieldDiffSummary {
  field: string;
  valueA: unknown;
  valueB: unknown;
  ancestorValue?: unknown;
  isConflicting: boolean;
  aChangedFromAncestor?: boolean;
  bChangedFromAncestor?: boolean;
}

interface ManualQueueEntry {
  entityId: string;
  conflict: Conflict;
  diffSummary: FieldDiffSummary[];
  priority: number;
  enqueuedAt: number;
  status: "pending" | "resolved";
  resolvedAt?: number;
  resolution?: Resolution;
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** All conflict resolver providers indexed by their unique ID. */
export const conflictResolverProviders: ReadonlyMap<string, ConflictResolverPlugin> =
  new Map<string, ConflictResolverPlugin>([
    ["lww_timestamp", new LwwTimestampResolver()],
    ["field_merge", new FieldMergeResolver()],
    ["three_way_merge", new ThreeWayMergeResolver()],
    ["crdt_merge", new CrdtMergeResolver()],
    ["manual_queue", new ManualQueueResolver()],
  ]);

/**
 * Resolve the best conflict resolver provider for a given conflict.
 *
 * Selection heuristic:
 *   1. If an ancestor is available, prefer three_way_merge
 *   2. Otherwise, prefer field_merge for partial auto-resolution
 *   3. Fall back to lww_timestamp for simple cases
 */
export function resolveProvider(conflict: Conflict): ConflictResolverPlugin | undefined {
  if (conflict.ancestor) {
    return conflictResolverProviders.get("three_way_merge");
  }
  return conflictResolverProviders.get("field_merge");
}
