// Quality Rule Plugin — data quality validation and enforcement for the Data Integration Kit.
// Provides pluggable quality rules across six dimensions: completeness, uniqueness,
// validity, consistency, timeliness, and accuracy.
// See Data Integration Kit quality.concept for the parent Quality concept definition.

import Foundation

// MARK: - Core Types

/// The six standard data quality dimensions.
enum QualityDimension: String, Codable, CaseIterable {
    case completeness
    case uniqueness
    case validity
    case consistency
    case timeliness
    case accuracy
}

/// Severity level for rule violations.
enum Severity: String, Codable, Comparable {
    case error
    case warning
    case info

    static func < (lhs: Severity, rhs: Severity) -> Bool {
        let order: [Severity] = [.info, .warning, .error]
        return (order.firstIndex(of: lhs) ?? 0) < (order.firstIndex(of: rhs) ?? 0)
    }
}

/// Describes a field's schema within a record.
struct FieldDef {
    let name: String
    let type: FieldType
    var required: Bool = false
    var nullable: Bool = false
    var parentEntity: String?
    var metadata: [String: Any]?

    enum FieldType: String, Codable {
        case string
        case number
        case boolean
        case date
        case array
        case object
    }
}

/// Provider-specific configuration for a quality rule.
struct RuleConfig {
    var enabled: Bool = true
    var severity: Severity?
    var messageTemplate: String?
    var options: [String: Any] = [:]
}

/// Result of a single rule validation.
struct RuleResult {
    let valid: Bool
    var message: String?
    var severity: Severity?
    var diagnostics: [String: Any]?
}

/// A record is a dictionary of field names to values.
typealias DataRecord = [String: Any]

// MARK: - Protocol

/// Interface every quality-rule provider must implement.
protocol QualityRulePlugin {
    var id: String { get }
    var displayName: String { get }
    var defaultSeverity: Severity { get }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult
    func appliesTo(field: FieldDef) -> Bool
    func dimension() -> QualityDimension
}

// MARK: - Errors

enum QualityRuleError: Error, LocalizedError {
    case invalidConfiguration(rule: String, detail: String)
    case storageUnavailable(detail: String)
    case knowledgeBaseUnavailable(detail: String)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration(let rule, let detail): return "Rule '\(rule)' configuration error: \(detail)"
        case .storageUnavailable(let detail): return "Storage adapter unavailable: \(detail)"
        case .knowledgeBaseUnavailable(let detail): return "Knowledge base unavailable: \(detail)"
        }
    }
}

// MARK: - Helpers

private func isNullOrEmpty(_ value: Any?) -> Bool {
    guard let value = value else { return true }
    if let str = value as? String { return str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    if let arr = value as? [Any] { return arr.isEmpty }
    if let dict = value as? [String: Any] { return dict.isEmpty }
    return false
}

private func formatMessage(_ template: String, field: String = "", value: Any? = nil, expected: Any? = nil) -> String {
    return template
        .replacingOccurrences(of: "{field}", with: field)
        .replacingOccurrences(of: "{value}", with: "\(value ?? "")")
        .replacingOccurrences(of: "{expected}", with: "\(expected ?? "")")
}

// MARK: - 1. RequiredRule — completeness: field must not be null/empty

struct RequiredRule: QualityRulePlugin {
    let id = "required"
    let displayName = "Required Field"
    let defaultSeverity = Severity.error

    func dimension() -> QualityDimension { .completeness }

    func appliesTo(field: FieldDef) -> Bool {
        return field.required
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let allowWhitespace = (config.options["allowWhitespace"] as? Bool) ?? false

        // Null / nil check
        guard let value = value else {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' is required but was null/undefined",
                    field: field.name, value: nil
                ),
                severity: severity
            )
        }

        // NSNull check (common in JSON deserialization)
        if value is NSNull {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' is required but was null",
                    field: field.name
                ),
                severity: severity
            )
        }

        // Empty string check
        if let str = value as? String {
            let empty = allowWhitespace ? str.isEmpty : str.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            if empty {
                return RuleResult(
                    valid: false,
                    message: formatMessage(
                        config.messageTemplate ?? "Field '{field}' is required but was empty",
                        field: field.name
                    ),
                    severity: severity
                )
            }
        }

        // Empty array check
        if let arr = value as? [Any], arr.isEmpty {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' is required but was an empty array",
                    field: field.name
                ),
                severity: severity
            )
        }

        // Empty dictionary check
        if let dict = value as? [String: Any], dict.isEmpty {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' is required but was an empty object",
                    field: field.name
                ),
                severity: severity
            )
        }

        return RuleResult(valid: true)
    }
}

// MARK: - 2. UniqueRule — uniqueness: value must be unique across all records

class UniqueRule: QualityRulePlugin {
    let id = "unique"
    let displayName = "Unique Value"
    let defaultSeverity = Severity.error

    /// In-memory tracking: scope => fieldName => Set<serialized-value>
    private var seenValues: [String: [String: Set<String>]] = [:]

    func dimension() -> QualityDimension { .uniqueness }

