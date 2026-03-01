// Approval concept handler trait
// Defines the async interface for approval workflow actions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ApprovalHandler: Send + Sync {
    async fn request(
        &self,
        input: ApprovalRequestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalRequestOutput, Box<dyn std::error::Error>>;

    async fn approve(
        &self,
        input: ApprovalApproveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalApproveOutput, Box<dyn std::error::Error>>;

    async fn deny(
        &self,
        input: ApprovalDenyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalDenyOutput, Box<dyn std::error::Error>>;

    async fn request_changes(
        &self,
        input: ApprovalRequestChangesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalRequestChangesOutput, Box<dyn std::error::Error>>;

    async fn timeout(
        &self,
        input: ApprovalTimeoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalTimeoutOutput, Box<dyn std::error::Error>>;

    async fn get_status(
        &self,
        input: ApprovalGetStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApprovalGetStatusOutput, Box<dyn std::error::Error>>;
}
