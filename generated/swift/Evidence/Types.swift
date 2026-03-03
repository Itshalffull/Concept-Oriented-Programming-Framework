// generated: Evidence/Types.swift

import Foundation

struct EvidenceRecordInput: Codable {
    let artifact_type: String
    let content: Data
    let solver_metadata: Data
    let property_ref: String
    let confidence_score: Double?
}

enum EvidenceRecordOutput: Codable {
    case ok(evidence: String, content_hash: String)
    case invalid(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case evidence
        case content_hash
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                evidence: try container.decode(String.self, forKey: .evidence),
                content_hash: try container.decode(String.self, forKey: .content_hash)
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
        case .ok(let evidence, let content_hash):
            try container.encode("ok", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
            try container.encode(content_hash, forKey: .content_hash)
        case .invalid(let message):
            try container.encode("invalid", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EvidenceValidateInput: Codable {
    let evidence: String
}

enum EvidenceValidateOutput: Codable {
    case ok(evidence: String, valid: Bool)
    case corrupted(evidence: String, message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case evidence
        case valid
        case evidence
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                evidence: try container.decode(String.self, forKey: .evidence),
                valid: try container.decode(Bool.self, forKey: .valid)
            )
        case "corrupted":
            self = .corrupted(
                evidence: try container.decode(String.self, forKey: .evidence),
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let evidence, let valid):
            try container.encode("ok", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
            try container.encode(valid, forKey: .valid)
        case .corrupted(let evidence, let message):
            try container.encode("corrupted", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
            try container.encode(message, forKey: .message)
        }
    }
}

struct EvidenceRetrieveInput: Codable {
    let evidence: String
}

enum EvidenceRetrieveOutput: Codable {
    case ok(evidence: String, content: Data, metadata: Data)
    case notfound(evidence: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case evidence
        case content
        case metadata
        case evidence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                evidence: try container.decode(String.self, forKey: .evidence),
                content: try container.decode(Data.self, forKey: .content),
                metadata: try container.decode(Data.self, forKey: .metadata)
            )
        case "notfound":
            self = .notfound(
                evidence: try container.decode(String.self, forKey: .evidence)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let evidence, let content, let metadata):
            try container.encode("ok", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
            try container.encode(content, forKey: .content)
            try container.encode(metadata, forKey: .metadata)
        case .notfound(let evidence):
            try container.encode("notfound", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
        }
    }
}

struct EvidenceCompareInput: Codable {
    let evidence1: String
    let evidence2: String
}

enum EvidenceCompareOutput: Codable {
    case ok(identical: Bool, diff: String?)

    enum CodingKeys: String, CodingKey {
        case variant
        case identical
        case diff
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                identical: try container.decode(Bool.self, forKey: .identical),
                diff: try container.decode(String?.self, forKey: .diff)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let identical, let diff):
            try container.encode("ok", forKey: .variant)
            try container.encode(identical, forKey: .identical)
            try container.encode(diff, forKey: .diff)
        }
    }
}

struct EvidenceMinimizeInput: Codable {
    let evidence: String
}

enum EvidenceMinimizeOutput: Codable {
    case ok(minimized: String, reduction_pct: Double)
    case not_applicable(evidence: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case minimized
        case reduction_pct
        case evidence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                minimized: try container.decode(String.self, forKey: .minimized),
                reduction_pct: try container.decode(Double.self, forKey: .reduction_pct)
            )
        case "not_applicable":
            self = .not_applicable(
                evidence: try container.decode(String.self, forKey: .evidence)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let minimized, let reduction_pct):
            try container.encode("ok", forKey: .variant)
            try container.encode(minimized, forKey: .minimized)
            try container.encode(reduction_pct, forKey: .reduction_pct)
        case .not_applicable(let evidence):
            try container.encode("not_applicable", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
        }
    }
}

struct EvidenceListInput: Codable {
    let property_ref: String?
    let artifact_type: String?
}

enum EvidenceListOutput: Codable {
    case ok(evidence: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case evidence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                evidence: try container.decode([String].self, forKey: .evidence)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let evidence):
            try container.encode("ok", forKey: .variant)
            try container.encode(evidence, forKey: .evidence)
        }
    }
}
