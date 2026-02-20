// FavoriteImpl.swift — Favorite concept implementation

import Foundation

// MARK: - Types (matching generated Favorite/Types.swift)

public struct FavoriteFavoriteInput: Codable {
    public let user: String
    public let article: String

    public init(user: String, article: String) {
        self.user = user
        self.article = article
    }
}

public enum FavoriteFavoriteOutput: Codable {
    case ok(user: String, article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case article
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
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
        case .ok(let user, let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(article, forKey: .article)
        }
    }
}

public struct FavoriteUnfavoriteInput: Codable {
    public let user: String
    public let article: String

    public init(user: String, article: String) {
        self.user = user
        self.article = article
    }
}

public enum FavoriteUnfavoriteOutput: Codable {
    case ok(user: String, article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case article
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
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
        case .ok(let user, let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(article, forKey: .article)
        }
    }
}

public struct FavoriteIsFavoritedInput: Codable {
    public let user: String
    public let article: String

    public init(user: String, article: String) {
        self.user = user
        self.article = article
    }
}

public enum FavoriteIsFavoritedOutput: Codable {
    case ok(favorited: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case favorited
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                favorited: try container.decode(Bool.self, forKey: .favorited)
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
        case .ok(let favorited):
            try container.encode("ok", forKey: .variant)
            try container.encode(favorited, forKey: .favorited)
        }
    }
}

public struct FavoriteCountInput: Codable {
    public let article: String

    public init(article: String) {
        self.article = article
    }
}

public enum FavoriteCountOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                count: try container.decode(Int.self, forKey: .count)
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
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        }
    }
}

// MARK: - Handler Protocol (matching generated Favorite/Handler.swift)

public protocol FavoriteHandler {
    func favorite(
        input: FavoriteFavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteFavoriteOutput

    func unfavorite(
        input: FavoriteUnfavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteUnfavoriteOutput

    func isFavorited(
        input: FavoriteIsFavoritedInput,
        storage: ConceptStorage
    ) async throws -> FavoriteIsFavoritedOutput

    func count(
        input: FavoriteCountInput,
        storage: ConceptStorage
    ) async throws -> FavoriteCountOutput
}

// MARK: - Implementation

public struct FavoriteHandlerImpl: FavoriteHandler {
    public init() {}

    public func favorite(
        input: FavoriteFavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteFavoriteOutput {
        // Get user's favorites list
        let existing = try await storage.get(relation: "favorite", key: input.user)
        var articles: [String]
        if let existingRecord = existing, let existingArticles = existingRecord["articles"] as? [String] {
            articles = existingArticles
        } else {
            articles = []
        }

        // Add article if not already present
        if !articles.contains(input.article) {
            articles.append(input.article)
        }

        try await storage.put(
            relation: "favorite",
            key: input.user,
            value: [
                "user": input.user,
                "articles": articles,
            ]
        )

        return .ok(user: input.user, article: input.article)
    }

    public func unfavorite(
        input: FavoriteUnfavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteUnfavoriteOutput {
        let existing = try await storage.get(relation: "favorite", key: input.user)
        var articles: [String]
        if let existingRecord = existing, let existingArticles = existingRecord["articles"] as? [String] {
            articles = existingArticles
        } else {
            articles = []
        }

        // Remove article from favorites
        articles = articles.filter { $0 != input.article }

        try await storage.put(
            relation: "favorite",
            key: input.user,
            value: [
                "user": input.user,
                "articles": articles,
            ]
        )

        return .ok(user: input.user, article: input.article)
    }

    public func isFavorited(
        input: FavoriteIsFavoritedInput,
        storage: ConceptStorage
    ) async throws -> FavoriteIsFavoritedOutput {
        let existing = try await storage.get(relation: "favorite", key: input.user)
        if let existingRecord = existing, let existingArticles = existingRecord["articles"] as? [String] {
            return .ok(favorited: existingArticles.contains(input.article))
        }
        return .ok(favorited: false)
    }

    public func count(
        input: FavoriteCountInput,
        storage: ConceptStorage
    ) async throws -> FavoriteCountOutput {
        // Scan all user favorite records and count how many contain this article
        let allFavorites = try await storage.find(relation: "favorite", criteria: nil)
        var count = 0
        for record in allFavorites {
            if let articles = record["articles"] as? [String], articles.contains(input.article) {
                count += 1
            }
        }
        return .ok(count: count)
    }
}
