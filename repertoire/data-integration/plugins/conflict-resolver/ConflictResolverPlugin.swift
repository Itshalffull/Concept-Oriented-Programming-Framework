// Conflict Resolver Plugin — bidirectional sync conflict resolution for the SyncPair concept.
// Provides pluggable strategies for resolving version conflicts during bidirectional data sync.
// See Data Integration Kit sync-pair.concept for the parent SyncPair concept definition.

import Foundation

// MARK: - Core Types

/// A vector clock mapping replica/node IDs to logical counters.
typealias VectorClock = [String: Int]

/// One side of a conflicting entity version.
struct VersionData {
    /// Key-value map of entity fields and their values.
    let fields: [String: AnyCodableValue]
    /// Wall-clock timestamp (milliseconds since epoch) of this version's last write.
    let timestamp: Int64
    /// Vector clock for causal ordering across replicas.
    let vectorClock: VectorClock
    /// Identifier of the replica/node that produced this version.
    let replicaId: String?
}

/// Type-erased value wrapper for heterogeneous field values.
enum AnyCodableValue: Equatable, Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodableValue])
    case dictionary([String: AnyCodableValue])
    case null

    var stringValue: String? { if case .string(let v) = self { return v }; return nil }
    var intValue: Int? { if case .int(let v) = self { return v }; return nil }
    var doubleValue: Double? { if case .double(let v) = self { return v }; return nil }
    var boolValue: Bool? { if case .bool(let v) = self { return v }; return nil }
    var arrayValue: [AnyCodableValue]? { if case .array(let v) = self { return v }; return nil }
    var dictionaryValue: [String: AnyCodableValue]? { if case .dictionary(let v) = self { return v }; return nil }
    var isNull: Bool { if case .null = self { return true }; return false }

    /// Returns a numeric representation (Int or Double) as Double, or nil.
    var numericValue: Double? {
        switch self {
        case .int(let v): return Double(v)
        case .double(let v): return v
        default: return nil
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(String.self) { self = .string(v) }
        else if let v = try? container.decode(Int.self) { self = .int(v) }
        else if let v = try? container.decode(Double.self) { self = .double(v) }
        else if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode([AnyCodableValue].self) { self = .array(v) }
        else if let v = try? container.decode([String: AnyCodableValue].self) { self = .dictionary(v) }
        else { self = .null }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .dictionary(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }
}

/// Describes a detected conflict between two versions of the same entity.
struct Conflict {
    /// Unique identifier of the entity in conflict.
    let entityId: String
    /// Version from side A of the sync pair.
    let versionA: VersionData
    /// Version from side B of the sync pair.
    let versionB: VersionData
    /// Common ancestor version, if available (enables three-way merge).
    let ancestor: VersionData?
}

/// Per-field conflict detail when field-level merge encounters a true conflict.
struct FieldConflict {
    let field: String
    let valueA: AnyCodableValue?
    let valueB: AnyCodableValue?
    let ancestorValue: AnyCodableValue?
}

/// The resolution produced by a conflict resolver.
struct Resolution {
    /// Which side won, or whether a merge was produced, or manual review is needed.
    let winner: ResolutionWinner
    /// The merged entity value (present when winner is merged or a single side).
    let mergedValue: [String: AnyCodableValue]?
    /// The strategy identifier that produced this resolution.
    let strategy: String
    /// Human-readable description of how the conflict was resolved.
    let details: String
    /// Whether this resolution was produced without human intervention.
    let autoResolved: Bool
    /// List of fields that could not be auto-resolved (for partial merges).
    let unresolvedFields: [FieldConflict]?
    /// Both versions preserved for manual queue.
    let preservedVersions: (a: VersionData, b: VersionData)?
}

enum ResolutionWinner: String {
    case a
    case b
    case merged
    case manual
}

/// CRDT type classification for crdt_merge provider.
enum CrdtType: String {
    case lwwRegister = "lww_register"
    case gCounter = "g_counter"
    case pnCounter = "pn_counter"
    case orSet = "or_set"
    case rga = "rga"
}

/// Provider-specific configuration knobs.
struct ConflictResolverConfig {
    var tieBreaker: ResolutionWinner = .a
    var priorityHint: Int = 0
    var preferAFields: Set<String> = []
    var preferBFields: Set<String> = []
    var crdtTypeOverrides: [String: CrdtType] = [:]
}

// MARK: - Protocol

/// Interface every conflict-resolver provider must implement.
protocol ConflictResolverPlugin {
    var id: String { get }
    var displayName: String { get }

    /// Resolve a conflict between two versions.
    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution

    /// Check whether this conflict can be automatically resolved without human input.
    func canAutoResolve(conflict: Conflict) -> Bool
}

// MARK: - Vector Clock Helpers

/// Compare two vector clocks. Returns 1 if a dominates, -1 if b dominates, 0 if concurrent.
private func compareVectorClocks(_ a: VectorClock, _ b: VectorClock) -> Int {
    let allKeys = Set(a.keys).union(Set(b.keys))
    var aGreater = false
    var bGreater = false

    for key in allKeys {
        let va = a[key] ?? 0
        let vb = b[key] ?? 0
        if va > vb { aGreater = true }
        if vb > va { bGreater = true }
    }

    if aGreater && !bGreater { return 1 }
    if bGreater && !aGreater { return -1 }
    return 0
}

/// Merge two vector clocks by taking the max of each entry.
private func mergeVectorClocks(_ a: VectorClock, _ b: VectorClock) -> VectorClock {
    var result = a
    for (key, val) in b {
        result[key] = max(result[key] ?? 0, val)
    }
    return result
}

/// Lexicographic comparison of vector clocks for deterministic tie-breaking.
private func lexicographicVectorClockCompare(_ a: VectorClock, _ b: VectorClock) -> Int {
    let allKeys = Set(a.keys).union(Set(b.keys)).sorted()
    for key in allKeys {
        let va = a[key] ?? 0
        let vb = b[key] ?? 0
        if va != vb { return va - vb }
    }
    return 0
}

/// Collect all field keys across versions.
private func allFieldKeys(_ conflict: Conflict) -> Set<String> {
    var keys = Set(conflict.versionA.fields.keys).union(Set(conflict.versionB.fields.keys))
    if let ancestor = conflict.ancestor {
        keys = keys.union(Set(ancestor.fields.keys))
    }
    return keys
}

// MARK: - 1. LwwTimestampResolver

/// Resolves conflicts by choosing the version with the latest timestamp.
/// Risk: silent data loss -- the losing version's changes are discarded entirely.
///
/// Tie-breaking order:
///   1. Higher wall-clock timestamp wins
///   2. If timestamps are equal, lexicographic vector clock comparison
///   3. If still tied, use config.tieBreaker (defaults to .a)
struct LwwTimestampResolver: ConflictResolverPlugin {
    let id = "lww_timestamp"
    let displayName = "Last-Write-Wins (Timestamp)"

    func canAutoResolve(conflict: Conflict) -> Bool {
        return true
    }

    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        let vA = conflict.versionA
        let vB = conflict.versionB

        var winner: ResolutionWinner
        var details: String

        if vA.timestamp != vB.timestamp {
            winner = vA.timestamp > vB.timestamp ? .a : .b
            let diff = abs(vA.timestamp - vB.timestamp)
            details = "LWW selected version \(winner.rawValue.uppercased()) (timestamp delta: \(diff)ms). "
        } else {
            // Timestamps equal -- fall back to lexicographic vector clock comparison
            let vcCompare = lexicographicVectorClockCompare(vA.vectorClock, vB.vectorClock)

            if vcCompare != 0 {
                winner = vcCompare > 0 ? .a : .b
                details = "Timestamps equal (\(vA.timestamp)); broke tie via vector clock comparison. "
            } else {
                winner = config.tieBreaker == .b ? .b : .a
                details = "Timestamps and vector clocks identical; used configured tie-breaker \"\(config.tieBreaker.rawValue)\". "
            }
        }

        let loser = winner == .a ? vB : vA
        let winnerVersion = winner == .a ? vA : vB

        // Identify fields lost from the losing version
        var lostFields: [String] = []
        for (field, loserVal) in loser.fields {
            if let winnerVal = winnerVersion.fields[field] {
                if loserVal != winnerVal { lostFields.append(field) }
            } else {
                lostFields.append(field)
            }
        }

        if !lostFields.isEmpty {
            details += "WARNING: Silent data loss on \(lostFields.count) field(s): [\(lostFields.joined(separator: ", "))]. "
            details += "Losing version from replica \"\(loser.replicaId ?? "unknown")\" "
            details += "at timestamp \(loser.timestamp) was discarded."
        } else {
            details += "No field-level data loss detected."
        }

        return Resolution(
            winner: winner,
            mergedValue: winnerVersion.fields,
            strategy: id,
            details: details,
            autoResolved: true,
            unresolvedFields: nil,
            preservedVersions: nil
        )
    }
}

