// Field Mapper Plugin — source path resolution implementations for the FieldMapping concept
// Provides pluggable path syntax resolvers to extract values from raw records using
// direct dot-notation, JSONPath, XPath, regex, template interpolation, and computed expressions.
// See Data Integration Kit field-mapping.concept for the parent FieldMapping concept definition.

import Foundation

// MARK: - Core Types

/// A raw source record — a nested structure representable as a dictionary.
typealias RawRecord = [String: Any]

/// Configuration for a mapper provider.
struct MapperConfig {
    var returnAll: Bool = false
    var defaultValue: Any?
    var namespaces: [String: String]?
    var regexFlags: String?
    var captureGroup: Any? // String (named) or Int (numbered)
    var functions: [String: ([Any]) -> Any]?
    var formatSpecifiers: [String: String]?
    var fallbackValues: [String: Any]?
    var providerOptions: [String: Any]?
}

/// Interface every field-mapper provider must implement.
protocol FieldMapperPlugin {
    var id: String { get }
    var displayName: String { get }

    /// Resolve a source path to a value within the given record.
    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any?

    /// Check whether this provider supports the given path syntax.
    func supports(pathSyntax: String) -> Bool
}

// MARK: - Errors

enum FieldMapperError: Error, LocalizedError {
    case unsupportedSyntax(provider: String, path: String)
    case invalidExpression(detail: String)
    case resolutionFailed(path: String, detail: String)

    var errorDescription: String? {
        switch self {
        case .unsupportedSyntax(let p, let path): return "\(p) does not support path syntax: \(path)"
        case .invalidExpression(let d): return "Invalid expression: \(d)"
        case .resolutionFailed(let path, let d): return "Failed to resolve '\(path)': \(d)"
        }
    }
}

// MARK: - Helpers

/// Safely retrieve a value from a nested object using an array of keys.
private func getNestedValue(_ obj: Any?, keys: [String]) -> Any? {
    var current: Any? = obj
    for key in keys {
        guard let curr = current else { return nil }
        if let dict = curr as? [String: Any] {
            current = dict[key]
        } else if let arr = curr as? [Any], let idx = Int(key), idx >= 0, idx < arr.count {
            current = arr[idx]
        } else {
            return nil
        }
    }
    return current
}

/// Parse a dot-notation path with bracket support into an array of keys.
/// Handles paths like "a.b[0].c" -> ["a", "b", "0", "c"]
private func parseDotPath(_ path: String) -> [String] {
    var keys: [String] = []
    let segments = path.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
    for segment in segments {
        if segment.contains("[") {
            keys.append(contentsOf: expandBrackets(segment))
        } else {
            keys.append(segment)
        }
    }
    return keys
}

/// Parse bracket-notation segments like `items[0]` into `["items", "0"]`.
private func expandBrackets(_ segment: String) -> [String] {
    var parts: [String] = []
    let pattern = try? NSRegularExpression(pattern: "^([^\\[]*)\\[([^\\]]+)\\](.*)$")
    var remaining = segment

    guard let regex = pattern,
          let match = regex.firstMatch(in: remaining, range: NSRange(remaining.startIndex..., in: remaining)) else {
        return [segment]
    }

    if let keyRange = Range(match.range(at: 1), in: remaining) {
        let key = String(remaining[keyRange])
        if !key.isEmpty { parts.append(key) }
    }
    if let idxRange = Range(match.range(at: 2), in: remaining) {
        parts.append(String(remaining[idxRange]))
    }
    if let restRange = Range(match.range(at: 3), in: remaining) {
        remaining = String(remaining[restRange])
    } else {
        remaining = ""
    }

    // Handle chained brackets [0][1]
    let chainPattern = try? NSRegularExpression(pattern: "^\\[([^\\]]+)\\](.*)$")
    while !remaining.isEmpty {
        guard let chainRegex = chainPattern,
              let chainMatch = chainRegex.firstMatch(in: remaining, range: NSRange(remaining.startIndex..., in: remaining)) else { break }
        if let idxRange = Range(chainMatch.range(at: 1), in: remaining) {
            parts.append(String(remaining[idxRange]))
        }
        if let restRange = Range(chainMatch.range(at: 2), in: remaining) {
            remaining = String(remaining[restRange])
        } else {
            break
        }
    }

    return parts
}

// MARK: - 1. DirectMapper — Direct key-to-key mapping with dot notation

/// DirectMapper resolves field values using simple dot-notation paths.
///
/// Supported syntax:
///   - Simple key: `name`
///   - Nested path: `address.city`
///   - Array index: `items[0].name`
///   - Wildcard: `items[*].name` (returns array of all matching values)
///   - Deep wildcard: `**.name` (recursive search for key)
///
/// Reference: Drupal Feeds simple field mapping.
struct DirectMapper: FieldMapperPlugin {
    let id = "direct"
    let displayName = "Direct Field Mapper (Dot Notation)"

    func supports(pathSyntax: String) -> Bool {
        if pathSyntax.hasPrefix("$.") || pathSyntax.hasPrefix("//") || pathSyntax.hasPrefix("{") {
            return false
        }
        if let regex = try? NSRegularExpression(pattern: "^/.*/$"),
           regex.firstMatch(in: pathSyntax, range: NSRange(pathSyntax.startIndex..., in: pathSyntax)) != nil {
            return false
        }
        if pathSyntax.hasPrefix("**.") { return true }
        if let regex = try? NSRegularExpression(pattern: "^[a-zA-Z_][\\w.*\\[\\]0-9-]*$"),
           regex.firstMatch(in: pathSyntax, range: NSRange(pathSyntax.startIndex..., in: pathSyntax)) != nil {
            return true
        }
        return false
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        // Deep wildcard: **.key
        if sourcePath.hasPrefix("**.") {
            let targetKey = String(sourcePath.dropFirst(3))
            let results = recursiveSearch(record, targetKey: targetKey)
            if results.isEmpty { return config.defaultValue }
            return config.returnAll ? results : results.first
        }

        let keys = parseDotPath(sourcePath)

        // Check for wildcard segments
        if let wildcardIdx = keys.firstIndex(of: "*") {
            return resolveWildcard(record, keys: keys, wildcardIdx: wildcardIdx, config: config)
        }

        let value = getNestedValue(record, keys: keys)
        return value ?? config.defaultValue
    }

    private func recursiveSearch(_ obj: Any, targetKey: String) -> [Any] {
        var results: [Any] = []

        if let dict = obj as? [String: Any] {
            if let val = dict[targetKey] {
                results.append(val)
            }
            for (_, value) in dict {
                if value is [String: Any] || value is [Any] {
                    results.append(contentsOf: recursiveSearch(value, targetKey: targetKey))
                }
            }
        } else if let arr = obj as? [Any] {
            for item in arr {
                results.append(contentsOf: recursiveSearch(item, targetKey: targetKey))
            }
        }

        return results
    }

    private func resolveWildcard(_ record: Any, keys: [String], wildcardIdx: Int, config: MapperConfig) -> Any? {
        let prefix = Array(keys[..<wildcardIdx])
        let suffix = Array(keys[(wildcardIdx + 1)...])
        let container = prefix.isEmpty ? record : getNestedValue(record, keys: prefix)

        guard let arr = container as? [Any] else { return config.defaultValue }

        var results: [Any] = []
        for item in arr {
            if suffix.isEmpty {
                results.append(item)
            } else if let nestedWildcard = suffix.firstIndex(of: "*") {
                if let nested = resolveWildcard(item, keys: suffix, wildcardIdx: nestedWildcard, config: config) {
                    if let nestedArr = nested as? [Any] {
                        results.append(contentsOf: nestedArr)
                    } else {
                        results.append(nested)
                    }
                }
            } else {
                if let value = getNestedValue(item, keys: suffix) {
                    results.append(value)
                }
            }
        }

        if results.isEmpty { return config.defaultValue }
        return config.returnAll != false ? results : results.first
    }
}

