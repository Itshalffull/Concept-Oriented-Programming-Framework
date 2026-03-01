// generated: env/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EnvHandler: Send + Sync {
    async fn resolve(
        &self,
        input: EnvResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvResolveOutput, Box<dyn std::error::Error>>;

    async fn promote(
        &self,
        input: EnvPromoteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvPromoteOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: EnvDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnvDiffOutput, Box<dyn std::error::Error>>;

}
