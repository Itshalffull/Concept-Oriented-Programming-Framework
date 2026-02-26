// generated: intent/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait IntentHandler: Send + Sync {
    async fn define(
        &self,
        input: IntentDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentDefineOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: IntentUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentUpdateOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: IntentVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentVerifyOutput, Box<dyn std::error::Error>>;

    async fn discover(
        &self,
        input: IntentDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentDiscoverOutput, Box<dyn std::error::Error>>;

    async fn suggest_from_description(
        &self,
        input: IntentSuggestFromDescriptionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IntentSuggestFromDescriptionOutput, Box<dyn std::error::Error>>;

}
