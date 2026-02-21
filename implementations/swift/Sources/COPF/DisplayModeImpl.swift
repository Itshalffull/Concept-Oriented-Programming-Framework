// DisplayModeImpl.swift — DisplayMode concept implementation

import Foundation

// MARK: - Types

public struct DisplayModeDefineModeInput: Codable {
    public let name: String
    public let modeType: String

    public init(name: String, modeType: String) {
        self.name = name
        self.modeType = modeType
    }
}

public enum DisplayModeDefineModeOutput: Codable {
    case ok(modeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case modeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(modeId: try container.decode(String.self, forKey: .modeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let modeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(modeId, forKey: .modeId)
        }
    }
}

public struct DisplayModeConfigureFieldDisplayInput: Codable {
    public let schemaId: String
    public let modeId: String
    public let fieldId: String
    public let formatter: String
    public let settings: String

    public init(schemaId: String, modeId: String, fieldId: String, formatter: String, settings: String) {
        self.schemaId = schemaId
        self.modeId = modeId
        self.fieldId = fieldId
        self.formatter = formatter
        self.settings = settings
    }
}

public enum DisplayModeConfigureFieldDisplayOutput: Codable {
    case ok(modeId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case modeId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(modeId: try container.decode(String.self, forKey: .modeId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let modeId):
            try container.encode("ok", forKey: .variant)
            try container.encode(modeId, forKey: .modeId)
        }
    }
}

public struct DisplayModeRenderInModeInput: Codable {
    public let nodeId: String
    public let modeId: String

    public init(nodeId: String, modeId: String) {
        self.nodeId = nodeId
        self.modeId = modeId
    }
}

public enum DisplayModeRenderInModeOutput: Codable {
    case ok(nodeId: String, rendered: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case nodeId
        case rendered
        case message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                rendered: try container.decode(String.self, forKey: .rendered)
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
        case .ok(let nodeId, let rendered):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(rendered, forKey: .rendered)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol DisplayModeHandler {
    func defineMode(input: DisplayModeDefineModeInput, storage: ConceptStorage) async throws -> DisplayModeDefineModeOutput
    func configureFieldDisplay(input: DisplayModeConfigureFieldDisplayInput, storage: ConceptStorage) async throws -> DisplayModeConfigureFieldDisplayOutput
    func renderInMode(input: DisplayModeRenderInModeInput, storage: ConceptStorage) async throws -> DisplayModeRenderInModeOutput
}

// MARK: - Implementation

public struct DisplayModeHandlerImpl: DisplayModeHandler {
    public init() {}

    public func defineMode(
        input: DisplayModeDefineModeInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeDefineModeOutput {
        let modeId = UUID().uuidString
        try await storage.put(
            relation: "display_mode",
            key: modeId,
            value: [
                "id": modeId,
                "name": input.name,
                "modeType": input.modeType,
            ]
        )
        return .ok(modeId: modeId)
    }

    public func configureFieldDisplay(
        input: DisplayModeConfigureFieldDisplayInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeConfigureFieldDisplayOutput {
        let key = "\(input.schemaId):\(input.modeId):\(input.fieldId)"
        try await storage.put(
            relation: "field_display_config",
            key: key,
            value: [
                "schemaId": input.schemaId,
                "modeId": input.modeId,
                "fieldId": input.fieldId,
                "formatter": input.formatter,
                "settings": input.settings,
            ]
        )
        return .ok(modeId: input.modeId)
    }

    public func renderInMode(
        input: DisplayModeRenderInModeInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeRenderInModeOutput {
        guard try await storage.get(relation: "display_mode", key: input.modeId) != nil else {
            return .notfound(message: "Display mode '\(input.modeId)' not found")
        }

        // Gather field display configs for this mode
        let allConfigs = try await storage.find(
            relation: "field_display_config",
            criteria: ["modeId": input.modeId]
        )

        let configDicts: [[String: String]] = allConfigs.map { config in
            [
                "fieldId": config["fieldId"] as? String ?? "",
                "formatter": config["formatter"] as? String ?? "",
                "settings": config["settings"] as? String ?? "",
            ]
        }

        let rendered: [String: Any] = [
            "nodeId": input.nodeId,
            "modeId": input.modeId,
            "fields": configDicts,
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: rendered, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

        return .ok(nodeId: input.nodeId, rendered: jsonString)
    }
}
