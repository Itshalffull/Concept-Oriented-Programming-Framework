// ConnectorCall concept handler trait
// Defines the async interface for external connector call management.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConnectorCallHandler: Send + Sync {
    async fn invoke(
        &self,
        input: ConnectorCallInvokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallInvokeOutput, Box<dyn std::error::Error>>;

    async fn mark_success(
        &self,
        input: ConnectorCallMarkSuccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallMarkSuccessOutput, Box<dyn std::error::Error>>;

    async fn mark_failure(
        &self,
        input: ConnectorCallMarkFailureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallMarkFailureOutput, Box<dyn std::error::Error>>;

    async fn get_result(
        &self,
        input: ConnectorCallGetResultInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorCallGetResultOutput, Box<dyn std::error::Error>>;
}
