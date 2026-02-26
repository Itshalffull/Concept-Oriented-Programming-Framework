// PluginRegistryImpl.swift — PluginRegistry concept implementation

import Foundation

// MARK: - Types

public struct PluginRegistryRegisterTypeInput: Codable {
    public let typeId: String
    public let definition: String

    public init(typeId: String, definition: String) {
        self.typeId = typeId
        self.definition = definition
    }
}

public enum PluginRegistryRegisterTypeOutput: Codable {
    case ok(typeId: String)

    enum CodingKeys: String, CodingKey {
        case variant, typeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(typeId: try container.decode(String.self, forKey: .typeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let typeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
        }
    }
}

public struct PluginRegistryRegisterPluginInput: Codable {
    public let typeId: String
    public let pluginId: String
    public let config: String

    public init(typeId: String, pluginId: String, config: String) {
        self.typeId = typeId
        self.pluginId = pluginId
        self.config = config
    }
}

public enum PluginRegistryRegisterPluginOutput: Codable {
    case ok(typeId: String, pluginId: String)
    case typeNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, typeId, pluginId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                typeId: try container.decode(String.self, forKey: .typeId),
                pluginId: try container.decode(String.self, forKey: .pluginId)
            )
        case "typeNotfound":
            self = .typeNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let typeId, let pluginId):
            try container.encode("ok", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
            try container.encode(pluginId, forKey: .pluginId)
        case .typeNotfound(let message):
            try container.encode("typeNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PluginRegistryDiscoverInput: Codable {
    public let typeId: String

    public init(typeId: String) {
        self.typeId = typeId
    }
}

public enum PluginRegistryDiscoverOutput: Codable {
    case ok(typeId: String, plugins: String)
    case typeNotfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, typeId, plugins, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                typeId: try container.decode(String.self, forKey: .typeId),
                plugins: try container.decode(String.self, forKey: .plugins)
            )
        case "typeNotfound":
            self = .typeNotfound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let typeId, let plugins):
            try container.encode("ok", forKey: .variant)
            try container.encode(typeId, forKey: .typeId)
            try container.encode(plugins, forKey: .plugins)
        case .typeNotfound(let message):
            try container.encode("typeNotfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct PluginRegistryCreateInstanceInput: Codable {
    public let typeId: String
    public let pluginId: String
    public let config: String

    public init(typeId: String, pluginId: String, config: String) {
        self.typeId = typeId
        self.pluginId = pluginId
        self.config = config
    }
}

public enum PluginRegistryCreateInstanceOutput: Codable {
    case ok(instanceId: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, instanceId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(instanceId: try container.decode(String.self, forKey: .instanceId))
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
        case .ok(let instanceId):
            try container.encode("ok", forKey: .variant)
            try container.encode(instanceId, forKey: .instanceId)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol PluginRegistryHandler {
    func registerType(input: PluginRegistryRegisterTypeInput, storage: ConceptStorage) async throws -> PluginRegistryRegisterTypeOutput
    func registerPlugin(input: PluginRegistryRegisterPluginInput, storage: ConceptStorage) async throws -> PluginRegistryRegisterPluginOutput
    func discover(input: PluginRegistryDiscoverInput, storage: ConceptStorage) async throws -> PluginRegistryDiscoverOutput
    func createInstance(input: PluginRegistryCreateInstanceInput, storage: ConceptStorage) async throws -> PluginRegistryCreateInstanceOutput
}

// MARK: - Implementation

public struct PluginRegistryHandlerImpl: PluginRegistryHandler {
    public init() {}

    public func registerType(
        input: PluginRegistryRegisterTypeInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryRegisterTypeOutput {
        try await storage.put(
            relation: "plugin_type",
            key: input.typeId,
            value: [
                "typeId": input.typeId,
                "definition": input.definition,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(typeId: input.typeId)
    }

    public func registerPlugin(
        input: PluginRegistryRegisterPluginInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryRegisterPluginOutput {
        guard try await storage.get(relation: "plugin_type", key: input.typeId) != nil else {
            return .typeNotfound(message: "Plugin type \(input.typeId) not found")
        }
        let defKey = "\(input.typeId):\(input.pluginId)"
        try await storage.put(
            relation: "plugin_definition",
            key: defKey,
            value: [
                "typeId": input.typeId,
                "pluginId": input.pluginId,
                "config": input.config,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(typeId: input.typeId, pluginId: input.pluginId)
    }

    public func discover(
        input: PluginRegistryDiscoverInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryDiscoverOutput {
        guard try await storage.get(relation: "plugin_type", key: input.typeId) != nil else {
            return .typeNotfound(message: "Plugin type \(input.typeId) not found")
        }
        let allPlugins = try await storage.find(
            relation: "plugin_definition",
            criteria: ["typeId": input.typeId]
        )
        let pluginIds = allPlugins.compactMap { $0["pluginId"] as? String }
        let jsonData = try JSONSerialization.data(withJSONObject: pluginIds, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(typeId: input.typeId, plugins: jsonString)
    }

    public func createInstance(
        input: PluginRegistryCreateInstanceInput,
        storage: ConceptStorage
    ) async throws -> PluginRegistryCreateInstanceOutput {
        let defKey = "\(input.typeId):\(input.pluginId)"
        guard try await storage.get(relation: "plugin_definition", key: defKey) != nil else {
            return .notfound(message: "Plugin \(input.pluginId) of type \(input.typeId) not found")
        }
        let instanceId = UUID().uuidString
        return .ok(instanceId: instanceId)
    }
}