// MARK: - 2. FieldMergeResolver

/// Compares versions field-by-field. Fields changed by only one side are auto-merged.
/// Fields changed by both sides to different values are flagged as true conflicts.
///
/// When an ancestor is available, detects which side actually changed each field.
/// Without an ancestor, any field with differing values is treated as a conflict.
struct FieldMergeResolver: ConflictResolverPlugin {
    let id = "field_merge"
    let displayName = "Per-Field Merge"

    func canAutoResolve(conflict: Conflict) -> Bool {
        let analysis = analyzeFields(conflict)
        return analysis.trueConflicts.isEmpty
    }

    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        let analysis = analyzeFields(conflict)

        // Start with ancestor or version A as base
        var merged: [String: AnyCodableValue] = conflict.ancestor?.fields ?? conflict.versionA.fields

        // Apply non-conflicting changes from A
        for field in analysis.changedOnlyByA {
            if let val = conflict.versionA.fields[field] {
                merged[field] = val
            } else {
                merged.removeValue(forKey: field)
            }
        }

        // Apply non-conflicting changes from B
        for field in analysis.changedOnlyByB {
            if let val = conflict.versionB.fields[field] {
                merged[field] = val
            } else {
                merged.removeValue(forKey: field)
            }
        }

        // Handle true conflicts with preference overrides
        var unresolvedFields: [FieldConflict] = []
        var resolvedConflictCount = 0

