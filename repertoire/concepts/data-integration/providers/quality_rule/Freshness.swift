// Quality Rule Provider: Freshness Validation
// Ensures data timestamps are within an acceptable recency window.
// Dimension: timeliness

import Foundation

public final class FreshnessQualityProvider {
    public init() {}

    public func validate(value: Any?, field: FieldDef, record: [String: Any], config: RuleConfig) -> RuleResult {
        let timestampField = config.options?["timestampField"] as? String ?? field.name
        let rawTimestamp: Any?

        if timestampField == field.name {
            rawTimestamp = value
        } else {
            rawTimestamp = record[timestampField]
        }

        guard let rawTs = rawTimestamp, !(rawTs is NSNull) else {
            return RuleResult(
                valid: false,
                message: "Freshness check for '\(field.name)': timestamp field '\(timestampField)' is missing.",
                severity: "warning"
            )
        }

        guard let timestamp = parseTimestamp(rawTs) else {
            return RuleResult(
                valid: false,
                message: "Freshness check for '\(field.name)': cannot parse timestamp value.",
                severity: "error"
            )
        }

        guard let maxAgeMs = parseMaxAge(config.options?["maxAge"]) else {
            return RuleResult(
                valid: false,
                message: "Freshness rule for '\(field.name)' is misconfigured: invalid or missing maxAge.",
                severity: "warning"
            )
        }

        let now = Date()
        let ageMs = now.timeIntervalSince(timestamp) * 1000.0

        if ageMs > maxAgeMs {
            let ageHours = round(ageMs / 3_600_000.0 * 10) / 10
            let maxAgeHours = round(maxAgeMs / 3_600_000.0 * 10) / 10
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' data is stale: age is \(ageHours)h, maximum allowed is \(maxAgeHours)h.",
                severity: "error"
            )
        }

        return RuleResult(valid: true, message: nil, severity: "info")
    }

    private func parseTimestamp(_ value: Any) -> Date? {
        if let date = value as? Date {
            return date
        }
        if let n = value as? Double {
            // Assume seconds if small, milliseconds if large
            let interval = n > 1_000_000_000_000 ? n / 1000.0 : n
            return Date(timeIntervalSince1970: interval)
        }
        if let n = value as? Int {
            let interval = n > 1_000_000_000_000 ? Double(n) / 1000.0 : Double(n)
            return Date(timeIntervalSince1970: interval)
        }
        if let s = value as? String {
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFormatter.date(from: s) { return date }
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            if let date = simpleFormatter.date(from: s) { return date }
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            return simpleFormatter.date(from: s)
        }
        return nil
    }

    private func parseMaxAge(_ maxAge: Any?) -> Double? {
        guard let maxAge = maxAge else { return nil }

        if let n = maxAge as? Int {
            return Double(n) * 1000.0
        }
        if let n = maxAge as? Double {
            return n * 1000.0
        }
        if let s = maxAge as? String {
            return parseDurationString(s)
        }
        return nil
    }

    private func parseDurationString(_ s: String) -> Double? {
        let trimmed = s.trimmingCharacters(in: .whitespaces)

        // Split into numeric and unit parts
        var numStr = ""
        var unitStr = ""
        var foundAlpha = false
        for c in trimmed {
            if c.isLetter {
                foundAlpha = true
                unitStr.append(c)
            } else if !foundAlpha {
                numStr.append(c)
            }
        }

        guard let amount = Double(numStr.trimmingCharacters(in: .whitespaces)) else { return nil }
        let unit = unitStr.trimmingCharacters(in: .whitespaces).lowercased()

        if unit.hasPrefix("s") { return amount * 1000.0 }
        if unit.hasPrefix("mi") || unit == "m" { return amount * 60_000.0 }
        if unit.hasPrefix("h") { return amount * 3_600_000.0 }
        if unit.hasPrefix("d") { return amount * 86_400_000.0 }

        return nil
    }

    public func appliesTo(field: FieldDef) -> Bool {
        let dateTypes = ["date", "datetime", "timestamp"]
        return dateTypes.contains(field.type_.lowercased())
    }

    public func dimension() -> QualityDimension {
        return .timeliness
    }
}
