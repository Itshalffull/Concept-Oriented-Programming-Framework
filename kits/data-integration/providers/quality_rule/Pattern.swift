// Quality Rule Provider: Pattern (Regex) Validation
// Validates that string values match a configured regular expression.
// Dimension: validity

import Foundation

public final class PatternQualityProvider {
    private var regexCache: [String: NSRegularExpression] = [:]

    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true, message: nil, severity: "warning")
        }

        guard let patternStr = config.options?["pattern"] as? String else {
            return RuleResult(
                valid: false,
                message: "Pattern rule for field '\(field.name)' is misconfigured: no pattern provided.",
                severity: "warning"
            )
        }

        let flags = config.options?["flags"] as? String ?? ""
        let stringValue = String(describing: value)

        var regexOptions: NSRegularExpression.Options = []
        if flags.contains("i") {
            regexOptions.insert(.caseInsensitive)
        }
        if flags.contains("m") {
            regexOptions.insert(.anchorsMatchLines)
        }
        if flags.contains("s") {
            regexOptions.insert(.dotMatchesLineSeparators)
        }

        let cacheKey = "\(patternStr)::\(flags)"
        let regex: NSRegularExpression

        if let cached = regexCache[cacheKey] {
            regex = cached
        } else {
            do {
                regex = try NSRegularExpression(pattern: patternStr, options: regexOptions)
                regexCache[cacheKey] = regex
            } catch {
                return RuleResult(
                    valid: false,
                    message: "Pattern rule for field '\(field.name)' has an invalid regex: \(error.localizedDescription)",
                    severity: "error"
                )
            }
        }

        let range = NSRange(stringValue.startIndex..., in: stringValue)
        let matchCount = regex.numberOfMatches(in: stringValue, options: [], range: range)

        if matchCount == 0 {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(stringValue)' does not match pattern '\(patternStr)'.",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "error")
    }

    public func appliesTo(field: FieldDef) -> Bool {
        return field.type_.lowercased() == "string"
    }

    public func dimension() -> QualityDimension {
        return .validity
    }
}
