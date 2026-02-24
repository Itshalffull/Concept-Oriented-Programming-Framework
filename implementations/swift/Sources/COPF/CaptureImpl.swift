// CaptureImpl.swift — Capture concept implementation

import Foundation

// MARK: - Types

public struct CaptureClipInput: Codable {
    public let url: String
    public let mode: String
    public let metadata: String

    public init(url: String, mode: String, metadata: String) {
        self.url = url
        self.mode = mode
        self.metadata = metadata
    }
}

public enum CaptureClipOutput: Codable {
    case ok(itemId: String, content: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId, content, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                itemId: try container.decode(String.self, forKey: .itemId),
                content: try container.decode(String.self, forKey: .content)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let itemId, let content):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
            try container.encode(content, forKey: .content)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CaptureImportFileInput: Codable {
    public let file: String
    public let options: String

    public init(file: String, options: String) {
        self.file = file
        self.options = options
    }
}

public enum CaptureImportFileOutput: Codable {
    case ok(itemId: String, content: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, itemId, content, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                itemId: try container.decode(String.self, forKey: .itemId),
                content: try container.decode(String.self, forKey: .content)
            )
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let itemId, let content):
            try container.encode("ok", forKey: .variant)
            try container.encode(itemId, forKey: .itemId)
            try container.encode(content, forKey: .content)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CaptureSubscribeInput: Codable {
    public let sourceId: String
    public let schedule: String
    public let mode: String

    public init(sourceId: String, schedule: String, mode: String) {
        self.sourceId = sourceId
        self.schedule = schedule
        self.mode = mode
    }
}

public enum CaptureSubscribeOutput: Codable {
    case ok(subscriptionId: String)

    enum CodingKeys: String, CodingKey {
        case variant, subscriptionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(subscriptionId: try container.decode(String.self, forKey: .subscriptionId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let subscriptionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(subscriptionId, forKey: .subscriptionId)
        }
    }
}

public struct CaptureDetectChangesInput: Codable {
    public let subscriptionId: String

    public init(subscriptionId: String) {
        self.subscriptionId = subscriptionId
    }
}

public enum CaptureDetectChangesOutput: Codable {
    case ok(changeset: String)
    case notfound(message: String)
    case empty

    enum CodingKeys: String, CodingKey {
        case variant, changeset, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(changeset: try container.decode(String.self, forKey: .changeset))
        case "notfound":
            self = .notfound(message: try container.decode(String.self, forKey: .message))
        case "empty":
            self = .empty
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let changeset):
            try container.encode("ok", forKey: .variant)
            try container.encode(changeset, forKey: .changeset)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .empty:
            try container.encode("empty", forKey: .variant)
        }
    }
}

public struct CaptureMarkReadyInput: Codable {
    public let itemId: String

    public init(itemId: String) {
        self.itemId = itemId
    }
}

public enum CaptureMarkReadyOutput: Codable {
    case ok
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol CaptureHandler {
    func clip(input: CaptureClipInput, storage: ConceptStorage) async throws -> CaptureClipOutput
    func importFile(input: CaptureImportFileInput, storage: ConceptStorage) async throws -> CaptureImportFileOutput
    func subscribe(input: CaptureSubscribeInput, storage: ConceptStorage) async throws -> CaptureSubscribeOutput
    func detectChanges(input: CaptureDetectChangesInput, storage: ConceptStorage) async throws -> CaptureDetectChangesOutput
    func markReady(input: CaptureMarkReadyInput, storage: ConceptStorage) async throws -> CaptureMarkReadyOutput
}

// MARK: - Implementation

public struct CaptureHandlerImpl: CaptureHandler {
    public init() {}

    public func clip(
        input: CaptureClipInput,
        storage: ConceptStorage
    ) async throws -> CaptureClipOutput {
        let itemId = UUID().uuidString
        let content = "Clipped content from \(input.url)"
        try await storage.put(
            relation: "captured_items",
            key: itemId,
            value: [
                "itemId": itemId,
                "url": input.url,
                "mode": input.mode,
                "metadata": input.metadata,
                "content": content,
                "status": "draft",
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(itemId: itemId, content: content)
    }

    public func importFile(
        input: CaptureImportFileInput,
        storage: ConceptStorage
    ) async throws -> CaptureImportFileOutput {
        let itemId = UUID().uuidString
        let content = "Imported content from \(input.file)"
        try await storage.put(
            relation: "captured_items",
            key: itemId,
            value: [
                "itemId": itemId,
                "file": input.file,
                "options": input.options,
                "content": content,
                "status": "draft",
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(itemId: itemId, content: content)
    }

    public func subscribe(
        input: CaptureSubscribeInput,
        storage: ConceptStorage
    ) async throws -> CaptureSubscribeOutput {
        let subscriptionId = UUID().uuidString
        try await storage.put(
            relation: "capture_subscriptions",
            key: subscriptionId,
            value: [
                "subscriptionId": subscriptionId,
                "sourceId": input.sourceId,
                "schedule": input.schedule,
                "mode": input.mode,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(subscriptionId: subscriptionId)
    }

    public func detectChanges(
        input: CaptureDetectChangesInput,
        storage: ConceptStorage
    ) async throws -> CaptureDetectChangesOutput {
        guard let _ = try await storage.get(relation: "capture_subscriptions", key: input.subscriptionId) else {
            return .notfound(message: "Subscription '\(input.subscriptionId)' not found")
        }
        return .empty
    }

    public func markReady(
        input: CaptureMarkReadyInput,
        storage: ConceptStorage
    ) async throws -> CaptureMarkReadyOutput {
        guard var record = try await storage.get(relation: "captured_items", key: input.itemId) else {
            return .notfound(message: "Captured item '\(input.itemId)' not found")
        }
        record["status"] = "ready"
        try await storage.put(relation: "captured_items", key: input.itemId, value: record)
        return .ok
    }
}
