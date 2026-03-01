// generated: gcf_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GcfRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: GcfRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: GcfRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: GcfRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: GcfRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: GcfRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
