// generated: file_artifact/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FileArtifactHandler: Send + Sync {
    async fn register(
        &self,
        input: FileArtifactRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactRegisterOutput, Box<dyn std::error::Error>>;

    async fn set_provenance(
        &self,
        input: FileArtifactSetProvenanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactSetProvenanceOutput, Box<dyn std::error::Error>>;

    async fn find_by_role(
        &self,
        input: FileArtifactFindByRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactFindByRoleOutput, Box<dyn std::error::Error>>;

    async fn find_generated_from(
        &self,
        input: FileArtifactFindGeneratedFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactFindGeneratedFromOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: FileArtifactGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FileArtifactGetOutput, Box<dyn std::error::Error>>;

}
