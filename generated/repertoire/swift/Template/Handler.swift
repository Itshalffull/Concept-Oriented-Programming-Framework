// generated: Template/Handler.swift

import Foundation

protocol TemplateHandler {
    func define(
        input: TemplateDefineInput,
        storage: ConceptStorage
    ) async throws -> TemplateDefineOutput

    func instantiate(
        input: TemplateInstantiateInput,
        storage: ConceptStorage
    ) async throws -> TemplateInstantiateOutput

    func registerTrigger(
        input: TemplateRegisterTriggerInput,
        storage: ConceptStorage
    ) async throws -> TemplateRegisterTriggerOutput

    func mergeProperties(
        input: TemplateMergePropertiesInput,
        storage: ConceptStorage
    ) async throws -> TemplateMergePropertiesOutput

}
