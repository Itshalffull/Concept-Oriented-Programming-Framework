// Transform Plugin Provider: truncate
// Limit string length with configurable ellipsis and word-boundary awareness.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class TruncateTransformProvider {
    public static let providerId = "truncate"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        let str = String(describing: value)
        let maxLength = (config.options["maxLength"] as? Int) ?? 100
        let suffix = (config.options["suffix"] as? String) ?? "..."
        let wordBoundary = (config.options["wordBoundary"] as? Bool) ?? true

        if str.count <= maxLength {
            return str
        }

        let effectiveMax = maxLength - suffix.count

        if effectiveMax <= 0 {
            return String(suffix.prefix(maxLength))
        }

        var truncated = String(str.prefix(effectiveMax))

        if wordBoundary {
            if let lastSpaceIndex = truncated.lastIndex(of: " ") {
                let distance = truncated.distance(from: truncated.startIndex, to: lastSpaceIndex)
                if distance > effectiveMax / 2 {
                    truncated = String(truncated[..<lastSpaceIndex])
                }
            }
        }

        // Remove trailing punctuation that looks odd before ellipsis
        let trailingPunctuation: Set<Character> = [",", ";", ":", " "]
        while let lastChar = truncated.last, trailingPunctuation.contains(lastChar) {
            truncated.removeLast()
        }

        return truncated + suffix
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
