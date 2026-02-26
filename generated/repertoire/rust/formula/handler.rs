// generated: formula/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FormulaHandler: Send + Sync {
    async fn create(
        &self,
        input: FormulaCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaCreateOutput, Box<dyn std::error::Error>>;

    async fn evaluate(
        &self,
        input: FormulaEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaEvaluateOutput, Box<dyn std::error::Error>>;

    async fn get_dependencies(
        &self,
        input: FormulaGetDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaGetDependenciesOutput, Box<dyn std::error::Error>>;

    async fn invalidate(
        &self,
        input: FormulaInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaInvalidateOutput, Box<dyn std::error::Error>>;

    async fn set_expression(
        &self,
        input: FormulaSetExpressionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormulaSetExpressionOutput, Box<dyn std::error::Error>>;

}
