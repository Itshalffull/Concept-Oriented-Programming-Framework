// generated: cloud_run_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CloudRunRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: CloudRunRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: CloudRunRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: CloudRunRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: CloudRunRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: CloudRunRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
