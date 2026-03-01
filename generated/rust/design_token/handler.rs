// generated: design_token/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DesignTokenHandler: Send + Sync {
    async fn define(
        &self,
        input: DesignTokenDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenDefineOutput, Box<dyn std::error::Error>>;

    async fn alias(
        &self,
        input: DesignTokenAliasInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenAliasOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: DesignTokenResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenResolveOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: DesignTokenUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenUpdateOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: DesignTokenRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenRemoveOutput, Box<dyn std::error::Error>>;

    async fn export(
        &self,
        input: DesignTokenExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenExportOutput, Box<dyn std::error::Error>>;

}
