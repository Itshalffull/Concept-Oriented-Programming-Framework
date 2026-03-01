// generated: attribution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AttributionHandler: Send + Sync {
    async fn attribute(
        &self,
        input: AttributionAttributeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionAttributeOutput, Box<dyn std::error::Error>>;

    async fn blame(
        &self,
        input: AttributionBlameInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionBlameOutput, Box<dyn std::error::Error>>;

    async fn history(
        &self,
        input: AttributionHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionHistoryOutput, Box<dyn std::error::Error>>;

    async fn set_ownership(
        &self,
        input: AttributionSetOwnershipInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionSetOwnershipOutput, Box<dyn std::error::Error>>;

    async fn query_owners(
        &self,
        input: AttributionQueryOwnersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AttributionQueryOwnersOutput, Box<dyn std::error::Error>>;

}
