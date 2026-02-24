// Transform Plugin — value transformation implementations for the Data Integration Kit
// Provides pluggable data value transformations: type casting, string manipulation,
// format conversion, lookup resolution, and expression evaluation.
// See Data Integration Kit transform.concept for the parent Transform concept definition.

import Foundation

// MARK: - Core Types

/// Describes the expected input or output type of a transform.
struct TypeSpec {
    let type: String            // "string", "number", "boolean", "date", "array", "object", "any"
    var elementType: String?    // For array types, the element type
    var nullable: Bool = false  // Whether the value may be nil
    var format: String?         // Optional format hint (e.g., "iso-8601", "url", "slug")
}

/// Provider-specific configuration for a transform operation.
struct TransformConfig {
    let providerId: String
    var options: [String: Any] = [:]
}

/// Interface every transform-plugin provider must implement.
protocol TransformPlugin {
    var id: String { get }
    var displayName: String { get }

    /// Transform a single value according to config.
    func transform(value: Any?, config: TransformConfig) throws -> Any?

    /// Describe the expected input type.
    func inputType() -> TypeSpec

    /// Describe the produced output type.
    func outputType() -> TypeSpec
}

/// Errors that can occur during transformation.
enum TransformError: Error, LocalizedError {
    case invalidInput(provider: String, detail: String)
    case castFailed(from: String, to: String, value: String)
    case lookupMissing(key: String, provider: String)
    case invalidExpression(expression: String, detail: String)
    case invalidPattern(pattern: String, detail: String)
    case dateParseFailed(value: String)

    var errorDescription: String? {
        switch self {
        case .invalidInput(let p, let d): return "\(p): invalid input — \(d)"
        case .castFailed(let f, let t, let v): return "Cannot cast \(f) to \(t): \"\(v)\""
        case .lookupMissing(let k, let p): return "\(p): key \"\(k)\" not found"
        case .invalidExpression(let e, let d): return "Invalid expression \"\(e)\": \(d)"
        case .invalidPattern(let p, let d): return "Invalid regex pattern \"\(p)\": \(d)"
        case .dateParseFailed(let v): return "Cannot parse date from \"\(v)\""
        }
    }
}

// MARK: - Helpers

private func stringify(_ value: Any?) -> String {
    guard let value = value else { return "" }
    if let s = value as? String { return s }
    if let d = value as? Date { return ISO8601DateFormatter().string(from: d) }
    if let n = value as? NSNumber { return n.stringValue }
    return String(describing: value)
}

private func optionString(_ config: TransformConfig, _ key: String, default defaultVal: String? = nil) -> String? {
    return (config.options[key] as? String) ?? defaultVal
}

private func optionBool(_ config: TransformConfig, _ key: String, default defaultVal: Bool = false) -> Bool {
    return (config.options[key] as? Bool) ?? defaultVal
}

private func optionInt(_ config: TransformConfig, _ key: String, default defaultVal: Int? = nil) -> Int? {
    return (config.options[key] as? Int) ?? defaultVal
}

// MARK: - 1. TypeCastTransform

struct TypeCastTransform: TransformPlugin {
    let id = "type_cast"
    let displayName = "Type Cast"

    func inputType() -> TypeSpec { TypeSpec(type: "any", nullable: true) }
    func outputType() -> TypeSpec { TypeSpec(type: "any", nullable: true) }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let targetType = optionString(config, "targetType", default: "string") ?? "string"
        let strict = optionBool(config, "strict")

        guard let value = value else {
            if strict { throw TransformError.invalidInput(provider: id, detail: "cannot cast nil in strict mode") }
            return defaultForType(targetType)
        }

        switch targetType {
        case "string":
            return castToString(value)
        case "number", "int", "float", "double":
            return try castToNumber(value, subType: targetType, strict: strict)
        case "boolean", "bool":
            return castToBoolean(value)
        case "date":
            return try castToDate(value, strict: strict)
        case "timestamp":
            return try castToTimestamp(value, strict: strict)
        case "array":
            return castToArray(value)
        default:
            throw TransformError.invalidInput(provider: id, detail: "unknown target type \"\(targetType)\"")
        }
    }

    private func castToString(_ value: Any) -> String {
        if let d = value as? Date { return ISO8601DateFormatter().string(from: d) }
        return stringify(value)
    }

    private func castToNumber(_ value: Any, subType: String, strict: Bool) throws -> Any {
        if let n = value as? NSNumber {
            return subType == "int" ? n.intValue : n.doubleValue
        }
        if let b = value as? Bool { return b ? 1 : 0 }
        if let s = value as? String {
            // Strip currency symbols, commas, whitespace
            let cleaned = s.replacingOccurrences(of: "[\\$\u{20AC}\u{00A3}\u{00A5},\\s]", with: "", options: .regularExpression)
            if subType == "int" {
                if let i = Int(cleaned) { return i }
            } else {
                if let d = Double(cleaned) { return d }
            }
            if strict { throw TransformError.castFailed(from: "String", to: subType, value: s) }
            return 0
        }
        if let d = value as? Date { return d.timeIntervalSince1970 }
        if strict { throw TransformError.castFailed(from: String(describing: type(of: value)), to: subType, value: stringify(value)) }
        return 0
    }

    private func castToBoolean(_ value: Any) -> Bool {
        if let b = value as? Bool { return b }
        if let n = value as? NSNumber { return n.boolValue }
        if let s = value as? String {
            let lower = s.lowercased().trimmingCharacters(in: .whitespaces)
            return ["true", "yes", "1", "on", "t", "y"].contains(lower)
        }
        return false
    }

    private func castToDate(_ value: Any, strict: Bool) throws -> Date {
        if let d = value as? Date { return d }
        if let n = value as? TimeInterval {
            return Date(timeIntervalSince1970: n < 1e12 ? n : n / 1000)
        }
        if let s = value as? String {
            // ISO 8601
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = isoFormatter.date(from: s) { return d }
            let isoBasic = ISO8601DateFormatter()
            if let d = isoBasic.date(from: s) { return d }

            // yyyy-MM-dd
            let dateFormatter = DateFormatter()
            dateFormatter.locale = Locale(identifier: "en_US_POSIX")
            for format in ["yyyy-MM-dd", "MM/dd/yyyy", "dd.MM.yyyy", "dd-MM-yyyy",
                           "MMM dd, yyyy", "dd MMM yyyy", "MMMM dd, yyyy"] {
                dateFormatter.dateFormat = format
                if let d = dateFormatter.date(from: s) { return d }
            }

            // Unix timestamp as string
            if let n = Double(s) {
                return Date(timeIntervalSince1970: n < 1e12 ? n : n / 1000)
            }

            if strict { throw TransformError.dateParseFailed(value: s) }
            return Date.distantPast
        }
        if strict { throw TransformError.castFailed(from: String(describing: type(of: value)), to: "date", value: stringify(value)) }
        return Date.distantPast
    }

    private func castToTimestamp(_ value: Any, strict: Bool) throws -> TimeInterval {
        let date = try castToDate(value, strict: strict)
        return date.timeIntervalSince1970
    }

    private func castToArray(_ value: Any) -> [Any] {
        if let arr = value as? [Any] { return arr }
        if let s = value as? String {
            if let data = s.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data),
               let arr = json as? [Any] { return arr }
            return s.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        }
        return [value]
    }

    private func defaultForType(_ type: String) -> Any? {
        switch type {
        case "string": return ""
        case "number", "int", "float", "double": return 0
        case "boolean", "bool": return false
        case "date": return nil
        case "timestamp": return 0.0
        case "array": return [Any]()
        default: return nil
        }
    }
}

