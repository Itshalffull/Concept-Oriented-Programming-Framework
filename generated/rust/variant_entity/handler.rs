// generated: variant_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VariantEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: VariantEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn matching_syncs(
        &self,
        input: VariantEntityMatchingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityMatchingSyncsOutput, Box<dyn std::error::Error>>;

    async fn is_dead(
        &self,
        input: VariantEntityIsDeadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityIsDeadOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: VariantEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VariantEntityGetOutput, Box<dyn std::error::Error>>;

}
