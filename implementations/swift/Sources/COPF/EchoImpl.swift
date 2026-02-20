// EchoImpl.swift — Echo concept implementation

import Foundation

// MARK: - Types (matching generated Echo/Types.swift)

public struct EchoSendInput: Codable {
    public let id: String
    public let text: String

    public init(id: String, text: String) {
        self.id = id
        self.text = text
    }
}

public enum EchoSendOutput: Codable {
    case ok(id: String, echo: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case id
        case echo
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                id: try container.decode(String.self, forKey: .id),
                echo: try container.decode(String.self, forKey: .echo)
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
        case .ok(let id, let echo):
            try container.encode("ok", forKey: .variant)
            try container.encode(id, forKey: .id)
            try container.encode(echo, forKey: .echo)
        }
    }
}

// MARK: - Handler Protocol (matching generated Echo/Handler.swift)

public protocol EchoHandler {
    func send(
        input: EchoSendInput,
        storage: ConceptStorage
    ) async throws -> EchoSendOutput
}

// MARK: - Implementation

public struct EchoHandlerImpl: EchoHandler {
    public init() {}

    public func send(
        input: EchoSendInput,
        storage: ConceptStorage
    ) async throws -> EchoSendOutput {
        // Store the echo text
        try await storage.put(
            relation: "echo",
            key: input.id,
            value: [
                "id": input.id,
                "text": input.text,
            ]
        )

        // Return the text as echo
        return .ok(id: input.id, echo: input.text)
    }
}
