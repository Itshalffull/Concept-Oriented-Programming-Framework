// URL/email/phone detector — finds URLs, email addresses, and phone numbers
// Validates URL structure, normalizes phone numbers to E.164 format

import Foundation

public final class UrlDetectorProvider {

    private let defaultCountryCode = "+1"

    public init() {}

    private func normalizePhoneToE164(_ raw: String) -> String {
        let digits = raw.filter { $0.isNumber || $0 == "+" }
        if digits.hasPrefix("+") { return digits }
        if digits.count == 10 { return "\(defaultCountryCode)\(digits)" }
        if digits.count == 11 && digits.hasPrefix("1") { return "+\(digits)" }
        return "+\(digits)"
    }

    private func stripTrailingPunctuation(_ str: String) -> String {
        var s = str
        let trailing: Set<Character> = [".", ",", ";", ":", "!", "?", ")"]
        while let last = s.last, trailing.contains(last) { s.removeLast() }
        return s
    }

    private func isValidUrlStructure(_ url: String) -> Bool {
        guard let parsed = URL(string: url),
              let scheme = parsed.scheme,
              ["http", "https"].contains(scheme),
              let host = parsed.host,
              host.contains("."), host.count >= 3 else {
            return false
        }
        return true
    }

    public func detect(content: Any, existingStructure: [String: Any], config: DetectorConfig) throws -> [Detection] {
        let text: String
        if let s = content as? String { text = s }
        else { text = String(describing: content) }

        let threshold = config.confidenceThreshold ?? 0.5
        var detections: [Detection] = []
        var seen = Set<String>()
        let fullRange = NSRange(text.startIndex..., in: text)

        // HTTP(S) URLs
        let urlRegex = try NSRegularExpression(
            pattern: #"https?://[A-Za-z0-9][-A-Za-z0-9]*(?:\.[A-Za-z0-9][-A-Za-z0-9]*)+(?::\d{1,5})?(?:/[^\s<>"{}|\\^\[\]`]*)?"#
        )
        for match in urlRegex.matches(in: text, range: fullRange) {
            guard let r = Range(match.range, in: text) else { continue }
            let raw = String(text[r])
            let url = stripTrailingPunctuation(raw)
            guard isValidUrlStructure(url), !seen.contains(url) else { continue }
            seen.insert(url)

            let hasPath = URL(string: url).flatMap { $0.path.count > 1 ? true : nil } ?? false
            let hasQuery = url.contains("?")
            let confidence = hasQuery ? 0.98 : (hasPath ? 0.95 : 0.92)
            guard confidence >= threshold else { continue }

            detections.append(Detection(
                field: "url", value: url, type: "url",
                confidence: confidence, evidence: url
            ))
        }

        // Email addresses
        let emailRegex = try NSRegularExpression(
            pattern: #"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b"#
        )
        for match in emailRegex.matches(in: text, range: fullRange) {
            guard let r = Range(match.range(at: 1), in: text) else { continue }
            let email = String(text[r]).lowercased()
            guard !seen.contains(email) else { continue }
            seen.insert(email)

            let domain = email.split(separator: "@").last.map(String.init) ?? ""
            guard domain.contains(".") else { continue }
            let tld = domain.split(separator: ".").last.map(String.init) ?? ""
            let confidence = (tld.count >= 2 && tld.count <= 6) ? 0.95 : 0.80
            guard confidence >= threshold else { continue }

            detections.append(Detection(
                field: "email", value: email, type: "email",
                confidence: confidence, evidence: email
            ))
        }

        // Phone numbers
        let phonePatterns: [(NSRegularExpression, Double)] = [
            (try NSRegularExpression(pattern: #"\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}"#), 0.90),
            (try NSRegularExpression(pattern: #"\(\d{3}\)\s*\d{3}[-.\s]?\d{4}"#), 0.88),
            (try NSRegularExpression(pattern: #"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b"#), 0.82),
        ]

        for (regex, confidence) in phonePatterns {
            guard confidence >= threshold else { continue }
            for match in regex.matches(in: text, range: fullRange) {
                guard let r = Range(match.range, in: text) else { continue }
                let raw = String(text[r])
                let normalized = normalizePhoneToE164(raw)
                let digits = normalized.filter { $0.isNumber }
                guard digits.count >= 7 && digits.count <= 15 else { continue }
                let key = "phone:\(digits)"
                guard !seen.contains(key) else { continue }
                seen.insert(key)

                detections.append(Detection(
                    field: "phone", value: normalized, type: "phone",
                    confidence: confidence, evidence: raw
                ))
            }
        }

        return detections
    }

    public func appliesTo(contentType: String) -> Bool {
        ["text/plain", "text/html", "text/markdown", "text/csv", "application/json"].contains(contentType)
    }
}
