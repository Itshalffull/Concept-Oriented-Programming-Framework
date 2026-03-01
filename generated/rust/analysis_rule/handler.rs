// generated: analysis_rule/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AnalysisRuleHandler: Send + Sync {
    async fn create(
        &self,
        input: AnalysisRuleCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleCreateOutput, Box<dyn std::error::Error>>;

    async fn evaluate(
        &self,
        input: AnalysisRuleEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleEvaluateOutput, Box<dyn std::error::Error>>;

    async fn evaluate_all(
        &self,
        input: AnalysisRuleEvaluateAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleEvaluateAllOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: AnalysisRuleGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AnalysisRuleGetOutput, Box<dyn std::error::Error>>;

}
