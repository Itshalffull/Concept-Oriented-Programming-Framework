// Quality Rule Provider: Reconciliation Validation
// Matches field values against external knowledge bases for accuracy verification.
// Dimension: accuracy

import Foundation

public struct KBMatch {
    public let canonicalValue: String
    public let confidence: Double
    public let source: String
}

public final class ReconciliationQualityProvider {
    public typealias KBQueryHandler = (String, [String: Any]) async throws -> [KBMatch]
    private var knowledgeBaseHandlers: [String: KBQueryHandler] = [:]

    public init() {}

    /// Register a custom knowledge base query handler for async reconciliation.
    public func registerKnowledgeBase(name: String, handler: @escaping KBQueryHandler) {
        knowledgeBaseHandlers[name] = handler
    }

    /// Synchronous validate using local dictionary matching.
    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "info")
        }

        let stringValue = String(describing: value)
        let matchThreshold = config.threshold ?? 0.8

        // Use local dictionary for synchronous reconciliation
        if let localValues = config.options?["localDictionary"] as? [String], !localValues.isEmpty {
            let bestMatch = findBestLocalMatch(value: stringValue, candidates: localValues)

            if bestMatch.confidence >= matchThreshold {
                if bestMatch.canonicalValue != stringValue {
                    return RuleResult(
                        valid: true,
                        message: "Field '\(field.name)': suggested canonical form is '\(bestMatch.canonicalValue)' (similarity: \(String(format: "%.1f", bestMatch.confidence * 100))%).",
                        severity: "info"
                    )
                }
                return RuleResult(valid: true, message: nil, severity: "info")
            }

            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(stringValue)' could not be reconciled. Best match: '\(bestMatch.canonicalValue)' (\(String(format: "%.1f", bestMatch.confidence * 100))%).",
                severity: "warning"
            )
        }

        return RuleResult(
            valid: true,
            message: "Field '\(field.name)': reconciliation requires async validation or a localDictionary config.",
            severity: "info"
        )
    }

    /// Async validate using registered knowledge base handlers.
    public func validateAsync(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) async -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "info")
        }

        let stringValue = String(describing: value)
        let matchThreshold = config.threshold ?? 0.8
        let knowledgeBase = config.options?["knowledgeBase"] as? String ?? "wikidata"

        guard let handler = knowledgeBaseHandlers[knowledgeBase] else {
            return RuleResult(
                valid: false,
                message: "Reconciliation rule for '\(field.name)': unknown knowledge base '\(knowledgeBase)'.",
                severity: "warning"
            )
        }

        do {
            let matches = try await handler(stringValue, config.options ?? [:])

            if matches.isEmpty {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value '\(stringValue)' not found in knowledge base '\(knowledgeBase)'.",
                    severity: "warning"
                )
            }

            let bestMatch = matches.max(by: { $0.confidence < $1.confidence })!

            if bestMatch.confidence >= matchThreshold {
                if bestMatch.canonicalValue != stringValue {
                    return RuleResult(
                        valid: true,
                        message: "Field '\(field.name)': canonical form is '\(bestMatch.canonicalValue)' (confidence: \(String(format: "%.1f", bestMatch.confidence * 100))%, source: \(bestMatch.source)).",
                        severity: "info"
                    )
                }
                return RuleResult(valid: true, message: nil, severity: "info")
            }

            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(stringValue)' has low confidence match (\(String(format: "%.1f", bestMatch.confidence * 100))%) against '\(knowledgeBase)'.",
                severity: "warning"
            )
        } catch {
            return RuleResult(
                valid: false,
                message: "Reconciliation error for '\(field.name)': \(error.localizedDescription)",
                severity: "warning"
            )
        }
    }

    private func findBestLocalMatch(value: String, candidates: [String]) -> (canonicalValue: String, confidence: Double) {
        let lowerValue = value.lowercased()
        var bestCanonical = candidates.first ?? ""
        var bestConfidence = 0.0

        for candidate in candidates {
            if lowerValue == candidate.lowercased() {
                return (canonicalValue: candidate, confidence: 1.0)
            }
            let similarity = jaroWinkler(s1: lowerValue, s2: candidate.lowercased())
            if similarity > bestConfidence {
                bestConfidence = similarity
                bestCanonical = candidate
            }
        }

        return (canonicalValue: bestCanonical, confidence: bestConfidence)
    }

    private func jaroWinkler(s1: String, s2: String) -> Double {
        if s1 == s2 { return 1.0 }
        let c1 = Array(s1)
        let c2 = Array(s2)
        let len1 = c1.count
        let len2 = c2.count
        if len1 == 0 || len2 == 0 { return 0.0 }

        let matchDistance = max(len1, len2) / 2 - 1
        var s1Matches = Array(repeating: false, count: len1)
        var s2Matches = Array(repeating: false, count: len2)
        var matches = 0
        var transpositions = 0

        for i in 0..<len1 {
            let start = max(0, i - matchDistance)
            let end = min(i + matchDistance + 1, len2)
            for j in start..<end {
                guard !s2Matches[j], c1[i] == c2[j] else { continue }
                s1Matches[i] = true
                s2Matches[j] = true
                matches += 1
                break
            }
        }

        if matches == 0 { return 0.0 }

        var k = 0
        for i in 0..<len1 {
            guard s1Matches[i] else { continue }
            while !s2Matches[k] { k += 1 }
            if c1[i] != c2[k] { transpositions += 1 }
            k += 1
        }

        let m = Double(matches)
        let jaro = (m / Double(len1) + m / Double(len2) + (m - Double(transpositions) / 2.0) / m) / 3.0

        var prefix = 0
        for i in 0..<min(4, min(len1, len2)) {
            if c1[i] == c2[i] { prefix += 1 }
            else { break }
        }

        return jaro + Double(prefix) * 0.1 * (1.0 - jaro)
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return field.type_.lowercased() == "string"
    }

    public func dimension() -> QualityDimension {
        return .accuracy
    }
}
