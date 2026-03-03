// generated: SpecificationSchema/Handler.swift

import Foundation

protocol SpecificationSchemaHandler {
    func define(
        input: SpecificationSchemaDefineInput,
        storage: ConceptStorage
    ) async throws -> SpecificationSchemaDefineOutput

    func instantiate(
        input: SpecificationSchemaInstantiateInput,
        storage: ConceptStorage
    ) async throws -> SpecificationSchemaInstantiateOutput

    func validate(
        input: SpecificationSchemaValidateInput,
        storage: ConceptStorage
    ) async throws -> SpecificationSchemaValidateOutput

    func list_by_category(
        input: SpecificationSchemaList_by_categoryInput,
        storage: ConceptStorage
    ) async throws -> SpecificationSchemaList_by_categoryOutput

    func search(
        input: SpecificationSchemaSearchInput,
        storage: ConceptStorage
    ) async throws -> SpecificationSchemaSearchOutput

}