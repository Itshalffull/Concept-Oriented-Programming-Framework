// Transform Plugin Provider: default_value
// Provide fallback values when input is null, undefined, or empty.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class DefaultValueTransformProvider {
    public static let providerId = "default_value"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        let defaultVal = config.options["defaultValue"] ?? NSNull()
        let treatEmptyAsNull = (config.options["treatEmptyAsNull"] as? Bool) ?? true

        if value is NSNull {
            return defaultVal
        }

        if treatEmptyAsNull {
            if let str = value as? String, str.trimmingCharacters(in: .whitespaces).isEmpty {
                return defaultVal
            }

            if let arr = value as? [Any], arr.isEmpty {
                return defaultVal
            }

            if let dict = value as? [String: Any], dict.isEmpty {
                return defaultVal
            }
        }

        // Check for NaN
        if let num = value as? Double, num.isNaN {
            if let typeDefaults = config.options["typeDefaults"] as? [String: Any],
               let numDefault = typeDefaults["number"] {
                return numDefault
            }
            return defaultVal
        }

        return value
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: false)
    }
}
