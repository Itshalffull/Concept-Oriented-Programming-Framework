// RendererImpl.swift — Renderer concept implementation

import Foundation

// MARK: - Types

public struct RendererRenderInput: Codable {
    public let elementId: String
    public let context: String

    public init(elementId: String, context: String) {
        self.elementId = elementId
        self.context = context
    }
}

public enum RendererRenderOutput: Codable {
    case ok(elementId: String, output: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case elementId
        case output
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                elementId: try container.decode(String.self, forKey: .elementId),
                output: try container.decode(String.self, forKey: .output)
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
        case .ok(let elementId, let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(elementId, forKey: .elementId)
            try container.encode(output, forKey: .output)
        }
    }
}

public struct RendererAutoPlaceholderInput: Codable {
    public let elementId: String

    public init(elementId: String) {
        self.elementId = elementId
    }
}

public enum RendererAutoPlaceholderOutput: Codable {
    case ok(elementId: String, placeholderId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case elementId
        case placeholderId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                elementId: try container.decode(String.self, forKey: .elementId),
                placeholderId: try container.decode(String.self, forKey: .placeholderId)
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
        case .ok(let elementId, let placeholderId):
            try container.encode("ok", forKey: .variant)
            try container.encode(elementId, forKey: .elementId)
            try container.encode(placeholderId, forKey: .placeholderId)
        }
    }
}

public struct RendererMergeCacheabilityInput: Codable {
    public let parentTags: String
    public let childTags: String

    public init(parentTags: String, childTags: String) {
        self.parentTags = parentTags
        self.childTags = childTags
    }
}

public enum RendererMergeCacheabilityOutput: Codable {
    case ok(mergedTags: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case mergedTags
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(mergedTags: try container.decode(String.self, forKey: .mergedTags))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let mergedTags):
            try container.encode("ok", forKey: .variant)
            try container.encode(mergedTags, forKey: .mergedTags)
        }
    }
}

// MARK: - Handler Protocol

public protocol RendererHandler {
    func render(input: RendererRenderInput, storage: ConceptStorage) async throws -> RendererRenderOutput
    func autoPlaceholder(input: RendererAutoPlaceholderInput, storage: ConceptStorage) async throws -> RendererAutoPlaceholderOutput
    func mergeCacheability(input: RendererMergeCacheabilityInput, storage: ConceptStorage) async throws -> RendererMergeCacheabilityOutput
}

// MARK: - Implementation

public struct RendererHandlerImpl: RendererHandler {
    public init() {}

    public func render(
        input: RendererRenderInput,
        storage: ConceptStorage
    ) async throws -> RendererRenderOutput {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let now = formatter.string(from: Date())

        let rendered: [String: String] = [
            "elementId": input.elementId,
            "context": input.context,
            "renderedAt": now,
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: rendered, options: [.sortedKeys])
        let output = String(data: jsonData, encoding: .utf8) ?? "{}"

        // Cache the render result
        try await storage.put(
            relation: "render_cache",
            key: input.elementId,
            value: [
                "elementId": input.elementId,
                "output": output,
                "renderedAt": now,
            ]
        )

        return .ok(elementId: input.elementId, output: output)
    }

    public func autoPlaceholder(
        input: RendererAutoPlaceholderInput,
        storage: ConceptStorage
    ) async throws -> RendererAutoPlaceholderOutput {
        let placeholderId = "placeholder-\(UUID().uuidString)"

        try await storage.put(
            relation: "render_cache",
            key: placeholderId,
            value: [
                "elementId": input.elementId,
                "placeholderId": placeholderId,
                "type": "placeholder",
            ]
        )

        return .ok(elementId: input.elementId, placeholderId: placeholderId)
    }

    public func mergeCacheability(
        input: RendererMergeCacheabilityInput,
        storage: ConceptStorage
    ) async throws -> RendererMergeCacheabilityOutput {
        var parentSet: [String] = []
        var childSet: [String] = []

        if let data = input.parentTags.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            parentSet = parsed
        }

        if let data = input.childTags.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
            childSet = parsed
        }

        // Merge: union of both tag sets
        var merged = Set(parentSet)
        for tag in childSet {
            merged.insert(tag)
        }

        let mergedArray = Array(merged).sorted()
        let jsonData = try JSONSerialization.data(withJSONObject: mergedArray, options: [.sortedKeys])
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

        return .ok(mergedTags: jsonString)
    }
}