// MARK: - 2. DefaultValueTransform

struct DefaultValueTransform: TransformPlugin {
    let id = "default_value"
    let displayName = "Default Value"

    func inputType() -> TypeSpec { TypeSpec(type: "any", nullable: true) }
    func outputType() -> TypeSpec { TypeSpec(type: "any") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let defaultVal = config.options["default"]
        let treatEmptyStringAsNull = optionBool(config, "treatEmptyStringAsNull", default: true)
        let treatZeroAsNull = optionBool(config, "treatZeroAsNull")
        let treatEmptyArrayAsNull = optionBool(config, "treatEmptyArrayAsNull")

        if value == nil || value is NSNull { return defaultVal }
        if treatEmptyStringAsNull, let s = value as? String, s.trimmingCharacters(in: .whitespaces).isEmpty {
            return defaultVal
        }
        if treatZeroAsNull, let n = value as? NSNumber, n.doubleValue == 0 { return defaultVal }
        if treatEmptyArrayAsNull, let arr = value as? [Any], arr.isEmpty { return defaultVal }

        return value
    }
}

// MARK: - 3. LookupTransform

struct LookupTransform: TransformPlugin {
    let id = "lookup"
    let displayName = "Lookup Table"

    func inputType() -> TypeSpec { TypeSpec(type: "string") }
    func outputType() -> TypeSpec { TypeSpec(type: "any") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let table = (config.options["table"] as? [String: Any]) ?? [:]
        let caseSensitive = optionBool(config, "caseSensitive")
        let fallback = config.options["fallback"]
        let errorOnMissing = optionBool(config, "errorOnMissing")

        let key = stringify(value)

        if caseSensitive {
            if let result = table[key] { return result }
        } else {
            let lowerKey = key.lowercased()
            for (k, v) in table {
                if k.lowercased() == lowerKey { return v }
            }
        }

        if errorOnMissing {
            throw TransformError.lookupMissing(key: key, provider: id)
        }
        return fallback ?? value
    }
}

// MARK: - 4. MigrationLookupTransform

struct MigrationLookupTransform: TransformPlugin {
    let id = "migration_lookup"
    let displayName = "Migration Lookup (Provenance)"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "id") }
    func outputType() -> TypeSpec { TypeSpec(type: "string", format: "uuid") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let provenanceMap = (config.options["provenanceMap"] as? [String: String]) ?? [:]
        let entityType = optionString(config, "entityType", default: "") ?? ""
        let errorOnMissing = optionBool(config, "errorOnMissing", default: true)
        let fallbackPrefix = optionString(config, "fallbackPrefix", default: "") ?? ""

        let oldId = stringify(value)
        guard !oldId.isEmpty else { return nil }

        let compositeKey = entityType.isEmpty ? oldId : "\(entityType):\(oldId)"
        if let resolved = provenanceMap[compositeKey] ?? provenanceMap[oldId] {
            return resolved
        }

        if errorOnMissing {
            throw TransformError.lookupMissing(key: oldId, provider: id)
        }
        if !fallbackPrefix.isEmpty { return "\(fallbackPrefix)\(oldId)" }
        return nil
    }
}

// MARK: - 5. ConcatTransform

struct ConcatTransform: TransformPlugin {
    let id = "concat"
    let displayName = "Concatenate"

    func inputType() -> TypeSpec { TypeSpec(type: "array", elementType: "any") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let separator = optionString(config, "separator", default: " ") ?? " "
        let skipNulls = optionBool(config, "skipNulls", default: true)
        let skipEmpty = optionBool(config, "skipEmpty", default: true)
        let template = optionString(config, "template")

        // Template interpolation for dictionary values
        if let template = template, let dict = value as? [String: Any] {
            return interpolateTemplate(template, values: dict)
        }

        let values: [Any?]
        if let arr = value as? [Any?] { values = arr }
        else { values = [value] }

        let additionalValues = (config.options["additionalValues"] as? [Any?]) ?? []
        let allValues = values + additionalValues

        var parts: [String] = []
        for v in allValues {
            if skipNulls && v == nil { continue }
            let str = stringify(v)
            if skipEmpty && str.trimmingCharacters(in: .whitespaces).isEmpty { continue }
            parts.append(str)
        }

        return parts.joined(separator: separator)
    }

    private func interpolateTemplate(_ template: String, values: [String: Any]) -> String {
        var result = template
        for (key, val) in values {
            result = result.replacingOccurrences(of: "{\(key)}", with: stringify(val))
        }
        // Remove any remaining unmatched placeholders
        if let regex = try? NSRegularExpression(pattern: "\\{\\w+\\}") {
            result = regex.stringByReplacingMatches(in: result, range: NSRange(result.startIndex..., in: result), withTemplate: "")
        }
        return result
    }
}

