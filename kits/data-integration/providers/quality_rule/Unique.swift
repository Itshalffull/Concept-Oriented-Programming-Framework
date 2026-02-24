// Quality Rule Provider: Unique Value Validation
// Ensures field values are unique across records of the same type.
// Dimension: uniqueness

import Foundation

public final class UniqueQualityProvider {
    private var globalIndex: Set<String> = []
    private var scopedIndex: [String: Set<String>] = [:]

    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "error")
        }

        let caseSensitive = config.options?["caseSensitive"] as? Bool ?? true
        let scope = config.options?["scope"] as? String ?? "global"

        var normalizedValue = String(describing: value)
        if !caseSensitive {
            normalizedValue = normalizedValue.lowercased()
        }

        let key = "\(field.name)::\(normalizedValue)"

        if scope == "per-type" {
            let recordType = record["_type"] as? String ?? "__default__"
            if scopedIndex[recordType] == nil {
                scopedIndex[recordType] = []
            }

            if scopedIndex[recordType]!.contains(key) {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value is not unique within type '\(recordType)'.",
                    severity: "error"
                )
            }
            scopedIndex[recordType]!.insert(key)
        } else {
            if globalIndex.contains(key) {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value is not unique.",
                    severity: "error"
                )
            }
            globalIndex.insert(key)
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return field.constraints?["unique"] as? Bool ?? false
    }

    public func dimension() -> QualityDimension {
        return .uniqueness
    }

    public func reset() {
        globalIndex.removeAll()
        scopedIndex.removeAll()
    }
}
