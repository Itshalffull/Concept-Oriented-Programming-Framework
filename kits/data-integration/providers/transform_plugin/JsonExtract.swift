// Transform Plugin Provider: json_extract
// Extract values from JSON strings at a specified path.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class JsonExtractTransformProvider {
    public static let providerId = "json_extract"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        let path = (config.options["path"] as? String) ?? "$"
        let defaultValue = config.options["default"]
        let hasDefault = config.options.keys.contains("default")

        let parsed: Any

        if let str = value as? String {
            guard let data = str.data(using: .utf8),
                  let jsonObj = try? JSONSerialization.jsonObject(with: data) else {
                throw TransformError.invalidCast("Invalid JSON input")
            }
            parsed = jsonObj
        } else {
            parsed = value
        }

        if let result = navigatePath(root: parsed, path: path) {
            return result
        }

        if hasDefault {
            return defaultValue ?? NSNull()
        }

        return NSNull()
    }

    private func navigatePath(root: Any, path: String) -> Any? {
        if path == "$" || path.isEmpty {
            return root
        }

        var normalized = path
        if normalized.hasPrefix("$.") {
            normalized = String(normalized.dropFirst(2))
        } else if normalized.hasPrefix("$") {
            normalized = String(normalized.dropFirst(1))
        }

        let segments = tokenizePath(normalized)
        var current: Any = root

        for segment in segments {
            // Array index access [N]
            if segment.hasPrefix("[") && segment.hasSuffix("]") {
                let indexStr = String(segment.dropFirst().dropLast())
                if indexStr == "*" {
                    // Wildcard: return all elements
                    if let arr = current as? [Any] { return arr }
                    if let dict = current as? [String: Any] { return Array(dict.values) }
                    return nil
                }
                guard let index = Int(indexStr), let arr = current as? [Any],
                      index >= 0, index < arr.count else {
                    return nil
                }
                current = arr[index]
            } else if segment == "*" {
                if let arr = current as? [Any] { return arr }
                if let dict = current as? [String: Any] { return Array(dict.values) }
                return nil
            } else {
                // Property access
                guard let dict = current as? [String: Any], let val = dict[segment] else {
                    return nil
                }
                current = val
            }
        }

        return current
    }

    private func tokenizePath(_ path: String) -> [String] {
        var segments: [String] = []
        var current = ""
        var i = path.startIndex

        while i < path.endIndex {
            let ch = path[i]

            if ch == "." {
                if !current.isEmpty {
                    segments.append(current)
                    current = ""
                }
                i = path.index(after: i)
            } else if ch == "[" {
                if !current.isEmpty {
                    segments.append(current)
                    current = ""
                }
                // Find closing bracket
                guard let closeIdx = path[i...].firstIndex(of: "]") else {
                    current.append(ch)
                    i = path.index(after: i)
                    continue
                }
                let bracketContent = String(path[i...closeIdx])
                // Check for string keys: ['key'] or ["key"]
                let inner = String(bracketContent.dropFirst().dropLast())
                if (inner.hasPrefix("'") && inner.hasSuffix("'"))
                    || (inner.hasPrefix("\"") && inner.hasSuffix("\"")) {
                    segments.append(String(inner.dropFirst().dropLast()))
                } else {
                    segments.append(bracketContent)
                }
                i = path.index(after: closeIdx)
            } else {
                current.append(ch)
                i = path.index(after: i)
            }
        }

        if !current.isEmpty {
            segments.append(current)
        }

        return segments
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }
}