    func appliesTo(field: FieldDef) -> Bool { true }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let scope = (config.options["scope"] as? String) ?? "global"
        let caseSensitive = (config.options["caseSensitive"] as? Bool) ?? true

        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true)
        }

        let scopeKey = scope == "global" ? "__global__" : "parent:\(field.parentEntity ?? "__none__")"

        // Serialize the value
        var serialized: String
        if let str = value as? String {
            serialized = str
        } else if let num = value as? NSNumber {
            serialized = num.stringValue
        } else {
            serialized = "\(value)"
        }

        if !caseSensitive {
            serialized = serialized.lowercased()
        }

        // Check and track
        if seenValues[scopeKey] == nil {
            seenValues[scopeKey] = [:]
        }
        if seenValues[scopeKey]![field.name] == nil {
            seenValues[scopeKey]![field.name] = Set()
        }

        if seenValues[scopeKey]![field.name]!.contains(serialized) {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' value '{value}' is not unique (scope: {expected})",
                    field: field.name, value: value, expected: scope
                ),
                severity: severity,
                diagnostics: ["scope": scope, "duplicateValue": serialized]
            )
        }

        seenValues[scopeKey]![field.name]!.insert(serialized)
        return RuleResult(valid: true)
    }

    func reset(scope: String? = nil) {
        if let scope = scope {
            seenValues.removeValue(forKey: scope)
        } else {
            seenValues.removeAll()
        }
    }

    func batchCheck(values: [Any?], field: FieldDef, config: RuleConfig) -> [Int] {
        let caseSensitive = (config.options["caseSensitive"] as? Bool) ?? true
        var seen = Set<String>()
        var duplicateIndices: [Int] = []

        for (i, val) in values.enumerated() {
            guard let val = val, !(val is NSNull) else { continue }
            var serialized = "\(val)"
            if !caseSensitive { serialized = serialized.lowercased() }

            if seen.contains(serialized) {
                duplicateIndices.append(i)
            } else {
                seen.insert(serialized)
            }
        }

        return duplicateIndices
    }
}

// MARK: - 3. TypeCheckRule — validity: value must match declared type

struct TypeCheckRule: QualityRulePlugin {
    let id = "type_check"
    let displayName = "Type Check"
    let defaultSeverity = Severity.error

    func dimension() -> QualityDimension { .validity }

    func appliesTo(field: FieldDef) -> Bool { true }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let allowCoercion = (config.options["allowCoercion"] as? Bool) ?? false

        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true) // Null handling deferred to RequiredRule
        }

        let check = checkType(value: value, expectedType: field.type, allowCoercion: allowCoercion)

        if !check.matches {
            return RuleResult(
                valid: false,
                message: formatMessage(
                    config.messageTemplate ?? "Field '{field}' expected type '{expected}' but got '{value}'",
                    field: field.name, value: check.actualType, expected: field.type.rawValue
                ),
                severity: severity,
                diagnostics: [
                    "expectedType": field.type.rawValue,
                    "actualType": check.actualType,
                    "coercible": check.coercible
                ]
            )
        }

        return RuleResult(valid: true)
    }

    private func checkType(value: Any, expectedType: FieldDef.FieldType, allowCoercion: Bool)
        -> (matches: Bool, actualType: String, coercible: Bool) {

        switch expectedType {
        case .string:
            if value is String { return (true, "String", false) }
            if allowCoercion && (value is NSNumber || value is Bool) { return (true, "\(type(of: value))", true) }
            return (false, "\(type(of: value))", value is NSNumber)

        case .number:
            if let num = value as? NSNumber, !(value is Bool) {
                if num.doubleValue.isNaN { return (false, "NaN", false) }
                return (true, "Number", false)
            }
            if value is Int || value is Double || value is Float { return (true, "\(type(of: value))", false) }
            if allowCoercion, let str = value as? String, Double(str) != nil {
                return (true, "String", true)
            }
            let coercible: Bool = {
                if let str = value as? String { return Double(str) != nil }
                return false
            }()
            return (false, "\(type(of: value))", coercible)

        case .boolean:
            if value is Bool { return (true, "Bool", false) }
            if allowCoercion {
                if let str = value as? String, ["true", "false", "1", "0", "yes", "no"].contains(str.lowercased()) {
                    return (true, "String", true)
                }
                if let num = value as? Int, (num == 0 || num == 1) {
                    return (true, "Int", true)
                }
            }
            return (false, "\(type(of: value))", false)

        case .date:
            if value is Date { return (true, "Date", false) }
            if let str = value as? String {
                let isoFormatter = ISO8601DateFormatter()
                isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if isoFormatter.date(from: str) != nil {
                    return (allowCoercion || true, "String(ISO)", true)
                }
                // Try basic date format
                let basicFormatter = DateFormatter()
                basicFormatter.dateFormat = "yyyy-MM-dd"
                if basicFormatter.date(from: str) != nil {
                    return (allowCoercion || true, "String(date)", true)
                }
                return (false, "String", false)
            }
            if allowCoercion, let num = value as? TimeInterval {
                let d = Date(timeIntervalSince1970: num)
                return (d.timeIntervalSince1970 > 0, "Number(timestamp)", true)
            }
            return (false, "\(type(of: value))", false)

        case .array:
            if value is [Any] { return (true, "Array", false) }
            if allowCoercion, let str = value as? String,
               let data = str.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data),
               parsed is [Any] {
                return (true, "String(JSON)", true)
            }
            return (false, "\(type(of: value))", false)

        case .object:
            if value is [String: Any] { return (true, "Dictionary", false) }
            if allowCoercion, let str = value as? String,
               let data = str.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data),
               parsed is [String: Any] {
                return (true, "String(JSON)", true)
            }
            return (false, "\(type(of: value))", false)
        }
    }
}

