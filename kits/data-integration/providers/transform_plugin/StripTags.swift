// Transform Plugin Provider: strip_tags
// Remove HTML tags with optional allowlist and entity decoding.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class StripTagsTransformProvider {
    public static let providerId = "strip_tags"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        var html = String(describing: value)
        let allowedTags = (config.options["allowedTags"] as? [String]) ?? []
        let decodeEntities = (config.options["decodeEntities"] as? Bool) ?? true
        let preserveWhitespace = (config.options["preserveWhitespace"] as? Bool) ?? true

        // Insert whitespace for block elements
        if preserveWhitespace {
            let blockTags = ["p", "div", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
                           "ul", "ol", "li", "table", "tr", "td", "th",
                           "blockquote", "pre", "section", "article"]
            for tag in blockTags {
                if !allowedTags.contains(tag) {
                    if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>", options: .caseInsensitive) {
                        html = regex.stringByReplacingMatches(
                            in: html, range: NSRange(html.startIndex..., in: html), withTemplate: " ")
                    }
                    html = html.replacingOccurrences(of: "</\(tag)>", with: " ",
                        options: .caseInsensitive)
                }
            }
            if !allowedTags.contains("br") {
                html = html.replacingOccurrences(of: "<br>", with: "\n", options: .caseInsensitive)
                html = html.replacingOccurrences(of: "<br/>", with: "\n", options: .caseInsensitive)
                html = html.replacingOccurrences(of: "<br />", with: "\n", options: .caseInsensitive)
            }
        }

        // Remove HTML comments
        if let regex = try? NSRegularExpression(pattern: "<!--[\\s\\S]*?-->") {
            html = regex.stringByReplacingMatches(
                in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
        }

        // Strip tags
        if allowedTags.isEmpty {
            if let regex = try? NSRegularExpression(pattern: "<[^>]+>") {
                html = regex.stringByReplacingMatches(
                    in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
            }
        } else {
            let allowedSet = Set(allowedTags.map { $0.lowercased() })
            let pattern = "</?([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*/?"
            if let regex = try? NSRegularExpression(pattern: pattern + ">") {
                let nsHtml = html as NSString
                let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsHtml.length))
                var result = html
                for match in matches.reversed() {
                    let tagName = nsHtml.substring(with: match.range(at: 1)).lowercased()
                    if !allowedSet.contains(tagName) {
                        result = (result as NSString).replacingCharacters(in: match.range, with: "")
                    }
                }
                html = result
            }
        }

        // Decode entities
        if decodeEntities {
            html = decodeHtmlEntities(html)
        }

        // Normalize whitespace
        html = html.components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return html.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func decodeHtmlEntities(_ text: String) -> String {
        var result = text
        let entities: [(String, String)] = [
            ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""),
            ("&#39;", "'"), ("&apos;", "'"), ("&nbsp;", " "),
            ("&mdash;", "\u{2014}"), ("&ndash;", "\u{2013}"),
            ("&hellip;", "\u{2026}"), ("&bull;", "\u{2022}"),
            ("&copy;", "\u{00A9}"), ("&reg;", "\u{00AE}"),
            ("&trade;", "\u{2122}"), ("&times;", "\u{00D7}"),
            ("&euro;", "\u{20AC}"), ("&pound;", "\u{00A3}"),
        ]
        for (entity, char) in entities {
            result = result.replacingOccurrences(of: entity, with: char)
        }

        // Decimal numeric entities
        if let regex = try? NSRegularExpression(pattern: "&#(\\d+);") {
            let nsResult = result as NSString
            let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsResult.length))
            for match in matches.reversed() {
                let numStr = nsResult.substring(with: match.range(at: 1))
                if let code = UInt32(numStr), let scalar = Unicode.Scalar(code) {
                    result = (result as NSString).replacingCharacters(
                        in: match.range, with: String(Character(scalar)))
                }
            }
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