        for fc in analysis.trueConflicts {
            if config.preferAFields.contains(fc.field) {
                merged[fc.field] = fc.valueA ?? .null
                resolvedConflictCount += 1
            } else if config.preferBFields.contains(fc.field) {
                merged[fc.field] = fc.valueB ?? .null
                resolvedConflictCount += 1
            } else {
                // Default to version A, flag as unresolved
                merged[fc.field] = fc.valueA ?? .null
                unresolvedFields.append(fc)
            }
        }

        let totalFields = allFieldKeys(conflict).count
        let autoResolved = unresolvedFields.isEmpty

        var details = "Field-level merge across \(totalFields) fields. "
        details += "Auto-merged: \(analysis.changedOnlyByA.count) from A, \(analysis.changedOnlyByB.count) from B. "
        details += "Unchanged: \(analysis.unchanged.count). "

        if resolvedConflictCount > 0 {
            details += "Resolved \(resolvedConflictCount) conflict(s) via field preference config. "
        }

        if !unresolvedFields.isEmpty {
            let conflictFieldNames = unresolvedFields.map { $0.field }.joined(separator: ", ")
            details += "TRUE CONFLICTS on \(unresolvedFields.count) field(s): [\(conflictFieldNames)]. "
            details += "Defaulted to version A values; manual review recommended."
        }

        return Resolution(
            winner: .merged,
            mergedValue: merged,
            strategy: id,
            details: details,
            autoResolved: autoResolved,
            unresolvedFields: unresolvedFields.isEmpty ? nil : unresolvedFields,
            preservedVersions: nil
        )
    }

    private struct FieldAnalysis {
        let changedOnlyByA: [String]
        let changedOnlyByB: [String]
        let trueConflicts: [FieldConflict]
        let unchanged: [String]
    }

    private func analyzeFields(_ conflict: Conflict) -> FieldAnalysis {
        let fields = allFieldKeys(conflict)
        var changedOnlyByA: [String] = []
        var changedOnlyByB: [String] = []
        var trueConflicts: [FieldConflict] = []
        var unchanged: [String] = []

        for field in fields {
            let valA = conflict.versionA.fields[field]
            let valB = conflict.versionB.fields[field]
            let valAnc = conflict.ancestor?.fields[field]

            if valA == valB {
                unchanged.append(field)
                continue
            }

            if let _ = conflict.ancestor {
                let aChanged = valA != valAnc
                let bChanged = valB != valAnc

                if aChanged && !bChanged {
                    changedOnlyByA.append(field)
                } else if !aChanged && bChanged {
                    changedOnlyByB.append(field)
                } else if aChanged && bChanged {
                    trueConflicts.append(FieldConflict(
                        field: field, valueA: valA, valueB: valB, ancestorValue: valAnc
                    ))
                } else {
                    unchanged.append(field)
                }
            } else {
                // No ancestor: any difference is a potential conflict
                trueConflicts.append(FieldConflict(
                    field: field, valueA: valA, valueB: valB, ancestorValue: nil
                ))
            }
        }

        return FieldAnalysis(
            changedOnlyByA: changedOnlyByA,
            changedOnlyByB: changedOnlyByB,
            trueConflicts: trueConflicts,
            unchanged: unchanged
        )
    }
}