// MARK: - 2. JsonPathMapper — JSONPath expressions for complex JSON navigation

/// JsonPathMapper resolves values from JSON records using JSONPath expressions.
///
/// Supported syntax (RFC 9535 / Goessner specification):
///   - Root: `$`
///   - Child: `$.store.name`
///   - Recursive descent: `$..name`
///   - Array index: `$.items[0]`
///   - Array slice: `$.items[0:5]`, `$.items[::2]`
///   - Wildcard: `$.items[*]`
///   - Filter: `$.items[?(@.price < 10)]`
///   - Union: `$.items[0,2,4]`
///
/// Reference: Drupal External Entities JSONPath mapper.
struct JsonPathMapper: FieldMapperPlugin {
    let id = "jsonpath"
    let displayName = "JSONPath Expression Mapper"

    func supports(pathSyntax: String) -> Bool {
        return pathSyntax.hasPrefix("$")
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        let results = evaluate(record, path: sourcePath)
        if results.isEmpty { return config.defaultValue }
        return config.returnAll ? results : results.first
    }

    private func evaluate(_ root: Any, path: String) -> [Any] {
        let tokens = tokenize(path)
        var current: [Any] = [root]

        for token in tokens {
            var next: [Any] = []
            for node in current {
                next.append(contentsOf: applyToken(root: root, node: node, token: token))
            }
            current = next
        }

        return current
    }

    private enum JPToken {
        case child(String)
        case index(Int)
        case wildcard
        case recursiveDescent(String)
        case filter(String)
        case slice(String)
        case union(String)
    }

    private func tokenize(_ path: String) -> [JPToken] {
        var tokens: [JPToken] = []
        var i = path.startIndex

        // Skip leading $
        if i < path.endIndex && path[i] == "$" { i = path.index(after: i) }

        while i < path.endIndex {
            if path[i] == "." {
                let next = path.index(after: i)
                if next < path.endIndex && path[next] == "." {
                    // Recursive descent
                    i = path.index(after: next)
                    let name = readName(path, from: &i)
                    tokens.append(.recursiveDescent(name))
                } else {
                    // Dot child
                    i = next
                    let name = readName(path, from: &i)
                    tokens.append(.child(name))
                }
            } else if path[i] == "[" {
                let (token, end) = readBracket(path, from: i)
                tokens.append(token)
                i = end
            } else {
                let name = readName(path, from: &i)
                if !name.isEmpty {
                    tokens.append(.child(name))
                }
            }
        }

        return tokens
    }

    private func readName(_ path: String, from i: inout String.Index) -> String {
        var name = ""
        while i < path.endIndex && path[i] != "." && path[i] != "[" {
            name.append(path[i])
            i = path.index(after: i)
        }
        return name
    }

    private func readBracket(_ path: String, from start: String.Index) -> (JPToken, String.Index) {
        var depth = 0
        var i = start
        var inString = false
        var stringChar: Character = "\0"

        while i < path.endIndex {
            if !inString {
                if path[i] == "[" { depth += 1 }
                else if path[i] == "]" {
                    depth -= 1
                    if depth == 0 { break }
                }
                else if path[i] == "'" || path[i] == "\"" {
                    inString = true
                    stringChar = path[i]
                }
            } else {
                if path[i] == stringChar { inString = false }
            }
            i = path.index(after: i)
        }

        let innerStart = path.index(after: start)
        let inner = String(path[innerStart..<i]).trimmingCharacters(in: .whitespaces)
        let end = i < path.endIndex ? path.index(after: i) : i

        if inner == "*" { return (.wildcard, end) }
        if inner.hasPrefix("?") { return (.filter(String(inner.dropFirst()).trimmingCharacters(in: .whitespaces)), end) }
        if inner.contains(":") && !inner.hasPrefix("'") && !inner.hasPrefix("\"") {
            return (.slice(inner), end)
        }
        if inner.contains(",") { return (.union(inner), end) }
        if (inner.hasPrefix("'") && inner.hasSuffix("'")) || (inner.hasPrefix("\"") && inner.hasSuffix("\"")) {
            return (.child(String(inner.dropFirst().dropLast())), end)
        }
        if let num = Int(inner) { return (.index(num), end) }
        return (.child(inner), end)
    }

    private func applyToken(root: Any, node: Any, token: JPToken) -> [Any] {
        switch token {
        case .child(let name):
            if name == "*" { return getWildcard(node) }
            if let dict = node as? [String: Any], let val = dict[name] {
                return [val]
            }
            return []

        case .index(let idx):
            if let arr = node as? [Any] {
                let normalizedIdx = idx < 0 ? arr.count + idx : idx
                if normalizedIdx >= 0 && normalizedIdx < arr.count {
                    return [arr[normalizedIdx]]
                }
            }
            return []

        case .wildcard:
            return getWildcard(node)

        case .recursiveDescent(let name):
            return recursiveDescent(node, key: name)

        case .filter(let expr):
            guard let arr = node as? [Any] else { return [] }
            return arr.filter { evaluateFilter(root: root, item: $0, expr: expr) }

        case .slice(let sliceExpr):
            guard let arr = node as? [Any] else { return [] }
            return applySlice(arr, sliceExpr: sliceExpr)

        case .union(let unionExpr):
            return applyUnion(node, unionExpr: unionExpr)
        }
    }

    private func getWildcard(_ node: Any) -> [Any] {
        if let arr = node as? [Any] { return arr }
        if let dict = node as? [String: Any] { return Array(dict.values) }
        return []
    }

    private func recursiveDescent(_ node: Any, key: String) -> [Any] {
        var results: [Any] = []

        if let dict = node as? [String: Any] {
            if key == "*" {
                results.append(contentsOf: dict.values)
            } else if let val = dict[key] {
                results.append(val)
            }
            for (_, value) in dict {
                if value is [String: Any] || value is [Any] {
                    results.append(contentsOf: recursiveDescent(value, key: key))
                }
            }
        } else if let arr = node as? [Any] {
            for item in arr {
                results.append(contentsOf: recursiveDescent(item, key: key))
            }
        }

        return results
    }

    private func evaluateFilter(root: Any, item: Any, expr: String) -> Bool {
        var filterExpr = expr.trimmingCharacters(in: .whitespaces)
        if filterExpr.hasPrefix("(") && filterExpr.hasSuffix(")") {
            filterExpr = String(filterExpr.dropFirst().dropLast()).trimmingCharacters(in: .whitespaces)
        }

        // Parse comparison: @.field op value
        let compPattern = try? NSRegularExpression(pattern: "^(@[^<>=!]+?)\\s*(===?|!==?|<=?|>=?)\\s*(.+)$")
        if let regex = compPattern,
           let match = regex.firstMatch(in: filterExpr, range: NSRange(filterExpr.startIndex..., in: filterExpr)) {
            let leftPath = Range(match.range(at: 1), in: filterExpr).map { String(filterExpr[$0]).trimmingCharacters(in: .whitespaces) } ?? ""
            let op = Range(match.range(at: 2), in: filterExpr).map { String(filterExpr[$0]) } ?? ""
            let rightRaw = Range(match.range(at: 3), in: filterExpr).map { String(filterExpr[$0]).trimmingCharacters(in: .whitespaces) } ?? ""

            let leftValue = resolveFilterPath(root: root, item: item, path: leftPath)
            let rightValue = parseFilterValue(rightRaw)

            return compareValues(leftValue, op: op, rightValue)
        }

        // Existence check: @.field
        if filterExpr.hasPrefix("@") {
            let value = resolveFilterPath(root: root, item: item, path: filterExpr)
            return value != nil
        }

        return false
    }

