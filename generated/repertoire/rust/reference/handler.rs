// generated: reference/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ReferenceHandler: Send + Sync {
    async fn add_ref(
        &self,
        input: ReferenceAddRefInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceAddRefOutput, Box<dyn std::error::Error>>;

    async fn remove_ref(
        &self,
        input: ReferenceRemoveRefInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceRemoveRefOutput, Box<dyn std::error::Error>>;

    async fn get_refs(
        &self,
        input: ReferenceGetRefsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceGetRefsOutput, Box<dyn std::error::Error>>;

    async fn resolve_target(
        &self,
        input: ReferenceResolveTargetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReferenceResolveTargetOutput, Box<dyn std::error::Error>>;

}
