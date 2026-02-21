// ContentParserImpl.swift — ContentParser concept implementation

import Foundation

// MARK: - Types

public struct ContentParserRegisterFormatInput: Codable {
    public let formatId: String
    public let parserConfig: String

    public init(formatId: String, parserConfig: String) {
        self.formatId = formatId
        self.parserConfig = parserConfig
    }
}

public enum ContentParserRegisterFormatOutput: Codable {
    case ok(formatId: String)
    case alreadyExists(formatId: String)

    enum CodingKeys: String, CodingKey {
        case variant, formatId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(formatId: try container.decode(String.self, forKey: .formatId))
        case "alreadyExists":
            self = .alreadyExists(formatId: try container.decode(String.self, forKey: .formatId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let formatId):
            try container.encode("ok", forKey: .variant)
            try container.encode(formatId, forKey: .formatId)
        case .alreadyExists(let formatId):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(formatId, forKey: .formatId)
        }
    }
}

public struct ContentParserParseInput: Codable {
    public let content: String
    public let formatId: String

    public init(content: String, formatId: String) {
        self.content = content
        self.formatId = formatId
    }
}

public enum ContentParserParseOutput: Codable {
    case ok(ast: String, extractedMetadata: String)
    case unknownFormat(formatId: String)

    enum CodingKeys: String, CodingKey {
        case variant, ast, extractedMetadata, formatId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                ast: try container.decode(String.self, forKey: .ast),
                extractedMetadata: try container.decode(String.self, forKey: .extractedMetadata)
            )
        case "unknownFormat":
            self = .unknownFormat(formatId: try container.decode(String.self, forKey: .formatId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let ast, let extractedMetadata):
            try container.encode("ok", forKey: .variant)
            try container.encode(ast, forKey: .ast)
            try container.encode(extractedMetadata, forKey: .extractedMetadata)
        case .unknownFormat(let formatId):
            try container.encode("unknownFormat", forKey: .variant)
            try container.encode(formatId, forKey: .formatId)
        }
    }
}

public struct ContentParserExtractRefsInput: Codable {
    public let content: String
    public let formatId: String

    public init(content: String, formatId: String) {
        self.content = content
        self.formatId = formatId
    }
}

public enum ContentParserExtractRefsOutput: Codable {
    case ok(refs: String)

    enum CodingKeys: String, CodingKey {
        case variant, refs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(refs: try container.decode(String.self, forKey: .refs))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let refs):
            try container.encode("ok", forKey: .variant)
            try container.encode(refs, forKey: .refs)
        }
    }
}

public struct ContentParserExtractTagsInput: Codable {
    public let content: String
    public let formatId: String

    public init(content: String, formatId: String) {
        self.content = content
        self.formatId = formatId
    }
}

public enum ContentParserExtractTagsOutput: Codable {
    case ok(tags: String)

    enum CodingKeys: String, CodingKey {
        case variant, tags
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(tags: try container.decode(String.self, forKey: .tags))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tags):
            try container.encode("ok", forKey: .variant)
            try container.encode(tags, forKey: .tags)
        }
    }
}

// MARK: - Handler Protocol

public protocol ContentParserHandler {
    func registerFormat(input: ContentParserRegisterFormatInput, storage: ConceptStorage) async throws -> ContentParserRegisterFormatOutput
    func parse(input: ContentParserParseInput, storage: ConceptStorage) async throws -> ContentParserParseOutput
    func extractRefs(input: ContentParserExtractRefsInput, storage: ConceptStorage) async throws -> ContentParserExtractRefsOutput
    func extractTags(input: ContentParserExtractTagsInput, storage: ConceptStorage) async throws -> ContentParserExtractTagsOutput
}

// MARK: - Implementation

public struct ContentParserHandlerImpl: ContentParserHandler {
    public init() {}

    public func registerFormat(
        input: ContentParserRegisterFormatInput,
        storage: ConceptStorage
    ) async throws -> ContentParserRegisterFormatOutput {
        if let _ = try await storage.get(relation: "format", key: input.formatId) {
            return .alreadyExists(formatId: input.formatId)
        }
        try await storage.put(
            relation: "format",
            key: input.formatId,
            value: [
                "formatId": input.formatId,
                "parserConfig": input.parserConfig,
            ]
        )
        return .ok(formatId: input.formatId)
    }

    public func parse(
        input: ContentParserParseInput,
        storage: ConceptStorage
    ) async throws -> ContentParserParseOutput {
        guard let _ = try await storage.get(relation: "format", key: input.formatId) else {
            return .unknownFormat(formatId: input.formatId)
        }
        // Basic parsing: wrap content in a simple AST node representation
        let ast: [String: Any] = [
            "type": "document",
            "content": input.content,
            "format": input.formatId,
        ]
        var astStr = "{}"
        if let encoded = try? JSONSerialization.data(withJSONObject: ast),
           let str = String(data: encoded, encoding: .utf8) {
            astStr = str
        }
        // Extract basic metadata (content length, format)
        let metadata: [String: Any] = [
            "format": input.formatId,
            "length": input.content.count,
        ]
        var metaStr = "{}"
        if let encoded = try? JSONSerialization.data(withJSONObject: metadata),
           let str = String(data: encoded, encoding: .utf8) {
            metaStr = str
        }
        return .ok(ast: astStr, extractedMetadata: metaStr)
    }

    public func extractRefs(
        input: ContentParserExtractRefsInput,
        storage: ConceptStorage
    ) async throws -> ContentParserExtractRefsOutput {
        // Extract [[wiki-link]] style references from content
        var refs: [String] = []
        let pattern = "\\[\\[([^\\]]+)\\]\\]"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let range = NSRange(input.content.startIndex..., in: input.content)
            let matches = regex.matches(in: input.content, range: range)
            for match in matches {
                if let captureRange = Range(match.range(at: 1), in: input.content) {
                    refs.append(String(input.content[captureRange]))
                }
            }
        }
        if let encoded = try? JSONSerialization.data(withJSONObject: refs),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(refs: str)
        }
        return .ok(refs: "[]")
    }

    public func extractTags(
        input: ContentParserExtractTagsInput,
        storage: ConceptStorage
    ) async throws -> ContentParserExtractTagsOutput {
        // Extract #tag style tags from content
        var tags: [String] = []
        let pattern = "#([a-zA-Z0-9_-]+)"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let range = NSRange(input.content.startIndex..., in: input.content)
            let matches = regex.matches(in: input.content, range: range)
            for match in matches {
                if let captureRange = Range(match.range(at: 1), in: input.content) {
                    tags.append(String(input.content[captureRange]))
                }
            }
        }
        if let encoded = try? JSONSerialization.data(withJSONObject: tags),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(tags: str)
        }
        return .ok(tags: "[]")
    }
}