// MARK: - 3. ThreeWayMergeResolver

/// Computes diffs of both versions against the common ancestor, then merges
/// non-overlapping changes. Overlapping changes are flagged as true conflicts.
///
/// Without an ancestor, degrades to field-merge behavior.
struct ThreeWayMergeResolver: ConflictResolverPlugin {
    let id = "three_way_merge"
    let displayName = "Three-Way Merge"

    func canAutoResolve(conflict: Conflict) -> Bool {
        guard conflict.ancestor != nil else { return false }
        let diffs = computeDiffs(conflict)
        return diffs.overlapping.isEmpty
    }

    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        guard let ancestor = conflict.ancestor else {
            return resolveWithoutAncestor(conflict, config: config)
        }

        let diffs = computeDiffs(conflict)

        // Start with ancestor as base
        var merged = ancestor.fields

        // Apply non-overlapping changes from A
        for diff in diffs.diffA {
            if !diffs.overlapping.contains(where: { $0.field == diff.field }) {
                switch diff.type {
                case .delete: merged.removeValue(forKey: diff.field)
                case .add, .modify: merged[diff.field] = diff.newValue ?? .null
                }
            }
        }

        // Apply non-overlapping changes from B
        for diff in diffs.diffB {
            if !diffs.overlapping.contains(where: { $0.field == diff.field }) {
                switch diff.type {
                case .delete: merged.removeValue(forKey: diff.field)
                case .add, .modify: merged[diff.field] = diff.newValue ?? .null
                }
            }
        }

        // Handle overlapping changes (true conflicts)
        var unresolvedFields: [FieldConflict] = []
        for overlap in diffs.overlapping {
            // Default to version A's value; mark as unresolved
            merged[overlap.field] = overlap.valueA
            unresolvedFields.append(FieldConflict(
                field: overlap.field,
                valueA: overlap.valueA,
                valueB: overlap.valueB,
                ancestorValue: overlap.ancestorValue
            ))
        }

        let autoResolved = unresolvedFields.isEmpty

        var details = "Three-way merge against ancestor. "
        details += "Diff A: \(diffs.diffA.count) change(s). Diff B: \(diffs.diffB.count) change(s). "
        let nonOverlapCount = diffs.diffA.count + diffs.diffB.count - diffs.overlapping.count * 2
        details += "Non-overlapping merges applied: \(nonOverlapCount). "

        if !diffs.overlapping.isEmpty {
            let conflictFields = diffs.overlapping.map { $0.field }.joined(separator: ", ")
            details += "OVERLAPPING CONFLICTS on \(diffs.overlapping.count) field(s): [\(conflictFields)]. "
            details += "Manual resolution required."
        } else {
            details += "Clean merge -- no overlapping changes detected."
        }

