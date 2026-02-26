// ArticleImpl.swift — Article concept implementation

import Foundation

// MARK: - Types (matching generated Article/Types.swift)

public struct ArticleCreateInput: Codable {
    public let article: String
    public let title: String
    public let description: String
    public let body: String
    public let author: String

    public init(article: String, title: String, description: String, body: String, author: String) {
        self.article = article
        self.title = title
        self.description = description
        self.body = body
        self.author = author
    }
}

public enum ArticleCreateOutput: Codable {
    case ok(article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                article: try container.decode(String.self, forKey: .article)
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
        case .ok(let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(article, forKey: .article)
        }
    }
}

public struct ArticleUpdateInput: Codable {
    public let article: String
    public let title: String
    public let description: String
    public let body: String

    public init(article: String, title: String, description: String, body: String) {
        self.article = article
        self.title = title
        self.description = description
        self.body = body
    }
}

public enum ArticleUpdateOutput: Codable {
    case ok(article: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                article: try container.decode(String.self, forKey: .article)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(article, forKey: .article)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ArticleDeleteInput: Codable {
    public let article: String

    public init(article: String) {
        self.article = article
    }
}

public enum ArticleDeleteOutput: Codable {
    case ok(article: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                article: try container.decode(String.self, forKey: .article)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(article, forKey: .article)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ArticleGetInput: Codable {
    public let article: String

    public init(article: String) {
        self.article = article
    }
}

public enum ArticleGetOutput: Codable {
    case ok(article: String, slug: String, title: String, description: String, body: String, author: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
        case slug
        case title
        case description
        case body
        case author
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                article: try container.decode(String.self, forKey: .article),
                slug: try container.decode(String.self, forKey: .slug),
                title: try container.decode(String.self, forKey: .title),
                description: try container.decode(String.self, forKey: .description),
                body: try container.decode(String.self, forKey: .body),
                author: try container.decode(String.self, forKey: .author)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
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
        case .ok(let article, let slug, let title, let description, let body, let author):
            try container.encode("ok", forKey: .variant)
            try container.encode(article, forKey: .article)
            try container.encode(slug, forKey: .slug)
            try container.encode(title, forKey: .title)
            try container.encode(description, forKey: .description)
            try container.encode(body, forKey: .body)
            try container.encode(author, forKey: .author)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated Article/Handler.swift)

public protocol ArticleHandler {
    func create(
        input: ArticleCreateInput,
        storage: ConceptStorage
    ) async throws -> ArticleCreateOutput

    func update(
        input: ArticleUpdateInput,
        storage: ConceptStorage
    ) async throws -> ArticleUpdateOutput

    func delete(
        input: ArticleDeleteInput,
        storage: ConceptStorage
    ) async throws -> ArticleDeleteOutput

    func get(
        input: ArticleGetInput,
        storage: ConceptStorage
    ) async throws -> ArticleGetOutput
}

// MARK: - Implementation

public struct ArticleHandlerImpl: ArticleHandler {
    public init() {}

    /// Slugify a title: lowercase, replace non-alphanumeric sequences with hyphens, trim
    private func slugify(_ title: String) -> String {
        let lowered = title.lowercased()
        var slug = ""
        var lastWasHyphen = true // Start true to avoid leading hyphen
        for char in lowered {
            if char.isLetter || char.isNumber {
                slug.append(char)
                lastWasHyphen = false
            } else if !lastWasHyphen {
                slug.append("-")
                lastWasHyphen = true
            }
        }
        // Remove trailing hyphen
        if slug.hasSuffix("-") {
            slug.removeLast()
        }
        return slug
    }

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func create(
        input: ArticleCreateInput,
        storage: ConceptStorage
    ) async throws -> ArticleCreateOutput {
        let slug = slugify(input.title)
        let now = iso8601Now()

        try await storage.put(
            relation: "article",
            key: input.article,
            value: [
                "id": input.article,
                "slug": slug,
                "title": input.title,
                "description": input.description,
                "body": input.body,
                "author": input.author,
                "createdAt": now,
                "updatedAt": now,
            ]
        )

        return .ok(article: input.article)
    }

    public func update(
        input: ArticleUpdateInput,
        storage: ConceptStorage
    ) async throws -> ArticleUpdateOutput {
        guard let existing = try await storage.get(relation: "article", key: input.article) else {
            return .notfound(message: "Article '\(input.article)' not found")
        }

        let slug = slugify(input.title)
        let now = iso8601Now()
        let createdAt = existing["createdAt"] as? String ?? now
        let author = existing["author"] as? String ?? ""

        try await storage.put(
            relation: "article",
            key: input.article,
            value: [
                "id": input.article,
                "slug": slug,
                "title": input.title,
                "description": input.description,
                "body": input.body,
                "author": author,
                "createdAt": createdAt,
                "updatedAt": now,
            ]
        )

        return .ok(article: input.article)
    }

    public func delete(
        input: ArticleDeleteInput,
        storage: ConceptStorage
    ) async throws -> ArticleDeleteOutput {
        guard try await storage.get(relation: "article", key: input.article) != nil else {
            return .notfound(message: "Article '\(input.article)' not found")
        }

        try await storage.del(relation: "article", key: input.article)
        return .ok(article: input.article)
    }

    public func get(
        input: ArticleGetInput,
        storage: ConceptStorage
    ) async throws -> ArticleGetOutput {
        guard let record = try await storage.get(relation: "article", key: input.article) else {
            return .notfound(message: "Article '\(input.article)' not found")
        }

        let slug = record["slug"] as? String ?? ""
        let title = record["title"] as? String ?? ""
        let description = record["description"] as? String ?? ""
        let body = record["body"] as? String ?? ""
        let author = record["author"] as? String ?? ""

        return .ok(
            article: input.article,
            slug: slug,
            title: title,
            description: description,
            body: body,
            author: author
        )
    }
}
