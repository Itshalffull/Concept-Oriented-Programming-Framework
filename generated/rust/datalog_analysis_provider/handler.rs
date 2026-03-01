// generated: datalog_analysis_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DatalogAnalysisProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: DatalogAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DatalogAnalysisProviderInitializeOutput, Box<dyn std::error::Error>>;

}
