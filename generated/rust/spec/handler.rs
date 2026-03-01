// generated: spec/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SpecHandler: Send + Sync {
    async fn emit(
        &self,
        input: SpecEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecEmitOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: SpecValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecValidateOutput, Box<dyn std::error::Error>>;

}
