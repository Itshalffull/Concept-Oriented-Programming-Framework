// generated: action_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ActionEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: ActionEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_concept(
        &self,
        input: ActionEntityFindByConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityFindByConceptOutput, Box<dyn std::error::Error>>;

    async fn triggering_syncs(
        &self,
        input: ActionEntityTriggeringSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityTriggeringSyncsOutput, Box<dyn std::error::Error>>;

    async fn invoking_syncs(
        &self,
        input: ActionEntityInvokingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityInvokingSyncsOutput, Box<dyn std::error::Error>>;

    async fn implementations(
        &self,
        input: ActionEntityImplementationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityImplementationsOutput, Box<dyn std::error::Error>>;

    async fn interface_exposures(
        &self,
        input: ActionEntityInterfaceExposuresInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityInterfaceExposuresOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ActionEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionEntityGetOutput, Box<dyn std::error::Error>>;

}