    private func resolveFilterPath(root: Any, item: Any, path: String) -> Any? {
        if path.hasPrefix("@.") {
            let keys = parseDotPath(String(path.dropFirst(2)))
            return getNestedValue(item, keys: keys)
        }
        if path.hasPrefix("$.") {
            let keys = parseDotPath(String(path.dropFirst(2)))
            return getNestedValue(root, keys: keys)
        }
        return nil
    }

    private func parseFilterValue(_ raw: String) -> Any? {
        if (raw.hasPrefix("'") && raw.hasSuffix("'")) || (raw.hasPrefix("\"") && raw.hasSuffix("\"")) {
            return String(raw.dropFirst().dropLast())
        }
        if let num = Double(raw) { return num }
        if raw == "true" { return true }
        if raw == "false" { return false }
        if raw == "null" { return nil as Any? }
        return raw
    }

    private func compareValues(_ left: Any?, op: String, _ right: Any?) -> Bool {
        switch op {
        case "==", "===":
            return isEqual(left, right)
        case "!=", "!==":
            return !isEqual(left, right)
        case "<":
            return toDouble(left) < toDouble(right)
        case "<=":
            return toDouble(left) <= toDouble(right)
        case ">":
            return toDouble(left) > toDouble(right)
        case ">=":
            return toDouble(left) >= toDouble(right)
        default:
            return false
        }
    }

    private func isEqual(_ a: Any?, _ b: Any?) -> Bool {
        if a == nil && b == nil { return true }
        if let aStr = a as? String, let bStr = b as? String { return aStr == bStr }
        if let aNum = toOptionalDouble(a), let bNum = toOptionalDouble(b) { return aNum == bNum }
        if let aBool = a as? Bool, let bBool = b as? Bool { return aBool == bBool }
        return false
    }

    private func toDouble(_ val: Any?) -> Double {
        if let d = val as? Double { return d }
        if let i = val as? Int { return Double(i) }
        if let s = val as? String, let d = Double(s) { return d }
        return 0
    }

    private func toOptionalDouble(_ val: Any?) -> Double? {
        if let d = val as? Double { return d }
        if let i = val as? Int { return Double(i) }
        if let s = val as? String { return Double(s) }
        return nil
    }

    private func applySlice(_ arr: [Any], sliceExpr: String) -> [Any] {
        let parts = sliceExpr.split(separator: ":").map { $0.trimmingCharacters(in: .whitespaces) }
        let len = arr.count

        var start = parts.isEmpty || parts[0].isEmpty ? 0 : (Int(parts[0]) ?? 0)
        var end = parts.count < 2 || parts[1].isEmpty ? len : (Int(parts[1]) ?? len)
        let step = parts.count < 3 || parts[2].isEmpty ? 1 : (Int(parts[2]) ?? 1)

        if start < 0 { start = max(0, len + start) }
        if end < 0 { end = max(0, len + end) }
        start = min(start, len)
        end = min(end, len)

        guard step != 0 else { return [] }

        var results: [Any] = []
        if step > 0 {
            var i = start
            while i < end {
                results.append(arr[i])
                i += step
            }
        }
        return results
    }

    private func applyUnion(_ node: Any, unionExpr: String) -> [Any] {
        let parts = unionExpr.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        var results: [Any] = []

        for part in parts {
            if (part.hasPrefix("'") && part.hasSuffix("'")) || (part.hasPrefix("\"") && part.hasSuffix("\"")) {
                let key = String(part.dropFirst().dropLast())
                if let dict = node as? [String: Any], let val = dict[key] {
                    results.append(val)
                }
            } else if let idx = Int(part), let arr = node as? [Any] {
                let normalizedIdx = idx < 0 ? arr.count + idx : idx
                if normalizedIdx >= 0 && normalizedIdx < arr.count {
                    results.append(arr[normalizedIdx])
                }
            }
        }

        return results
    }
}

// MARK: - 3. XPathMapper — XPath expressions for XML sources

/// XPathMapper resolves values from XML source records using XPath expressions.
///
/// The record is expected to contain an `_xml` key with raw XML, or a pre-parsed
/// object representation with `_tag`, `_attrs`, `_children`, `_text` keys.
///
/// Reference: Drupal Migrate XML source.
struct XPathMapper: FieldMapperPlugin {
    let id = "xpath"
    let displayName = "XPath Expression Mapper"

    func supports(pathSyntax: String) -> Bool {
        return pathSyntax.hasPrefix("/") || pathSyntax.hasPrefix("//") ||
               pathSyntax.contains("::") ||
               (pathSyntax.hasPrefix(".") && pathSyntax.contains("/"))
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        let xmlSource = record["_xml"] as? String
        let root = xmlSource.map { parseXml($0) } ?? recordToXmlNode(record)

        let results = evaluateXPath(root, path: sourcePath, namespaces: config.namespaces ?? [:])
        if results.isEmpty { return config.defaultValue }
        return config.returnAll ? results : results.first
    }

    private struct XmlNode {
        let tag: String
        var attrs: [String: String]
        var children: [XmlNode]
        var text: String
    }

    private func parseXml(_ xml: String) -> XmlNode {
        var root = XmlNode(tag: "#document", attrs: [:], children: [], text: "")
        var stack: [XmlNode] = [root]

        // Simple regex-based XML tokenizer
        guard let tagPattern = try? NSRegularExpression(pattern: "</?([a-zA-Z_][\\w.:_-]*)([^>]*?)(/?)>|([^<]+)") else {
            return root
        }

        let nsString = xml as NSString
        let matches = tagPattern.matches(in: xml, range: NSRange(location: 0, length: nsString.length))

        for match in matches {
            let fullRange = match.range
            let fullMatch = nsString.substring(with: fullRange)

            // Text content
            if match.range(at: 4).location != NSNotFound {
                let text = nsString.substring(with: match.range(at: 4)).trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty && !stack.isEmpty {
                    stack[stack.count - 1].text += text
                }
                continue
            }

            guard match.range(at: 1).location != NSNotFound else { continue }
            let tagName = nsString.substring(with: match.range(at: 1))
            let isClosing = fullMatch.hasPrefix("</")
            let isSelfClosing = match.range(at: 3).location != NSNotFound && nsString.substring(with: match.range(at: 3)) == "/"

            if isClosing {
                if stack.count > 1 {
                    let completed = stack.removeLast()
                    stack[stack.count - 1].children.append(completed)
                }
            } else {
                // Parse attributes
                var attrs: [String: String] = [:]
                if match.range(at: 2).location != NSNotFound {
                    let attrsStr = nsString.substring(with: match.range(at: 2))
                    if let attrRegex = try? NSRegularExpression(pattern: "([a-zA-Z_][\\w.:_-]*)=[\"']([^\"']*)[\"']") {
                        let attrMatches = attrRegex.matches(in: attrsStr, range: NSRange(location: 0, length: (attrsStr as NSString).length))
                        for am in attrMatches {
                            let name = (attrsStr as NSString).substring(with: am.range(at: 1))
                            let value = (attrsStr as NSString).substring(with: am.range(at: 2))
                            attrs[name] = value
                        }
                    }
                }

                let node = XmlNode(tag: tagName, attrs: attrs, children: [], text: "")
                if isSelfClosing {
                    stack[stack.count - 1].children.append(node)
                } else {
                    stack.append(node)
                }
            }
        }

        // Flush remaining stack
        while stack.count > 1 {
            let completed = stack.removeLast()
            stack[stack.count - 1].children.append(completed)
        }

        return stack[0].children.count == 1 ? stack[0].children[0] : stack[0]
    }

