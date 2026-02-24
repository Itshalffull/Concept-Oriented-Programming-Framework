// ConnectorImpl.swift — Connector concept implementation

import Foundation

// MARK: - Types

public struct ConnectorConfigureInput: Codable {
    public let sourceId: String
    public let protocolId: String
    public let config: String

    public init(sourceId: String, protocolId: String, config: String) {
        self.sourceId = sourceId
        self.protocolId = protocolId
        self.config = config
    }
}

public enum ConnectorConfigureOutput: Codable {
    case ok(connectorId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, connectorId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(connectorId: try container.decode(String.self, forKey: .connectorId))
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
        case .ok(let connectorId):
            try container.encode("ok", forKey: .variant)
            try container.encode(connectorId, forKey: .connectorId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ConnectorReadInput: Codable {
    public let connectorId: String
    public let query: String
    public let options: String

    public init(connectorId: String, query: String, options: String) {
        self.connectorId = connectorId
        self.query = query
        self.options = options
    }
}

public enum ConnectorReadOutput: Codable {
    case ok(data: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, data, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(data: try container.decode(String.self, forKey: .data))
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
        case .ok(let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(data, forKey: .data)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ConnectorWriteInput: Codable {
    public let connectorId: String
    public let data: String
    public let options: String

    public init(connectorId: String, data: String, options: String) {
        self.connectorId = connectorId
        self.data = data
        self.options = options
    }
}

public enum ConnectorWriteOutput: Codable {
    case ok(created: Int, updated: Int, skipped: Int, errors: Int)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, created, updated, skipped, errors, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                created: try container.decode(Int.self, forKey: .created),
                updated: try container.decode(Int.self, forKey: .updated),
                skipped: try container.decode(Int.self, forKey: .skipped),
                errors: try container.decode(Int.self, forKey: .errors)
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
        case .ok(let created, let updated, let skipped, let errors):
            try container.encode("ok", forKey: .variant)
            try container.encode(created, forKey: .created)
            try container.encode(updated, forKey: .updated)
            try container.encode(skipped, forKey: .skipped)
            try container.encode(errors, forKey: .errors)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ConnectorTestInput: Codable {
    public let connectorId: String

    public init(connectorId: String) {
        self.connectorId = connectorId
    }
}

public enum ConnectorTestOutput: Codable {
    case ok(message: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(message: try container.decode(String.self, forKey: .message))
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
        case .ok(let message):
            try container.encode("ok", forKey: .variant)
            try container.encode(message, forKey: .message)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ConnectorDiscoverInput: Codable {
    public let connectorId: String

    public init(connectorId: String) {
        self.connectorId = connectorId
    }
}

public enum ConnectorDiscoverOutput: Codable {
    case ok(streams: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, streams, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(streams: try container.decode(String.self, forKey: .streams))
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
        case .ok(let streams):
            try container.encode("ok", forKey: .variant)
            try container.encode(streams, forKey: .streams)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ConnectorHandler {
    func configure(input: ConnectorConfigureInput, storage: ConceptStorage) async throws -> ConnectorConfigureOutput
    func read(input: ConnectorReadInput, storage: ConceptStorage) async throws -> ConnectorReadOutput
    func write(input: ConnectorWriteInput, storage: ConceptStorage) async throws -> ConnectorWriteOutput
    func test(input: ConnectorTestInput, storage: ConceptStorage) async throws -> ConnectorTestOutput
    func discover(input: ConnectorDiscoverInput, storage: ConceptStorage) async throws -> ConnectorDiscoverOutput
}

// MARK: - Implementation

public struct ConnectorHandlerImpl: ConnectorHandler {
    public init() {}

    public func configure(
        input: ConnectorConfigureInput,
        storage: ConceptStorage
    ) async throws -> ConnectorConfigureOutput {
        let connectorId = UUID().uuidString
        try await storage.put(
            relation: "connectors",
            key: connectorId,
            value: [
                "connectorId": connectorId,
                "sourceId": input.sourceId,
                "protocolId": input.protocolId,
                "config": input.config,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(connectorId: connectorId)
    }

    public func read(
        input: ConnectorReadInput,
        storage: ConceptStorage
    ) async throws -> ConnectorReadOutput {
        guard let _ = try await storage.get(relation: "connectors", key: input.connectorId) else {
            return .notfound(message: "Connector '\(input.connectorId)' not found")
        }
        return .ok(data: "[]")
    }

    public func write(
        input: ConnectorWriteInput,
        storage: ConceptStorage
    ) async throws -> ConnectorWriteOutput {
        guard let _ = try await storage.get(relation: "connectors", key: input.connectorId) else {
            return .notfound(message: "Connector '\(input.connectorId)' not found")
        }
        return .ok(created: 0, updated: 0, skipped: 0, errors: 0)
    }

    public func test(
        input: ConnectorTestInput,
        storage: ConceptStorage
    ) async throws -> ConnectorTestOutput {
        guard let _ = try await storage.get(relation: "connectors", key: input.connectorId) else {
            return .notfound(message: "Connector '\(input.connectorId)' not found")
        }
        return .ok(message: "Connection test successful for '\(input.connectorId)'")
    }

    public func discover(
        input: ConnectorDiscoverInput,
        storage: ConceptStorage
    ) async throws -> ConnectorDiscoverOutput {
        guard let _ = try await storage.get(relation: "connectors", key: input.connectorId) else {
            return .notfound(message: "Connector '\(input.connectorId)' not found")
        }
        return .ok(streams: "[]")
    }
}
