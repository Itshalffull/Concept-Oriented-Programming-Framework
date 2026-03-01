// generated: cloudflare_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CloudflareRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: CloudflareRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: CloudflareRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: CloudflareRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: CloudflareRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: CloudflareRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
