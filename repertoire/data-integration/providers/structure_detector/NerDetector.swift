// Named entity recognition detector — rule-based NER using capitalization patterns,
// known location lists, date patterns, and context heuristics

import Foundation

public final class NerDetectorProvider {

    private let personPrefixes: Set<String> = [
        "mr", "mrs", "ms", "dr", "prof", "sir", "madam", "president", "ceo", "cto",
        "director", "senator", "governor", "judge", "captain", "general"
    ]

    private let orgSuffixes: Set<String> = [
        "inc", "corp", "ltd", "llc", "co", "company", "corporation", "group",
        "foundation", "institute", "university", "association", "organization",
        "bank", "hospital", "agency", "department", "committee"
    ]

    private let knownLocations: Set<String> = [
        "new york", "los angeles", "chicago", "london", "paris", "tokyo", "berlin",
        "sydney", "toronto", "san francisco", "washington", "boston", "seattle",
        "amsterdam", "beijing", "shanghai", "mumbai", "dubai", "singapore",
        "california", "texas", "florida", "europe", "asia", "africa", "america",
        "united states", "united kingdom", "canada", "australia", "germany",
        "france", "japan", "china", "india", "brazil", "mexico", "russia"
    ]

    private let locationContext: Set<String> = [
        "in", "at", "from", "near", "to", "across", "throughout", "between",
        "around", "city", "state", "country", "region", "province", "county"
    ]

    private let personContext: Set<String> = [
        "said", "says", "told", "asked", "wrote", "met", "called", "named",
        "according", "by", "with", "interview"
    ]

    public init() {}

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []
        var seen = Set<String>()

        // Capitalized word sequences
        let capsRegex = try NSRegularExpression(pattern: #"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b"#)
        let fullRange = NSRange(text.startIndex..., in: text)

        for match in capsRegex.matches(in: text, range: fullRange) {
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let span = String(text[r])
            let start = text.distance(from: text.startIndex, to: r.lowerBound)
            let end = text.distance(from: text.startIndex, to: r.upperBound)
            let words = span.split(separator: " ").map(String.init)
            guard !words.isEmpty else { continue }

            // Context: word before
            let beforeStart = text.index(text.startIndex, offsetBy: max(0, start - 30))
            let beforeEnd = text.index(text.startIndex, offsetBy: start)
            let beforeText = String(text[beforeStart..<beforeEnd]).lowercased()
            let wordBefore = beforeText.split(separator: " ").last.map(String.init) ?? ""

            // Context: word after
            let afterStart = text.index(text.startIndex, offsetBy: end)
            let afterEnd = text.index(text.startIndex, offsetBy: min(text.count, end + 30))
            let afterText = String(text[afterStart..<afterEnd]).lowercased()
            let wordAfter = afterText.split(separator: " ").first.map(String.init) ?? ""

            var entityType = "UNKNOWN"
            var confidence = 0.50

            let cleanBefore = wordBefore.trimmingCharacters(in: CharacterSet(charactersIn: "."))
            if personPrefixes.contains(cleanBefore) {
                entityType = "PERSON"; confidence = 0.92
            } else if personContext.contains(wordAfter) || personContext.contains(wordBefore) {
                entityType = "PERSON"; confidence = 0.78
            } else if knownLocations.contains(span.lowercased()) {
                entityType = "LOC"; confidence = 0.90
            } else if locationContext.contains(wordBefore) {
                entityType = "LOC"; confidence = 0.75
            } else if orgSuffixes.contains(words.last?.lowercased() ?? "") {
                entityType = "ORG"; confidence = 0.88
            } else if words.count >= 2 && words.count <= 3 {
                entityType = "PERSON"; confidence = 0.60
            }

            guard entityType != "UNKNOWN", confidence >= threshold else { continue }
            let key = "\(entityType):\(span.lowercased())"
            guard !seen.contains(key) else { continue }
            seen.insert(key)

            detections.append(Detection(
                field: "entity_\(entityType.lowercased())",
                value: ["text": span, "start": start, "end": end] as [String: Any],
                type: entityType,
                confidence: confidence,
                evidence: span
            ))
        }

        // CONTACT entities (email)
        let emailRegex = try NSRegularExpression(pattern: #"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b"#)
        for match in emailRegex.matches(in: text, range: fullRange) {
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let email = String(text[r]).lowercased()
            let key = "CONTACT:\(email)"
            guard !seen.contains(key) else { continue }
            seen.insert(key)

            let start = text.distance(from: text.startIndex, to: r.lowerBound)
            let end = text.distance(from: text.startIndex, to: r.upperBound)

            detections.append(Detection(
                field: "entity_contact",
                value: ["text": email, "start": start, "end": end] as [String: Any],
                type: "CONTACT",
                confidence: 0.95,
                evidence: email
            ))
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown"].contains(contentType)
    }
}
