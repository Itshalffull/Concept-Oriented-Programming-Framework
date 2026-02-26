// Transform Plugin Provider: concat
// Merge multiple values into a single string with configurable separator.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class ConcatTransformProvider {
    public static let providerId = "concat"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        let separator = (config.options["separator"] as? String) ?? " "
        let skipNulls = (config.options["skipNulls"] as? Bool) ?? true
        let nullPlaceholder = (config.options["nullPlaceholder"] as? String) ?? ""
        let prefix = (config.options["prefix"] as? String) ?? ""
        let suffix = (config.options["suffix"] as? String) ?? ""

        var values: [Any]

        if let arr = value as? [Any] {
            values = arr
        } else if !(value is NSNull) {
            if let additional = config.options["values"] as? [Any] {
                values = [value] + additional
            } else {
                return "\(prefix)\(value)\(suffix)"
            }
        } else {
            if let additional = config.options["values"] as? [Any] {
                values = additional
            } else {
                return skipNulls ? NSNull() : nullPlaceholder
            }
        }

        var parts: [String] = []

        for v in values {
            if v is NSNull {
                if !skipNulls {
                    parts.append(nullPlaceholder)
                }
            } else if let str = v as? String, str.trimmingCharacters(in: .whitespaces).isEmpty && skipNulls {
                continue
            } else {
                parts.append(String(describing: v))
            }
        }

        if parts.isEmpty {
            return NSNull()
        }

        let joined = parts.joined(separator: separator).trimmingCharacters(in: .whitespaces)
        return "\(prefix)\(joined)\(suffix)"
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "array", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
