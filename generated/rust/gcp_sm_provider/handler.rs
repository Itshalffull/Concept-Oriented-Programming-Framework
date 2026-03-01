// generated: gcp_sm_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GcpSmProviderHandler: Send + Sync {
    async fn fetch(
        &self,
        input: GcpSmProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcpSmProviderFetchOutput, Box<dyn std::error::Error>>;

    async fn rotate(
        &self,
        input: GcpSmProviderRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcpSmProviderRotateOutput, Box<dyn std::error::Error>>;

}
