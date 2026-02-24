// Per-field comparison conflict resolver with partial auto-resolve capability
// Iterates all fields in both versions, comparing against the ancestor to determine
// which side changed each field. True conflicts arise only when both sides modified
// the same field to different values.

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

public let providerID = "field_merge"
public let pluginType = "conflict_resolver"

private func deepEqual(_ a: Any?, _ b: Any?) -> Bool {
    if a == nil && b == nil { return true }
    guard let a = a, let b = b else { return false }

    if let aStr = a as? String, let bStr = b as? String { return aStr == bStr }
    if let aNum = a as? Double, let bNum = b as? Double { return aNum == bNum }
    if let aInt = a as? Int, let bInt = b as? Int { return aInt == bInt }
    if let aBool = a as? Bool, let bBool = b as? Bool { return aBool == bBool }

    if let aDict = a as? [String: Any], let bDict = b as? [String: Any] {
        guard aDict.keys.count == bDict.keys.count else { return false }
        for key in aDict.keys {
            if !deepEqual(aDict[key], bDict[key]) { return false }
        }
        return true
    }

    if let aArr = a as? [Any], let bArr = b as? [Any] {
        guard aArr.count == bArr.count else { return false }
        for i in 0..<aArr.count {
            if !deepEqual(aArr[i], bArr[i]) { return false }
        }
        return true
    }

    return String(describing: a) == String(describing: b)
}

private func collectAllFields(_ records: [String: Any]?...) -> Set<String> {
    var fields = Set<String>()
    for rec in records {
        if let rec = rec {
            for key in rec.keys { fields.insert(key) }
        }
    }
    return fields
}

public final class FieldMergeResolverProvider {
    public init() {}

    public func resolve(conflict: Conflict, config: ResolverConfig) throws -> Resolution {
        let ancestor = conflict.ancestor ?? [:]
        let allFields = collectAllFields(conflict.versionA, conflict.versionB, ancestor)

        var merged: [String: Any] = [:]
        var autoMerged: [String] = []
        var trueConflicts: [String] = []
        var fieldDecisions: [String: String] = [:]

        for field in allFields.sorted() {
            let valAncestor = ancestor[field]
            let valA = conflict.versionA[field]
            let valB = conflict.versionB[field]

            let aChanged = !deepEqual(valAncestor, valA)
            let bChanged = !deepEqual(valAncestor, valB)

            if !aChanged && !bChanged {
                merged[field] = valAncestor
                fieldDecisions[field] = "unchanged"
            } else if aChanged && !bChanged {
                merged[field] = valA
                autoMerged.append(field)
                fieldDecisions[field] = "took_version_a"
            } else if !aChanged && bChanged {
                merged[field] = valB
                autoMerged.append(field)
                fieldDecisions[field] = "took_version_b"
            } else if deepEqual(valA, valB) {
                merged[field] = valA
                autoMerged.append(field)
                fieldDecisions[field] = "both_agree"
            } else {
                trueConflicts.append(field)
                merged[field] = valA
                fieldDecisions[field] = "conflict_defaulted_to_a"
            }
        }

        return Resolution(
            winner: merged,
            strategy: "field_merge",
            details: [
                "entityId": conflict.entityId,
                "autoMergedFields": autoMerged,
                "trueConflicts": trueConflicts,
                "fieldDecisions": fieldDecisions,
                "totalFields": allFields.count,
                "autoMergedCount": autoMerged.count,
                "trueConflictCount": trueConflicts.count,
                "fullyResolved": trueConflicts.isEmpty,
            ]
        )
    }

    public func canAutoResolve(conflict: Conflict) -> Bool {
        let ancestor = conflict.ancestor ?? [:]
        let allFields = collectAllFields(conflict.versionA, conflict.versionB, ancestor)

        for field in allFields {
            let valAncestor = ancestor[field]
            let valA = conflict.versionA[field]
            let valB = conflict.versionB[field]

            let aChanged = !deepEqual(valAncestor, valA)
            let bChanged = !deepEqual(valAncestor, valB)

            if aChanged && bChanged && !deepEqual(valA, valB) {
                return false
            }
        }

        return true
    }
}
