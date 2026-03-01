// generated: interactor/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait InteractorHandler: Send + Sync {
    async fn define(
        &self,
        input: InteractorDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorDefineOutput, Box<dyn std::error::Error>>;

    async fn classify(
        &self,
        input: InteractorClassifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorClassifyOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: InteractorGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorGetOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: InteractorListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorListOutput, Box<dyn std::error::Error>>;

}
