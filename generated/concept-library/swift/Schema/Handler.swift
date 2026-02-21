// generated: Schema/Handler.swift

import Foundation

protocol SchemaHandler {
    func defineSchema(
        input: SchemaDefineSchemaInput,
        storage: ConceptStorage
    ) async throws -> SchemaDefineSchemaOutput

    func addField(
        input: SchemaAddFieldInput,
        storage: ConceptStorage
    ) async throws -> SchemaAddFieldOutput

    func extendSchema(
        input: SchemaExtendSchemaInput,
        storage: ConceptStorage
    ) async throws -> SchemaExtendSchemaOutput

    func applyTo(
        input: SchemaApplyToInput,
        storage: ConceptStorage
    ) async throws -> SchemaApplyToOutput

    func removeFrom(
        input: SchemaRemoveFromInput,
        storage: ConceptStorage
    ) async throws -> SchemaRemoveFromOutput

    func getAssociations(
        input: SchemaGetAssociationsInput,
        storage: ConceptStorage
    ) async throws -> SchemaGetAssociationsOutput

    func export(
        input: SchemaExportInput,
        storage: ConceptStorage
    ) async throws -> SchemaExportOutput

}
