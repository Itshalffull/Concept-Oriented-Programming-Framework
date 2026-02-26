// ComputationTokenImpl.swift — ComputationToken concept implementation

import Foundation

// MARK: - Types

public struct ComputationTokenReplaceInput: Codable {
    public let text: String
    public let context: String

    public init(text: String, context: String) {
        self.text = text
        self.context = context
    }
}

public enum ComputationTokenReplaceOutput: Codable {
    case ok(result: String)

    enum CodingKeys: String, CodingKey {
        case variant, result
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(result: try container.decode(String.self, forKey: .result))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let result):
            try container.encode("ok", forKey: .variant)
            try container.encode(result, forKey: .result)
        }
    }
}

public struct ComputationTokenGetAvailableTokensInput: Codable {
    public let context: String

    public init(context: String) {
        self.context = context
    }
}

public enum ComputationTokenGetAvailableTokensOutput: Codable {
    case ok(tokens: String)

    enum CodingKeys: String, CodingKey {
        case variant, tokens
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(tokens: try container.decode(String.self, forKey: .tokens))
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
        }
    }
}

public struct ComputationTokenScanInput: Codable {
    public let text: String

    public init(text: String) {
        self.text = text
    }
}

public enum ComputationTokenScanOutput: Codable {
    case ok(matches: String)

    enum CodingKeys: String, CodingKey {
        case variant, matches
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(matches: try container.decode(String.self, forKey: .matches))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let matches):
            try container.encode("ok", forKey: .variant)
            try container.encode(matches, forKey: .matches)
        }
    }
}

public struct ComputationTokenRegisterProviderInput: Codable {
    public let tokenType: String
    public let resolverConfig: String

    public init(tokenType: String, resolverConfig: String) {
        self.tokenType = tokenType
        self.resolverConfig = resolverConfig
    }
}

public enum ComputationTokenRegisterProviderOutput: Codable {
    case ok(tokenType: String)

    enum CodingKeys: String, CodingKey {
        case variant, tokenType
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(tokenType: try container.decode(String.self, forKey: .tokenType))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let tokenType):
            try container.encode("ok", forKey: .variant)
            try container.encode(tokenType, forKey: .tokenType)
        }
    }
}

// MARK: - Handler Protocol

public protocol ComputationTokenHandler {
    func replace(input: ComputationTokenReplaceInput, storage: ConceptStorage) async throws -> ComputationTokenReplaceOutput
    func getAvailableTokens(input: ComputationTokenGetAvailableTokensInput, storage: ConceptStorage) async throws -> ComputationTokenGetAvailableTokensOutput
    func scan(input: ComputationTokenScanInput, storage: ConceptStorage) async throws -> ComputationTokenScanOutput
    func registerProvider(input: ComputationTokenRegisterProviderInput, storage: ConceptStorage) async throws -> ComputationTokenRegisterProviderOutput
}

// MARK: - Implementation

public struct ComputationTokenHandlerImpl: ComputationTokenHandler {
    public init() {}

    public func replace(
        input: ComputationTokenReplaceInput,
        storage: ConceptStorage
    ) async throws -> ComputationTokenReplaceOutput {
        let allTypes = try await storage.find(relation: "token_type", criteria: nil)
        var result = input.text
        for tokenRecord in allTypes {
            let tokenType = tokenRecord["tokenType"] as? String ?? ""
            let pattern = "[\(tokenType):"
            if result.contains(pattern) {
                result = result.replacingOccurrences(
                    of: pattern,
                    with: "resolved(\(tokenType), context=\(input.context))["
                )
            }
        }
        return .ok(result: result)
    }

    public func getAvailableTokens(
        input: ComputationTokenGetAvailableTokensInput,
        storage: ConceptStorage
    ) async throws -> ComputationTokenGetAvailableTokensOutput {
        let allTypes = try await storage.find(relation: "token_type", criteria: nil)
        let tokenNames = allTypes.compactMap { $0["tokenType"] as? String }
        let jsonData = try JSONSerialization.data(withJSONObject: tokenNames, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(tokens: jsonString)
    }

    public func scan(
        input: ComputationTokenScanInput,
        storage: ConceptStorage
    ) async throws -> ComputationTokenScanOutput {
        let allTypes = try await storage.find(relation: "token_type", criteria: nil)
        var matches: [String] = []
        for tokenRecord in allTypes {
            let tokenType = tokenRecord["tokenType"] as? String ?? ""
            if input.text.contains("[\(tokenType):") {
                matches.append(tokenType)
            }
        }
        let jsonData = try JSONSerialization.data(withJSONObject: matches, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        return .ok(matches: jsonString)
    }

    public func registerProvider(
        input: ComputationTokenRegisterProviderInput,
        storage: ConceptStorage
    ) async throws -> ComputationTokenRegisterProviderOutput {
        try await storage.put(
            relation: "token_type",
            key: input.tokenType,
            value: [
                "tokenType": input.tokenType,
                "resolverConfig": input.resolverConfig,
            ]
        )
        return .ok(tokenType: input.tokenType)
    }
}