// MARK: - 6. SplitTransform

struct SplitTransform: TransformPlugin {
    let id = "split"
    let displayName = "Split String"

    func inputType() -> TypeSpec { TypeSpec(type: "string") }
    func outputType() -> TypeSpec { TypeSpec(type: "array", elementType: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let delimiter = optionString(config, "delimiter", default: ",") ?? ","
        let isRegex = optionBool(config, "regex")
        let limit = optionInt(config, "limit")
        let trim = optionBool(config, "trim", default: true)
        let removeEmpty = optionBool(config, "removeEmpty", default: true)

        let str = stringify(value)
        guard !str.isEmpty else { return [String]() }

        var parts: [String]
        if isRegex {
            if let regex = try? NSRegularExpression(pattern: delimiter) {
                let nsStr = str as NSString
                let fullRange = NSRange(location: 0, length: nsStr.length)
                let matches = regex.matches(in: str, range: fullRange)
                parts = []
                var lastEnd = 0
                for match in matches {
                    let start = lastEnd
                    let end = match.range.location
                    parts.append(nsStr.substring(with: NSRange(location: start, length: end - start)))
                    lastEnd = match.range.location + match.range.length
                }
                parts.append(nsStr.substring(from: lastEnd))
            } else {
                parts = [str]
            }
        } else {
            parts = str.components(separatedBy: delimiter)
        }

        if let limit = limit, parts.count > limit {
            parts = Array(parts.prefix(limit))
        }
        if trim { parts = parts.map { $0.trimmingCharacters(in: .whitespaces) } }
        if removeEmpty { parts = parts.filter { !$0.isEmpty } }

        return parts
    }
}

// MARK: - 7. FormatTransform

struct FormatTransform: TransformPlugin {
    let id = "format"
    let displayName = "String Format"

    func inputType() -> TypeSpec { TypeSpec(type: "any") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let template = optionString(config, "template", default: "{value}") ?? "{value}"

        // Dictionary interpolation
        if let dict = value as? [String: Any] {
            var result = template
            for (key, val) in dict {
                result = result.replacingOccurrences(of: "{\(key)}", with: stringify(val))
            }
            return result
        }

        // Scalar interpolation
        var result = template
        let displayVal = stringify(value)
        result = result.replacingOccurrences(of: "{value}", with: displayVal)
        result = result.replacingOccurrences(of: "{0}", with: displayVal)

        // Array element interpolation
        if let arr = value as? [Any] {
            for (idx, item) in arr.enumerated() {
                result = result.replacingOccurrences(of: "{\(idx)}", with: stringify(item))
            }
        }

        return result
    }
}

// MARK: - 8. SlugifyTransform

struct SlugifyTransform: TransformPlugin {
    let id = "slugify"
    let displayName = "Slugify"

