// generated: kind_system/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait KindSystemHandler: Send + Sync {
    async fn define(
        &self,
        input: KindSystemDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemDefineOutput, Box<dyn std::error::Error>>;

    async fn connect(
        &self,
        input: KindSystemConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemConnectOutput, Box<dyn std::error::Error>>;

    async fn route(
        &self,
        input: KindSystemRouteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemRouteOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: KindSystemValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemValidateOutput, Box<dyn std::error::Error>>;

    async fn dependents(
        &self,
        input: KindSystemDependentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemDependentsOutput, Box<dyn std::error::Error>>;

    async fn producers(
        &self,
        input: KindSystemProducersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemProducersOutput, Box<dyn std::error::Error>>;

    async fn consumers(
        &self,
        input: KindSystemConsumersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemConsumersOutput, Box<dyn std::error::Error>>;

    async fn graph(
        &self,
        input: KindSystemGraphInput,
        storage: &dyn ConceptStorage,
    ) -> Result<KindSystemGraphOutput, Box<dyn std::error::Error>>;

}
