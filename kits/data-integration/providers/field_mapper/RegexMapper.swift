// Regex field mapper — regex capture group extraction from string values
// Supports named groups, numbered groups, and flags: i (case-insensitive),
// m (multiline), s (dotall), g (global/all matches)

import Foundation

public final class RegexMapperProvider {
    public static let providerID = "regex"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let opts = config.options ?? [:]

        let (fieldName, inlinePattern, inlineFlags) = parseSourcePath(sourcePath)

        let patternStr: String
        let flags: String
        if let pat = inlinePattern {
            patternStr = pat
            flags = mergeFlags(inlineFlags, opts["flags"] as? String ?? "")
        } else {
            guard let pat = opts["pattern"] as? String, !pat.isEmpty else {
                return NSNull()
            }
            patternStr = pat
            flags = opts["flags"] as? String ?? ""
        }

        guard let input = resolveFieldValue(record: record, field: fieldName) else {
            return NSNull()
        }

        let isGlobal = flags.contains("g") || (opts["allMatches"] as? Bool ?? false)
        var regexOptions: NSRegularExpression.Options = []
        if flags.contains("i") { regexOptions.insert(.caseInsensitive) }
        if flags.contains("m") { regexOptions.insert(.anchorsMatchLines) }
        if flags.contains("s") { regexOptions.insert(.dotMatchesLineSeparators) }

        let regex: NSRegularExpression
        do {
            regex = try NSRegularExpression(pattern: patternStr, options: regexOptions)
        } catch {
            return NSNull()
        }

        let nsInput = input as NSString
        let requestedGroup = opts["group"]

        if isGlobal {
            let matches = regex.matches(in: input, range: NSRange(location: 0, length: nsInput.length))
            if matches.isEmpty { return NSNull() }
            let results: [Any] = matches.map { match in
                extractMatch(match, from: nsInput, group: requestedGroup, pattern: patternStr)
            }
            return results
        }

        guard let match = regex.firstMatch(in: input, range: NSRange(location: 0, length: nsInput.length)) else {
            return NSNull()
        }
        return extractMatch(match, from: nsInput, group: requestedGroup, pattern: patternStr)
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "regex" || pathSyntax == "regexp" || pathSyntax == "regular_expression"
    }

    // MARK: - Private Helpers

    private func parseSourcePath(_ path: String) -> (String, String?, String) {
        guard let sepRange = path.range(of: "::/") else {
            return (path.trimmingCharacters(in: .whitespaces), nil, "")
        }
        let field = path[path.startIndex..<sepRange.lowerBound].trimmingCharacters(in: .whitespaces)
        let rest = String(path[sepRange.upperBound...]) // after "::"

        // rest starts after "::/" so we need the content after first /
        // Actually rest is the content after "::/" — find the last /
        guard let lastSlash = rest.lastIndex(of: "/"), lastSlash != rest.startIndex else {
            return (field, rest, "")
        }
        let pattern = String(rest[rest.startIndex..<lastSlash])
        let flags = String(rest[rest.index(after: lastSlash)...])
        return (field, pattern, flags)
    }

    private func mergeFlags(_ a: String, _ b: String) -> String {
        var seen = Set<Character>()
        var result = ""
        for ch in a + b {
            if !seen.contains(ch) && "imsgu".contains(ch) {
                seen.insert(ch)
                result.append(ch)
            }
        }
        return result
    }

    private func resolveFieldValue(record: [String: Any], field: String) -> String? {
        let parts = field.split(separator: ".").map(String.init)
        var current: Any = record
        for part in parts {
            guard let dict = current as? [String: Any], let next = dict[part] else { return nil }
            current = next
        }
        if let s = current as? String { return s }
        if let n = current as? NSNumber { return n.stringValue }
        return nil
    }

    private func extractMatch(
        _ match: NSTextCheckingResult,
        from input: NSString,
        group: Any?,
        pattern: String
    ) -> Any {
        // Specific group requested
        if let groupNum = group as? Int, groupNum < match.numberOfRanges {
            let range = match.range(at: groupNum)
            return range.location != NSNotFound ? input.substring(with: range) : NSNull()
        }
        if let groupName = group as? String {
            let range = match.range(withName: groupName)
            return range.location != NSNotFound ? input.substring(with: range) : NSNull()
        }

        // Extract named groups if present
        let namedGroups = extractNamedGroupNames(pattern)
        if !namedGroups.isEmpty {
            var dict: [String: Any] = [:]
            for name in namedGroups {
                let range = match.range(withName: name)
                if range.location != NSNotFound {
                    dict[name] = input.substring(with: range)
                }
            }
            if !dict.isEmpty { return dict }
        }

        // Numbered capture groups
        if match.numberOfRanges > 1 {
            var groups: [String] = []
            for i in 1..<match.numberOfRanges {
                let range = match.range(at: i)
                if range.location != NSNotFound {
                    groups.append(input.substring(with: range))
                }
            }
            return groups.count == 1 ? groups[0] : groups
        }

        return input.substring(with: match.range)
    }

    private func extractNamedGroupNames(_ pattern: String) -> [String] {
        var names: [String] = []
        let chars = Array(pattern)
        var i = 0
        while i + 3 < chars.count {
            if chars[i] == "(" && chars[i + 1] == "?" && chars[i + 2] == "<" && chars[i + 3] != "=" && chars[i + 3] != "!" {
                let start = i + 3
                var end = start
                while end < chars.count && chars[end] != ">" { end += 1 }
                if end < chars.count {
                    names.append(String(chars[start..<end]))
                }
            }
            i += 1
        }
        return names
    }
}
