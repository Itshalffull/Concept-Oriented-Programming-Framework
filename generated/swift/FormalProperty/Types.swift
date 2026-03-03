// generated: FormalProperty/Types.swift

import Foundation

struct FormalPropertyDefineInput: Codable {
    let target_symbol: String
    let kind: String
    let property_text: String
    let formal_language: String
    let scope: String
    let priority: String
}

enum FormalPropertyDefineOutput: Codable {
    case ok(property: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property: try container.decode(String.self, forKey: .property)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let property):
            try container.encode("ok", forKey: .variant)
            try container.encode(property, forKey: .property)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FormalPropertyProveInput: Codable {
    let property: String
    let evidence_ref: String
}

enum FormalPropertyProveOutput: Codable {
    case ok(property: String, evidence: String)
    case notfound(property: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property
        case evidence
        case property
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property: try container.decode(String.self, forKey: .property),
                evidence: try container.decode(String.self, forKey: .evidence)
            )
        case "notfound":
            self = .notfound(
                property: try container.decode(String.self, forKey: .property)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let property, let evidence):
            try container.encode("ok", forKey: .variant)
            try container.encode(property, forKey: .property)
            try container.encode(evidence, forKey: .evidence)
        case .notfound(let property):
            try container.encode("notfound", forKey: .variant)
            try container.encode(property, forKey: .property)
        }
    }
}

struct FormalPropertyRefuteInput: Codable {
    let property: String
    let evidence_ref: String
}

enum FormalPropertyRefuteOutput: Codable {
    case ok(property: String, counterexample: String)
    case notfound(property: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property
        case counterexample
        case property
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property: try container.decode(String.self, forKey: .property),
                counterexample: try container.decode(String.self, forKey: .counterexample)
            )
        case "notfound":
            self = .notfound(
                property: try container.decode(String.self, forKey: .property)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let property, let counterexample):
            try container.encode("ok", forKey: .variant)
            try container.encode(property, forKey: .property)
            try container.encode(counterexample, forKey: .counterexample)
        case .notfound(let property):
            try container.encode("notfound", forKey: .variant)
            try container.encode(property, forKey: .property)
        }
    }
}

struct FormalPropertyCheckInput: Codable {
    let property: String
    let solver: String
    let timeout_ms: Int
}

enum FormalPropertyCheckOutput: Codable {
    case ok(property: String, status: String)
    case timeout(property: String, elapsed_ms: Int)
    case unknown(property: String, reason: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property
        case status
        case property
        case elapsed_ms
        case property
        case reason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property: try container.decode(String.self, forKey: .property),
                status: try container.decode(String.self, forKey: .status)
            )
        case "timeout":
            self = .timeout(
                property: try container.decode(String.self, forKey: .property),
                elapsed_ms: try container.decode(Int.self, forKey: .elapsed_ms)
            )
        case "unknown":
            self = .unknown(
                property: try container.decode(String.self, forKey: .property),
                reason: try container.decode(String.self, forKey: .reason)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let property, let status):
            try container.encode("ok", forKey: .variant)
            try container.encode(property, forKey: .property)
            try container.encode(status, forKey: .status)
        case .timeout(let property, let elapsed_ms):
            try container.encode("timeout", forKey: .variant)
            try container.encode(property, forKey: .property)
            try container.encode(elapsed_ms, forKey: .elapsed_ms)
        case .unknown(let property, let reason):
            try container.encode("unknown", forKey: .variant)
            try container.encode(property, forKey: .property)
            try container.encode(reason, forKey: .reason)
        }
    }
}

struct FormalPropertySynthesizeInput: Codable {
    let target_symbol: String
    let intent_ref: String
}

enum FormalPropertySynthesizeOutput: Codable {
    case ok(properties: [String])
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case properties
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                properties: try container.decode([String].self, forKey: .properties)
            )
        case "invalid":
            self = .invalid(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let properties):
            try container.encode("ok", forKey: .variant)
            try container.encode(properties, forKey: .properties)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct FormalPropertyCoverageInput: Codable {
    let target_symbol: String
}

enum FormalPropertyCoverageOutput: Codable {
    case ok(total: Int, proved: Int, refuted: Int, unknown: Int, timeout: Int, coverage_pct: Double)

    enum CodingKeys: String, CodingKey {
        case variant
        case total
        case proved
        case refuted
        case unknown
        case timeout
        case coverage_pct
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                total: try container.decode(Int.self, forKey: .total),
                proved: try container.decode(Int.self, forKey: .proved),
                refuted: try container.decode(Int.self, forKey: .refuted),
                unknown: try container.decode(Int.self, forKey: .unknown),
                timeout: try container.decode(Int.self, forKey: .timeout),
                coverage_pct: try container.decode(Double.self, forKey: .coverage_pct)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let total, let proved, let refuted, let unknown, let timeout, let coverage_pct):
            try container.encode("ok", forKey: .variant)
            try container.encode(total, forKey: .total)
            try container.encode(proved, forKey: .proved)
            try container.encode(refuted, forKey: .refuted)
            try container.encode(unknown, forKey: .unknown)
            try container.encode(timeout, forKey: .timeout)
            try container.encode(coverage_pct, forKey: .coverage_pct)
        }
    }
}

struct FormalPropertyListInput: Codable {
    let target_symbol: String?
    let kind: String?
    let status: String?
}

enum FormalPropertyListOutput: Codable {
    case ok(properties: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case properties
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                properties: try container.decode([String].self, forKey: .properties)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let properties):
            try container.encode("ok", forKey: .variant)
            try container.encode(properties, forKey: .properties)
        }
    }
}

struct FormalPropertyInvalidateInput: Codable {
    let property: String
}

enum FormalPropertyInvalidateOutput: Codable {
    case ok(property: String)
    case notfound(property: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case property
        case property
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                property: try container.decode(String.self, forKey: .property)
            )
        case "notfound":
            self = .notfound(
                property: try container.decode(String.self, forKey: .property)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let property):
            try container.encode("ok", forKey: .variant)
            try container.encode(property, forKey: .property)
        case .notfound(let property):
            try container.encode("notfound", forKey: .variant)
            try container.encode(property, forKey: .property)
        }
    }
}
