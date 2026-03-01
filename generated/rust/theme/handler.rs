// generated: theme/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ThemeHandler: Send + Sync {
    async fn create(
        &self,
        input: ThemeCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeCreateOutput, Box<dyn std::error::Error>>;

    async fn extend(
        &self,
        input: ThemeExtendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeExtendOutput, Box<dyn std::error::Error>>;

    async fn activate(
        &self,
        input: ThemeActivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeActivateOutput, Box<dyn std::error::Error>>;

    async fn deactivate(
        &self,
        input: ThemeDeactivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeDeactivateOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: ThemeResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeResolveOutput, Box<dyn std::error::Error>>;

}