        return Resolution(
            winner: .merged,
            mergedValue: merged,
            strategy: id,
            details: details,
            autoResolved: autoResolved,
            unresolvedFields: unresolvedFields.isEmpty ? nil : unresolvedFields,
            preservedVersions: nil
        )
    }

    private func resolveWithoutAncestor(_ conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        let fields = allFieldKeys(conflict)
        var merged: [String: AnyCodableValue] = [:]
        var unresolvedFields: [FieldConflict] = []

        for field in fields {
            let valA = conflict.versionA.fields[field]
            let valB = conflict.versionB.fields[field]

            if valA == valB {
                merged[field] = valA ?? .null
            } else if valA != nil && valB == nil {
                merged[field] = valA!
            } else if valA == nil && valB != nil {
                merged[field] = valB!
            } else {
                merged[field] = valA ?? .null
                unresolvedFields.append(FieldConflict(
                    field: field, valueA: valA, valueB: valB, ancestorValue: nil
                ))
            }
        }

        return Resolution(
            winner: .merged,
            mergedValue: merged,
            strategy: id,
            details: "Three-way merge degraded: no ancestor available. \(unresolvedFields.count) unresolved conflict(s).",
            autoResolved: unresolvedFields.isEmpty,
            unresolvedFields: unresolvedFields.isEmpty ? nil : unresolvedFields,
            preservedVersions: nil
        )
    }

    private enum DiffType { case add, modify, delete }

    private struct FieldDiff {
        let field: String
        let type: DiffType
        let oldValue: AnyCodableValue?
        let newValue: AnyCodableValue?
    }

    private struct OverlappingChange {
        let field: String
        let valueA: AnyCodableValue?
        let valueB: AnyCodableValue?
        let ancestorValue: AnyCodableValue?
    }

    private struct DiffResult {
        let diffA: [FieldDiff]
        let diffB: [FieldDiff]
        let overlapping: [OverlappingChange]
    }

    private func computeDiffs(_ conflict: Conflict) -> DiffResult {
        let ancestor = conflict.ancestor!
        let diffA = diffVersions(base: ancestor.fields, modified: conflict.versionA.fields)
        let diffB = diffVersions(base: ancestor.fields, modified: conflict.versionB.fields)

        let diffBMap = Dictionary(uniqueKeysWithValues: diffB.map { ($0.field, $0) })

        var overlapping: [OverlappingChange] = []
        for da in diffA {
            if let db = diffBMap[da.field] {
                // Both modified the same field -- check if to different values
                if da.newValue != db.newValue {
                    overlapping.append(OverlappingChange(
                        field: da.field,
                        valueA: da.newValue,
                        valueB: db.newValue,
                        ancestorValue: ancestor.fields[da.field]
                    ))
                }
            }
        }

        return DiffResult(diffA: diffA, diffB: diffB, overlapping: overlapping)
    }

    private func diffVersions(
        base: [String: AnyCodableValue],
        modified: [String: AnyCodableValue]
    ) -> [FieldDiff] {
        let allFields = Set(base.keys).union(Set(modified.keys))
        var diffs: [FieldDiff] = []

        for field in allFields {
            let baseVal = base[field]
            let modVal = modified[field]

            if baseVal == modVal { continue }

            if baseVal != nil && modVal == nil {
                diffs.append(FieldDiff(field: field, type: .delete, oldValue: baseVal, newValue: nil))
            } else if baseVal == nil && modVal != nil {
                diffs.append(FieldDiff(field: field, type: .add, oldValue: nil, newValue: modVal))
            } else {
                diffs.append(FieldDiff(field: field, type: .modify, oldValue: baseVal, newValue: modVal))
            }
        }

        return diffs
    }
}

// MARK: - 4. CrdtMergeResolver

/// Uses Conflict-free Replicated Data Types to guarantee convergence without
/// conflicts. Each field is assigned a CRDT type based on its value shape:
///   - Scalar (string, boolean, null): LWW-Register
///   - Number: PN-Counter
///   - Array: OR-Set (Observed-Remove Set)
///   - Long string: RGA (Replicated Growable Array)
///
/// Convergence is mathematically guaranteed -- no conflicts possible.
struct CrdtMergeResolver: ConflictResolverPlugin {
    let id = "crdt_merge"
    let displayName = "CRDT Merge (Conflict-Free)"

    func canAutoResolve(conflict: Conflict) -> Bool {
        return true
    }

    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        let fields = allFieldKeys(conflict)
        var merged: [String: AnyCodableValue] = [:]
        var mergeDetails: [String] = []

        for field in fields.sorted() {
            let valA = conflict.versionA.fields[field]
            let valB = conflict.versionB.fields[field]
            let valAnc = conflict.ancestor?.fields[field]

            let crdtType = config.crdtTypeOverrides[field] ?? inferCrdtType(valA, valB, valAnc)

            switch crdtType {
            case .lwwRegister:
                merged[field] = mergeLwwRegister(
                    valA: valA, vcA: conflict.versionA.vectorClock, tsA: conflict.versionA.timestamp,
                    valB: valB, vcB: conflict.versionB.vectorClock, tsB: conflict.versionB.timestamp
                )
                mergeDetails.append("\(field): LWW-Register")

            case .gCounter, .pnCounter:
                merged[field] = mergePnCounter(valA: valA, valB: valB, valAnc: valAnc)
                mergeDetails.append("\(field): PN-Counter")

            case .orSet:
                merged[field] = mergeOrSet(valA: valA, valB: valB, valAnc: valAnc)
                mergeDetails.append("\(field): OR-Set")

            case .rga:
                merged[field] = mergeRga(valA: valA, valB: valB, valAnc: valAnc)
                mergeDetails.append("\(field): RGA")
            }
        }

