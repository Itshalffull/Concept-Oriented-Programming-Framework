// generated: datalog_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DatalogDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: DatalogDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DatalogDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
