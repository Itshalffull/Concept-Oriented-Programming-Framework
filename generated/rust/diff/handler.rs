// generated: diff/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DiffHandler: Send + Sync {
    async fn register_provider(
        &self,
        input: DiffRegisterProviderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DiffRegisterProviderOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: DiffDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DiffDiffOutput, Box<dyn std::error::Error>>;

    async fn patch(
        &self,
        input: DiffPatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DiffPatchOutput, Box<dyn std::error::Error>>;

}
