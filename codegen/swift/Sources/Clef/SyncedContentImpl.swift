// SyncedContentImpl.swift — SyncedContent concept implementation

import Foundation

// MARK: - Types

public struct SyncedContentCreateReferenceInput: Codable {
    public let sourceId: String
    public let targetLocation: String

    public init(sourceId: String, targetLocation: String) {
        self.sourceId = sourceId
        self.targetLocation = targetLocation
    }
}

public enum SyncedContentCreateReferenceOutput: Codable {
    case ok(refId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case refId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(refId: try container.decode(String.self, forKey: .refId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let refId):
            try container.encode("ok", forKey: .variant)
            try container.encode(refId, forKey: .refId)
        }
    }
}

public struct SyncedContentEditOriginalInput: Codable {
    public let refId: String
    public let newContent: String

    public init(refId: String, newContent: String) {
        self.refId = refId
        self.newContent = newContent
    }
}

public enum SyncedContentEditOriginalOutput: Codable {
    case ok(refId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case refId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(refId: try container.decode(String.self, forKey: .refId))
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
        case .ok(let refId):
            try container.encode("ok", forKey: .variant)
            try container.encode(refId, forKey: .refId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncedContentDeleteReferenceInput: Codable {
    public let refId: String

    public init(refId: String) {
        self.refId = refId
    }
}

public enum SyncedContentDeleteReferenceOutput: Codable {
    case ok(refId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case refId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(refId: try container.decode(String.self, forKey: .refId))
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
        case .ok(let refId):
            try container.encode("ok", forKey: .variant)
            try container.encode(refId, forKey: .refId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SyncedContentConvertToIndependentInput: Codable {
    public let refId: String

    public init(refId: String) {
        self.refId = refId
    }
}

public enum SyncedContentConvertToIndependentOutput: Codable {
    case ok(newNodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case newNodeId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(newNodeId: try container.decode(String.self, forKey: .newNodeId))
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
        case .ok(let newNodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(newNodeId, forKey: .newNodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol SyncedContentHandler {
    func createReference(input: SyncedContentCreateReferenceInput, storage: ConceptStorage) async throws -> SyncedContentCreateReferenceOutput
    func editOriginal(input: SyncedContentEditOriginalInput, storage: ConceptStorage) async throws -> SyncedContentEditOriginalOutput
    func deleteReference(input: SyncedContentDeleteReferenceInput, storage: ConceptStorage) async throws -> SyncedContentDeleteReferenceOutput
    func convertToIndependent(input: SyncedContentConvertToIndependentInput, storage: ConceptStorage) async throws -> SyncedContentConvertToIndependentOutput
}

// MARK: - Implementation

public struct SyncedContentHandlerImpl: SyncedContentHandler {
    public init() {}

    public func createReference(
        input: SyncedContentCreateReferenceInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentCreateReferenceOutput {
        let refId = UUID().uuidString

        // Store the original content reference
        try await storage.put(
            relation: "synced_original",
            key: input.sourceId,
            value: [
                "sourceId": input.sourceId,
                "content": "",
            ]
        )

        // Store the synced reference
        try await storage.put(
            relation: "synced_reference",
            key: refId,
            value: [
                "refId": refId,
                "sourceId": input.sourceId,
                "targetLocation": input.targetLocation,
                "synced": true,
            ]
        )

        return .ok(refId: refId)
    }

    public func editOriginal(
        input: SyncedContentEditOriginalInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentEditOriginalOutput {
        guard let ref = try await storage.get(relation: "synced_reference", key: input.refId) else {
            return .notfound(message: "Reference '\(input.refId)' not found")
        }

        let sourceId = ref["sourceId"] as? String ?? ""

        // Update the original content
        try await storage.put(
            relation: "synced_original",
            key: sourceId,
            value: [
                "sourceId": sourceId,
                "content": input.newContent,
            ]
        )

        return .ok(refId: input.refId)
    }

    public func deleteReference(
        input: SyncedContentDeleteReferenceInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentDeleteReferenceOutput {
        guard try await storage.get(relation: "synced_reference", key: input.refId) != nil else {
            return .notfound(message: "Reference '\(input.refId)' not found")
        }

        try await storage.del(relation: "synced_reference", key: input.refId)
        return .ok(refId: input.refId)
    }

    public func convertToIndependent(
        input: SyncedContentConvertToIndependentInput,
        storage: ConceptStorage
    ) async throws -> SyncedContentConvertToIndependentOutput {
        guard let ref = try await storage.get(relation: "synced_reference", key: input.refId) else {
            return .notfound(message: "Reference '\(input.refId)' not found")
        }

        let sourceId = ref["sourceId"] as? String ?? ""
        let newNodeId = UUID().uuidString

        // Get the original content
        let original = try await storage.get(relation: "synced_original", key: sourceId)
        let content = original?["content"] as? String ?? ""

        // Remove the synced reference
        try await storage.del(relation: "synced_reference", key: input.refId)

        // Store as independent content (reuse synced_original with new ID)
        try await storage.put(
            relation: "synced_original",
            key: newNodeId,
            value: [
                "sourceId": newNodeId,
                "content": content,
                "independent": true,
            ]
        )

        return .ok(newNodeId: newNodeId)
    }
}