    func inputType() -> TypeSpec { TypeSpec(type: "string") }
    func outputType() -> TypeSpec { TypeSpec(type: "string", format: "slug") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let separator = optionString(config, "separator", default: "-") ?? "-"
        let maxLength = optionInt(config, "maxLength", default: 200) ?? 200
        let lowercase = optionBool(config, "lowercase", default: true)

        var slug = stringify(value)

        // 1. Unicode normalization — decompose combined characters (NFD)
        slug = slug.decomposedStringWithCanonicalMapping

        // 2. Remove diacritical marks (combining characters U+0300...U+036F)
        slug = slug.unicodeScalars
            .filter { !($0.value >= 0x0300 && $0.value <= 0x036F) }
            .map { String($0) }
            .joined()

        // 3. Transliterate common special characters
        let charMap: [String: String] = [
            "\u{00E6}": "ae", "\u{00C6}": "AE", "\u{00F8}": "o", "\u{00D8}": "O",
            "\u{00DF}": "ss", "\u{00F0}": "d", "\u{00D0}": "D", "\u{00FE}": "th",
            "\u{00DE}": "TH", "\u{0142}": "l", "\u{0141}": "L",
            "&": "and", "@": "at", "#": "number",
        ]
        for (char, replacement) in charMap {
            slug = slug.replacingOccurrences(of: char, with: replacement)
        }

        // 4. Case conversion
        if lowercase { slug = slug.lowercased() }

        // 5. Replace non-alphanumeric characters with separator
        if let regex = try? NSRegularExpression(pattern: "[^a-zA-Z0-9]+") {
            slug = regex.stringByReplacingMatches(
                in: slug,
                range: NSRange(slug.startIndex..., in: slug),
                withTemplate: separator
            )
        }

        // 6. Collapse consecutive separators
        let escapedSep = NSRegularExpression.escapedPattern(for: separator)
        if let regex = try? NSRegularExpression(pattern: "\(escapedSep){2,}") {
            slug = regex.stringByReplacingMatches(
                in: slug,
                range: NSRange(slug.startIndex..., in: slug),
                withTemplate: separator
            )
        }

        // 7. Trim separators from start and end
        while slug.hasPrefix(separator) { slug = String(slug.dropFirst(separator.count)) }
        while slug.hasSuffix(separator) { slug = String(slug.dropLast(separator.count)) }

        // 8. Enforce max length — break at word boundary if possible
        if slug.count > maxLength {
            slug = String(slug.prefix(maxLength))
            if let lastSep = slug.range(of: separator, options: .backwards) {
                let distance = slug.distance(from: slug.startIndex, to: lastSep.lowerBound)
                if distance > Int(Double(maxLength) * 0.7) {
                    slug = String(slug[slug.startIndex..<lastSep.lowerBound])
                }
            }
        }

        return slug
    }
}

// MARK: - 9. HtmlToMarkdownTransform

struct HtmlToMarkdownTransform: TransformPlugin {
    let id = "html_to_markdown"
    let displayName = "HTML to Markdown"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "html") }
    func outputType() -> TypeSpec { TypeSpec(type: "string", format: "markdown") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let bulletMarker = optionString(config, "bulletMarker", default: "-") ?? "-"

        var html = stringify(value)
        html = html.replacingOccurrences(of: "\r\n", with: "\n")

        // Code blocks: <pre><code class="language-X">...</code></pre>
        if let regex = try? NSRegularExpression(
            pattern: "<pre[^>]*>\\s*<code[^>]*(?:class=[\"'][^\"']*language-(\\w+)[^\"']*[\"'])?[^>]*>([\\s\\S]*?)</code>\\s*</pre>",
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) {
            html = replaceMatches(html, regex: regex) { match, groups in
                let lang = groups.count > 1 ? groups[1] : ""
                let code = decodeEntities(groups.count > 2 ? groups[2] : "")
                return "\n\n```\(lang)\n\(code)\n```\n\n"
            }
        }

        // Headings h1-h6
        for level in 1...6 {
            let prefix = String(repeating: "#", count: level)
            if let regex = try? NSRegularExpression(
                pattern: "<h\(level)[^>]*>([\\s\\S]*?)</h\(level)>",
                options: [.caseInsensitive, .dotMatchesLineSeparators]
            ) {
                html = replaceMatches(html, regex: regex) { _, groups in
                    let text = stripTags(groups.count > 1 ? groups[1] : "").trimmingCharacters(in: .whitespacesAndNewlines)
                    return "\n\n\(prefix) \(text)\n\n"
                }
            }
        }

        // Blockquotes
        if let regex = try? NSRegularExpression(
            pattern: "<blockquote[^>]*>([\\s\\S]*?)</blockquote>",
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) {
            html = replaceMatches(html, regex: regex) { _, groups in
                let text = stripTags(groups.count > 1 ? groups[1] : "").trimmingCharacters(in: .whitespacesAndNewlines)
                let lines = text.components(separatedBy: "\n").map { "> \($0.trimmingCharacters(in: .whitespaces))" }
                return "\n\n\(lines.joined(separator: "\n"))\n\n"
            }
        }

        // Ordered lists
        if let regex = try? NSRegularExpression(
            pattern: "<ol[^>]*>([\\s\\S]*?)</ol>",
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) {
            html = replaceMatches(html, regex: regex) { _, groups in
                let content = groups.count > 1 ? groups[1] : ""
                var counter = 0
                var result = "\n\n"
                if let liRegex = try? NSRegularExpression(pattern: "<li[^>]*>([\\s\\S]*?)</li>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                    let nsContent = content as NSString
                    let matches = liRegex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
                    for match in matches {
                        counter += 1
                        let text = match.numberOfRanges > 1 ? nsContent.substring(with: match.range(at: 1)) : ""
                        result += "\(counter). \(self.stripTags(text).trimmingCharacters(in: .whitespacesAndNewlines))\n"
                    }
                }
                return result + "\n"
            }
        }

        // Unordered lists
        if let regex = try? NSRegularExpression(
            pattern: "<ul[^>]*>([\\s\\S]*?)</ul>",
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) {
            html = replaceMatches(html, regex: regex) { _, groups in
                let content = groups.count > 1 ? groups[1] : ""
                var result = "\n\n"
                if let liRegex = try? NSRegularExpression(pattern: "<li[^>]*>([\\s\\S]*?)</li>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                    let nsContent = content as NSString
                    let matches = liRegex.matches(in: content, range: NSRange(location: 0, length: nsContent.length))
                    for match in matches {
                        let text = match.numberOfRanges > 1 ? nsContent.substring(with: match.range(at: 1)) : ""
                        result += "\(bulletMarker) \(self.stripTags(text).trimmingCharacters(in: .whitespacesAndNewlines))\n"
                    }
                }
                return result + "\n"
            }
        }

        // Paragraphs
        if let regex = try? NSRegularExpression(pattern: "<p[^>]*>([\\s\\S]*?)</p>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "\n\n$1\n\n")
        }

        // Horizontal rules
        if let regex = try? NSRegularExpression(pattern: "<hr\\s*/?>", options: .caseInsensitive) {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "\n\n---\n\n")
        }

        // Line breaks
        if let regex = try? NSRegularExpression(pattern: "<br\\s*/?>", options: .caseInsensitive) {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "  \n")
        }

        // Links: <a href="url">text</a> -> [text](url)
        if let regex = try? NSRegularExpression(
            pattern: "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)</a>",
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) {
            html = replaceMatches(html, regex: regex) { _, groups in
                let href = groups.count > 1 ? groups[1] : ""
                let text = self.stripTags(groups.count > 2 ? groups[2] : "").trimmingCharacters(in: .whitespaces)
                return "[\(text)](\(href))"
            }
        }

        // Images: <img src="url" alt="text"> -> ![text](url)
        if let regex = try? NSRegularExpression(
            pattern: "<img[^>]+src=[\"']([^\"']+)[\"'][^>]*alt=[\"']([^\"']*?)[\"'][^>]*/?>",
            options: .caseInsensitive
        ) {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "![$2]($1)")
        }

        // Bold
        for tag in ["strong", "b"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>([\\s\\S]*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "**$1**")
            }
        }

        // Italic
        for tag in ["em", "i"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>([\\s\\S]*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "_$1_")
            }
        }

        // Strikethrough
        for tag in ["del", "s", "strike"] {
            if let regex = try? NSRegularExpression(pattern: "<\(tag)[^>]*>([\\s\\S]*?)</\(tag)>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
                html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "~~$1~~")
            }
        }

        // Inline code
        if let regex = try? NSRegularExpression(pattern: "<code[^>]*>([\\s\\S]*?)</code>", options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "`$1`")
        }

        // Strip remaining tags
        html = stripTags(html)

        // Decode entities
        html = decodeEntities(html)

        // Collapse excessive whitespace
        if let regex = try? NSRegularExpression(pattern: "\\n{3,}") {
            html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "\n\n")
        }

        return html.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func replaceMatches(_ string: String, regex: NSRegularExpression, using block: (String, [String]) -> String) -> String {
        var result = string
        let nsStr = string as NSString
        let matches = regex.matches(in: string, range: NSRange(location: 0, length: nsStr.length))

        for match in matches.reversed() {
            var groups: [String] = []
            for i in 0..<match.numberOfRanges {
                let range = match.range(at: i)
                groups.append(range.location != NSNotFound ? nsStr.substring(with: range) : "")
            }
            let fullMatch = groups[0]
            let replacement = block(fullMatch, groups)
            if let range = Range(match.range, in: result) {
                result = result.replacingCharacters(in: range, with: replacement)
            }
        }
        return result
    }

    private func stripTags(_ html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "<[^>]+>") else { return html }
        return regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
    }

    private func decodeEntities(_ html: String) -> String {
        html.replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }
}

