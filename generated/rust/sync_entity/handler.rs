// generated: sync_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SyncEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: SyncEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_concept(
        &self,
        input: SyncEntityFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindByConceptOutput, Box<dyn std::error::Error>>;

    async fn find_triggerable_by(
        &self,
        input: SyncEntityFindTriggerableByInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindTriggerableByOutput, Box<dyn std::error::Error>>;

    async fn chain_from(
        &self,
        input: SyncEntityChainFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityChainFromOutput, Box<dyn std::error::Error>>;

    async fn find_dead_ends(
        &self,
        input: SyncEntityFindDeadEndsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindDeadEndsOutput, Box<dyn std::error::Error>>;

    async fn find_orphan_variants(
        &self,
        input: SyncEntityFindOrphanVariantsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityFindOrphanVariantsOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: SyncEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncEntityGetOutput, Box<dyn std::error::Error>>;

}
