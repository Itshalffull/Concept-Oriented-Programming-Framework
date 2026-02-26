// generated: Authorization/Adapter.swift

import Foundation

class AuthorizationAdapter: ConceptTransport {
    private let handler: any AuthorizationHandler
    private let storage: ConceptStorage

    init(handler: any AuthorizationHandler, storage: ConceptStorage) {
        self.handler = handler
        self.storage = storage
    }

    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {
        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        switch invocation.action {
        case "grantPermission":
            let input = try decoder.decode(AuthorizationGrantPermissionInput.self, from: invocation.inputData)
            let output = try await handler.grantPermission(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "revokePermission":
            let input = try decoder.decode(AuthorizationRevokePermissionInput.self, from: invocation.inputData)
            let output = try await handler.revokePermission(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "assignRole":
            let input = try decoder.decode(AuthorizationAssignRoleInput.self, from: invocation.inputData)
            let output = try await handler.assignRole(input: input, storage: storage)
            let outputData = try encoder.encode(output)
            return ActionCompletion(
                id: invocation.id,
                concept: invocation.concept,
                action: invocation.action,
                input: invocation.inputData,
                output: outputData,
                flow: invocation.flow
            )
        case "checkPermission":
            let input = try decoder.decode(AuthorizationCheckPermissionInput.self, from: invocation.inputData)
            let output = try await handler.checkPermission(input: input, storage: storage)
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