// MARK: - 10. MarkdownToHtmlTransform

struct MarkdownToHtmlTransform: TransformPlugin {
    let id = "markdown_to_html"
    let displayName = "Markdown to HTML"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "markdown") }
    func outputType() -> TypeSpec { TypeSpec(type: "string", format: "html") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        var md = stringify(value)

        // Fenced code blocks
        if let regex = try? NSRegularExpression(pattern: "```(\\w*)\\n([\\s\\S]*?)\\n```", options: []) {
            md = replaceAll(md, regex: regex) { groups in
                let lang = groups.count > 1 ? groups[1] : ""
                let code = escapeHtml(groups.count > 2 ? groups[2] : "")
                let langAttr = lang.isEmpty ? "" : " class=\"language-\(lang)\""
                return "<pre><code\(langAttr)>\(code)</code></pre>"
            }
        }

        // ATX headings
        if let regex = try? NSRegularExpression(pattern: "^(#{1,6})\\s+(.+?)(?:\\s+#+)?$", options: .anchorsMatchLines) {
            md = replaceAll(md, regex: regex) { groups in
                let level = (groups.count > 1 ? groups[1] : "#").count
                let text = groups.count > 2 ? groups[2].trimmingCharacters(in: .whitespaces) : ""
                return "<h\(level)>\(text)</h\(level)>"
            }
        }

        // Horizontal rules
        if let regex = try? NSRegularExpression(pattern: "^(?:[-*_]\\s*){3,}$", options: .anchorsMatchLines) {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "<hr />")
        }

        // Blockquotes
        if let regex = try? NSRegularExpression(pattern: "(?:^>\\s?.+\\n?)+", options: .anchorsMatchLines) {
            md = replaceAll(md, regex: regex) { groups in
                let block = groups[0]
                var text = block
                if let lineRegex = try? NSRegularExpression(pattern: "^>\\s?", options: .anchorsMatchLines) {
                    text = lineRegex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
                }
                return "<blockquote><p>\(text.trimmingCharacters(in: .whitespacesAndNewlines))</p></blockquote>"
            }
        }

        // Unordered lists
        if let regex = try? NSRegularExpression(pattern: "(?:^[*+\\-]\\s+.+\\n?)+", options: .anchorsMatchLines) {
            md = replaceAll(md, regex: regex) { groups in
                let block = groups[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let items = block.components(separatedBy: "\n").map { line -> String in
                    var text = line
                    if let itemRegex = try? NSRegularExpression(pattern: "^[*+\\-]\\s+") {
                        text = itemRegex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
                    }
                    return "<li>\(text)</li>"
                }
                return "<ul>\n\(items.joined(separator: "\n"))\n</ul>"
            }
        }

        // Ordered lists
        if let regex = try? NSRegularExpression(pattern: "(?:^\\d+\\.\\s+.+\\n?)+", options: .anchorsMatchLines) {
            md = replaceAll(md, regex: regex) { groups in
                let block = groups[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let items = block.components(separatedBy: "\n").map { line -> String in
                    var text = line
                    if let itemRegex = try? NSRegularExpression(pattern: "^\\d+\\.\\s+") {
                        text = itemRegex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
                    }
                    return "<li>\(text)</li>"
                }
                return "<ol>\n\(items.joined(separator: "\n"))\n</ol>"
            }
        }

        // Images: ![alt](src "title")
        if let regex = try? NSRegularExpression(pattern: "!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*?)\")?\\)") {
            md = replaceAll(md, regex: regex) { groups in
                let alt = groups.count > 1 ? groups[1] : ""
                let src = groups.count > 2 ? groups[2] : ""
                let title = groups.count > 3 && !groups[3].isEmpty ? " title=\"\(groups[3])\"" : ""
                return "<img src=\"\(src)\" alt=\"\(alt)\"\(title) />"
            }
        }

        // Links: [text](href "title")
        if let regex = try? NSRegularExpression(pattern: "\\[([^\\]]+)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*?)\")?\\)") {
            md = replaceAll(md, regex: regex) { groups in
                let text = groups.count > 1 ? groups[1] : ""
                let href = groups.count > 2 ? groups[2] : ""
                let title = groups.count > 3 && !groups[3].isEmpty ? " title=\"\(groups[3])\"" : ""
                return "<a href=\"\(href)\"\(title)>\(text)</a>"
            }
        }

        // Bold: **text** or __text__
        if let regex = try? NSRegularExpression(pattern: "(\\*\\*|__)(.+?)\\1") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "<strong>$2</strong>")
        }

        // Italic: *text* or _text_
        if let regex = try? NSRegularExpression(pattern: "(\\*|_)(.+?)\\1") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "<em>$2</em>")
        }

        // Strikethrough: ~~text~~
        if let regex = try? NSRegularExpression(pattern: "~~(.+?)~~") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "<del>$1</del>")
        }

        // Inline code: `code`
        if let regex = try? NSRegularExpression(pattern: "`([^`]+)`") {
            md = regex.stringByReplacingMatches(in: md, range: NSRange(md.startIndex..., in: md), withTemplate: "<code>$1</code>")
        }

        return md
    }

    private func replaceAll(_ string: String, regex: NSRegularExpression, using block: ([String]) -> String) -> String {
        var result = string
        let nsStr = string as NSString
        let matches = regex.matches(in: string, range: NSRange(location: 0, length: nsStr.length))
        for match in matches.reversed() {
            var groups: [String] = []
            for i in 0..<match.numberOfRanges {
                let range = match.range(at: i)
                groups.append(range.location != NSNotFound ? nsStr.substring(with: range) : "")
            }
            let replacement = block(groups)
            if let range = Range(match.range, in: result) {
                result = result.replacingCharacters(in: range, with: replacement)
            }
        }
        return result
    }

    private func escapeHtml(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

// MARK: - 11. StripTagsTransform

struct StripTagsTransform: TransformPlugin {
    let id = "strip_tags"
    let displayName = "Strip HTML Tags"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "html") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let allowedTags = (config.options["allowedTags"] as? [String]) ?? []
        let decodeEntities = optionBool(config, "decodeEntities", default: true)
        let collapseWhitespace = optionBool(config, "collapseWhitespace", default: true)

        var html = stringify(value)

        if allowedTags.isEmpty {
            // Remove all tags
            if let regex = try? NSRegularExpression(pattern: "<[^>]+>") {
                html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
            }
        } else {
            // Remove only tags not in allowlist
            let allowedSet = Set(allowedTags.map { $0.lowercased() })

            // Closing tags
            if let regex = try? NSRegularExpression(pattern: "</([a-zA-Z][a-zA-Z0-9]*)\\s*>") {
                let nsStr = html as NSString
                let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsStr.length))
                for match in matches.reversed() {
                    let tagRange = match.range(at: 1)
                    let tag = nsStr.substring(with: tagRange).lowercased()
                    if !allowedSet.contains(tag) {
                        html = (html as NSString).replacingCharacters(in: match.range, with: "")
                    }
                }
            }

            // Opening tags
            if let regex = try? NSRegularExpression(pattern: "<([a-zA-Z][a-zA-Z0-9]*)(\\s[^>]*?)?\\s*/?>") {
                let nsStr = html as NSString
                let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsStr.length))
                for match in matches.reversed() {
                    let tagRange = match.range(at: 1)
                    let tag = nsStr.substring(with: tagRange).lowercased()
                    if !allowedSet.contains(tag) {
                        html = (html as NSString).replacingCharacters(in: match.range, with: "")
                    }
                }
            }
        }

        if decodeEntities {
            html = html.replacingOccurrences(of: "&nbsp;", with: " ")
                .replacingOccurrences(of: "&amp;", with: "&")
                .replacingOccurrences(of: "&lt;", with: "<")
                .replacingOccurrences(of: "&gt;", with: ">")
                .replacingOccurrences(of: "&quot;", with: "\"")
                .replacingOccurrences(of: "&#39;", with: "'")
        }

        if collapseWhitespace {
            if let regex = try? NSRegularExpression(pattern: "\\s+") {
                html = regex.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: " ")
            }
            html = html.trimmingCharacters(in: .whitespaces)
        }

        return html
    }
}

