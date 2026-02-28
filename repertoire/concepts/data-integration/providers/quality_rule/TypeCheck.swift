// Quality Rule Provider: Type Check Validation
// Validates that field values match their declared type.
// Dimension: validity

import Foundation

public final class TypeCheckQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "error")
        }

        let strict = config.options?["strict"] as? Bool ?? false
        let declaredType = field.type_.lowercased()

        if !checkType(value: value, declaredType: declaredType, strict: strict) {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' expected type '\(declaredType)' but received incompatible value.",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    private func checkType(value: Any, declaredType: String, strict: Bool) -> Bool {
        switch declaredType {
        case "string":
            if value is String { return true }
            if !strict { return value is Int || value is Double || value is Bool }
            return false

        case "number", "float":
            if value is Int || value is Double { return true }
            if !strict, let s = value as? String, Double(s) != nil { return true }
            return false

        case "integer":
            if value is Int { return true }
            if let d = value as? Double {
                if strict { return false }
                return d.truncatingRemainder(dividingBy: 1) == 0
            }
            if !strict, let s = value as? String, Int(s) != nil { return true }
            return false

        case "boolean":
            if value is Bool { return true }
            if !strict, let s = value as? String {
                return s == "true" || s == "false"
            }
            return false

        case "date", "datetime":
            if value is Date { return true }
            if let s = value as? String {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if formatter.date(from: s) != nil { return true }
                // Try simpler date format
                let simpleFormatter = DateFormatter()
                simpleFormatter.dateFormat = "yyyy-MM-dd"
                if simpleFormatter.date(from: s) != nil { return true }
            }
            return false

        case "array":
            return value is [Any]

        case "object":
            return value is [String: Any]

        default:
            return true
        }
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return true
    }

    public func dimension() -> QualityDimension {
        return .validity
    }
}
