// generated: Milestone/Types.swift

import Foundation

struct MilestoneDefineInput: Codable {
    let runRef: String
    let name: String
    let conditionExpr: String
}

enum MilestoneDefineOutput: Codable {
    case ok(milestone: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case milestone
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                milestone: try container.decode(String.self, forKey: .milestone)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let milestone):
            try container.encode("ok", forKey: .variant)
            try container.encode(milestone, forKey: .milestone)
        }
    }
}

struct MilestoneEvaluateInput: Codable {
    let milestone: String
    let context: Data
}

enum MilestoneEvaluateOutput: Codable {
    case achieved(milestone: String, name: String, runRef: String)
    case notYet(milestone: String)
    case alreadyAchieved(milestone: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case milestone
        case name
        case runRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "achieved":
            self = .achieved(
                milestone: try container.decode(String.self, forKey: .milestone),
                name: try container.decode(String.self, forKey: .name),
                runRef: try container.decode(String.self, forKey: .runRef)
            )
        case "notYet":
            self = .notYet(
                milestone: try container.decode(String.self, forKey: .milestone)
            )
        case "alreadyAchieved":
            self = .alreadyAchieved(
                milestone: try container.decode(String.self, forKey: .milestone)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .achieved(let milestone, let name, let runRef):
            try container.encode("achieved", forKey: .variant)
            try container.encode(milestone, forKey: .milestone)
            try container.encode(name, forKey: .name)
            try container.encode(runRef, forKey: .runRef)
        case .notYet(let milestone):
            try container.encode("notYet", forKey: .variant)
            try container.encode(milestone, forKey: .milestone)
        case .alreadyAchieved(let milestone):
            try container.encode("alreadyAchieved", forKey: .variant)
            try container.encode(milestone, forKey: .milestone)
        }
    }
}

struct MilestoneRevokeInput: Codable {
    let milestone: String
}

enum MilestoneRevokeOutput: Codable {
    case ok(milestone: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case milestone
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                milestone: try container.decode(String.self, forKey: .milestone)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let milestone):
            try container.encode("ok", forKey: .variant)
            try container.encode(milestone, forKey: .milestone)
        }
    }
}
