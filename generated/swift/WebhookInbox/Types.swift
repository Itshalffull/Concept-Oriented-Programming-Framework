// generated: WebhookInbox/Types.swift

import Foundation

struct WebhookInboxRegisterInput: Codable {
    let runRef: String
    let stepRef: String
    let eventType: String
    let correlationKey: String
}

enum WebhookInboxRegisterOutput: Codable {
    case ok(hook: String, runRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case hook
        case runRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                hook: try container.decode(String.self, forKey: .hook),
                runRef: try container.decode(String.self, forKey: .runRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let hook, let runRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(hook, forKey: .hook)
            try container.encode(runRef, forKey: .runRef)
        }
    }
}

struct WebhookInboxReceiveInput: Codable {
    let correlationKey: String
    let eventType: String
    let payload: Data
}

enum WebhookInboxReceiveOutput: Codable {
    case ok(hook: String, runRef: String, stepRef: String, payload: Data)
    case noMatch(correlationKey: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case hook
        case runRef
        case stepRef
        case payload
        case correlationKey
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                hook: try container.decode(String.self, forKey: .hook),
                runRef: try container.decode(String.self, forKey: .runRef),
                stepRef: try container.decode(String.self, forKey: .stepRef),
                payload: try container.decode(Data.self, forKey: .payload)
            )
        case "noMatch":
            self = .noMatch(
                correlationKey: try container.decode(String.self, forKey: .correlationKey)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let hook, let runRef, let stepRef, let payload):
            try container.encode("ok", forKey: .variant)
            try container.encode(hook, forKey: .hook)
            try container.encode(runRef, forKey: .runRef)
            try container.encode(stepRef, forKey: .stepRef)
            try container.encode(payload, forKey: .payload)
        case .noMatch(let correlationKey):
            try container.encode("noMatch", forKey: .variant)
            try container.encode(correlationKey, forKey: .correlationKey)
        }
    }
}

struct WebhookInboxExpireInput: Codable {
    let hook: String
}

enum WebhookInboxExpireOutput: Codable {
    case ok(hook: String, runRef: String, stepRef: String)
    case notWaiting(hook: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case hook
        case runRef
        case stepRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                hook: try container.decode(String.self, forKey: .hook),
                runRef: try container.decode(String.self, forKey: .runRef),
                stepRef: try container.decode(String.self, forKey: .stepRef)
            )
        case "notWaiting":
            self = .notWaiting(
                hook: try container.decode(String.self, forKey: .hook)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let hook, let runRef, let stepRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(hook, forKey: .hook)
            try container.encode(runRef, forKey: .runRef)
            try container.encode(stepRef, forKey: .stepRef)
        case .notWaiting(let hook):
            try container.encode("notWaiting", forKey: .variant)
            try container.encode(hook, forKey: .hook)
        }
    }
}

struct WebhookInboxAckInput: Codable {
    let hook: String
}

enum WebhookInboxAckOutput: Codable {
    case ok(hook: String)
    case notReceived(hook: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case hook
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                hook: try container.decode(String.self, forKey: .hook)
            )
        case "notReceived":
            self = .notReceived(
                hook: try container.decode(String.self, forKey: .hook)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let hook):
            try container.encode("ok", forKey: .variant)
            try container.encode(hook, forKey: .hook)
        case .notReceived(let hook):
            try container.encode("notReceived", forKey: .variant)
            try container.encode(hook, forKey: .hook)
        }
    }
}
