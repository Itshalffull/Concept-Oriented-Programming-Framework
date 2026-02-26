// Transform Plugin Provider: slugify
// Generate URL-safe slug from input string with Unicode transliteration.
// See Architecture doc for transform plugin interface contract.

import Foundation

public final class SlugifyTransformProvider {
    public static let providerId = "slugify"
    public static let pluginType = "transform_plugin"

    private let transliterations: [Character: String] = [
        "\u{00E0}": "a", "\u{00E1}": "a", "\u{00E2}": "a", "\u{00E3}": "a",
        "\u{00E4}": "ae", "\u{00E5}": "a", "\u{00E6}": "ae", "\u{00E7}": "c",
        "\u{00E8}": "e", "\u{00E9}": "e", "\u{00EA}": "e", "\u{00EB}": "e",
        "\u{00EC}": "i", "\u{00ED}": "i", "\u{00EE}": "i", "\u{00EF}": "i",
        "\u{00F0}": "d", "\u{00F1}": "n", "\u{00F2}": "o", "\u{00F3}": "o",
        "\u{00F4}": "o", "\u{00F5}": "o", "\u{00F6}": "oe", "\u{00F8}": "o",
        "\u{00F9}": "u", "\u{00FA}": "u", "\u{00FB}": "u", "\u{00FC}": "ue",
        "\u{00FD}": "y", "\u{00FF}": "y", "\u{00DF}": "ss",
        "\u{0142}": "l", "\u{017E}": "z", "\u{0161}": "s", "\u{010D}": "c",
        "\u{0159}": "r", "\u{017C}": "z", "\u{0105}": "a", "\u{0119}": "e",
        "\u{0144}": "n", "\u{015B}": "s", "\u{0107}": "c",
        "\u{00C0}": "a", "\u{00C1}": "a", "\u{00C2}": "a", "\u{00C3}": "a",
        "\u{00C4}": "ae", "\u{00C5}": "a", "\u{00C6}": "ae", "\u{00C7}": "c",
        "\u{00C8}": "e", "\u{00C9}": "e", "\u{00CA}": "e", "\u{00CB}": "e",
        "\u{00CC}": "i", "\u{00CD}": "i", "\u{00CE}": "i", "\u{00CF}": "i",
        "\u{00D1}": "n", "\u{00D2}": "o", "\u{00D3}": "o", "\u{00D4}": "o",
        "\u{00D5}": "o", "\u{00D6}": "oe", "\u{00D8}": "o",
        "\u{00D9}": "u", "\u{00DA}": "u", "\u{00DB}": "u", "\u{00DC}": "ue",
        "\u{00DD}": "y",
    ]

    public init() {}

    public func transform(value: Any, config: TransformConfig) throws -> Any {
        if value is NSNull {
            return NSNull()
        }

        let separator = (config.options["separator"] as? String) ?? "-"
        let maxLength = config.options["maxLength"] as? Int

        var str = String(describing: value).lowercased()

        // Transliterate Unicode characters
        var transliterated = ""
        for char in str {
            if let replacement = transliterations[char] {
                transliterated.append(replacement)
            } else {
                transliterated.append(char)
            }
        }
        str = transliterated

        // Replace non-alphanumeric characters with separator
        var result = ""
        var lastWasSep = true

        for char in str {
            if char.isASCII && (char.isLetter || char.isNumber) {
                result.append(char)
                lastWasSep = false
            } else if !lastWasSep {
                result.append(contentsOf: separator)
                lastWasSep = true
            }
        }

        // Remove trailing separator
        while result.hasSuffix(separator) {
            result = String(result.dropLast(separator.count))
        }

        // Apply max length
        if let max = maxLength, max > 0, result.count > max {
            result = String(result.prefix(max))
            while result.hasSuffix(separator) {
                result = String(result.dropLast(separator.count))
            }
        }

        return result
    }

    public func inputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }

    public func outputType() -> TypeSpec {
        return TypeSpec(type: "string", nullable: true)
    }
}
