// Direct field mapper — key-to-key mapping with dot notation for nested traversal
// Supports dot-separated paths and bracket notation for array indexing

import Foundation

public struct MapperConfig {
    public let pathSyntax: String
    public let options: [String: Any]?

    public init(pathSyntax: String, options: [String: Any]? = nil) {
        self.pathSyntax = pathSyntax
        self.options = options
    }
}

public enum MapperError: Error {
    case pathNotFound(String)
    case invalidPath(String)
}

/// Segment of a parsed field path: either a string key or an array index
private enum PathSegment {
    case key(String)
    case index(Int)
}

/// Parse a dot-notation path into traversal segments.
/// Example: "user.addresses[0].city" => [.key("user"), .key("addresses"), .index(0), .key("city")]
private func parseSegments(_ sourcePath: String) -> [PathSegment] {
    var segments: [PathSegment] = []

    for part in sourcePath.split(separator: ".") {
        let partStr = String(part)
        guard let bracketStart = partStr.firstIndex(of: "[") else {
            segments.append(.key(partStr))
            continue
        }

        let keyPortion = String(partStr[partStr.startIndex..<bracketStart])
        if !keyPortion.isEmpty {
            segments.append(.key(keyPortion))
        }

        // Extract all bracket indices like [0][1]
        var remaining = partStr[bracketStart...]
        while let openIdx = remaining.firstIndex(of: "["),
              let closeIdx = remaining.firstIndex(of: "]") {
            let idxStr = String(remaining[remaining.index(after: openIdx)..<closeIdx])
            if let idx = Int(idxStr) {
                segments.append(.index(idx))
            }
            remaining = remaining[remaining.index(after: closeIdx)...]
        }
    }

    return segments
}

/// Traverse a nested dictionary/array structure following parsed segments
private func traversePath(_ root: Any, segments: [PathSegment]) -> Any? {
    var current: Any = root

    for segment in segments {
        switch segment {
        case .key(let key):
            guard let dict = current as? [String: Any] else { return nil }
            guard let next = dict[key] else { return nil }
            current = next
        case .index(let idx):
            guard let arr = current as? [Any] else { return nil }
            guard idx >= 0, idx < arr.count else { return nil }
            current = arr[idx]
        }
    }

    return current
}

public final class DirectMapperProvider {
    public static let providerID = "direct"
    public static let pluginType = "field_mapper"

    public init() {}

    public func resolve(record: [String: Any], sourcePath: String, config: MapperConfig) throws -> Any {
        let trimmed = sourcePath.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            throw MapperError.invalidPath("empty path")
        }

        let segments = parseSegments(trimmed)
        guard !segments.isEmpty else {
            throw MapperError.invalidPath("no segments parsed from path")
        }

        if let value = traversePath(record, segments: segments) {
            return value
        }
        return NSNull()
    }

    public func supports(pathSyntax: String) -> Bool {
        return pathSyntax == "dot_notation" || pathSyntax == "direct" || pathSyntax == "bracket"
    }
}
