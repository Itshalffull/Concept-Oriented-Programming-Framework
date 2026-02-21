// generated: PageAsRecord/Handler.swift

import Foundation

protocol PageAsRecordHandler {
    func create(
        input: PageAsRecordCreateInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordCreateOutput

    func setProperty(
        input: PageAsRecordSetPropertyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordSetPropertyOutput

    func getProperty(
        input: PageAsRecordGetPropertyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordGetPropertyOutput

    func appendToBody(
        input: PageAsRecordAppendToBodyInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordAppendToBodyOutput

    func attachToSchema(
        input: PageAsRecordAttachToSchemaInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordAttachToSchemaOutput

    func convertFromFreeform(
        input: PageAsRecordConvertFromFreeformInput,
        storage: ConceptStorage
    ) async throws -> PageAsRecordConvertFromFreeformOutput

}
