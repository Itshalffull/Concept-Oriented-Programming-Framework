// generated: rust_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RustGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: RustGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RustGenGenerateOutput, Box<dyn std::error::Error>>;

}
