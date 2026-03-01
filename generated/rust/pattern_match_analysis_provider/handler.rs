// generated: pattern_match_analysis_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PatternMatchAnalysisProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: PatternMatchAnalysisProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PatternMatchAnalysisProviderInitializeOutput, Box<dyn std::error::Error>>;

}