    private func recordToXmlNode(_ record: RawRecord) -> XmlNode {
        func convert(_ key: String, _ value: Any) -> XmlNode {
            if let dict = value as? [String: Any] {
                var children: [XmlNode] = []
                var text = ""
                var attrs: [String: String] = [:]

                for (k, v) in dict {
                    if k.hasPrefix("@") { attrs[String(k.dropFirst())] = "\(v)" }
                    else if k == "#text" || k == "_text" { text = "\(v)" }
                    else if let arr = v as? [Any] {
                        for item in arr { children.append(convert(k, item)) }
                    } else {
                        children.append(convert(k, v))
                    }
                }
                return XmlNode(tag: key, attrs: attrs, children: children, text: text)
            }
            return XmlNode(tag: key, attrs: [:], children: [], text: "\(value)")
        }

        var root = XmlNode(tag: "#document", attrs: [:], children: [], text: "")
        for (key, value) in record where !key.hasPrefix("_") {
            if let arr = value as? [Any] {
                for item in arr { root.children.append(convert(key, item)) }
            } else {
                root.children.append(convert(key, value))
            }
        }
        return root.children.count == 1 ? root.children[0] : root
    }

    private struct XPathStep {
        var axis: String
        let nodeTest: String
        let predicates: [String]
    }

    private func evaluateXPath(_ root: XmlNode, path: String, namespaces: [String: String]) -> [Any] {
        let steps = parseXPathSteps(path)
        var current: [XmlNode] = [root]

        for step in steps {
            var next: [XmlNode] = []
            for node in current {
                next.append(contentsOf: applyStep(root: root, node: node, step: step, namespaces: namespaces))
            }
            current = next
        }

        // Extract text values
        return current.compactMap { node -> Any? in
            if node.tag.hasPrefix("@") { return node.text }
            if node.children.isEmpty { return node.text.isEmpty ? nil : node.text }
            return collectText(node)
        }.filter { !("\($0)" .isEmpty) }
    }

    private func collectText(_ node: XmlNode) -> String {
        var text = node.text
        for child in node.children { text += collectText(child) }
        return text
    }

    private func parseXPathSteps(_ path: String) -> [XPathStep] {
        var steps: [XPathStep] = []
        var remaining = path.trimmingCharacters(in: .whitespaces)

        while !remaining.isEmpty {
            if remaining.hasPrefix("//") {
                remaining = String(remaining.dropFirst(2))
                let (step, rest) = readStep(remaining)
                var modifiedStep = step
                modifiedStep.axis = "descendant-or-self"
                steps.append(modifiedStep)
                remaining = rest
            } else if remaining.hasPrefix("/") {
                remaining = String(remaining.dropFirst())
                guard !remaining.isEmpty else { break }
                let (step, rest) = readStep(remaining)
                steps.append(step)
                remaining = rest
            } else {
                let (step, rest) = readStep(remaining)
                steps.append(step)
                remaining = rest
            }
        }

        return steps
    }

    private func readStep(_ expr: String) -> (XPathStep, String) {
        var axis = "child"
        var remaining = expr

        // Check for axis notation
        if let axisRegex = try? NSRegularExpression(pattern: "^(ancestor|child|descendant|descendant-or-self|following|following-sibling|parent|preceding|preceding-sibling|self)::"),
           let match = axisRegex.firstMatch(in: remaining, range: NSRange(remaining.startIndex..., in: remaining)),
           let range = Range(match.range(at: 1), in: remaining) {
            axis = String(remaining[range])
            remaining = String(remaining[remaining.index(remaining.startIndex, offsetBy: match.range.length)...])
        }

        // text() function
        if remaining.hasPrefix("text()") {
            return (XPathStep(axis: axis, nodeTest: "text()", predicates: []), String(remaining.dropFirst(6)))
        }

        // Attribute @name
        if remaining.hasPrefix("@") {
            remaining = String(remaining.dropFirst())
            var name = ""
            for ch in remaining {
                if ch.isLetter || ch.isNumber || ch == "_" || ch == ":" || ch == "." || ch == "-" {
                    name.append(ch)
                } else { break }
            }
            if name.isEmpty { name = "*" }
            return (XPathStep(axis: "attribute", nodeTest: name, predicates: []), String(remaining.dropFirst(name.count)))
        }

        // Node test (tag name or *)
        var nodeTest = ""
        for ch in remaining {
            if ch.isLetter || ch.isNumber || ch == "_" || ch == ":" || ch == "." || ch == "-" || ch == "*" {
                nodeTest.append(ch)
            } else { break }
        }
        if nodeTest.isEmpty { nodeTest = "*" }
        remaining = String(remaining.dropFirst(nodeTest.count))

        // Read predicates [expr]
        var predicates: [String] = []
        while remaining.hasPrefix("[") {
            var depth = 0
            var i = remaining.startIndex
            while i < remaining.endIndex {
                if remaining[i] == "[" { depth += 1 }
                else if remaining[i] == "]" {
                    depth -= 1
                    if depth == 0 { break }
                }
                i = remaining.index(after: i)
            }
            let predStart = remaining.index(after: remaining.startIndex)
            predicates.append(String(remaining[predStart..<i]))
            remaining = String(remaining[remaining.index(after: i)...])
        }

        return (XPathStep(axis: axis, nodeTest: nodeTest, predicates: predicates), remaining)
    }

    private func applyStep(root: XmlNode, node: XmlNode, step: XPathStep, namespaces: [String: String]) -> [XmlNode] {
        var candidates: [XmlNode] = []

        if step.nodeTest == "text()" {
            return [XmlNode(tag: "#text", attrs: [:], children: [], text: node.text)]
        }

        switch step.axis {
        case "child":
            candidates = node.children.filter { matchesNodeTest($0, test: step.nodeTest, namespaces: namespaces) }
        case "descendant", "descendant-or-self":
            candidates = getDescendants(node, nodeTest: step.nodeTest, namespaces: namespaces, includeSelf: step.axis == "descendant-or-self")
        case "attribute":
            candidates = getAttributes(node, nameTest: step.nodeTest)
        case "self":
            if matchesNodeTest(node, test: step.nodeTest, namespaces: namespaces) {
                candidates = [node]
            }
        default:
            break
        }

        // Apply predicates
        for predicate in step.predicates {
            candidates = applyPredicate(root: root, candidates: candidates, predicate: predicate, namespaces: namespaces)
        }

        return candidates
    }

    private func getDescendants(_ node: XmlNode, nodeTest: String, namespaces: [String: String], includeSelf: Bool) -> [XmlNode] {
        var results: [XmlNode] = []
        if includeSelf && matchesNodeTest(node, test: nodeTest, namespaces: namespaces) {
            results.append(node)
        }
        for child in node.children {
            if matchesNodeTest(child, test: nodeTest, namespaces: namespaces) {
                results.append(child)
            }
            results.append(contentsOf: getDescendants(child, nodeTest: nodeTest, namespaces: namespaces, includeSelf: false))
        }
        return results
    }

