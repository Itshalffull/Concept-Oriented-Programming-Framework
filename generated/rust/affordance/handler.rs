// generated: affordance/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AffordanceHandler: Send + Sync {
    async fn declare(
        &self,
        input: AffordanceDeclareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceDeclareOutput, Box<dyn std::error::Error>>;

    async fn match(
        &self,
        input: AffordanceMatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceMatchOutput, Box<dyn std::error::Error>>;

    async fn explain(
        &self,
        input: AffordanceExplainInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceExplainOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: AffordanceRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AffordanceRemoveOutput, Box<dyn std::error::Error>>;

}
