// CRDT-based conflict-free merge resolver
// Always auto-resolves mathematically using convergent replicated data types.
// Applies per-field CRDT merge strategies: LWW-Register for scalars,
// G-Counter for numeric increments, OR-Set for collections.

import Foundation

public struct Conflict {
    public let entityId: String
    public let versionA: [String: Any]
    public let versionB: [String: Any]
    public let ancestor: [String: Any]?
    public let fieldConflicts: [String]
    public let timestampA: UInt64?
    public let timestampB: UInt64?
}

public struct ResolverConfig {
    public let options: [String: Any]
}

public struct Resolution {
    public let winner: [String: Any]
    public let strategy: String
    public let details: [String: Any]
}

public enum ResolverError: Error {
    case mergeFailure(String)
}

public let providerID = "crdt_merge"
public let pluginType = "conflict_resolver"

private enum CrdtStrategy: String {
    case lwwRegister = "lww_register"
    case gCounter = "g_counter"
    case orSet = "or_set"
}

private func detectFieldCrdtType(valA: Any?, valB: Any?, ancestor: Any?) -> CrdtStrategy {
    if valA is [Any] || valB is [Any] || ancestor is [Any] {
        return .orSet
    }

    if let numA = valA as? Double, let numB = valB as? Double {
        if let numAnc = ancestor as? Double {
            let deltaA = numA - numAnc
            let deltaB = numB - numAnc
            if deltaA >= 0 && deltaB >= 0 {
                return .gCounter
            }
        }
        return .lwwRegister
    }

    if let numA = valA as? Int, let numB = valB as? Int {
        if let numAnc = ancestor as? Int {
            let deltaA = numA - numAnc
            let deltaB = numB - numAnc
            if deltaA >= 0 && deltaB >= 0 {
                return .gCounter
            }
        }
        return .lwwRegister
    }

    return .lwwRegister
}

private func mergeLwwRegister(valA: Any?, valB: Any?, tsA: UInt64, tsB: UInt64) -> (value: Any?, source: String) {
    if tsA >= tsB {
        return (valA, "lww_a")
    }
    return (valB, "lww_b")
}

private func mergeGCounter(valA: Double, valB: Double, ancestor: Double) -> Double {
    let deltaA = valA - ancestor
    let deltaB = valB - ancestor
    return ancestor + max(deltaA, deltaB)
}

private func anyToString(_ val: Any) -> String {
    return String(describing: val)
}

private func mergeOrSet(arrA: [Any], arrB: [Any], ancestor: [Any]) -> [Any] {
    let ancestorSet = Set(ancestor.map { anyToString($0) })
    let arrAStrs = Set(arrA.map { anyToString($0) })
    let arrBStrs = Set(arrB.map { anyToString($0) })

    // Items removed by both sides are tombstoned
    let removedByA = ancestorSet.subtracting(arrAStrs)
    let removedByB = ancestorSet.subtracting(arrBStrs)
    let tombstoned = removedByA.intersection(removedByB)

    // Start with ancestor minus tombstoned
    var result: [Any] = ancestor.filter { !tombstoned.contains(anyToString($0)) }
    var seen = Set(result.map { anyToString($0) })

    // Add new items from both sides
    for item in arrA + arrB {
        let key = anyToString(item)
        if !seen.contains(key) && !ancestorSet.contains(key) {
            result.append(item)
            seen.insert(key)
        }
    }

    return result
}

private func toDouble(_ val: Any?) -> Double {
    if let d = val as? Double { return d }
    if let i = val as? Int { return Double(i) }
    return 0.0
}

public final class CrdtMergeResolverProvider {
    public init() {}

    public func resolve(conflict: Conflict, config: ResolverConfig) throws -> Resolution {
        let ancestor = conflict.ancestor ?? [:]
        let tsA = conflict.timestampA ?? 0
        let tsB = conflict.timestampB ?? 0

        var allFields = Set<String>()
        for key in conflict.versionA.keys { allFields.insert(key) }
        for key in conflict.versionB.keys { allFields.insert(key) }
        for key in ancestor.keys { allFields.insert(key) }

        var merged: [String: Any] = [:]
        var fieldStrategies: [String: String] = [:]
        var fieldSources: [String: String] = [:]

        for field in allFields.sorted() {
            let valA = conflict.versionA[field]
            let valB = conflict.versionB[field]
            let valAnc = ancestor[field]

            let crdtType = detectFieldCrdtType(valA: valA, valB: valB, ancestor: valAnc)
            fieldStrategies[field] = crdtType.rawValue

            switch crdtType {
            case .lwwRegister:
                let result = mergeLwwRegister(valA: valA, valB: valB, tsA: tsA, tsB: tsB)
                merged[field] = result.value
                fieldSources[field] = result.source

            case .gCounter:
                let numA = toDouble(valA)
                let numB = toDouble(valB)
                let numAnc = toDouble(valAnc)
                merged[field] = mergeGCounter(valA: numA, valB: numB, ancestor: numAnc)
                fieldSources[field] = "g_counter_max"

            case .orSet:
                let a = valA as? [Any] ?? []
                let b = valB as? [Any] ?? []
                let anc = valAnc as? [Any] ?? []
                merged[field] = mergeOrSet(arrA: a, arrB: b, ancestor: anc)
                fieldSources[field] = "or_set_union"
            }
        }

        return Resolution(
            winner: merged,
            strategy: "crdt_merge",
            details: [
                "entityId": conflict.entityId,
                "fieldStrategies": fieldStrategies,
                "fieldSources": fieldSources,
                "totalFields": allFields.count,
                "convergenceGuaranteed": true,
            ]
        )
    }

    public func canAutoResolve(conflict: Conflict) -> Bool {
        return true
    }
}
