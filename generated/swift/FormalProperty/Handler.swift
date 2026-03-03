// generated: FormalProperty/Handler.swift

import Foundation

protocol FormalPropertyHandler {
    func define(
        input: FormalPropertyDefineInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyDefineOutput

    func prove(
        input: FormalPropertyProveInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyProveOutput

    func refute(
        input: FormalPropertyRefuteInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyRefuteOutput

    func check(
        input: FormalPropertyCheckInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyCheckOutput

    func synthesize(
        input: FormalPropertySynthesizeInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertySynthesizeOutput

    func coverage(
        input: FormalPropertyCoverageInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyCoverageOutput

    func list(
        input: FormalPropertyListInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyListOutput

    func invalidate(
        input: FormalPropertyInvalidateInput,
        storage: ConceptStorage
    ) async throws -> FormalPropertyInvalidateOutput

}