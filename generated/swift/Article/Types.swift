// generated: Article/Types.swift

import Foundation

struct ArticleCreateInput: Codable {
    let article: String
    let title: String
    let description: String
    let body: String
    let author: String
}

enum ArticleCreateOutput: Codable {
    case ok(article: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                article: try container.decode(String.self, forKey: .article)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let article):
            try container.encode("ok", forKey: .variant)
            try container.encode(article, forKey: .article)
        }
    }
}

struct ArticleUpdateInput: Codable {
    let article: String
    let title: String
    let description: String
    let body: String
}

enum ArticleUpdateOutput: Codable {
    case ok(article: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
        case message
    }

    init(from decoder: Decoder) throws {
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
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

struct ArticleDeleteInput: Codable {
    let article: String
}

enum ArticleDeleteOutput: Codable {
    case ok(article: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case article
        case message
    }

    init(from decoder: Decoder) throws {
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
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

struct ArticleGetInput: Codable {
    let article: String
}

enum ArticleGetOutput: Codable {
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

    init(from decoder: Decoder) throws {
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
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
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

