// generated: concept_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConceptEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: ConceptEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ConceptEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityGetOutput, Box<dyn std::error::Error>>;

    async fn find_by_capability(
        &self,
        input: ConceptEntityFindByCapabilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityFindByCapabilityOutput, Box<dyn std::error::Error>>;

    async fn find_by_kit(
        &self,
        input: ConceptEntityFindByKitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityFindByKitOutput, Box<dyn std::error::Error>>;

    async fn generated_artifacts(
        &self,
        input: ConceptEntityGeneratedArtifactsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityGeneratedArtifactsOutput, Box<dyn std::error::Error>>;

    async fn participating_syncs(
        &self,
        input: ConceptEntityParticipatingSyncsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityParticipatingSyncsOutput, Box<dyn std::error::Error>>;

    async fn check_compatibility(
        &self,
        input: ConceptEntityCheckCompatibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConceptEntityCheckCompatibilityOutput, Box<dyn std::error::Error>>;

}