// MARK: - 12. TruncateTransform

struct TruncateTransform: TransformPlugin {
    let id = "truncate"
    let displayName = "Truncate"

    func inputType() -> TypeSpec { TypeSpec(type: "string") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let maxLength = optionInt(config, "maxLength", default: 100) ?? 100
        let ellipsis = optionString(config, "ellipsis", default: "...") ?? "..."
        let position = optionString(config, "position", default: "end") ?? "end"
        let wordBoundary = optionBool(config, "wordBoundary")

        let str = stringify(value)
        guard str.count > maxLength else { return str }

        let truncLen = maxLength - ellipsis.count
        guard truncLen > 0 else { return String(ellipsis.prefix(maxLength)) }

        switch position {
        case "start":
            let startIdx = str.index(str.startIndex, offsetBy: str.count - truncLen)
            return ellipsis + String(str[startIdx...])

        case "middle":
            let halfLen = truncLen / 2
            let firstHalf = String(str.prefix(halfLen))
            let secondHalf = String(str.suffix(truncLen - halfLen))
            return firstHalf + ellipsis + secondHalf

        default: // "end"
            var truncated = String(str.prefix(truncLen))
            if wordBoundary {
                if let lastSpace = truncated.range(of: " ", options: .backwards) {
                    let distance = truncated.distance(from: truncated.startIndex, to: lastSpace.lowerBound)
                    if distance > Int(Double(truncLen) * 0.5) {
                        truncated = String(truncated[..<lastSpace.lowerBound])
                    }
                }
            }
            return truncated + ellipsis
        }
    }
}

// MARK: - 13. RegexReplaceTransform

struct RegexReplaceTransform: TransformPlugin {
    let id = "regex_replace"
    let displayName = "Regex Replace"

    func inputType() -> TypeSpec { TypeSpec(type: "string") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let pattern = optionString(config, "pattern", default: "") ?? ""
        let replacement = optionString(config, "replacement", default: "") ?? ""
        let caseInsensitive = optionBool(config, "caseInsensitive")

        guard !pattern.isEmpty else { return value }

        let str = stringify(value)
        var options: NSRegularExpression.Options = []
        if caseInsensitive { options.insert(.caseInsensitive) }

        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else {
            throw TransformError.invalidPattern(pattern: pattern, detail: "failed to compile regex")
        }

        // NSRegularExpression uses $1, $2 for back-references (same syntax)
        return regex.stringByReplacingMatches(
            in: str,
            range: NSRange(str.startIndex..., in: str),
            withTemplate: replacement
        )
    }
}

// MARK: - 14. DateFormatTransform

