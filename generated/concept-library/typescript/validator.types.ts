// generated: validator.types.ts

export interface ValidatorRegisterConstraintInput {
  validator: string;
  constraint: string;
}

export type ValidatorRegisterConstraintOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface ValidatorAddRuleInput {
  validator: string;
  field: string;
  rule: string;
}

export type ValidatorAddRuleOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface ValidatorValidateInput {
  validator: string;
  data: string;
}

export type ValidatorValidateOutput =
  { variant: "ok"; valid: boolean; errors: string };

export interface ValidatorValidateFieldInput {
  validator: string;
  field: string;
  value: string;
}

export type ValidatorValidateFieldOutput =
  { variant: "ok"; valid: boolean; errors: string };

export interface ValidatorCoerceInput {
  validator: string;
  data: string;
}

export type ValidatorCoerceOutput =
  { variant: "ok"; coerced: string }
  | { variant: "error"; message: string };

export interface ValidatorAddCustomValidatorInput {
  validator: string;
  name: string;
  implementation: string;
}

export type ValidatorAddCustomValidatorOutput =
  { variant: "ok" }
  | { variant: "exists" };

