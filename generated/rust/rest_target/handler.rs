// generated: rest_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RestTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: RestTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetGenerateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: RestTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetValidateOutput, Box<dyn std::error::Error>>;

    async fn list_routes(
        &self,
        input: RestTargetListRoutesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RestTargetListRoutesOutput, Box<dyn std::error::Error>>;

}
