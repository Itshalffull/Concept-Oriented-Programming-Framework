// Transform Plugin Provider: html_to_markdown
// Convert HTML content to Markdown syntax.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class HtmlToMarkdownTransformProvider {
    public static let providerId = "html_to_markdown"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        var html = String(describing: value)
        let preserveLinks = (config.options["preserveLinks"] as? Bool) ?? true

        html = html.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")

        // Headings h1-h6
        for i in (1...6).reversed() {
            let hashes = String(repeating: "#", count: i)
            html = replaceTagPair(html, open: "h\(i)", with: "\n\n\(hashes) ", suffix: "\n\n")
        }

        // Bold
        html = replaceSimpleTag(html, tag: "strong", prefix: "**", suffix: "**")
        html = replaceSimpleTag(html, tag: "b", prefix: "**", suffix: "**")

        // Italic
        html = replaceSimpleTag(html, tag: "em", prefix: "*", suffix: "*")
        html = replaceSimpleTag(html, tag: "i", prefix: "*", suffix: "*")

        // Code blocks
        html = replacePreCodeBlocks(html)

        // Inline code
        html = replaceSimpleTag(html, tag: "code", prefix: "`", suffix: "`")

        // Links
        if preserveLinks {
            html = replaceLinks(html)
        }

        // Images
        html = replaceImages(html)

        // Blockquotes
        html = replaceBlockquotes(html)

        // Lists
        html = replaceUnorderedLists(html)
        html = replaceOrderedLists(html)

        // HR
        html = html.replacingOccurrences(of: "<hr>", with: "\n\n---\n\n", options: .caseInsensitive)
        html = html.replacingOccurrences(of: "<hr/>", with: "\n\n---\n\n", options: .caseInsensitive)
        html = html.replacingOccurrences(of: "<hr />", with: "\n\n---\n\n", options: .caseInsensitive)

        // BR
        html = html.replacingOccurrences(of: "<br>", with: "\n", options: .caseInsensitive)
        html = html.replacingOccurrences(of: "<br/>", with: "\n", options: .caseInsensitive)
        html = html.replacingOccurrences(of: "<br />", with: "\n", options: .caseInsensitive)

        // Paragraphs
        html = replaceTagPair(html, open: "p", with: "\n\n", suffix: "\n\n")

        // Strip remaining tags
        html = stripAllTags(html)

        // Decode entities
        html = decodeEntities(html)

        // Clean excessive blank lines
        while html.contains("\n\n\n") {
            html = html.replacingOccurrences(of: "\n\n\n", with: "\n\n")
        }

        return html.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func replaceSimpleTag(_ html: String, tag: String, prefix: String, suffix: String) -> String {
        var result = html
        let pattern = "<\(tag)(?:\\s[^>]*)?>([\\s\\S]*?)</\(tag)>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "\(prefix)$1\(suffix)")
        return result
    }

    private func replaceTagPair(_ html: String, open tag: String, with prefix: String, suffix: String) -> String {
        var result = html
        let pattern = "<\(tag)(?:\\s[^>]*)?>([\\s\\S]*?)</\(tag)>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "\(prefix)$1\(suffix)")
        return result
    }

    private func replacePreCodeBlocks(_ html: String) -> String {
        var result = html
        let pattern = "<pre[^>]*>\\s*<code[^>]*>([\\s\\S]*?)</code>\\s*</pre>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "\n\n```\n$1\n```\n\n")
        return result
    }

    private func replaceLinks(_ html: String) -> String {
        var result = html
        let pattern = "<a\\s+[^>]*href=[\"']([^\"']*)[\"'][^>]*>(.*?)</a>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "[$2]($1)")
        return result
    }

    private func replaceImages(_ html: String) -> String {
        var result = html
        // src before alt
        let pattern1 = "<img\\s+[^>]*src=[\"']([^\"']*)[\"'][^>]*alt=[\"']([^\"']*)[\"'][^>]*/?"
        if let regex = try? NSRegularExpression(pattern: pattern1 + ">", options: .caseInsensitive) {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "![$2]($1)")
        }
        // alt before src
        let pattern2 = "<img\\s+[^>]*alt=[\"']([^\"']*)[\"'][^>]*src=[\"']([^\"']*)[\"'][^>]*/?"
        if let regex = try? NSRegularExpression(pattern: pattern2 + ">", options: .caseInsensitive) {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "![$1]($2)")
        }
        return result
    }

    private func replaceBlockquotes(_ html: String) -> String {
        var result = html
        let pattern = "<blockquote[^>]*>([\\s\\S]*?)</blockquote>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        let nsResult = result as NSString
        let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsResult.length))
        for match in matches.reversed() {
            let content = nsResult.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
            let quoted = content.components(separatedBy: "\n")
                .map { "> \($0.trimmingCharacters(in: .whitespaces))" }
                .joined(separator: "\n")
            let replacement = "\n\n\(quoted)\n\n"
            result = (result as NSString).replacingCharacters(in: match.range, with: replacement)
        }
        return result
    }

    private func replaceUnorderedLists(_ html: String) -> String {
        var result = html
        let pattern = "<ul[^>]*>([\\s\\S]*?)</ul>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        let nsResult = result as NSString
        let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsResult.length))
        for match in matches.reversed() {
            let content = nsResult.substring(with: match.range(at: 1))
            let items = extractListItems(from: content)
            let md = items.map { "- \($0)" }.joined(separator: "\n")
            result = (result as NSString).replacingCharacters(in: match.range, with: "\n\n\(md)\n\n")
        }
        return result
    }

    private func replaceOrderedLists(_ html: String) -> String {
        var result = html
        let pattern = "<ol[^>]*>([\\s\\S]*?)</ol>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return result
        }
        let nsResult = result as NSString
        let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsResult.length))
        for match in matches.reversed() {
            let content = nsResult.substring(with: match.range(at: 1))
            let items = extractListItems(from: content)
            let md = items.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
            result = (result as NSString).replacingCharacters(in: match.range, with: "\n\n\(md)\n\n")
        }
        return result
    }

    private func extractListItems(from content: String) -> [String] {
        let pattern = "<li[^>]*>([\\s\\S]*?)</li>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return []
        }
        let nsContent = content as NSString
        let matches = regex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
        return matches.map { nsContent.substring(with: $0.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines) }
    }

    private func stripAllTags(_ html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "<[^>]+>", options: []) else {
            return html
        }
        return regex.stringByReplacingMatches(
            in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
    }

    private func decodeEntities(_ text: String) -> String {
        var result = text
        let entities: [(String, String)] = [
            ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""),
            ("&#39;", "'"), ("&apos;", "'"), ("&nbsp;", " "),
            ("&mdash;", "\u{2014}"), ("&ndash;", "\u{2013}"),
        ]
        for (entity, char) in entities {
            result = result.replacingOccurrences(of: entity, with: char)
        }
        return result
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
