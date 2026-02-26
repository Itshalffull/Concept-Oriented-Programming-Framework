// Key-value detector — finds "Key: Value", "Key = Value", "Key -> Value" patterns
// Infers value types: numbers, dates, booleans, URLs, plain strings

import Foundation

private struct KvPattern {
    let regex: NSRegularExpression
    let confidence: Double
}

public final class KvDetectorProvider {

    public init() {}

    private func inferValueType(_ raw: String) -> (value: Any, type: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        let lower = trimmed.lowercased()

        // Boolean
        if ["true", "yes", "on"].contains(lower) { return (true, "boolean") }
        if ["false", "no", "off"].contains(lower) { return (false, "boolean") }

        // Integer
        if let n = Int(trimmed), trimmed.count <= 15 { return (n, "number") }

        // Float
        if trimmed.contains("."), let f = Double(trimmed) { return (f, "number") }

        // ISO date
        let datePattern = try? NSRegularExpression(pattern: #"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?"#)
        if let dp = datePattern, dp.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) != nil {
            return (trimmed, "date")
        }

        // URL
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return (trimmed, "url")
        }

        // Email
        let emailPattern = try? NSRegularExpression(pattern: #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#)
        if let ep = emailPattern, ep.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) != nil {
            return (trimmed, "email")
        }

        return (trimmed, "string")
    }

    private func normalizeKey(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespaces)
            .lowercased()
            .map { $0.isWhitespace ? "_" : $0 }
            .map(String.init)
            .joined()
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
    }

    private func buildPatterns() -> [KvPattern] {
        let specs: [(String, Double)] = [
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*:\s+(.+)$"#, 0.92),
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*=\s+(.+)$"#, 0.88),
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*->\s+(.+)$"#, 0.85),
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*=>\s+(.+)$"#, 0.85),
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s*\u{2192}\s+(.+)$"#, 0.85),
            (#"^([A-Za-z][A-Za-z0-9 _\-]{0,50})\s+-\s+(.+)$"#, 0.70),
        ]
        return specs.compactMap { (pattern, conf) in
            guard let re = try? NSRegularExpression(pattern: pattern, options: .anchorsMatchLines) else { return nil }
            return KvPattern(regex: re, confidence: conf)
        }
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        let patterns = buildPatterns()
        var detections: [Detection] = []
        var seen = Set<String>()

        for line in text.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { continue }
            let lineRange = NSRange(trimmed.startIndex..., in: trimmed)

            for pattern in patterns {
                guard let match = pattern.regex.firstMatch(in: trimmed, range: lineRange) else { continue }
                guard match.numberOfRanges >= 3,
                      let keyRange = Range(match.range(at: 1), in: trimmed),
                      let valRange = Range(match.range(at: 2), in: trimmed) else { continue }

                let rawKey = String(trimmed[keyRange])
                let rawValue = String(trimmed[valRange])
                let key = normalizeKey(rawKey)

                guard !key.isEmpty, key.count <= 50 else { continue }
                guard !rawValue.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                guard !seen.contains(key) else { continue }
                seen.insert(key)

                let (value, vtype) = inferValueType(rawValue)
                var confidence = pattern.confidence
                if vtype != "string" { confidence = min(confidence + 0.05, 0.99) }
                if rawKey.trimmingCharacters(in: .whitespaces).count <= 2 { confidence -= 0.15 }
                guard confidence >= threshold else { continue }

                detections.append(Detection(
                    field: key, value: value, type: vtype,
                    confidence: confidence, evidence: trimmed
                ))
                break // first matching separator wins
            }
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/markdown", "text/yaml", "application/x-yaml"].contains(contentType)
    }
}
