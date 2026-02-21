// generated: validator.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./validator.types";

export interface ValidatorHandler {
  registerConstraint(input: T.ValidatorRegisterConstraintInput, storage: ConceptStorage):
    Promise<T.ValidatorRegisterConstraintOutput>;
  addRule(input: T.ValidatorAddRuleInput, storage: ConceptStorage):
    Promise<T.ValidatorAddRuleOutput>;
  validate(input: T.ValidatorValidateInput, storage: ConceptStorage):
    Promise<T.ValidatorValidateOutput>;
  validateField(input: T.ValidatorValidateFieldInput, storage: ConceptStorage):
    Promise<T.ValidatorValidateFieldOutput>;
  coerce(input: T.ValidatorCoerceInput, storage: ConceptStorage):
    Promise<T.ValidatorCoerceOutput>;
  addCustomValidator(input: T.ValidatorAddCustomValidatorInput, storage: ConceptStorage):
    Promise<T.ValidatorAddCustomValidatorOutput>;
}
