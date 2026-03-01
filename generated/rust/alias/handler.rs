// generated: alias/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AliasHandler: Send + Sync {
    async fn add_alias(
        &self,
        input: AliasAddAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasAddAliasOutput, Box<dyn std::error::Error>>;

    async fn remove_alias(
        &self,
        input: AliasRemoveAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasRemoveAliasOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: AliasResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AliasResolveOutput, Box<dyn std::error::Error>>;

}
