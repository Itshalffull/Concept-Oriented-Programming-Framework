// generated: Authentication/Adapter.swift

import Foundation

class AuthenticationAdapter: ConceptTransport {
    private let handler: any AuthenticationHandler
    private let storage: ConceptStorage

    init(handler: any AuthenticationHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "register":
            let input = try decoder.decode(AuthenticationRegisterInput.self, from: invocation.inputData)
            let output = try await handler.register(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "login":
            let input = try decoder.decode(AuthenticationLoginInput.self, from: invocation.inputData)
            let output = try await handler.login(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "logout":
            let input = try decoder.decode(AuthenticationLogoutInput.self, from: invocation.inputData)
            let output = try await handler.logout(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "authenticate":
            let input = try decoder.decode(AuthenticationAuthenticateInput.self, from: invocation.inputData)
            let output = try await handler.authenticate(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "resetPassword":
            let input = try decoder.decode(AuthenticationResetPasswordInput.self, from: invocation.inputData)
            let output = try await handler.resetPassword(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        default:
            throw ConceptError.unknownAction(invocation.action)
        }
    }

    func query(request: ConceptQuery) async throws -> [Data] {
        try await storage.find(relation: request.relation, args: request.args)
    }

    func health() async throws -> (healthy: Bool, latencyMs: UInt64) {
        (true, 0)
    }
}
