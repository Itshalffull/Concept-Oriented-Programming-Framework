// Manual queue conflict resolver — never auto-resolves
// Stores both versions in a queue with side-by-side field comparison,
// generates a human-readable diff, and marks conflicts as pending manual review.

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
    case queueFailure(String)
}

public let providerID = "manual_queue"
public let pluginType = "conflict_resolver"

private struct FieldComparison {
    let field: String
    let valueA: Any?
    let valueB: Any?
    let ancestorValue: Any?
    let isConflicting: Bool
    let diffDescription: String
}

private func formatValue(_ val: Any?) -> String {
    guard let val = val else { return "<undefined>" }
    if let str = val as? String { return str }
    if let num = val as? Double { return String(num) }
    if let num = val as? Int { return String(num) }
    if let bool = val as? Bool { return String(bool) }
    return String(describing: val)
}

private func valuesEqual(_ a: Any?, _ b: Any?) -> Bool {
    return formatValue(a) == formatValue(b)
}

private func generateFieldComparison(
    field: String,
    valA: Any?,
    valB: Any?,
    valAnc: Any?
) -> FieldComparison {
    let aStr = formatValue(valA)
    let bStr = formatValue(valB)
    let isConflicting = aStr != bStr

    let diffDescription: String
    if !isConflicting {
        diffDescription = "\(field): both versions agree = \(aStr)"
    } else if valAnc != nil {
        diffDescription = "\(field): ancestor=\(formatValue(valAnc)) | A=\(aStr) | B=\(bStr)"
    } else {
        diffDescription = "\(field): A=\(aStr) | B=\(bStr)"
    }

    return FieldComparison(
        field: field,
        valueA: valA,
        valueB: valB,
        ancestorValue: valAnc,
        isConflicting: isConflicting,
        diffDescription: diffDescription
    )
}

private func generateHumanReadableDiff(_ comparisons: [FieldComparison]) -> String {
    var lines = [
        "=== Conflict Review Required ===",
        "",
    ]

    let conflicting = comparisons.filter { $0.isConflicting }
    let agreeing = comparisons.filter { !$0.isConflicting }

    if !conflicting.isEmpty {
        lines.append("Conflicting fields (\(conflicting.count)):")
        for comp in conflicting {
            lines.append("  [!] \(comp.diffDescription)")
        }
        lines.append("")
    }

    if !agreeing.isEmpty {
        lines.append("Agreeing fields (\(agreeing.count)):")
        for comp in agreeing {
            lines.append("  [=] \(comp.diffDescription)")
        }
    }

    return lines.joined(separator: "\n")
}

private func buildConflictMarkerRecord(_ comparisons: [FieldComparison]) -> [String: Any] {
    var merged: [String: Any] = [:]
    for comp in comparisons {
        if comp.isConflicting {
            merged[comp.field] = [
                "__conflict": true,
                "versionA": comp.valueA as Any,
                "versionB": comp.valueB as Any,
                "ancestor": comp.ancestorValue as Any,
            ] as [String: Any]
        } else {
            merged[comp.field] = comp.valueA
        }
    }
    return merged
}

public final class ManualQueueResolverProvider {
    public init() {}

    public func resolve(conflict: Conflict, config: ResolverConfig) throws -> Resolution {
        let ancestor = conflict.ancestor ?? [:]
        var allFields = Set<String>()
        for key in conflict.versionA.keys { allFields.insert(key) }
        for key in conflict.versionB.keys { allFields.insert(key) }
        for key in ancestor.keys { allFields.insert(key) }

        var comparisons: [FieldComparison] = []
        for field in allFields.sorted() {
            comparisons.append(generateFieldComparison(
                field: field,
                valA: conflict.versionA[field],
                valB: conflict.versionB[field],
                valAnc: ancestor[field]
            ))
        }

        let humanReadableDiff = generateHumanReadableDiff(comparisons)
        let markerRecord = buildConflictMarkerRecord(comparisons)

        let conflictingFields = comparisons.filter { $0.isConflicting }.map { $0.field }
        let agreeingFields = comparisons.filter { !$0.isConflicting }.map { $0.field }

        return Resolution(
            winner: markerRecord,
            strategy: "manual_queue",
            details: [
                "status": "pending_manual_review",
                "entityId": conflict.entityId,
                "humanReadableDiff": humanReadableDiff,
                "conflictingFields": conflictingFields,
                "agreeingFields": agreeingFields,
                "totalFields": allFields.count,
                "conflictCount": conflictingFields.count,
                "versionA": conflict.versionA,
                "versionB": conflict.versionB,
            ]
        )
    }

    public func canAutoResolve(conflict: Conflict) -> Bool {
        return false
    }
}
