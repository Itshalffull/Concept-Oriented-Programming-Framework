// Three-way merge conflict resolver — diffs both versions against a common ancestor
// Computes diff(ancestor, versionA) and diff(ancestor, versionB), merges non-overlapping
// changes cleanly. For text fields, attempts line-by-line three-way merge similar to git.

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

public let providerID = "three_way_merge"
public let pluginType = "conflict_resolver"

private struct FieldDiff {
    let field: String
    let oldValue: Any?
    let newValue: Any?
}

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

private func computeDiff(ancestor: [String: Any], version: [String: Any]) -> [FieldDiff] {
    var diffs: [FieldDiff] = []
    var allKeys = Set<String>()
    for key in ancestor.keys { allKeys.insert(key) }
    for key in version.keys { allKeys.insert(key) }

    for key in allKeys.sorted() {
        if !deepEqual(ancestor[key], version[key]) {
            diffs.append(FieldDiff(field: key, oldValue: ancestor[key], newValue: version[key]))
        }
    }
    return diffs
}

private func threeWayTextMerge(ancestor: String, textA: String, textB: String) -> (merged: String, hasConflict: Bool) {
    let ancestorLines = ancestor.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    let linesA = textA.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    let linesB = textB.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    let maxLen = max(ancestorLines.count, max(linesA.count, linesB.count))

    var mergedLines: [String] = []
    var hasConflict = false

    for i in 0..<maxLen {
        let orig = i < ancestorLines.count ? ancestorLines[i] : ""
        let lineA = i < linesA.count ? linesA[i] : ""
        let lineB = i < linesB.count ? linesB[i] : ""

        let aChanged = orig != lineA
        let bChanged = orig != lineB

        if !aChanged && !bChanged {
            mergedLines.append(orig)
        } else if aChanged && !bChanged {
            mergedLines.append(lineA)
        } else if !aChanged && bChanged {
            mergedLines.append(lineB)
        } else if lineA == lineB {
            mergedLines.append(lineA)
        } else {
            hasConflict = true
            mergedLines.append("<<<<<<< version_a")
            mergedLines.append(lineA)
            mergedLines.append("=======")
            mergedLines.append(lineB)
            mergedLines.append(">>>>>>> version_b")
        }
    }

    return (mergedLines.joined(separator: "\n"), hasConflict)
}

public final class ThreeWayMergeResolverProvider {
    public init() {}

    public func resolve(conflict: Conflict, config: ResolverConfig) throws -> Resolution {
        let ancestor = conflict.ancestor ?? [:]
        let diffA = computeDiff(ancestor: ancestor, version: conflict.versionA)
        let diffB = computeDiff(ancestor: ancestor, version: conflict.versionB)

        let diffAFields = Set(diffA.map { $0.field })
        let diffBFields = Set(diffB.map { $0.field })

        var merged = ancestor
        var cleanMerges: [String] = []
        var overlappingConflicts: [String] = []
        var textMerges: [String] = []

        // Apply non-overlapping diffs from A
        for diff in diffA where !diffBFields.contains(diff.field) {
            merged[diff.field] = diff.newValue
            cleanMerges.append(diff.field)
        }

        // Apply non-overlapping diffs from B
        for diff in diffB where !diffAFields.contains(diff.field) {
            merged[diff.field] = diff.newValue
            cleanMerges.append(diff.field)
        }

        // Handle overlapping changes
        for diff in diffA where diffBFields.contains(diff.field) {
            let valA = conflict.versionA[diff.field]
            let valB = conflict.versionB[diff.field]

            if deepEqual(valA, valB) {
                merged[diff.field] = valA
                cleanMerges.append(diff.field)
            } else if let strA = valA as? String, let strB = valB as? String {
                let ancestorText = ancestor[diff.field] as? String ?? ""
                let result = threeWayTextMerge(ancestor: ancestorText, textA: strA, textB: strB)
                merged[diff.field] = result.merged
                if result.hasConflict {
                    overlappingConflicts.append(diff.field)
                } else {
                    textMerges.append(diff.field)
                }
            } else {
                merged[diff.field] = valA
                overlappingConflicts.append(diff.field)
            }
        }

        return Resolution(
            winner: merged,
            strategy: "three_way_merge",
            details: [
                "entityId": conflict.entityId,
                "diffSetA": diffA.map { $0.field },
                "diffSetB": diffB.map { $0.field },
                "cleanMerges": cleanMerges,
                "textMerges": textMerges,
                "overlappingConflicts": overlappingConflicts,
                "hasAncestor": conflict.ancestor != nil,
                "fullyResolved": overlappingConflicts.isEmpty,
            ]
        )
    }

    public func canAutoResolve(conflict: Conflict) -> Bool {
        let ancestor = conflict.ancestor ?? [:]
        let diffA = computeDiff(ancestor: ancestor, version: conflict.versionA)
        let diffB = computeDiff(ancestor: ancestor, version: conflict.versionB)

        let diffAFields = Set(diffA.map { $0.field })

        for diff in diffB where diffAFields.contains(diff.field) {
            let valA = conflict.versionA[diff.field]
            let valB = conflict.versionB[diff.field]
            if !deepEqual(valA, valB) {
                return false
            }
        }

        return true
    }
}