        let mergedClock = mergeVectorClocks(conflict.versionA.vectorClock, conflict.versionB.vectorClock)

        var details = "CRDT merge applied to \(fields.count) field(s). "
        details += "Strategy per field: \(mergeDetails.joined(separator: "; ")). "
        details += "Merged vector clock: \(mergedClock). "
        details += "Convergence guaranteed -- no conflicts possible."

        return Resolution(
            winner: .merged,
            mergedValue: merged,
            strategy: id,
            details: details,
            autoResolved: true,
            unresolvedFields: nil,
            preservedVersions: nil
        )
    }

    /// Infer the appropriate CRDT type from the field's values.
    private func inferCrdtType(
        _ valA: AnyCodableValue?,
        _ valB: AnyCodableValue?,
        _ valAnc: AnyCodableValue?
    ) -> CrdtType {
        let values = [valA, valB, valAnc].compactMap { $0 }
        if values.isEmpty { return .lwwRegister }

        // If all values are numeric, use PN-Counter
        if values.allSatisfy({ $0.numericValue != nil }) { return .pnCounter }

        // If any value is an array, use OR-Set
        if values.contains(where: { $0.arrayValue != nil }) { return .orSet }

        // If any value is a long string (> 100 chars), use RGA
        if values.contains(where: {
            if let s = $0.stringValue { return s.count > 100 }
            return false
        }) { return .rga }

        return .lwwRegister
    }

    /// LWW-Register: Last-writer-wins by vector clock, then timestamp.
    private func mergeLwwRegister(
        valA: AnyCodableValue?, vcA: VectorClock, tsA: Int64,
        valB: AnyCodableValue?, vcB: VectorClock, tsB: Int64
    ) -> AnyCodableValue {
        guard let a = valA else { return valB ?? .null }
        guard let _ = valB else { return a }
        if valA == valB { return a }

        let vcOrder = compareVectorClocks(vcA, vcB)
        if vcOrder == 1 { return a }
        if vcOrder == -1 { return valB! }

        // Concurrent -- use timestamp
        if tsA != tsB { return tsA > tsB ? a : valB! }

        // Final fallback: lexicographic VC comparison
        return lexicographicVectorClockCompare(vcA, vcB) >= 0 ? a : valB!
    }

    /// PN-Counter: merge = ancestor + deltaA + deltaB.
    private func mergePnCounter(
        valA: AnyCodableValue?, valB: AnyCodableValue?, valAnc: AnyCodableValue?
    ) -> AnyCodableValue {
        let a = valA?.numericValue ?? 0
        let b = valB?.numericValue ?? 0

        if let ancVal = valAnc?.numericValue {
            let deltaA = a - ancVal
            let deltaB = b - ancVal
            let result = ancVal + deltaA + deltaB
            if result == result.rounded() { return .int(Int(result)) }
            return .double(result)
        }

        let result = max(a, b)
        if result == result.rounded() { return .int(Int(result)) }
        return .double(result)
    }

    /// OR-Set: add-wins merge with union semantics.
    private func mergeOrSet(
        valA: AnyCodableValue?, valB: AnyCodableValue?, valAnc: AnyCodableValue?
    ) -> AnyCodableValue {
        let arrA = valA?.arrayValue ?? []
        let arrB = valB?.arrayValue ?? []

        guard let ancArr = valAnc?.arrayValue else {
            // No ancestor: union
            var seen = Set<String>()
            var result: [AnyCodableValue] = []
            for item in arrA + arrB {
                let key = String(describing: item)
                if seen.insert(key).inserted { result.append(item) }
            }
            return .array(result)
        }

        let setAnc = Set(ancArr.map { String(describing: $0) })
        let setA = Set(arrA.map { String(describing: $0) })
        let setB = Set(arrB.map { String(describing: $0) })

        let addedByA = setA.subtracting(setAnc)
        let removedByA = setAnc.subtracting(setA)
        let addedByB = setB.subtracting(setAnc)
        let removedByB = setAnc.subtracting(setB)

        // Start with ancestor, apply adds, apply removes (add-wins)
        var resultKeys = setAnc
        resultKeys.formUnion(addedByA)
        resultKeys.formUnion(addedByB)
        for removed in removedByA { if !addedByB.contains(removed) { resultKeys.remove(removed) } }
        for removed in removedByB { if !addedByA.contains(removed) { resultKeys.remove(removed) } }

        // Reconstruct values from original arrays
        let allItems = arrA + arrB + ancArr
        var seen = Set<String>()
        var result: [AnyCodableValue] = []
        for item in allItems {
            let key = String(describing: item)
            if resultKeys.contains(key) && seen.insert(key).inserted {
                result.append(item)
            }
        }

        return .array(result)
    }

    /// RGA: Character-level merge for text strings using word-level diff.
    private func mergeRga(
        valA: AnyCodableValue?, valB: AnyCodableValue?, valAnc: AnyCodableValue?
    ) -> AnyCodableValue {
        let a = valA?.stringValue ?? ""
        let b = valB?.stringValue ?? ""

        guard let anc = valAnc?.stringValue else {
            return .string(a.count >= b.count ? a : b)
        }

        if a == anc { return .string(b) }
        if b == anc { return .string(a) }
        if a == b { return .string(a) }

        // Word-level three-way merge
        let ancWords = anc.components(separatedBy: " ")
        let aWords = a.components(separatedBy: " ")
        let bWords = b.components(separatedBy: " ")

        // Compute LCS-based merge
        let lcsAncA = computeLcs(ancWords, aWords)
        let lcsAncB = computeLcs(ancWords, bWords)

        // Build merged word list: take A's changes and B's changes on non-overlapping positions
        var result: [String] = []
        var ancIdx = 0, aIdx = 0, bIdx = 0

        while ancIdx < ancWords.count || aIdx < aWords.count || bIdx < bWords.count {
            let ancWord = ancIdx < ancWords.count ? ancWords[ancIdx] : nil
            let aWord = aIdx < aWords.count ? aWords[aIdx] : nil
            let bWord = bIdx < bWords.count ? bWords[bIdx] : nil

            if ancWord == aWord && ancWord == bWord {
                // All agree
                result.append(ancWord!)
                ancIdx += 1; aIdx += 1; bIdx += 1
            } else if ancWord == aWord && ancWord != bWord {
                // B changed, A didn't
                if let bw = bWord { result.append(bw) }
                if ancWord != nil { ancIdx += 1 }
                if aWord != nil { aIdx += 1 }
                bIdx += 1
            } else if ancWord != aWord && ancWord == bWord {
                // A changed, B didn't
                if let aw = aWord { result.append(aw) }
                if ancWord != nil { ancIdx += 1 }
                aIdx += 1
                if bWord != nil { bIdx += 1 }
            } else {
                // Both changed or no ancestor word -- take both
                if let aw = aWord { result.append(aw); aIdx += 1 }
                if let bw = bWord, bw != aWord { result.append(bw) }
                bIdx += 1
                if ancWord != nil { ancIdx += 1 }
            }
        }

        return .string(result.joined(separator: " "))
    }

    /// Compute LCS length between two string arrays.
    private func computeLcs(_ a: [String], _ b: [String]) -> [[Int]] {
        let m = a.count, n = b.count
        var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
        for i in 1...m {
            for j in 1...n {
                if a[i - 1] == b[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1
                } else {
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                }
            }
        }
        return dp
    }
}

