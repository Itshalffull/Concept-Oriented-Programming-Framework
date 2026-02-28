// Transform Plugin Provider: regex_replace
// Pattern-based find and replace with capture group support.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class RegexReplaceTransformProvider {
    public static let providerId = "regex_replace"
    public static let pluginType = "transform_plugin"

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull { return NSNull() }

        let str = String(describing: value)

        guard let pattern = config.options["pattern"] as? String else {
            throw TransformError.invalidCast("regex_replace requires a pattern in config.options.pattern")
        }

        let replacement = (config.options["replacement"] as? String) ?? ""
        let global = (config.options["global"] as? Bool) ?? true
        let caseInsensitive = (config.options["caseInsensitive"] as? Bool) ?? false
        let multiline = (config.options["multiline"] as? Bool) ?? false

        var options: NSRegularExpression.Options = []
        if caseInsensitive {
            options.insert(.caseInsensitive)
        }
        if multiline {
            options.insert(.anchorsMatchLines)
        }

        let regex: NSRegularExpression
        do {
            regex = try NSRegularExpression(pattern: pattern, options: options)
        } catch {
            throw TransformError.invalidCast("Invalid regex pattern \"\(pattern)\": \(error.localizedDescription)")
        }

        let nsStr = str as NSString
        let fullRange = NSRange(location: 0, length: nsStr.length)

        if global {
            // Replace all matches
            // NSRegularExpression replacement supports $1, $2 capture group references
            let result = regex.stringByReplacingMatches(
                in: str, range: fullRange, withTemplate: replacement)
            return result
        } else {
            // Replace first match only
            guard let match = regex.firstMatch(in: str, range: fullRange) else {
                return str
            }

            var replacementStr = replacement
            // Manually resolve capture group references for single replacement
            for i in (0...min(match.numberOfRanges - 1, 9)).reversed() {
                let groupRange = match.range(at: i)
                let groupValue: String
                if groupRange.location != NSNotFound {
                    groupValue = nsStr.substring(with: groupRange)
                } else {
                    groupValue = ""
                }
                replacementStr = replacementStr.replacingOccurrences(of: "$\(i)", with: groupValue)
            }

            let result = nsStr.replacingCharacters(in: match.range, with: replacementStr)
            return result
        }
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
