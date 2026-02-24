// Quality Rule Provider: Enum Check Validation
// Validates that field values belong to a set of allowed values.
// Dimension: validity

import Foundation

public final class EnumCheckQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "warning")
        }

        guard let allowedValues = config.options?["values"] as? [Any], !allowedValues.isEmpty else {
            return RuleResult(
                valid: false,
                message: "Enum check for field '\(field.name)' is misconfigured: no allowed values provided.",
                severity: "warning"
            )
        }

        let caseSensitive = config.options?["caseSensitive"] as? Bool ?? true
        let stringValue = String(describing: value)

        var isAllowed: Bool
        if caseSensitive {
            isAllowed = allowedValues.contains { allowed in
                String(describing: allowed) == stringValue
            }
        } else {
            let lowerValue = stringValue.lowercased()
            isAllowed = allowedValues.contains { allowed in
                String(describing: allowed).lowercased() == lowerValue
            }
        }

        if !isAllowed {
            let allowedList = allowedValues.map { String(describing: $0) }.joined(separator: ", ")
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(stringValue)' is not in the allowed set [\(allowedList)].",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return true
    }

    public func dimension() -> QualityDimension {
        return .validity
    }
}
