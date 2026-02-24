// Template field mapper — string interpolation with field references
// Supports {field_name} placeholders, {field|default} fallback syntax,
// and nested field references like {author.name}

import Foundation

private enum TemplateToken {
    case literal(String)
    case placeholder(fieldPath: String, defaultValue: String?)
}

private func tokenize(_ template: String) -> [TemplateToken] {
    var tokens: [TemplateToken] = []
    let chars = Array(template)
    var i = 0
    var literalStart = 0

    while i < chars.count {
        // Escaped brace
        if chars[i] == "\\" && i + 1 < chars.count && (chars[i + 1] == "{" || chars[i + 1] == "}") {
            if i > literalStart {
                tokens.append(.literal(String(chars[literalStart..<i])))
            }
            tokens.append(.literal(String(chars[i + 1])))
            i += 2
            literalStart = i
            continue
        }

        if chars[i] == "{" {
            if i > literalStart {
                tokens.append(.literal(String(chars[literalStart..<i])))
            }

            guard let closeIdx = chars[(i + 1)...].firstIndex(of: "}") else {
                // Unclosed brace - treat rest as literal
                tokens.append(.literal(String(chars[i...])))
                return tokens
            }

            let inner = String(chars[(i + 1)..<closeIdx]).trimmingCharacters(in: .whitespaces)

            if let pipeIdx = inner.firstIndex(of: "|") {
                let fieldPath = inner[inner.startIndex..<pipeIdx].trimmingCharacters(in: .whitespaces)
                let defaultVal = inner[inner.index(after: pipeIdx)...].trimmingCharacters(in: .whitespaces)
                tokens.append(.placeholder(fieldPath: fieldPath, defaultValue: defaultVal))
            } else {
                tokens.append(.placeholder(fieldPath: inner, defaultValue: nil))
            }

            i = closeIdx + 1
            literalStart = i
        } else {
            i += 1
        }
    }

    if literalStart < chars.count {
        tokens.append(.literal(String(chars[literalStart...])))
    }

    return tokens
}

private func resolveFieldValue(record: [String: Any], fieldPath: String) -> Any? {
    let parts = fieldPath.split(separator: ".").map(String.init)
    var current: Any = record

    for part in parts {
        // Handle bracket notation
        if let bracketStart = part.firstIndex(of: "["),
           let bracketEnd = part.firstIndex(of: "]") {
            let key = String(part[part.startIndex..<bracketStart])
            let idxStr = String(part[part.index(after: bracketStart)..<bracketEnd])
            guard let idx = Int(idxStr) else { return nil }

            if !key.isEmpty {
                guard let dict = current as? [String: Any], let next = dict[key] else { return nil }
                current = next
            }
            guard let arr = current as? [Any], idx >= 0, idx < arr.count else { return nil }
            current = arr[idx]
        } else {
            guard let dict = current as? [String: Any], let next = dict[part] else { return nil }
            current = next
        }
    }

    return current
}

private func formatValue(_ value: Any) -> String {
    if value is NSNull { return "" }
    if let s = value as? String { return s }
    if let n = value as? Int { return String(n) }
    if let n = value as? Double { return String(n) }
    if let b = value as? Bool { return String(b) }
    if let arr = value as? [Any] { return arr.map { formatValue($0) }.joined(separator: ", ") }
    return String(describing: value)
}

public final class TemplateMapperProvider {
    public static let providerID = "template"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let tokens = tokenize(sourcePath)
        var parts: [String] = []

        for token in tokens {
            switch token {
            case .literal(let value):
                parts.append(value)
            case .placeholder(let fieldPath, let defaultValue):
                if let resolved = resolveFieldValue(record: record, fieldPath: fieldPath),
                   !(resolved is NSNull) {
                    parts.append(formatValue(resolved))
                } else if let def = defaultValue {
                    parts.append(def)
                } else {
                    parts.append("")
                }
            }
        }

        return parts.joined()
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "template" || pathSyntax == "string_template" || pathSyntax == "interpolation"
    }
}
