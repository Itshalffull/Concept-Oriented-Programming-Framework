// Transform Plugin Provider: type_cast
// Cast values between types (string, number, boolean, timestamp).
// See Architecture doc for transform plugin interface contract.

import Foundation

public struct TransformConfig {
    public var options: [String: Any]
    public init(options: [String: Any] = [:]) {
        self.options = options
    }
}

public struct TypeSpec {
    public let type: String
    public let nullable: Bool
    public init(type: String, nullable: Bool = false) {
        self.type = type
        self.nullable = nullable
    }
}

public enum TransformError: Error {
    case invalidCast(String)
    case unsupportedType(String)
}

public final class TypeCastTransformProvider {
    public static let providerId = "type_cast"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull {
            return NSNull()
        }

        let targetType = (config.options["targetType"] as? String) ?? "string"

        switch targetType {
        case "string":
            return String(describing: value)

        case "number", "float":
            if let num = value as? Double { return num }
            if let num = value as? Int { return Double(num) }
            let str = String(describing: value).trimmingCharacters(in: .whitespaces)
            guard !str.isEmpty, let parsed = Double(str) else {
                throw TransformError.invalidCast("Cannot cast \"\(str)\" to number")
            }
            return parsed

        case "integer":
            if let num = value as? Int { return num }
            if let num = value as? Double { return Int(num) }
            let str = String(describing: value).trimmingCharacters(in: .whitespaces)
            guard !str.isEmpty, let parsed = Int(str) else {
                throw TransformError.invalidCast("Cannot cast \"\(str)\" to integer")
            }
            return parsed

        case "boolean":
            if let b = value as? Bool { return b }
            let str = String(describing: value).trimmingCharacters(in: .whitespaces).lowercased()
            switch str {
            case "true", "1", "yes", "on": return true
            case "false", "0", "no", "off": return false
            default:
                throw TransformError.invalidCast("Cannot cast \"\(value)\" to boolean")
            }

        case "timestamp":
            if let num = value as? Double { return num }
            if let num = value as? Int { return Double(num) }
            let str = String(describing: value).trimmingCharacters(in: .whitespaces)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: str) {
                return date.timeIntervalSince1970 * 1000
            }
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: str) {
                return date.timeIntervalSince1970 * 1000
            }
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            if let date = dateFormatter.date(from: str) {
                return date.timeIntervalSince1970 * 1000
            }
            throw TransformError.invalidCast("Cannot cast \"\(str)\" to timestamp")

        default:
            throw TransformError.unsupportedType("Unsupported target type: \(targetType)")
        }
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }
}
