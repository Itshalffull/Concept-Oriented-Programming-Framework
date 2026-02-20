// generated: DeploymentValidator/Types.swift

import Foundation

struct DeploymentValidatorParseInput: Codable {
    let raw: String
}

enum DeploymentValidatorParseOutput: Codable {
    case ok(manifest: String)
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case manifest
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                manifest: try container.decode(String.self, forKey: .manifest)
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
        case .ok(let manifest):
            try container.encode("ok", forKey: .variant)
            try container.encode(manifest, forKey: .manifest)
        case .error(let message):
            try container.encode("error", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct DeploymentValidatorValidateInput: Codable {
    let manifest: String
    let concepts: [Any]
    let syncs: [Any]
}

enum DeploymentValidatorValidateOutput: Codable {
    case ok(plan: Any)
    case warning(plan: Any, issues: [String])
    case error(issues: [String])

    enum CodingKeys: String, CodingKey {
        case variant
        case plan
        case plan
        case issues
        case issues
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                plan: try container.decode(Any.self, forKey: .plan)
            )
        case "warning":
            self = .warning(
                plan: try container.decode(Any.self, forKey: .plan),
                issues: try container.decode([String].self, forKey: .issues)
            )
        case "error":
            self = .error(
                issues: try container.decode([String].self, forKey: .issues)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let plan):
            try container.encode("ok", forKey: .variant)
            try container.encode(plan, forKey: .plan)
        case .warning(let plan, let issues):
            try container.encode("warning", forKey: .variant)
            try container.encode(plan, forKey: .plan)
            try container.encode(issues, forKey: .issues)
        case .error(let issues):
            try container.encode("error", forKey: .variant)
            try container.encode(issues, forKey: .issues)
        }
    }
}

