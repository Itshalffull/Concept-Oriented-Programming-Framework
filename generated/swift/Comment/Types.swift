// generated: Comment/Types.swift

import Foundation

struct CommentCreateInput: Codable {
    let comment: String
    let body: String
    let target: String
    let author: String
}

enum CommentCreateOutput: Codable {
    case ok(comment: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comment
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                comment: try container.decode(String.self, forKey: .comment)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let comment):
            try container.encode("ok", forKey: .variant)
            try container.encode(comment, forKey: .comment)
        }
    }
}

struct CommentDeleteInput: Codable {
    let comment: String
}

enum CommentDeleteOutput: Codable {
    case ok(comment: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comment
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                comment: try container.decode(String.self, forKey: .comment)
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
        case .ok(let comment):
            try container.encode("ok", forKey: .variant)
            try container.encode(comment, forKey: .comment)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct CommentListInput: Codable {
    let target: String
}

enum CommentListOutput: Codable {
    case ok(comments: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comments
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                comments: try container.decode(String.self, forKey: .comments)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let comments):
            try container.encode("ok", forKey: .variant)
            try container.encode(comments, forKey: .comments)
        }
    }
}

