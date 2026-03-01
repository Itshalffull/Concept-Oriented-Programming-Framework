// generated: kit_manager/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait KitManagerHandler: Send + Sync {
    async fn init(
        &self,
        input: KitManagerInitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerInitOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: KitManagerValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerValidateOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: KitManagerTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerTestOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: KitManagerListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerListOutput, Box<dyn std::error::Error>>;

    async fn check_overrides(
        &self,
        input: KitManagerCheckOverridesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KitManagerCheckOverridesOutput, Box<dyn std::error::Error>>;

}
