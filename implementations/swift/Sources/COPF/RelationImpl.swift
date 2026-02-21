// RelationImpl.swift — Relation concept implementation

import Foundation

// MARK: - Types

public struct RelationDefineRelationInput: Codable {
    public let name: String
    public let sourceType: String
    public let targetType: String
    public let cardinality: String
    public let isBidirectional: Bool

    public init(name: String, sourceType: String, targetType: String, cardinality: String, isBidirectional: Bool) {
        self.name = name
        self.sourceType = sourceType
        self.targetType = targetType
        self.cardinality = cardinality
        self.isBidirectional = isBidirectional
    }
}

public enum RelationDefineRelationOutput: Codable {
    case ok(relationId: String)

    enum CodingKeys: String, CodingKey {
        case variant, relationId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(relationId: try container.decode(String.self, forKey: .relationId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let relationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(relationId, forKey: .relationId)
        }
    }
}

public struct RelationLinkInput: Codable {
    public let relationId: String
    public let sourceId: String
    public let targetId: String

    public init(relationId: String, sourceId: String, targetId: String) {
        self.relationId = relationId
        self.sourceId = sourceId
        self.targetId = targetId
    }
}

public enum RelationLinkOutput: Codable {
    case ok(relationId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, relationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(relationId: try container.decode(String.self, forKey: .relationId))
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
        case .ok(let relationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(relationId, forKey: .relationId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RelationUnlinkInput: Codable {
    public let relationId: String
    public let sourceId: String
    public let targetId: String

    public init(relationId: String, sourceId: String, targetId: String) {
        self.relationId = relationId
        self.sourceId = sourceId
        self.targetId = targetId
    }
}

public enum RelationUnlinkOutput: Codable {
    case ok(relationId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, relationId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(relationId: try container.decode(String.self, forKey: .relationId))
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
        case .ok(let relationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(relationId, forKey: .relationId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct RelationGetRelatedInput: Codable {
    public let nodeId: String
    public let relationId: String

    public init(nodeId: String, relationId: String) {
        self.nodeId = nodeId
        self.relationId = relationId
    }
}

public enum RelationGetRelatedOutput: Codable {
    case ok(nodeId: String, related: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, related
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                related: try container.decode(String.self, forKey: .related)
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
        case .ok(let nodeId, let related):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(related, forKey: .related)
        }
    }
}

// MARK: - Handler Protocol

public protocol RelationHandler {
    func defineRelation(input: RelationDefineRelationInput, storage: ConceptStorage) async throws -> RelationDefineRelationOutput
    func link(input: RelationLinkInput, storage: ConceptStorage) async throws -> RelationLinkOutput
    func unlink(input: RelationUnlinkInput, storage: ConceptStorage) async throws -> RelationUnlinkOutput
    func getRelated(input: RelationGetRelatedInput, storage: ConceptStorage) async throws -> RelationGetRelatedOutput
}

// MARK: - Implementation

public struct RelationHandlerImpl: RelationHandler {
    public init() {}

    public func defineRelation(
        input: RelationDefineRelationInput,
        storage: ConceptStorage
    ) async throws -> RelationDefineRelationOutput {
        let relationId = UUID().uuidString
        try await storage.put(
            relation: "relation_def",
            key: relationId,
            value: [
                "relationId": relationId,
                "name": input.name,
                "sourceType": input.sourceType,
                "targetType": input.targetType,
                "cardinality": input.cardinality,
                "isBidirectional": input.isBidirectional ? "true" : "false",
            ]
        )
        return .ok(relationId: relationId)
    }

    public func link(
        input: RelationLinkInput,
        storage: ConceptStorage
    ) async throws -> RelationLinkOutput {
        guard try await storage.get(relation: "relation_def", key: input.relationId) != nil else {
            return .notfound(message: "Relation definition '\(input.relationId)' not found")
        }
        let compKey = "\(input.relationId)::\(input.sourceId)::\(input.targetId)"
        try await storage.put(
            relation: "relation_link",
            key: compKey,
            value: [
                "relationId": input.relationId,
                "sourceId": input.sourceId,
                "targetId": input.targetId,
            ]
        )
        return .ok(relationId: input.relationId)
    }

    public func unlink(
        input: RelationUnlinkInput,
        storage: ConceptStorage
    ) async throws -> RelationUnlinkOutput {
        let compKey = "\(input.relationId)::\(input.sourceId)::\(input.targetId)"
        guard try await storage.get(relation: "relation_link", key: compKey) != nil else {
            return .notfound(message: "Link not found for relation '\(input.relationId)' from '\(input.sourceId)' to '\(input.targetId)'")
        }
        try await storage.del(relation: "relation_link", key: compKey)
        return .ok(relationId: input.relationId)
    }

    public func getRelated(
        input: RelationGetRelatedInput,
        storage: ConceptStorage
    ) async throws -> RelationGetRelatedOutput {
        // Find all links where sourceId matches for the given relation
        let allLinks = try await storage.find(
            relation: "relation_link",
            criteria: ["relationId": input.relationId]
        )
        var related: [String] = []
        for link in allLinks {
            let sourceId = link["sourceId"] as? String ?? ""
            let targetId = link["targetId"] as? String ?? ""
            if sourceId == input.nodeId {
                related.append(targetId)
            } else if targetId == input.nodeId {
                // Check if bidirectional
                if let relDef = try await storage.get(relation: "relation_def", key: input.relationId) {
                    let isBidi = relDef["isBidirectional"] as? String ?? "false"
                    if isBidi == "true" {
                        related.append(sourceId)
                    }
                }
            }
        }
        if let encoded = try? JSONSerialization.data(withJSONObject: related),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(nodeId: input.nodeId, related: str)
        }
        return .ok(nodeId: input.nodeId, related: "[]")
    }
}
