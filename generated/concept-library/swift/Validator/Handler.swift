// generated: Validator/Handler.swift

import Foundation

protocol ValidatorHandler {
    func registerConstraint(
        input: ValidatorRegisterConstraintInput,
        storage: ConceptStorage
    ) async throws -> ValidatorRegisterConstraintOutput

    func addRule(
        input: ValidatorAddRuleInput,
        storage: ConceptStorage
    ) async throws -> ValidatorAddRuleOutput

    func validate(
        input: ValidatorValidateInput,
        storage: ConceptStorage
    ) async throws -> ValidatorValidateOutput

    func validateField(
        input: ValidatorValidateFieldInput,
        storage: ConceptStorage
    ) async throws -> ValidatorValidateFieldOutput

    func coerce(
        input: ValidatorCoerceInput,
        storage: ConceptStorage
    ) async throws -> ValidatorCoerceOutput

    func addCustomValidator(
        input: ValidatorAddCustomValidatorInput,
        storage: ConceptStorage
    ) async throws -> ValidatorAddCustomValidatorOutput

}
