// generated: Favorite/Types.swift

import Foundation

struct FavoriteFavoriteInput: Codable {
    let user: String
    let article: String
}

enum FavoriteFavoriteOutput: Codable {
    case ok(user: String, article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case article
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                article: try container.decode(String.self, forKey: .article)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let user, let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(article, forKey: .article)
        }
    }
}

struct FavoriteUnfavoriteInput: Codable {
    let user: String
    let article: String
}

enum FavoriteUnfavoriteOutput: Codable {
    case ok(user: String, article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case user
        case article
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                user: try container.decode(String.self, forKey: .user),
                article: try container.decode(String.self, forKey: .article)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let user, let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(user, forKey: .user)
            try container.encode(article, forKey: .article)
        }
    }
}

struct FavoriteIsFavoritedInput: Codable {
    let user: String
    let article: String
}

enum FavoriteIsFavoritedOutput: Codable {
    case ok(favorited: Bool)

    enum CodingKeys: String, CodingKey {
        case variant
        case favorited
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                favorited: try container.decode(Bool.self, forKey: .favorited)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let favorited):
            try container.encode("ok", forKey: .variant)
            try container.encode(favorited, forKey: .favorited)
        }
    }
}

struct FavoriteCountInput: Codable {
    let article: String
}

enum FavoriteCountOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant
        case count
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                count: try container.decode(Int.self, forKey: .count)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        }
    }
}