    private func getAttributes(_ node: XmlNode, nameTest: String) -> [XmlNode] {
        if nameTest == "*" {
            return node.attrs.map { XmlNode(tag: "@\($0.key)", attrs: [:], children: [], text: $0.value) }
        }
        if let val = node.attrs[nameTest] {
            return [XmlNode(tag: "@\(nameTest)", attrs: [:], children: [], text: val)]
        }
        return []
    }

    private func matchesNodeTest(_ node: XmlNode, test: String, namespaces: [String: String]) -> Bool {
        if test == "*" { return !node.tag.hasPrefix("#") }
        if test.contains(":") {
            let parts = test.split(separator: ":", maxSplits: 1).map(String.init)
            if parts.count == 2, let _ = namespaces[parts[0]] {
                return node.tag == parts[1] || node.tag == test
            }
        }
        return node.tag == test
    }

    private func applyPredicate(root: XmlNode, candidates: [XmlNode], predicate: String, namespaces: [String: String]) -> [XmlNode] {
        let trimmed = predicate.trimmingCharacters(in: .whitespaces)

        // Positional predicate
        if let pos = Int(trimmed) {
            let idx = pos > 0 ? pos - 1 : candidates.count + pos
            return (idx >= 0 && idx < candidates.count) ? [candidates[idx]] : []
        }

        if trimmed == "last()" {
            return candidates.isEmpty ? [] : [candidates.last!]
        }

        // Attribute existence: @attr
        if trimmed.hasPrefix("@") && !trimmed.contains("=") {
            let attrName = String(trimmed.dropFirst())
            return candidates.filter { $0.attrs[attrName] != nil }
        }

        // Attribute comparison: @attr='value'
        if let regex = try? NSRegularExpression(pattern: "^@([\\w.:_-]+)\\s*(=|!=|<|>)\\s*[\"']([^\"']*)[\"']$"),
           let match = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)) {
            let attrName = Range(match.range(at: 1), in: trimmed).map { String(trimmed[$0]) } ?? ""
            let op = Range(match.range(at: 2), in: trimmed).map { String(trimmed[$0]) } ?? ""
            let value = Range(match.range(at: 3), in: trimmed).map { String(trimmed[$0]) } ?? ""

            return candidates.filter { node in
                guard let attrVal = node.attrs[attrName] else { return false }
                switch op {
                case "=": return attrVal == value
                case "!=": return attrVal != value
                case "<": return (Double(attrVal) ?? 0) < (Double(value) ?? 0)
                case ">": return (Double(attrVal) ?? 0) > (Double(value) ?? 0)
                default: return false
                }
            }
        }

        return candidates
    }
}

// MARK: - 4. RegexMapper — Regex capture groups

/// RegexMapper extracts values from string fields using regular expressions.
///
/// Supported syntax:
///   - Standard regex: `/Price: \$(\d+\.\d+)/`
///   - Flags: `/pattern/gi`
///   - Named groups: `/(?<amount>\d+\.\d+)/`
///   - Source field prefix: `fieldName:/pattern/`
///
/// Reference: OpenRefine GREL regex extraction.
struct RegexMapper: FieldMapperPlugin {
    let id = "regex"
    let displayName = "Regex Capture Group Mapper"

    func supports(pathSyntax: String) -> Bool {
        if let regex = try? NSRegularExpression(pattern: "^([\\w.]+:)?/.*/$"),
           regex.firstMatch(in: pathSyntax, range: NSRange(pathSyntax.startIndex..., in: pathSyntax)) != nil {
            return true
        }
        // Also accept with flags
        if let regex = try? NSRegularExpression(pattern: "^([\\w.]+:)?/.*?/[gimsuvy]*$"),
           regex.firstMatch(in: pathSyntax, range: NSRange(pathSyntax.startIndex..., in: pathSyntax)) != nil {
            return true
        }
        return false
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        guard let parsed = parseRegexPath(sourcePath, config: config) else {
            return config.defaultValue
        }

        let sourceText: String
        if let field = parsed.sourceField {
            let keys = parseDotPath(field)
            guard let value = getNestedValue(record, keys: keys) as? String else {
                return config.defaultValue
            }
            sourceText = value
        } else if let raw = record["_raw"] as? String {
            sourceText = raw
        } else if let text = record["_text"] as? String {
            sourceText = text
        } else {
            // Stringify the record
            if let data = try? JSONSerialization.data(withJSONObject: record),
               let str = String(data: data, encoding: .utf8) {
                sourceText = str
            } else {
                return config.defaultValue
            }
        }

        let nsString = sourceText as NSString
        let range = NSRange(location: 0, length: nsString.length)

        if config.returnAll || parsed.isGlobal {
            let matches = parsed.regex.matches(in: sourceText, range: range)
            if matches.isEmpty { return config.defaultValue }
            return matches.compactMap { extractCaptureGroup($0, from: sourceText, captureGroup: parsed.captureGroup) }
        }

        guard let match = parsed.regex.firstMatch(in: sourceText, range: range) else {
            return config.defaultValue
        }

        return extractCaptureGroup(match, from: sourceText, captureGroup: parsed.captureGroup) ?? config.defaultValue
    }

    private struct ParsedRegex {
        let regex: NSRegularExpression
        let sourceField: String?
        let captureGroup: Any // String or Int
        let isGlobal: Bool
    }

    private func parseRegexPath(_ path: String, config: MapperConfig) -> ParsedRegex? {
        // Check for field:/pattern/flags syntax
        var sourceField: String?
        var regexPart = path

        if let fieldRegex = try? NSRegularExpression(pattern: "^([\\w.]+):(/.*?/[gimsuvy]*)$"),
           let match = fieldRegex.firstMatch(in: path, range: NSRange(path.startIndex..., in: path)) {
            sourceField = Range(match.range(at: 1), in: path).map { String(path[$0]) }
            regexPart = Range(match.range(at: 2), in: path).map { String(path[$0]) } ?? path
        }

        // Parse /pattern/flags
        guard let regexMatch = try? NSRegularExpression(pattern: "^/(.*)/([gimsuvy]*)$"),
              let match = regexMatch.firstMatch(in: regexPart, range: NSRange(regexPart.startIndex..., in: regexPart)),
              let patternRange = Range(match.range(at: 1), in: regexPart) else { return nil }

        let pattern = String(regexPart[patternRange])
        let flags = Range(match.range(at: 2), in: regexPart).map { String(regexPart[$0]) } ?? ""
        let actualFlags = config.regexFlags ?? flags

        var options: NSRegularExpression.Options = []
        if actualFlags.contains("i") { options.insert(.caseInsensitive) }
        if actualFlags.contains("s") { options.insert(.dotMatchesLineSeparators) }
        if actualFlags.contains("m") { options.insert(.anchorsMatchLines) }

        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return nil }

        let captureGroup: Any = config.captureGroup ?? 1
        let isGlobal = actualFlags.contains("g")

        return ParsedRegex(regex: regex, sourceField: sourceField, captureGroup: captureGroup, isGlobal: isGlobal)
    }

    private func extractCaptureGroup(_ match: NSTextCheckingResult, from text: String, captureGroup: Any) -> Any? {
        let nsText = text as NSString

        // Named capture group (NSRegularExpression does not natively support this via API,
        // but we can use numbered groups as fallback)
        if let groupNum = captureGroup as? Int {
            if groupNum < match.numberOfRanges && match.range(at: groupNum).location != NSNotFound {
                return nsText.substring(with: match.range(at: groupNum))
            }
        }

        // Default: group 1, then group 0
        if match.numberOfRanges > 1 && match.range(at: 1).location != NSNotFound {
            return nsText.substring(with: match.range(at: 1))
        }
        if match.range(at: 0).location != NSNotFound {
            return nsText.substring(with: match.range(at: 0))
        }

        return nil
    }
}

