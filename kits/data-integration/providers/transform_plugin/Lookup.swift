// Transform Plugin Provider: lookup
// Map values via a configurable lookup table with case-insensitive matching.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class LookupTransformProvider {
    public static let providerId = "lookup"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        guard let table = config.options["table"] as? [String: Any] else {
            throw TransformError.invalidCast("Lookup table is required in config.options.table")
        }

        let caseInsensitive = (config.options["caseInsensitive"] as? Bool) ?? true
        let defaultValue = config.options["default"]
        let hasDefault = config.options.keys.contains("default")

        if value is NSNull {
            return hasDefault ? (defaultValue ?? NSNull()) : NSNull()
        }

        let key = String(describing: value)

        // Direct match
        if let result = table[key] {
            return result
        }

        // Case-insensitive match
        if caseInsensitive {
            let lowerKey = key.lowercased()
            for (k, v) in table {
                if k.lowercased() == lowerKey {
                    return v
                }
            }
        }

        // No match found
        if hasDefault {
            return defaultValue ?? NSNull()
        }

        return value
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }
}
