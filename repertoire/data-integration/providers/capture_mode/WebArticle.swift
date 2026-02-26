// Data Integration Kit - Web Article Capture Provider
// Extracts article content via Readability-style algorithm with scoring heuristics

import Foundation

public struct CaptureInput {
    public var url: String?
    public var file: Data?
    public var email: String?
    public var shareData: Any?
}

public struct CaptureConfig {
    public var mode: String
    public var options: [String: Any]?
}

public struct SourceMetadata {
    public var title: String
    public var url: String?
    public var capturedAt: String
    public var contentType: String
    public var author: String?
    public var tags: [String]?
    public var source: String?
}

public struct CaptureItem {
    public var content: String
    public var sourceMetadata: SourceMetadata
    public var rawData: Any?
}

public enum CaptureError: Error {
    case missingURL
    case fetchError(String)
    case parseError(String)
}

public final class WebArticleCaptureProvider {
    private static let negativePatterns = ["comment", "footer", "header", "menu", "nav",
                                           "sidebar", "sponsor", "ad-break", "popup", "rss"]
    private static let positivePatterns = ["article", "content", "entry", "main", "post",
                                           "text", "body", "blog", "story"]

    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let urlString = input.url, let url = URL(string: urlString) else {
            throw CaptureError.missingURL
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError("Unable to decode HTML as UTF-8")
        }

        let title = extractMeta(html: html, patterns: [
            #"og:title["']\s+content=["']([^"']+)"#,
            #"<title>([^<]+)</title>"#
        ]) ?? "Untitled"

        let author = extractMeta(html: html, patterns: [
            #"name=["']author["']\s+content=["']([^"']+)"#
        ])

        let mainContent = findMainContent(html: html)
        let textContent = extractText(html: mainContent)

        return CaptureItem(
            content: textContent,
            sourceMetadata: SourceMetadata(
                title: title,
                url: urlString,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: "text/html",
                author: author,
                tags: ["article"],
                source: "web_article"
            ),
            rawData: (config.options?["includeRaw"] as? Bool == true) ? html : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    private func scoreElement(tag: String, className: String, id: String) -> Int {
        var score = 0
        switch tag.lowercased() {
        case "article": score += 30
        case "section": score += 10
        case "div": score += 5
        case "p": score += 3
        default: break
        }
        let combined = "\(className) \(id)".lowercased()
        if Self.positivePatterns.contains(where: { combined.contains($0) }) { score += 25 }
        if Self.negativePatterns.contains(where: { combined.contains($0) }) { score -= 25 }
        return score
    }

    private func stripNonContent(html: String) -> String {
        var result = html
        for tag in ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"] {
            let pattern = "(?is)<\(tag)[^>]*>[\\s\\S]*?</\(tag)>"
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let range = NSRange(result.startIndex..., in: result)
                result = regex.stringByReplacingMatches(in: result, range: range, withTemplate: "")
            }
        }
        return result
    }

    private func findMainContent(html: String) -> String {
        let cleaned = stripNonContent(html: html)
        guard let blockRegex = try? NSRegularExpression(
            pattern: #"(?is)<(div|section|article|main)\b([^>]*)>([\s\S]*?)</\1>"#
        ) else { return cleaned }

        let nsRange = NSRange(cleaned.startIndex..., in: cleaned)
        let matches = blockRegex.matches(in: cleaned, range: nsRange)

        var bestScore = Int.min
        var bestContent = ""
        let classRegex = try? NSRegularExpression(pattern: #"class=["']([^"']+)["']"#)
        let idRegex = try? NSRegularExpression(pattern: #"id=["']([^"']+)["']"#)

        for match in matches {
            guard match.numberOfRanges >= 4 else { continue }
            let tag = extractGroup(from: cleaned, match: match, at: 1) ?? ""
            let attrs = extractGroup(from: cleaned, match: match, at: 2) ?? ""
            let inner = extractGroup(from: cleaned, match: match, at: 3) ?? ""

            let className = extractRegexGroup(classRegex, in: attrs) ?? ""
            let id = extractRegexGroup(idRegex, in: attrs) ?? ""

            let paragraphCount = (inner.components(separatedBy: "<p").count - 1)
            let textLen = extractText(html: inner).count
            var score = scoreElement(tag: tag, className: className, id: id)
            score += paragraphCount * 3
            score += min(textLen / 100, 20)

            if score > bestScore {
                bestScore = score
                bestContent = inner
            }
        }
        return bestContent.isEmpty ? cleaned : bestContent
    }

    private func extractText(html: String) -> String {
        var text = html
        text = text.replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "</p>", with: "\n\n", options: .caseInsensitive)
        text = text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func extractMeta(html: String, patterns: [String]) -> String? {
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
               let range = Range(match.range(at: 1), in: html) {
                let value = String(html[range]).trimmingCharacters(in: .whitespaces)
                if !value.isEmpty { return value }
            }
        }
        return nil
    }

    private func extractGroup(from string: String, match: NSTextCheckingResult, at index: Int) -> String? {
        guard let range = Range(match.range(at: index), in: string) else { return nil }
        return String(string[range])
    }

    private func extractRegexGroup(_ regex: NSRegularExpression?, in string: String) -> String? {
        guard let regex = regex,
              let match = regex.firstMatch(in: string, range: NSRange(string.startIndex..., in: string)),
              let range = Range(match.range(at: 1), in: string) else { return nil }
        return String(string[range])
    }
}
