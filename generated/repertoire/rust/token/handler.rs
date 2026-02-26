// generated: token/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TokenHandler: Send + Sync {
    async fn replace(
        &self,
        input: TokenReplaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenReplaceOutput, Box<dyn std::error::Error>>;

    async fn get_available_tokens(
        &self,
        input: TokenGetAvailableTokensInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenGetAvailableTokensOutput, Box<dyn std::error::Error>>;

    async fn scan(
        &self,
        input: TokenScanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenScanOutput, Box<dyn std::error::Error>>;

    async fn register_provider(
        &self,
        input: TokenRegisterProviderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TokenRegisterProviderOutput, Box<dyn std::error::Error>>;

}
