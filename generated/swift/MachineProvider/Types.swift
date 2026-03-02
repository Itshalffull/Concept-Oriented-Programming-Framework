// generated: MachineProvider/Types.swift

import Foundation

struct MachineProviderInitializeInput: Codable {
    let pluginRef: String
}

enum MachineProviderInitializeOutput: Codable {
    case ok(pluginRef: String)
    case alreadyInitialized(pluginRef: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case pluginRef
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                pluginRef: try container.decode(String.self, forKey: .pluginRef)
            )
        case "alreadyInitialized":
            self = .alreadyInitialized(
                pluginRef: try container.decode(String.self, forKey: .pluginRef)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let pluginRef):
            try container.encode("ok", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        case .alreadyInitialized(let pluginRef):
            try container.encode("alreadyInitialized", forKey: .variant)
            try container.encode(pluginRef, forKey: .pluginRef)
        }
    }
}

struct MachineProviderSpawnInput: Codable {
    let machineId: String
    let initialState: String
}

enum MachineProviderSpawnOutput: Codable {
    case ok(machineId: String, currentState: String)
    case alreadyExists(machineId: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case machineId
        case currentState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                machineId: try container.decode(String.self, forKey: .machineId),
                currentState: try container.decode(String.self, forKey: .currentState)
            )
        case "alreadyExists":
            self = .alreadyExists(
                machineId: try container.decode(String.self, forKey: .machineId)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let machineId, let currentState):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
            try container.encode(currentState, forKey: .currentState)
        case .alreadyExists(let machineId):
            try container.encode("alreadyExists", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
        }
    }
}

struct MachineProviderSendInput: Codable {
    let machineId: String
    let event: String
}

enum MachineProviderSendOutput: Codable {
    case ok(machineId: String, previousState: String, currentState: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case machineId
        case previousState
        case currentState
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                machineId: try container.decode(String.self, forKey: .machineId),
                previousState: try container.decode(String.self, forKey: .previousState),
                currentState: try container.decode(String.self, forKey: .currentState)
            )
        case "notFound":
            self = .notFound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let machineId, let previousState, let currentState):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
            try container.encode(previousState, forKey: .previousState)
            try container.encode(currentState, forKey: .currentState)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct MachineProviderConnectInput: Codable {
    let sourceMachineId: String
    let targetMachineId: String
    let event: String
}

enum MachineProviderConnectOutput: Codable {
    case ok(connectionId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case connectionId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                connectionId: try container.decode(String.self, forKey: .connectionId)
            )
        case "notFound":
            self = .notFound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let connectionId):
            try container.encode("ok", forKey: .variant)
            try container.encode(connectionId, forKey: .connectionId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}

struct MachineProviderDestroyInput: Codable {
    let machineId: String
}

enum MachineProviderDestroyOutput: Codable {
    case ok(machineId: String)
    case notFound(message: String)

    enum CodingKeys: String, CodingKey {
        case variant
        case machineId
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let variant = try container.decode(String.self, forKey: .variant)
        switch variant {
        case "ok":
            self = .ok(
                machineId: try container.decode(String.self, forKey: .machineId)
            )
        case "notFound":
            self = .notFound(
                message: try container.decode(String.self, forKey: .message)
            )
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \(variant)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .ok(let machineId):
            try container.encode("ok", forKey: .variant)
            try container.encode(machineId, forKey: .machineId)
        case .notFound(let message):
            try container.encode("notFound", forKey: .variant)
            try container.encode(message, forKey: .message)
        }
    }
}
