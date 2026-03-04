// ManifestAutomationProviderImpl.swift — ManifestAutomationProvider concept implementation

import Foundation

// MARK: - Types

public enum ManifestAutomationProviderRegisterOutput: Codable {
    case ok(providerName: String)
    case alreadyRegistered(providerName: String)

    enum CodingKeys: String, CodingKey {
        case variant, providerName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(providerName: try container.decode(String.self, forKey: .providerName))
        case "alreadyRegistered":
            self = .alreadyRegistered(providerName: try container.decode(String.self, forKey: .providerName))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let providerName):
            try container.encode("ok", forKey: .variant)
            try container.encode(providerName, forKey: .providerName)
        case .alreadyRegistered(let providerName):
            try container.encode("alreadyRegistered", forKey: .variant)
            try container.encode(providerName, forKey: .providerName)
        }
    }
}

public struct ManifestAutomationProviderLoadInput: Codable {
    public let manifestPath: String

    public init(manifestPath: String) {
        self.manifestPath = manifestPath
    }
}

public enum ManifestAutomationProviderLoadOutput: Codable {
    case ok(manifestPath: String, entryCount: Int)
    case invalidManifest(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, manifestPath, entryCount, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                manifestPath: try container.decode(String.self, forKey: .manifestPath),
                entryCount: try container.decode(Int.self, forKey: .entryCount)
            )
        case "invalidManifest":
            self = .invalidManifest(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let manifestPath, let entryCount):
            try container.encode("ok", forKey: .variant)
            try container.encode(manifestPath, forKey: .manifestPath)
            try container.encode(entryCount, forKey: .entryCount)
        case .invalidManifest(let message):
            try container.encode("invalidManifest", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ManifestAutomationProviderExecuteInput: Codable {
    public let actionRef: String
    public let input: String

    public init(actionRef: String, input: String) {
        self.actionRef = actionRef
        self.input = input
    }
}

public enum ManifestAutomationProviderExecuteOutput: Codable {
    case ok(actionRef: String, result: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, actionRef, result, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                actionRef: try container.decode(String.self, forKey: .actionRef),
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
        case .ok(let actionRef, let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(actionRef, forKey: .actionRef)
            try container.encode(result, forKey: .result)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct ManifestAutomationProviderLookupInput: Codable {
    public let actionRef: String

    public init(actionRef: String) {
        self.actionRef = actionRef
    }
}

public enum ManifestAutomationProviderLookupOutput: Codable {
    case ok(actionRef: String, manifestPath: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, actionRef, manifestPath, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                actionRef: try container.decode(String.self, forKey: .actionRef),
                manifestPath: try container.decode(String.self, forKey: .manifestPath)
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
        case .ok(let actionRef, let manifestPath):
            try container.encode("ok", forKey: .variant)
            try container.encode(actionRef, forKey: .actionRef)
            try container.encode(manifestPath, forKey: .manifestPath)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol ManifestAutomationProviderHandler {
    func register(storage: ConceptStorage) async throws -> ManifestAutomationProviderRegisterOutput
    func load(input: ManifestAutomationProviderLoadInput, storage: ConceptStorage) async throws -> ManifestAutomationProviderLoadOutput
    func execute(input: ManifestAutomationProviderExecuteInput, storage: ConceptStorage) async throws -> ManifestAutomationProviderExecuteOutput
    func lookup(input: ManifestAutomationProviderLookupInput, storage: ConceptStorage) async throws -> ManifestAutomationProviderLookupOutput
}

// MARK: - Implementation

public struct ManifestAutomationProviderHandlerImpl: ManifestAutomationProviderHandler {
    public init() {}

    private let providerName = "manifest"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func register(
        storage: ConceptStorage
    ) async throws -> ManifestAutomationProviderRegisterOutput {
        if let _ = try await storage.get(relation: "automationProvider", key: providerName) {
            return .alreadyRegistered(providerName: providerName)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "automationProvider",
            key: providerName,
            value: [
                "name": providerName,
                "type": "manifest",
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(providerName: providerName)
    }

    public func load(
        input: ManifestAutomationProviderLoadInput,
        storage: ConceptStorage
    ) async throws -> ManifestAutomationProviderLoadOutput {
        guard !input.manifestPath.isEmpty else {
            return .invalidManifest(message: "Manifest path cannot be empty")
        }
        let now = iso8601Now()
        let manifestId = UUID().uuidString
        try await storage.put(
            relation: "automationManifest",
            key: manifestId,
            value: [
                "manifestId": manifestId,
                "manifestPath": input.manifestPath,
                "provider": providerName,
                "entryCount": 0,
                "loadedAt": now,
            ]
        )
        return .ok(manifestPath: input.manifestPath, entryCount: 0)
    }

    public func execute(
        input: ManifestAutomationProviderExecuteInput,
        storage: ConceptStorage
    ) async throws -> ManifestAutomationProviderExecuteOutput {
        let entries = try await storage.find(
            relation: "automationManifestEntry",
            criteria: ["actionRef": input.actionRef]
        )
        guard let entry = entries.first else {
            return .notFound(message: "Action '\(input.actionRef)' not found in any loaded manifest")
        }
        let handler = entry["handler"] as? String ?? "default"
        let result = "manifest:\(handler):\(input.actionRef):\(input.input)"
        return .ok(actionRef: input.actionRef, result: result)
    }

    public func lookup(
        input: ManifestAutomationProviderLookupInput,
        storage: ConceptStorage
    ) async throws -> ManifestAutomationProviderLookupOutput {
        let entries = try await storage.find(
            relation: "automationManifestEntry",
            criteria: ["actionRef": input.actionRef]
        )
        guard let entry = entries.first,
              let manifestId = entry["manifestId"] as? String else {
            return .notFound(message: "Action '\(input.actionRef)' not found in any loaded manifest")
        }
        guard let manifest = try await storage.get(relation: "automationManifest", key: manifestId),
              let manifestPath = manifest["manifestPath"] as? String else {
            return .notFound(message: "Manifest for action '\(input.actionRef)' not found")
        }
        return .ok(actionRef: input.actionRef, manifestPath: manifestPath)
    }
}
