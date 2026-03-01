// generated: expression_language/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ExpressionLanguageHandler: Send + Sync {
    async fn register_language(
        &self,
        input: ExpressionLanguageRegisterLanguageInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterLanguageOutput, Box<dyn std::error::Error>>;

    async fn register_function(
        &self,
        input: ExpressionLanguageRegisterFunctionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterFunctionOutput, Box<dyn std::error::Error>>;

    async fn register_operator(
        &self,
        input: ExpressionLanguageRegisterOperatorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageRegisterOperatorOutput, Box<dyn std::error::Error>>;

    async fn parse(
        &self,
        input: ExpressionLanguageParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageParseOutput, Box<dyn std::error::Error>>;

    async fn evaluate(
        &self,
        input: ExpressionLanguageEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageEvaluateOutput, Box<dyn std::error::Error>>;

    async fn type_check(
        &self,
        input: ExpressionLanguageTypeCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageTypeCheckOutput, Box<dyn std::error::Error>>;

    async fn get_completions(
        &self,
        input: ExpressionLanguageGetCompletionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExpressionLanguageGetCompletionsOutput, Box<dyn std::error::Error>>;

}
