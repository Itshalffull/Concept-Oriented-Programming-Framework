// PageAsRecordImpl.swift — PageAsRecord concept implementation

import Foundation

// MARK: - Types

public struct PageAsRecordSetPropertyInput: Codable {
    public let nodeId: String
    public let name: String
    public let value: String

    public init(nodeId: String, name: String, value: String) {
        self.nodeId = nodeId
        self.name = name
        self.value = value
    }
}

public enum PageAsRecordSetPropertyOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PageAsRecordGetPropertyInput: Codable {
    public let nodeId: String
    public let name: String

    public init(nodeId: String, name: String) {
        self.nodeId = nodeId
        self.name = name
    }
}

public enum PageAsRecordGetPropertyOutput: Codable {
    case ok(nodeId: String, name: String, value: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, name, value, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                name: try container.decode(String.self, forKey: .name),
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
        case .ok(let nodeId, let name, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(name, forKey: .name)
            try container.encode(value, forKey: .value)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PageAsRecordAppendToBodyInput: Codable {
    public let nodeId: String
    public let childNodeId: String

    public init(nodeId: String, childNodeId: String) {
        self.nodeId = nodeId
        self.childNodeId = childNodeId
    }
}

public enum PageAsRecordAppendToBodyOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PageAsRecordAttachToSchemaInput: Codable {
    public let nodeId: String
    public let schemaId: String

    public init(nodeId: String, schemaId: String) {
        self.nodeId = nodeId
        self.schemaId = schemaId
    }
}

public enum PageAsRecordAttachToSchemaOutput: Codable {
    case ok(nodeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        }
    }
}

public struct PageAsRecordDetachFromSchemaInput: Codable {
    public let nodeId: String

    public init(nodeId: String) {
        self.nodeId = nodeId
    }
}

public enum PageAsRecordDetachFromSchemaOutput: Codable {
    case ok(nodeId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(nodeId: try container.decode(String.self, forKey: .nodeId))
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
        case .ok(let nodeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol PageAsRecordHandler {
    func setProperty(input: PageAsRecordSetPropertyInput, storage: ConceptStorage) async throws -> PageAsRecordSetPropertyOutput
    func getProperty(input: PageAsRecordGetPropertyInput, storage: ConceptStorage) async throws -> PageAsRecordGetPropertyOutput
    func appendToBody(input: PageAsRecordAppendToBodyInput, storage: ConceptStorage) async throws -> PageAsRecordAppendToBodyOutput
    func attachToSchema(input: PageAsRecordAttachToSchemaInput, storage: ConceptStorage) async throws -> PageAsRecordAttachToSchemaOutput
    func detachFromSchema(input: PageAsRecordDetachFromSchemaInput, storage: ConceptStorage) async throws -> PageAsRecordDetachFromSchemaOutput
}

// MARK: - Implementation

public struct PageAsRecordHandlerImpl: PageAsRecordHandler {
    public init() {}

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func setProperty(
        input: PageAsRecordSetPropertyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordSetPropertyOutput {
        guard var record = try await storage.get(relation: "page_record", key: input.nodeId) else {
            return .notfound(message: "Page record '\(input.nodeId)' not found")
        }
        // Store properties as a JSON string within the record
        var props: [String: String] = [:]
        if let propsStr = record["properties"] as? String,
           let data = propsStr.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            props = parsed
        }
        props[input.name] = input.value
        if let encoded = try? JSONSerialization.data(withJSONObject: props),
           let str = String(data: encoded, encoding: .utf8) {
            record["properties"] = str
        }
        record["updatedAt"] = iso8601Now()
        try await storage.put(relation: "page_record", key: input.nodeId, value: record)
        return .ok(nodeId: input.nodeId)
    }

    public func getProperty(
        input: PageAsRecordGetPropertyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordGetPropertyOutput {
        guard let record = try await storage.get(relation: "page_record", key: input.nodeId) else {
            return .notfound(message: "Page record '\(input.nodeId)' not found")
        }
        if let propsStr = record["properties"] as? String,
           let data = propsStr.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: String],
           let value = parsed[input.name] {
            return .ok(nodeId: input.nodeId, name: input.name, value: value)
        }
        return .notfound(message: "Property '\(input.name)' not found on page '\(input.nodeId)'")
    }

    public func appendToBody(
        input: PageAsRecordAppendToBodyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordAppendToBodyOutput {
        guard var record = try await storage.get(relation: "page_record", key: input.nodeId) else {
            return .notfound(message: "Page record '\(input.nodeId)' not found")
        }
        var children: [String] = []
        if let bodyStr = record["body"] as? String,
           let data = bodyStr.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            children = parsed
        }
        children.append(input.childNodeId)
        if let encoded = try? JSONSerialization.data(withJSONObject: children),
           let str = String(data: encoded, encoding: .utf8) {
            record["body"] = str
        }
        record["updatedAt"] = iso8601Now()
        try await storage.put(relation: "page_record", key: input.nodeId, value: record)
        return .ok(nodeId: input.nodeId)
    }

    public func attachToSchema(
        input: PageAsRecordAttachToSchemaInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordAttachToSchemaOutput {
        let now = iso8601Now()
        var record = try await storage.get(relation: "page_record", key: input.nodeId) ?? [
            "nodeId": input.nodeId,
            "properties": "{}",
            "body": "[]",
            "createdAt": now,
        ]
        record["schemaId"] = input.schemaId
        record["updatedAt"] = now
        try await storage.put(relation: "page_record", key: input.nodeId, value: record)
        return .ok(nodeId: input.nodeId)
    }

    public func detachFromSchema(
        input: PageAsRecordDetachFromSchemaInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordDetachFromSchemaOutput {
        guard var record = try await storage.get(relation: "page_record", key: input.nodeId) else {
            return .notfound(message: "Page record '\(input.nodeId)' not found")
        }
        record.removeValue(forKey: "schemaId")
        record["updatedAt"] = iso8601Now()
        try await storage.put(relation: "page_record", key: input.nodeId, value: record)
        return .ok(nodeId: input.nodeId)
    }
}
