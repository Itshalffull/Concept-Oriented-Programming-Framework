// generated: py_sdk_target/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PySdkTargetHandler: Send + Sync {
    async fn generate(
        &self,
        input: PySdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PySdkTargetGenerateOutput, Box<dyn std::error::Error>>;

}