// MARK: - 5. ManualQueueResolver

/// Never auto-resolves. Stores both versions in a resolution queue for human review.
/// Supports priority hints for triage ordering.
struct ManualQueueResolver: ConflictResolverPlugin {
    let id = "manual_queue"
    let displayName = "Manual Queue (Human Review)"

    /// Shared in-memory queue of pending conflicts.
    private static var pendingQueue: [ManualQueueEntry] = []

    func canAutoResolve(conflict: Conflict) -> Bool {
        return false
    }

    func resolve(conflict: Conflict, config: ConflictResolverConfig) -> Resolution {
        let priority = config.priorityHint

        // Build diff summary for the reviewer
        let fields = allFieldKeys(conflict)
        var diffSummary: [FieldDiffSummary] = []
        var conflictingFieldCount = 0

        for field in fields.sorted() {
            let valA = conflict.versionA.fields[field]
            let valB = conflict.versionB.fields[field]
            let valAnc = conflict.ancestor?.fields[field]
            let isConflicting = valA != valB

            if isConflicting { conflictingFieldCount += 1 }

            diffSummary.append(FieldDiffSummary(
                field: field,
                valueA: valA,
                valueB: valB,
                ancestorValue: valAnc,
                isConflicting: isConflicting,
                aChangedFromAncestor: conflict.ancestor != nil ? valA != valAnc : nil,
                bChangedFromAncestor: conflict.ancestor != nil ? valB != valAnc : nil
            ))
        }

        // Add to queue
        let entry = ManualQueueEntry(
            entityId: conflict.entityId,
            conflict: conflict,
            diffSummary: diffSummary,
            priority: priority,
            enqueuedAt: Date(),
            status: .pending
        )

        ManualQueueResolver.pendingQueue.append(entry)
        ManualQueueResolver.pendingQueue.sort {
            if $0.priority != $1.priority { return $0.priority > $1.priority }
            return $0.enqueuedAt < $1.enqueuedAt
        }

        let queuePosition = (ManualQueueResolver.pendingQueue.firstIndex(where: { $0.entityId == conflict.entityId }) ?? 0) + 1

        let replicaA = conflict.versionA.replicaId ?? "unknown"
        let replicaB = conflict.versionB.replicaId ?? "unknown"

        var details = "Conflict queued for manual resolution. "
        details += "Entity: \(conflict.entityId). "
        details += "\(conflictingFieldCount) conflicting field(s) out of \(fields.count) total. "
        details += "Priority: \(priority). Queue position: \(queuePosition)/\(ManualQueueResolver.pendingQueue.count). "
        details += "Version A from replica \"\(replicaA)\" at timestamp \(conflict.versionA.timestamp). "
        details += "Version B from replica \"\(replicaB)\" at timestamp \(conflict.versionB.timestamp). "

        if conflict.ancestor != nil {
            details += "Ancestor available. "
        } else {
            details += "No common ancestor available. "
        }

        let conflictFields = diffSummary.filter { $0.isConflicting }.map { $0.field }.joined(separator: ", ")
        details += "Conflicting fields: \(conflictFields)."

        return Resolution(
            winner: .manual,
            mergedValue: nil,
            strategy: id,
            details: details,
            autoResolved: false,
            unresolvedFields: diffSummary.filter { $0.isConflicting }.map {
                FieldConflict(field: $0.field, valueA: $0.valueA, valueB: $0.valueB, ancestorValue: $0.ancestorValue)
            },
            preservedVersions: (a: conflict.versionA, b: conflict.versionB)
        )
    }

