// generated: design_token_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DesignTokenProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: DesignTokenProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: DesignTokenProviderResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderResolveOutput, Box<dyn std::error::Error>>;

    async fn switch_theme(
        &self,
        input: DesignTokenProviderSwitchThemeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderSwitchThemeOutput, Box<dyn std::error::Error>>;

    async fn get_tokens(
        &self,
        input: DesignTokenProviderGetTokensInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderGetTokensOutput, Box<dyn std::error::Error>>;

    async fn export(
        &self,
        input: DesignTokenProviderExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesignTokenProviderExportOutput, Box<dyn std::error::Error>>;
}
