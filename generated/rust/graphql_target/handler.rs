// generated: graphql_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GraphqlTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: GraphqlTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: GraphqlTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_operations(
        &self,
        input: GraphqlTargetListOperationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GraphqlTargetListOperationsOutput, Box<dyn std::error::Error>>;

}