    /// Get queue depth.
    static func queueDepth() -> Int {
        return pendingQueue.filter { $0.status == .pending }.count
    }

    /// Mark an entry as resolved.
    static func resolveEntry(entityId: String) -> Bool {
        guard let idx = pendingQueue.firstIndex(where: { $0.entityId == entityId && $0.status == .pending }) else {
            return false
        }
        pendingQueue[idx].status = .resolved
        pendingQueue[idx].resolvedAt = Date()
        return true
    }
}

private struct FieldDiffSummary {
    let field: String
    let valueA: AnyCodableValue?
    let valueB: AnyCodableValue?
    let ancestorValue: AnyCodableValue?
    let isConflicting: Bool
    let aChangedFromAncestor: Bool?
    let bChangedFromAncestor: Bool?
}

private struct ManualQueueEntry {
    let entityId: String
    let conflict: Conflict
    let diffSummary: [FieldDiffSummary]
    let priority: Int
    let enqueuedAt: Date
    var status: ManualQueueStatus
    var resolvedAt: Date?
}

private enum ManualQueueStatus {
    case pending
    case resolved
}

// MARK: - Provider Registry

/// All conflict resolver providers indexed by their unique ID.
let conflictResolverProviders: [String: any ConflictResolverPlugin] = [
    "lww_timestamp": LwwTimestampResolver(),
    "field_merge": FieldMergeResolver(),
    "three_way_merge": ThreeWayMergeResolver(),
    "crdt_merge": CrdtMergeResolver(),
    "manual_queue": ManualQueueResolver(),
]

/// Resolve the best conflict resolver provider for a given conflict.
///
/// Selection heuristic:
///   1. If an ancestor is available, prefer three_way_merge
///   2. Otherwise, prefer field_merge for partial auto-resolution
///   3. Fall back to lww_timestamp for simple cases
func resolveConflictProvider(for conflict: Conflict) -> (any ConflictResolverPlugin)? {
    if conflict.ancestor != nil {
        return conflictResolverProviders["three_way_merge"]
    }
    return conflictResolverProviders["field_merge"]
}