// MARK: - 4. RangeRule — validity: numeric value within min/max bounds

struct RangeRule: QualityRulePlugin {
    let id = "range"
    let displayName = "Range Check"
    let defaultSeverity = Severity.error

    func dimension() -> QualityDimension { .validity }

    func appliesTo(field: FieldDef) -> Bool {
        return field.type == .number || field.type == .date || field.type == .string
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let minInclusive = (config.options["minInclusive"] as? Bool) ?? true
        let maxInclusive = (config.options["maxInclusive"] as? Bool) ?? true
        let checkLength = (config.options["checkLength"] as? Bool) ?? false

        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true)
        }

        // Determine comparable value
        let comparable: Double
        let displayValue: String

        if checkLength, let str = value as? String {
            comparable = Double(str.count)
            displayValue = "length(\(str.count))"
        } else if field.type == .date {
            let dateValue: Date?
            if let d = value as? Date {
                dateValue = d
            } else if let s = value as? String {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                dateValue = formatter.date(from: s) ?? DateFormatter.basicDate.date(from: s)
            } else if let n = value as? TimeInterval {
                dateValue = Date(timeIntervalSince1970: n)
            } else {
                return RuleResult(valid: false, message: "Field '\(field.name)' has unparseable date for range check", severity: severity)
            }

            guard let d = dateValue else {
                return RuleResult(valid: false, message: "Field '\(field.name)' has invalid date for range check", severity: severity)
            }
            comparable = d.timeIntervalSince1970
            displayValue = ISO8601DateFormatter().string(from: d)

            // Parse date bounds
            let minDate = parseDate(config.options["min"])
            let maxDate = parseDate(config.options["max"])
            return checkRange(
                value: comparable,
                min: minDate?.timeIntervalSince1970,
                max: maxDate?.timeIntervalSince1970,
                minInclusive: minInclusive,
                maxInclusive: maxInclusive,
                field: field,
                displayValue: displayValue,
                config: config,
                severity: severity
            )
        } else if let num = value as? Double {
            comparable = num
            displayValue = "\(num)"
        } else if let num = value as? Int {
            comparable = Double(num)
            displayValue = "\(num)"
        } else if let str = value as? String, let parsed = Double(str) {
            comparable = parsed
            displayValue = str
        } else {
            return RuleResult(valid: true) // Non-applicable type
        }

        let numMin = (config.options["min"] as? NSNumber)?.doubleValue
        let numMax = (config.options["max"] as? NSNumber)?.doubleValue

        return checkRange(
            value: comparable,
            min: numMin,
            max: numMax,
            minInclusive: minInclusive,
            maxInclusive: maxInclusive,
            field: field,
            displayValue: displayValue,
            config: config,
            severity: severity
        )
    }

    private func checkRange(
        value: Double, min: Double?, max: Double?,
        minInclusive: Bool, maxInclusive: Bool,
        field: FieldDef, displayValue: String,
        config: RuleConfig, severity: Severity
    ) -> RuleResult {
        if let min = min {
            let below = minInclusive ? value < min : value <= min
            if below {
                let op = minInclusive ? ">=" : ">"
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value \(displayValue) must be \(op) \(min)",
                    severity: severity,
                    diagnostics: ["constraint": "min", "bound": min, "inclusive": minInclusive, "actualValue": value]
                )
            }
        }

        if let max = max {
            let above = maxInclusive ? value > max : value >= max
            if above {
                let op = maxInclusive ? "<=" : "<"
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' value \(displayValue) must be \(op) \(max)",
                    severity: severity,
                    diagnostics: ["constraint": "max", "bound": max, "inclusive": maxInclusive, "actualValue": value]
                )
            }
        }

        return RuleResult(valid: true)
    }

    private func parseDate(_ value: Any?) -> Date? {
        guard let value = value else { return nil }
        if let d = value as? Date { return d }
        if let s = value as? String {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.date(from: s) ?? DateFormatter.basicDate.date(from: s)
        }
        if let n = value as? TimeInterval { return Date(timeIntervalSince1970: n) }
        return nil
    }
}

private extension DateFormatter {
    static let basicDate: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()
}

// MARK: - 5. PatternRule — validity: string matches regex pattern

struct PatternRule: QualityRulePlugin {
    let id = "pattern"
    let displayName = "Pattern Match"
    let defaultSeverity = Severity.error

