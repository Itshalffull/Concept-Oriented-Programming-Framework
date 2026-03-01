// generated: theme_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: ThemeEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ThemeEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityGetOutput, Box<dyn std::error::Error>>;

    async fn resolve_token(
        &self,
        input: ThemeEntityResolveTokenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityResolveTokenOutput, Box<dyn std::error::Error>>;

    async fn contrast_audit(
        &self,
        input: ThemeEntityContrastAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityContrastAuditOutput, Box<dyn std::error::Error>>;

    async fn diff_themes(
        &self,
        input: ThemeEntityDiffThemesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityDiffThemesOutput, Box<dyn std::error::Error>>;

    async fn affected_widgets(
        &self,
        input: ThemeEntityAffectedWidgetsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityAffectedWidgetsOutput, Box<dyn std::error::Error>>;

    async fn generated_outputs(
        &self,
        input: ThemeEntityGeneratedOutputsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeEntityGeneratedOutputsOutput, Box<dyn std::error::Error>>;

}
