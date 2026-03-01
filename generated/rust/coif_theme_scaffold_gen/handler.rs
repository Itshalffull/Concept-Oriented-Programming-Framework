// generated: coif_theme_scaffold_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CoifThemeScaffoldGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: CoifThemeScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn preview(
        &self,
        input: CoifThemeScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenPreviewOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: CoifThemeScaffoldGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenRegisterOutput, Box<dyn std::error::Error>>;

}
