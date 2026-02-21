// ConfigSyncImpl.swift — ConfigSync concept implementation

import Foundation

// MARK: - Types

public struct ConfigSyncExportConfigInput: Codable {
    public init() {}
}

public enum ConfigSyncExportConfigOutput: Codable {
    case ok(data: String)

    enum CodingKeys: String, CodingKey {
        case variant, data
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(data: try container.decode(String.self, forKey: .data))
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
        }
    }
}

public struct ConfigSyncImportConfigInput: Codable {
    public let data: String

    public init(data: String) {
        self.data = data
    }
}

public enum ConfigSyncImportConfigOutput: Codable {
    case ok(count: Int)

    enum CodingKeys: String, CodingKey {
        case variant, count
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(count: try container.decode(Int.self, forKey: .count))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let count):
            try container.encode("ok", forKey: .variant)
            try container.encode(count, forKey: .count)
        }
    }
}

public struct ConfigSyncOverrideConfigInput: Codable {
    public let key: String
    public let value: String
    public let layer: String

    public init(key: String, value: String, layer: String) {
        self.key = key
        self.value = value
        self.layer = layer
    }
}

public enum ConfigSyncOverrideConfigOutput: Codable {
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

public struct ConfigSyncDiffInput: Codable {
    public init() {}
}

public enum ConfigSyncDiffOutput: Codable {
    case ok(changes: String)

    enum CodingKeys: String, CodingKey {
        case variant, changes
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(changes: try container.decode(String.self, forKey: .changes))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let changes):
            try container.encode("ok", forKey: .variant)
            try container.encode(changes, forKey: .changes)
        }
    }
}

// MARK: - Handler Protocol

public protocol ConfigSyncHandler {
    func exportConfig(input: ConfigSyncExportConfigInput, storage: ConceptStorage) async throws -> ConfigSyncExportConfigOutput
    func importConfig(input: ConfigSyncImportConfigInput, storage: ConceptStorage) async throws -> ConfigSyncImportConfigOutput
    func overrideConfig(input: ConfigSyncOverrideConfigInput, storage: ConceptStorage) async throws -> ConfigSyncOverrideConfigOutput
    func diff(input: ConfigSyncDiffInput, storage: ConceptStorage) async throws -> ConfigSyncDiffOutput
}

// MARK: - Implementation

public struct ConfigSyncHandlerImpl: ConfigSyncHandler {
    public init() {}

    public func exportConfig(
        input: ConfigSyncExportConfigInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncExportConfigOutput {
        let allConfigs = try await storage.find(relation: "config", criteria: nil)
        var exportData: [[String: String]] = []
        for config in allConfigs {
            let key = config["key"] as? String ?? ""
            let value = config["value"] as? String ?? ""
            let layer = config["layer"] as? String ?? "default"
            exportData.append(["key": key, "value": value, "layer": layer])
        }
        let jsonData = try JSONSerialization.data(withJSONObject: exportData, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(data: jsonString)
    }

    public func importConfig(
        input: ConfigSyncImportConfigInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncImportConfigOutput {
        guard let data = input.data.data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] else {
            return .ok(count: 0)
        }
        var count = 0
        for item in items {
            let key = item["key"] ?? ""
            let value = item["value"] ?? ""
            let layer = item["layer"] ?? "default"
            try await storage.put(
                relation: "config",
                key: key,
                value: [
                    "key": key,
                    "value": value,
                    "layer": layer,
                    "importedAt": ISO8601DateFormatter().string(from: Date()),
                ]
            )
            count += 1
        }
        return .ok(count: count)
    }

    public func overrideConfig(
        input: ConfigSyncOverrideConfigInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncOverrideConfigOutput {
        try await storage.put(
            relation: "config",
            key: input.key,
            value: [
                "key": input.key,
                "value": input.value,
                "layer": input.layer,
                "overriddenAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(key: input.key)
    }

    public func diff(
        input: ConfigSyncDiffInput,
        storage: ConceptStorage
    ) async throws -> ConfigSyncDiffOutput {
        let allConfigs = try await storage.find(relation: "config", criteria: nil)
        var changes: [[String: String]] = []
        for config in allConfigs {
            let key = config["key"] as? String ?? ""
            let layer = config["layer"] as? String ?? "default"
            if layer != "default" {
                changes.append(["key": key, "layer": layer, "status": "overridden"])
            }
        }
        let jsonData = try JSONSerialization.data(withJSONObject: changes, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(changes: jsonString)
    }
}
