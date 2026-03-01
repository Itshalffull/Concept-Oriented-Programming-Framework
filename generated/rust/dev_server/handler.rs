// generated: dev_server/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DevServerHandler: Send + Sync {
    async fn start(
        &self,
        input: DevServerStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStartOutput, Box<dyn std::error::Error>>;

    async fn stop(
        &self,
        input: DevServerStopInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStopOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: DevServerStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStatusOutput, Box<dyn std::error::Error>>;

}
