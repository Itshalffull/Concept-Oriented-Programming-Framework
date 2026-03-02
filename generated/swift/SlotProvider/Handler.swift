// generated: SlotProvider/Handler.swift

import Foundation

protocol SlotProviderHandler {
    func initialize(
        input: SlotProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderInitializeOutput

    func define(
        input: SlotProviderDefineInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderDefineOutput

    func fill(
        input: SlotProviderFillInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderFillOutput

    func clear(
        input: SlotProviderClearInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderClearOutput

    func getSlots(
        input: SlotProviderGetSlotsInput,
        storage: ConceptStorage
    ) async throws -> SlotProviderGetSlotsOutput

}
