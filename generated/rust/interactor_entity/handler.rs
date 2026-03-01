// generated: interactor_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait InteractorEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: InteractorEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_category(
        &self,
        input: InteractorEntityFindByCategoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityFindByCategoryOutput, Box<dyn std::error::Error>>;

    async fn matching_widgets(
        &self,
        input: InteractorEntityMatchingWidgetsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityMatchingWidgetsOutput, Box<dyn std::error::Error>>;

    async fn classified_fields(
        &self,
        input: InteractorEntityClassifiedFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityClassifiedFieldsOutput, Box<dyn std::error::Error>>;

    async fn coverage_report(
        &self,
        input: InteractorEntityCoverageReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityCoverageReportOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: InteractorEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InteractorEntityGetOutput, Box<dyn std::error::Error>>;

}
