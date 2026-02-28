// Quality Rule Provider: Required Field Validation
// Ensures fields marked as required contain non-empty values.
// Dimension: completeness

import Foundation

public struct FieldDef {
    public let name: String
    public let type_: String
    public let required: Bool?
    public let constraints: [String: Any]?
}

public struct RuleConfig {
    public let options: [String: Any]?
    public let threshold: Double?
}

public struct RuleResult {
    public let valid: Bool
    public let message: String?
    public let severity: String  // "error" | "warning" | "info"
}

public enum QualityDimension: String {
    case completeness, uniqueness, validity, consistency, timeliness, accuracy
}

public final class RequiredQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        let treatWhitespaceAsEmpty = config.options?["treatWhitespaceAsEmpty"] as? Bool ?? false

        if value == nil || value is NSNull {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' is required but has no value.",
                severity: "error"
            )
        }

        if let stringValue = value as? String {
            let testValue = treatWhitespaceAsEmpty ? stringValue.trimmingCharacters(in: .whitespaces) : stringValue
            if testValue.isEmpty {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' is required but is empty.",
                    severity: "error"
                )
            }
        }

        if let arrayValue = value as? [Any], arrayValue.isEmpty {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' is required but is an empty array.",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return field.required == true
    }

    public func dimension() -> QualityDimension {
        return .completeness
    }
}
