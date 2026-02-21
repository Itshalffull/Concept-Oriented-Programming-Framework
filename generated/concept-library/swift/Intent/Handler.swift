// generated: Intent/Handler.swift

import Foundation

protocol IntentHandler {
    func define(
        input: IntentDefineInput,
        storage: ConceptStorage
    ) async throws -> IntentDefineOutput

    func update(
        input: IntentUpdateInput,
        storage: ConceptStorage
    ) async throws -> IntentUpdateOutput

    func verify(
        input: IntentVerifyInput,
        storage: ConceptStorage
    ) async throws -> IntentVerifyOutput

    func discover(
        input: IntentDiscoverInput,
        storage: ConceptStorage
    ) async throws -> IntentDiscoverOutput

    func suggestFromDescription(
        input: IntentSuggestFromDescriptionInput,
        storage: ConceptStorage
    ) async throws -> IntentSuggestFromDescriptionOutput

}