struct DateFormatTransform: TransformPlugin {
    let id = "date_format"
    let displayName = "Date Format"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "date") }
    func outputType() -> TypeSpec { TypeSpec(type: "string") }

    private static let monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let monthNamesLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let outputFormat = optionString(config, "outputFormat", default: "yyyy-MM-dd") ?? "yyyy-MM-dd"
        let locale = optionString(config, "locale")
        let timezone = optionString(config, "timezone")

        guard let date = parseDate(value) else {
            throw TransformError.dateParseFailed(value: stringify(value))
        }

        let formatter = DateFormatter()
        formatter.dateFormat = convertTokensToICU(outputFormat)
        formatter.locale = Locale(identifier: locale ?? "en_US_POSIX")
        if let tz = timezone { formatter.timeZone = TimeZone(identifier: tz) }

        return formatter.string(from: date)
    }

    private func parseDate(_ value: Any?) -> Date? {
        guard let value = value else { return nil }
        if let d = value as? Date { return d }
        if let n = value as? TimeInterval {
            return Date(timeIntervalSince1970: n < 1e12 ? n : n / 1000)
        }

        guard let str = value as? String else { return nil }
        let trimmed = str.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }

        // Relative dates
        if let relative = parseRelativeDate(trimmed) { return relative }

        // ISO 8601
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFormatter.date(from: trimmed) { return d }
        let isoBasic = ISO8601DateFormatter()
        if let d = isoBasic.date(from: trimmed) { return d }

        // Common date formats
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let formats = [
            "yyyy-MM-dd", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ssZ",
            "MM/dd/yyyy", "M/d/yyyy", "dd.MM.yyyy", "dd-MM-yyyy",
            "MMM dd, yyyy", "dd MMM yyyy", "MMMM dd, yyyy", "dd MMMM yyyy",
            "MMM d, yyyy", "d MMM yyyy",
            "yyyy/MM/dd", "yyyyMMdd",
        ]
        for format in formats {
            formatter.dateFormat = format
            if let d = formatter.date(from: trimmed) { return d }
        }

        // Unix timestamp as string
        if let n = Double(trimmed) {
            return Date(timeIntervalSince1970: n < 1e12 ? n : n / 1000)
        }

        return nil
    }

    private func parseRelativeDate(_ str: String) -> Date? {
        let lower = str.lowercased()
        let now = Date()

        if lower == "now" || lower == "today" { return now }
        if lower == "yesterday" { return Calendar.current.date(byAdding: .day, value: -1, to: now) }
        if lower == "tomorrow" { return Calendar.current.date(byAdding: .day, value: 1, to: now) }

        // "N units ago"
        if let regex = try? NSRegularExpression(pattern: "^(\\d+)\\s+(second|minute|hour|day|week|month|year)s?\\s+ago$"),
           let match = regex.firstMatch(in: lower, range: NSRange(lower.startIndex..., in: lower)) {
            let amountRange = Range(match.range(at: 1), in: lower)!
            let unitRange = Range(match.range(at: 2), in: lower)!
            let amount = Int(lower[amountRange])!
            let unit = String(lower[unitRange])
            return offsetDate(now, amount: -amount, unit: unit)
        }

        // "in N units"
        if let regex = try? NSRegularExpression(pattern: "^in\\s+(\\d+)\\s+(second|minute|hour|day|week|month|year)s?$"),
           let match = regex.firstMatch(in: lower, range: NSRange(lower.startIndex..., in: lower)) {
            let amountRange = Range(match.range(at: 1), in: lower)!
            let unitRange = Range(match.range(at: 2), in: lower)!
            let amount = Int(lower[amountRange])!
            let unit = String(lower[unitRange])
            return offsetDate(now, amount: amount, unit: unit)
        }

        return nil
    }

    private func offsetDate(_ date: Date, amount: Int, unit: String) -> Date? {
        let calendar = Calendar.current
        let component: Calendar.Component
        switch unit {
        case "second": component = .second
        case "minute": component = .minute
        case "hour": component = .hour
        case "day": component = .day
        case "week": component = .weekOfYear
        case "month": component = .month
        case "year": component = .year
        default: return nil
        }
        return calendar.date(byAdding: component, value: amount, to: date)
    }

    /// Convert moment.js-style tokens to ICU/DateFormatter tokens.
    private func convertTokensToICU(_ format: String) -> String {
        // Map common tokens: YYYY->yyyy, DD->dd, MMM->MMM (same), etc.
        var result = format
        result = result.replacingOccurrences(of: "YYYY", with: "yyyy")
        result = result.replacingOccurrences(of: "YY", with: "yy")
        result = result.replacingOccurrences(of: "DD", with: "dd")
        result = result.replacingOccurrences(of: "D", with: "d")
        result = result.replacingOccurrences(of: "HH", with: "HH")
        result = result.replacingOccurrences(of: "hh", with: "hh")
        result = result.replacingOccurrences(of: "mm", with: "mm")
        result = result.replacingOccurrences(of: "ss", with: "ss")
        result = result.replacingOccurrences(of: "SSS", with: "SSS")
        result = result.replacingOccurrences(of: "A", with: "a")
        return result
    }
}

// MARK: - 15. JsonExtractTransform

struct JsonExtractTransform: TransformPlugin {
    let id = "json_extract"
    let displayName = "JSON Extract"

    func inputType() -> TypeSpec { TypeSpec(type: "string", format: "json") }
    func outputType() -> TypeSpec { TypeSpec(type: "any") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let path = optionString(config, "path", default: "$") ?? "$"
        let defaultValue = config.options["default"]
        let parseInput = optionBool(config, "parseInput", default: true)

        var data: Any?
        if let str = value as? String, parseInput {
            guard let jsonData = str.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) else {
                throw TransformError.invalidInput(provider: id, detail: "invalid JSON input")
            }
            data = parsed
        } else {
            data = value
        }

