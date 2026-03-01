// generated: data_quality/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DataQualityHandler: Send + Sync {
    async fn validate(
        &self,
        input: DataQualityValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityValidateOutput, Box<dyn std::error::Error>>;

    async fn quarantine(
        &self,
        input: DataQualityQuarantineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityQuarantineOutput, Box<dyn std::error::Error>>;

    async fn release(
        &self,
        input: DataQualityReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityReleaseOutput, Box<dyn std::error::Error>>;

    async fn profile(
        &self,
        input: DataQualityProfileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityProfileOutput, Box<dyn std::error::Error>>;

    async fn reconcile(
        &self,
        input: DataQualityReconcileInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DataQualityReconcileOutput, Box<dyn std::error::Error>>;

}
