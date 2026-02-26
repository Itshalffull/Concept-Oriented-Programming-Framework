// Data Integration Kit - Web Full Page Capture Provider
// Full HTML snapshot with inlined styles and base64-encoded images

import Foundation

public final class WebFullPageCaptureProvider {
    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let urlString = input.url, let url = URL(string: urlString) else {
            throw CaptureError.missingURL
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        guard var html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError("Unable to decode HTML as UTF-8")
        }

        let title = extractTitle(from: html)
        html = resolveRelativeUrls(html: html, baseUrl: urlString)

        let inlineCss = (config.options?["inlineStyles"] as? Bool) ?? true
        let inlineImgs = (config.options?["inlineImages"] as? Bool) ?? true

        if inlineCss {
            html = try await inlineStylesheets(html: html, baseUrl: urlString)
        }
        if inlineImgs {
            html = try await inlineImages(html: html, baseUrl: urlString)
        }

        let timestamp = ISO8601DateFormatter().string(from: Date())
        let snapshot = "<!-- Full page snapshot captured from \(urlString) at \(timestamp) -->\n\(html)"

        return CaptureItem(
            content: snapshot,
            sourceMetadata: SourceMetadata(
                title: title,
                url: urlString,
                capturedAt: timestamp,
                contentType: "text/html",
                author: nil,
                tags: ["full-page", "snapshot"],
                source: "web_full_page"
            ),
            rawData: nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    private func extractTitle(from html: String) -> String {
        let pattern = #"(?i)<title>([^<]*)</title>"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else {
            return "Untitled Page"
        }
        return String(html[range]).trimmingCharacters(in: .whitespaces)
    }

    private func resolveUrl(base: String, relative: String) -> String {
        if relative.hasPrefix("http://") || relative.hasPrefix("https://") || relative.hasPrefix("data:") {
            return relative
        }
        guard let baseURL = URL(string: base) else { return relative }
        return URL(string: relative, relativeTo: baseURL)?.absoluteString ?? relative
    }

    private func resolveRelativeUrls(html: String, baseUrl: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"(href|src|action)=["']([^"'#][^"']*)["']"#) else {
            return html
        }
        let nsRange = NSRange(html.startIndex..., in: html)
        var result = html
        let matches = regex.matches(in: html, range: nsRange).reversed()
        for match in matches {
            guard let attrRange = Range(match.range(at: 1), in: result),
                  let urlRange = Range(match.range(at: 2), in: result),
                  let fullRange = Range(match.range, in: result) else { continue }
            let attr = String(result[attrRange])
            let urlStr = String(result[urlRange])
            if urlStr.hasPrefix("data:") || urlStr.hasPrefix("javascript:") { continue }
            let resolved = resolveUrl(base: baseUrl, relative: urlStr)
            result.replaceSubrange(fullRange, with: "\(attr)=\"\(resolved)\"")
        }
        return result
    }

    private func extractStylesheetUrls(from html: String, baseUrl: String) -> [String] {
        let pattern = #"(?i)<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let nsRange = NSRange(html.startIndex..., in: html)
        return regex.matches(in: html, range: nsRange).compactMap { match in
            guard let range = Range(match.range(at: 1), in: html) else { return nil }
            return resolveUrl(base: baseUrl, relative: String(html[range]))
        }
    }

    private func inlineStylesheets(html: String, baseUrl: String) async throws -> String {
        var result = html
        let cssUrls = extractStylesheetUrls(from: html, baseUrl: baseUrl)
        for cssUrl in cssUrls {
            guard let url = URL(string: cssUrl) else { continue }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let cssText = String(data: data, encoding: .utf8) else { continue }
                let styleTag = "<style data-original-href=\"\(cssUrl)\">\n\(cssText)\n</style>"
                let escaped = NSRegularExpression.escapedPattern(for: cssUrl)
                let linkPattern = "(?i)<link[^>]+href=[\"']\(escaped)[\"'][^>]*>"
                if let linkRegex = try? NSRegularExpression(pattern: linkPattern) {
                    let range = NSRange(result.startIndex..., in: result)
                    result = linkRegex.stringByReplacingMatches(in: result, range: range, withTemplate: styleTag)
                }
            } catch { continue }
        }
        return result
    }

    private func inlineImages(html: String, baseUrl: String) async throws -> String {
        var result = html
        let pattern = #"(?i)<img[^>]+src=["']([^"']+)["'][^>]*>"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        let nsRange = NSRange(html.startIndex..., in: html)
        let matches = regex.matches(in: html, range: nsRange)

        for match in matches.reversed() {
            guard let srcRange = Range(match.range(at: 1), in: result) else { continue }
            let originalSrc = String(result[srcRange])
            if originalSrc.hasPrefix("data:") { continue }
            let absoluteUrl = resolveUrl(base: baseUrl, relative: originalSrc)
            guard let imgUrl = URL(string: absoluteUrl) else { continue }
            do {
                let (data, response) = try await URLSession.shared.data(from: imgUrl)
                let contentType = response.mimeType ?? "application/octet-stream"
                let base64 = data.base64EncodedString()
                let dataUri = "data:\(contentType);base64,\(base64)"
                result = result.replacingOccurrences(of: originalSrc, with: dataUri)
            } catch { continue }
        }
        return result
    }
}
