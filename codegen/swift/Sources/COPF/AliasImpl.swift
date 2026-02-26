// AliasImpl.swift — Alias concept implementation

import Foundation

// MARK: - Types

public struct AliasAddAliasInput: Codable {
    public let entityId: String
    public let aliasName: String

    public init(entityId: String, aliasName: String) {
        self.entityId = entityId
        self.aliasName = aliasName
    }
}

public enum AliasAddAliasOutput: Codable {
    case ok(entityId: String, aliasName: String)
    case alreadyExists(aliasName: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, aliasName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                aliasName: try container.decode(String.self, forKey: .aliasName)
            )
        case "alreadyExists":
            self = .alreadyExists(aliasName: try container.decode(String.self, forKey: .aliasName))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let entityId, let aliasName):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(aliasName, forKey: .aliasName)
        case .alreadyExists(let aliasName):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(aliasName, forKey: .aliasName)
        }
    }
}

public struct AliasRemoveAliasInput: Codable {
    public let entityId: String
    public let aliasName: String

    public init(entityId: String, aliasName: String) {
        self.entityId = entityId
        self.aliasName = aliasName
    }
}

public enum AliasRemoveAliasOutput: Codable {
    case ok(entityId: String, aliasName: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, aliasName, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                entityId: try container.decode(String.self, forKey: .entityId),
                aliasName: try container.decode(String.self, forKey: .aliasName)
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
        case .ok(let entityId, let aliasName):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
            try container.encode(aliasName, forKey: .aliasName)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct AliasResolveInput: Codable {
    public let name: String

    public init(name: String) {
        self.name = name
    }
}

public enum AliasResolveOutput: Codable {
    case ok(entityId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, entityId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(entityId: try container.decode(String.self, forKey: .entityId))
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
        case .ok(let entityId):
            try container.encode("ok", forKey: .variant)
            try container.encode(entityId, forKey: .entityId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol AliasHandler {
    func addAlias(input: AliasAddAliasInput, storage: ConceptStorage) async throws -> AliasAddAliasOutput
    func removeAlias(input: AliasRemoveAliasInput, storage: ConceptStorage) async throws -> AliasRemoveAliasOutput
    func resolve(input: AliasResolveInput, storage: ConceptStorage) async throws -> AliasResolveOutput
}

// MARK: - Implementation

public struct AliasHandlerImpl: AliasHandler {
    public init() {}

    public func addAlias(
        input: AliasAddAliasInput,
        storage: ConceptStorage
    ) async throws -> AliasAddAliasOutput {
        // Check if alias name is already taken
        if let _ = try await storage.get(relation: "alias", key: input.aliasName) {
            return .alreadyExists(aliasName: input.aliasName)
        }
        try await storage.put(
            relation: "alias",
            key: input.aliasName,
            value: [
                "aliasName": input.aliasName,
                "entityId": input.entityId,
            ]
        )
        return .ok(entityId: input.entityId, aliasName: input.aliasName)
    }

    public func removeAlias(
        input: AliasRemoveAliasInput,
        storage: ConceptStorage
    ) async throws -> AliasRemoveAliasOutput {
        guard let record = try await storage.get(relation: "alias", key: input.aliasName) else {
            return .notfound(message: "Alias '\(input.aliasName)' not found")
        }
        let storedEntityId = record["entityId"] as? String ?? ""
        guard storedEntityId == input.entityId else {
            return .notfound(message: "Alias '\(input.aliasName)' does not belong to entity '\(input.entityId)'")
        }
        try await storage.del(relation: "alias", key: input.aliasName)
        return .ok(entityId: input.entityId, aliasName: input.aliasName)
    }

    public func resolve(
        input: AliasResolveInput,
        storage: ConceptStorage
    ) async throws -> AliasResolveOutput {
        guard let record = try await storage.get(relation: "alias", key: input.name) else {
            return .notfound(message: "Alias '\(input.name)' not found")
        }
        let entityId = record["entityId"] as? String ?? ""
        return .ok(entityId: entityId)
    }
}
