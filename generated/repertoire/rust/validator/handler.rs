// generated: validator/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ValidatorHandler: Send + Sync {
    async fn register_constraint(
        &self,
        input: ValidatorRegisterConstraintInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorRegisterConstraintOutput, Box<dyn std::error::Error>>;

    async fn add_rule(
        &self,
        input: ValidatorAddRuleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorAddRuleOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: ValidatorValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorValidateOutput, Box<dyn std::error::Error>>;

    async fn validate_field(
        &self,
        input: ValidatorValidateFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorValidateFieldOutput, Box<dyn std::error::Error>>;

    async fn coerce(
        &self,
        input: ValidatorCoerceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorCoerceOutput, Box<dyn std::error::Error>>;

    async fn add_custom_validator(
        &self,
        input: ValidatorAddCustomValidatorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ValidatorAddCustomValidatorOutput, Box<dyn std::error::Error>>;

}
