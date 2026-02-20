// generated: FlowTrace/Types.swift

import Foundation

struct FlowTraceBuildInput: Codable {
    let flowId: String
}

enum FlowTraceBuildOutput: Codable {
    case ok(trace: String, tree: Any)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case trace
        case tree
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                trace: try container.decode(String.self, forKey: .trace),
                tree: try container.decode(Any.self, forKey: .tree)
            )
        case "error":
            self = .error(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let trace, let tree):
            try container.encode("ok", forKey: .variant)
            try container.encode(trace, forKey: .trace)
            try container.encode(tree, forKey: .tree)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FlowTraceRenderInput: Codable {
    let trace: String
    let options: Any
}

enum FlowTraceRenderOutput: Codable {
    case ok(output: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case output
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                output: try container.decode(String.self, forKey: .output)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let output):
            try container.encode("ok", forKey: .variant)
            try container.encode(output, forKey: .output)
        }
    }
}