    /// Preset patterns for common validation scenarios.
    static let presets: [String: (pattern: String, description: String)] = [
        "email": (
            pattern: #"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"#,
            description: "RFC 5322 simplified email address"
        ),
        "url": (
            pattern: #"^https?://[^\s/$.?#].[^\s]*$"#,
            description: "HTTP/HTTPS URL"
        ),
        "phone": (
            pattern: #"^\+?[1-9]\d{1,14}$"#,
            description: "E.164 international phone number"
        ),
        "uuid": (
            pattern: #"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#,
            description: "RFC 4122 UUID"
        ),
        "iso_date": (
            pattern: #"^\d{4}-\d{2}-\d{2}$"#,
            description: "ISO 8601 date (YYYY-MM-DD)"
        ),
        "iso_datetime": (
            pattern: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$"#,
            description: "ISO 8601 date-time"
        ),
        "ipv4": (
            pattern: #"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$"#,
            description: "IPv4 address"
        ),
        "slug": (
            pattern: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#,
            description: "URL slug"
        ),
    ]

    func dimension() -> QualityDimension { .validity }

    func appliesTo(field: FieldDef) -> Bool {
        return field.type == .string
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity

        guard let strValue = value as? String else {
            return RuleResult(valid: true) // Non-string values skipped
        }

        let presetName = config.options["preset"] as? String
        let customPattern = config.options["pattern"] as? String
        let invert = (config.options["invert"] as? Bool) ?? false

        let pattern: String
        let description: String

        if let presetName = presetName, let preset = PatternRule.presets[presetName] {
            pattern = preset.pattern
            description = preset.description
        } else if let customPattern = customPattern {
            pattern = customPattern
            description = customPattern
        } else {
            return RuleResult(valid: true) // No pattern configured
        }

        do {
            let caseInsensitive = (config.options["caseInsensitive"] as? Bool) ?? false
            let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
            let regex = try NSRegularExpression(pattern: pattern, options: options)
            let range = NSRange(strValue.startIndex..., in: strValue)
            let matches = regex.firstMatch(in: strValue, range: range) != nil
            let valid = invert ? !matches : matches

            if !valid {
                return RuleResult(
                    valid: false,
                    message: formatMessage(
                        config.messageTemplate ?? "Field '{field}' value '{value}' does not match \(invert ? "exclusion " : "")pattern: \(description)",
                        field: field.name, value: strValue, expected: description
                    ),
                    severity: severity,
                    diagnostics: [
                        "pattern": pattern,
                        "preset": presetName ?? "custom",
                        "invert": invert,
                    ]
                )
            }

            return RuleResult(valid: true)
        } catch {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' has invalid pattern configuration: \(error.localizedDescription)",
                severity: .error
            )
        }
    }
}

// MARK: - 6. EnumRule — validity: value must be in allowed set

struct EnumRule: QualityRulePlugin {
    let id = "enum"
    let displayName = "Enum Check"
    let defaultSeverity = Severity.error

    func dimension() -> QualityDimension { .validity }

    func appliesTo(field: FieldDef) -> Bool { true }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let allowedValues = config.options["values"] as? [Any]
        let caseSensitive = (config.options["caseSensitive"] as? Bool) ?? true
        let allowSubset = (config.options["allowSubset"] as? Bool) ?? false

        guard let value = value, !(value is NSNull), let allowedValues = allowedValues, !allowedValues.isEmpty else {
            return RuleResult(valid: true)
        }

        // Array subset validation
        if let arrayValue = value as? [Any], allowSubset {
            var invalidElements: [Any] = []
            for elem in arrayValue {
                if !isInSet(elem, allowed: allowedValues, caseSensitive: caseSensitive) {
                    invalidElements.append(elem)
                }
            }
            if !invalidElements.isEmpty {
                return RuleResult(
                    valid: false,
                    message: "Field '\(field.name)' contains values not in allowed set: \(invalidElements)",
                    severity: severity,
                    diagnostics: ["invalidElements": invalidElements, "invalidCount": invalidElements.count]
                )
            }
            return RuleResult(valid: true)
        }

        // Single value check
        if !isInSet(value, allowed: allowedValues, caseSensitive: caseSensitive) {
            let truncated = allowedValues.count > 10
                ? Array(allowedValues.prefix(10)).map { "\($0)" } + ["... (\(allowedValues.count) total)"]
                : allowedValues.map { "\($0)" }

            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(value)' is not in allowed set: [\(truncated.joined(separator: ", "))]",
                severity: severity,
                diagnostics: [
                    "receivedValue": "\(value)",
                    "closestMatch": findClosestMatch(value, allowed: allowedValues) ?? "none",
                ]
            )
        }

        return RuleResult(valid: true)
    }

    private func isInSet(_ value: Any, allowed: [Any], caseSensitive: Bool) -> Bool {
        if caseSensitive {
            return allowed.contains { "\($0)" == "\(value)" }
        }
        let lowerValue = "\(value)".lowercased()
        return allowed.contains { "\($0)".lowercased() == lowerValue }
    }

    private func findClosestMatch(_ value: Any, allowed: [Any]) -> String? {
        guard let strValue = value as? String else { return nil }
        var closest: String?
        var minDistance = Int.max

        for a in allowed {
            guard let strA = a as? String else { continue }
            let dist = levenshteinDistance(strValue.lowercased(), strA.lowercased())
            if dist < minDistance {
                minDistance = dist
                closest = strA
            }
        }

        return minDistance <= max(strValue.count, 3) ? closest : nil
    }

    private func levenshteinDistance(_ a: String, _ b: String) -> Int {
        let m = a.count, n = b.count
        let aArr = Array(a), bArr = Array(b)
        var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
        for i in 0...m { dp[i][0] = i }
        for j in 0...n { dp[0][j] = j }
        for i in 1...m {
            for j in 1...n {
                let cost = aArr[i - 1] == bArr[j - 1] ? 0 : 1
                dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
            }
        }
        return dp[m][n]
    }
}