// MARK: - 5. TemplateMapper — String interpolation with multiple field references

/// TemplateMapper assembles values from multiple fields using template interpolation.
///
/// Supported syntax:
///   - Simple interpolation: `{first_name} {last_name}`
///   - Nested paths: `{address.city}, {address.state}`
///   - Fallback values: `{nickname|first_name|"Anonymous"}`
///   - Format specifiers: `{price:.2f}`, `{name:upper}`
///   - Conditional segments: `{?phone}Phone: {phone}{/phone}`
///
/// Reference: Drupal Migrate concat plugin.
struct TemplateMapper: FieldMapperPlugin {
    let id = "template"
    let displayName = "Template Interpolation Mapper"

    func supports(pathSyntax: String) -> Bool {
        return pathSyntax.contains("{") && pathSyntax.contains("}") &&
               !pathSyntax.hasPrefix("$") && !pathSyntax.hasPrefix("/")
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        return interpolate(record, template: sourcePath, config: config)
    }

    private func interpolate(_ record: RawRecord, template: String, config: MapperConfig) -> String {
        var result = template

        // Process conditional segments: {?field}content{/field}
        result = processConditionals(record, template: result, config: config)

        // Replace field references {field} and {field:format}
        if let regex = try? NSRegularExpression(pattern: "\\\\?\\{([^}]+)\\}") {
            let nsResult = result as NSString
            let matches = regex.matches(in: result, range: NSRange(location: 0, length: nsResult.length))

            // Process in reverse to preserve ranges
            for match in matches.reversed() {
                let fullMatch = nsResult.substring(with: match.range)
                if fullMatch.hasPrefix("\\") {
                    // Escaped brace: remove the backslash
                    result = (result as NSString).replacingCharacters(in: match.range, with: String(fullMatch.dropFirst()))
                    continue
                }

                let expression = Range(match.range(at: 1), in: result).map { String(result[$0]).trimmingCharacters(in: .whitespaces) } ?? ""
                let resolved = resolveExpression(record, expression: expression, config: config)
                result = (result as NSString).replacingCharacters(in: match.range, with: resolved)
            }
        }

        return result
    }

    private func processConditionals(_ record: RawRecord, template: String, config: MapperConfig) -> String {
        guard let regex = try? NSRegularExpression(pattern: "\\{\\?(\\w[\\w.]*)\\}([\\s\\S]*?)\\{/\\1\\}", options: .dotMatchesLineSeparators) else {
            return template
        }

        var result = template
        var matches = regex.matches(in: result, range: NSRange(location: 0, length: (result as NSString).length))

        while !matches.isEmpty {
            // Process in reverse
            for match in matches.reversed() {
                let fieldName = Range(match.range(at: 1), in: result).map { String(result[$0]) } ?? ""
                let content = Range(match.range(at: 2), in: result).map { String(result[$0]) } ?? ""

                let keys = parseDotPath(fieldName)
                let value = getNestedValue(record, keys: keys)

                let replacement: String
                if let v = value, !(v is NSNull), !"\(v)".isEmpty {
                    replacement = interpolate(record, template: content, config: config)
                } else {
                    replacement = ""
                }

                result = (result as NSString).replacingCharacters(in: match.range, with: replacement)
            }
            matches = regex.matches(in: result, range: NSRange(location: 0, length: (result as NSString).length))
        }

        return result
    }

    private func resolveExpression(_ record: RawRecord, expression: String, config: MapperConfig) -> String {
        var fieldExpr = expression
        var formatSpec: String?

        // Find format specifier (last : not inside fallback chain)
        let lastPipe = expression.lastIndex(of: "|").map { expression.distance(from: expression.startIndex, to: $0) } ?? -1
        let lastColon = expression.lastIndex(of: ":").map { expression.distance(from: expression.startIndex, to: $0) } ?? -1

        if lastColon > lastPipe {
            let colonIdx = expression.index(expression.startIndex, offsetBy: lastColon)
            fieldExpr = String(expression[..<colonIdx])
            formatSpec = String(expression[expression.index(after: colonIdx)...])
        }

        // Resolve with fallback chain
        let value = resolveWithFallback(record, fieldExpr: fieldExpr, config: config)

        guard let resolved = value else { return "" }

        if let format = formatSpec {
            return applyFormat(resolved, format: format)
        }

        if let configFormats = config.formatSpecifiers, let format = configFormats[fieldExpr] {
            return applyFormat(resolved, format: format)
        }

        return "\(resolved)"
    }

    private func resolveWithFallback(_ record: RawRecord, fieldExpr: String, config: MapperConfig) -> Any? {
        let alternatives = fieldExpr.split(separator: "|").map { $0.trimmingCharacters(in: .whitespaces) }

        for alt in alternatives {
            // String literal
            if (alt.hasPrefix("\"") && alt.hasSuffix("\"")) || (alt.hasPrefix("'") && alt.hasSuffix("'")) {
                return String(alt.dropFirst().dropLast())
            }

            let keys = parseDotPath(alt)
            if let value = getNestedValue(record, keys: keys) {
                let str = "\(value)"
                if !str.isEmpty && !(value is NSNull) { return value }
            }

            if let fallbacks = config.fallbackValues, let fallback = fallbacks[alt] {
                return fallback
            }
        }

        return config.defaultValue
    }

    private func applyFormat(_ value: Any, format: String) -> String {
        // Number formats: .2f
        if let numRegex = try? NSRegularExpression(pattern: "^\\.(\\d+)f$"),
           let match = numRegex.firstMatch(in: format, range: NSRange(format.startIndex..., in: format)),
           let decimalsRange = Range(match.range(at: 1), in: format) {
            let decimals = Int(format[decimalsRange]) ?? 0
            if let num = value as? Double {
                return String(format: "%.\(decimals)f", num)
            } else if let num = value as? Int {
                return String(format: "%.\(decimals)f", Double(num))
            }
        }

        switch format.lowercased() {
        case "upper", "uppercase":
            return "\(value)".uppercased()
        case "lower", "lowercase":
            return "\(value)".lowercased()
        case "capitalize", "title":
            return "\(value)".capitalized
        case "trim":
            return "\(value)".trimmingCharacters(in: .whitespacesAndNewlines)
        case "slug":
            return "\(value)".lowercased()
                .replacingOccurrences(of: "[^\\w\\s-]", with: "", options: .regularExpression)
                .replacingOccurrences(of: "[\\s_]+", with: "-", options: .regularExpression)
                .replacingOccurrences(of: "-+", with: "-", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
        case "json":
            if let data = try? JSONSerialization.data(withJSONObject: value),
               let str = String(data: data, encoding: .utf8) {
                return str
            }
            return "\(value)"
        case "urlencoded":
            return "\(value)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "\(value)"
        default:
            return "\(value)"
        }
    }
}

// MARK: - 6. ComputedMapper — Arbitrary expressions via ExpressionLanguage

/// ComputedMapper evaluates arithmetic and logical expressions referencing record fields.
///
/// Supported syntax:
///   - Arithmetic: `price * quantity * (1 + tax_rate)`
///   - Comparisons: `age >= 18`
///   - Logical: `is_member && total > 100`
///   - Ternary: `is_premium ? price * 0.9 : price`
///   - String concat: `first_name ~ " " ~ last_name`
///   - Function calls: `round(price * 1.1, 2)`, `max(a, b)`, `length(name)`
///
/// Reference: Drupal Migrate callback plugin, Symfony ExpressionLanguage.
struct ComputedMapper: FieldMapperPlugin {
    let id = "computed"
    let displayName = "Computed Expression Mapper"

