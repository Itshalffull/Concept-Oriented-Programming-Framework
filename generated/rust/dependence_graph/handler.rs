// generated: dependence_graph/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DependenceGraphHandler: Send + Sync {
    async fn compute(
        &self,
        input: DependenceGraphComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphComputeOutput, Box<dyn std::error::Error>>;

    async fn query_dependents(
        &self,
        input: DependenceGraphQueryDependentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphQueryDependentsOutput, Box<dyn std::error::Error>>;

    async fn query_dependencies(
        &self,
        input: DependenceGraphQueryDependenciesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphQueryDependenciesOutput, Box<dyn std::error::Error>>;

    async fn slice_forward(
        &self,
        input: DependenceGraphSliceForwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphSliceForwardOutput, Box<dyn std::error::Error>>;

    async fn slice_backward(
        &self,
        input: DependenceGraphSliceBackwardInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphSliceBackwardOutput, Box<dyn std::error::Error>>;

    async fn impact_analysis(
        &self,
        input: DependenceGraphImpactAnalysisInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphImpactAnalysisOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: DependenceGraphGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DependenceGraphGetOutput, Box<dyn std::error::Error>>;

}
