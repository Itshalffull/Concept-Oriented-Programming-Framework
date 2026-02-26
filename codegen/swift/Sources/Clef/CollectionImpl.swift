// CollectionImpl.swift — Collection concept implementation

import Foundation

// MARK: - Types

public struct CollectionCreateInput: Codable {
    public let name: String
    public let collectionType: String
    public let schemaId: String?

    public init(name: String, collectionType: String, schemaId: String? = nil) {
        self.name = name
        self.collectionType = collectionType
        self.schemaId = schemaId
    }
}

public enum CollectionCreateOutput: Codable {
    case ok(collectionId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case collectionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(collectionId: try container.decode(String.self, forKey: .collectionId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let collectionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(collectionId, forKey: .collectionId)
        }
    }
}

public struct CollectionAddMemberInput: Codable {
    public let collectionId: String
    public let nodeId: String

    public init(collectionId: String, nodeId: String) {
        self.collectionId = collectionId
        self.nodeId = nodeId
    }
}

public enum CollectionAddMemberOutput: Codable {
    case ok(collectionId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case collectionId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(collectionId: try container.decode(String.self, forKey: .collectionId))
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
        case .ok(let collectionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(collectionId, forKey: .collectionId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CollectionRemoveMemberInput: Codable {
    public let collectionId: String
    public let nodeId: String

    public init(collectionId: String, nodeId: String) {
        self.collectionId = collectionId
        self.nodeId = nodeId
    }
}

public enum CollectionRemoveMemberOutput: Codable {
    case ok(collectionId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case collectionId
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(collectionId: try container.decode(String.self, forKey: .collectionId))
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
        case .ok(let collectionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(collectionId, forKey: .collectionId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct CollectionGetMembersInput: Codable {
    public let collectionId: String

    public init(collectionId: String) {
        self.collectionId = collectionId
    }
}

public enum CollectionGetMembersOutput: Codable {
    case ok(collectionId: String, members: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case collectionId
        case members
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                collectionId: try container.decode(String.self, forKey: .collectionId),
                members: try container.decode(String.self, forKey: .members)
            )
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
        case .ok(let collectionId, let members):
            try container.encode("ok", forKey: .variant)
            try container.encode(collectionId, forKey: .collectionId)
            try container.encode(members, forKey: .members)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol CollectionHandler {
    func create(input: CollectionCreateInput, storage: ConceptStorage) async throws -> CollectionCreateOutput
    func addMember(input: CollectionAddMemberInput, storage: ConceptStorage) async throws -> CollectionAddMemberOutput
    func removeMember(input: CollectionRemoveMemberInput, storage: ConceptStorage) async throws -> CollectionRemoveMemberOutput
    func getMembers(input: CollectionGetMembersInput, storage: ConceptStorage) async throws -> CollectionGetMembersOutput
}

// MARK: - Implementation

public struct CollectionHandlerImpl: CollectionHandler {
    public init() {}

    public func create(
        input: CollectionCreateInput,
        storage: ConceptStorage
    ) async throws -> CollectionCreateOutput {
        let collectionId = UUID().uuidString
        try await storage.put(
            relation: "collection",
            key: collectionId,
            value: [
                "id": collectionId,
                "name": input.name,
                "collectionType": input.collectionType,
                "schemaId": input.schemaId ?? "",
            ]
        )
        return .ok(collectionId: collectionId)
    }

    public func addMember(
        input: CollectionAddMemberInput,
        storage: ConceptStorage
    ) async throws -> CollectionAddMemberOutput {
        guard try await storage.get(relation: "collection", key: input.collectionId) != nil else {
            return .notfound(message: "Collection '\(input.collectionId)' not found")
        }

        let memberKey = "\(input.collectionId):\(input.nodeId)"
        try await storage.put(
            relation: "collection_member",
            key: memberKey,
            value: [
                "collectionId": input.collectionId,
                "nodeId": input.nodeId,
            ]
        )

        return .ok(collectionId: input.collectionId)
    }

    public func removeMember(
        input: CollectionRemoveMemberInput,
        storage: ConceptStorage
    ) async throws -> CollectionRemoveMemberOutput {
        let memberKey = "\(input.collectionId):\(input.nodeId)"
        guard try await storage.get(relation: "collection_member", key: memberKey) != nil else {
            return .notfound(message: "Member '\(input.nodeId)' not found in collection '\(input.collectionId)'")
        }

        try await storage.del(relation: "collection_member", key: memberKey)
        return .ok(collectionId: input.collectionId)
    }

    public func getMembers(
        input: CollectionGetMembersInput,
        storage: ConceptStorage
    ) async throws -> CollectionGetMembersOutput {
        guard try await storage.get(relation: "collection", key: input.collectionId) != nil else {
            return .notfound(message: "Collection '\(input.collectionId)' not found")
        }

        let members = try await storage.find(
            relation: "collection_member",
            criteria: ["collectionId": input.collectionId]
        )

        let memberIds = members.compactMap { $0["nodeId"] as? String }
        let jsonData = try JSONSerialization.data(withJSONObject: memberIds, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(collectionId: input.collectionId, members: jsonString)
    }
}
