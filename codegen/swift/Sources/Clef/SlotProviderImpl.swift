// SlotProviderImpl.swift — Surface Provider: Slot concept implementation

import Foundation

// MARK: - Types

public struct SlotProviderInitializeInput: Codable {
    public let pluginRef: String

    public init(pluginRef: String) {
        self.pluginRef = pluginRef
    }
}

public enum SlotProviderInitializeOutput: Codable {
    case ok(pluginRef: String)
    case alreadyInitialized(pluginRef: String)

    enum CodingKeys: String, CodingKey {
        case variant, pluginRef
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(pluginRef: try container.decode(String.self, forKey: .pluginRef))
        case "alreadyInitialized":
            self = .alreadyInitialized(pluginRef: try container.decode(String.self, forKey: .pluginRef))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pluginRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        case .alreadyInitialized(let pluginRef):
            try container.encode("alreadyInitialized", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        }
    }
}

public struct SlotProviderDefineInput: Codable {
    public let slotName: String
    public let description: String

    public init(slotName: String, description: String) {
        self.slotName = slotName
        self.description = description
    }
}

public enum SlotProviderDefineOutput: Codable {
    case ok(slotName: String)
    case alreadyDefined(slotName: String)

    enum CodingKeys: String, CodingKey {
        case variant, slotName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(slotName: try container.decode(String.self, forKey: .slotName))
        case "alreadyDefined":
            self = .alreadyDefined(slotName: try container.decode(String.self, forKey: .slotName))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .alreadyDefined(let slotName):
            try container.encode("alreadyDefined", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        }
    }
}

public struct SlotProviderFillInput: Codable {
    public let slotName: String
    public let content: String

    public init(slotName: String, content: String) {
        self.slotName = slotName
        self.content = content
    }
}

public enum SlotProviderFillOutput: Codable {
    case ok(slotName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, slotName, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(slotName: try container.decode(String.self, forKey: .slotName))
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SlotProviderClearInput: Codable {
    public let slotName: String

    public init(slotName: String) {
        self.slotName = slotName
    }
}

public enum SlotProviderClearOutput: Codable {
    case ok(slotName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, slotName, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(slotName: try container.decode(String.self, forKey: .slotName))
        case "notFound":
            self = .notFound(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let slotName):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotName, forKey: .slotName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct SlotProviderGetSlotsInput: Codable {
    public init() {}
}

public enum SlotProviderGetSlotsOutput: Codable {
    case ok(slotNames: [String])
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, slotNames, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(slotNames: try container.decode([String].self, forKey: .slotNames))
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
        case .ok(let slotNames):
            try container.encode("ok", forKey: .variant)
            try container.encode(slotNames, forKey: .slotNames)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol SlotProviderHandler {
    func initialize(input: SlotProviderInitializeInput, storage: ConceptStorage) async throws -> SlotProviderInitializeOutput
    func define(input: SlotProviderDefineInput, storage: ConceptStorage) async throws -> SlotProviderDefineOutput
    func fill(input: SlotProviderFillInput, storage: ConceptStorage) async throws -> SlotProviderFillOutput
    func clear(input: SlotProviderClearInput, storage: ConceptStorage) async throws -> SlotProviderClearOutput
    func getSlots(input: SlotProviderGetSlotsInput, storage: ConceptStorage) async throws -> SlotProviderGetSlotsOutput
}

// MARK: - Implementation

public struct SlotProviderHandlerImpl: SlotProviderHandler {
    public init() {}

    private let pluginRef = "surface-provider:slot"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func initialize(
        input: SlotProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderInitializeOutput {
        if let _ = try await storage.get(relation: "slotProvider", key: pluginRef) {
            return .alreadyInitialized(pluginRef: pluginRef)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "slotProvider",
            key: pluginRef,
            value: [
                "pluginRef": pluginRef,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(pluginRef: pluginRef)
    }

    public func define(
        input: SlotProviderDefineInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderDefineOutput {
        if let _ = try await storage.get(relation: "slot", key: input.slotName) {
            return .alreadyDefined(slotName: input.slotName)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "slot",
            key: input.slotName,
            value: [
                "slotName": input.slotName,
                "description": input.description,
                "content": "",
                "filled": "false",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(slotName: input.slotName)
    }

    public func fill(
        input: SlotProviderFillInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderFillOutput {
        guard var record = try await storage.get(relation: "slot", key: input.slotName) else {
            return .notFound(message: "Slot '\(input.slotName)' not found")
        }
        let now = iso8601Now()
        record["content"] = input.content
        record["filled"] = "true"
        record["updatedAt"] = now
        try await storage.put(relation: "slot", key: input.slotName, value: record)
        return .ok(slotName: input.slotName)
    }

    public func clear(
        input: SlotProviderClearInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderClearOutput {
        guard var record = try await storage.get(relation: "slot", key: input.slotName) else {
            return .notFound(message: "Slot '\(input.slotName)' not found")
        }
        let now = iso8601Now()
        record["content"] = ""
        record["filled"] = "false"
        record["updatedAt"] = now
        try await storage.put(relation: "slot", key: input.slotName, value: record)
        return .ok(slotName: input.slotName)
    }

    public func getSlots(
        input: SlotProviderGetSlotsInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderGetSlotsOutput {
        let results = try await storage.find(relation: "slot", criteria: nil)
        let slotNames = results.compactMap { $0["slotName"] as? String }
        return .ok(slotNames: slotNames)
    }
}
