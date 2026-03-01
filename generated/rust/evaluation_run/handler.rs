// generated: evaluation_run/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EvaluationRunHandler: Send + Sync {
    async fn run_eval(
        &self,
        input: EvaluationRunRunEvalInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunRunEvalOutput, Box<dyn std::error::Error>>;

    async fn log_metric(
        &self,
        input: EvaluationRunLogMetricInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunLogMetricOutput, Box<dyn std::error::Error>>;

    async fn pass(
        &self,
        input: EvaluationRunPassInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunPassOutput, Box<dyn std::error::Error>>;

    async fn fail(
        &self,
        input: EvaluationRunFailInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunFailOutput, Box<dyn std::error::Error>>;

    async fn get_result(
        &self,
        input: EvaluationRunGetResultInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvaluationRunGetResultOutput, Box<dyn std::error::Error>>;
}
