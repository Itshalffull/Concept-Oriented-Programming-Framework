// generated: display_mode/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DisplayModeHandler: Send + Sync {
    async fn define_mode(
        &self,
        input: DisplayModeDefineModeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeDefineModeOutput, Box<dyn std::error::Error>>;

    async fn configure_field_display(
        &self,
        input: DisplayModeConfigureFieldDisplayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeConfigureFieldDisplayOutput, Box<dyn std::error::Error>>;

    async fn configure_field_form(
        &self,
        input: DisplayModeConfigureFieldFormInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeConfigureFieldFormOutput, Box<dyn std::error::Error>>;

    async fn render_in_mode(
        &self,
        input: DisplayModeRenderInModeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DisplayModeRenderInModeOutput, Box<dyn std::error::Error>>;

}
