// PropertyImpl.swift — Property concept implementation

import Foundation

// MARK: - Types

public struct PropertySetInput: Codable {
    public let nodeId: String
    public let key: String
    public let value: String

    public init(nodeId: String, key: String, value: String) {
        self.nodeId = nodeId
        self.key = key
        self.value = value
    }
}

public enum PropertySetOutput: Codable {
    case ok(nodeId: String, key: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, key
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                key: try container.decode(String.self, forKey: .key)
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
        case .ok(let nodeId, let key):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(key, forKey: .key)
        }
    }
}

public struct PropertyGetInput: Codable {
    public let nodeId: String
    public let key: String

    public init(nodeId: String, key: String) {
        self.nodeId = nodeId
        self.key = key
    }
}

public enum PropertyGetOutput: Codable {
    case ok(nodeId: String, key: String, value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, key, value, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                key: try container.decode(String.self, forKey: .key),
                value: try container.decode(String.self, forKey: .value)
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
        case .ok(let nodeId, let key, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(key, forKey: .key)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PropertyDeleteInput: Codable {
    public let nodeId: String
    public let key: String

    public init(nodeId: String, key: String) {
        self.nodeId = nodeId
        self.key = key
    }
}

public enum PropertyDeleteOutput: Codable {
    case ok(nodeId: String, key: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, key, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                key: try container.decode(String.self, forKey: .key)
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
        case .ok(let nodeId, let key):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(key, forKey: .key)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PropertyDefineTypeInput: Codable {
    public let key: String
    public let propType: String
    public let constraints: String

    public init(key: String, propType: String, constraints: String) {
        self.key = key
        self.propType = propType
        self.constraints = constraints
    }
}

public enum PropertyDefineTypeOutput: Codable {
    case ok(key: String)

    enum CodingKeys: String, CodingKey {
        case variant, key
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(key: try container.decode(String.self, forKey: .key))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let key):
            try container.encode("ok", forKey: .variant)
            try container.encode(key, forKey: .key)
        }
    }
}

public struct PropertyListAllInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum PropertyListAllOutput: Codable {
    case ok(nodeId: String, properties: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, properties
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                properties: try container.decode(String.self, forKey: .properties)
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
        case .ok(let nodeId, let properties):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(properties, forKey: .properties)
        }
    }
}

// MARK: - Handler Protocol

public protocol PropertyHandler {
    func set(input: PropertySetInput, storage: ConceptStorage) async throws -> PropertySetOutput
    func get(input: PropertyGetInput, storage: ConceptStorage) async throws -> PropertyGetOutput
    func delete(input: PropertyDeleteInput, storage: ConceptStorage) async throws -> PropertyDeleteOutput
    func defineType(input: PropertyDefineTypeInput, storage: ConceptStorage) async throws -> PropertyDefineTypeOutput
    func listAll(input: PropertyListAllInput, storage: ConceptStorage) async throws -> PropertyListAllOutput
}

// MARK: - Implementation

public struct PropertyHandlerImpl: PropertyHandler {
    public init() {}

    /// Composite key for per-node properties
    private func propertyKey(nodeId: String, key: String) -> String {
        return "\(nodeId)::\(key)"
    }

    public func set(
        input: PropertySetInput,
        storage: ConceptStorage
    ) async throws -> PropertySetOutput {
        let compKey = propertyKey(nodeId: input.nodeId, key: input.key)
        try await storage.put(
            relation: "property",
            key: compKey,
            value: [
                "nodeId": input.nodeId,
                "key": input.key,
                "value": input.value,
            ]
        )
        return .ok(nodeId: input.nodeId, key: input.key)
    }

    public func get(
        input: PropertyGetInput,
        storage: ConceptStorage
    ) async throws -> PropertyGetOutput {
        let compKey = propertyKey(nodeId: input.nodeId, key: input.key)
        guard let record = try await storage.get(relation: "property", key: compKey) else {
            return .notfound(message: "Property '\(input.key)' not found on node '\(input.nodeId)'")
        }
        let value = record["value"] as? String ?? ""
        return .ok(nodeId: input.nodeId, key: input.key, value: value)
    }

    public func delete(
        input: PropertyDeleteInput,
        storage: ConceptStorage
    ) async throws -> PropertyDeleteOutput {
        let compKey = propertyKey(nodeId: input.nodeId, key: input.key)
        guard try await storage.get(relation: "property", key: compKey) != nil else {
            return .notfound(message: "Property '\(input.key)' not found on node '\(input.nodeId)'")
        }
        try await storage.del(relation: "property", key: compKey)
        return .ok(nodeId: input.nodeId, key: input.key)
    }

    public func defineType(
        input: PropertyDefineTypeInput,
        storage: ConceptStorage
    ) async throws -> PropertyDefineTypeOutput {
        try await storage.put(
            relation: "property_type",
            key: input.key,
            value: [
                "key": input.key,
                "propType": input.propType,
                "constraints": input.constraints,
            ]
        )
        return .ok(key: input.key)
    }

    public func listAll(
        input: PropertyListAllInput,
        storage: ConceptStorage
    ) async throws -> PropertyListAllOutput {
        let results = try await storage.find(
            relation: "property",
            criteria: ["nodeId": input.nodeId]
        )
        var props: [[String: String]] = []
        for record in results {
            let key = record["key"] as? String ?? ""
            let value = record["value"] as? String ?? ""
            props.append(["key": key, "value": value])
        }
        if let encoded = try? JSONSerialization.data(withJSONObject: props),
           let str = String(data: encoded, encoding: .utf8) {
            return .ok(nodeId: input.nodeId, properties: str)
        }
        return .ok(nodeId: input.nodeId, properties: "[]")
    }
}
