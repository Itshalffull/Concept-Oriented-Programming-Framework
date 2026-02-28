// Data Integration Kit - Web Markdown Capture Provider
// HTML to Markdown conversion with Readability extraction and YAML frontmatter

import Foundation

public final class WebMarkdownCaptureProvider {
    public init() {}

    public func capture(input: CaptureInput, config: CaptureConfig) async throws -> CaptureItem {
        guard let urlString = input.url, let url = URL(string: urlString) else {
            throw CaptureError.missingURL
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        guard let html = String(data: data, encoding: .utf8) else {
            throw CaptureError.parseError("Unable to decode HTML as UTF-8")
        }

        let meta = extractArticleMeta(html: html)
        let cleaned = stripNonContent(html: html)
        let markdown = htmlToMarkdown(html: cleaned)

        let includeFrontmatter = (config.options?["frontmatter"] as? Bool) ?? true
        let frontmatter = includeFrontmatter ? generateFrontmatter(meta: meta, url: urlString) : nil
        let content = frontmatter.map { "\($0)\n\n\(markdown)" } ?? markdown

        var tags = ["markdown"]
        tags.append(contentsOf: meta.tags)

        return CaptureItem(
            content: content,
            sourceMetadata: SourceMetadata(
                title: meta.title,
                url: urlString,
                capturedAt: ISO8601DateFormatter().string(from: Date()),
                contentType: "text/markdown",
                author: meta.author,
                tags: tags,
                source: "web_markdown"
            ),
            rawData: (config.options?["includeHtml"] as? Bool == true) ? html : nil
        )
    }

    public func supports(input: CaptureInput) -> Bool {
        guard let url = input.url else { return false }
        return url.hasPrefix("http://") || url.hasPrefix("https://")
    }

    // MARK: - Article Metadata Extraction

    private struct ArticleMeta {
        var title: String
        var author: String?
        var date: String?
        var description: String?
        var tags: [String]
    }

    private func extractMeta(html: String, property: String) -> String? {
        let escaped = NSRegularExpression.escapedPattern(for: property)
        let pattern = "(?i)<meta[^>]+(?:property|name)=[\"']\(escaped)[\"'][^>]+content=[\"']([^\"']+)[\"']"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return nil }
        return String(html[range]).trimmingCharacters(in: .whitespaces)
    }

    private func extractArticleMeta(html: String) -> ArticleMeta {
        var title = extractMeta(html: html, property: "og:title")
        if title == nil,
           let regex = try? NSRegularExpression(pattern: "(?i)<title>([^<]+)</title>"),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            title = String(html[range]).trimmingCharacters(in: .whitespaces)
        }

        let author = extractMeta(html: html, property: "author")
            ?? extractMeta(html: html, property: "article:author")
        let date = extractMeta(html: html, property: "article:published_time")
            ?? extractMeta(html: html, property: "date")
        let description = extractMeta(html: html, property: "og:description")
            ?? extractMeta(html: html, property: "description")

