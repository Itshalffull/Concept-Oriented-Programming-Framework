// generated: flag/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FlagHandler: Send + Sync {
    async fn flag(
        &self,
        input: FlagFlagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagFlagOutput, Box<dyn std::error::Error>>;

    async fn unflag(
        &self,
        input: FlagUnflagInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagUnflagOutput, Box<dyn std::error::Error>>;

    async fn is_flagged(
        &self,
        input: FlagIsFlaggedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagIsFlaggedOutput, Box<dyn std::error::Error>>;

    async fn get_count(
        &self,
        input: FlagGetCountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlagGetCountOutput, Box<dyn std::error::Error>>;

}
