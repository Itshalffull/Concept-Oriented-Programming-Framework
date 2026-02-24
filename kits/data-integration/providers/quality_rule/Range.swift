// Quality Rule Provider: Range Validation
// Checks numeric or date values fall within min/max bounds.
// Dimension: validity

import Foundation

public final class RangeQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "warning")
        }

        let min = config.options?["min"]
        let max = config.options?["max"]
        let exclusiveMin = config.options?["exclusiveMin"] as? Bool ?? false
        let exclusiveMax = config.options?["exclusiveMax"] as? Bool ?? false
        let isDateField = field.type_.lowercased() == "date" || field.type_.lowercased() == "datetime"

        if isDateField {
            return validateDateRange(value: value, field: field, min: min, max: max,
                                     exclusiveMin: exclusiveMin, exclusiveMax: exclusiveMax)
        }
        return validateNumericRange(value: value, field: field, min: min, max: max,
                                    exclusiveMin: exclusiveMin, exclusiveMax: exclusiveMax)
    }

    private func validateNumericRange(value: Any, field: FieldDef, min: Any?, max: Any?,
                                      exclusiveMin: Bool, exclusiveMax: Bool) -> RuleResult {
        guard let num = toDouble(value) else {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value cannot be parsed as a number for range check.",
                severity: "error"
            )
        }

        if let minVal = min.flatMap({ toDouble($0) }) {
            let below = exclusiveMin ? num <= minVal : num < minVal
            if below {
                let bound = exclusiveMin ? "exclusive" : "inclusive"
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value \(num) is below the minimum (\(bound)) of \(minVal).",
                    severity: "error"
                )
            }
        }

        if let maxVal = max.flatMap({ toDouble($0) }) {
            let above = exclusiveMax ? num >= maxVal : num > maxVal
            if above {
                let bound = exclusiveMax ? "exclusive" : "inclusive"
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value \(num) is above the maximum (\(bound)) of \(maxVal).",
                    severity: "error"
                )
            }
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    private func validateDateRange(value: Any, field: FieldDef, min: Any?, max: Any?,
                                   exclusiveMin: Bool, exclusiveMax: Bool) -> RuleResult {
        guard let timestamp = parseDate(value) else {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value cannot be parsed as a date for range check.",
                severity: "error"
            )
        }

        if let minRaw = min, let minDate = parseDate(minRaw) {
            let below = exclusiveMin ? timestamp <= minDate : timestamp < minDate
            if below {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' date is before the minimum allowed date.",
                    severity: "error"
                )
            }
        }

        if let maxRaw = max, let maxDate = parseDate(maxRaw) {
            let above = exclusiveMax ? timestamp >= maxDate : timestamp > maxDate
            if above {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' date is after the maximum allowed date.",
                    severity: "error"
                )
            }
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    private func toDouble(_ value: Any) -> Double? {
        if let n = value as? Int { return Double(n) }
        if let n = value as? Double { return n }
        if let s = value as? String { return Double(s) }
        return nil
    }

    private func parseDate(_ value: Any) -> Date? {
        if let d = value as? Date { return d }
        if let s = value as? String {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = formatter.date(from: s) { return d }
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            return simpleFormatter.date(from: s)
        }
        return nil
    }

    public func appliesTo(field: FieldDef) -> Bool {
        let numericTypes = ["number", "integer", "float", "date", "datetime"]
        return numericTypes.contains(field.type_.lowercased())
    }

    public func dimension() -> QualityDimension {
        return .validity
    }
}