        let tagsStr = extractMeta(html: html, property: "article:tag")
            ?? extractMeta(html: html, property: "keywords")
        let tags = tagsStr?.components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty } ?? []

        return ArticleMeta(title: title ?? "Untitled", author: author,
                          date: date, description: description, tags: tags)
    }

    // MARK: - HTML Cleaning

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

    private func stripTags(_ html: String) -> String {
        html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }

    private func decodeEntities(_ text: String) -> String {
        text.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }

    // MARK: - HTML to Markdown Conversion

    private func htmlToMarkdown(html: String) -> String {
        var md = html

        // Headings h1-h6
        for i in 1...6 {
            let prefix = String(repeating: "#", count: i)
            let pattern = "(?is)<h\(i)[^>]*>([\\s\\S]*?)</h\(i)>"
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let range = NSRange(md.startIndex..., in: md)
                let matches = regex.matches(in: md, range: range).reversed()
                for match in matches {
                    guard let fullRange = Range(match.range, in: md),
                          let contentRange = Range(match.range(at: 1), in: md) else { continue }
                    let content = stripTags(String(md[contentRange])).trimmingCharacters(in: .whitespaces)
                    md.replaceSubrange(fullRange, with: "\n\(prefix) \(content)\n")
                }
            }
        }

        // Bold
        md = replacePattern(md, pattern: "(?is)<(?:strong|b)>([\\s\\S]*?)</(?:strong|b)>") { "**\(self.stripTags($0))**" }
        // Italic
        md = replacePattern(md, pattern: "(?is)<(?:em|i)>([\\s\\S]*?)</(?:em|i)>") { "*\(self.stripTags($0))*" }

        // Links
        if let regex = try? NSRegularExpression(pattern: #"(?is)<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)</a>"#) {
            let range = NSRange(md.startIndex..., in: md)
            let matches = regex.matches(in: md, range: range).reversed()
            for match in matches {
                guard let fullRange = Range(match.range, in: md),
                      let hrefRange = Range(match.range(at: 1), in: md),
                      let textRange = Range(match.range(at: 2), in: md) else { continue }
                let href = String(md[hrefRange])
                let text = stripTags(String(md[textRange])).trimmingCharacters(in: .whitespaces)
                md.replaceSubrange(fullRange, with: "[\(text)](\(href))")
            }
        }

        // Inline code
        md = replacePattern(md, pattern: "(?is)<code>([\\s\\S]*?)</code>") { "`\(self.decodeEntities($0))`" }

        // Blockquotes
        md = replacePattern(md, pattern: "(?is)<blockquote[^>]*>([\\s\\S]*?)</blockquote>") {
            let lines = self.stripTags($0).trimmingCharacters(in: .whitespacesAndNewlines)
                .components(separatedBy: "\n").map { "> \($0)" }
            return "\n\(lines.joined(separator: "\n"))\n"
        }

        // Unordered lists
        md = replacePattern(md, pattern: "(?is)<ul[^>]*>([\\s\\S]*?)</ul>") {
            self.convertListItems($0, prefix: "- ")
        }

        // Ordered lists
        md = replacePattern(md, pattern: "(?is)<ol[^>]*>([\\s\\S]*?)</ol>") {
            self.convertOrderedListItems($0)
        }

        // Tables
        md = replacePattern(md, pattern: "(?is)<table[^>]*>([\\s\\S]*?)</table>") {
            self.convertTable(html: $0)
        }

        // HR, BR, P
        md = md.replacingOccurrences(of: "<hr\\s*/?>", with: "\n---\n", options: .regularExpression)
        md = md.replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: .regularExpression)
        md = replacePattern(md, pattern: "(?is)<p[^>]*>([\\s\\S]*?)</p>") {
            "\n\(self.stripTags($0).trimmingCharacters(in: .whitespaces))\n"
        }

        md = stripTags(md)
        md = decodeEntities(md)
        md = md.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        return md.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func replacePattern(_ string: String, pattern: String, replacement: (String) -> String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return string }
        var result = string
        let matches = regex.matches(in: result, range: NSRange(result.startIndex..., in: result)).reversed()
        for match in matches {
            guard let fullRange = Range(match.range, in: result),
                  let groupRange = Range(match.range(at: 1), in: result) else { continue }
            let content = String(result[groupRange])
            result.replaceSubrange(fullRange, with: replacement(content))
        }
        return result
    }

    private func convertListItems(_ html: String, prefix: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "(?is)<li[^>]*>([\\s\\S]*?)</li>") else { return "" }
        let range = NSRange(html.startIndex..., in: html)
        let items = regex.matches(in: html, range: range).compactMap { match -> String? in
            guard let r = Range(match.range(at: 1), in: html) else { return nil }
            return "\(prefix)\(stripTags(String(html[r])).trimmingCharacters(in: .whitespaces))"
        }
        return "\n\(items.joined(separator: "\n"))\n"
    }

    private func convertOrderedListItems(_ html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "(?is)<li[^>]*>([\\s\\S]*?)</li>") else { return "" }
        let range = NSRange(html.startIndex..., in: html)
        let items = regex.matches(in: html, range: range).enumerated().compactMap { (i, match) -> String? in
            guard let r = Range(match.range(at: 1), in: html) else { return nil }
            return "\(i + 1). \(stripTags(String(html[r])).trimmingCharacters(in: .whitespaces))"
        }
        return "\n\(items.joined(separator: "\n"))\n"
    }

    private func convertTable(html: String) -> String {
        guard let rowRegex = try? NSRegularExpression(pattern: "(?is)<tr[^>]*>([\\s\\S]*?)</tr>"),
              let cellRegex = try? NSRegularExpression(pattern: "(?is)<(?:td|th)[^>]*>([\\s\\S]*?)</(?:td|th)>") else {
            return ""
        }
        let rowRange = NSRange(html.startIndex..., in: html)
        let rowMatches = rowRegex.matches(in: html, range: rowRange)
        var rows: [[String]] = []
        for rowMatch in rowMatches {
            guard let r = Range(rowMatch.range(at: 1), in: html) else { continue }
            let rowContent = String(html[r])
            let cellRange = NSRange(rowContent.startIndex..., in: rowContent)
            let cells = cellRegex.matches(in: rowContent, range: cellRange).compactMap { match -> String? in
                guard let cr = Range(match.range(at: 1), in: rowContent) else { return nil }
                return stripTags(String(rowContent[cr])).trimmingCharacters(in: .whitespaces)
            }
            if !cells.isEmpty { rows.append(cells) }
        }
        guard !rows.isEmpty else { return "" }
        let maxCols = rows.map { $0.count }.max() ?? 0
        var lines: [String] = []
        for (i, row) in rows.enumerated() {
            let padded = (0..<maxCols).map { j in j < row.count ? row[j] : "" }
            lines.append("| \(padded.joined(separator: " | ")) |")
            if i == 0 {
                lines.append("| \((0..<maxCols).map { _ in "---" }.joined(separator: " | ")) |")
            }
        }
        return "\n\(lines.joined(separator: "\n"))\n"
    }

    // MARK: - Frontmatter Generation

    private func generateFrontmatter(meta: ArticleMeta, url: String) -> String {
        var lines = ["---"]
        lines.append("title: \"\(meta.title.replacingOccurrences(of: "\"", with: "\\\""))\"")
        if let author = meta.author { lines.append("author: \"\(author)\"") }
        if let date = meta.date { lines.append("date: \"\(date)\"") }
        lines.append("source: \"\(url)\"")
        if let desc = meta.description {
            lines.append("description: \"\(desc.replacingOccurrences(of: "\"", with: "\\\""))\"")
        }
        if !meta.tags.isEmpty {
            let tagStr = meta.tags.map { "\"\($0)\"" }.joined(separator: ", ")
            lines.append("tags: [\(tagStr)]")
        }
        lines.append("---")
        return lines.joined(separator: "\n")
    }
}