// MARK: - 7. ForeignKeyRule — consistency: referenced entity must exist

/// Storage adapter protocol for foreign key checking.
protocol StorageAdapter {
    func entityExists(entityType: String, key: String) async -> Bool
    func entitiesBatchExist(entityType: String, keys: [String]) async -> [String: Bool]
}

class ForeignKeyRule: QualityRulePlugin {
    let id = "foreign_key"
    let displayName = "Foreign Key Check"
    let defaultSeverity = Severity.error

    private let storage: StorageAdapter?
    private var existenceCache: [String: Set<String>] = [:]

    init(storage: StorageAdapter? = nil) {
        self.storage = storage
    }

    func dimension() -> QualityDimension { .consistency }

    func appliesTo(field: FieldDef) -> Bool {
        return field.metadata?["referencedEntity"] != nil
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let referencedEntity = (config.options["referencedEntity"] as? String)
            ?? (field.metadata?["referencedEntity"] as? String)
        let referencedField = (config.options["referencedField"] as? String) ?? "id"
        let softEnforcement = (config.options["soft"] as? Bool) ?? false

        guard let value = value, !(value is NSNull), let referencedEntity = referencedEntity else {
            return RuleResult(valid: true)
        }

        guard let storage = storage else {
            return RuleResult(valid: true, diagnostics: [
                "warning": "No storage adapter configured; foreign key not verified",
                "referencedEntity": referencedEntity,
            ])
        }

        let key = "\(value)"
        let cacheKey = "\(referencedEntity):\(referencedField)"

        // Check cache
        if existenceCache[cacheKey]?.contains(key) == true {
            return RuleResult(valid: true)
        }

        // Query storage
        let exists = await storage.entityExists(entityType: referencedEntity, key: key)

        if exists {
            if existenceCache[cacheKey] == nil { existenceCache[cacheKey] = Set() }
            existenceCache[cacheKey]!.insert(key)
            return RuleResult(valid: true)
        }

        let effectiveSeverity = softEnforcement ? Severity.warning : severity
        return RuleResult(
            valid: false,
            message: "Field '\(field.name)' references non-existent \(referencedEntity).\(referencedField) = '\(key)'",
            severity: effectiveSeverity,
            diagnostics: [
                "referencedEntity": referencedEntity,
                "referencedField": referencedField,
                "missingKey": key,
                "softEnforcement": softEnforcement,
            ]
        )
    }

    func prefetch(entityType: String, keys: [String]) async {
        guard let storage = storage else { return }
        let results = await storage.entitiesBatchExist(entityType: entityType, keys: keys)
        let cacheKey = "\(entityType):id"
        if existenceCache[cacheKey] == nil { existenceCache[cacheKey] = Set() }
        for (key, exists) in results where exists {
            existenceCache[cacheKey]!.insert(key)
        }
    }

    func clearCache() { existenceCache.removeAll() }
}

// MARK: - 8. CrossFieldRule — consistency: multi-field rules

struct CrossFieldRule: QualityRulePlugin {
    let id = "cross_field"
    let displayName = "Cross-Field Validation"
    let defaultSeverity = Severity.error

    func dimension() -> QualityDimension { .consistency }

    func appliesTo(field: FieldDef) -> Bool { true }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity

        guard let rules = config.options["rules"] as? [[String: Any]], !rules.isEmpty else {
            return RuleResult(valid: true)
        }

        var violations: [String] = []

        for rule in rules {
            guard let leftField = rule["leftField"] as? String,
                  let operatorStr = rule["operator"] as? String else { continue }

            // Check conditional
            if let condition = rule["condition"] as? [String: Any],
               let condField = condition["field"] as? String,
               let condOp = condition["operator"] as? String {
                let condVal = record[condField]
                if !compare(condVal, op: condOp, right: condition["value"]) {
                    continue // Condition not met, skip
                }
            }

            let leftVal = record[leftField]
            let rightVal: Any?
            if let rightField = rule["rightField"] as? String {
                rightVal = record[rightField]
            } else {
                rightVal = rule["rightValue"]
            }

            guard leftVal != nil, rightVal != nil else { continue }

            if !compare(leftVal, op: operatorStr, right: rightVal) {
                let rightDesc = (rule["rightField"] as? String) ?? "\(rightVal ?? "nil")"
                violations.append("\(leftField) (\(leftVal ?? "nil")) must be \(operatorStr) \(rightDesc) (\(rightVal ?? "nil"))")
            }
        }

        if !violations.isEmpty {
            return RuleResult(
                valid: false,
                message: "Cross-field validation failed for '\(field.name)': \(violations.joined(separator: "; "))",
                severity: severity,
                diagnostics: ["violations": violations, "ruleCount": rules.count, "failedCount": violations.count]
            )
        }

