// generated: vercel_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VercelRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: VercelRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: VercelRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: VercelRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: VercelRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: VercelRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
