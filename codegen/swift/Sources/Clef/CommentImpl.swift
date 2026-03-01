// CommentImpl.swift — Comment concept implementation

import Foundation

// MARK: - Types (matching generated Comment/Types.swift)

public struct CommentAddCommentInput: Codable {
    public let comment: String
    public let entity: String
    public let content: String
    public let author: String

    public init(comment: String, entity: String, content: String, author: String) {
        self.comment = comment
        self.entity = entity
        self.content = content
        self.author = author
    }
}

public enum CommentAddCommentOutput: Codable {
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

public struct CommentReplyInput: Codable {
    public let comment: String
    public let parent: String
    public let content: String
    public let author: String

    public init(comment: String, parent: String, content: String, author: String) {
        self.comment = comment
        self.parent = parent
        self.content = content
        self.author = author
    }
}

public enum CommentReplyOutput: Codable {
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

public struct CommentPublishInput: Codable {
    public let comment: String

    public init(comment: String) {
        self.comment = comment
    }
}

public enum CommentPublishOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CommentUnpublishInput: Codable {
    public let comment: String

    public init(comment: String) {
        self.comment = comment
    }
}

public enum CommentUnpublishOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
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
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol (matching generated Comment/Handler.swift)

public protocol CommentHandler {
    func addComment(
        input: CommentAddCommentInput,
        storage: ConceptStorage
    ) async throws -> CommentAddCommentOutput

    func reply(
        input: CommentReplyInput,
        storage: ConceptStorage
    ) async throws -> CommentReplyOutput

    func publish(
        input: CommentPublishInput,
        storage: ConceptStorage
    ) async throws -> CommentPublishOutput

    func unpublish(
        input: CommentUnpublishInput,
        storage: ConceptStorage
    ) async throws -> CommentUnpublishOutput

    func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput
}

// MARK: - Implementation

public struct CommentHandlerImpl: CommentHandler {
    public init() {}

    public func addComment(
        input: CommentAddCommentInput,
        storage: ConceptStorage
    ) async throws -> CommentAddCommentOutput {
        let threadPath = "/\(input.comment)"

        try await storage.put(
            relation: "comment",
            key: input.comment,
            value: [
                "id": input.comment,
                "entity": input.entity,
                "content": input.content,
                "author": input.author,
                "parent": "",
                "threadPath": threadPath,
                "published": false,
            ]
        )

        return .ok(comment: input.comment)
    }

    public func reply(
        input: CommentReplyInput,
        storage: ConceptStorage
    ) async throws -> CommentReplyOutput {
        let parentRecord = try await storage.get(relation: "comment", key: input.parent)
        let parentThreadPath = (parentRecord?["threadPath"] as? String) ?? "/\(input.parent)"
        let threadPath = "\(parentThreadPath)/\(input.comment)"
        let entity = (parentRecord?["entity"] as? String) ?? ""

        try await storage.put(
            relation: "comment",
            key: input.comment,
            value: [
                "id": input.comment,
                "entity": entity,
                "content": input.content,
                "author": input.author,
                "parent": input.parent,
                "threadPath": threadPath,
                "published": false,
            ]
        )

        return .ok(comment: input.comment)
    }

    public func publish(
        input: CommentPublishInput,
        storage: ConceptStorage
    ) async throws -> CommentPublishOutput {
        guard var record = try await storage.get(relation: "comment", key: input.comment) else {
            return .notfound(message: "Comment '\(input.comment)' not found")
        }

        record["published"] = true

        try await storage.put(
            relation: "comment",
            key: input.comment,
            value: record
        )

        return .ok
    }

    public func unpublish(
        input: CommentUnpublishInput,
        storage: ConceptStorage
    ) async throws -> CommentUnpublishOutput {
        guard var record = try await storage.get(relation: "comment", key: input.comment) else {
            return .notfound(message: "Comment '\(input.comment)' not found")
        }

        record["published"] = false

        try await storage.put(
            relation: "comment",
            key: input.comment,
            value: record
        )

        return .ok
    }

    public func delete(
        input: CommentDeleteInput,
        storage: ConceptStorage
    ) async throws -> CommentDeleteOutput {
        guard try await storage.get(relation: "comment", key: input.comment) != nil else {
            return .notfound(message: "Comment '\(input.comment)' not found")
        }

        try await storage.del(relation: "comment", key: input.comment)
        return .ok
    }
}
