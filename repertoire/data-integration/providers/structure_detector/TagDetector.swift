// Tag detector — finds #hashtags and @mentions in text content
// Normalizes CamelCase to kebab-case, deduplicates, strips trailing punctuation

import Foundation

public final class TagDetectorProvider {

    public init() {}

    private func camelToKebab(_ str: String) -> String {
        var result = ""
        let chars = Array(str)
        for (i, ch) in chars.enumerated() {
            if ch.isUppercase && i > 0 {
                let prev = chars[i - 1]
                if prev.isLowercase || prev.isNumber {
                    result.append("-")
                } else if i + 1 < chars.count && chars[i + 1].isLowercase {
                    result.append("-")
                }
            }
            result.append(ch.lowercased())
        }
        return result
    }

    private func stripTrailingPunctuation(_ str: String) -> String {
        var s = str
        let trailing: Set<Character> = [".", ",", ";", ":", "!", "?", ")"]
        while let last = s.last, trailing.contains(last) {
            s.removeLast()
        }
        return s
    }

    private func normalizeTag(_ raw: String) -> String {
        let stripped = stripTrailingPunctuation(raw)
        return camelToKebab(stripped)
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []

        // Detect hashtags
        let hashtagRegex = try NSRegularExpression(pattern: #"(?:^|\s)#([A-Za-z_]\w{0,138})\b"#, options: .anchorsMatchLines)
        let range = NSRange(text.startIndex..., in: text)
        var seenTags = Set<String>()
        var tagValues: [String] = []

        for match in hashtagRegex.matches(in: text, range: range) {
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let raw = String(text[r])
            let normalized = normalizeTag(raw)
            guard !normalized.isEmpty, !seenTags.contains(normalized) else { continue }
            seenTags.insert(normalized)

            let confidence = normalized.count >= 3 ? 0.90 : 0.75
            guard confidence >= threshold else { continue }

            tagValues.append(normalized)
            detections.append(Detection(
                field: "tags", value: normalized, type: "hashtag",
                confidence: confidence, evidence: "#\(raw)"
            ))
        }

        // Detect mentions
        let mentionRegex = try NSRegularExpression(pattern: #"(?:^|\s)@([A-Za-z_]\w{0,38})\b"#, options: .anchorsMatchLines)
        var seenMentions = Set<String>()
        var mentionValues: [String] = []

        for match in mentionRegex.matches(in: text, range: range) {
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let raw = String(text[r])
            let normalized = stripTrailingPunctuation(raw).lowercased()
            guard !normalized.isEmpty, !seenMentions.contains(normalized) else { continue }
            seenMentions.insert(normalized)

            let confidence = normalized.count >= 2 ? 0.90 : 0.70
            guard confidence >= threshold else { continue }

            mentionValues.append(normalized)
            detections.append(Detection(
                field: "mentions", value: normalized, type: "mention",
                confidence: confidence, evidence: "@\(raw)"
            ))
        }

        // Aggregate summaries
        if !tagValues.isEmpty {
            detections.append(Detection(
                field: "tags", value: tagValues, type: "hashtag_list",
                confidence: 0.90, evidence: "Found \(tagValues.count) hashtag(s)"
            ))
        }
        if !mentionValues.isEmpty {
            detections.append(Detection(
                field: "mentions", value: mentionValues, type: "mention_list",
                confidence: 0.90, evidence: "Found \(mentionValues.count) mention(s)"
            ))
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown", "application/json"].contains(contentType)
    }
}
