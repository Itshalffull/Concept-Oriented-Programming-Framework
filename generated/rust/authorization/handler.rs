// generated: authorization/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AuthorizationHandler: Send + Sync {
    async fn grant_permission(
        &self,
        input: AuthorizationGrantPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationGrantPermissionOutput, Box<dyn std::error::Error>>;

    async fn revoke_permission(
        &self,
        input: AuthorizationRevokePermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationRevokePermissionOutput, Box<dyn std::error::Error>>;

    async fn assign_role(
        &self,
        input: AuthorizationAssignRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationAssignRoleOutput, Box<dyn std::error::Error>>;

    async fn check_permission(
        &self,
        input: AuthorizationCheckPermissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthorizationCheckPermissionOutput, Box<dyn std::error::Error>>;

}
