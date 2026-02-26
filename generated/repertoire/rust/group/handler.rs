// generated: group/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GroupHandler: Send + Sync {
    async fn create_group(
        &self,
        input: GroupCreateGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupCreateGroupOutput, Box<dyn std::error::Error>>;

    async fn add_member(
        &self,
        input: GroupAddMemberInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAddMemberOutput, Box<dyn std::error::Error>>;

    async fn assign_group_role(
        &self,
        input: GroupAssignGroupRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAssignGroupRoleOutput, Box<dyn std::error::Error>>;

    async fn add_content(
        &self,
        input: GroupAddContentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupAddContentOutput, Box<dyn std::error::Error>>;

    async fn check_group_access(
        &self,
        input: GroupCheckGroupAccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GroupCheckGroupAccessOutput, Box<dyn std::error::Error>>;

}
