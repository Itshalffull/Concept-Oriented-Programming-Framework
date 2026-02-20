// CommentImpl.swift — Comment concept implementation

import Foundation

// MARK: - Types (matching generated Comment/Types.swift)

public struct CommentCreateInput: Codable {
    public let comment: String
    public let body: String
    public let target: String
    public let author: String

    public init(comment: String, body: String, target: String, author: String) {
        self.comment = comment
        self.body = body
        self.target = target
        self.author = author
    }
}

public enum CommentCreateOutput: Codable {
    case ok(comment: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comment
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                comment: try container.decode(String.self, forKey: .comment)
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
        case .ok(let comment):
            try container.encode("ok", forKey: .variant)
            try container.encode(comment, forKey: .comment)
        }
    }
}

public struct CommentDeleteInput: Codable {
    public let comment: String

    public init(comment: String) {
        self.comment = comment
    }
}

public enum CommentDeleteOutput: Codable {
    case ok(comment: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comment
        case message
    }

    public init(from decoder: Decoder) throws {
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
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
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

public struct CommentListInput: Codable {
    public let target: String

    public init(target: String) {
        self.target = target
    }
}

public enum CommentListOutput: Codable {
    case ok(comments: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case comments
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                comments: try container.decode(String.self, forKey: .comments)
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
        case .ok(let comments):
            try container.encode("ok", forKey: .variant)
            try container.encode(comments, forKey: .comments)
        }
    }
}

// MARK: - Handler Protocol (matching generated Comment/Handler.swift)

public protocol CommentHandler {
    func create(
        input: CommentCreateInput,
        storage: ConceptStorage
    ) async throws -> CommentCreateOutput

    func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput

    func list(
        input: CommentListInput,
        storage: ConceptStorage
    ) async throws -> CommentListOutput
}

// MARK: - Implementation

public struct CommentHandlerImpl: CommentHandler {
    public init() {}

    public func create(
        input: CommentCreateInput,
        storage: ConceptStorage
    ) async throws -> CommentCreateOutput {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        try await storage.put(
            relation: "comment",
            key: input.comment,
            value: [
                "id": input.comment,
                "body": input.body,
                "target": input.target,
                "author": input.author,
                "createdAt": now,
            ]
        )

        return .ok(comment: input.comment)
    }

    public func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput {
        guard try await storage.get(relation: "comment", key: input.comment) != nil else {
            return .notfound(message: "Comment '\(input.comment)' not found")
        }

        try await storage.del(relation: "comment", key: input.comment)
        return .ok(comment: input.comment)
    }

    public func list(
        input: CommentListInput,
        storage: ConceptStorage
    ) async throws -> CommentListOutput {
        let entries = try await storage.find(
            relation: "comment",
            criteria: ["target": input.target]
        )

        // Serialize as JSON string — array of objects with id, body, author, createdAt
        let commentDicts: [[String: String]] = entries.map { entry in
            var dict: [String: String] = [:]
            dict["id"] = entry["id"] as? String ?? ""
            dict["body"] = entry["body"] as? String ?? ""
            dict["author"] = entry["author"] as? String ?? ""
            dict["createdAt"] = entry["createdAt"] as? String ?? ""
            return dict
        }

        let jsonData = try JSONSerialization.data(withJSONObject: commentDicts, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(comments: jsonString)
    }
}
