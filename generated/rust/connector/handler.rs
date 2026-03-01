// generated: connector/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConnectorHandler: Send + Sync {
    async fn configure(
        &self,
        input: ConnectorConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorConfigureOutput, Box<dyn std::error::Error>>;

    async fn read(
        &self,
        input: ConnectorReadInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorReadOutput, Box<dyn std::error::Error>>;

    async fn write(
        &self,
        input: ConnectorWriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorWriteOutput, Box<dyn std::error::Error>>;

    async fn test(
        &self,
        input: ConnectorTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorTestOutput, Box<dyn std::error::Error>>;

    async fn discover(
        &self,
        input: ConnectorDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConnectorDiscoverOutput, Box<dyn std::error::Error>>;

}
