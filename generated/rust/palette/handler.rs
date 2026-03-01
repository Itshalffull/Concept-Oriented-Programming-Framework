// generated: palette/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PaletteHandler: Send + Sync {
    async fn generate(
        &self,
        input: PaletteGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteGenerateOutput, Box<dyn std::error::Error>>;

    async fn assign_role(
        &self,
        input: PaletteAssignRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteAssignRoleOutput, Box<dyn std::error::Error>>;

    async fn check_contrast(
        &self,
        input: PaletteCheckContrastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteCheckContrastOutput, Box<dyn std::error::Error>>;

}
