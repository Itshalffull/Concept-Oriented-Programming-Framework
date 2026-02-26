// ThreadedCommentImpl.swift — ThreadedComment concept implementation

import Foundation

// MARK: - Types

public struct ThreadedCommentAddCommentInput: Codable {
    public let hostNodeId: String
    public let content: String
    public let author: String

    public init(hostNodeId: String, content: String, author: String) {
        self.hostNodeId = hostNodeId
        self.content = content
        self.author = author
    }
}

public enum ThreadedCommentAddCommentOutput: Codable {
    case ok(commentId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case commentId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(commentId: try container.decode(String.self, forKey: .commentId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let commentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(commentId, forKey: .commentId)
        }
    }
}

public struct ThreadedCommentReplyInput: Codable {
    public let parentCommentId: String
    public let content: String
    public let author: String

    public init(parentCommentId: String, content: String, author: String) {
        self.parentCommentId = parentCommentId
        self.content = content
        self.author = author
    }
}

public enum ThreadedCommentReplyOutput: Codable {
    case ok(commentId: String)
    case parentNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case commentId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(commentId: try container.decode(String.self, forKey: .commentId))
        case "parentNotfound":
            self = .parentNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let commentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(commentId, forKey: .commentId)
        case .parentNotfound(let message):
            try container.encode("parentNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ThreadedCommentPublishInput: Codable {
    public let commentId: String

    public init(commentId: String) {
        self.commentId = commentId
    }
}

public enum ThreadedCommentPublishOutput: Codable {
    case ok(commentId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case commentId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(commentId: try container.decode(String.self, forKey: .commentId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let commentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(commentId, forKey: .commentId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ThreadedCommentUnpublishInput: Codable {
    public let commentId: String

    public init(commentId: String) {
        self.commentId = commentId
    }
}

public enum ThreadedCommentUnpublishOutput: Codable {
    case ok(commentId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case commentId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(commentId: try container.decode(String.self, forKey: .commentId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let commentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(commentId, forKey: .commentId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ThreadedCommentDeleteCommentInput: Codable {
    public let commentId: String

    public init(commentId: String) {
        self.commentId = commentId
    }
}

public enum ThreadedCommentDeleteCommentOutput: Codable {
    case ok(commentId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case commentId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(commentId: try container.decode(String.self, forKey: .commentId))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let commentId):
            try container.encode("ok", forKey: .variant)
            try container.encode(commentId, forKey: .commentId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ThreadedCommentHandler {
    func addComment(input: ThreadedCommentAddCommentInput, storage: ConceptStorage) async throws -> ThreadedCommentAddCommentOutput
    func reply(input: ThreadedCommentReplyInput, storage: ConceptStorage) async throws -> ThreadedCommentReplyOutput
    func publish(input: ThreadedCommentPublishInput, storage: ConceptStorage) async throws -> ThreadedCommentPublishOutput
    func unpublish(input: ThreadedCommentUnpublishInput, storage: ConceptStorage) async throws -> ThreadedCommentUnpublishOutput
    func deleteComment(input: ThreadedCommentDeleteCommentInput, storage: ConceptStorage) async throws -> ThreadedCommentDeleteCommentOutput
}

// MARK: - Implementation

public struct ThreadedCommentHandlerImpl: ThreadedCommentHandler {
    public init() {}

    public func addComment(
        input: ThreadedCommentAddCommentInput,
        storage: ConceptStorage
    ) async throws -> ThreadedCommentAddCommentOutput {
        let commentId = UUID().uuidString
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        try await storage.put(
            relation: "threaded_comment",
            key: commentId,
            value: [
                "id": commentId,
                "hostNodeId": input.hostNodeId,
                "parentCommentId": "",
                "content": input.content,
                "author": input.author,
                "published": false,
                "createdAt": now,
            ]
        )

        return .ok(commentId: commentId)
    }

    public func reply(
        input: ThreadedCommentReplyInput,
        storage: ConceptStorage
    ) async throws -> ThreadedCommentReplyOutput {
        guard let parent = try await storage.get(relation: "threaded_comment", key: input.parentCommentId) else {
            return .parentNotfound(message: "Parent comment '\(input.parentCommentId)' not found")
        }

        let commentId = UUID().uuidString
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())
        let hostNodeId = parent["hostNodeId"] as? String ?? ""

        try await storage.put(
            relation: "threaded_comment",
            key: commentId,
            value: [
                "id": commentId,
                "hostNodeId": hostNodeId,
                "parentCommentId": input.parentCommentId,
                "content": input.content,
                "author": input.author,
                "published": false,
                "createdAt": now,
            ]
        )

        return .ok(commentId: commentId)
    }

    public func publish(
        input: ThreadedCommentPublishInput,
        storage: ConceptStorage
    ) async throws -> ThreadedCommentPublishOutput {
        guard let existing = try await storage.get(relation: "threaded_comment", key: input.commentId) else {
            return .notfound(message: "Comment '\(input.commentId)' not found")
        }

        var updated = existing
        updated["published"] = true
        try await storage.put(relation: "threaded_comment", key: input.commentId, value: updated)

        return .ok(commentId: input.commentId)
    }

    public func unpublish(
        input: ThreadedCommentUnpublishInput,
        storage: ConceptStorage
    ) async throws -> ThreadedCommentUnpublishOutput {
        guard let existing = try await storage.get(relation: "threaded_comment", key: input.commentId) else {
            return .notfound(message: "Comment '\(input.commentId)' not found")
        }

        var updated = existing
        updated["published"] = false
        try await storage.put(relation: "threaded_comment", key: input.commentId, value: updated)

        return .ok(commentId: input.commentId)
    }

    public func deleteComment(
        input: ThreadedCommentDeleteCommentInput,
        storage: ConceptStorage
    ) async throws -> ThreadedCommentDeleteCommentOutput {
        guard try await storage.get(relation: "threaded_comment", key: input.commentId) != nil else {
            return .notfound(message: "Comment '\(input.commentId)' not found")
        }

        try await storage.del(relation: "threaded_comment", key: input.commentId)
        return .ok(commentId: input.commentId)
    }
}
