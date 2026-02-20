// TagImpl.swift — Tag concept implementation

import Foundation

// MARK: - Types (matching generated Tag/Types.swift)

public struct TagAddInput: Codable {
    public let tag: String
    public let article: String

    public init(tag: String, article: String) {
        self.tag = tag
        self.article = article
    }
}

public enum TagAddOutput: Codable {
    case ok(tag: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tag
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tag: try container.decode(String.self, forKey: .tag)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tag):
            try container.encode("ok", forKey: .variant)
            try container.encode(tag, forKey: .tag)
        }
    }
}

public struct TagRemoveInput: Codable {
    public let tag: String
    public let article: String

    public init(tag: String, article: String) {
        self.tag = tag
        self.article = article
    }
}

public enum TagRemoveOutput: Codable {
    case ok(tag: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tag
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tag: try container.decode(String.self, forKey: .tag)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tag):
            try container.encode("ok", forKey: .variant)
            try container.encode(tag, forKey: .tag)
        }
    }
}

public struct TagListInput: Codable {
    public init() {}
}

public enum TagListOutput: Codable {
    case ok(tags: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case tags
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tags: try container.decode(String.self, forKey: .tags)
            )
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

// MARK: - Handler Protocol (matching generated Tag/Handler.swift)

public protocol TagHandler {
    func add(
        input: TagAddInput,
        storage: ConceptStorage
    ) async throws -> TagAddOutput

    func remove(
        input: TagRemoveInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveOutput

    func list(
        input: TagListInput,
        storage: ConceptStorage
    ) async throws -> TagListOutput
}

// MARK: - Implementation

public struct TagHandlerImpl: TagHandler {
    public init() {}

    public func add(
        input: TagAddInput,
        storage: ConceptStorage
    ) async throws -> TagAddOutput {
        // Get existing tag record (stores list of articles for this tag)
        let existing = try await storage.get(relation: "tag", key: input.tag)
        var articles: [String]
        if let existingRecord = existing, let existingArticles = existingRecord["articles"] as? [String] {
            articles = existingArticles
        } else {
            articles = []
        }

        // Append if not present
        if !articles.contains(input.article) {
            articles.append(input.article)
        }

        try await storage.put(
            relation: "tag",
            key: input.tag,
            value: [
                "name": input.tag,
                "articles": articles,
            ]
        )

        return .ok(tag: input.tag)
    }

    public func remove(
        input: TagRemoveInput,
        storage: ConceptStorage
    ) async throws -> TagRemoveOutput {
        let existing = try await storage.get(relation: "tag", key: input.tag)
        var articles: [String]
        if let existingRecord = existing, let existingArticles = existingRecord["articles"] as? [String] {
            articles = existingArticles
        } else {
            articles = []
        }

        // Filter out the article
        articles = articles.filter { $0 != input.article }

        try await storage.put(
            relation: "tag",
            key: input.tag,
            value: [
                "name": input.tag,
                "articles": articles,
            ]
        )

        return .ok(tag: input.tag)
    }

    public func list(
        input: TagListInput,
        storage: ConceptStorage
    ) async throws -> TagListOutput {
        let allTags = try await storage.find(relation: "tag", criteria: nil)
        let tagNames = allTags.compactMap { $0["name"] as? String }

        let jsonData = try JSONSerialization.data(withJSONObject: tagNames, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(tags: jsonString)
    }
}
