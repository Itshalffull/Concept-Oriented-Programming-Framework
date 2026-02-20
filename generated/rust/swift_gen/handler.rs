// generated: swift_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SwiftGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: SwiftGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftGenGenerateOutput, Box<dyn std::error::Error>>;

}
