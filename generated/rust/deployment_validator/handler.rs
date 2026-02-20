// generated: deployment_validator/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DeploymentValidatorHandler: Send + Sync {
    async fn parse(
        &self,
        input: DeploymentValidatorParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeploymentValidatorParseOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: DeploymentValidatorValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeploymentValidatorValidateOutput, Box<dyn std::error::Error>>;

}
