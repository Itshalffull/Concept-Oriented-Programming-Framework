// generated: Intent/Types.swift

import Foundation

struct IntentDefineInput: Codable {
    let intent: String
    let target: String
    let purpose: String
    let operationalPrinciple: String
}

enum IntentDefineOutput: Codable {
    case ok(intent: String)
    case exists(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case intent
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                intent: try container.decode(String.self, forKey: .intent)
            )
        case "exists":
            self = .exists(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let intent):
            try container.encode("ok", forKey: .variant)
            try container.encode(intent, forKey: .intent)
        case .exists(let message):
            try container.encode("exists", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct IntentUpdateInput: Codable {
    let intent: String
    let purpose: String
    let operationalPrinciple: String
}

enum IntentUpdateOutput: Codable {
    case ok(intent: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case intent
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                intent: try container.decode(String.self, forKey: .intent)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let intent):
            try container.encode("ok", forKey: .variant)
            try container.encode(intent, forKey: .intent)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct IntentVerifyInput: Codable {
    let intent: String
}

enum IntentVerifyOutput: Codable {
    case ok(valid: Bool, failures: String)
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case valid
        case failures
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                valid: try container.decode(Bool.self, forKey: .valid),
                failures: try container.decode(String.self, forKey: .failures)
            )
        case "notfound":
            self = .notfound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let valid, let failures):
            try container.encode("ok", forKey: .variant)
            try container.encode(valid, forKey: .valid)
            try container.encode(failures, forKey: .failures)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct IntentDiscoverInput: Codable {
    let query: String
}

enum IntentDiscoverOutput: Codable {
    case ok(matches: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case matches
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                matches: try container.decode(String.self, forKey: .matches)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let matches):
            try container.encode("ok", forKey: .variant)
            try container.encode(matches, forKey: .matches)
        }
    }
}

struct IntentSuggestFromDescriptionInput: Codable {
    let description: String
}

enum IntentSuggestFromDescriptionOutput: Codable {
    case ok(suggested: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case suggested
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                suggested: try container.decode(String.self, forKey: .suggested)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let suggested):
            try container.encode("ok", forKey: .variant)
            try container.encode(suggested, forKey: .suggested)
        }
    }
}

