// Quality Rule Provider: No Duplicates (Record-Level Deduplication)
// Detects duplicate records using exact match, fuzzy, or phonetic strategies.
// Dimension: uniqueness

import Foundation

public final class NoDuplicatesQualityProvider {
    private var seenRecords: [(id: String, fields: [String: String])] = []

    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        let fields = config.options?["fields"] as? [String] ?? [field.name]
        let strategy = config.options?["strategy"] as? String ?? "exact"
        let threshold = config.threshold ?? 0.8
        let recordId = record["_id"] as? String ?? String(seenRecords.count)

        var signature: [String: String] = [:]
        for f in fields {
            signature[f] = record[f].map { String(describing: $0) } ?? ""
        }

        var duplicates: [String] = []
        for seen in seenRecords {
            if compareRecords(a: signature, b: seen.fields, strategy: strategy, threshold: threshold) {
                duplicates.append(seen.id)
            }
        }

        seenRecords.append((id: recordId, fields: signature))

        if !duplicates.isEmpty {
            let dupList = duplicates.joined(separator: ", ")
            let fieldList = fields.joined(separator: ", ")
            return RuleResult(
                valid: false,
                message: "Record '\(recordId)' is a duplicate of [\(dupList)] using '\(strategy)' strategy on fields [\(fieldList)].",
                severity: "warning"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "warning")
    }

    private func compareRecords(a: [String: String], b: [String: String], strategy: String, threshold: Double) -> Bool {
        switch strategy {
        case "exact":
            return a.allSatisfy { key, val in b[key] == val }

        case "fuzzy":
            let similarities = a.map { key, val in
                levenshteinSimilarity(a: val, b: b[key] ?? "")
            }
            let avg = similarities.reduce(0.0, +) / Double(similarities.count)
            return avg >= threshold

        case "phonetic":
            return a.allSatisfy { key, val in
                soundex(val) == soundex(b[key] ?? "")
            }

        default:
            return a.allSatisfy { key, val in b[key] == val }
        }
    }

    private func levenshteinSimilarity(a: String, b: String) -> Double {
        if a == b { return 1.0 }
        let maxLen = max(a.count, b.count)
        if maxLen == 0 { return 1.0 }

        let aChars = Array(a)
        let bChars = Array(b)
        var matrix = Array(repeating: Array(repeating: 0, count: b.count + 1), count: a.count + 1)

        for i in 0...a.count { matrix[i][0] = i }
        for j in 0...b.count { matrix[0][j] = j }

        for i in 1...a.count {
            for j in 1...b.count {
                let cost = aChars[i - 1] == bChars[j - 1] ? 0 : 1
                matrix[i][j] = min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                )
            }
        }

        let distance = matrix[a.count][b.count]
        return 1.0 - Double(distance) / Double(maxLen)
    }

    private func soundex(_ str: String) -> String {
        let upper = str.uppercased().filter { $0.isLetter }
        if upper.isEmpty { return "0000" }

        let chars = Array(upper)
        var result = String(chars[0])

        let codeFor: (Character) -> Character? = { c in
            switch c {
            case "B", "F", "P", "V": return "1"
            case "C", "G", "J", "K", "Q", "S", "X", "Z": return "2"
            case "D", "T": return "3"
            case "L": return "4"
            case "M", "N": return "5"
            case "R": return "6"
            default: return nil
            }
        }

        var lastCode = codeFor(chars[0])

        for i in 1..<chars.count {
            guard result.count < 4 else { break }
            let code = codeFor(chars[i])
            if let c = code, c != lastCode {
                result.append(c)
            }
            lastCode = code ?? lastCode
        }

        while result.count < 4 {
            result.append("0")
        }
        return result
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return true
    }

    public func dimension() -> QualityDimension {
        return .uniqueness
    }

    public func reset() {
        seenRecords.removeAll()
    }
}