        let result = evaluatePath(data, path: path)
        return result ?? defaultValue
    }

    private func evaluatePath(_ data: Any?, path: String) -> Any? {
        guard let data = data else { return nil }
        if path == "$" || path.isEmpty { return data }

        var normalizedPath = path
        if normalizedPath.hasPrefix("$.") { normalizedPath = String(normalizedPath.dropFirst(2)) }
        else if normalizedPath.hasPrefix("$") { normalizedPath = String(normalizedPath.dropFirst(1)) }

        // Recursive descent
        if normalizedPath.hasPrefix("..") {
            let key = String(normalizedPath.dropFirst(2)).components(separatedBy: CharacterSet(charactersIn: ".[")).first ?? ""
            return recursiveDescend(data, key: key)
        }

        let segments = parsePath(normalizedPath)
        var current: Any? = data

        for segment in segments {
            guard let currentVal = current else { return nil }

            if segment == "*" {
                if let arr = currentVal as? [Any] { return arr }
                if let dict = currentVal as? [String: Any] { return Array(dict.values) }
                return nil
            }

            if let arr = currentVal as? [Any] {
                if let idx = Int(segment) {
                    let effectiveIdx = idx < 0 ? arr.count + idx : idx
                    current = effectiveIdx >= 0 && effectiveIdx < arr.count ? arr[effectiveIdx] : nil
                } else {
                    current = arr.compactMap { item -> Any? in
                        (item as? [String: Any])?[segment]
                    }
                }
            } else if let dict = currentVal as? [String: Any] {
                current = dict[segment]
            } else {
                return nil
            }
        }

        return current
    }

    private func parsePath(_ path: String) -> [String] {
        var segments: [String] = []
        guard let regex = try? NSRegularExpression(pattern: "\\.?([^.\\[\\]]+)|\\[(\\d+|\"[^\"]+\"|'[^']+'|\\*)\\]") else {
            return path.components(separatedBy: ".")
        }

        let nsPath = path as NSString
        let matches = regex.matches(in: path, range: NSRange(location: 0, length: nsPath.length))
        for match in matches {
            let segment: String
            if match.range(at: 1).location != NSNotFound {
                segment = nsPath.substring(with: match.range(at: 1))
            } else if match.range(at: 2).location != NSNotFound {
                segment = nsPath.substring(with: match.range(at: 2))
            } else {
                continue
            }
            // Remove surrounding quotes
            let cleaned = segment.trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            segments.append(cleaned)
        }
        return segments
    }

    private func recursiveDescend(_ data: Any, key: String) -> Any? {
        var results: [Any] = []
        search(data, key: key, results: &results)
        if results.count == 1 { return results[0] }
        return results.isEmpty ? nil : results
    }

    private func search(_ obj: Any, key: String, results: inout [Any]) {
        if let dict = obj as? [String: Any] {
            if let val = dict[key] { results.append(val) }
            for val in dict.values { search(val, key: key, results: &results) }
        } else if let arr = obj as? [Any] {
            for item in arr { search(item, key: key, results: &results) }
        }
    }
}

// MARK: - 16. ExpressionTransform

struct ExpressionTransform: TransformPlugin {
    let id = "expression"
    let displayName = "Expression"

    func inputType() -> TypeSpec { TypeSpec(type: "any") }
    func outputType() -> TypeSpec { TypeSpec(type: "any") }

    func transform(value: Any?, config: TransformConfig) throws -> Any? {
        let expression = optionString(config, "expression") ?? ""
        let variables = (config.options["variables"] as? [String: Any]) ?? [:]

        guard !expression.isEmpty else {
            throw TransformError.invalidExpression(expression: "", detail: "expression is required")
        }

        // Build evaluation context
        var context: [String: Any] = ["value": value as Any]
        for (k, v) in variables { context[k] = v }
        if let dict = value as? [String: Any] {
            for (k, v) in dict { context[k] = v }
        }

        // Use NSExpression for safe evaluation of mathematical expressions
        return evaluateExpression(expression, context: context)
    }

    private func evaluateExpression(_ expr: String, context: [String: Any]) -> Any? {
        // Substitute variable references with their values
        var processedExpr = expr

        // Sort keys by length (longest first) to avoid partial replacements
        let sortedKeys = context.keys.sorted { $0.count > $1.count }
        for key in sortedKeys {
            if let numVal = context[key] as? NSNumber {
                processedExpr = processedExpr.replacingOccurrences(of: key, with: numVal.stringValue)
            } else if let strVal = context[key] as? String {
                processedExpr = processedExpr.replacingOccurrences(of: key, with: "\"\(strVal)\"")
            }
        }

        // Handle string concatenation with +
        if processedExpr.contains("\"") && processedExpr.contains("+") {
            return evaluateStringConcat(processedExpr, context: context)
        }

        // Attempt NSExpression evaluation for arithmetic
        do {
            let nsExpr = NSExpression(format: processedExpr)
            return nsExpr.expressionValue(with: nil, context: nil)
        } catch {
            throw TransformError.invalidExpression(expression: expr, detail: error.localizedDescription) as! Never
        }
    }

    private func evaluateStringConcat(_ expr: String, context: [String: Any]) -> String {
        // Split by + and concatenate, handling quoted strings and variable references
        let parts = expr.components(separatedBy: "+").map { part -> String in
            let trimmed = part.trimmingCharacters(in: .whitespaces)
            // Quoted string
            if trimmed.hasPrefix("\"") && trimmed.hasSuffix("\"") {
                return String(trimmed.dropFirst().dropLast())
            }
            // Variable reference
            if let val = context[trimmed] {
                return stringify(val)
            }
            return trimmed
        }
        return parts.joined()
    }
}

// MARK: - Provider Registry

/// All transform plugin providers indexed by their unique ID.
let transformPluginProviders: [String: any TransformPlugin] = [
    "type_cast": TypeCastTransform(),
    "default_value": DefaultValueTransform(),
    "lookup": LookupTransform(),
    "migration_lookup": MigrationLookupTransform(),
    "concat": ConcatTransform(),
    "split": SplitTransform(),
    "format": FormatTransform(),
    "slugify": SlugifyTransform(),
    "html_to_markdown": HtmlToMarkdownTransform(),
    "markdown_to_html": MarkdownToHtmlTransform(),
    "strip_tags": StripTagsTransform(),
    "truncate": TruncateTransform(),
    "regex_replace": RegexReplaceTransform(),
    "date_format": DateFormatTransform(),
    "json_extract": JsonExtractTransform(),
    "expression": ExpressionTransform(),
]

/// Resolve a transform provider by its ID.
func resolveTransformProvider(id: String) -> (any TransformPlugin)? {
    return transformPluginProviders[id]
}

/// Execute a transform by provider ID, value, and config.
func executeTransform(value: Any?, config: TransformConfig) throws -> Any? {
    guard let provider = resolveTransformProvider(id: config.providerId) else {
        throw TransformError.invalidInput(provider: "registry", detail: "provider \"\(config.providerId)\" not found")
    }
    return try provider.transform(value: value, config: config)
}
