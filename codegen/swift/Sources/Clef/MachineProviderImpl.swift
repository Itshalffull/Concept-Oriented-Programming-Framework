// MachineProviderImpl.swift — Surface Provider: Machine concept implementation

import Foundation

// MARK: - Types

public struct MachineProviderInitializeInput: Codable {
    public let pluginRef: String

    public init(pluginRef: String) {
        self.pluginRef = pluginRef
    }
}

public enum MachineProviderInitializeOutput: Codable {
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

public struct MachineProviderSpawnInput: Codable {
    public let machineId: String
    public let initialState: String

    public init(machineId: String, initialState: String) {
        self.machineId = machineId
        self.initialState = initialState
    }
}

public enum MachineProviderSpawnOutput: Codable {
    case ok(machineId: String, currentState: String)
    case alreadyExists(machineId: String)

    enum CodingKeys: String, CodingKey {
        case variant, machineId, currentState
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                machineId: try container.decode(String.self, forKey: .machineId),
                currentState: try container.decode(String.self, forKey: .currentState)
            )
        case "alreadyExists":
            self = .alreadyExists(machineId: try container.decode(String.self, forKey: .machineId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let machineId, let currentState):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
            try container.encode(currentState, forKey: .currentState)
        case .alreadyExists(let machineId):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
        }
    }
}

public struct MachineProviderSendInput: Codable {
    public let machineId: String
    public let event: String

    public init(machineId: String, event: String) {
        self.machineId = machineId
        self.event = event
    }
}

public enum MachineProviderSendOutput: Codable {
    case ok(machineId: String, previousState: String, currentState: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, machineId, previousState, currentState, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                machineId: try container.decode(String.self, forKey: .machineId),
                previousState: try container.decode(String.self, forKey: .previousState),
                currentState: try container.decode(String.self, forKey: .currentState)
            )
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
        case .ok(let machineId, let previousState, let currentState):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
            try container.encode(previousState, forKey: .previousState)
            try container.encode(currentState, forKey: .currentState)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MachineProviderConnectInput: Codable {
    public let sourceMachineId: String
    public let targetMachineId: String
    public let event: String

    public init(sourceMachineId: String, targetMachineId: String, event: String) {
        self.sourceMachineId = sourceMachineId
        self.targetMachineId = targetMachineId
        self.event = event
    }
}

public enum MachineProviderConnectOutput: Codable {
    case ok(connectionId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, connectionId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(connectionId: try container.decode(String.self, forKey: .connectionId))
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
        case .ok(let connectionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(connectionId, forKey: .connectionId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct MachineProviderDestroyInput: Codable {
    public let machineId: String

    public init(machineId: String) {
        self.machineId = machineId
    }
}

public enum MachineProviderDestroyOutput: Codable {
    case ok(machineId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, machineId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(machineId: try container.decode(String.self, forKey: .machineId))
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
        case .ok(let machineId):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol MachineProviderHandler {
    func initialize(input: MachineProviderInitializeInput, storage: ConceptStorage) async throws -> MachineProviderInitializeOutput
    func spawn(input: MachineProviderSpawnInput, storage: ConceptStorage) async throws -> MachineProviderSpawnOutput
    func send(input: MachineProviderSendInput, storage: ConceptStorage) async throws -> MachineProviderSendOutput
    func connect(input: MachineProviderConnectInput, storage: ConceptStorage) async throws -> MachineProviderConnectOutput
    func destroy(input: MachineProviderDestroyInput, storage: ConceptStorage) async throws -> MachineProviderDestroyOutput
}

// MARK: - Implementation

public struct MachineProviderHandlerImpl: MachineProviderHandler {
    public init() {}

    private let pluginRef = "surface-provider:machine"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func initialize(
        input: MachineProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderInitializeOutput {
        if let _ = try await storage.get(relation: "machineProvider", key: pluginRef) {
            return .alreadyInitialized(pluginRef: pluginRef)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "machineProvider",
            key: pluginRef,
            value: [
                "pluginRef": pluginRef,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(pluginRef: pluginRef)
    }

    public func spawn(
        input: MachineProviderSpawnInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderSpawnOutput {
        if let _ = try await storage.get(relation: "machine", key: input.machineId) {
            return .alreadyExists(machineId: input.machineId)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "machine",
            key: input.machineId,
            value: [
                "machineId": input.machineId,
                "currentState": input.initialState,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(machineId: input.machineId, currentState: input.initialState)
    }

    public func send(
        input: MachineProviderSendInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderSendOutput {
        guard var record = try await storage.get(relation: "machine", key: input.machineId) else {
            return .notFound(message: "Machine '\(input.machineId)' not found")
        }
        let previousState = record["currentState"] as? String ?? "unknown"
        let newState = "\(previousState):\(input.event)"
        let now = iso8601Now()
        record["currentState"] = newState
        record["updatedAt"] = now
        try await storage.put(relation: "machine", key: input.machineId, value: record)
        return .ok(machineId: input.machineId, previousState: previousState, currentState: newState)
    }

    public func connect(
        input: MachineProviderConnectInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderConnectOutput {
        guard let _ = try await storage.get(relation: "machine", key: input.sourceMachineId) else {
            return .notFound(message: "Source machine '\(input.sourceMachineId)' not found")
        }
        guard let _ = try await storage.get(relation: "machine", key: input.targetMachineId) else {
            return .notFound(message: "Target machine '\(input.targetMachineId)' not found")
        }
        let connectionId = "\(input.sourceMachineId)->\(input.targetMachineId):\(input.event)"
        let now = iso8601Now()
        try await storage.put(
            relation: "machineConnection",
            key: connectionId,
            value: [
                "connectionId": connectionId,
                "sourceMachineId": input.sourceMachineId,
                "targetMachineId": input.targetMachineId,
                "event": input.event,
                "createdAt": now,
            ]
        )
        return .ok(connectionId: connectionId)
    }

    public func destroy(
        input: MachineProviderDestroyInput,
        storage: ConceptStorage
    ) async throws -> MachineProviderDestroyOutput {
        guard let _ = try await storage.get(relation: "machine", key: input.machineId) else {
            return .notFound(message: "Machine '\(input.machineId)' not found")
        }
        try await storage.del(relation: "machine", key: input.machineId)
        return .ok(machineId: input.machineId)
    }
}
