// generated: anatomy_part_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AnatomyPartEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: AnatomyPartEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_role(
        &self,
        input: AnatomyPartEntityFindByRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindByRoleOutput, Box<dyn std::error::Error>>;

    async fn find_bound_to_field(
        &self,
        input: AnatomyPartEntityFindBoundToFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindBoundToFieldOutput, Box<dyn std::error::Error>>;

    async fn find_bound_to_action(
        &self,
        input: AnatomyPartEntityFindBoundToActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityFindBoundToActionOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: AnatomyPartEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnatomyPartEntityGetOutput, Box<dyn std::error::Error>>;

}
