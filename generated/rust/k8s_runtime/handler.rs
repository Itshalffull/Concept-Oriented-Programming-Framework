// generated: k8s_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait K8sRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: K8sRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: K8sRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: K8sRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: K8sRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: K8sRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
