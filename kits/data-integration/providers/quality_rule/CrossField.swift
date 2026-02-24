// Quality Rule Provider: Cross-Field Validation
// Evaluates multi-field validation expressions across record fields.
// Dimension: consistency

import Foundation

public final class CrossFieldQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let expression = config.options?["expression"] as? String else {
            return RuleResult(
                valid: false,
                message: "Cross-field rule for '\(field.name)' is misconfigured: no expression provided.",
                severity: "error"
            )
        }

        guard let fields = config.options?["fields"] as? [String], !fields.isEmpty else {
            return RuleResult(
                valid: false,
                message: "Cross-field rule for '\(field.name)' is misconfigured: no fields specified.",
                severity: "error"
            )
        }

        let result = evaluateExpression(expression: expression, fields: fields, record: record)

        switch result {
        case .success(let valid):
            if valid {
                return RuleResult(valid: true, message: nil, severity: "error")
            }
            return RuleResult(
                valid: false,
                message: "Cross-field validation failed for '\(field.name)': expression '\(expression)' evaluated to false.",
                severity: "error"
            )
        case .failure(let error):
            return RuleResult(
                valid: false,
                message: "Cross-field rule evaluation error for '\(field.name)': \(error.localizedDescription)",
                severity: "error"
            )
        }
    }

    private func evaluateExpression(expression: String, fields: [String], record: [String: Any]) -> Result<Bool, Error> {
        // Handle comparison expressions: field_a > field_b
        let operators = [">=", "<=", "!=", "==", ">", "<"]
        for op in operators {
            if expression.hasPrefix("if ") { continue }
            if let range = expression.range(of: op) {
                let leftField = String(expression[expression.startIndex..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
                let rightField = String(expression[range.upperBound...]).trimmingCharacters(in: .whitespaces)

                guard let leftVal = resolveNumeric(record[leftField]),
                      let rightVal = resolveNumeric(record[rightField]) else {
                    return .success(true) // Skip null fields
                }

                let result: Bool
                switch op {
                case ">": result = leftVal > rightVal
                case ">=": result = leftVal >= rightVal
                case "<": result = leftVal < rightVal
                case "<=": result = leftVal <= rightVal
                case "==": result = abs(leftVal - rightVal) < Double.ulpOfOne
                case "!=": result = abs(leftVal - rightVal) >= Double.ulpOfOne
                default: result = false
                }
                return .success(result)
            }
        }

        // Handle: if field_a == "value" then field_b required
        if expression.hasPrefix("if ") && expression.contains(" then ") {
            let parts = expression.components(separatedBy: " then ")
            if parts.count == 2 {
                let condition = String(parts[0].dropFirst(3)).trimmingCharacters(in: .whitespaces)
                let action = parts[1].trimmingCharacters(in: .whitespaces)

                if let eqRange = condition.range(of: "==") {
                    let condField = String(condition[condition.startIndex..<eqRange.lowerBound]).trimmingCharacters(in: .whitespaces)
                    var condValue = String(condition[eqRange.upperBound...]).trimmingCharacters(in: .whitespaces)
                    condValue = condValue.trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))

                    let fieldVal = record[condField].flatMap { val -> String? in
                        if let s = val as? String { return s }
                        return String(describing: val)
                    } ?? ""

                    if fieldVal == condValue {
                        if action.hasSuffix(" required") {
                            let reqField = String(action.dropLast(9)).trimmingCharacters(in: .whitespaces)
                            let reqVal = record[reqField]
                            if reqVal == nil || reqVal is NSNull {
                                return .success(false)
                            }
                            if let s = reqVal as? String, s.isEmpty {
                                return .success(false)
                            }
                            return .success(true)
                        }
                    } else {
                        return .success(true) // Condition not met, passes
                    }
                }
            }
        }

        // Handle exactly_one_of(...)
        if expression.hasPrefix("exactly_one_of("), expression.hasSuffix(")") {
            let inner = String(expression.dropFirst(15).dropLast(1))
            let checkFields = inner.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            let count = checkFields.filter { f in
                guard let v = record[f] else { return false }
                if v is NSNull { return false }
                if let s = v as? String { return !s.isEmpty }
                return true
            }.count
            return .success(count == 1)
        }

        // Handle at_least_one_of(...)
        if expression.hasPrefix("at_least_one_of("), expression.hasSuffix(")") {
            let inner = String(expression.dropFirst(16).dropLast(1))
            let checkFields = inner.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            let hasAny = checkFields.contains { f in
                guard let v = record[f] else { return false }
                if v is NSNull { return false }
                if let s = v as? String { return !s.isEmpty }
                return true
            }
            return .success(hasAny)
        }

        return .failure(NSError(domain: "CrossField", code: 1,
                                userInfo: [NSLocalizedDescriptionKey: "Unsupported expression format: \(expression)"]))
    }

    private func resolveNumeric(_ value: Any?) -> Double? {
        guard let value = value else { return nil }
        if let n = value as? Int { return Double(n) }
        if let n = value as? Double { return n }
        if let s = value as? String {
            if let n = Double(s) { return n }
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: s) {
                return date.timeIntervalSince1970
            }
        }
        return nil
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return true
    }

    public func dimension() -> QualityDimension {
        return .consistency
    }
}
