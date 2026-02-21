// generated: synced_content/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncedContentHandler: Send + Sync {
    async fn create_reference(
        &self,
        input: SyncedContentCreateReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentCreateReferenceOutput, Box<dyn std::error::Error>>;

    async fn edit_original(
        &self,
        input: SyncedContentEditOriginalInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentEditOriginalOutput, Box<dyn std::error::Error>>;

    async fn delete_reference(
        &self,
        input: SyncedContentDeleteReferenceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentDeleteReferenceOutput, Box<dyn std::error::Error>>;

    async fn convert_to_independent(
        &self,
        input: SyncedContentConvertToIndependentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncedContentConvertToIndependentOutput, Box<dyn std::error::Error>>;

}
