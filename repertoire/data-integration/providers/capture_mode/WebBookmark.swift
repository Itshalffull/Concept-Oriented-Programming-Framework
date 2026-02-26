// Data Integration Kit - Web Bookmark Capture Provider
// Lightweight metadata-only capture via OpenGraph, Twitter Card, and HTML meta tags

import Foundation

public final class WebBookmarkCaptureProvider {
    private static let maxHeadBytes = 16384

    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let urlString = input.url, let url = URL(string: urlString) else {
            throw CaptureError.missingURL
        }

        var request = URLRequest(url: url)
        request.setValue("bytes=0-\(Self.maxHeadBytes)", forHTTPHeaderField: "Range")
        let (data, _) = try await URLSession.shared.data(for: request)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError("Unable to decode HTML as UTF-8")
        }

        let og = extractOpenGraph(html: html)
        let twitter = extractTwitterCard(html: html)
        let htmlMeta = extractHtmlMeta(html: html, baseUrl: urlString)

        let bookmark = mergeBookmarkData(og, twitter, htmlMeta)
        let title = bookmark["title"] ?? "Untitled Bookmark"

        var contentParts = ["# \(title)"]
        if let desc = bookmark["description"] { contentParts.append(desc) }
        if let site = bookmark["siteName"] { contentParts.append("Site: \(site)") }
        if let author = bookmark["author"] { contentParts.append("Author: \(author)") }
        if let image = bookmark["image"] { contentParts.append("Image: \(image)") }
        if let favicon = bookmark["favicon"] { contentParts.append("Favicon: \(favicon)") }

        return CaptureItem(
            content: contentParts.joined(separator: "\n"),
            sourceMetadata: SourceMetadata(
                title: title,
                url: bookmark["canonicalUrl"] ?? urlString,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: "application/x-bookmark",
                author: bookmark["author"],
                tags: ["bookmark", bookmark["type"] ?? "webpage"],
                source: "web_bookmark"
            ),
            rawData: (config.options?["includeRawMeta"] as? Bool == true) ? bookmark : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    private func extractMetaTag(html: String, property: String) -> String? {
        let escaped = NSRegularExpression.escapedPattern(for: property)
        let patterns = [
            "(?i)<meta[^>]+(?:property|name)=[\"']\(escaped)[\"'][^>]+content=[\"']([^\"']+)[\"']",
            "(?i)<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']\(escaped)[\"']"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
               let range = Range(match.range(at: 1), in: html) {
                let val = String(html[range]).trimmingCharacters(in: .whitespaces)
                if !val.isEmpty { return val }
            }
        }
        return nil
    }

    private func extractOpenGraph(html: String) -> [String: String] {
        var result: [String: String] = [:]
        if let v = extractMetaTag(html: html, property: "og:title") { result["title"] = v }
        if let v = extractMetaTag(html: html, property: "og:description") { result["description"] = v }
        if let v = extractMetaTag(html: html, property: "og:image") { result["image"] = v }
        if let v = extractMetaTag(html: html, property: "og:site_name") { result["siteName"] = v }
        if let v = extractMetaTag(html: html, property: "og:type") { result["type"] = v }
        if let v = extractMetaTag(html: html, property: "og:url") { result["canonicalUrl"] = v }
        return result
    }

    private func extractTwitterCard(html: String) -> [String: String] {
        var result: [String: String] = [:]
        if let v = extractMetaTag(html: html, property: "twitter:card") { result["twitterCard"] = v }
        if let v = extractMetaTag(html: html, property: "twitter:title") { result["title"] = v }
        if let v = extractMetaTag(html: html, property: "twitter:description") { result["description"] = v }
        if let v = extractMetaTag(html: html, property: "twitter:image") { result["image"] = v }
        return result
    }

    private func extractHtmlMeta(html: String, baseUrl: String) -> [String: String] {
        var result: [String: String] = [:]
        if let regex = try? NSRegularExpression(pattern: "(?i)<title>([^<]+)</title>"),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            result["title"] = String(html[range]).trimmingCharacters(in: .whitespaces)
        }
        if let v = extractMetaTag(html: html, property: "description") { result["description"] = v }
        if let v = extractMetaTag(html: html, property: "author") { result["author"] = v }
        result["favicon"] = extractFavicon(html: html, baseUrl: baseUrl)
        if let regex = try? NSRegularExpression(pattern: #"(?i)<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']"#),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            result["canonicalUrl"] = String(html[range]).trimmingCharacters(in: .whitespaces)
        }
        return result
    }

    private func extractFavicon(html: String, baseUrl: String) -> String {
        let patterns = [
            #"(?i)<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']"#,
            #"(?i)<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']"#
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
               let range = Range(match.range(at: 1), in: html) {
                let href = String(html[range])
                if let resolved = URL(string: href, relativeTo: URL(string: baseUrl)) {
                    return resolved.absoluteString
                }
                return href
            }
        }
        if let base = URL(string: baseUrl), let favicon = URL(string: "/favicon.ico", relativeTo: base) {
            return favicon.absoluteString
        }
        return "\(baseUrl)/favicon.ico"
    }

    private func mergeBookmarkData(_ sources: [String: String]...) -> [String: String] {
        var result: [String: String] = [:]
        for source in sources {
            for (key, value) in source {
                if result[key] == nil { result[key] = value }
            }
        }
        return result
    }
}
