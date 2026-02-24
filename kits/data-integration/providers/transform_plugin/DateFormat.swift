// Transform Plugin Provider: date_format
// Parse and reformat dates with timezone support and auto-detection.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class DateFormatTransformProvider {
    public static let providerId = "date_format"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        let outputFormat = (config.options["outputFormat"] as? String) ?? "iso8601"
        let inputFormat = config.options["inputFormat"] as? String
        let timezone = config.options["timezone"] as? String

        let date = try parseDate(value: value, inputFormat: inputFormat)

        return formatDate(date: date, format: outputFormat, timezone: timezone)
    }

    private func parseDate(value: Any, inputFormat: String?) throws -> Date {
        // Unix timestamp (number)
        if let num = value as? Double {
            let ts = num < 1e12 ? num : num / 1000.0
            return Date(timeIntervalSince1970: ts)
        }
        if let num = value as? Int {
            let ts = num < 1_000_000_000_000 ? Double(num) : Double(num) / 1000.0
            return Date(timeIntervalSince1970: ts)
        }

        let str = String(describing: value).trimmingCharacters(in: .whitespaces)

        // Explicit input format
        if let fmt = inputFormat {
            let formatter = DateFormatter()
            formatter.dateFormat = fmt
            formatter.locale = Locale(identifier: "en_US_POSIX")
            if let date = formatter.date(from: str) {
                return date
            }
            throw TransformError.invalidCast("Cannot parse \"\(str)\" with format \"\(fmt)\"")
        }

        // Unix timestamp string (10 digits = seconds, 13 = milliseconds)
        if str.count == 10, str.allSatisfy({ $0.isNumber }) {
            if let ts = Double(str) {
                return Date(timeIntervalSince1970: ts)
            }
        }
        if str.count == 13, str.allSatisfy({ $0.isNumber }) {
            if let ts = Double(str) {
                return Date(timeIntervalSince1970: ts / 1000.0)
            }
        }

        // ISO 8601
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: str) { return date }
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: str) { return date }

        // Common formats
        let formats = [
            "yyyy-MM-dd",
            "yyyy-MM-dd HH:mm:ss",
            "MM/dd/yyyy",
            "dd-MMM-yyyy",
            "MMM dd, yyyy",
            "MMMM dd, yyyy",
        ]

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")

        for fmt in formats {
            formatter.dateFormat = fmt
            if let date = formatter.date(from: str) { return date }
        }

        // RFC 2822
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
        if let date = formatter.date(from: str) { return date }

        throw TransformError.invalidCast("Cannot parse date from: \"\(str)\"")
    }

    private func formatDate(date: Date, format: String, timezone: String?) -> String {
        let tz: TimeZone
        if let tzStr = timezone {
            tz = TimeZone(identifier: tzStr)
                ?? TimeZone(abbreviation: tzStr)
                ?? TimeZone.current
        } else {
            tz = TimeZone(identifier: "UTC")!
        }

        switch format {
        case "iso8601":
            let formatter = ISO8601DateFormatter()
            formatter.timeZone = tz
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.string(from: date)

        case "unix":
            return String(Int(date.timeIntervalSince1970))

        case "unix_ms":
            return String(Int(date.timeIntervalSince1970 * 1000))

        case "date":
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.timeZone = tz
            return formatter.string(from: date)

        case "time":
            let formatter = DateFormatter()
            formatter.dateFormat = "HH:mm:ss"
            formatter.timeZone = tz
            return formatter.string(from: date)

        default:
            let formatter = DateFormatter()
            formatter.dateFormat = format
            formatter.timeZone = tz
            formatter.locale = Locale(identifier: "en_US_POSIX")
            return formatter.string(from: date)
        }
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "any", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
