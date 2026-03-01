// generated: Escalation/Types.swift

import Foundation

struct EscalationEscalateInput: Codable {
    let processId: String
    let stepId: String
    let reason: String
    let targetLevel: String
}

enum EscalationEscalateOutput: Codable {
    case ok(escalationId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case escalationId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                escalationId: try container.decode(String.self, forKey: .escalationId)
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
        case .ok(let escalationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(escalationId, forKey: .escalationId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EscalationAcceptInput: Codable {
    let escalationId: String
    let acceptedBy: String
}

enum EscalationAcceptOutput: Codable {
    case ok
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EscalationResolveInput: Codable {
    let escalationId: String
    let resolution: String
}

enum EscalationResolveOutput: Codable {
    case ok
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok": self = .ok
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
        case .ok:
            try container.encode("ok", forKey: .variant)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EscalationReEscalateInput: Codable {
    let escalationId: String
    let reason: String
    let newTargetLevel: String
}

enum EscalationReEscalateOutput: Codable {
    case ok(newEscalationId: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case newEscalationId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                newEscalationId: try container.decode(String.self, forKey: .newEscalationId)
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
        case .ok(let newEscalationId):
            try container.encode("ok", forKey: .variant)
            try container.encode(newEscalationId, forKey: .newEscalationId)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
