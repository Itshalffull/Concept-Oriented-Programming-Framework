// DesignTokenProviderImpl.swift — Surface Provider: Design Token concept implementation

import Foundation

// MARK: - Types

public struct DesignTokenProviderInitializeInput: Codable {
    public let pluginRef: String

    public init(pluginRef: String) {
        self.pluginRef = pluginRef
    }
}

public enum DesignTokenProviderInitializeOutput: Codable {
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

public struct DesignTokenProviderResolveInput: Codable {
    public let tokenName: String
    public let themeName: String

    public init(tokenName: String, themeName: String) {
        self.tokenName = tokenName
        self.themeName = themeName
    }
}

public enum DesignTokenProviderResolveOutput: Codable {
    case ok(tokenName: String, value: String)
    case notFound(tokenName: String)

    enum CodingKeys: String, CodingKey {
        case variant, tokenName, value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                tokenName: try container.decode(String.self, forKey: .tokenName),
                value: try container.decode(String.self, forKey: .value)
            )
        case "notFound":
            self = .notFound(tokenName: try container.decode(String.self, forKey: .tokenName))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tokenName, let value):
            try container.encode("ok", forKey: .variant)
            try container.encode(tokenName, forKey: .tokenName)
            try container.encode(value, forKey: .value)
        case .notFound(let tokenName):
            try container.encode("notFound", forKey: .variant)
            try container.encode(tokenName, forKey: .tokenName)
        }
    }
}

public struct DesignTokenProviderSwitchThemeInput: Codable {
    public let themeName: String

    public init(themeName: String) {
        self.themeName = themeName
    }
}

public enum DesignTokenProviderSwitchThemeOutput: Codable {
    case ok(themeName: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, themeName, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(themeName: try container.decode(String.self, forKey: .themeName))
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
        case .ok(let themeName):
            try container.encode("ok", forKey: .variant)
            try container.encode(themeName, forKey: .themeName)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DesignTokenProviderGetTokensInput: Codable {
    public let themeName: String

    public init(themeName: String) {
        self.themeName = themeName
    }
}

public enum DesignTokenProviderGetTokensOutput: Codable {
    case ok(tokens: [String])
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, tokens, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(tokens: try container.decode([String].self, forKey: .tokens))
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
        case .ok(let tokens):
            try container.encode("ok", forKey: .variant)
            try container.encode(tokens, forKey: .tokens)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

public struct DesignTokenProviderExportInput: Codable {
    public let themeName: String
    public let format: String

    public init(themeName: String, format: String) {
        self.themeName = themeName
        self.format = format
    }
}

public enum DesignTokenProviderExportOutput: Codable {
    case ok(data: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant, data, message
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(data: try container.decode(String.self, forKey: .data))
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
        case .ok(let data):
            try container.encode("ok", forKey: .variant)
            try container.encode(data, forKey: .data)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

// MARK: - Handler Protocol

public protocol DesignTokenProviderHandler {
    func initialize(input: DesignTokenProviderInitializeInput, storage: ConceptStorage) async throws -> DesignTokenProviderInitializeOutput
    func resolve(input: DesignTokenProviderResolveInput, storage: ConceptStorage) async throws -> DesignTokenProviderResolveOutput
    func switchTheme(input: DesignTokenProviderSwitchThemeInput, storage: ConceptStorage) async throws -> DesignTokenProviderSwitchThemeOutput
    func getTokens(input: DesignTokenProviderGetTokensInput, storage: ConceptStorage) async throws -> DesignTokenProviderGetTokensOutput
    func export(input: DesignTokenProviderExportInput, storage: ConceptStorage) async throws -> DesignTokenProviderExportOutput
}

// MARK: - Implementation

public struct DesignTokenProviderHandlerImpl: DesignTokenProviderHandler {
    public init() {}

    private let pluginRef = "surface-provider:design-token"

    private func iso8601Now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }

    public func initialize(
        input: DesignTokenProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderInitializeOutput {
        if let _ = try await storage.get(relation: "designTokenProvider", key: pluginRef) {
            return .alreadyInitialized(pluginRef: pluginRef)
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "designTokenProvider",
            key: pluginRef,
            value: [
                "pluginRef": pluginRef,
                "createdAt": now,
                "updatedAt": now,
            ]
        )
        return .ok(pluginRef: pluginRef)
    }

    public func resolve(
        input: DesignTokenProviderResolveInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderResolveOutput {
        let compositeKey = "\(input.themeName):\(input.tokenName)"
        guard let record = try await storage.get(relation: "designToken", key: compositeKey) else {
            return .notFound(tokenName: input.tokenName)
        }
        let value = record["value"] as? String ?? ""
        return .ok(tokenName: input.tokenName, value: value)
    }

    public func switchTheme(
        input: DesignTokenProviderSwitchThemeInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderSwitchThemeOutput {
        let themes = try await storage.find(relation: "theme", criteria: ["name": input.themeName])
        guard !themes.isEmpty else {
            return .notFound(message: "Theme '\(input.themeName)' not found")
        }
        let now = iso8601Now()
        try await storage.put(
            relation: "activeTheme",
            key: "current",
            value: [
                "themeName": input.themeName,
                "updatedAt": now,
            ]
        )
        return .ok(themeName: input.themeName)
    }

    public func getTokens(
        input: DesignTokenProviderGetTokensInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderGetTokensOutput {
        let results = try await storage.find(relation: "designToken", criteria: ["themeName": input.themeName])
        guard !results.isEmpty else {
            return .notFound(message: "No tokens found for theme '\(input.themeName)'")
        }
        let tokenNames = results.compactMap { $0["tokenName"] as? String }
        return .ok(tokens: tokenNames)
    }

    public func export(
        input: DesignTokenProviderExportInput,
        storage: ConceptStorage
    ) async throws -> DesignTokenProviderExportOutput {
        let results = try await storage.find(relation: "designToken", criteria: ["themeName": input.themeName])
        guard !results.isEmpty else {
            return .notFound(message: "No tokens to export for theme '\(input.themeName)'")
        }
        let pairs = results.compactMap { record -> String? in
            guard let name = record["tokenName"] as? String,
                  let value = record["value"] as? String else { return nil }
            return "\(name): \(value)"
        }
        let data = pairs.joined(separator: "\n")
        return .ok(data: data)
    }
}
