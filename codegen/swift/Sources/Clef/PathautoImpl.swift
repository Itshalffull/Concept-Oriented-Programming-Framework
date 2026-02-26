// PathautoImpl.swift — Pathauto concept implementation

import Foundation

// MARK: - Types

public struct PathautoGenerateAliasInput: Codable {
    public let nodeId: String
    public let title: String

    public init(nodeId: String, title: String) {
        self.nodeId = nodeId
        self.title = title
    }
}

public enum PathautoGenerateAliasOutput: Codable {
    case ok(nodeId: String, alias: String)

    enum CodingKeys: String, CodingKey {
        case variant, nodeId, alias
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                nodeId: try container.decode(String.self, forKey: .nodeId),
                alias: try container.decode(String.self, forKey: .alias)
            )
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let nodeId, let alias):
            try container.encode("ok", forKey: .variant)
            try container.encode(nodeId, forKey: .nodeId)
            try container.encode(alias, forKey: .alias)
        }
    }
}

public struct PathautoBulkGenerateInput: Codable {
    public let nodeType: String

    public init(nodeType: String) {
        self.nodeType = nodeType
    }
}

public enum PathautoBulkGenerateOutput: Codable {
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

public struct PathautoCleanStringInput: Codable {
    public let input: String

    public init(input: String) {
        self.input = input
    }
}

public enum PathautoCleanStringOutput: Codable {
    case ok(cleaned: String)

    enum CodingKeys: String, CodingKey {
        case variant, cleaned
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(cleaned: try container.decode(String.self, forKey: .cleaned))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let cleaned):
            try container.encode("ok", forKey: .variant)
            try container.encode(cleaned, forKey: .cleaned)
        }
    }
}

// MARK: - Handler Protocol

public protocol PathautoHandler {
    func generateAlias(input: PathautoGenerateAliasInput, storage: ConceptStorage) async throws -> PathautoGenerateAliasOutput
    func bulkGenerate(input: PathautoBulkGenerateInput, storage: ConceptStorage) async throws -> PathautoBulkGenerateOutput
    func cleanString(input: PathautoCleanStringInput, storage: ConceptStorage) async throws -> PathautoCleanStringOutput
}

// MARK: - Implementation

public struct PathautoHandlerImpl: PathautoHandler {
    public init() {}

    private func generateCleanAlias(_ title: String) -> String {
        let lowered = title.lowercased()
        let cleaned = lowered.unicodeScalars.filter { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == " "
        }
        let result = String(cleaned)
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: " ", with: "-")
        // Collapse multiple dashes
        var collapsed = ""
        var lastWasDash = false
        for char in result {
            if char == "-" {
                if !lastWasDash {
                    collapsed.append(char)
                }
                lastWasDash = true
            } else {
                collapsed.append(char)
                lastWasDash = false
            }
        }
        return collapsed
    }

    public func generateAlias(
        input: PathautoGenerateAliasInput,
        storage: ConceptStorage
    ) async throws -> PathautoGenerateAliasOutput {
        let alias = generateCleanAlias(input.title)

        // Check for pattern
        let patterns = try await storage.find(relation: "path_pattern", criteria: nil)
        var finalAlias = alias
        if let pattern = patterns.first {
            let prefix = pattern["prefix"] as? String ?? ""
            if !prefix.isEmpty {
                finalAlias = "\(prefix)/\(alias)"
            }
        }

        try await storage.put(
            relation: "path_alias",
            key: input.nodeId,
            value: [
                "nodeId": input.nodeId,
                "alias": finalAlias,
                "title": input.title,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        return .ok(nodeId: input.nodeId, alias: finalAlias)
    }

    public func bulkGenerate(
        input: PathautoBulkGenerateInput,
        storage: ConceptStorage
    ) async throws -> PathautoBulkGenerateOutput {
        let aliases = try await storage.find(relation: "path_alias", criteria: ["nodeType": input.nodeType])
        var count = 0
        for aliasRecord in aliases {
            let nodeId = aliasRecord["nodeId"] as? String ?? ""
            let title = aliasRecord["title"] as? String ?? ""
            if !nodeId.isEmpty && !title.isEmpty {
                let alias = generateCleanAlias(title)
                var updated = aliasRecord
                updated["alias"] = alias
                try await storage.put(relation: "path_alias", key: nodeId, value: updated)
                count += 1
            }
        }
        return .ok(count: count)
    }

    public func cleanString(
        input: PathautoCleanStringInput,
        storage: ConceptStorage
    ) async throws -> PathautoCleanStringOutput {
        let cleaned = generateCleanAlias(input.input)
        return .ok(cleaned: cleaned)
    }
}