    func supports(pathSyntax: String) -> Bool {
        if pathSyntax.hasPrefix("$") || pathSyntax.hasPrefix("/") || pathSyntax.hasPrefix("//") {
            return false
        }
        if pathSyntax.contains("{") && pathSyntax.contains("}") { return false }

        // Must contain at least one operator or function call
        if let regex = try? NSRegularExpression(pattern: "[+\\-*/%<>=!&|?:~(]"),
           regex.firstMatch(in: pathSyntax, range: NSRange(pathSyntax.startIndex..., in: pathSyntax)) != nil {
            return true
        }
        return false
    }

    func resolve(record: RawRecord, sourcePath: String, config: MapperConfig) -> Any? {
        let allFunctions = buildFunctions(config: config)
        let tokens = tokenize(sourcePath)
        let parser = ExprParser(tokens: tokens, record: record, functions: allFunctions)
        do {
            return try parser.parseTernary()
        } catch {
            return config.defaultValue
        }
    }

    // MARK: Built-in functions

    private func buildFunctions(config: MapperConfig) -> [String: ([Any]) -> Any] {
        var funcs: [String: ([Any]) -> Any] = [
            "round": { args in
                let n = toDouble(args.first)
                let d = args.count > 1 ? Int(toDouble(args[1])) : 0
                let factor = pow(10.0, Double(d))
                return Darwin.round(n * factor) / factor
            },
            "floor": { args in Foundation.floor(toDouble(args.first)) },
            "ceil": { args in Foundation.ceil(toDouble(args.first)) },
            "abs": { args in Swift.abs(toDouble(args.first)) },
            "min": { args in args.map { toDouble($0) }.min() ?? 0.0 },
            "max": { args in args.map { toDouble($0) }.max() ?? 0.0 },
            "sqrt": { args in Foundation.sqrt(toDouble(args.first)) },
            "pow": { args in Foundation.pow(toDouble(args.first), toDouble(args.count > 1 ? args[1] : 1)) },

            "length": { args in
                if let s = args.first as? String { return s.count }
                if let a = args.first as? [Any] { return a.count }
                return 0
            },
            "upper": { args in "\(args.first ?? "")".uppercased() },
            "lower": { args in "\(args.first ?? "")".lowercased() },
            "trim": { args in "\(args.first ?? "")".trimmingCharacters(in: .whitespacesAndNewlines) },
            "contains": { args in
                guard args.count >= 2 else { return false }
                return "\(args[0])".contains("\(args[1])")
            },
            "replace": { args in
                guard args.count >= 3 else { return args.first as Any }
                return "\(args[0])".replacingOccurrences(of: "\(args[1])", with: "\(args[2])")
            },
            "split": { args in
                guard args.count >= 2 else { return [args.first as Any] }
                return "\(args[0])".components(separatedBy: "\(args[1])")
            },
            "join": { args in
                guard let arr = args.first as? [Any], args.count >= 2 else { return args.first as Any }
                return arr.map { "\($0)" }.joined(separator: "\(args[1])")
            },

            "int": { args in Int(toDouble(args.first)) },
            "float": { args in toDouble(args.first) },
            "str": { args in "\(args.first ?? "")" },

            "now": { _ in ISO8601DateFormatter().string(from: Date()) },
            "timestamp": { _ in Int(Date().timeIntervalSince1970) },

            "first": { args in (args.first as? [Any])?.first as Any },
            "last": { args in (args.first as? [Any])?.last as Any },
            "count": { args in (args.first as? [Any])?.count ?? 1 },
            "sum": { args in
                guard let arr = args.first as? [Any] else { return toDouble(args.first) }
                return arr.reduce(0.0) { $0 + toDouble($1) }
            },
            "avg": { args in
                guard let arr = args.first as? [Any], !arr.isEmpty else { return 0.0 }
                return arr.reduce(0.0) { $0 + toDouble($1) } / Double(arr.count)
            },

            "coalesce": { args in args.first { $0 != nil && !($0 is NSNull) } as Any },
            "ifNull": { args in
                guard args.count >= 2 else { return args.first as Any }
                if args[0] is NSNull { return args[1] }
                return args[0]
            },
            "isEmpty": { args in
                if let s = args.first as? String { return s.isEmpty }
                if let a = args.first as? [Any] { return a.isEmpty }
                return args.first == nil || args.first is NSNull
            },
        ]

        // Merge user-provided functions
        if let userFuncs = config.functions {
            for (key, fn) in userFuncs {
                funcs[key] = fn
            }
        }

        return funcs
    }

    // MARK: Tokenizer

    private enum ExprToken {
        case number(Double)
        case string(String)
        case boolean(Bool)
        case null
        case identifier(String)
        case op(String)
        case lparen, rparen, comma, question, colon, eof
    }

    private func tokenize(_ expr: String) -> [ExprToken] {
        var tokens: [ExprToken] = []
        let chars = Array(expr)
        var i = 0

        while i < chars.count {
            if chars[i].isWhitespace { i += 1; continue }

            // Number
            if chars[i].isNumber || (chars[i] == "." && i + 1 < chars.count && chars[i + 1].isNumber) {
                var num = ""
                while i < chars.count && (chars[i].isNumber || chars[i] == ".") {
                    num.append(chars[i]); i += 1
                }
                tokens.append(.number(Double(num) ?? 0))
                continue
            }

            // String
            if chars[i] == "\"" || chars[i] == "'" {
                let quote = chars[i]; i += 1
                var str = ""
                while i < chars.count && chars[i] != quote {
                    if chars[i] == "\\" && i + 1 < chars.count {
                        i += 1
                        switch chars[i] {
                        case "n": str.append("\n")
                        case "t": str.append("\t")
                        case "\\": str.append("\\")
                        default: str.append(chars[i])
                        }
                    } else {
                        str.append(chars[i])
                    }
                    i += 1
                }
                i += 1 // closing quote
                tokens.append(.string(str))
                continue
            }

            // Two-char operators
            if i + 1 < chars.count {
                let twoChar = String(chars[i...i+1])
                if ["==", "!=", "<=", ">=", "&&", "||", "??"].contains(twoChar) {
                    tokens.append(.op(twoChar)); i += 2; continue
                }
            }

            // Single-char operators
            if "+-*/%<>=!~".contains(chars[i]) {
                tokens.append(.op(String(chars[i]))); i += 1; continue
            }

            if chars[i] == "(" { tokens.append(.lparen); i += 1; continue }
            if chars[i] == ")" { tokens.append(.rparen); i += 1; continue }
            if chars[i] == "," { tokens.append(.comma); i += 1; continue }
            if chars[i] == "?" { tokens.append(.question); i += 1; continue }
            if chars[i] == ":" { tokens.append(.colon); i += 1; continue }

            // Identifier
            if chars[i].isLetter || chars[i] == "_" {
                var ident = ""
                while i < chars.count && (chars[i].isLetter || chars[i].isNumber || chars[i] == "_" || chars[i] == ".") {
                    ident.append(chars[i]); i += 1
                }
                if ident == "true" { tokens.append(.boolean(true)) }
                else if ident == "false" { tokens.append(.boolean(false)) }
                else if ident == "null" || ident == "nil" { tokens.append(.null) }
                else { tokens.append(.identifier(ident)) }
                continue
            }

            i += 1
        }

        tokens.append(.eof)
        return tokens
    }

    // MARK: Parser

    private class ExprParser {
        private var pos = 0
        private let tokens: [ExprToken]
        private let record: RawRecord
        private let functions: [String: ([Any]) -> Any]

