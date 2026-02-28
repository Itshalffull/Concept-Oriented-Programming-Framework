// Quality Rule Provider: Foreign Key Validation
// Ensures referenced entities exist in the target content type's storage.
// Dimension: consistency

import Foundation

public final class ForeignKeyQualityProvider {
    private var referenceStore: [String: Set<String>] = [:]

    public init() {}

    /// Register known reference values for a given target type and field.
    public func registerReferences(targetType: String, targetField: String, values: [String]) {
        let key = "\(targetType)::\(targetField)"
        if referenceStore[key] == nil {
            referenceStore[key] = []
        }
        for v in values {
            referenceStore[key]!.insert(v)
        }
    }

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "error")
        }

        guard let targetType = config.options?["targetType"] as? String,
              let targetField = config.options?["targetField"] as? String else {
            return RuleResult(
                valid: false,
                message: "Foreign key rule for field '\(field.name)' is misconfigured: targetType and targetField are required.",
                severity: "error"
            )
        }

        let storeKey = "\(targetType)::\(targetField)"
        guard let store = referenceStore[storeKey] else {
            return RuleResult(
                valid: false,
                message: "Foreign key rule for field '\(field.name)': no reference data loaded for \(targetType).\(targetField).",
                severity: "error"
            )
        }

        let refValue = String(describing: value)
        if !store.contains(refValue) {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' references '\(refValue)' which does not exist in \(targetType).\(targetField). Dangling reference detected.",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    public func appliesTo(field: FieldDef) -> Bool {
        let refTypes = ["reference", "foreign_key", "fk", "relation"]
        if refTypes.contains(field.type_.lowercased()) { return true }
        return field.constraints?["foreignKey"] != nil
    }

    public func dimension() -> QualityDimension {
        return .consistency
    }
}
