// generated: theme_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ThemeDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