        init(tokens: [ExprToken], record: RawRecord, functions: [String: ([Any]) -> Any]) {
            self.tokens = tokens
            self.record = record
            self.functions = functions
        }

        private func peek() -> ExprToken { return tokens[pos] }
        private func advance() -> ExprToken { let t = tokens[pos]; pos += 1; return t }

        func parseTernary() throws -> Any {
            let condition = try parseOr()
            if case .question = peek() {
                _ = advance()
                let consequent = try parseTernary()
                guard case .colon = advance() else {
                    throw FieldMapperError.invalidExpression(detail: "Expected ':'")
                }
                let alternate = try parseTernary()
                return isTruthy(condition) ? consequent : alternate
            }
            return condition
        }

        private func parseOr() throws -> Any {
            var left = try parseAnd()
            while case .op("||") = peek() {
                _ = advance()
                let right = try parseAnd()
                left = isTruthy(left) || isTruthy(right)
            }
            return left
        }

        private func parseAnd() throws -> Any {
            var left = try parseNullCoalesce()
            while case .op("&&") = peek() {
                _ = advance()
                let right = try parseNullCoalesce()
                left = isTruthy(left) && isTruthy(right)
            }
            return left
        }

        private func parseNullCoalesce() throws -> Any {
            var left = try parseEquality()
            while case .op("??") = peek() {
                _ = advance()
                let right = try parseEquality()
                left = (left is NSNull || isNilValue(left)) ? right : left
            }
            return left
        }

        private func parseEquality() throws -> Any {
            var left = try parseComparison()
            while true {
                if case .op("==") = peek() { _ = advance(); let right = try parseComparison(); left = isEqual(left, right) }
                else if case .op("!=") = peek() { _ = advance(); let right = try parseComparison(); left = !isEqual(left, right) as Any }
                else { break }
            }
            return left
        }

        private func parseComparison() throws -> Any {
            var left = try parseConcat()
            while true {
                if case .op("<") = peek() { _ = advance(); let right = try parseConcat(); left = toDouble(left) < toDouble(right) }
                else if case .op(">") = peek() { _ = advance(); let right = try parseConcat(); left = toDouble(left) > toDouble(right) }
                else if case .op("<=") = peek() { _ = advance(); let right = try parseConcat(); left = toDouble(left) <= toDouble(right) }
                else if case .op(">=") = peek() { _ = advance(); let right = try parseConcat(); left = toDouble(left) >= toDouble(right) }
                else { break }
            }
            return left
        }

        private func parseConcat() throws -> Any {
            var left = try parseAddition()
            while case .op("~") = peek() {
                _ = advance()
                let right = try parseAddition()
                left = "\(left)\(right)"
            }
            return left
        }

        private func parseAddition() throws -> Any {
            var left = try parseMultiplication()
            while true {
                if case .op("+") = peek() {
                    _ = advance()
                    let right = try parseMultiplication()
                    if left is String || right is String {
                        left = "\(left)\(right)"
                    } else {
                        left = toDouble(left) + toDouble(right)
                    }
                } else if case .op("-") = peek() {
                    _ = advance()
                    let right = try parseMultiplication()
                    left = toDouble(left) - toDouble(right)
                } else { break }
            }
            return left
        }

        private func parseMultiplication() throws -> Any {
            var left = try parseUnary()
            while true {
                if case .op("*") = peek() { _ = advance(); let right = try parseUnary(); left = toDouble(left) * toDouble(right) }
                else if case .op("/") = peek() { _ = advance(); let right = try parseUnary(); let d = toDouble(right); left = d != 0 ? toDouble(left) / d : 0.0 }
                else if case .op("%") = peek() { _ = advance(); let right = try parseUnary(); left = toDouble(left).truncatingRemainder(dividingBy: toDouble(right)) }
                else { break }
            }
            return left
        }

        private func parseUnary() throws -> Any {
            if case .op("!") = peek() { _ = advance(); return !isTruthy(try parseUnary()) }
            if case .op("-") = peek() { _ = advance(); return -toDouble(try parseUnary()) }
            return try parsePrimary()
        }

        private func parsePrimary() throws -> Any {
            let token = peek()

            switch token {
            case .number(let n): _ = advance(); return n
            case .string(let s): _ = advance(); return s
            case .boolean(let b): _ = advance(); return b
            case .null: _ = advance(); return NSNull()

            case .lparen:
                _ = advance()
                let result = try parseTernary()
                guard case .rparen = advance() else {
                    throw FieldMapperError.invalidExpression(detail: "Expected ')'")
                }
                return result

            case .identifier(let name):
                _ = advance()
                // Function call
                if case .lparen = peek() {
                    return try parseFunctionCall(name)
                }
                // Field reference
                let keys = parseDotPath(name)
                return getNestedValue(record, keys: keys) as Any
            default:
                throw FieldMapperError.invalidExpression(detail: "Unexpected token")
            }
        }

        private func parseFunctionCall(_ name: String) throws -> Any {
            _ = advance() // consume (
            var args: [Any] = []

            if case .rparen = peek() {
                // no args
            } else {
                args.append(try parseTernary())
                while case .comma = peek() {
                    _ = advance()
                    args.append(try parseTernary())
                }
            }

            guard case .rparen = advance() else {
                throw FieldMapperError.invalidExpression(detail: "Expected ')'")
            }

            guard let fn = functions[name] else {
                throw FieldMapperError.invalidExpression(detail: "Unknown function: \(name)")
            }

            return fn(args)
        }

        private func isTruthy(_ value: Any) -> Bool {
            if let b = value as? Bool { return b }
            if let n = value as? Double { return n != 0 }
            if let n = value as? Int { return n != 0 }
            if let s = value as? String { return !s.isEmpty }
            if value is NSNull { return false }
            return true
        }

        private func isEqual(_ a: Any, _ b: Any) -> Bool {
            if let aStr = a as? String, let bStr = b as? String { return aStr == bStr }
            if let aNum = a as? Double, let bNum = b as? Double { return aNum == bNum }
            if let aBool = a as? Bool, let bBool = b as? Bool { return aBool == bBool }
            return toDouble(a) == toDouble(b)
        }

        private func isNilValue(_ value: Any) -> Bool {
            if value is NSNull { return true }
            let mirror = Mirror(reflecting: value)
            if mirror.displayStyle == .optional && mirror.children.isEmpty { return true }
            return false
        }
    }
}

// MARK: - Helper: toDouble (module-level for reuse)

private func toDouble(_ val: Any?) -> Double {
    if let d = val as? Double { return d }
    if let i = val as? Int { return Double(i) }
    if let s = val as? String { return Double(s) ?? 0 }
    if let b = val as? Bool { return b ? 1 : 0 }
    return 0
}

// MARK: - Provider Registry

/// All field mapper providers indexed by their unique ID.
let fieldMapperProviders: [String: any FieldMapperPlugin] = [
    "direct": DirectMapper(),
    "jsonpath": JsonPathMapper(),
    "xpath": XPathMapper(),
    "regex": RegexMapper(),
    "template": TemplateMapper(),
    "computed": ComputedMapper(),
]

/// Resolve the best provider for a given path syntax.
/// Returns the first provider whose `supports()` returns true, preferring
/// more specific syntaxes (checked in specificity order).
func resolveProvider(for pathSyntax: String) -> (any FieldMapperPlugin)? {
    let orderedIds = ["jsonpath", "xpath", "regex", "template", "computed", "direct"]
    for id in orderedIds {
        if let provider = fieldMapperProviders[id], provider.supports(pathSyntax: pathSyntax) {
            return provider
        }
    }
    return nil
}
