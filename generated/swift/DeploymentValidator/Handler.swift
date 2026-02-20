// generated: DeploymentValidator/Handler.swift

import Foundation

protocol DeploymentValidatorHandler {
    func parse(
        input: DeploymentValidatorParseInput,
        storage: ConceptStorage
    ) async throws -> DeploymentValidatorParseOutput

    func validate(
        input: DeploymentValidatorValidateInput,
        storage: ConceptStorage
    ) async throws -> DeploymentValidatorValidateOutput

}