        return RuleResult(valid: true)
    }

    private func compare(_ left: Any?, op: String, right: Any?) -> Bool {
        let leftNum = toComparable(left)
        let rightNum = toComparable(right)

        switch op {
        case "eq":
            if let l = leftNum, let r = rightNum { return l == r }
            return "\(left ?? "")" == "\(right ?? "")"
        case "neq":
            if let l = leftNum, let r = rightNum { return l != r }
            return "\(left ?? "")" != "\(right ?? "")"
        case "gt":
            if let l = leftNum, let r = rightNum { return l > r }
            return "\(left ?? "")" > "\(right ?? "")"
        case "gte":
            if let l = leftNum, let r = rightNum { return l >= r }
            return "\(left ?? "")" >= "\(right ?? "")"
        case "lt":
            if let l = leftNum, let r = rightNum { return l < r }
            return "\(left ?? "")" < "\(right ?? "")"
        case "lte":
            if let l = leftNum, let r = rightNum { return l <= r }
            return "\(left ?? "")" <= "\(right ?? "")"
        case "contains":
            return "\(left ?? "")".contains("\(right ?? "")")
        case "not_contains":
            return !"\(left ?? "")".contains("\(right ?? "")")
        default:
            return false
        }
    }

    private func toComparable(_ value: Any?) -> Double? {
        guard let value = value else { return nil }
        if let num = value as? Double { return num }
        if let num = value as? Int { return Double(num) }
        if let d = value as? Date { return d.timeIntervalSince1970 }
        if let str = value as? String {
            // Try date parsing
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = formatter.date(from: str) { return d.timeIntervalSince1970 }
            // Try number parsing
            if let n = Double(str) { return n }
        }
        return nil
    }
}

// MARK: - 9. FreshnessRule — timeliness: data must be newer than threshold

struct FreshnessRule: QualityRulePlugin {
    let id = "freshness"
    let displayName = "Data Freshness"
    let defaultSeverity = Severity.warning

    func dimension() -> QualityDimension { .timeliness }

    func appliesTo(field: FieldDef) -> Bool {
        return field.type == .date
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity

        guard let value = value, !(value is NSNull) else {
            return RuleResult(valid: true)
        }

        let timestamp: Date
        if let d = value as? Date {
            timestamp = d
        } else if let s = value as? String {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard let d = formatter.date(from: s) ?? DateFormatter.basicDate.date(from: s) else {
                return RuleResult(valid: false, message: "Field '\(field.name)' has unparseable date for freshness check", severity: severity)
            }
            timestamp = d
        } else if let n = value as? TimeInterval {
            timestamp = Date(timeIntervalSince1970: n)
        } else {
            return RuleResult(valid: false, message: "Field '\(field.name)' has invalid type for freshness check", severity: severity)
        }

        let maxAgeDuration = config.options["maxAge"] as? String
        let absoluteThreshold = config.options["notBefore"]
        let referenceTime = Date()

        var thresholdDate: Date?

        if let maxAge = maxAgeDuration, let durationSec = parseDuration(maxAge) {
            thresholdDate = referenceTime.addingTimeInterval(-durationSec)
        } else if let absValue = absoluteThreshold {
            if let d = absValue as? Date {
                thresholdDate = d
            } else if let s = absValue as? String {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                thresholdDate = formatter.date(from: s)
            }
        }

        guard let threshold = thresholdDate else {
            return RuleResult(valid: true) // No threshold configured
        }

        let ageSeconds = referenceTime.timeIntervalSince(timestamp)
        let ageHuman = formatAge(ageSeconds)

        if timestamp < threshold {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' data is stale (age: \(ageHuman), max allowed: \(maxAgeDuration ?? "\(absoluteThreshold ?? "?")"))",
                severity: severity,
                diagnostics: [
                    "timestamp": ISO8601DateFormatter().string(from: timestamp),
                    "ageSeconds": ageSeconds,
                    "ageHuman": ageHuman,
                    "maxAge": maxAgeDuration ?? "N/A",
                ]
            )
        }

        // Check for future timestamps
        let allowFuture = (config.options["allowFuture"] as? Bool) ?? false
        if !allowFuture && timestamp.timeIntervalSince(referenceTime) > 60 {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' has a future timestamp: \(ISO8601DateFormatter().string(from: timestamp))",
                severity: .warning,
                diagnostics: ["aheadBySeconds": timestamp.timeIntervalSince(referenceTime)]
            )
        }

        return RuleResult(valid: true, diagnostics: ["ageSeconds": ageSeconds, "ageHuman": ageHuman])
    }

    /// Parse duration strings like "24h", "7d", "30m", "1y" to seconds.
    private func parseDuration(_ duration: String) -> TimeInterval? {
        guard let regex = try? NSRegularExpression(pattern: #"^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$"#),
              let match = regex.firstMatch(in: duration, range: NSRange(duration.startIndex..., in: duration)),
              let amountRange = Range(match.range(at: 1), in: duration),
              let unitRange = Range(match.range(at: 2), in: duration),
              let amount = Double(duration[amountRange]) else {
            return nil
        }

        let unit = String(duration[unitRange])
        let unitSeconds: [String: TimeInterval] = [
            "ms": 0.001, "s": 1, "m": 60, "h": 3600, "d": 86400,
            "w": 604800, "M": 2592000, "y": 31536000,
        ]

        guard let multiplier = unitSeconds[unit] else { return nil }
        return amount * multiplier
    }

    private func formatAge(_ seconds: TimeInterval) -> String {
        let abs = Swift.abs(seconds)
        if abs < 60 { return "\(Int(abs))s" }
        if abs < 3600 { return "\(Int(abs / 60))m" }
        if abs < 86400 { return String(format: "%.1fh", abs / 3600) }
        if abs < 604800 { return String(format: "%.1fd", abs / 86400) }
        return String(format: "%.1fw", abs / 604800)
    }
}

