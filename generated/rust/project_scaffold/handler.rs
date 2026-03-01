// generated: project_scaffold/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProjectScaffoldHandler: Send + Sync {
    async fn scaffold(
        &self,
        input: ProjectScaffoldScaffoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProjectScaffoldScaffoldOutput, Box<dyn std::error::Error>>;

}
