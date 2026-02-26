// generated: FormBuilder/Handler.swift

import Foundation

protocol FormBuilderHandler {
    func buildForm(
        input: FormBuilderBuildFormInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderBuildFormOutput

    func validate(
        input: FormBuilderValidateInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderValidateOutput

    func processSubmission(
        input: FormBuilderProcessSubmissionInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderProcessSubmissionOutput

    func registerWidget(
        input: FormBuilderRegisterWidgetInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderRegisterWidgetOutput

    func getWidget(
        input: FormBuilderGetWidgetInput,
        storage: ConceptStorage
    ) async throws -> FormBuilderGetWidgetOutput

}