// MARK: - 10. NoDuplicatesRule — uniqueness: record-level dedup

class NoDuplicatesRule: QualityRulePlugin {
    let id = "no_duplicates"
    let displayName = "No Duplicate Records"
    let defaultSeverity = Severity.warning

    private var seenSignatures: [String: (index: Int, record: DataRecord)] = [:]
    private var recordIndex = 0

    func dimension() -> QualityDimension { .uniqueness }

    func appliesTo(field: FieldDef) -> Bool { true }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let compareFields = config.options["compareFields"] as? [String]
        let matchMode = (config.options["matchMode"] as? String) ?? "exact"
        let similarityThreshold = (config.options["similarityThreshold"] as? Double) ?? 0.9

        guard let compareFields = compareFields, !compareFields.isEmpty else {
            return RuleResult(valid: true)
        }

        let currentIndex = recordIndex
        recordIndex += 1

        switch matchMode {
        case "exact":
            let signature = computeExactSignature(record: record, fields: compareFields)
            if let existing = seenSignatures[signature] {
                return RuleResult(
                    valid: false,
                    message: "Duplicate record detected for '\(field.name)' (matches record at index \(existing.index))",
                    severity: severity,
                    diagnostics: ["matchMode": "exact", "matchedIndex": existing.index, "compareFields": compareFields]
                )
            }
            seenSignatures[signature] = (index: currentIndex, record: record)

        case "normalized":
            let signature = computeNormalizedSignature(record: record, fields: compareFields)
            if let existing = seenSignatures[signature] {
                return RuleResult(
                    valid: false,
                    message: "Duplicate record detected (normalized match at index \(existing.index))",
                    severity: severity,
                    diagnostics: ["matchMode": "normalized", "matchedIndex": existing.index]
                )
            }
            seenSignatures[signature] = (index: currentIndex, record: record)

        case "fuzzy":
            for (_, existing) in seenSignatures {
                let similarity = computeJaccardSimilarity(recordA: record, recordB: existing.record, fields: compareFields)
                if similarity >= similarityThreshold {
                    return RuleResult(
                        valid: false,
                        message: String(format: "Probable duplicate record detected (similarity: %.1f%%, threshold: %.1f%%)",
                                        similarity * 100, similarityThreshold * 100),
                        severity: severity,
                        diagnostics: ["matchMode": "fuzzy", "similarity": similarity, "threshold": similarityThreshold, "matchedIndex": existing.index]
                    )
                }
            }
            let signature = computeExactSignature(record: record, fields: compareFields)
            seenSignatures[signature] = (index: currentIndex, record: record)

        default:
            break
        }

        return RuleResult(valid: true)
    }

    private func computeExactSignature(record: DataRecord, fields: [String]) -> String {
        return fields.map { "\($0):\(record[$0] ?? "nil")" }.joined(separator: "|")
    }

    private func computeNormalizedSignature(record: DataRecord, fields: [String]) -> String {
        return fields.map { f in
            let val = record[f]
            if let str = val as? String {
                let normalized = str.lowercased()
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .components(separatedBy: .punctuationCharacters).joined()
                    .components(separatedBy: .whitespaces).filter { !$0.isEmpty }.joined(separator: " ")
                return "\(f):\(normalized)"
            }
            return "\(f):\(val ?? "nil")"
        }.joined(separator: "|")
    }

    private func computeJaccardSimilarity(recordA: DataRecord, recordB: DataRecord, fields: [String]) -> Double {
        var totalIntersection = 0
        var totalUnion = 0

        for f in fields {
            let a = "\(recordA[f] ?? "")".lowercased()
            let b = "\(recordB[f] ?? "")".lowercased()

            let bigramsA = Set(bigrams(a))
            let bigramsB = Set(bigrams(b))

            let intersection = bigramsA.intersection(bigramsB).count
            let union = bigramsA.union(bigramsB).count

            totalIntersection += intersection
            totalUnion += union
        }

        return totalUnion == 0 ? 1.0 : Double(totalIntersection) / Double(totalUnion)
    }

    private func bigrams(_ s: String) -> [String] {
        let arr = Array(s)
        guard arr.count >= 2 else { return [] }
        return (0..<arr.count - 1).map { String(arr[$0...$0 + 1]) }
    }

    func reset() {
        seenSignatures.removeAll()
        recordIndex = 0
    }
}

// MARK: - 11. ReconciliationRule — accuracy: value matches external knowledge base

/// Knowledge base adapter protocol for reconciliation.
protocol KnowledgeBaseAdapter {
    func lookup(value: String, entityType: String?) async -> [(match: String, confidence: Double, source: String)]
}

class ReconciliationRule: QualityRulePlugin {
    let id = "reconciliation"
    let displayName = "External Reconciliation"
    let defaultSeverity = Severity.warning

