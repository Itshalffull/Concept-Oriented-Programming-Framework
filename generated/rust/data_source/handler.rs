// generated: data_source/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DataSourceHandler: Send + Sync {
    async fn register(
        &self,
        input: DataSourceRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceRegisterOutput, Box<dyn std::error::Error>>;

    async fn connect(
        &self,
        input: DataSourceConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceConnectOutput, Box<dyn std::error::Error>>;

    async fn discover(
        &self,
        input: DataSourceDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceDiscoverOutput, Box<dyn std::error::Error>>;

    async fn health_check(
        &self,
        input: DataSourceHealthCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceHealthCheckOutput, Box<dyn std::error::Error>>;

    async fn deactivate(
        &self,
        input: DataSourceDeactivateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataSourceDeactivateOutput, Box<dyn std::error::Error>>;

}
