// generated: theme_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: ThemeGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeGenGenerateOutput, Box<dyn std::error::Error>>;

}