    private let knowledgeBase: KnowledgeBaseAdapter?
    private var cache: [String: (match: String, confidence: Double, source: String)] = [:]

    init(knowledgeBase: KnowledgeBaseAdapter? = nil) {
        self.knowledgeBase = knowledgeBase
    }

    func dimension() -> QualityDimension { .accuracy }

    func appliesTo(field: FieldDef) -> Bool {
        return field.type == .string
    }

    func validate(value: Any?, field: FieldDef, record: DataRecord, config: RuleConfig) async -> RuleResult {
        let severity = config.severity ?? defaultSeverity
        let confidenceThreshold = (config.options["confidenceThreshold"] as? Double) ?? 0.8
        let entityType = config.options["entityType"] as? String
        let useFuzzyMatching = (config.options["fuzzyMatching"] as? Bool) ?? true
        let source = (config.options["source"] as? String) ?? "default"

        guard let strValue = value as? String, !strValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return RuleResult(valid: true)
        }

        guard let knowledgeBase = knowledgeBase else {
            return RuleResult(valid: true, diagnostics: [
                "warning": "No knowledge base adapter configured; reconciliation skipped",
                "source": source,
            ])
        }

        // Check cache
        let cacheKey = "\(source):\(entityType ?? "*"):\(strValue)"
        if let cached = cache[cacheKey] {
            if cached.confidence >= confidenceThreshold {
                return RuleResult(valid: true, diagnostics: [
                    "matchedValue": cached.match, "confidence": cached.confidence, "fromCache": true,
                ])
            }
            return buildFailure(value: strValue, field: field, best: cached, threshold: confidenceThreshold, severity: severity, config: config)
        }

        // Query knowledge base
        var matches = await knowledgeBase.lookup(value: strValue, entityType: entityType)

        if matches.isEmpty {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(strValue)' not found in knowledge base (source: \(source))",
                severity: severity,
                diagnostics: ["source": source, "matchCount": 0, "confidenceThreshold": confidenceThreshold]
            )
        }

        // Sort by confidence descending
        matches.sort { $0.confidence > $1.confidence }
        let best = matches[0]

        // Cache result
        cache[cacheKey] = best

        if best.confidence >= confidenceThreshold {
            return RuleResult(valid: true, diagnostics: [
                "matchedValue": best.match,
                "confidence": best.confidence,
                "source": best.source,
                "isExactMatch": best.confidence == 1.0,
            ])
        }

        if !useFuzzyMatching && best.confidence < 1.0 {
            return RuleResult(
                valid: false,
                message: "Field '\(field.name)' value '\(strValue)' does not exactly match any entry in \(source)",
                severity: severity,
                diagnostics: ["closestMatch": best.match, "confidence": best.confidence]
            )
        }

        return buildFailure(value: strValue, field: field, best: best, threshold: confidenceThreshold, severity: severity, config: config)
    }

    private func buildFailure(
        value: String, field: FieldDef,
        best: (match: String, confidence: Double, source: String),
        threshold: Double, severity: Severity, config: RuleConfig
    ) -> RuleResult {
        return RuleResult(
            valid: false,
            message: String(format: "Field '%@' value '%@' has low confidence match (%.1f%% < %.1f%% threshold). Best match: '%@'",
                            field.name, value, best.confidence * 100, threshold * 100, best.match),
            severity: severity,
            diagnostics: [
                "closestMatch": best.match,
                "confidence": best.confidence,
                "source": best.source,
                "threshold": threshold,
                "suggestedCorrection": best.match,
            ]
        )
    }

    func clearCache() { cache.removeAll() }
}

// MARK: - Provider Registry

/// All quality rule providers indexed by their unique ID.
let qualityRuleProviders: [String: any QualityRulePlugin] = [
    "required": RequiredRule(),
    "unique": UniqueRule(),
    "type_check": TypeCheckRule(),
    "range": RangeRule(),
    "pattern": PatternRule(),
    "enum": EnumRule(),
    "foreign_key": ForeignKeyRule(),
    "cross_field": CrossFieldRule(),
    "freshness": FreshnessRule(),
    "no_duplicates": NoDuplicatesRule(),
    "reconciliation": ReconciliationRule(),
]

/// Resolve all applicable quality rules for a given field definition.
func resolveRulesForField(_ field: FieldDef) -> [any QualityRulePlugin] {
    return qualityRuleProviders.values.filter { $0.appliesTo(field: field) }
}

/// Validate a record against all applicable quality rules.
func validateRecord(
    record: DataRecord,
    fields: [FieldDef],
    ruleConfigs: [String: RuleConfig] = [:]
) async -> [String: [RuleResult]] {
    var results: [String: [RuleResult]] = [:]

    for field in fields {
        var fieldResults: [RuleResult] = []
        let value = record[field.name]

        for (ruleId, provider) in qualityRuleProviders {
            let config = ruleConfigs[ruleId] ?? RuleConfig()
            guard config.enabled else { continue }
            guard provider.appliesTo(field: field) else { continue }

            let result = await provider.validate(value: value, field: field, record: record, config: config)
            if !result.valid {
                fieldResults.append(result)
            }
        }

        if !fieldResults.isEmpty {
            results[field.name] = fieldResults
        }
    }

    return results
}
