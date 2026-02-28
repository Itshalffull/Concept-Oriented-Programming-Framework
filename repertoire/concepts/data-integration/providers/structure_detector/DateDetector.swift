// Date/time pattern detector — finds ISO 8601, US, European, natural language dates,
// times, and durations in text content

import Foundation

public struct DetectorConfig {
    public var options: [String: Any]?
    public var confidenceThreshold: Double?
    public init(options: [String: Any]? = nil, confidenceThreshold: Double? = nil) {
        self.options = options
        self.confidenceThreshold = confidenceThreshold
    }
}

public struct Detection {
    public let field: String
    public let value: Any
    public let type: String
    public let confidence: Double
    public let evidence: String
}

public enum DetectorError: Error {
    case parseError(String)
    case regexError(String)
}

private struct DatePattern {
    let regex: NSRegularExpression
    let field: String
    let type: String
    let confidence: Double
    let parse: ([String]) -> Any
}

public final class DateDetectorProvider {
    private static let months = [
        "january","february","march","april","may","june",
        "july","august","september","october","november","december"
    ]
    private static let monthAbbr = months.map { String($0.prefix(3)) }

    private let patterns: [DatePattern]

    public init() {
        var p: [DatePattern] = []

        // ISO 8601 full datetime
        if let r = try? NSRegularExpression(pattern: #"\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))\b"#) {
            p.append(DatePattern(regex: r, field: "date", type: "datetime", confidence: 0.98) { groups in groups[1] })
        }

        // ISO 8601 date only
        if let r = try? NSRegularExpression(pattern: #"\b(\d{4}-\d{2}-\d{2})\b"#) {
            p.append(DatePattern(regex: r, field: "date", type: "datetime", confidence: 0.95) { groups in groups[1] })
        }

        // US format: MM/DD/YYYY
        if let r = try? NSRegularExpression(pattern: #"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"#) {
            p.append(DatePattern(regex: r, field: "date", type: "datetime", confidence: 0.80) { groups in
                let m = String(format: "%02d", Int(groups[1]) ?? 0)
                let d = String(format: "%02d", Int(groups[2]) ?? 0)
                return "\(groups[3])-\(m)-\(d)"
            })
        }

        // European format: DD.MM.YYYY
        if let r = try? NSRegularExpression(pattern: #"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b"#) {
            p.append(DatePattern(regex: r, field: "date", type: "datetime", confidence: 0.80) { groups in
                let m = String(format: "%02d", Int(groups[2]) ?? 0)
                let d = String(format: "%02d", Int(groups[1]) ?? 0)
                return "\(groups[3])-\(m)-\(d)"
            })
        }

        // Natural language: March 15, 2026
        let monthPattern = (DateDetectorProvider.months + DateDetectorProvider.monthAbbr).joined(separator: "|")
        if let r = try? NSRegularExpression(pattern: "\\b(\(monthPattern))\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b", options: .caseInsensitive) {
            p.append(DatePattern(regex: r, field: "date", type: "datetime", confidence: 0.90) { groups in
                let lower = groups[1].lowercased()
                let idx = DateDetectorProvider.months.firstIndex(of: lower)
                    ?? DateDetectorProvider.monthAbbr.firstIndex(of: lower)
                    ?? 0
                let m = String(format: "%02d", idx + 1)
                let d = String(format: "%02d", Int(groups[2]) ?? 0)
                return "\(groups[3])-\(m)-\(d)"
            })
        }

        // Relative dates
        if let r = try? NSRegularExpression(pattern: #"(?i)\b(last|next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b"#) {
            p.append(DatePattern(regex: r, field: "date", type: "relative_datetime", confidence: 0.70) { groups in
                ["relative": groups[1].lowercased(), "unit": groups[2].lowercased()]
            })
        }

        // Time: 3:30 PM, 15:30
        if let r = try? NSRegularExpression(pattern: #"\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\b"#) {
            p.append(DatePattern(regex: r, field: "time", type: "datetime", confidence: 0.85) { groups in
                var hours = Int(groups[1]) ?? 0
                let minutes = groups[2]
                let seconds = groups[3].isEmpty ? "00" : groups[3]
                let meridiem = groups[4].uppercased()
                if meridiem == "PM" && hours < 12 { hours += 12 }
                if meridiem == "AM" && hours == 12 { hours = 0 }
                return String(format: "%02d:%@:%@", hours, minutes, seconds)
            })
        }

        // Duration: "2 hours", "3 days"
        if let r = try? NSRegularExpression(pattern: #"(?i)\b(\d+)\s+(second|minute|hour|day|week|month|year)s?\b"#) {
            p.append(DatePattern(regex: r, field: "duration", type: "duration", confidence: 0.85) { groups in
                ["amount": Int(groups[1]) ?? 0, "unit": groups[2].lowercased()] as [String: Any]
            })
        }

        self.patterns = p
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []
        var seen = Set<String>()

        for pattern in patterns {
            guard pattern.confidence >= threshold else { continue }
            let range = NSRange(text.startIndex..., in: text)
            let matches = pattern.regex.matches(in: text, range: range)
            for match in matches {
                var groups: [String] = []
                for i in 0..<match.numberOfRanges {
                    let r = match.range(at: i)
                    if r.location != NSNotFound, let swiftRange = Range(r, in: text) {
                        groups.append(String(text[swiftRange]))
                    } else {
                        groups.append("")
                    }
                }
                let evidence = groups[0]
                let key = "\(pattern.field):\(evidence)"
                guard !seen.contains(key) else { continue }
                seen.insert(key)

                detections.append(Detection(
                    field: pattern.field,
                    value: pattern.parse(groups),
                    type: pattern.type,
                    confidence: pattern.confidence,
                    evidence: evidence
                ))
            }
        }
        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown", "application/json"].contains(contentType)
    }
}
