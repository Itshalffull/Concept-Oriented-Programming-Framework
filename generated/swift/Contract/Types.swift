// generated: Contract/Types.swift

import Foundation

struct ContractDefineInput: Codable {
    let name: String
    let source_concept: String
    let target_concept: String
    let assumptions: [String]
    let guarantees: [String]
}

enum ContractDefineOutput: Codable {
    case ok(contract: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case contract
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                contract: try container.decode(String.self, forKey: .contract)
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
        case .ok(let contract):
            try container.encode("ok", forKey: .variant)
            try container.encode(contract, forKey: .contract)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContractVerifyInput: Codable {
    let contract: String
}

enum ContractVerifyOutput: Codable {
    case ok(contract: String, compatible: Bool)
    case incompatible(contract: String, violations: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case contract
        case compatible
        case contract
        case violations
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                contract: try container.decode(String.self, forKey: .contract),
                compatible: try container.decode(Bool.self, forKey: .compatible)
            )
        case "incompatible":
            self = .incompatible(
                contract: try container.decode(String.self, forKey: .contract),
                violations: try container.decode([String].self, forKey: .violations)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let contract, let compatible):
            try container.encode("ok", forKey: .variant)
            try container.encode(contract, forKey: .contract)
            try container.encode(compatible, forKey: .compatible)
        case .incompatible(let contract, let violations):
            try container.encode("incompatible", forKey: .variant)
            try container.encode(contract, forKey: .contract)
            try container.encode(violations, forKey: .violations)
        }
    }
}

struct ContractComposeInput: Codable {
    let contracts: [String]
}

enum ContractComposeOutput: Codable {
    case ok(composed: String, transitive_guarantees: [String])
    case incompatible(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case composed
        case transitive_guarantees
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                composed: try container.decode(String.self, forKey: .composed),
                transitive_guarantees: try container.decode([String].self, forKey: .transitive_guarantees)
            )
        case "incompatible":
            self = .incompatible(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let composed, let transitive_guarantees):
            try container.encode("ok", forKey: .variant)
            try container.encode(composed, forKey: .composed)
            try container.encode(transitive_guarantees, forKey: .transitive_guarantees)
        case .incompatible(let message):
            try container.encode("incompatible", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContractDischargeInput: Codable {
    let contract: String
    let assumption_ref: String
    let evidence_ref: String
}

enum ContractDischargeOutput: Codable {
    case ok(contract: String, remaining: [String])
    case notfound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case contract
        case remaining
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                contract: try container.decode(String.self, forKey: .contract),
                remaining: try container.decode([String].self, forKey: .remaining)
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
        case .ok(let contract, let remaining):
            try container.encode("ok", forKey: .variant)
            try container.encode(contract, forKey: .contract)
            try container.encode(remaining, forKey: .remaining)
        case .notfound(let message):
            try container.encode("notfound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct ContractListInput: Codable {
    let source_concept: String?
    let target_concept: String?
}

enum ContractListOutput: Codable {
    case ok(contracts: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case contracts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                contracts: try container.decode([String].self, forKey: .contracts)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let contracts):
            try container.encode("ok", forKey: .variant)
            try container.encode(contracts, forKey: .contracts)
        }
    }
}
