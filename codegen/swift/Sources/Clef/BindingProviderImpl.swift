// BindingProviderImpl.swift — Surface Provider: Binding concept implementation

import Foundation

// MARK: - Types

public struct BindingProviderInitializeInput: Codable {
    public let pluginRef: String

    public init(pluginRef: String) {
        self.pluginRef = pluginRef
    }
}

public enum BindingProviderInitializeOutput: Codable {
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

public struct BindingProviderBindInput: Codable {
    public let bindingId: String
    public let sourceKey: String
    public let targetKey: String

    public init(bindingId: String, sourceKey: String, targetKey: String) {
        self.bindingId = bindingId
        self.sourceKey = sourceKey
        self.targetKey = targetKey
    }
}

public enum BindingProviderBindOutput: Codable {
    case ok(bindingId: String)
    case alreadyBound(bindingId: String)

    enum CodingKeys: String, CodingKey {
        case variant, bindingId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(bindingId: try container.decode(String.self, forKey: .bindingId))
        case "alreadyBound":
            self = .alreadyBound(bindingId: try container.decode(String.self, forKey: .bindingId))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .alreadyBound(let bindingId):
            try container.encode("alreadyBound", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        }
    }
}

public struct BindingProviderSyncInput: Codable {
    public let bindingId: String

    public init(bindingId: String) {
        self.bindingId = bindingId
    }
}

public enum BindingProviderSyncOutput: Codable {
    case ok(bindingId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, bindingId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(bindingId: try container.decode(String.self, forKey: .bindingId))
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
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct BindingProviderInvokeInput: Codable {
    public let bindingId: String
    public let payload: String

    public init(bindingId: String, payload: String) {
        self.bindingId = bindingId
        self.payload = payload
    }
}

public enum BindingProviderInvokeOutput: Codable {
    case ok(bindingId: String, result: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, bindingId, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                bindingId: try container.decode(String.self, forKey: .bindingId),
                result: try container.decode(String.self, forKey: .result)
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
        case .ok(let bindingId, let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
            try container.encode(result, forKey: .result)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct BindingProviderUnbindInput: Codable {
    public let bindingId: String

    public init(bindingId: String) {
        self.bindingId = bindingId
    }
}

public enum BindingProviderUnbindOutput: Codable {
    case ok(bindingId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, bindingId, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(bindingId: try container.decode(String.self, forKey: .bindingId))
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
        case .ok(let bindingId):
            try container.encode("ok", forKey: .variant)
            try container.encode(bindingId, forKey: .bindingId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol BindingProviderHandler {
    func initialize(input: BindingProviderInitializeInput, storage: ConceptStorage) async throws -> BindingProviderInitializeOutput
    func bind(input: BindingProviderBindInput, storage: ConceptStorage) async throws -> BindingProviderBindOutput
    func sync(input: BindingProviderSyncInput, storage: ConceptStorage) async throws -> BindingProviderSyncOutput
    func invoke(input: BindingProviderInvokeInput, storage: ConceptStorage) async throws -> BindingProviderInvokeOutput
    func unbind(input: BindingProviderUnbindInput, storage: ConceptStorage) async throws -> BindingProviderUnbindOutput
}

// MARK: - Implementation

public struct BindingProviderHandlerImpl: BindingProviderHandler {
    public init() {}

    private let pluginRef = "surface-provider:binding"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func initialize(
        input: BindingProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderInitializeOutput {
        if let _ = try await storage.get(relation: "bindingProvider", key: pluginRef) {
            return .alreadyInitialized(pluginRef: pluginRef)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "bindingProvider",
            key: pluginRef,
            value: [
                "pluginRef": pluginRef,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(pluginRef: pluginRef)
    }

    public func bind(
        input: BindingProviderBindInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderBindOutput {
        if let _ = try await storage.get(relation: "binding", key: input.bindingId) {
            return .alreadyBound(bindingId: input.bindingId)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "binding",
            key: input.bindingId,
            value: [
                "bindingId": input.bindingId,
                "sourceKey": input.sourceKey,
                "targetKey": input.targetKey,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(bindingId: input.bindingId)
    }

    public func sync(
        input: BindingProviderSyncInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderSyncOutput {
        guard let record = try await storage.get(relation: "binding", key: input.bindingId) else {
            return .notFound(message: "Binding '\(input.bindingId)' not found")
        }
        let now = iso8601Now()
        var updated = record
        updated["updatedAt"] = now
        try await storage.put(relation: "binding", key: input.bindingId, value: updated)
        return .ok(bindingId: input.bindingId)
    }

    public func invoke(
        input: BindingProviderInvokeInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderInvokeOutput {
        guard let _ = try await storage.get(relation: "binding", key: input.bindingId) else {
            return .notFound(message: "Binding '\(input.bindingId)' not found")
        }
        let result = "invoked:\(input.bindingId):\(input.payload)"
        return .ok(bindingId: input.bindingId, result: result)
    }

    public func unbind(
        input: BindingProviderUnbindInput,
        storage: ConceptStorage
    ) async throws -> BindingProviderUnbindOutput {
        guard let _ = try await storage.get(relation: "binding", key: input.bindingId) else {
            return .notFound(message: "Binding '\(input.bindingId)' not found")
        }
        try await storage.del(relation: "binding", key: input.bindingId)
        return .ok(bindingId: input.bindingId)
    }
}
