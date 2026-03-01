// generated: typography/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypographyHandler: Send + Sync {
    async fn define_scale(
        &self,
        input: TypographyDefineScaleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineScaleOutput, Box<dyn std::error::Error>>;

    async fn define_font_stack(
        &self,
        input: TypographyDefineFontStackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineFontStackOutput, Box<dyn std::error::Error>>;

    async fn define_style(
        &self,
        input: TypographyDefineStyleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineStyleOutput, Box<dyn std::error::Error>>;

}
