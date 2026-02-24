// Transform Plugin Provider: markdown_to_html
// Convert Markdown content to HTML syntax.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class MarkdownToHtmlTransformProvider {
    public static let providerId = "markdown_to_html"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        var md = String(describing: value)
        let wrapInDiv = (config.options["wrapInDiv"] as? Bool) ?? false

        md = md.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")

        // Code blocks (fenced)
        md = convertCodeBlocks(md)

        // Blockquotes
        md = convertBlockquotes(md)

        // Headings
        md = convertHeadings(md)

        // HR
        md = md.replacingOccurrences(of: "\n---\n", with: "\n<hr>\n")
        md = md.replacingOccurrences(of: "\n***\n", with: "\n<hr>\n")

        // Lists
        md = convertUnorderedLists(md)
        md = convertOrderedLists(md)

        // Images (before links)
        md = convertImages(md)

        // Links
        md = convertLinks(md)

        // Inline code
        md = convertInlineCode(md)

        // Bold
        md = convertBold(md)

        // Italic
        md = convertItalic(md)

        // Strikethrough
        md = convertStrikethrough(md)

        // Paragraphs
        md = convertParagraphs(md)

        if wrapInDiv {
            md = "<div>\(md)</div>"
        }

        return md
    }

    private func convertCodeBlocks(_ md: String) -> String {
        var result = md
        let pattern = "```(\\w*)\\n([\\s\\S]*?)```"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        let nsString = result as NSString
        let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsString.length))
        for match in matches.reversed() {
            let lang = nsString.substring(with: match.range(at: 1))
            let code = nsString.substring(with: match.range(at: 2))
            let langAttr = lang.isEmpty ? "" : " class=\"language-\(lang)\""
            let escaped = escapeHtml(code.trimmingCharacters(in: .newlines))
            let html = "<pre><code\(langAttr)>\(escaped)</code></pre>"
            result = (result as NSString).replacingCharacters(in: match.range, with: html)
        }
        return result
    }

    private func convertBlockquotes(_ md: String) -> String {
        let lines = md.components(separatedBy: "\n")
        var result: [String] = []
        var inQuote = false
        var quoteContent: [String] = []

        for line in lines {
            if line.hasPrefix("> ") || line.hasPrefix(">") {
                inQuote = true
                let content = line.hasPrefix("> ") ? String(line.dropFirst(2)) : String(line.dropFirst(1))
                quoteContent.append(content)
            } else {
                if inQuote {
                    result.append("<blockquote>\(quoteContent.joined(separator: "\n"))</blockquote>")
                    quoteContent.removeAll()
                    inQuote = false
                }
                result.append(line)
            }
        }
        if inQuote {
            result.append("<blockquote>\(quoteContent.joined(separator: "\n"))</blockquote>")
        }
        return result.joined(separator: "\n")
    }

    private func convertHeadings(_ md: String) -> String {
        var lines = md.components(separatedBy: "\n")
        for i in 0..<lines.count {
            let trimmed = lines[i].trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("######") {
                lines[i] = "<h6>\(trimmed.dropFirst(6).trimmingCharacters(in: .whitespaces))</h6>"
            } else if trimmed.hasPrefix("#####") {
                lines[i] = "<h5>\(trimmed.dropFirst(5).trimmingCharacters(in: .whitespaces))</h5>"
            } else if trimmed.hasPrefix("####") {
                lines[i] = "<h4>\(trimmed.dropFirst(4).trimmingCharacters(in: .whitespaces))</h4>"
            } else if trimmed.hasPrefix("###") {
                lines[i] = "<h3>\(trimmed.dropFirst(3).trimmingCharacters(in: .whitespaces))</h3>"
            } else if trimmed.hasPrefix("##") {
                lines[i] = "<h2>\(trimmed.dropFirst(2).trimmingCharacters(in: .whitespaces))</h2>"
            } else if trimmed.hasPrefix("# ") {
                lines[i] = "<h1>\(trimmed.dropFirst(2).trimmingCharacters(in: .whitespaces))</h1>"
            }
        }
        return lines.joined(separator: "\n")
    }

    private func convertUnorderedLists(_ md: String) -> String {
        let lines = md.components(separatedBy: "\n")
        var result: [String] = []
        var inList = false
        var items: [String] = []

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if (trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("+ "))
                && !trimmed.hasPrefix("---") {
                inList = true
                items.append("<li>\(String(trimmed.dropFirst(2)))</li>")
            } else {
                if inList {
                    result.append("<ul>\n\(items.joined(separator: "\n"))\n</ul>")
                    items.removeAll()
                    inList = false
                }
                result.append(line)
            }
        }
        if inList {
            result.append("<ul>\n\(items.joined(separator: "\n"))\n</ul>")
        }
        return result.joined(separator: "\n")
    }

    private func convertOrderedLists(_ md: String) -> String {
        let lines = md.components(separatedBy: "\n")
        var result: [String] = []
        var inList = false
        var items: [String] = []

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if let dotRange = trimmed.range(of: ". ") {
                let prefix = String(trimmed[trimmed.startIndex..<dotRange.lowerBound])
                if prefix.allSatisfy({ $0.isNumber }) && !prefix.isEmpty {
                    inList = true
                    let content = String(trimmed[dotRange.upperBound...])
                    items.append("<li>\(content)</li>")
                    continue
                }
            }
            if inList {
                result.append("<ol>\n\(items.joined(separator: "\n"))\n</ol>")
                items.removeAll()
                inList = false
            }
            result.append(line)
        }
        if inList {
            result.append("<ol>\n\(items.joined(separator: "\n"))\n</ol>")
        }
        return result.joined(separator: "\n")
    }

    private func convertImages(_ md: String) -> String {
        var result = md
        let pattern = "!\\[([^\\]]*)\\]\\(([^)]+)\\)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "<img src=\"$2\" alt=\"$1\">")
        return result
    }

    private func convertLinks(_ md: String) -> String {
        var result = md
        let pattern = "(?<!!)\\[([^\\]]+)\\]\\(([^)]+)\\)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "<a href=\"$2\">$1</a>")
        return result
    }

    private func convertInlineCode(_ md: String) -> String {
        var result = md
        let pattern = "`([^`]+)`"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return result }
        result = regex.stringByReplacingMatches(
            in: result, range: NSRange(result.startIndex..., in: result),
            withTemplate: "<code>$1</code>")
        return result
    }

    private func convertBold(_ md: String) -> String {
        var result = md
        if let regex = try? NSRegularExpression(pattern: "\\*\\*(.+?)\\*\\*") {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "<strong>$1</strong>")
        }
        if let regex = try? NSRegularExpression(pattern: "__(.+?)__") {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "<strong>$1</strong>")
        }
        return result
    }

    private func convertItalic(_ md: String) -> String {
        var result = md
        if let regex = try? NSRegularExpression(pattern: "(?<!\\*)\\*([^*]+)\\*(?!\\*)") {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "<em>$1</em>")
        }
        return result
    }

    private func convertStrikethrough(_ md: String) -> String {
        var result = md
        if let regex = try? NSRegularExpression(pattern: "~~(.+?)~~") {
            result = regex.stringByReplacingMatches(
                in: result, range: NSRange(result.startIndex..., in: result),
                withTemplate: "<del>$1</del>")
        }
        return result
    }

    private func convertParagraphs(_ md: String) -> String {
        let blocks = md.components(separatedBy: "\n\n")
        var result: [String] = []
        for block in blocks {
            let trimmed = block.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            if trimmed.hasPrefix("<") {
                result.append(trimmed)
            } else {
                result.append("<p>\(trimmed)</p>")
            }
        }
        return result.joined(separator: "\n")
    }

    private func escapeHtml(_ str: String) -> String {
        return str.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
