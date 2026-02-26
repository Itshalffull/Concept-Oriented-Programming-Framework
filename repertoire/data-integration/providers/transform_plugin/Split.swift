// Transform Plugin Provider: split
// Split a string into an array by configurable delimiter.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class SplitTransformProvider {
    public static let providerId = "split"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull {
            return [String]()
        }

        let str = String(describing: value)
        let delimiter = (config.options["delimiter"] as? String) ?? ","
        let isRegex = (config.options["regex"] as? Bool) ?? false
        let limit = config.options["limit"] as? Int
        let trimEntries = (config.options["trim"] as? Bool) ?? true
        let filterEmpty = (config.options["filterEmpty"] as? Bool) ?? true

        var parts: [String]

        if isRegex {
            guard let regex = try? NSRegularExpression(pattern: delimiter) else {
                throw TransformError.invalidCast("Invalid regex delimiter: \(delimiter)")
            }
            let range = NSRange(str.startIndex..., in: str)
            let matches = regex.matches(in: str, range: range)

            parts = []
            var lastEnd = str.startIndex
            for match in matches {
                let matchRange = Range(match.range, in: str)!
                parts.append(String(str[lastEnd..<matchRange.lowerBound]))
                lastEnd = matchRange.upperBound
            }
            parts.append(String(str[lastEnd...]))
        } else {
            parts = str.components(separatedBy: delimiter)
        }

        // Apply limit
        if let lim = limit, lim > 0, parts.count > lim {
            let head = Array(parts[0..<lim - 1])
            let tail = parts[lim - 1...].joined(separator: delimiter)
            parts = head + [tail]
        }

        // Trim entries
        if trimEntries {
            parts = parts.map { $0.trimmingCharacters(in: .whitespaces) }
        }

        // Filter empty
        if filterEmpty {
            parts = parts.filter { !$0.isEmpty }
        }

        return parts
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "array")
    }
}
