// DataSourceImpl.swift — DataSource concept implementation

import Foundation

// MARK: - Types

public struct DataSourceRegisterInput: Codable {
    public let name: String
    public let uri: String
    public let credentials: String

    public init(name: String, uri: String, credentials: String) {
        self.name = name
        self.uri = uri
        self.credentials = credentials
    }
}

public enum DataSourceRegisterOutput: Codable {
    case ok(sourceId: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, sourceId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(sourceId: try container.decode(String.self, forKey: .sourceId))
        case "exists":
            self = .exists(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let sourceId):
            try container.encode("ok", forKey: .variant)
            try container.encode(sourceId, forKey: .sourceId)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DataSourceConnectInput: Codable {
    public let sourceId: String

    public init(sourceId: String) {
        self.sourceId = sourceId
    }
}

public enum DataSourceConnectOutput: Codable {
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

public struct DataSourceDiscoverInput: Codable {
    public let sourceId: String

    public init(sourceId: String) {
        self.sourceId = sourceId
    }
}

public enum DataSourceDiscoverOutput: Codable {
    case ok(rawSchema: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, rawSchema, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(rawSchema: try container.decode(String.self, forKey: .rawSchema))
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
        case .ok(let rawSchema):
            try container.encode("ok", forKey: .variant)
            try container.encode(rawSchema, forKey: .rawSchema)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DataSourceHealthCheckInput: Codable {
    public let sourceId: String

    public init(sourceId: String) {
        self.sourceId = sourceId
    }
}

public enum DataSourceHealthCheckOutput: Codable {
    case ok(status: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, status, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(status: try container.decode(String.self, forKey: .status))
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
        case .ok(let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(status, forKey: .status)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DataSourceDeactivateInput: Codable {
    public let sourceId: String

    public init(sourceId: String) {
        self.sourceId = sourceId
    }
}

public enum DataSourceDeactivateOutput: Codable {
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

public protocol DataSourceHandler {
    func register(input: DataSourceRegisterInput, storage: ConceptStorage) async throws -> DataSourceRegisterOutput
    func connect(input: DataSourceConnectInput, storage: ConceptStorage) async throws -> DataSourceConnectOutput
    func discover(input: DataSourceDiscoverInput, storage: ConceptStorage) async throws -> DataSourceDiscoverOutput
    func healthCheck(input: DataSourceHealthCheckInput, storage: ConceptStorage) async throws -> DataSourceHealthCheckOutput
    func deactivate(input: DataSourceDeactivateInput, storage: ConceptStorage) async throws -> DataSourceDeactivateOutput
}

// MARK: - Implementation

public struct DataSourceHandlerImpl: DataSourceHandler {
    public init() {}

    public func register(
        input: DataSourceRegisterInput,
        storage: ConceptStorage
    ) async throws -> DataSourceRegisterOutput {
        let existing = try await storage.find(relation: "data_sources", criteria: ["name": input.name])
        if !existing.isEmpty {
            return .exists(message: "Data source '\(input.name)' already exists")
        }
        let sourceId = UUID().uuidString
        try await storage.put(
            relation: "data_sources",
            key: sourceId,
            value: [
                "sourceId": sourceId,
                "name": input.name,
                "uri": input.uri,
                "credentials": input.credentials,
                "active": true,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(sourceId: sourceId)
    }

    public func connect(
        input: DataSourceConnectInput,
        storage: ConceptStorage
    ) async throws -> DataSourceConnectOutput {
        guard let _ = try await storage.get(relation: "data_sources", key: input.sourceId) else {
            return .notfound(message: "Data source '\(input.sourceId)' not found")
        }
        return .ok(message: "Connected to data source '\(input.sourceId)'")
    }

    public func discover(
        input: DataSourceDiscoverInput,
        storage: ConceptStorage
    ) async throws -> DataSourceDiscoverOutput {
        guard let record = try await storage.get(relation: "data_sources", key: input.sourceId) else {
            return .notfound(message: "Data source '\(input.sourceId)' not found")
        }
        let name = record["name"] as? String ?? "unknown"
        return .ok(rawSchema: "{\"source\": \"\(name)\", \"tables\": []}")
    }

    public func healthCheck(
        input: DataSourceHealthCheckInput,
        storage: ConceptStorage
    ) async throws -> DataSourceHealthCheckOutput {
        guard let _ = try await storage.get(relation: "data_sources", key: input.sourceId) else {
            return .notfound(message: "Data source '\(input.sourceId)' not found")
        }
        return .ok(status: "healthy")
    }

    public func deactivate(
        input: DataSourceDeactivateInput,
        storage: ConceptStorage
    ) async throws -> DataSourceDeactivateOutput {
        guard let record = try await storage.get(relation: "data_sources", key: input.sourceId) else {
            return .notfound(message: "Data source '\(input.sourceId)' not found")
        }
        var updated = record
        updated["active"] = false
        try await storage.put(relation: "data_sources", key: input.sourceId, value: updated)
        return .ok
    }
}
